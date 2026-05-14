/** HTTP API Server — 提供截图、鼠标、键盘操作等 RESTful API */

import express, { Request, Response, NextFunction } from 'express';
import { captureFrame, captureFrameWithGrid, getScreenInfo, detectGridLevel, GRID_LEVELS } from './screen';
import { mouseMove, mouseLeftClick, mouseRightClick, mouseDoubleClick, mouseScroll, mouseDrag, mousePressLeft, mouseReleaseLeft, getMousePosition } from './mouse';
import { keyboardType, keyboardPress, keyboardRelease } from './keyboard';
import { getConfig } from './config';
import { getAccessibilityTree, getFocusedElement } from './accessibility';
import { ScreenshotRequest, ScreenshotResponse, ScreenInfoResponse, MouseRequest, KeyboardRequest, HealthResponse, AccessibilityTreeResponse, FocusedElementResponse } from './types';

// HTTP 请求中间件 — Bearer Token 认证
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  const authHeader = req.headers['authorization'];

  // 健康检查端点不需要认证
  if (req.path === '/api/health') {
    return next();
  }

  // 检查 Authorization: Bearer <password>
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid Authorization header. Use: Authorization: Bearer <password>' });
    return;
  }

  const token = authHeader.slice(7); // 移除 "Bearer " 前缀
  if (token !== config.password) {
    res.status(401).json({ error: 'Unauthorized: invalid password' });
    return;
  }

  next();
}

export function startHTTPServer(): { app: express.Application; close: () => Promise<void> } {
  const config = getConfig();
  const app = express();

  // 中间件
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 应用认证中间件
  app.use(authMiddleware);

  // ===== 截图 API =====

  // GET /api/screenshot — 直接返回 JPEG 图片（适合 curl 保存）
  // 支持查询参数：quality, maxWidth, maxHeight, showGrid, gridLevel, gridColor, gridAlpha, subGridAlpha
  app.get('/api/screenshot', async (req: Request, res: Response) => {
    try {
      const quality = req.query.quality ? parseInt(req.query.quality as string) : 80;
      const maxWidth = req.query.maxWidth ? parseInt(req.query.maxWidth as string) : undefined;
      const maxHeight = req.query.maxHeight ? parseInt(req.query.maxHeight as string) : undefined;
      const showGrid = req.query.showGrid === 'true';

      // 网格层级参数
      let gridLevel: 32 | 64 | 128 | undefined;
      if (req.query.gridLevel) {
        const level = parseInt(req.query.gridLevel as string);
        if (level === 32 || level === 64 || level === 128) {
          gridLevel = level;
        }
      }

      // 网格配置参数
      let gridConfigOverride;
      if (showGrid) {
        const gridColor = req.query.gridColor ? req.query.gridColor as string : undefined;
        const gridLineWidth = req.query.gridLineWidth ? parseInt(req.query.gridLineWidth as string) : undefined;
        const gridAlpha = req.query.gridAlpha ? parseFloat(req.query.gridAlpha as string) : undefined;
        const subGridAlpha = req.query.subGridAlpha ? parseFloat(req.query.subGridAlpha as string) : undefined;

        gridConfigOverride = {};
        if (gridColor !== undefined) {
          gridConfigOverride.mainGridColor = gridColor;
          gridConfigOverride.subGridColor = gridColor;
        }
        if (gridLineWidth !== undefined) {
          gridConfigOverride.mainGridLineWidth = gridLineWidth;
          gridConfigOverride.subGridLineWidth = gridLineWidth;
        }
        if (gridAlpha !== undefined) gridConfigOverride.mainGridAlpha = gridAlpha;
        if (subGridAlpha !== undefined) gridConfigOverride.subGridAlpha = subGridAlpha;
      }

      let frame;
      if (showGrid) {
        frame = await captureFrameWithGrid(quality, maxWidth, maxHeight, true, gridConfigOverride, gridLevel);
      } else {
        frame = await captureFrame(quality, maxWidth, maxHeight);
      }

      const buffer = Buffer.from(frame.data, 'base64');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', buffer.length.toString());
      res.send(buffer);
    } catch (err) {
      console.error('Screenshot error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Screenshot capture failed' });
    }
  });

  // POST /api/screenshot — 返回 base64 JSON（适合程序处理）
  // 请求体支持：quality, maxWidth, maxHeight, showGrid, gridLevel, gridColor, gridLineWidth, gridAlpha, subGridAlpha
  app.post('/api/screenshot', async (req: Request, res: Response) => {
    try {
      const { quality = 80, maxWidth, maxHeight, showGrid = false, gridLevel, gridColor, gridLineWidth, gridAlpha, subGridAlpha }: ScreenshotRequest = req.body || {};
      let frame;
      if (showGrid) {
        const gridConfigOverride: any = {};
        if (gridColor !== undefined) {
          gridConfigOverride.mainGridColor = gridColor;
          gridConfigOverride.subGridColor = gridColor;
        }
        if (gridLineWidth !== undefined) {
          gridConfigOverride.mainGridLineWidth = gridLineWidth;
          gridConfigOverride.subGridLineWidth = gridLineWidth;
        }
        if (gridAlpha !== undefined) gridConfigOverride.mainGridAlpha = gridAlpha;
        if (subGridAlpha !== undefined) gridConfigOverride.subGridAlpha = subGridAlpha;
        frame = await captureFrameWithGrid(quality, maxWidth, maxHeight, true, gridConfigOverride, gridLevel);
      } else {
        frame = await captureFrame(quality, maxWidth, maxHeight);
      }
      res.json(frame);
    } catch (err) {
      console.error('Screenshot error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Screenshot capture failed' });
    }
  });

  // ===== 屏幕信息 API =====

  // GET /api/screen/info
  app.get('/api/screen/info', (_req: Request, res: Response) => {
    const info = getScreenInfo();
    res.json({
      width: info.width,
      height: info.height,
      scaleFactor: info.scaleFactor,
    });
  });

  // ===== 鼠标 API =====

  // POST /api/mouse — 鼠标操作
  app.post('/api/mouse', async (req: Request, res: Response) => {
    try {
      const { action, x, y, direction, amount }: MouseRequest = req.body;

      if (!action) {
        return res.status(400).json({ error: 'action is required' });
      }

      const screenInfo = getScreenInfo();

      switch (action) {
        case 'move':
          if (x != null && y != null) {
            // 归一化坐标 (0-1000) 转为实际像素坐标
            const actualX = screenInfo.width * screenInfo.scaleFactor * (x / 1000);
            const actualY = screenInfo.height * screenInfo.scaleFactor * (y / 1000);
            await mouseMove(actualX, actualY);
          }
          break;

        case 'left_click':
          if (x != null && y != null) {
            const actualX = screenInfo.width * screenInfo.scaleFactor * (x / 1000);
            const actualY = screenInfo.height * screenInfo.scaleFactor * (y / 1000);
            await mouseMove(actualX, actualY);
            await new Promise(r => setTimeout(r, 100));
          }
          await mouseLeftClick();
          break;

        case 'right_click':
          await mouseRightClick();
          break;

        case 'double_click':
          await mouseDoubleClick();
          break;

        case 'scroll':
          await mouseScroll(direction || 'down', amount || 1);
          break;

        case 'press_left':
          await mousePressLeft();
          break;

        case 'release_left':
          await mouseReleaseLeft();
          break;

        case 'drag':
          if (x != null && y != null) {
            const actualX = screenInfo.width * screenInfo.scaleFactor * (x / 1000);
            const actualY = screenInfo.height * screenInfo.scaleFactor * (y / 1000);
            await mouseDrag(actualX, actualY);
          }
          break;

        default:
          return res.status(400).json({ error: `Unknown mouse action: ${action}` });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Mouse error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Mouse action failed' });
    }
  });

  // GET /api/mouse/position — 获取鼠标位置
  app.get('/api/mouse/position', async (_req: Request, res: Response) => {
    try {
      const pos = await getMousePosition();
      res.json({ x: pos.x, y: pos.y });
    } catch (err) {
      console.error('Get mouse position error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Get position failed' });
    }
  });

  // ===== 键盘 API =====

  // POST /api/keyboard — 键盘操作
  app.post('/api/keyboard', async (req: Request, res: Response) => {
    try {
      const { action, text, keys }: KeyboardRequest = req.body;

      if (!action) {
        return res.status(400).json({ error: 'action is required' });
      }

      switch (action) {
        case 'type':
          if (!text) {
            return res.status(400).json({ error: 'text is required for type action' });
          }
          await keyboardType(text);
          break;

        case 'press':
          if (!keys || keys.length === 0) {
            return res.status(400).json({ error: 'keys is required for press action' });
          }
          await keyboardPress(keys);
          break;

        case 'release':
          if (!keys || keys.length === 0) {
            return res.status(400).json({ error: 'keys is required for release action' });
          }
          await keyboardRelease(keys);
          break;

        default:
          return res.status(400).json({ error: `Unknown keyboard action: ${action}` });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Keyboard error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Keyboard action failed' });
    }
  });

  // ===== Accessibility API =====

  // GET /api/accessibility — 获取当前焦点窗口的元素树
  // 支持查询参数：maxDepth（默认 3）
  app.get('/api/accessibility', async (req: Request, res: Response) => {
    try {
      const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : 3;
      const tree = await getAccessibilityTree(maxDepth);
      const response: AccessibilityTreeResponse = { tree };
      res.json(response);
    } catch (err) {
      console.error('Accessibility error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Accessibility API error' });
    }
  });

  // GET /api/accessibility/focused — 获取当前焦点元素
  app.get('/api/accessibility/focused', async (_req: Request, res: Response) => {
    try {
      const element = await getFocusedElement();
      const response: FocusedElementResponse = { element };
      res.json(response);
    } catch (err) {
      console.error('Accessibility error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Accessibility API error' });
    }
  });

  // ===== 健康检查 =====
  app.get('/api/health', (_req: Request, res: Response) => {
    const config = getConfig();
    const response: HealthResponse = {
      status: 'ok',
      wsPort: config.wsPort,
      httpPort: config.httpPort,
    };
    res.json(response);
  });

  // 启动服务器
  const server = app.listen(config.httpPort, () => {
    console.log(`HTTP server started on port ${config.httpPort}`);
    console.log(`API endpoints:`);
    console.log(`  GET  /api/health`);
    console.log(`  GET  /api/screenshot?quality=80&showGrid=true`);
    console.log(`  POST /api/screenshot`);
    console.log(`  GET  /api/screen/info`);
    console.log(`  POST /api/mouse`);
    console.log(`  GET  /api/mouse/position`);
    console.log(`  POST /api/keyboard`);
    console.log(`  GET  /api/accessibility?maxDepth=3`);
    console.log(`  GET  /api/accessibility/focused`);
    console.log(`\nAuth: Use Authorization: Bearer <password> header`);
  console.log(`\nScreenshot grid options:`);
  console.log(`  showGrid=true        - enable grid overlay`);
  console.log(`  gridLevel=32|64|128  - grid level (auto-detected by resolution if not specified)`);
  console.log(`    - 32:  4x2=8  main grids, 16 sub-grids each (128 total)`);
  console.log(`    - 64:  4x4=16 main grids, 16 sub-grids each (256 total)`);
  console.log(`    - 128: 8x4=32 main grids, 16 sub-grids each (512 total)`);
  console.log(`  gridColor=255,0,0   - grid color (RGB)`);
  console.log(`  gridAlpha=0.6       - main grid opacity (0-1)`);
  console.log(`  subGridAlpha=0.2    - sub-grid dashed lines opacity (0-1)`);
  console.log(`  gridLineWidth=2     - grid line width (pixels)`);
  });

  return {
    app,
    close: (): Promise<void> => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

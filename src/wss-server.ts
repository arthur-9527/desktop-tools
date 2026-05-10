import { WebSocketServer, WebSocket } from 'ws';
import { screen } from 'electron';
import { getConfig } from './config';
import { getScreenInfo, captureFrame, getScreenSize } from './screen';
import {
  initMouse,
  mouseSetPosition,
  mouseMove,
  mouseDrag,
  mousePressLeft,
  mouseReleaseLeft,
  mouseLeftClick,
  mouseRightClick,
  mouseDoubleClick,
  mouseScroll,
  getMousePosition,
  normalizedToActual,
} from './mouse';
import { initKeyboard, keyboardType, keyboardPress, keyboardRelease } from './keyboard';
import { WS_COMMAND } from './constants';
import type { nutjsTs, ResponseMessage } from './types';

// 流控制
const streamClients = new Map<WebSocket, NodeJS.Timeout>();

export function startWSServer(nutjs: nutjsTs): WebSocketServer & { closeAllClients: () => void } {
  // 初始化 mouse 和 keyboard 模块
  initMouse(nutjs);
  initKeyboard(nutjs);

  const config = getConfig();
  const wss = new WebSocketServer({ port: config.wsPort });

  console.log(`WebSocket server started on port ${config.wsPort}`);

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`Client connected from ${clientIp}`);
    let authenticated = false;

    ws.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        // 认证检查
        if (!authenticated && msg.type !== WS_COMMAND.AUTH) {
          ws.send(JSON.stringify({ type: WS_COMMAND.AUTH_REQUIRED }));
          return;
        }

        switch (msg.type) {
          // === 认证 ===
          case WS_COMMAND.AUTH:
            authenticated = msg.password === config.password;
            ws.send(JSON.stringify({
              type: WS_COMMAND.AUTH_RESULT,
              success: authenticated,
            }));
            if (authenticated) {
              const screenSize = getScreenSize();
              ws.send(JSON.stringify({
                type: WS_COMMAND.READY,
                screenSize,
                platform: process.platform,
              }));
            }
            break;

          // === 屏幕 ===
          case WS_COMMAND.CAPTURE_FRAME: {
            // maxWidth/maxHeight 默认使用屏幕分辨率，quality 默认为 80（768p 分辨率下画质几乎无损）
            const frame = await captureFrame(msg.quality ?? 80, msg.maxWidth, msg.maxHeight);
            ws.send(JSON.stringify({ type: WS_COMMAND.FRAME, ...frame }));
            break;
          }

          case WS_COMMAND.START_STREAM: {
            const fps = msg.fps || 15;
            const quality = msg.quality ?? 80;
            const maxWidth = msg.maxWidth;  // 允许自定义最大宽度
            const maxHeight = msg.maxHeight;  // 允许自定义最大高度
            const interval = 1000 / fps;

            // 停止已有流
            if (streamClients.has(ws)) {
              clearInterval(streamClients.get(ws));
            }

            // 开始新流
            const timer = setInterval(async () => {
              if (ws.readyState === WebSocket.OPEN) {
                try {
                  const frame = await captureFrame(quality, maxWidth, maxHeight);
                  ws.send(JSON.stringify({ type: WS_COMMAND.FRAME, ...frame }));
                } catch (err) {
                  console.error('Stream error:', err);
                }
              }
            }, interval);

            streamClients.set(ws, timer);
            ws.send(JSON.stringify({
              type: WS_COMMAND.STREAM_STARTED,
              fps,
              quality,
            }));
            break;
          }

          case WS_COMMAND.STOP_STREAM: {
            if (streamClients.has(ws)) {
              clearInterval(streamClients.get(ws));
              streamClients.delete(ws);
            }
            ws.send(JSON.stringify({ type: WS_COMMAND.STREAM_STOPPED }));
            break;
          }

          case WS_COMMAND.GET_SCREEN_INFO: {
            const info = getScreenInfo();
            ws.send(JSON.stringify({ type: WS_COMMAND.SCREEN_INFO, ...info }));
            break;
          }

          // === 鼠标 ===
          case WS_COMMAND.MOUSE_MOVE: {
            const { x, y } = msg;
            const screenInfo = getScreenInfo();
            const actual = normalizedToActual(
              x, y,
              screenInfo.width,
              screenInfo.height,
              screenInfo.scaleFactor,
              process.platform
            );
            await mouseMove(actual.x, actual.y);
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.MOUSE_LEFT_CLICK: {
            if (msg.x !== undefined && msg.y !== undefined) {
              const screenInfo = getScreenInfo();
              const actual = normalizedToActual(
                msg.x, msg.y,
                screenInfo.width,
                screenInfo.height,
                screenInfo.scaleFactor,
                process.platform
              );
              await mouseSetPosition(actual.x, actual.y);
            }
            await mouseLeftClick();
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.MOUSE_RIGHT_CLICK: {
            if (msg.x !== undefined && msg.y !== undefined) {
              const screenInfo = getScreenInfo();
              const actual = normalizedToActual(
                msg.x, msg.y,
                screenInfo.width,
                screenInfo.height,
                screenInfo.scaleFactor,
                process.platform
              );
              await mouseSetPosition(actual.x, actual.y);
            }
            await mouseRightClick();
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.MOUSE_DOUBLE_CLICK: {
            await mouseDoubleClick();
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.MOUSE_PRESS_LEFT: {
            await mousePressLeft();
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.MOUSE_RELEASE_LEFT: {
            await mouseReleaseLeft();
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.MOUSE_DRAG: {
            const { x, y } = msg;
            const screenInfo = getScreenInfo();
            const actual = normalizedToActual(
              x, y,
              screenInfo.width,
              screenInfo.height,
              screenInfo.scaleFactor,
              process.platform
            );
            await mouseDrag(actual.x, actual.y);
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.MOUSE_SCROLL: {
            const { direction, amount } = msg;
            await mouseScroll(direction, amount);
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.GET_MOUSE_POSITION: {
            const pos = await getMousePosition();
            ws.send(JSON.stringify({
              type: WS_COMMAND.MOUSE_POSITION,
              x: pos.x,
              y: pos.y,
            }));
            break;
          }

          // === 键盘 ===
          case WS_COMMAND.KEYBOARD_TYPE: {
            const { text } = msg;
            await keyboardType(text);
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.KEYBOARD_PRESS: {
            const { keys } = msg;
            await keyboardPress(keys);
            sendResponse(ws, msg.type, 0);
            break;
          }

          case WS_COMMAND.KEYBOARD_RELEASE: {
            const { keys } = msg;
            await keyboardRelease(keys);
            sendResponse(ws, msg.type, 0);
            break;
          }

          default:
            sendResponse(ws, msg.type, 1, `Unknown command: ${msg.type}`);
        }
      } catch (error) {
        console.error('Message handling error:', error);
        ws.send(JSON.stringify({
          type: WS_COMMAND.RESPONSE,
          requestType: 'unknown',
          code: 1,
          msg: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected from ${clientIp}`);
      // 清理流
      if (streamClients.has(ws)) {
        clearInterval(streamClients.get(ws));
        streamClients.delete(ws);
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error from ${clientIp}:`, error);
    });
  });

  // 添加关闭所有客户端的方法
  const wssWithCloseAll = Object.assign(wss, {
    closeAllClients: () => {
      console.log('Closing all WebSocket clients...');
      // 清理所有流的定时器
      streamClients.forEach((timer, ws) => {
        clearInterval(timer);
        streamClients.delete(ws);
      });
      // 关闭所有客户端连接
      wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Server shutting down');
        }
      });
      console.log('All WebSocket clients closed');
    }
  });

  return wssWithCloseAll;
}

function sendResponse(ws: WebSocket, requestType: string, code: number, msg?: string): void {
  const response: ResponseMessage = {
    type: WS_COMMAND.RESPONSE,
    requestType,
    code,
    msg,
  };
  ws.send(JSON.stringify(response));
}
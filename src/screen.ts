import { desktopCapturer, screen } from 'electron';
import Jimp from 'jimp';

export interface FrameData {
  data: string; // base64
  width: number;
  height: number;
  timestamp: number;
}

export interface ScreenInfo {
  width: number;
  height: number;
  scaleFactor: number;
}

// 获取屏幕信息
export function getScreenInfo(): ScreenInfo {
  const primaryDisplay = screen.getPrimaryDisplay();
  return {
    width: primaryDisplay.size.width,
    height: primaryDisplay.size.height,
    scaleFactor: primaryDisplay.scaleFactor,
  };
}

// 捕获单帧屏幕
// 对于桌面控制场景，推荐使用中等分辨率 + 高质量压缩：maxWidth=1366, maxHeight=768, quality=80
// 768p 分辨率下 quality=80 画质几乎无损，截屏大小约 150-300KB（base64 后约 200-400KB）
export async function captureFrame(
  quality = 80,
  maxWidth = 1366,
  maxHeight = 768
): Promise<FrameData> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: maxWidth, height: maxHeight },
  });

  const source = sources[0]; // 主屏幕
  const jpegBuffer = source.thumbnail.toJPEG(quality);
  const base64 = jpegBuffer.toString('base64');

  const size = source.thumbnail.getSize();

  return {
    data: base64,
    width: size.width,
    height: size.height,
    timestamp: Date.now(),
  };
}

// 获取屏幕尺寸
export function getScreenSize(): { width: number; height: number } {
  const primaryDisplay = screen.getPrimaryDisplay();
  return {
    width: primaryDisplay.size.width,
    height: primaryDisplay.size.height,
  };
}

// ========== 网格叠加功能 ==========

export interface GridLevelConfig {
  level: 32 | 64 | 128;         // 网格层级
  cols: number;                 // 大格子列数
  rows: number;                 // 大格子行数
  subDivisions: number;         // 每大格细分数量（默认4，形成4x4小格）
}

export interface GridConfig {
  // 大格子（16宫格）配置
  mainGridCols: number;         // 大格子列数
  mainGridRows: number;         // 大格子行数
  mainGridColor: string;        // 大格子颜色
  mainGridLineWidth: number;    // 大格子线宽
  mainGridAlpha: number;        // 大格子透明度 (0-1)

  // 小格子虚线配置
  subGridColor: string;         // 小格子颜色
  subGridLineWidth: number;     // 小格子线宽
  subGridAlpha: number;         // 小格子透明度 (0-1)
  dashLength: number;           // 虚线段长度
  gapLength: number;            // 虚线间隙长度
  subDivisions: number;         // 每大格细分数量
}

// 网格层级配置
export const GRID_LEVELS: Record<number, GridLevelConfig> = {
  32: { level: 32, cols: 4, rows: 2, subDivisions: 4 },   // 4列×2行=8格 × 16小格 = 128子格
  64: { level: 64, cols: 4, rows: 4, subDivisions: 4 },   // 4列×4行=16格 × 16小格 = 256子格
  128: { level: 128, cols: 8, rows: 4, subDivisions: 4 }, // 8列×4行=32格 × 16小格 = 512子格
};

// 根据分辨率自动检测网格层级
export function detectGridLevel(width: number): GridLevelConfig {
  if (width <= 1280) {
    return GRID_LEVELS[32];   // 低分辨率：32层级
  } else if (width <= 1920) {
    return GRID_LEVELS[64];   // 中等分辨率：64层级
  } else {
    return GRID_LEVELS[128];  // 高分辨率：128层级
  }
}

// 默认网格配置
export const DEFAULT_GRID_CONFIG: GridConfig = {
  mainGridCols: 4,                // 4列
  mainGridRows: 4,                // 4行（默认中分辨率）
  mainGridColor: '255,0,0',       // 红色
  mainGridLineWidth: 2,
  mainGridAlpha: 0.6,

  subGridColor: '255,0,0',        // 红色
  subGridLineWidth: 1,
  subGridAlpha: 0.2,
  dashLength: 4,                  // 线段长度 4px
  gapLength: 4,                   // 间隙长度 4px
  subDivisions: 4,                // 每大格细分4份（形成4x4小格）
};

// 在图像上叠加双层网格：大格子实线 + 小格子虚线细分
export function drawGrid(
  image: Jimp,
  config: Partial<GridConfig> = {}
): Jimp {
  const gridConfig = { ...DEFAULT_GRID_CONFIG, ...config };
  const width = image.bitmap.width;
  const height = image.bitmap.height;

  // 将颜色字符串转换为 RGBA
  const colorToRGBA = (colorStr: string, alpha: number): [number, number, number, number] => {
    const parts = colorStr.split(',').map(p => parseInt(p.trim()));
    return [parts[0], parts[1], parts[2], Math.round(alpha * 255)];
  };

  const mainRgba = colorToRGBA(gridConfig.mainGridColor, gridConfig.mainGridAlpha);
  const subRgba = colorToRGBA(gridConfig.subGridColor, gridConfig.subGridAlpha);

  // 计算大格子尺寸
  const mainCellWidth = Math.floor(width / gridConfig.mainGridCols);
  const mainCellHeight = Math.floor(height / gridConfig.mainGridRows);
  const subDivisions = gridConfig.subDivisions;
  const dashLength = gridConfig.dashLength;
  const gapLength = gridConfig.gapLength;

  // ========== 绘制大格子边框（粗实线）==========

  // 大格子横线
  for (let i = 0; i <= gridConfig.mainGridRows; i++) {
    const y = i * mainCellHeight;
    if (y >= height) continue;
    for (let dy = 0; dy < gridConfig.mainGridLineWidth; dy++) {
      const lineY = y + dy;
      if (lineY >= height) continue;
      for (let x = 0; x < width; x++) {
        image.setPixelColor(
          Jimp.rgbaToInt(mainRgba[0], mainRgba[1], mainRgba[2], mainRgba[3]),
          x,
          lineY
        );
      }
    }
  }

  // 大格子竖线
  for (let i = 0; i <= gridConfig.mainGridCols; i++) {
    const x = i * mainCellWidth;
    if (x >= width) continue;
    for (let dx = 0; dx < gridConfig.mainGridLineWidth; dx++) {
      const lineX = x + dx;
      if (lineX >= width) continue;
      for (let y = 0; y < height; y++) {
        image.setPixelColor(
          Jimp.rgbaToInt(mainRgba[0], mainRgba[1], mainRgba[2], mainRgba[3]),
          lineX,
          y
        );
      }
    }
  }

  // ========== 绘制小格子虚线（每个大格子内细分）==========

  // 在每个大格子内绘制虚线（垂直和水平各 subDivisions-1 条）
  for (let row = 0; row < gridConfig.mainGridRows; row++) {
    for (let col = 0; col < gridConfig.mainGridCols; col++) {
      const cellStartX = col * mainCellWidth;
      const cellStartY = row * mainCellHeight;
      const cellEndX = Math.min((col + 1) * mainCellWidth, width);
      const cellEndY = Math.min((row + 1) * mainCellHeight, height);

      // 小格子的步长
      const subCellWidth = (cellEndX - cellStartX) / subDivisions;
      const subCellHeight = (cellEndY - cellStartY) / subDivisions;

      // 在大格子内绘制水平虚线（subDivisions-1 条）
      for (let i = 1; i < subDivisions; i++) {
        const y = Math.floor(cellStartY + i * subCellHeight);
        if (y >= cellEndY) continue;
        for (let dy = 0; dy < gridConfig.subGridLineWidth; dy++) {
          const lineY = y + dy;
          if (lineY >= height) continue;

          // 绘制虚线段
          for (let x = cellStartX; x < cellEndX; x += dashLength + gapLength) {
            for (let dx = 0; dx < dashLength && (x + dx) < cellEndX; dx++) {
              image.setPixelColor(
                Jimp.rgbaToInt(subRgba[0], subRgba[1], subRgba[2], subRgba[3]),
                x + dx,
                lineY
              );
            }
          }
        }
      }

      // 在大格子内绘制垂直虚线（subDivisions-1 条）
      for (let i = 1; i < subDivisions; i++) {
        const x = Math.floor(cellStartX + i * subCellWidth);
        if (x >= cellEndX) continue;
        for (let dx = 0; dx < gridConfig.subGridLineWidth; dx++) {
          const lineX = x + dx;
          if (lineX >= width) continue;

          // 绘制虚线段
          for (let y = cellStartY; y < cellEndY; y += dashLength + gapLength) {
            for (let dy = 0; dy < dashLength && (y + dy) < cellEndY; dy++) {
              image.setPixelColor(
                Jimp.rgbaToInt(subRgba[0], subRgba[1], subRgba[2], subRgba[3]),
                lineX,
                y + dy
              );
            }
          }
        }
      }
    }
  }

  return image;
}

// 捕获单帧屏幕 + 叠加网格
// 流程：desktopCapturer → 无损 JPEG → Jimp → 叠加网格 → JPEG 压缩 → base64
// 对于桌面控制场景，推荐使用中等分辨率 + 高质量压缩：maxWidth=1366, maxHeight=768, quality=80
export async function captureFrameWithGrid(
  quality = 80,
  maxWidth = 1366,
  maxHeight = 768,
  showGrid = true,
  gridConfigOverride?: Partial<GridConfig>,
  gridLevel?: 32 | 64 | 128
): Promise<FrameData> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: maxWidth, height: maxHeight },
  });

  const source = sources[0]; // 主屏幕
  const size = source.thumbnail.getSize();

  // 如果不需要网格，返回原始截图
  if (!showGrid) {
    const jpegBuffer = source.thumbnail.toJPEG(quality);
    const base64 = jpegBuffer.toString('base64');

    return {
      data: base64,
      width: size.width,
      height: size.height,
      timestamp: Date.now(),
    };
  }

  // 1. 获取无损 JPEG buffer（质量 100）
  const losslessJpegBuffer = source.thumbnail.toJPEG(100);

  // 2. 用 Jimp 加载
  const image = await Jimp.read(losslessJpegBuffer);

  // 3. 根据分辨率或指定层级确定网格配置
  let finalGridConfig: Partial<GridConfig>;
  
  if (gridLevel && GRID_LEVELS[gridLevel]) {
    // 使用指定的层级配置
    const levelConfig = GRID_LEVELS[gridLevel];
    finalGridConfig = {
      mainGridCols: levelConfig.cols,
      mainGridRows: levelConfig.rows,
      subDivisions: levelConfig.subDivisions,
      ...gridConfigOverride,
    };
  } else {
    // 自动检测分辨率层级
    const detectedLevel = detectGridLevel(size.width);
    finalGridConfig = {
      mainGridCols: detectedLevel.cols,
      mainGridRows: detectedLevel.rows,
      subDivisions: detectedLevel.subDivisions,
      ...gridConfigOverride,
    };
  }

  // 4. 叠加网格
  const imageWithGrid = drawGrid(image, finalGridConfig);

  // 5. 压缩到指定质量
  const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
    imageWithGrid.quality(quality).getBuffer('image/jpeg', (err, buffer) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(buffer);
    });
  });

  const base64 = compressedBuffer.toString('base64');

  return {
    data: base64,
    width: imageWithGrid.bitmap.width,
    height: imageWithGrid.bitmap.height,
    timestamp: Date.now(),
  };
}

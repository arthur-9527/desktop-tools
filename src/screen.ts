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

export interface GridConfig {
  // 九宫格配置
  mainGridColor: string;        // 九宫格颜色
  mainGridLineWidth: number;    // 九宫格线宽
  mainGridAlpha: number;        // 九宫格透明度 (0-1)

  // 点线网格配置
  subGridSize: number;          // 点线网格间距（像素）
  subGridColor: string;         // 点线网格颜色
  subGridLineWidth: number;     // 点线网格线宽
  subGridAlpha: number;         // 点线网格透明度 (0-1)

  // 点线样式
  dashLength: number;           // 线段长度
  gapLength: number;            // 间隙长度
}

// 默认网格配置
export const DEFAULT_GRID_CONFIG: GridConfig = {
  mainGridColor: '255,0,0',       // 红色
  mainGridLineWidth: 2,
  mainGridAlpha: 0.6,

  subGridSize: 16,                // 每 16px 一个点
  subGridColor: '255,0,0',        // 红色
  subGridLineWidth: 1,
  subGridAlpha: 0.2,

  dashLength: 4,                  // 线段长度 4px
  gapLength: 4,                   // 间隙长度 4px
};

// 在图像上叠加双层网格：九宫格 + 点线网格
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

  // 绘制九宫格（3x3 粗实线）
  const mainGridCount = 3;
  const mainCellWidth = Math.floor(width / mainGridCount);
  const mainCellHeight = Math.floor(height / mainGridCount);

  // 九宫格横线
  for (let i = 0; i < mainGridCount + 1; i++) {
    const y = i * mainCellHeight;
    for (let dx = 0; dx < gridConfig.mainGridLineWidth!; dx++) {
      const lineY = y + dx;
      if (lineY >= height) continue;
      const rgba = colorToRGBA(gridConfig.mainGridColor, gridConfig.mainGridAlpha);
      for (let x = 0; x < width; x++) {
        image.setPixelColor(
          Jimp.rgbaToInt(rgba[0], rgba[1], rgba[2], rgba[3]),
          x,
          lineY
        );
      }
    }
  }

  // 九宫格竖线
  for (let i = 0; i < mainGridCount + 1; i++) {
    const x = i * mainCellWidth;
    for (let dx = 0; dx < gridConfig.mainGridLineWidth!; dx++) {
      const lineX = x + dx;
      if (lineX >= width) continue;
      const rgba = colorToRGBA(gridConfig.mainGridColor, gridConfig.mainGridAlpha);
      for (let y = 0; y < height; y++) {
        image.setPixelColor(
          Jimp.rgbaToInt(rgba[0], rgba[1], rgba[2], rgba[3]),
          lineX,
          y
        );
      }
    }
  }

  // 绘制点线网格
  const dashLength = gridConfig.dashLength!;
  const gapLength = gridConfig.gapLength!;
  const subGridSize = gridConfig.subGridSize!;
  const rgba = colorToRGBA(gridConfig.subGridColor, gridConfig.subGridAlpha!);

  // 点线横线
  for (let y = 0; y < height; y += subGridSize) {
    for (let dx = 0; dx < gridConfig.subGridLineWidth!; dx++) {
      const lineY = y + dx;
      if (lineY >= height) continue;
      for (let x = 0; x < width; x += dashLength + gapLength) {
        for (let dx2 = 0; dx2 < dashLength && (x + dx2) < width; dx2++) {
          image.setPixelColor(
            Jimp.rgbaToInt(rgba[0], rgba[1], rgba[2], rgba[3]),
            x + dx2,
            lineY
          );
        }
      }
    }
  }

  // 点线竖线
  for (let x = 0; x < width; x += subGridSize) {
    for (let dx = 0; dx < gridConfig.subGridLineWidth!; dx++) {
      const lineX = x + dx;
      if (lineX >= width) continue;
      for (let y = 0; y < height; y += dashLength + gapLength) {
        for (let dx2 = 0; dx2 < dashLength && (y + dx2) < height; dx2++) {
          image.setPixelColor(
            Jimp.rgbaToInt(rgba[0], rgba[1], rgba[2], rgba[3]),
            lineX,
            y + dx2
          );
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
  gridConfigOverride?: Partial<GridConfig>
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

  // 3. 叠加网格
  const imageWithGrid = drawGrid(image, gridConfigOverride);

  // 4. 压缩到指定质量
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

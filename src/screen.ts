import { desktopCapturer, screen } from 'electron';

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
// 对于桌面控制场景，推荐使用低分辨率 + 高压缩：maxWidth=1024, maxHeight=768, quality=20
// 这样截屏大小约 30-60KB（base64 后约 40-80KB），Claude 的 vision 完全够用
export async function captureFrame(
  quality = 20,
  maxWidth = 1024,
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
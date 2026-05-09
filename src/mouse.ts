import type { nutjsTs } from './types';

// nut-js 实例（在 index.ts 中初始化后传入）
let nutjs: nutjsTs;

export function initMouse(nutjsInstance: nutjsTs): void {
  nutjs = nutjsInstance;
}

// 设置鼠标位置
export async function mouseSetPosition(x: number, y: number): Promise<void> {
  await nutjs.mouse.setPosition({ x, y });
}

// 移动鼠标（相对移动）
export async function mouseMove(x: number, y: number): Promise<void> {
  await nutjs.mouse.move([{ x, y }]);
}

// 拖拽鼠标
export async function mouseDrag(x: number, y: number): Promise<void> {
  await nutjs.mouse.drag([{ x, y }]);
}

// 左键按下
export async function mousePressLeft(): Promise<void> {
  await nutjs.mouse.pressButton(nutjs.Button.LEFT);
}

// 左键释放
export async function mouseReleaseLeft(): Promise<void> {
  await nutjs.mouse.releaseButton(nutjs.Button.LEFT);
}

// 左键点击
export async function mouseLeftClick(): Promise<void> {
  await nutjs.mouse.click(nutjs.Button.LEFT);
}

// 右键点击
export async function mouseRightClick(): Promise<void> {
  await nutjs.mouse.click(nutjs.Button.RIGHT);
}

// 双击
export async function mouseDoubleClick(): Promise<void> {
  await nutjs.mouse.doubleClick(nutjs.Button.LEFT);
}

// 滚轮滚动
export async function mouseScroll(
  direction: 'down' | 'up' | 'left' | 'right',
  amount: number
): Promise<void> {
  const scrollAmount = direction === 'up' || direction === 'left' ? -amount : amount;
  if (direction === 'up' || direction === 'down') {
    await nutjs.mouse.scrollDown(scrollAmount);
  } else {
    await nutjs.mouse.scrollRight(scrollAmount);
  }
}

// 获取鼠标位置
export async function getMousePosition(): Promise<{ x: number; y: number }> {
  return await nutjs.mouse.getPosition();
}

// 坐标转换：归一化坐标(0-1000) → 实际像素坐标
export function normalizedToActual(
  normalizedX: number,
  normalizedY: number,
  screenWidth: number,
  screenHeight: number,
  scaleFactor: number,
  platform: string
): { x: number; y: number } {
  // macOS 不加 scaleFactor
  const factor = platform === 'darwin' ? 1 : scaleFactor;
  const x = screenWidth * factor * (normalizedX / 1000);
  const y = screenHeight * factor * (normalizedY / 1000);
  return { x, y };
}
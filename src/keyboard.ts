import type { nutjsTs } from './types';
import { NUT_KEY_MAP } from './constants';

// nut-js 实例（在 index.ts 中初始化后传入）
let nutjs: nutjsTs;

export function initKeyboard(nutjsInstance: nutjsTs): void {
  nutjs = nutjsInstance;
}

// 输入字符串
export async function keyboardType(text: string): Promise<void> {
  await nutjs.keyboard.type(text);
}

// 按键组合
export async function keyboardPress(keys: string[]): Promise<void> {
  const nutKeys = keys.map((key) => {
    const mapped = NUT_KEY_MAP[key];
    if (!mapped) {
      console.warn(`未识别的按键: ${key}`);
    }
    return mapped;
  }).filter(Boolean);

  if (nutKeys.length > 0) {
    await nutjs.keyboard.pressKey(...nutKeys);
  }
}

// 释放按键
export async function keyboardRelease(keys: string[]): Promise<void> {
  const nutKeys = keys.map((key) => {
    const mapped = NUT_KEY_MAP[key];
    if (!mapped) {
      console.warn(`未识别的按键: ${key}`);
    }
    return mapped;
  }).filter(Boolean);

  if (nutKeys.length > 0) {
    await nutjs.keyboard.releaseKey(...nutKeys);
  }
}

// 按键并释放（单个按键）
export async function keyboardPressAndRelease(key: string): Promise<void> {
  const nutKey = NUT_KEY_MAP[key];
  if (nutKey) {
    await nutjs.keyboard.pressKey(nutKey);
    await nutjs.keyboard.releaseKey(nutKey);
  } else {
    console.warn(`未识别的按键: ${key}`);
  }
}
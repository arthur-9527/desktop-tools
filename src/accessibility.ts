/**
 * Accessibility API 封装层
 * 
 * 通过 Node-API (N-API) 调用 native addon，获取系统 Accessibility 元素树。
 * 
 * Windows: UIAutomation Core API
 * macOS: AXUIElement API
 * 
 * 使用方式:
 *   const tree = await getAccessibilityTree(3);  // 获取深度为 3 的元素树
 *   const focused = await getFocusedElement();   // 获取当前焦点元素
 */

import { join } from 'path';

// 尝试导入 native addon
// native addon 编译后会生成 .node 文件，文件名根据平台不同
// Windows: accessibility.node
// macOS: accessibility.node
// Linux: accessibility.node
// 注意：Electron 打包后，addon 位于 resources/accessibility.node
let nativeBinding: any;

// 尝试加载路径（优先级从高到低）：
// 1. resources/accessibility.node（Electron 打包后）
// 2. build/Release/accessibility.node（开发环境）
const addonPaths = [
  // Electron 打包后路径
  join(__dirname, '../resources/accessibility.node'),
  // 开发环境路径
  join(__dirname, '../src/native/build/Release/accessibility.node'),
];

for (const addonPath of addonPaths) {
  try {
    nativeBinding = require(addonPath);
    break;
  } catch (err) {
    // 尝试下一个路径
    continue;
  }
}

if (!nativeBinding) {
  console.warn('[accessibility] Native addon not loaded, accessibility features disabled');
}

export interface AccessibilityNode {
  role: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  children?: AccessibilityNode[];
}

/**
 * 获取当前焦点窗口的元素树
 * 
 * @param maxDepth - 最大递归深度，默认 3
 * @returns 元素树
 */
export async function getAccessibilityTree(maxDepth: number = 3): Promise<AccessibilityNode> {
  if (!nativeBinding) {
    return {
      role: 'error',
      name: 'accessibility addon not available',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      children: []
    };
  }

  try {
    // Node-API addon 同步调用
    const tree = nativeBinding.getAccessibilityTree(maxDepth);
    return tree as AccessibilityNode;
  } catch (err) {
    console.error('[accessibility] getAccessibilityTree error:', (err as Error).message);
    return {
      role: 'error',
      name: (err as Error).message,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      children: []
    };
  }
}

/**
 * 获取当前焦点元素
 * 
 * @returns 当前焦点元素
 */
export async function getFocusedElement(): Promise<AccessibilityNode> {
  if (!nativeBinding) {
    return {
      role: 'error',
      name: 'accessibility addon not available',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      children: []
    };
  }

  try {
    const element = nativeBinding.getFocusedElement();
    return element as AccessibilityNode;
  } catch (err) {
    console.error('[accessibility] getFocusedElement error:', (err as Error).message);
    return {
      role: 'error',
      name: (err as Error).message,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      children: []
    };
  }
}

/**
 * 根据元素角色和名称查找匹配的元素（在元素树中搜索）
 * 
 * @param tree - 元素树
 * @param role - 目标元素角色
 * @param name - 目标元素名称（可选，精确匹配）
 * @returns 匹配的元素数组
 */
export function findElementsByRole(tree: AccessibilityNode, role: string, name?: string): AccessibilityNode[] {
  const results: AccessibilityNode[] = [];
  
  function search(node: AccessibilityNode): void {
    if (node.role === role) {
      if (name === undefined || node.name === name) {
        results.push(node);
      }
    }
    if (node.children) {
      for (const child of node.children) {
        search(child);
      }
    }
  }
  
  search(tree);
  return results;
}

/**
 * 根据坐标获取所有覆盖该坐标的元素（从最外层到最内层）
 * 
 * @param tree - 元素树
 * @param x - X 坐标
 * @param y - Y 坐标
 * @returns 覆盖该坐标的元素列表
 */
export function findElementsAtPoint(tree: AccessibilityNode, x: number, y: number): AccessibilityNode[] {
  const results: AccessibilityNode[] = [];
  
  function search(node: AccessibilityNode): boolean {
    const { bounds } = node;
    if (
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height
    ) {
      results.push(node);
      // 继续搜索子元素（找到最内层元素）
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          if (search(child)) {
            return true; // 找到最内层就停止
          }
        }
      }
      return true;
    }
    return false;
  }
  
  search(tree);
  return results;
}
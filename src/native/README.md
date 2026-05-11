# Accessibility API - Native Addon

## 概述

通过 Node-API (N-API) 调用系统 Accessibility API，获取当前焦点窗口的元素树。

## 功能

- `getAccessibilityTree(maxDepth)` - 获取当前焦点窗口的元素树
- `getFocusedElement()` - 获取当前焦点元素

## API 响应格式

```json
{
  "role": "Button",
  "name": "Submit",
  "bounds": {
    "x": 100,
    "y": 200,
    "width": 80,
    "height": 30
  },
  "children": [...]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| role | string | 元素角色（Button, Text, Edit, CheckBox 等） |
| name | string | 元素名称/标题 |
| bounds | object | 元素边界框（屏幕坐标） |
| children | array | 子元素数组 |

### Windows role 枚举

Window, Pane, GroupBox, Button, Text, Edit, CheckBox, Menu, MenuItem, Tab, TabItem, ComboBox, ProgressBar, Separator, RadioButton, Tree, TreeItem, List, ListItem, Document, Hyperlink, Image, ToolBar, Annotation, DataGrid, DataItem, Caption, TabStop, Custom, Header, HeaderItem, Thumb, TitleBar, SplitButton, Status

## 编译

### Windows

```bash
npm run build:accessibility
```

编译后文件：`build/Release/accessibility.node`

### macOS

```bash
npm run build:accessibility
```

编译后文件：`build/Release/accessibility.node`

注意：macOS 需要"辅助功能"权限才能正常工作。

## HTTP API

### GET /api/accessibility

获取当前焦点窗口的元素树。

**查询参数：**
- `maxDepth` (可选) - 最大递归深度，默认 3

**响应：**
```json
{
  "tree": {
    "role": "Pane",
    "name": "Visual Studio Code",
    "bounds": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
    "children": [...]
  }
}
```

### GET /api/accessibility/focused

获取当前焦点元素。

**响应：**
```json
{
  "element": {
    "role": "Button",
    "name": "Save",
    "bounds": { "x": 50, "y": 100, "width": 80, "height": 30 },
    "children": [...]
  }
}
```

## 使用示例

```javascript
// 获取元素树
const res = await fetch('http://localhost:9877/api/accessibility?maxDepth=3', {
  headers: {
    'Authorization': 'Bearer your-password'
  }
});
const data = await res.json();
console.log(data.tree);

// 获取焦点元素
const res2 = await fetch('http://localhost:9877/api/accessibility/focused', {
  headers: {
    'Authorization': 'Bearer your-password'
  }
});
const element = await res2.json();
console.log(element.element);
```

## 使用 TypeScript 封装层

```typescript
import { getAccessibilityTree, getFocusedElement, findElementsByRole } from './accessibility';

// 获取深度为 3 的元素树
const tree = await getAccessibilityTree(3);

// 获取当前焦点元素
const focused = await getFocusedElement();

// 查找所有 Button 类型的元素
const buttons = findElementsByRole(tree, 'Button');

// 查找名为 "Submit" 的 Button
const submitButtons = findElementsByRole(tree, 'Button', 'Submit');
```

## macOS 权限

macOS 需要用户在「系统设置 → 隐私与安全 → 辅助功能」中授权 AgentDesk 才能正常工作。

授权后需要重启应用。

## 注意事项

1. **性能** - 元素树可能很大，建议使用 `maxDepth` 参数控制深度
2. **稳定性** - 某些应用的 Accessibility 树可能返回大量无意义节点
3. **安全性** - Accessibility API 只能读取元素信息，不能执行操作
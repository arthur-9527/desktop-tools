# Agent Desk 重构方案：Electron WS API Server（无 UI）

## 背景

当前 `billd-desk` 项目问题：过度耦合、构建报错、依赖外部后端。用户目标是做一个纯后台运行的 **远程控制 agent** — 安装在局域网设备上，通过 WebSocket API 对外暴露控制能力，让 Claude Code 或其他 agent 可以连接并控制该设备。

## 目标

**Electron 后台进程**（无 UI），通过 WebSocket 提供远程控制 API，支持：
- 实时屏幕流（JPEG 帧流）
- 鼠标控制（移动、点击、拖拽、滚动、双击、左右键）
- 键盘控制（打字、按键组合）
- 固定密码认证（来自配置文件）
- 系统托盘（启动/停止/退出）
- 仅局域网，跨平台 Mac/Win/Linux

---

## 技术选型

| 层面 | 方案 | 理由 |
|------|------|------|
| 桌面框架 | Electron 33 | **复用**，bundlet Node.js+Chromium，desktopCapturer 内置，nut-js 原生模块兼容最好，跨平台一致 |
| 屏幕捕获 | `desktopCapturer`（Electron built-in） | 主进程可用，不需要 renderer，稳定跨平台 |
| 桌面自动化 | `@nut-tree-fork/nut-js` | **直接复用**旧项目，跨平台鼠标/键盘 |
| WS 服务 | `ws` 库 | 轻量无依赖 |
| 配置文件 | `config.json`（`wsPort` + `password`） | 简单直接 |
| 构建 | TypeScript `tsc` → dist/ | 比 Vite 更轻量，无 renderer 不需要 vite-plugin-electron |
| 打包 | `electron-builder` | **复用**现有方案 |
| ESLint/Prettier | **复用**旧项目配置 | 直接复制 .eslintrc/prettier config |

**不需要**：React、Vite、React Router、Ant Design、Zustand、vite-plugin-electron — 无 UI，无 renderer 进程。

---

## 项目结构

```
所在目录：D:\agent-desk
agent-desk/
├── src/
│   ├── index.ts             # 入口：系统托盘 + WS 服务启动
│   ├── config.ts            # 读取/写入 config.json
│   ├── wss-server.ts        # WebSocket 服务器（认证 + 指令分发 + 屏幕流）
│   ├── screen.ts            # 屏幕捕获（desktopCapturer → JPEG base64 推流）
│   ├── mouse.ts             # 鼠标控制（复用 nut-js mouse API）
│   ├── keyboard.ts          # 键盘控制（复用 nut-js keyboard API）
│   ├── constants.ts         # 复用 NUT_KEY_MAP + WS 命令常量
│   └── types.ts             # WS 消息类型定义
├── config.json              # 默认配置文件
├── resources/
│   └── icon.png             # 系统托盘图标
├── package.json
├── tsconfig.json
├── eslint.config.js         # 复用旧项目 ESLint 配置
├── prettier.config.js       # 复用旧项目 Prettier 配置
├── electron-builder.yml     # 复用旧项目 electron-builder 配置
└── README.md
```

### 关键设计

**完全无 GUI**：没有 `BrowserWindow`，没有 renderer 进程。Electron 只利用其 Node.js 运行时 + `desktopCapturer` API + 原生模块兼容性。

**系统托盘**（`Tray`）：唯一用户可见的交互元素，提供「显示配置」「重启服务」「退出」等菜单项。

---

## WebSocket API 协议

### 连接流程

```
Agent/Claude Code                    BilldDesk Agent
     │                                      │
     │  ─────  ws://device-ip:port ──────►  │
     │                                      │
     │  ──  { type: "auth",                 │
     │         password: "mypassword" } ──►  │
     │                                      │
     │  ◀── { type: "auth_result",          │
     │         success: true }              │
     │                                      │
     │  ◀── { type: "ready",               │
     │         screenSize: {w, h},          │
     │         platform: "win32" }          │
```

### 指令列表

#### 屏幕捕获

| 指令 | 请求格式 | 响应格式 |
|------|---------|---------|
| 单帧截图 | `{ type: "capture_frame", quality?: 80 }` | `{ type: "frame", data: "<base64>", width, height, timestamp }` |
| 开始推流 | `{ type: "start_stream", fps?: 10, quality?: 80 }` | `{ type: "stream_started", fps, quality }` + 持续推送 `{ type: "frame", ... }` |
| 停止推流 | `{ type: "stop_stream" }` | `{ type: "stream_stopped" }` |
| 获取屏幕信息 | `{ type: "get_screen_info" }` | `{ type: "screen_info", width, height, scaleFactor }` |

#### 鼠标控制

| 指令 | 请求格式 |
|------|---------|
| 移动到 | `{ type: "mouse_move", x: number, y: number }` |
| 左键点击 | `{ type: "mouse_left_click", x?: number, y?: number }` |
| 右键点击 | `{ type: "mouse_right_click", x?: number, y?: number }` |
| 双击 | `{ type: "mouse_double_click", x?: number, y?: number }` |
| 左键按下 | `{ type: "mouse_press_left" }` |
| 左键释放 | `{ type: "mouse_release_left" }` |
| 拖拽 | `{ type: "mouse_drag", x: number, y: number }` |
| 滚动 | `{ type: "mouse_scroll", direction: "down\|up\|left\|right", amount: number }` |
| 获取位置 | `{ type: "get_mouse_position" }` → 响应 `{ x, y }` |

#### 键盘控制

| 指令 | 请求格式 |
|------|---------|
| 打字 | `{ type: "keyboard_type", text: string }` |
| 按键组合 | `{ type: "keyboard_press", keys: string[] }` e.g. `["Control", "c"]` |
| 按键释放 | `{ type: "keyboard_release", keys: string[] }` |

### 统一响应格式

```typescript
// 成功
{ type: "response", requestType: "mouse_move", code: 0 }

// 失败
{ type: "response", requestType: "keyboard_type", code: 1, msg: "错误描述" }
```

---

## 复用旧项目的关键代码

旧项目 `d:\billd-desk` 中可以直接复用的代码：

### 1. nut-js 类型定义（直接复制）
**来源**：`electron-main/types.d.ts` → `src/types.ts`
```typescript
import nutjs from '@nut-tree-fork/nut-js';
export type nutjsTs = typeof nutjs;
```

### 2. NUT_KEY_MAP（直接复制）
**来源**：`src/constant.ts` 中的 `NUT_KEY_MAP` → `src/constants.ts`
将键名字符串映射到 `@nut-tree-fork/nut-js` 的 Key 枚举，用于 keyboard.pressKey() 等调用。

### 3. nut-js 调用模式（复用函数体）
**来源**：`electron-main/index.ts` 中所有 IPC handler 的函数体
每个 handler 的 nut-js 调用代码可以直接提取为独立函数放 mouse.ts/keyboard.ts：
```typescript
// electron-main/index.ts:633-659 → src/mouse.ts
export async function mouseMove(x: number, y: number) {
  await nutjs.mouse.move([{ x, y }]);
}

// electron-main/index.ts:879-907 → src/mouse.ts
export async function mouseLeftClick() {
  await nutjs.mouse.click(nutjs.Button.LEFT);
}

// electron-main/index.ts:690-718 → src/keyboard.ts
export async function keyboardType(text: string) {
  await nutjs.keyboard.type(text);
}
// 以及所有其他 nut-js 调用...
```

### 4. 坐标转换公式（复用逻辑）
**来源**：`src/hooks/use-ipcRendererSend.ts` 第 204-211 行 → `src/mouse.ts`
```
// 控制端传来的 0-1000 归一化坐标 → 实际屏幕像素
x = displayWidth × scaleFactor × (normalizedX / 1000)
y = displayHeight × scaleFactor × (normalizedY / 1000)
// macOS 不加 scaleFactor
```

### 5. 构建配置模板
- `electron-builder.yml`：复用 asarUnpack、win/mac/linux 目标
- `eslint.config.js` + `prettier.config.js`：复用代码风格
- `.npmrc`：复用 registry 配置（去掉 @billd 私有 registry）

**不需要 IPC**（没有 renderer 进程了）：nut-js 函数从 Electron 主进程直接调用，不再经过 IPC 通道。IPC_EVENT 常量、preload.ts、IIpcRendererData 全部不需要。

**其他全部丢弃**：React、Vue、Vite、所有 API 文件、Pinia、Socket.IO、Naive UI、Ant Design、路由、状态管理、UI 组件。

---

## 配置（config.json）

```json
{
  "wsPort": 9876,
  "password": "admin123"
}
```

读取方式：`src/config.ts` 在 app 启动时读取用户数据目录下的 `config.json`，不存在则创建默认文件。

---

## 关键实现细节

### 1. 屏幕流（screen.ts）

```typescript
import { desktopCapturer, nativeImage } from 'electron';

// 单帧捕获
async function captureFrame(quality = 80, maxWidth = 1920, maxHeight = 1080) {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: maxWidth, height: maxHeight },
  });
  const source = sources[0]; // 主屏幕
  const jpeg = source.thumbnail.toJPEG(quality);
  const base64 = jpeg.toString('base64');
  return { data: base64, width: source.thumbnail.getSize().width, height: source.thumbnail.getSize().height };
}

// 持续推流
function startStream(ws, fps = 10, quality = 80) {
  const interval = setInterval(async () => {
    const frame = await captureFrame(quality);
    ws.send(JSON.stringify({ type: "frame", ...frame, timestamp: Date.now() }));
  }, 1000 / fps);
  return () => clearInterval(interval);
}
```

### 2. WS 认证（wss-server.ts）

```typescript
import { WebSocketServer } from 'ws';
import config from './config';

const wss = new WebSocketServer({ port: config.wsPort });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  let authenticated = false;

  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());

    if (!authenticated && msg.type !== 'auth') {
      ws.send(JSON.stringify({ type: 'auth_required' }));
      return;
    }

    switch (msg.type) {
      case 'auth':
        authenticated = msg.password === config.password;
        ws.send(JSON.stringify({ type: 'auth_result', success: authenticated }));
        if (authenticated) {
          ws.send(JSON.stringify({ type: 'ready', screenSize: await getScreenSize(), platform: process.platform }));
        }
        break;
      case 'capture_frame':
        const frame = await captureFrame(msg.quality);
        ws.send(JSON.stringify({ type: 'frame', ...frame }));
        break;
      case 'mouse_move':
        await mouse.move(msg.x, msg.y);
        ws.send(JSON.stringify({ type: 'response', requestType: 'mouse_move', code: 0 }));
        break;
      // ... 其他指令类似
    }
  });
});
```

### 3. 系统托盘（index.ts）

```typescript
import { app, Tray, Menu, nativeImage } from 'electron';

let tray: Tray | null = null;

app.on('ready', () => {
  const icon = nativeImage.createFromPath('resources/icon.png');
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示配置', click: () => {/* 读取并显示 config.json */} },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setToolTip('Agent Desk');
  tray.setContextMenu(contextMenu);

  startWSServer(); // 启动 WS 服务
});
```

### 4. Electron 无窗口（index.ts）

```typescript
// 不需要 BrowserWindow，不需要 renderer
app.on('ready', () => {
  // 只启动 WS 服务 + 系统托盘
});

// 防止 Mac 下的 dock 图标（无窗口应用）
app.dock?.hide(); // macOS only
```

---

## 构建配置

### package.json

```json
{
  "name": "agent-desk",
  "version": "1.0.0",
  "description": "LAN remote desktop agent - WebSocket API server",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsc && electron .",
    "build": "tsc",
    "build:win": "tsc && electron-builder --win",
    "build:mac": "tsc && electron-builder --mac",
    "build:linux": "tsc && electron-builder --linux",
    "lint": "eslint . --config ./eslint.config.js --cache"
  },
  "dependencies": {
    "@nut-tree-fork/nut-js": "^4.2.2",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "electron": "^33.2.1",
    "electron-builder": "^26.8.1",
    "eslint": "^9.10.0",
    "prettier": "^3.4.2",
    "typescript": "^5.6.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noImplicitAny": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### electron-builder.yml

```yaml
appId: com.agentdesk.app
productName: AgentDesk
asarUnpack:
  - "@nut-tree-fork/**"
directories:
  output: release
win:
  signAndEditExecutable: false
  target:
    - target: nsis
      arch:
        - x64
mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
linux:
  target:
    - target: AppImage
      arch:
        - x64
files:
  - dist/**/*
  - config.json
  - resources/**/*
```

---

## 实施步骤

### Phase 1：项目骨架
1. 在 `D:\agent-desk` 创建 `package.json`、`tsconfig.json`（参考上面配置）
2. 创建 `config.json`（默认配置：`{ "wsPort": 9876, "password": "admin123" }`）
3. 从旧项目复制 `electron-builder.yml` 并简化（参考上面配置）
4. 从旧项目复制 `eslint.config.js` + `prettier.config.js`
5. 创建 `resources/` 目录并准备托盘图标
6. `npm install` 安装依赖

### Phase 2：核心模块编码
7. **复用旧项目**：`electron-main/types.d.ts` → `src/types.ts`（nutjsTs 类型）
8. **复用旧项目**：`src/constant.ts` 中 `NUT_KEY_MAP` → `src/constants.ts`
9. 实现 `src/config.ts`：读取 config.json，不存在则创建默认
10. 实现 `src/screen.ts`：desktopCapturer 单帧捕获 + 定时推流
11. **复用旧项目 nut-js 调用**：`electron-main/index.ts` 函数体 → `src/mouse.ts`（所有鼠标操作）
12. **复用旧项目 nut-js 调用**：`electron-main/index.ts` 函数体 → `src/keyboard.ts`（所有键盘操作）
13. 实现 `src/wss-server.ts`：WS 认证 + 指令路由 + 推流管理

### Phase 3：入口 + 系统托盘
14. 实现 `src/index.ts`：app.on('ready') → 系统托盘 + 启动 WS 服务

### Phase 4：测试
15. `npm run build`（tsc 编译无报错）
16. `npm run dev` 启动 → 检查系统托盘图标
17. 用 WebSocket 客户端测试

---

## 验证方案

1. `npm run build` 编译无 TypeScript 报错
2. `npm run dev` 启动后系统托盘图标可见
3. WS API 基本功能验证：认证 → 屏幕捕获 → 鼠标移动 → 键盘输入
4. 流式传输验证：`start_stream` 后每秒收到 5-10 帧 base64 JPEG
5. 双机 LAN 测试：从另一台设备 WS 连接到本机 IP:9876
6. 鼠标/键盘在多平台 Windows / macOS / Linux 上实际生效
7. `npx electron-builder --win` 构建安装包无报错

---

## 注意事项

- **macOS 权限**：nut-js 需要「辅助功能」权限（系统偏好设置 → 隐私与安全性 → 辅助功能）
- **Windows 防火墙**：如果其他设备连不上，检查防火墙是否阻止了配置的端口
- **Electron 无窗口**：通过 `app.dock?.hide()` 隐藏 macOS dock 图标，通过 `app.setLoginItemSettings()` 支持开机自启
- **config.json 位置**：使用 `app.getPath('userData')` 得到跨平台配置目录

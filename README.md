# AgentDesk

基于 Electron 的局域网远程桌面控制代理程序，通过双通信架构（HTTP + WebSocket）提供远程屏幕捕获、鼠标控制和键盘输入功能。

## 核心功能

- **屏幕捕获**：实时捕获桌面画面，支持单帧截图和持续视频流
- **鼠标控制**：远程移动、点击、拖拽、滚轮操作
- **键盘控制**：远程输入文本、按键组合
- **无障碍元素树**：通过 Windows UIAutomation / macOS AXUIElement API 获取界面元素结构
- **安全认证**：基于密码的 WebSocket 连接认证 + Bearer Token HTTP 认证
- **系统托盘**：无窗口后台运行，通过托盘图标管理

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 编译原生插件

```bash
# Windows
npm run build:accessibility

# macOS
npm run build:accessibility:mac
```

### 开发运行

```bash
pnpm run dev
```

### 构建

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## API 端点

### HTTP API (端口: 9877)

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/screenshot` | GET/POST | 屏幕截图 |
| `/api/screen/info` | GET | 屏幕信息 |
| `/api/mouse` | POST | 鼠标控制 |
| `/api/mouse/position` | GET | 获取鼠标位置 |
| `/api/keyboard` | POST | 键盘控制 |
| `/api/accessibility` | GET | 获取无障碍元素树 |
| `/api/accessibility/focused` | GET | 获取焦点元素 |

### WebSocket (端口: 9876)

支持实时视频流传输和远程控制操作。

## 配置

配置文件位置：`%APPDATA%/agent-desk/config.json`

```json
{
  "wsPort": 9876,
  "httpPort": 9877,
  "password": "admin123"
}
```

## 使用示例

### HTTP 请求

```bash
# 截图
curl -H "Authorization: Bearer admin123" \
  -X POST http://localhost:9877/api/screenshot \
  -d '{"quality": 20, "maxWidth": 1024, "maxHeight": 768}'

# 鼠标点击
curl -H "Authorization: Bearer admin123" \
  -X POST http://localhost:9877/api/mouse \
  -d '{"action": "left_click", "x": 500, "y": 500}'

# 键盘输入
curl -H "Authorization: Bearer admin123" \
  -X POST http://localhost:9877/api/keyboard \
  -d '{"action": "type", "text": "hello"}'
```

### WebSocket 连接

```javascript
const ws = new WebSocket('ws://localhost:9876');
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'auth', password: 'admin123' }));
});
```

## 平台支持

| 平台 | 支持状态 |
|------|---------|
| Windows | ✅ 完全支持 |
| macOS | ✅ 完全支持（需辅助功能权限） |
| Linux | ⚠️ 理论支持 |

## 技术栈

- **Electron** - 桌面应用框架
- **@nut-tree-fork/nut-js** - 跨平台 UI 自动化
- **Express** - HTTP 服务器
- **ws** - WebSocket 服务器
- **node-addon-api** - C++ 原生插件

## 许可证

[MIT](LICENSE)
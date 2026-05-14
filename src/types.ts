import nutjs from '@nut-tree-fork/nut-js';

export type nutjsTs = typeof nutjs;

// WebSocket 消息类型定义
export interface WSMessage {
  type: string;
  [key: string]: any;
}

export interface AuthMessage extends WSMessage {
  type: 'auth';
  password: string;
}

export interface AuthResultMessage extends WSMessage {
  type: 'auth_result';
  success: boolean;
}

export interface ReadyMessage extends WSMessage {
  type: 'ready';
  screenSize: { width: number; height: number };
  platform: string;
}

export interface CaptureFrameMessage extends WSMessage {
  type: 'capture_frame';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface StartStreamMessage extends WSMessage {
  type: 'start_stream';
  fps?: number;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface StopStreamMessage extends WSMessage {
  type: 'stop_stream';
}

export interface FrameMessage extends WSMessage {
  type: 'frame';
  data: string; // base64
  width: number;
  height: number;
  timestamp: number;
}

export interface StreamStartedMessage extends WSMessage {
  type: 'stream_started';
  fps: number;
  quality: number;
}

export interface StreamStoppedMessage extends WSMessage {
  type: 'stream_stopped';
}

export interface GetScreenInfoMessage extends WSMessage {
  type: 'get_screen_info';
}

export interface ScreenInfoMessage extends WSMessage {
  type: 'screen_info';
  width: number;
  height: number;
  scaleFactor: number;
}

export interface MouseMoveMessage extends WSMessage {
  type: 'mouse_move';
  x: number;
  y: number;
}

export interface MouseClickMessage extends WSMessage {
  type: 'mouse_left_click' | 'mouse_right_click' | 'mouse_double_click';
  x?: number;
  y?: number;
}

export interface MousePressMessage extends WSMessage {
  type: 'mouse_press_left' | 'mouse_release_left';
}

export interface MouseDragMessage extends WSMessage {
  type: 'mouse_drag';
  x: number;
  y: number;
}

export interface MouseScrollMessage extends WSMessage {
  type: 'mouse_scroll';
  direction: 'down' | 'up' | 'left' | 'right';
  amount: number;
}

export interface GetMousePositionMessage extends WSMessage {
  type: 'get_mouse_position';
}

export interface MousePositionResponse extends WSMessage {
  type: 'mouse_position';
  x: number;
  y: number;
}

export interface KeyboardTypeMessage extends WSMessage {
  type: 'keyboard_type';
  text: string;
}

export interface KeyboardPressMessage extends WSMessage {
  type: 'keyboard_press';
  keys: string[];
}

export interface KeyboardReleaseMessage extends WSMessage {
  type: 'keyboard_release';
  keys: string[];
}

export interface ResponseMessage extends WSMessage {
  type: 'response';
  requestType: string;
  code: number;
  msg?: string;
}

// Accessibility 类型定义
export interface AccessibilityNode {
  role: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  children?: AccessibilityNode[];
}

export interface GetAccessibilityTreeMessage extends WSMessage {
  type: 'get_accessibility_tree';
  maxDepth?: number;
}

export interface AccessibilityTreeMessage extends WSMessage {
  type: 'accessibility_tree';
  tree: AccessibilityNode;
}

// HTTP API 请求/响应类型
export interface ScreenshotRequest {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  showGrid?: boolean;      // 是否叠加网格
  gridLevel?: 32 | 64 | 128;  // 网格层级（32/64/128），不指定则自动检测
  gridColor?: string;      // 网格颜色（RGB 格式）
  gridLineWidth?: number;  // 网格线宽
  gridAlpha?: number;      // 网格透明度（0-1）
  subGridAlpha?: number;   // 小格虚线透明度（0-1）
}

export interface ScreenshotResponse {
  data: string; // base64
  width: number;
  height: number;
  timestamp: number;
}

export interface ScreenInfoResponse {
  width: number;
  height: number;
  scaleFactor: number;
}

export interface MouseRequest {
   action: 'move' | 'left_click' | 'right_click' | 'double_click' | 'scroll' | 'drag' | 'press_left' | 'release_left';
   x?: number;
   y?: number;
   direction?: 'down' | 'up' | 'left' | 'right';
   amount?: number;
}

export interface KeyboardRequest {
  action: 'type' | 'press' | 'release';
  text?: string;
  keys?: string[];
}

export interface HealthResponse {
  status: 'ok';
  wsPort: number;
  httpPort: number;
}

// Accessibility API 响应类型
export interface AccessibilityTreeResponse {
  tree: AccessibilityNode;
}

export interface FocusedElementResponse {
  element: AccessibilityNode;
}

// Config 类型
export interface Config {
  wsPort: number;
  httpPort: number;
  password: string;
}
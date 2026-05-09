import { app, Tray, Menu, nativeImage, type NativeImage } from 'electron';
import path from 'path';
import { startWSServer } from './wss-server';
import { startHTTPServer } from './http-server';
import { getConfig, reloadConfig } from './config';
import type { nutjsTs } from './types';
import type express from 'express';

// 获取 nut-js 实例
const nutjs: nutjsTs = require('@nut-tree-fork/nut-js');

// HTTP server close type
type HTTPServerType = { app: express.Application; close: () => Promise<void> };

let tray: Tray | null = null;
let wss: ReturnType<typeof startWSServer> | null = null;
let httpServer: HTTPServerType | null = null;

function createTray(): void {
  // 尝试加载图标
  let icon: NativeImage;
  try {
    const iconPath = path.join(__dirname, '../resources/icon.png');
    icon = nativeImage.createFromPath(iconPath);
  } catch (error) {
    // 如果图标加载失败，创建一个空图标
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示配置',
      click: () => {
        const config = getConfig();
        console.log('当前配置:', config);
      },
    },
    {
      label: '重启服务',
      click: () => {
        if (wss) {
          wss.close();
        }
        httpServer = null;
        reloadConfig();
        wss = startWSServer(nutjs);
        httpServer = startHTTPServer();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Agent Desk');
  tray.setContextMenu(contextMenu);
}

function main(): void {
  // 隐藏 macOS dock 图标（无窗口应用）
  if (app.dock) {
    app.dock.hide();
  }

  // 创建系统托盘
  createTray();

   // 启动 HTTP 服务
   try {
     httpServer = startHTTPServer();
   } catch (error) {
     console.error('Failed to start HTTP server:', error);
   }

   // 启动 WebSocket 服务
   try {
     wss = startWSServer(nutjs);
     console.log('Agent Desk started successfully (HTTP + WebSocket)');
   } catch (error) {
     console.error('Failed to start WebSocket server:', error);
   }
}

// 应用生命周期
app.on('ready', main);

// 窗口全部关闭时不退出（无窗口应用）
app.on('window-all-closed', () => {
  // macOS 上无窗口应用通常保持运行，其他平台则退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 使用 will-quit 替代 before-quit，确保异步清理完成
app.on('will-quit', (event) => {
   // 如果还有需要清理的资源，阻止默认退出并手动处理
   let closing = false;

   const shutdown = async () => {
     if (closing) return;
     closing = true;

     console.log('Gracefully shutting down servers...');

     // 关闭 WebSocket 服务器
     if (wss) {
       wss.closeAllClients();
       await new Promise<void>((resolve) => {
         wss?.close(() => {
           console.log('WebSocket server closed');
           wss = null;
           resolve();
         });
       });
     }

     // 关闭 HTTP 服务器
     if (httpServer) {
       await httpServer.close();
       console.log('HTTP server closed');
       httpServer = null;
     }

     // 清理托盘
     if (tray) {
       tray.destroy();
       tray = null;
     }

     console.log('All servers stopped');
     app.quit();
   };

   if (wss || httpServer) {
     event.preventDefault();
     shutdown();
   } else {
     if (tray) {
       tray.destroy();
       tray = null;
     }
   }
});

// 防止多实例
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Another instance is already running');
  app.quit();
  process.exit(0);
}

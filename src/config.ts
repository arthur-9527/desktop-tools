import { app, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { DEFAULT_CONFIG } from './constants';
import { Config } from './types';

// 获取配置文件路径（使用应用根目录）
function getConfigPath(): string {
  const appPath = path.dirname(app.getPath('exe'));
  return path.join(appPath, 'config.json');
}

// 获取当前配置目录路径
export function getConfigDirPath(): string {
  const appPath = path.dirname(app.getPath('exe'));
  return appPath;
}

// 读取配置，如果不存在则创建默认配置
export function loadConfig(): Config {
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      // 创建默认配置文件
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
      console.log(`创建默认配置文件: ${configPath}`);
      return DEFAULT_CONFIG;
    }

    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData) as Config;

    // 验证必要字段
    if (!config.wsPort || !config.httpPort || !config.password) {
      console.warn('配置文件缺少必要字段，使用默认值');
      return {
        wsPort: config.wsPort || DEFAULT_CONFIG.wsPort,
        httpPort: config.httpPort || DEFAULT_CONFIG.httpPort,
        password: config.password || DEFAULT_CONFIG.password,
      };
    }

    return config;
  } catch (error) {
    console.error('读取配置文件失败:', error);
    return DEFAULT_CONFIG;
  }
}

// 获取当前配置（已缓存）
let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

// 重新加载配置
export function reloadConfig(): Config {
  cachedConfig = loadConfig();
  return cachedConfig;
}
/**
 * GET/POST /api/settings
 * Manage app settings (data source credentials, sync config)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = process.env.CONFIG_FILE || path.join(process.cwd(), 'app/data/config.json');

interface Settings {
  SYNC_INTERVAL?: string;
  SYNC_PROVIDERS?: string;
  MAX_HR?: string;
  RESTING_HR?: string;
  GARMIN_SECRET_STRING?: string;
  COROS_ACCOUNT?: string;
  COROS_PASSWORD?: string;
  FIRST_SYNC_DONE?: string;
}

function ensureConfigDir() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadConfig(): Settings {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return {};
}

function saveConfig(config: Settings): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function maskSecret(value: string | undefined, showLength: number = 4): string {
  if (!value) return '';
  if (value.length <= showLength) return '****';
  return value.substring(0, showLength) + '****';
}

export async function GET() {
  try {
    const config = loadConfig();
    
    // 从环境变量获取默认值
    const response = {
      SYNC_INTERVAL: config.SYNC_INTERVAL || process.env.SYNC_INTERVAL || '86400',
      SYNC_PROVIDERS: config.SYNC_PROVIDERS || process.env.SYNC_PROVIDERS || '',
      MAX_HR: config.MAX_HR || process.env.MAX_HR || '190',
      RESTING_HR: config.RESTING_HR || process.env.RESTING_HR || '55',
      // 敏感信息只返回是否已设置
      hasGarminToken: !!(config.GARMIN_SECRET_STRING || process.env.GARMIN_SECRET_STRING),
      garminTokenPreview: maskSecret(config.GARMIN_SECRET_STRING || process.env.GARMIN_SECRET_STRING),
      hasCorosCredentials: !!(config.COROS_ACCOUNT && config.COROS_PASSWORD) || 
        !!(process.env.COROS_ACCOUNT && process.env.COROS_PASSWORD),
      corosAccount: config.COROS_ACCOUNT || process.env.COROS_ACCOUNT || '',
      firstSyncDone: config.FIRST_SYNC_DONE === 'true',
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error loading settings:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = loadConfig();
    
    // 更新配置
    if (body.SYNC_INTERVAL !== undefined) {
      config.SYNC_INTERVAL = String(body.SYNC_INTERVAL);
    }
    if (body.SYNC_PROVIDERS !== undefined) {
      config.SYNC_PROVIDERS = String(body.SYNC_PROVIDERS);
    }
    if (body.MAX_HR !== undefined) {
      config.MAX_HR = String(body.MAX_HR);
    }
    if (body.RESTING_HR !== undefined) {
      config.RESTING_HR = String(body.RESTING_HR);
    }
    if (body.GARMIN_SECRET_STRING !== undefined && body.GARMIN_SECRET_STRING !== '') {
      config.GARMIN_SECRET_STRING = String(body.GARMIN_SECRET_STRING);
    }
    if (body.COROS_ACCOUNT !== undefined) {
      config.COROS_ACCOUNT = String(body.COROS_ACCOUNT);
    }
    if (body.COROS_PASSWORD !== undefined && body.COROS_PASSWORD !== '') {
      config.COROS_PASSWORD = String(body.COROS_PASSWORD);
    }
    
    saveConfig(config);
    
    return NextResponse.json({ success: true, message: '设置已保存' });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

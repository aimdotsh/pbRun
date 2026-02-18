/**
 * POST /api/sync/reset-first-sync
 * Reset first sync flag to trigger old data cleanup on next sync
 */

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const CONFIG_FILE = process.env.CONFIG_FILE || path.join(process.cwd(), 'app/data/config.json');

function loadConfig(): Record<string, string> {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return {};
}

function saveConfig(config: Record<string, string>): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function POST() {
  try {
    const config = loadConfig();
    config.FIRST_SYNC_DONE = 'false';
    saveConfig(config);
    
    return NextResponse.json({ 
      success: true, 
      message: '已重置首次同步标记，下次同步时会自动清理无来源数据' 
    });
  } catch (error) {
    console.error('Reset first sync error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '重置失败' 
    }, { status: 500 });
  }
}

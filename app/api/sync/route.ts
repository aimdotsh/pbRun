/**
 * POST /api/sync
 * Trigger manual data sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const CONFIG_FILE = process.env.CONFIG_FILE || path.join(process.cwd(), 'app/data/config.json');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'app/data/activities.db');

interface SyncResult {
  provider: string;
  success: boolean;
  message: string;
  activitiesSynced?: number;
}

function runSyncScript(scriptPath: string, env: Record<string, string>): Promise<SyncResult> {
  return new Promise((resolve) => {
    const proc = spawn('node', [scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ provider: '', success: true, message: '同步完成' });
      } else {
        resolve({ 
          provider: '', 
          success: false, 
          message: stderr || stdout || `退出码: ${code}` 
        });
      }
    });

    proc.on('error', (err) => {
      resolve({ provider: '', success: false, message: err.message });
    });
  });
}

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

function cleanOldData(): { success: boolean; message: string } {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    
    // 检查是否有无来源数据
    const countResult = db.prepare(`
      SELECT COUNT(*) as count FROM activities 
      WHERE source IS NULL OR source = '' OR source = 'unknown'
    `).get();
    
    if (countResult.count === 0) {
      db.close();
      return { success: true, message: '无需清理' };
    }
    
    // 删除无来源活动的 records
    const deleteRecords = db.prepare(`
      DELETE FROM activity_records WHERE activity_id IN (
        SELECT activity_id FROM activities WHERE source IS NULL OR source = '' OR source = 'unknown'
      )
    `);
    deleteRecords.run();
    
    // 删除无来源活动的 laps
    const deleteLaps = db.prepare(`
      DELETE FROM activity_laps WHERE activity_id IN (
        SELECT activity_id FROM activities WHERE source IS NULL OR source = '' OR source = 'unknown'
      )
    `);
    deleteLaps.run();
    
    // 删除无来源的活动
    const deleteActivities = db.prepare(`
      DELETE FROM activities WHERE source IS NULL OR source = '' OR source = 'unknown'
    `);
    const activitiesResult = deleteActivities.run();
    
    // 清理统计缓存
    db.exec('DELETE FROM hr_zone_stats_cache');
    db.exec('DELETE FROM vdot_trend_cache');
    
    db.close();
    
    return { success: true, message: `已清理 ${activitiesResult.changes} 条无来源活动` };
  } catch (e) {
    return { success: false, message: `清理失败: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = body.provider || 'all';
    const force = body.force === true;
    
    const results: SyncResult[] = [];
    
    // 从配置文件读取
    const config = loadConfig();

    // 检查是否是首次同步，如果是则清理旧数据
    const isFirstSync = config.FIRST_SYNC_DONE !== 'true' || force;
    if (isFirstSync) {
      console.log('First sync detected, cleaning old data...');
      const cleanResult = cleanOldData();
      if (cleanResult.success && cleanResult.message !== '无需清理') {
        results.push({ provider: '系统', success: true, message: cleanResult.message });
      }
    }

    const env = {
      MAX_HR: config.MAX_HR || process.env.MAX_HR || '190',
      RESTING_HR: config.RESTING_HR || process.env.RESTING_HR || '55',
    };

    let syncSuccess = false;

    if (provider === 'garmin' || provider === 'all') {
      const garminToken = config.GARMIN_SECRET_STRING || process.env.GARMIN_SECRET_STRING;
      if (garminToken) {
        const result = await runSyncScript(
          path.join(process.cwd(), 'scripts', 'sync-garmin.js'),
          { ...env, GARMIN_SECRET_STRING: garminToken }
        );
        result.provider = 'Garmin';
        results.push(result);
        if (result.success) syncSuccess = true;
      } else {
        results.push({ provider: 'Garmin', success: false, message: '未配置 Garmin Token' });
      }
    }

    if (provider === 'coros' || provider === 'all') {
      const corosAccount = config.COROS_ACCOUNT || process.env.COROS_ACCOUNT;
      const corosPassword = config.COROS_PASSWORD || process.env.COROS_PASSWORD;
      if (corosAccount && corosPassword) {
        const result = await runSyncScript(
          path.join(process.cwd(), 'scripts', 'sync-coros.js'),
          { ...env, COROS_ACCOUNT: corosAccount, COROS_PASSWORD: corosPassword }
        );
        result.provider = 'COROS';
        results.push(result);
        if (result.success) syncSuccess = true;
      } else {
        results.push({ provider: 'COROS', success: false, message: '未配置 COROS 账号密码' });
      }
    }

    // 运行预处理缓存
    if (results.some(r => r.success)) {
      await runSyncScript(
        path.join(process.cwd(), 'scripts', 'preprocess-stats-cache.js'),
        { ...env }
      );
    }

    // 标记首次同步完成
    if (isFirstSync && syncSuccess) {
      config.FIRST_SYNC_DONE = 'true';
      saveConfig(config);
    }

    return NextResponse.json({ 
      success: results.some(r => r.success),
      results 
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '同步失败' 
    }, { status: 500 });
  }
}

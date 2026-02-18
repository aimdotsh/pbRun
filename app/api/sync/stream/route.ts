/**
 * GET /api/sync/stream
 * Stream sync progress using Server-Sent Events
 */

import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
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

interface SyncProgress {
  type: 'start' | 'progress' | 'complete' | 'error' | 'skip';
  provider?: string;
  message: string;
  current?: number;
  total?: number;
  activityId?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const provider = searchParams.get('provider') || 'all';
  const force = searchParams.get('force') === 'true';

  const encoder = new TextEncoder();
  const config = loadConfig();

  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (progress: SyncProgress) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
        } catch (e) {
          // Stream may be closed
        }
      };

      const runSyncWithProgress = (
        scriptPath: string, 
        env: Record<string, string>, 
        providerName: string,
        forceFlag: boolean = false
      ): Promise<{ success: boolean; message: string }> => {
        return new Promise((resolve) => {
          const args = [scriptPath];
          if (forceFlag) {
            args.push('--force');
          }
          
          const proc = spawn('node', args, {
            cwd: process.cwd(),
            env: { ...process.env, ...env },
            stdio: ['inherit', 'pipe', 'pipe'],
          });

          let stdout = '';
          let stderr = '';
          let total = 0;
          let current = 0;
          let progressCounter = 0;

          // Parse stdout for progress
          proc.stdout.on('data', (data) => {
            const text = data.toString();
            stdout += text;
            
            // Parse progress from output like "[1/67]"
            const progressMatch = text.match(/\[(\d+)\/(\d+)\]/);
            if (progressMatch) {
              current = parseInt(progressMatch[1]);
              total = parseInt(progressMatch[2]);
            }

            // Parse activity ID from output - only send one event per activity
            const activityMatch = text.match(/(?:✓|✗|○)\s+\w+活动\s+(\S+)/);
            if (activityMatch) {
              progressCounter += 1;
              const isSuccess = text.includes('✓');
              const isSkip = text.includes('○');
              sendProgress({
                type: isSuccess ? 'complete' : (isSkip ? 'skip' : 'error'),
                provider: providerName,
                message: text.trim(),
                current,
                total,
                activityId: activityMatch[1],
              });
            }
          });

          proc.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          proc.on('close', (code) => {
            if (code === 0) {
              resolve({ success: true, message: '同步完成' });
            } else {
              resolve({ 
                success: false, 
                message: stderr || stdout || `退出码: ${code}` 
              });
            }
          });

          proc.on('error', (err) => {
            resolve({ success: false, message: err.message });
          });
        });
      };

      try {
        sendProgress({ type: 'start', message: '开始同步...' });

        const baseEnv = {
          MAX_HR: config.MAX_HR || process.env.MAX_HR || '190',
          RESTING_HR: config.RESTING_HR || process.env.RESTING_HR || '55',
        };

        // Garmin sync
        if (provider === 'garmin' || provider === 'all') {
          const garminToken = config.GARMIN_SECRET_STRING || process.env.GARMIN_SECRET_STRING;
          if (garminToken) {
            sendProgress({ type: 'start', provider: 'Garmin', message: '开始同步 Garmin 数据...' });
            const result = await runSyncWithProgress(
              path.join(process.cwd(), 'scripts', 'sync-garmin.js'),
              { ...baseEnv, GARMIN_SECRET_STRING: garminToken },
              'Garmin'
            );
            sendProgress({ 
              type: result.success ? 'complete' : 'error', 
              provider: 'Garmin', 
              message: result.message 
            });
          } else {
            sendProgress({ type: 'skip', provider: 'Garmin', message: '未配置 Garmin Token' });
          }
        }

        // COROS sync
        if (provider === 'coros' || provider === 'all') {
          const corosAccount = config.COROS_ACCOUNT || process.env.COROS_ACCOUNT;
          const corosPassword = config.COROS_PASSWORD || process.env.COROS_PASSWORD;
          if (corosAccount && corosPassword) {
            sendProgress({ type: 'start', provider: 'COROS', message: force ? '强制重新同步 COROS 数据...' : '开始同步 COROS 数据...' });
            const result = await runSyncWithProgress(
              path.join(process.cwd(), 'scripts', 'sync-coros.js'),
              { ...baseEnv, COROS_ACCOUNT: corosAccount, COROS_PASSWORD: corosPassword },
              'COROS',
              force
            );
            sendProgress({ 
              type: result.success ? 'complete' : 'error', 
              provider: 'COROS', 
              message: result.message 
            });
          } else {
            sendProgress({ type: 'skip', provider: 'COROS', message: '未配置 COROS 账号密码' });
          }
        }

        sendProgress({ type: 'complete', message: '全部同步完成' });
      } catch (error) {
        sendProgress({ 
          type: 'error', 
          message: error instanceof Error ? error.message : '同步失败' 
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

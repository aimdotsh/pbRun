/**
 * POST /api/garmin/token
 * Get Garmin token using email and password
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        error: '请输入 Garmin 邮箱和密码' 
      }, { status: 400 });
    }

    // 创建临时 Python 脚本来获取 token
    const scriptContent = `
import os
import sys
import json

email = "${email.replace(/"/g, '\\"')}"
password = "${password.replace(/"/g, '\\"')}"

try:
    import garth
    garth.login(email, password)
    token = garth.client.dumps()
    print(json.dumps({"success": True, "token": token}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
    sys.exit(1)
`;

    const tempScript = path.join('/tmp', `garmin_token_${Date.now()}.py`);
    fs.writeFileSync(tempScript, scriptContent);

    const result = await new Promise<{ success: boolean; token?: string; error?: string }>((resolve) => {
      const proc = spawn('python3', [tempScript], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
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
        // 清理临时文件
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {
          // ignore
        }

        if (stdout) {
          try {
            const jsonOutput = JSON.parse(stdout.trim().split('\n').pop() || '{}');
            resolve(jsonOutput);
          } catch (e) {
            resolve({ success: false, error: stdout || stderr || `退出码: ${code}` });
          }
        } else {
          resolve({ success: false, error: stderr || `未知错误，退出码: ${code}` });
        }
      });

      proc.on('error', (err) => {
        try {
          fs.unlinkSync(tempScript);
        } catch (e) {
          // ignore
        }
        resolve({ success: false, error: err.message });
      });
    });

    if (result.success && result.token) {
      // 保存 token 到配置文件
      const CONFIG_FILE = process.env.CONFIG_FILE || '/lzcapp/var/data/config.json';
      let config: Record<string, string> = {};
      try {
        if (fs.existsSync(CONFIG_FILE)) {
          config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
      } catch (e) {
        // ignore
      }
      config.GARMIN_SECRET_STRING = result.token;
      
      const configDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

      return NextResponse.json({ 
        success: true, 
        message: 'Garmin Token 已获取并保存',
        tokenPreview: result.token.substring(0, 10) + '...'
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error || '获取 Token 失败'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Garmin token error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取 Token 失败' 
    }, { status: 500 });
  }
}

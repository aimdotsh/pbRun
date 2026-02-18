'use client';

import { useState, useEffect, useRef } from 'react';

interface Settings {
  SYNC_INTERVAL: string;
  SYNC_PROVIDERS: string;
  MAX_HR: string;
  RESTING_HR: string;
  hasGarminToken: boolean;
  garminTokenPreview: string;
  hasCorosCredentials: boolean;
  corosAccount: string;
  firstSyncDone?: boolean;
}

interface SyncProgress {
  type: 'start' | 'progress' | 'complete' | 'error' | 'skip';
  provider?: string;
  message: string;
  current?: number;
  total?: number;
  activityId?: string;
}

interface SyncLog {
  id: string;
  type: 'start' | 'progress' | 'complete' | 'error' | 'skip';
  provider?: string;
  message: string;
  timestamp: Date;
}

export default function SettingsClient() {
  const [settings, setSettings] = useState<Settings>({
    SYNC_INTERVAL: '86400',
    SYNC_PROVIDERS: '',
    MAX_HR: '190',
    RESTING_HR: '55',
    hasGarminToken: false,
    garminTokenPreview: '',
    hasCorosCredentials: false,
    corosAccount: '',
    firstSyncDone: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const logIdCounterRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [resetting, setResetting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // Garmin token 获取
  const [showGarminForm, setShowGarminForm] = useState(false);
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminToken, setGarminToken] = useState('');
  const [gettingToken, setGettingToken] = useState(false);

  // COROS 凭证
  const [corosPassword, setCorosPassword] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [syncLogs]);

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(updates: Partial<Settings>) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: '设置已保存' });
        setSettings(prev => ({ ...prev, ...updates }));
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '保存失败' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  }

  function addLog(progress: SyncProgress) {
    setSyncLogs(prev => {
      // 去重：如果最后一条日志的消息完全相同，则不添加
      if (prev.length > 0) {
        const lastLog = prev[prev.length - 1];
        if (lastLog.message === progress.message && lastLog.provider === progress.provider) {
          return prev;
        }
      }
      logIdCounterRef.current += 1;
      return [...prev, {
        id: `${Date.now()}-${logIdCounterRef.current}-${Math.random().toString(36).slice(2, 7)}`,
        ...progress,
        timestamp: new Date(),
      }];
    });
  }

  async function runSync(provider: string, force: boolean = false) {
    setSyncing(true);
    setSyncProgress(null);
    setSyncLogs([]);
    setMessage(null);

    try {
      const url = force 
        ? `/api/sync/stream?provider=${provider}&force=true`
        : `/api/sync/stream?provider=${provider}`;
      const eventSource = new EventSource(url);
      
      eventSource.onmessage = (event) => {
        try {
          const progress: SyncProgress = JSON.parse(event.data);
          setSyncProgress(progress);
          addLog(progress);

          if (progress.type === 'complete' && !progress.provider) {
            eventSource.close();
            setSyncing(false);
            setMessage({ type: 'success', text: '同步完成' });
            loadSettings();
          }
        } catch (e) {
          console.error('Failed to parse progress:', e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setSyncing(false);
        setMessage({ type: 'error', text: '同步连接中断' });
      };

    } catch (e) {
      setSyncing(false);
      setMessage({ type: 'error', text: '同步失败' });
    }
  }

  async function resetFirstSync() {
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sync/reset-first-sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setSettings(prev => ({ ...prev, firstSyncDone: false }));
      } else {
        setMessage({ type: 'error', text: data.error || '重置失败' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: '重置失败' });
    } finally {
      setResetting(false);
    }
  }

  async function cleanOldData() {
    setCleaning(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sync/clean-old-data', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        loadSettings();
      } else {
        setMessage({ type: 'error', text: data.error || '清理失败' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: '清理失败' });
    } finally {
      setCleaning(false);
    }
  }

  async function getGarminToken() {
    if (!garminEmail || !garminPassword) {
      setMessage({ type: 'error', text: '请输入 Garmin 邮箱和密码' });
      return;
    }
    setGettingToken(true);
    setMessage(null);
    try {
      const res = await fetch('/api/garmin/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: garminEmail, password: garminPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'Token 已获取并保存' });
        setSettings(prev => ({ ...prev, hasGarminToken: true, garminTokenPreview: data.tokenPreview }));
        setShowGarminForm(false);
        setGarminEmail('');
        setGarminPassword('');
      } else {
        setMessage({ type: 'error', text: data.error || '获取 Token 失败' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: '获取 Token 失败' });
    } finally {
      setGettingToken(false);
    }
  }

  async function saveGarminToken() {
    if (!garminToken) {
      setMessage({ type: 'error', text: '请输入 Garmin Token' });
      return;
    }
    await saveSettings({ GARMIN_SECRET_STRING: garminToken } as any);
    setGarminToken('');
    loadSettings();
  }

  async function saveCorosCredentials() {
    if (!settings.corosAccount || !corosPassword) {
      setMessage({ type: 'error', text: '请输入 COROS 账号和密码' });
      return;
    }
    await saveSettings({ 
      COROS_ACCOUNT: settings.corosAccount, 
      COROS_PASSWORD: corosPassword 
    } as any);
    setCorosPassword('');
    loadSettings();
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-lg text-white/70">加载中...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-bold text-white">设置</h1>

      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success' ? 'bg-emerald-900/50 text-emerald-200' : 'bg-red-900/50 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* 同步设置 */}
      <section className="rounded-lg bg-emerald-900/30 p-4">
        <h2 className="mb-4 text-lg font-semibold text-white">同步设置</h2>
        
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-white/70">同步间隔（秒）</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={settings.SYNC_INTERVAL}
                onChange={(e) => setSettings(prev => ({ ...prev, SYNC_INTERVAL: e.target.value }))}
                className="flex-1 rounded bg-emerald-950/50 px-3 py-2 text-white"
                placeholder="86400"
              />
              <button
                onClick={() => saveSettings({ SYNC_INTERVAL: settings.SYNC_INTERVAL })}
                disabled={saving}
                className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                保存
              </button>
            </div>
            <p className="mt-1 text-xs text-white/50">0 表示禁用定时同步</p>
          </div>

          <div>
            <label className="mb-1 block text-sm text-white/70">同步数据源</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.SYNC_PROVIDERS}
                onChange={(e) => setSettings(prev => ({ ...prev, SYNC_PROVIDERS: e.target.value }))}
                className="flex-1 rounded bg-emerald-950/50 px-3 py-2 text-white"
                placeholder="留空表示全部，多个用逗号分隔：garmin,coros"
              />
              <button
                onClick={() => saveSettings({ SYNC_PROVIDERS: settings.SYNC_PROVIDERS })}
                disabled={saving}
                className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-white/70">最大心率</label>
              <input
                type="number"
                value={settings.MAX_HR}
                onChange={(e) => setSettings(prev => ({ ...prev, MAX_HR: e.target.value }))}
                onBlur={() => saveSettings({ MAX_HR: settings.MAX_HR })}
                className="w-full rounded bg-emerald-950/50 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">静息心率</label>
              <input
                type="number"
                value={settings.RESTING_HR}
                onChange={(e) => setSettings(prev => ({ ...prev, RESTING_HR: e.target.value }))}
                onBlur={() => saveSettings({ RESTING_HR: settings.RESTING_HR })}
                className="w-full rounded bg-emerald-950/50 px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 手动同步 */}
      <section className="rounded-lg bg-emerald-900/30 p-4">
        <h2 className="mb-4 text-lg font-semibold text-white">手动同步</h2>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runSync('all')}
            disabled={syncing}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {syncing ? '同步中...' : '同步全部'}
          </button>
          <button
            onClick={() => runSync('garmin')}
            disabled={syncing || !settings.hasGarminToken}
            className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            同步 Garmin
          </button>
          <button
            onClick={() => runSync('coros')}
            disabled={syncing || !settings.hasCorosCredentials}
            className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-500 disabled:opacity-50"
          >
            同步 COROS
          </button>
          <button
            onClick={() => runSync('coros', true)}
            disabled={syncing || !settings.hasCorosCredentials}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50"
          >
            强制重新同步 COROS
          </button>
        </div>
        
        <p className="mt-2 text-xs text-white/50">
          "强制重新同步"会重新处理所有 COROS 活动，包括已存在的活动（用于补充缺失的分段数据、VDOT 等）
        </p>

        {/* 同步进度 */}
        {(syncing || syncLogs.length > 0) && (
          <div className="mt-4">
            {/* 进度条 */}
            {syncProgress && syncProgress.total && syncProgress.total > 0 && (
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-sm text-white/70">
                  <span>{syncProgress.provider || '同步中'}</span>
                  <span>{syncProgress.current}/{syncProgress.total}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-emerald-950">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(syncProgress.current || 0) / syncProgress.total * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 日志 */}
            {syncLogs.length > 0 && (
              <div 
                ref={logContainerRef}
                className="max-h-64 overflow-y-auto rounded bg-emerald-950/50 p-3 font-mono text-xs"
              >
                {syncLogs.map((log) => (
                  <div 
                    key={log.id}
                    className={`py-0.5 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'complete' ? 'text-emerald-400' :
                      log.type === 'skip' ? 'text-yellow-400' :
                      'text-white/70'
                    }`}
                  >
                    <span className="text-white/40">[{log.timestamp.toLocaleTimeString()}]</span>{' '}
                    {log.provider && <span className="text-white/60">[{log.provider}]</span>}{' '}
                    {log.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 数据管理 */}
      <section className="rounded-lg bg-emerald-900/30 p-4">
        <h2 className="mb-4 text-lg font-semibold text-white">数据管理</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-emerald-950/50 p-3">
            <div>
              <p className="text-white">首次同步状态</p>
              <p className="text-sm text-white/50">
                {settings.firstSyncDone ? '已完成首次同步' : '尚未完成首次同步'}
              </p>
            </div>
            <button
              onClick={resetFirstSync}
              disabled={resetting}
              className="rounded bg-yellow-600 px-4 py-2 text-sm text-white hover:bg-yellow-500 disabled:opacity-50"
            >
              {resetting ? '重置中...' : '重置'}
            </button>
          </div>
          
          <p className="text-xs text-white/50">
            重置首次同步状态后，下次同步时会自动清理无来源数据（原项目自带的测试数据）
          </p>
          
          <div className="flex items-center justify-between rounded-lg bg-emerald-950/50 p-3">
            <div>
              <p className="text-white">清理无来源数据</p>
              <p className="text-sm text-white/50">删除所有未标记来源的活动数据</p>
            </div>
            <button
              onClick={cleanOldData}
              disabled={cleaning}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
            >
              {cleaning ? '清理中...' : '立即清理'}
            </button>
          </div>
        </div>
      </section>

      {/* Garmin 设置 */}
      <section className="rounded-lg bg-emerald-900/30 p-4">
        <h2 className="mb-4 text-lg font-semibold text-white">Garmin 设置</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Garmin Token</p>
              {settings.hasGarminToken ? (
                <p className="text-sm text-emerald-300">已设置: {settings.garminTokenPreview}</p>
              ) : (
                <p className="text-sm text-white/50">未设置</p>
              )}
            </div>
            <button
              onClick={() => setShowGarminForm(!showGarminForm)}
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
            >
              {showGarminForm ? '取消' : '设置'}
            </button>
          </div>

          {showGarminForm && (
            <div className="space-y-4 rounded-lg bg-emerald-950/50 p-4">
              <div>
                <label className="mb-1 block text-sm text-white/70">方式一：自动获取（输入邮箱密码）</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={garminEmail}
                    onChange={(e) => setGarminEmail(e.target.value)}
                    className="rounded bg-emerald-900/50 px-3 py-2 text-white"
                    placeholder="Garmin 邮箱"
                  />
                  <input
                    type="password"
                    value={garminPassword}
                    onChange={(e) => setGarminPassword(e.target.value)}
                    className="rounded bg-emerald-900/50 px-3 py-2 text-white"
                    placeholder="Garmin 密码"
                  />
                </div>
                <button
                  onClick={getGarminToken}
                  disabled={gettingToken}
                  className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {gettingToken ? '获取中...' : '自动获取 Token'}
                </button>
              </div>

              <div className="border-t border-white/10 pt-4">
                <label className="mb-1 block text-sm text-white/70">方式二：手动输入 Token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={garminToken}
                    onChange={(e) => setGarminToken(e.target.value)}
                    className="flex-1 rounded bg-emerald-900/50 px-3 py-2 text-white"
                    placeholder="粘贴 GARMIN_SECRET_STRING"
                  />
                  <button
                    onClick={saveGarminToken}
                    disabled={saving}
                    className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    保存
                  </button>
                </div>
                <p className="mt-1 text-xs text-white/50">
                  运行 python scripts/get_garmin_token.py 可获取 Token
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* COROS 设置 */}
      <section className="rounded-lg bg-emerald-900/30 p-4">
        <h2 className="mb-4 text-lg font-semibold text-white">COROS 高驰设置</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-white/70">账号</label>
              <input
                type="text"
                value={settings.corosAccount}
                onChange={(e) => setSettings(prev => ({ ...prev, corosAccount: e.target.value }))}
                className="w-full rounded bg-emerald-950/50 px-3 py-2 text-white"
                placeholder="手机号或邮箱"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">密码</label>
              <input
                type="password"
                value={corosPassword}
                onChange={(e) => setCorosPassword(e.target.value)}
                className="w-full rounded bg-emerald-950/50 px-3 py-2 text-white"
                placeholder={settings.hasCorosCredentials ? '已设置' : '密码'}
              />
            </div>
          </div>
          <button
            onClick={saveCorosCredentials}
            disabled={saving}
            className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-500 disabled:opacity-50"
          >
            保存 COROS 凭证
          </button>
        </div>
      </section>
    </div>
  );
}

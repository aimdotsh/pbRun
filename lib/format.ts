/**
 * 前端展示用的格式化工具
 */

/** 配速：秒/公里 → "5:30" 或 "5:30 /km" */
export function formatPace(secondsPerKm: number | null | undefined, withUnit = true): string {
  if (secondsPerKm == null || Number.isNaN(secondsPerKm)) return '--';
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  const s = `${min}:${sec.toString().padStart(2, '0')}`;
  return withUnit ? `${s} /km` : s;
}

/** 距离：公里 → "10.05 km"（保留 2 位小数，入参已是 km） */
export function formatDistance(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return '--';
  return `${Number(km).toFixed(2)} km`;
}

/** 距离：米 → "10.05 km"（用于分段等接口仍返回米的场景） */
export function formatDistanceFromMeters(meters: number | null | undefined): string {
  if (meters == null || Number.isNaN(meters)) return '--';
  return `${(meters / 1000).toFixed(2)} km`;
}

/** 时长：秒 → "1:02:30" 或 "42:30" */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/** 日期时间：ISO 字符串 → 本地日期时间显示 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 仅日期 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 心率等整数 */
export function formatInt(value: number | null | undefined, unit = ''): string {
  if (value == null || Number.isNaN(value)) return '--';
  return unit ? `${Math.round(value)} ${unit}` : String(Math.round(value));
}

/** 步频：步/分钟 */
export function formatCadence(spm: number | null | undefined): string {
  return formatInt(spm, '步/分');
}

/** 温度 */
export function formatTemp(c: number | null | undefined): string {
  if (c == null || Number.isNaN(c)) return '--';
  return `${c.toFixed(1)} °C`;
}

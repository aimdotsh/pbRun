'use client';

import type { HrZoneStat } from '@/lib/types';
import { formatPace, formatDuration } from '@/lib/format';

interface HrZoneMetricsTableProps {
  data: HrZoneStat[];
}

const HR_ZONE_NAMES: Record<number, string> = {
  1: 'Zone 1 (轻松)',
  2: 'Zone 2 (有氧)',
  3: 'Zone 3 (节奏)',
  4: 'Zone 4 (乳酸阈)',
  5: 'Zone 5 (最大摄氧)',
};

const HR_ZONE_COLORS: Record<number, string> = {
  1: 'bg-green-100 dark:bg-green-900',
  2: 'bg-blue-100 dark:bg-blue-900',
  3: 'bg-yellow-100 dark:bg-yellow-900',
  4: 'bg-orange-100 dark:bg-orange-900',
  5: 'bg-red-100 dark:bg-red-900',
};

export default function HrZoneMetricsTable({ data }: HrZoneMetricsTableProps) {
  // Aggregate by HR zone
  const zoneStats: Record<number, {
    activity_count: number;
    total_duration: number;
    total_distance: number;
    avg_pace: number[];
    avg_cadence: number[];
    avg_stride: number[];
  }> = {};

  for (const item of data) {
    if (!zoneStats[item.hr_zone]) {
      zoneStats[item.hr_zone] = {
        activity_count: 0,
        total_duration: 0,
        total_distance: 0,
        avg_pace: [],
        avg_cadence: [],
        avg_stride: [],
      };
    }
    const zone = zoneStats[item.hr_zone];
    zone.activity_count += item.activity_count;
    zone.total_duration += item.total_duration;
    zone.total_distance += item.total_distance;
    if (item.avg_pace !== null) zone.avg_pace.push(item.avg_pace);
    if (item.avg_cadence !== null) zone.avg_cadence.push(item.avg_cadence);
    if (item.avg_stride_length !== null) zone.avg_stride.push(item.avg_stride_length);
  }

  // Calculate averages
  const rows = Object.entries(zoneStats).map(([zone, stats]) => {
    const avgPace = stats.avg_pace.length > 0
      ? stats.avg_pace.reduce((a, b) => a + b, 0) / stats.avg_pace.length
      : null;
    const avgCadence = stats.avg_cadence.length > 0
      ? stats.avg_cadence.reduce((a, b) => a + b, 0) / stats.avg_cadence.length
      : null;
    const avgStride = stats.avg_stride.length > 0
      ? stats.avg_stride.reduce((a, b) => a + b, 0) / stats.avg_stride.length
      : null;

    return {
      zone: parseInt(zone),
      name: HR_ZONE_NAMES[parseInt(zone)],
      activity_count: stats.activity_count,
      total_duration: stats.total_duration,
      total_distance: stats.total_distance,
      avg_pace: avgPace,
      avg_cadence: avgCadence,
      avg_stride: avgStride,
    };
  }).sort((a, b) => a.zone - b.zone);

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        暂无数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">心率区间</th>
            <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">活动次数</th>
            <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">总时长</th>
            <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">总距离</th>
            <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">平均配速</th>
            <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">平均步频</th>
            <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">平均步幅</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.zone}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
            >
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-1 rounded ${HR_ZONE_COLORS[row.zone]}`}>
                  {row.name}
                </span>
              </td>
              <td className="px-4 py-3">{row.activity_count}</td>
              <td className="px-4 py-3">{formatDuration(row.total_duration)}</td>
              <td className="px-4 py-3">{(row.total_distance / 1000).toFixed(1)} km</td>
              <td className="px-4 py-3">{row.avg_pace !== null ? formatPace(row.avg_pace) : '--'}</td>
              <td className="px-4 py-3">{row.avg_cadence !== null ? row.avg_cadence.toFixed(0) : '--'}</td>
              <td className="px-4 py-3">{row.avg_stride !== null ? row.avg_stride.toFixed(2) + ' m' : '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

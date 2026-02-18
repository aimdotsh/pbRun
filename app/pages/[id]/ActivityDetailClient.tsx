'use client';

import Link from 'next/link';
import {
  formatPace,
  formatDistanceFromMeters,
  formatDuration,
  formatDateTime,
  formatCadence,
  formatInt,
} from '@/app/lib/format';
import type { Activity, ActivityLap, ActivityRecord } from '@/app/lib/types';
import ActivityTrendCharts from '@/app/lib/components/charts/ActivityTrendCharts';

interface ActivityDetailClientProps {
  activity: Activity;
  laps: ActivityLap[];
  records: ActivityRecord[];
}

export default function ActivityDetailClient({ activity, laps, records }: ActivityDetailClientProps) {
  const durationSec = activity.moving_time ?? activity.duration ?? 0;
  const durationMinutes = durationSec / 60;
  const rawDistance = activity.distance ?? 0;
  const distanceKm =
    rawDistance > 0 && rawDistance < 100 ? rawDistance : rawDistance / 1000;

  const overviewItems: { value: string; unit?: string; label: string }[] = [
    {
      value: activity.vdot_value != null ? activity.vdot_value.toFixed(1) : '--',
      label: '当前跑力',
    },
    {
      value:
        distanceKm > 0
          ? (distanceKm % 1 === 0 ? String(distanceKm) : distanceKm.toFixed(2))
          : '--',
      unit: distanceKm > 0 ? '公里' : undefined,
      label: '距离',
    },
    {
      value: activity.average_pace != null ? formatPace(activity.average_pace, false) : '--',
      unit: activity.average_pace != null ? '/km' : undefined,
      label: '平均配速',
    },
    {
      value: activity.training_load != null ? activity.training_load.toFixed(1) : '--',
      label: '训练负荷',
    },
    {
      value:
        durationMinutes > 0
          ? (durationMinutes % 1 === 0 ? String(Math.round(durationMinutes)) : durationMinutes.toFixed(1))
          : '--',
      unit: durationMinutes > 0 ? '分钟' : undefined,
      label: '总时长',
    },
    {
      value: activity.average_heart_rate != null ? String(activity.average_heart_rate) : '--',
      unit: activity.average_heart_rate != null ? 'bpm' : undefined,
      label: '平均心率',
    },
    {
      value:
        activity.total_ascent != null
          ? String(activity.total_ascent)
          : '0',
      unit: '米',
      label: '累计爬升',
    },
    {
      value: activity.average_cadence != null ? String(activity.average_cadence) : '--',
      unit: activity.average_cadence != null ? '步/分' : undefined,
      label: '平均步频',
    },
    {
      value:
        activity.average_stride_length != null
          ? activity.average_stride_length.toFixed(2)
          : '--',
      unit: activity.average_stride_length != null ? '米' : undefined,
      label: '平均步幅',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {activity.name || `跑步 ${formatDateTime(activity.start_time_local ?? activity.start_time)}`}
          <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
            #{activity.activity_id}
          </span>
        </h1>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-3 gap-3">
          {overviewItems.map(({ value, unit, label }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center py-2 text-center"
            >
              <div className="flex flex-wrap items-baseline justify-center gap-0.5">
                <span className="text-lg font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                  {value}
                </span>
                {unit != null && (
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {unit}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {records.length > 0 ? <ActivityTrendCharts records={records} /> : null}

      {activity.average_gct_balance != null ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-base font-medium text-zinc-800 dark:text-zinc-200">
            跑步动态
          </h2>
          <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50 inline-block">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">触地平衡</div>
            <div className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{activity.average_gct_balance.toFixed(1)} %</div>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-base font-medium text-zinc-800 dark:text-zinc-200">
          分段数据
        </h2>
        {laps.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            暂无分段数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">分段</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">距离</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">时长</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">配速</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">心率</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">步频</th>
                  <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">爬升</th>
                </tr>
              </thead>
              <tbody>
                {laps.map((lap, idx) => (
                  <tr key={lap.id ?? `lap-${idx}`} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-3 py-2 font-medium">{lap.lap_index}</td>
                    <td className="px-3 py-2">{formatDistanceFromMeters(lap.distance)}</td>
                    <td className="px-3 py-2">{formatDuration(lap.duration)}</td>
                    <td className="px-3 py-2">{formatPace(lap.average_pace)}</td>
                    <td className="px-3 py-2">{formatInt(lap.average_heart_rate, 'bpm')}</td>
                    <td className="px-3 py-2">{formatCadence(lap.average_cadence)}</td>
                    <td className="px-3 py-2">
                      {lap.total_ascent != null ? `${lap.total_ascent} m` : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

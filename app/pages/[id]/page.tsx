'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  formatPace,
  formatDistance,
  formatDistanceFromMeters,
  formatDuration,
  formatDateTime,
  formatCadence,
  formatInt,
  formatTemp,
} from '@/lib/format';
import type { Activity, ActivityLap, ActivityRecord } from '@/lib/types';
import ActivityTrendCharts from '@/lib/components/charts/ActivityTrendCharts';

export default function ActivityDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : null;
  const [activity, setActivity] = useState<Activity | null>(null);
  const [laps, setLaps] = useState<ActivityLap[]>([]);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/activities/${id}`).then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? '活动不存在' : r.statusText);
        return r.json();
      }),
      fetch(`/api/activities/${id}/laps`).then((r) => {
        if (!r.ok) return { laps: [] };
        return r.json();
      }),
      fetch(`/api/activities/${id}/records`).then((r) => {
        if (!r.ok) return { records: [] };
        return r.json();
      }),
    ])
      .then(([act, lapsRes, recordsRes]) => {
        if (!cancelled) {
          setActivity(act);
          setLaps(lapsRes.laps ?? []);
          setRecords(recordsRes.records ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <div className="text-zinc-500">无效的活动 ID</div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500">
        加载中…
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error ?? '活动不存在'}
        </div>
        <Link
          href="/pages/list"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          返回活动列表
        </Link>
      </div>
    );
  }

  const statCards = [
    { label: '开始时间', value: formatDateTime(activity.start_time_local ?? activity.start_time) },
    { label: '距离', value: formatDistance(activity.distance) },
    { label: '时长', value: formatDuration(activity.moving_time ?? activity.duration) },
    { label: '平均配速', value: formatPace(activity.average_pace) },
    { label: '平均心率', value: formatInt(activity.average_heart_rate, 'bpm') },
    { label: '平均步频', value: formatCadence(activity.average_cadence) },
    { label: '平均步幅', value: activity.average_stride_length != null ? `${(activity.average_stride_length * 100).toFixed(0)} cm` : '--' },
    { label: '垂直步幅比', value: activity.average_vertical_ratio != null ? `${activity.average_vertical_ratio.toFixed(1)} %` : '--' },
    { label: '平均触地时间', value: activity.average_ground_contact_time != null ? `${activity.average_ground_contact_time} ms` : '--' },
    { label: '垂直摆动', value: activity.average_vertical_oscillation != null ? `${activity.average_vertical_oscillation.toFixed(1)} cm` : '--' },
    { label: '平均温度', value: formatTemp(activity.average_temperature) },
    { label: 'VDOT', value: activity.vdot_value != null ? activity.vdot_value.toFixed(1) : '--' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/pages/list" className="hover:underline">活动列表</Link>
          <span>/</span>
          <span>活动 #{activity.activity_id}</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {activity.name || `跑步 ${formatDateTime(activity.start_time_local ?? activity.start_time)}`}
        </h1>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-800 dark:text-zinc-200">
          概览
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {statCards.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {label}
              </div>
              <div className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {records.length > 0 ? (
        <ActivityTrendCharts records={records} />
      ) : null}

      {activity.average_gct_balance != null ? (
        <section>
          <h2 className="mb-3 text-lg font-medium text-zinc-800 dark:text-zinc-200">
            跑步动态
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">触地平衡</div>
              <div className="mt-0.5 font-medium">{activity.average_gct_balance.toFixed(1)} %</div>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-800 dark:text-zinc-200">
          分段数据
        </h2>
        {laps.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white py-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            暂无分段数据
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">分段</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">距离</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">时长</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">配速</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">心率</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">步频</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">爬升</th>
                </tr>
              </thead>
              <tbody>
                {laps.map((lap) => (
                  <tr
                    key={lap.id}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-4 py-3 font-medium">{lap.lap_index}</td>
                    <td className="px-4 py-3">{formatDistanceFromMeters(lap.distance)}</td>
                    <td className="px-4 py-3">{formatDuration(lap.duration)}</td>
                    <td className="px-4 py-3">{formatPace(lap.average_pace)}</td>
                    <td className="px-4 py-3">{formatInt(lap.average_heart_rate, 'bpm')}</td>
                    <td className="px-4 py-3">{formatCadence(lap.average_cadence)}</td>
                    <td className="px-4 py-3">
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

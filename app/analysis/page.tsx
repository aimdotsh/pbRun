'use client';

import { useEffect, useState, useMemo } from 'react';
import VDOTTrendChart from '@/app/lib/components/charts/VDOTTrendChart';
import HrZoneDurationBarChart from '@/app/lib/components/charts/HrZoneDurationBarChart';
import HrZoneMetricsTable from '@/app/lib/components/charts/HrZoneMetricsTable';
import PaceZoneMetricsTable from '@/app/lib/components/charts/PaceZoneMetricsTable';
import type { HrZoneStat, VDOTTrendPoint, PaceZoneStat } from '@/app/lib/types';

type TimeRangeDays = 30 | 90 | 180;
type GroupBy = 'week' | 'month';

const GROUP_BY: GroupBy = 'week';

function getDateRangeFromDays(days: TimeRangeDays): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const startDate = start.toISOString().split('T')[0];
  return { startDate, endDate };
}

export default function AnalysisPage() {
  const [timeRangeDays, setTimeRangeDays] = useState<TimeRangeDays>(30);

  const [hrZoneData, setHrZoneData] = useState<HrZoneStat[]>([]);
  const [zoneRanges, setZoneRanges] = useState<Record<number, { min: number; max: number }> | null>(null);
  const [vdotData, setVdotData] = useState<VDOTTrendPoint[]>([]);
  const [weekStats, setWeekStats] = useState<{ averageVDOT?: number } | null>(null);
  const [paceZoneData, setPaceZoneData] = useState<PaceZoneStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => getDateRangeFromDays(timeRangeDays), [timeRangeDays]);

  /** 按心率区间聚合的跑步时长（来自 hr-zones 接口，以心率为准） */
  const hrZoneDurationByZone = useMemo(() => {
    const byZone: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    hrZoneData.forEach((item) => {
      byZone[item.hr_zone] = (byZone[item.hr_zone] ?? 0) + item.total_duration;
    });
    return [1, 2, 3, 4, 5].map((zone) => ({ zone, total_duration: byZone[zone] ?? 0 }));
  }, [hrZoneData]);

  /** 基于周训练量比例（以心率为准），相对丹尼尔斯建议的明显超标/不足 */
  const hrZoneOverflow = useMemo(() => {
    if (!hrZoneDurationByZone.length) return [];
    const totalSec = hrZoneDurationByZone.reduce((s, z) => s + z.total_duration, 0);
    if (totalSec <= 0) return [];
    const byZone: Record<number, number> = {};
    hrZoneDurationByZone.forEach((z) => {
      byZone[z.zone] = (z.total_duration / totalSec) * 100;
    });
    const z12 = (byZone[1] ?? 0) + (byZone[2] ?? 0);
    const items: { label: string; actual: number; limit: string; type: 'over' | 'under' }[] = [];
    if (z12 < 70) {
      items.push({ label: 'Z1–Z2（轻松/有氧）', actual: Math.round(z12 * 10) / 10, limit: '建议 ≥70%', type: 'under' });
    }
    if ((byZone[3] ?? 0) > 15) {
      items.push({ label: 'Z3（节奏/马拉松配速）', actual: Math.round((byZone[3] ?? 0) * 10) / 10, limit: '建议 ≤15%', type: 'over' });
    }
    if ((byZone[4] ?? 0) > 10) {
      items.push({ label: 'Z4（乳酸阈）', actual: Math.round((byZone[4] ?? 0) * 10) / 10, limit: '建议 ≤10%', type: 'over' });
    }
    if ((byZone[5] ?? 0) > 8) {
      items.push({ label: 'Z5（间歇/强度）', actual: Math.round((byZone[5] ?? 0) * 10) / 10, limit: '建议 ≤8%', type: 'over' });
    }
    return items;
  }, [hrZoneDurationByZone]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/analysis/hr-zones?startDate=${startDate}&endDate=${endDate}&groupBy=${GROUP_BY}`)
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        }),
      fetch(`/api/analysis/vdot-trend?startDate=${startDate}&endDate=${endDate}&groupBy=${GROUP_BY}`)
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        }),
      fetch('/api/stats?period=week').then((res) => (res.ok ? res.json() : { averageVDOT: undefined })),
    ])
      .then(([hrZoneRes, vdotRes, stats]) => {
        if (!cancelled) {
          setHrZoneData(hrZoneRes.data || []);
          setZoneRanges(hrZoneRes.zoneRanges || null);
          setVdotData(vdotRes.data || []);
          setWeekStats(stats || null);
        }
        const vdot = stats?.averageVDOT;
        if (vdot != null && vdot > 0) {
          return fetch(`/api/analysis/pace-zones?startDate=${startDate}&endDate=${endDate}&vdot=${vdot}`)
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((paceRes) => {
              if (!cancelled) setPaceZoneData(paceRes.data || []);
            });
        }
        setPaceZoneData([]);
        return Promise.resolve();
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const currentVdot = weekStats?.averageVDOT ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* 时间范围：控制跑力变化、跑力与详细指标、心率区间与详细指标 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">分析范围</span>
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{startDate}</span>
          <span className="text-zinc-300 dark:text-zinc-600">–</span>
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{endDate}</span>
          <div className="flex gap-2">
            {([30, 90, 180] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTimeRangeDays(d)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  timeRangeDays === d
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500 dark:text-zinc-400">
          加载中…
        </div>
      ) : (
        <>
          {/* 当前跑力：固定为近一周，不受上方时间范围影响 */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  当前跑力
                  <span className="ml-1 text-zinc-400" title="基于近一周活动平均 VDOT">?</span>
                </h2>
                <div className="mt-2 text-4xl font-semibold text-emerald-600 dark:text-emerald-400">
                  {currentVdot != null ? currentVdot.toFixed(1) : '--'}
                </div>
                <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: currentVdot != null ? `${Math.min(100, (currentVdot / 60) * 100)}%` : '0%',
                    }}
                  />
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-emerald-500/50 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                跑力
              </div>
            </div>
          </section>

          {/* 跑力变化（受上方时间范围控制） */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">跑力变化</h2>
            {vdotData.length > 0 ? (
              <VDOTTrendChart data={vdotData} groupBy={GROUP_BY} />
            ) : (
              <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                暂无跑力趋势数据
              </div>
            )}
          </section>

          {/* 心率区间跑步时间（数据来自 /api/analysis/hr-zones，以心率为准） */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              心率区间跑步时间
              <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                {startDate} – {endDate}
              </span>
            </h2>
            <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
              本区块数据以心率为准，按心率区间统计跑步时间。
            </p>
            {hrZoneData.length > 0 ? (
              <HrZoneDurationBarChart data={hrZoneDurationByZone} />
            ) : (
              <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                暂无心率区间数据
              </div>
            )}
            <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <h3 className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">跑步建议（丹尼尔斯跑步法）</h3>
              <ul className="mb-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <li><span className="font-medium">Z1–Z2（轻松/有氧）</span>：约 70–80% — 有氧基础与恢复</li>
                <li><span className="font-medium">Z3（节奏/马拉松配速）</span>：约 10–15%</li>
                <li><span className="font-medium">Z4（乳酸阈）</span>：约 10% — 节奏跑、乳酸阈训练</li>
                <li><span className="font-medium">Z5（间歇/强度）</span>：约 5–8% — VO₂max 与速度</li>
              </ul>
              {hrZoneOverflow.length > 0 && (
                <div className="border-t border-zinc-200 pt-2 dark:border-zinc-600">
                  <p className="mb-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">明显超标 / 不足</p>
                  <ul className="space-y-1 text-xs">
                    {hrZoneOverflow.map((item) => (
                      <li
                        key={item.label}
                        className={item.type === 'over' ? 'text-amber-700 dark:text-amber-400' : 'text-amber-600 dark:text-amber-500'}
                      >
                        {item.label}：当前 <span className="font-medium">{item.actual}%</span>，{item.limit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* 跑力与详细指标（受上方时间范围控制） */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              跑力与详细指标
              <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                {startDate} – {endDate}
              </span>
              {currentVdot != null && currentVdot > 0 && (
                <span className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">{currentVdot.toFixed(1)}</span>
              )}
            </h2>
            {currentVdot != null && currentVdot > 0 ? (
              <PaceZoneMetricsTable data={paceZoneData} />
            ) : (
              <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                暂无当前跑力，无法计算配速区间
              </div>
            )}
          </section>

          {/* 心率区间与详细指标（受上方时间范围控制） */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              心率区间与详细指标
              <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                {startDate} – {endDate}
              </span>
            </h2>
            {hrZoneData.length > 0 ? (
              <HrZoneMetricsTable
                data={hrZoneData}
                zoneRanges={zoneRanges}
                trendLinkParams={{ startDate, endDate, groupBy: GROUP_BY }}
              />
            ) : (
              <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                暂无心率区间数据
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

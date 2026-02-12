'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import VDOTTrendChart from '@/lib/components/charts/VDOTTrendChart';
import HrZoneMetricsTable from '@/lib/components/charts/HrZoneMetricsTable';
import type { HrZoneStat, VDOTTrendPoint } from '@/lib/types';

type TimeRange = '3months' | '6months' | '1year' | 'all';
type GroupBy = 'week' | 'month';

const GROUP_BY: GroupBy = 'week';

export default function AnalysisPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('6months');

  const [hrZoneData, setHrZoneData] = useState<HrZoneStat[]>([]);
  const [zoneRanges, setZoneRanges] = useState<Record<number, { min: number; max: number }> | null>(null);
  const [vdotData, setVdotData] = useState<VDOTTrendPoint[]>([]);
  const [weekStats, setWeekStats] = useState<{ averageVDOT?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate date range
  const getDateRange = (range: TimeRange): { startDate: string; endDate: string } => {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];

    let startDate: string;
    switch (range) {
      case '3months':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        startDate = threeMonthsAgo.toISOString().split('T')[0];
        break;
      case '6months':
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        startDate = sixMonthsAgo.toISOString().split('T')[0];
        break;
      case '1year':
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        startDate = oneYearAgo.toISOString().split('T')[0];
        break;
      case 'all':
      default:
        startDate = '2020-01-01';
        break;
    }

    return { startDate, endDate };
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const { startDate, endDate } = getDateRange(timeRange);

    Promise.all([
      fetch(`/api/analysis/hr-zones?startDate=${startDate}&endDate=${endDate}&groupBy=${GROUP_BY}`)
        .then(res => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        }),
      fetch(`/api/analysis/vdot-trend?startDate=${startDate}&endDate=${endDate}&groupBy=${GROUP_BY}`)
        .then(res => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        }),
      fetch('/api/stats?period=week')
        .then(res => (res.ok ? res.json() : { averageVDOT: undefined })),
    ])
      .then(([hrZoneRes, vdotRes, stats]) => {
        if (!cancelled) {
          setHrZoneData(hrZoneRes.data || []);
          setZoneRanges(hrZoneRes.zoneRanges || null);
          setVdotData(vdotRes.data || []);
          setWeekStats(stats || null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:underline">首页</Link>
          <span>/</span>
          <span>数据分析</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          数据分析仪表盘
        </h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">时间范围:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="3months">最近3月</option>
            <option value="6months">最近半年</option>
            <option value="1year">最近一年</option>
            <option value="all">全部</option>
          </select>
        </div>

      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          加载中…
        </div>
      ) : (
        <>
          {/* 概览 */}
          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-800 dark:text-zinc-200">
              概览
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">近一周 VDOT 平均值</div>
                <div className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {weekStats?.averageVDOT != null ? weekStats.averageVDOT.toFixed(1) : '--'}
                </div>
              </div>
            </div>
          </section>

          {/* VDOT 趋势 */}
          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-800 dark:text-zinc-200">
              VDOT 趋势
            </h2>
            {vdotData.length > 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <VDOTTrendChart data={vdotData} groupBy={GROUP_BY} />
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white py-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                暂无 VDOT 数据
              </div>
            )}
          </section>

          {/* 详细指标 */}
          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-800 dark:text-zinc-200">
              详细指标
            </h2>
            {hrZoneData.length > 0 ? (
              <HrZoneMetricsTable
                data={hrZoneData}
                zoneRanges={zoneRanges}
                trendLinkParams={{ ...getDateRange(timeRange), groupBy: GROUP_BY }}
              />
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                暂无数据
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

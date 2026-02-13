'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  formatPaceShort,
  formatDuration,
  formatListDateTime,
  formatMonthYear,
} from '@/app/lib/format';
import type { Activity } from '@/app/lib/types';
import type { MonthSummary } from '@/app/lib/types';

const MONTHS_PAGE_SIZE = 6;

/** 某月 startDate/endDate（用于 API） */
function monthToRange(yearMonth: string): { startDate: string; endDate: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

function fetchMonthActivities(monthKey: string): Promise<Activity[]> {
  const { startDate, endDate } = monthToRange(monthKey);
  const params = new URLSearchParams({
    page: '1',
    limit: '500',
    startDate,
    endDate,
  });
  return fetch(`/api/activities?${params}`)
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    })
    .then((json) => json.data ?? []);
}

export default function ListPage() {
  const router = useRouter();
  const [monthSummaries, setMonthSummaries] = useState<MonthSummary[]>([]);
  const [totalMonths, setTotalMonths] = useState(0);
  const [activitiesByMonth, setActivitiesByMonth] = useState<Record<string, Activity[]>>({});
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 首次拉取：最近 6 个月
  useEffect(() => {
    let cancelled = false;
    setLoadingSummaries(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(MONTHS_PAGE_SIZE), offset: '0' });
    fetch(`/api/activities/months?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          const list = json.data ?? [];
          const total = json.total ?? list.length;
          setMonthSummaries(list);
          setTotalMonths(total);
          if (list.length > 0 && expandedMonth === null) {
            setExpandedMonth(list[0].monthKey);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingSummaries(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 默认展开最近一月时，拉取该月数据
  useEffect(() => {
    if (!expandedMonth || loadingSummaries) return;
    if (activitiesByMonth[expandedMonth]) return;
    let cancelled = false;
    setLoadingMonth(expandedMonth);
    fetchMonthActivities(expandedMonth)
      .then((data) => {
        if (!cancelled) {
          setActivitiesByMonth((prev) => ({ ...prev, [expandedMonth]: data }));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingMonth((m) => (m === expandedMonth ? null : m));
      });
    return () => {
      cancelled = true;
    };
  }, [expandedMonth, loadingSummaries]);

  // 滚动到底部时请求下一页月份
  const loadMoreMonths = useCallback(() => {
    if (loadingMore || loadingSummaries) return;
    if (monthSummaries.length >= totalMonths) return;
    setLoadingMore(true);
    const params = new URLSearchParams({
      limit: String(MONTHS_PAGE_SIZE),
      offset: String(monthSummaries.length),
    });
    fetch(`/api/activities/months?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((json) => {
        const list = json.data ?? [];
        setMonthSummaries((prev) => [...prev, ...list]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loadingSummaries, monthSummaries.length, totalMonths]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || monthSummaries.length === 0 || monthSummaries.length >= totalMonths) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        loadMoreMonths();
      },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [monthSummaries.length, totalMonths, loadMoreMonths]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(activitiesByMonth).flat().forEach((a) => set.add(a.activity_type || '跑步'));
    return ['all', ...Array.from(set).sort()];
  }, [activitiesByMonth]);

  const loadAndExpandMonth = useCallback((monthKey: string) => {
    setExpandedMonth(monthKey);
  }, []);

  const filteredItemsForMonth = useMemo(() => {
    if (!expandedMonth) return [];
    const list = activitiesByMonth[expandedMonth] ?? [];
    let out = list;
    if (typeFilter !== 'all') {
      out = out.filter((a) => (a.activity_type || '跑步') === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      out = out.filter((a) => (a.name || '').toLowerCase().includes(q));
    }
    return out.sort(
      (x, y) =>
        new Date(y.start_time_local ?? y.start_time).getTime() -
        new Date(x.start_time_local ?? x.start_time).getTime()
    );
  }, [expandedMonth, activitiesByMonth, typeFilter, searchQuery]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* 筛选与搜索 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="all">所有类型</option>
          {typeOptions.filter((t) => t !== 'all').map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="ml-auto flex flex-1 min-w-0 max-w-xs items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800">
          <span className="mr-2 text-zinc-400" aria-hidden>
            🔍
          </span>
          <input
            type="search"
            placeholder="搜索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {loadingSummaries ? (
        <div className="flex justify-center py-12 text-zinc-500 dark:text-zinc-400">
          加载中…
        </div>
      ) : monthSummaries.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          暂无活动数据
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {monthSummaries.map((summary) => {
            const isExpanded = expandedMonth === summary.monthKey;
            const isLoading = loadingMonth === summary.monthKey;
            return (
              <section key={summary.monthKey} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => loadAndExpandMonth(summary.monthKey)}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMonthYear(summary.monthKey)}
                  </span>
                  <span className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                    <span>{Number(summary.totalDistance).toFixed(2)} 公里</span>
                    <span>{summary.count} 次</span>
                    {isExpanded ? (
                      <span className="inline-block rotate-180" aria-hidden>▲</span>
                    ) : (
                      <span aria-hidden>▲</span>
                    )}
                  </span>
                </button>
                {isExpanded && (
                  <>
                    {isLoading ? (
                      <div className="flex justify-center py-8 text-sm text-zinc-500 dark:text-zinc-400">
                        加载当月数据…
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {filteredItemsForMonth.length === 0 ? (
                          <div className="rounded-xl border border-zinc-200 bg-white py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                            该月暂无匹配活动
                          </div>
                        ) : (
                          filteredItemsForMonth.map((a) => (
                            <ActivityCard
                              key={a.activity_id}
                              activity={a}
                              onSelect={() => router.push(`/pages/${a.activity_id}`)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}
          {monthSummaries.length < totalMonths && (
            <div
              ref={loadMoreRef}
              className="flex justify-center py-6 text-sm text-zinc-500 dark:text-zinc-400"
            >
              {loadingMore ? '加载中…' : '滚动加载更多'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  activity: a,
  onSelect,
}: {
  activity: Activity;
  onSelect: () => void;
}) {
  const name = a.name || `跑步 ${formatListDateTime(a.start_time_local ?? a.start_time)}`;
  const duration = a.moving_time ?? a.duration;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex min-w-0 flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
    >
      <div
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-6xl opacity-10"
        aria-hidden
      >
        🏃
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-base font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
          {name}
        </h3>
        <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <span>{formatListDateTime(a.start_time_local ?? a.start_time)}</span>
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
            title="已完成"
            aria-hidden
          />
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {a.distance != null ? `${Number(a.distance).toFixed(2)} 公里` : '--'}
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatDuration(duration)} {formatPaceShort(a.average_pace)}
        </span>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {a.training_load != null && (
          <span className="text-zinc-600 dark:text-zinc-300">
            <span className="font-medium">{a.training_load.toFixed(1)}</span> 训练负荷
          </span>
        )}
        {a.vdot_value != null && (
          <span className="text-zinc-600 dark:text-zinc-300">
            <span className="font-medium">{a.vdot_value.toFixed(1)}</span> 即时跑力
          </span>
        )}
      </div>
    </button>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  formatPace,
  formatDistance,
  formatDuration,
  formatDateTime,
  formatInt,
} from '@/lib/format';
import type { Activity } from '@/lib/types';

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export default function ListPage() {
  const router = useRouter();
  const [data, setData] = useState<Activity[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(pagination.page),
      limit: String(pagination.limit),
    });
    fetch(`/api/activities?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json.data ?? []);
          setPagination((prev) => ({
            ...prev,
            ...json.pagination,
          }));
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
  }, [pagination.page, pagination.limit]);

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1 min-w-0">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          跑步活动列表
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          共 {pagination.total} 条活动，点击卡片进入详情
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          加载中…
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          暂无活动数据
        </div>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((a) => (
              <button
                key={a.activity_id}
                type="button"
                onClick={() => router.push(`/pages/${a.activity_id}`)}
                className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="min-w-0 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {formatDateTime(a.start_time_local ?? a.start_time)}
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="min-w-0">
                    <span className="text-zinc-500 dark:text-zinc-400">距离</span>
                    <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDistance(a.distance)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-zinc-500 dark:text-zinc-400">时长</span>
                    <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDuration(a.moving_time ?? a.duration)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-zinc-500 dark:text-zinc-400">配速</span>
                    <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {formatPace(a.average_pace)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-zinc-500 dark:text-zinc-400">心率</span>
                    <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {formatInt(a.average_heart_rate, 'bpm')}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-600"
              >
                上一页
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {pagination.page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= totalPages}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-600"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

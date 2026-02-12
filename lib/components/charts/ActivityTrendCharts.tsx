'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { ActivityRecord } from '@/lib/types';

interface ActivityTrendChartsProps {
  records: ActivityRecord[];
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 过滤明显异常值：超出合理范围则用前一个有效值补充（前向填充），仅影响展示 */
function filterOutliersWithForwardFill(
  values: (number | null)[],
  min: number,
  max: number
): (number | null)[] {
  let lastValid: number | null = null;
  return values.map((v) => {
    if (v != null && v >= min && v <= max) {
      lastValid = v;
      return v;
    }
    return lastValid;
  });
}

// 合理范围：心率 40–220 bpm，步频 100–220 步/分，步幅 30–180 cm
const HR_MIN = 40;
const HR_MAX = 220;
const CADENCE_MIN = 100;
const CADENCE_MAX = 220;
const STRIDE_CM_MIN = 30;
const STRIDE_CM_MAX = 180;

function buildLineChart(
  chartRef: HTMLDivElement,
  xData: number[],
  yData: (number | null)[],
  yName: string,
  unit: string,
  color: string
) {
  const chart = echarts.init(chartRef);
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : null;
        if (!p) return '';
        const axisValue = (p as { axisValue?: string }).axisValue ?? '';
        const value = (p as { value?: number | null }).value;
        return `<b>${axisValue}</b><br/>${yName}: ${value != null ? value + unit : '--'}`;
      },
    },
    grid: { left: 0, right: 0, bottom: 0, top: 10, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData.map((s) => formatElapsed(s)),
      axisLabel: { fontSize: 10, rotate: 45 },
      boundaryGap: true,
    },
    yAxis: {
      type: 'value',
      name: yName,
      axisLabel: { formatter: (v: number) => (unit === ' bpm' || unit === ' 步/分' ? `${Math.round(v)}` : `${v}`) },
    },
    series: [
      {
        type: 'line',
        data: yData,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color },
        areaStyle: { opacity: 0.15, color },
      },
    ],
  };
  chart.setOption(option);
  const handleResize = () => chart.resize();
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
    chart.dispose();
  };
}

export default function ActivityTrendCharts({ records }: ActivityTrendChartsProps) {
  const hrRef = useRef<HTMLDivElement>(null);
  const cadenceRef = useRef<HTMLDivElement>(null);
  const strideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!records.length) return;

    const xData = records.map((r) => r.elapsed_sec);
    const hrRaw = records.map((r) => r.heart_rate ?? null);
    const cadenceRaw = records.map((r) => r.cadence ?? null);
    const strideRaw = records.map((r) => (r.step_length != null ? r.step_length * 100 : null));

    const hrData = filterOutliersWithForwardFill(hrRaw, HR_MIN, HR_MAX);
    const cadenceData = filterOutliersWithForwardFill(cadenceRaw, CADENCE_MIN, CADENCE_MAX);
    const strideData = filterOutliersWithForwardFill(strideRaw, STRIDE_CM_MIN, STRIDE_CM_MAX);

    const cleanups: (() => void)[] = [];

    if (hrRef.current && hrData.some((v) => v != null)) {
      cleanups.push(
        buildLineChart(hrRef.current, xData, hrData, '心率', ' bpm', '#ef4444')
      );
    }
    if (cadenceRef.current && cadenceData.some((v) => v != null)) {
      cleanups.push(
        buildLineChart(cadenceRef.current, xData, cadenceData, '步频', ' 步/分', '#3b82f6')
      );
    }
    if (strideRef.current && strideData.some((v) => v != null)) {
      cleanups.push(
        buildLineChart(strideRef.current, xData, strideData, '步幅', ' cm', '#10b981')
      );
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [records]);

  const hasHr = records.some((r) => r.heart_rate != null);
  const hasCadence = records.some((r) => r.cadence != null);
  const hasStride = records.some((r) => r.step_length != null);

  if (!hasHr && !hasCadence && !hasStride) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="mb-4 text-lg font-medium text-zinc-800 dark:text-zinc-200">
        心率 / 步频 / 步幅趋势
      </h2>
      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
        {hasHr && (
          <div className="rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div ref={hrRef} style={{ width: '100%', height: '110px' }} />
          </div>
        )}
        {hasCadence && (
          <div className="rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div ref={cadenceRef} style={{ width: '100%', height: '110px' }} />
          </div>
        )}
        {hasStride && (
          <div className="rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div ref={strideRef} style={{ width: '100%', height: '110px' }} />
          </div>
        )}
      </div>
    </section>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { ActivityRecord } from '@/app/lib/types';

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

// 合理范围：心率 40–220 bpm，步频 100–220 步/分，步幅 30–180 cm，配速 3:00–15:00 /km
const HR_MIN = 40;
const HR_MAX = 220;
const CADENCE_MIN = 100;
const CADENCE_MAX = 220;
const STRIDE_CM_MIN = 30;
const STRIDE_CM_MAX = 180;
const PACE_MIN_SEC = 180;   // 3:00 /km
const PACE_MAX_SEC = 900;   // 15:00 /km

const FIVE_MIN_SEC = 300;

/** 彩色配色方案 */
const CHART_COLORS = {
  heartRate: {
    light: '#ef4444',    // red-500
    dark: '#f87171',     // red-400
  },
  pace: {
    light: '#3b82f6',    // blue-500
    dark: '#60a5fa',     // blue-400
  },
  cadence: {
    light: '#22c55e',    // green-500
    dark: '#4ade80',     // green-400
  },
  stride: {
    light: '#a855f7',    // purple-500
    dark: '#c084fc',     // purple-400
  },
};

/** 检测是否为暗色模式 */
function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/** 获取当前主题的颜色 */
function getThemeColor(colorSet: { light: string; dark: string }): string {
  return isDarkMode() ? colorSet.dark : colorSet.light;
}

/** 配速秒/公里 → M:SS 显示 */
function formatPaceForAxis(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildLineChart(
  chartRef: HTMLDivElement,
  xData: number[],
  yData: (number | null)[],
  yName: string,
  unit: string,
  colorSet: { light: string; dark: string }
) {
  const chart = echarts.init(chartRef);
  const color = getThemeColor(colorSet);
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      confine: true,
      appendToBody: false,
      backgroundColor: isDarkMode() ? '#27272a' : '#ffffff',
      borderColor: isDarkMode() ? '#3f3f46' : '#e4e4e7',
      textStyle: { color: isDarkMode() ? '#fafafa' : '#18181b' },
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
      axisLabel: {
        fontSize: 10,
        rotate: 45,
        color: isDarkMode() ? '#a1a1aa' : '#71717a',
        interval: (index: number) => {
          if (index === 0) return true;
          const curr = xData[index];
          const prev = xData[index - 1];
          return Math.floor(curr / FIVE_MIN_SEC) > Math.floor(prev / FIVE_MIN_SEC);
        },
      },
      axisLine: { lineStyle: { color: isDarkMode() ? '#3f3f46' : '#e4e4e7' } },
      boundaryGap: true,
    },
    yAxis: {
      type: 'value',
      name: yName,
      nameTextStyle: { color: isDarkMode() ? '#a1a1aa' : '#71717a' },
      axisLabel: { 
        formatter: (v: number) => (unit === ' bpm' || unit === ' 步/分' ? `${Math.round(v)}` : `${v}`),
        color: isDarkMode() ? '#a1a1aa' : '#71717a',
      },
      axisLine: { lineStyle: { color: isDarkMode() ? '#3f3f46' : '#e4e4e7' } },
      splitLine: { lineStyle: { color: isDarkMode() ? '#27272a' : '#f4f4f5' } },
    },
    series: [
      {
        type: 'line',
        data: yData,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.5, color },
        areaStyle: { 
          opacity: 0.2, 
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color },
            { offset: 1, color: isDarkMode() ? '#18181b' : '#ffffff' },
          ]),
        },
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

function buildPaceChart(chartRef: HTMLDivElement, xData: number[], paceData: (number | null)[]) {
  const chart = echarts.init(chartRef);
  const color = getThemeColor(CHART_COLORS.pace);
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      confine: true,
      appendToBody: false,
      backgroundColor: isDarkMode() ? '#27272a' : '#ffffff',
      borderColor: isDarkMode() ? '#3f3f46' : '#e4e4e7',
      textStyle: { color: isDarkMode() ? '#fafafa' : '#18181b' },
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : null;
        if (!p) return '';
        const axisValue = (p as { axisValue?: string }).axisValue ?? '';
        const value = (p as { value?: number | null }).value;
        const paceStr = value != null ? formatPaceForAxis(value) + ' /km' : '--';
        return `<b>${axisValue}</b><br/>配速: ${paceStr}`;
      },
    },
    grid: { left: 0, right: 0, bottom: 0, top: 10, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData.map((s) => formatElapsed(s)),
      axisLabel: {
        fontSize: 10,
        rotate: 45,
        color: isDarkMode() ? '#a1a1aa' : '#71717a',
        interval: (index: number) => {
          if (index === 0) return true;
          const curr = xData[index];
          const prev = xData[index - 1];
          return Math.floor(curr / FIVE_MIN_SEC) > Math.floor(prev / FIVE_MIN_SEC);
        },
      },
      axisLine: { lineStyle: { color: isDarkMode() ? '#3f3f46' : '#e4e4e7' } },
      boundaryGap: true,
    },
    yAxis: {
      type: 'value',
      name: '配速',
      nameTextStyle: { color: isDarkMode() ? '#a1a1aa' : '#71717a' },
      min: 0,
      axisLabel: {
        formatter: (v: number) => formatPaceForAxis(v),
        color: isDarkMode() ? '#a1a1aa' : '#71717a',
      },
      axisLine: { lineStyle: { color: isDarkMode() ? '#3f3f46' : '#e4e4e7' } },
      splitLine: { lineStyle: { color: isDarkMode() ? '#27272a' : '#f4f4f5' } },
    },
    series: [
      {
        type: 'line',
        data: paceData,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.5, color },
        areaStyle: { 
          opacity: 0.2, 
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color },
            { offset: 1, color: isDarkMode() ? '#18181b' : '#ffffff' },
          ]),
        },
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
  const paceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!records.length) return;

    const xData = records.map((r) => r.elapsed_sec);
    const hrRaw = records.map((r) => r.heart_rate ?? null);
    const cadenceRaw = records.map((r) => r.cadence ?? null);
    const strideRaw = records.map((r) => (r.step_length != null ? r.step_length * 100 : null));

    // 配速：优先用同步写入的 pace 字段，否则由步频与步幅推导
    const paceRaw: (number | null)[] = records.map((r) => {
      if (r.pace != null && r.pace >= PACE_MIN_SEC && r.pace <= PACE_MAX_SEC) return r.pace;
      const cadence = r.cadence ?? 0;
      const stepLength = r.step_length ?? 0;
      if (cadence <= 0 || stepLength <= 0) return null;
      const secPerKm = 60000 / (cadence * stepLength);
      return secPerKm;
    });
    const paceData = filterOutliersWithForwardFill(paceRaw, PACE_MIN_SEC, PACE_MAX_SEC);

    const hrData = filterOutliersWithForwardFill(hrRaw, HR_MIN, HR_MAX);
    const cadenceData = filterOutliersWithForwardFill(cadenceRaw, CADENCE_MIN, CADENCE_MAX);
    const strideData = filterOutliersWithForwardFill(strideRaw, STRIDE_CM_MIN, STRIDE_CM_MAX);

    const cleanups: (() => void)[] = [];

    if (hrRef.current && hrData.some((v) => v != null)) {
      cleanups.push(
        buildLineChart(hrRef.current, xData, hrData, '心率', ' bpm', CHART_COLORS.heartRate)
      );
    }
    if (cadenceRef.current && cadenceData.some((v) => v != null)) {
      cleanups.push(
        buildLineChart(cadenceRef.current, xData, cadenceData, '步频', ' 步/分', CHART_COLORS.cadence)
      );
    }
    if (strideRef.current && strideData.some((v) => v != null)) {
      cleanups.push(
        buildLineChart(strideRef.current, xData, strideData, '步幅', ' cm', CHART_COLORS.stride)
      );
    }
    if (paceRef.current && paceData.some((v) => v != null)) {
      cleanups.push(buildPaceChart(paceRef.current, xData, paceData));
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [records]);

  const hasHr = records.some((r) => r.heart_rate != null);
  const hasCadence = records.some((r) => r.cadence != null);
  const hasStride = records.some((r) => r.step_length != null);
  const hasPace = records.some(
    (r) =>
      (r.pace != null && r.pace > 0) ||
      (r.cadence != null && r.cadence > 0 && r.step_length != null && r.step_length > 0)
  );

  if (!hasHr && !hasCadence && !hasStride && !hasPace) {
    return null;
  }

  return (
    <>
      {hasHr && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-base font-medium text-zinc-800 dark:text-zinc-200">心率趋势</h2>
          <div ref={hrRef} style={{ width: '100%', height: '200px', position: 'relative', zIndex: 0 }} />
        </section>
      )}
      {hasPace && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-base font-medium text-zinc-800 dark:text-zinc-200">配速趋势</h2>
          <div ref={paceRef} style={{ width: '100%', height: '200px', position: 'relative', zIndex: 0 }} />
        </section>
      )}
      {hasCadence && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-base font-medium text-zinc-800 dark:text-zinc-200">步频趋势</h2>
          <div ref={cadenceRef} style={{ width: '100%', height: '200px', position: 'relative', zIndex: 0 }} />
        </section>
      )}
      {hasStride && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-base font-medium text-zinc-800 dark:text-zinc-200">步幅趋势</h2>
          <div ref={strideRef} style={{ width: '100%', height: '200px', position: 'relative', zIndex: 0 }} />
        </section>
      )}
    </>
  );
}

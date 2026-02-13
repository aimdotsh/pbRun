'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { VDOTTrendPoint } from '@/app/lib/types';

interface VDOTTrendChartProps {
  data: VDOTTrendPoint[];
  groupBy: 'week' | 'month';
}

export default function VDOTTrendChart({ data, groupBy }: VDOTTrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    // Prepare data：只展示平均 VDOT
    const periods = data.map(d => d.period);
    const avgVdot = data.map(d => d.avg_vdot.toFixed(1));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : null;
          if (!p) return '';
          const period = (p as { axisValue?: string }).axisValue ?? '';
          const value = (p as { value?: string }).value ?? '';
          const point = data.find(d => d.period === period);
          let tip = `<b>${period}</b><br/>平均 VDOT: ${value}`;
          if (point) {
            tip += `<br/>活动次数: ${point.activity_count}`;
            tip += `<br/>总距离: ${(point.total_distance / 1000).toFixed(1)} km`;
          }
          return tip;
        },
      },
      grid: {
        left: 0,
        right: 0,
        bottom: 0,
        top: 10,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: periods,
        axisLabel: {
          rotate: 45,
        },
      },
      yAxis: {
        type: 'value',
        name: 'VDOT',
        axisLabel: {
          formatter: '{value}',
        },
      },
      series: [
        {
          name: '平均 VDOT',
          type: 'line',
          data: avgVdot,
          smooth: true,
          lineStyle: {
            width: 3,
          },
          itemStyle: {
            color: '#3b82f6',
          },
        },
      ],
    };

    chart.setOption(option);

    // Resize handler
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, groupBy]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height: '200px' }} />;
}

'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { VDOTTrendPoint } from '@/lib/types';

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

    // Prepare data
    const periods = data.map(d => d.period);
    const avgVdot = data.map(d => d.avg_vdot.toFixed(1));
    const maxVdot = data.map(d => d.max_vdot?.toFixed(1) || null);
    const minVdot = data.map(d => d.min_vdot?.toFixed(1) || null);

    // Chart option
    const option: echarts.EChartsOption = {
      title: {
        text: 'VDOT 趋势分析',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
        },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const period = params[0].axisValue;
          let tooltip = `<b>${period}</b><br/>`;
          params.forEach((param: any) => {
            tooltip += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
          });
          const point = data.find(d => d.period === period);
          if (point) {
            tooltip += `活动次数: ${point.activity_count}<br/>`;
            tooltip += `总距离: ${(point.total_distance / 1000).toFixed(1)} km`;
          }
          return tooltip;
        },
      },
      legend: {
        data: ['平均 VDOT', '最大 VDOT', '最小 VDOT'],
        top: 30,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 70,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: periods,
        axisLabel: {
          rotate: groupBy === 'week' ? 45 : 0,
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
        {
          name: '最大 VDOT',
          type: 'line',
          data: maxVdot,
          smooth: true,
          lineStyle: {
            width: 2,
            type: 'dashed',
          },
          itemStyle: {
            color: '#10b981',
          },
        },
        {
          name: '最小 VDOT',
          type: 'line',
          data: minVdot,
          smooth: true,
          lineStyle: {
            width: 2,
            type: 'dashed',
          },
          itemStyle: {
            color: '#ef4444',
          },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          start: 0,
          end: 100,
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

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
}

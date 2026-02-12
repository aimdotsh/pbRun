/**
 * GET /api/analysis/hr-zones
 * Get heart rate zone statistics grouped by week or month.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHrZoneStats } from '@/lib/db';
import type { HrZoneAnalysisParams } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const groupBy = (searchParams.get('groupBy') || 'month') as 'week' | 'month';

    // Validate groupBy parameter
    if (!['week', 'month'].includes(groupBy)) {
      return NextResponse.json(
        { error: 'groupBy must be either "week" or "month"' },
        { status: 400 }
      );
    }

    // Validate date format if provided
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return NextResponse.json(
        { error: 'startDate must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }
    if (endDate && !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'endDate must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const params: HrZoneAnalysisParams = {
      startDate,
      endDate,
      groupBy,
    };

    // Get HR zone statistics
    const data = getHrZoneStats(params);

    // 心率区间 BPM 范围：与 lib/db getHrZone 一致，使用 .env MAX_HR
    const maxHr = process.env.MAX_HR ? parseInt(process.env.MAX_HR, 10) : 190;
    const p = (x: number) => Math.round((x / 100) * maxHr);
    const zoneRanges: Record<number, { min: number; max: number }> = {
      1: { min: 1, max: p(70) - 1 },
      2: { min: p(70), max: p(80) - 1 },
      3: { min: p(80), max: p(87) - 1 },
      4: { min: p(87), max: p(93) - 1 },
      5: { min: p(93), max: maxHr },
    };

    const summary = {
      total_activities: data.reduce((sum, item) => sum + item.activity_count, 0),
      total_periods: new Set(data.map(item => item.period)).size,
      date_range: {
        start: startDate || 'all',
        end: endDate || 'all',
      },
    };

    return NextResponse.json({
      data,
      zoneRanges,
      summary,
      groupBy,
    });
  } catch (error) {
    console.error('Error fetching HR zone stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

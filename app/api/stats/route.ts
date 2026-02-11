/**
 * GET /api/stats
 * Get statistics for a time period.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStats } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') as 'week' | 'month' | 'year' | null;

    // Validate period
    if (period && !['week', 'month', 'year'].includes(period)) {
      return NextResponse.json(
        { error: 'Period must be one of: week, month, year' },
        { status: 400 }
      );
    }

    // Get stats
    const stats = getStats(period || undefined);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

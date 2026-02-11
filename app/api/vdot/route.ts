/**
 * GET /api/vdot
 * Get VDOT history data for trend visualization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVDOTHistory } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate limit
    if (limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 500' },
        { status: 400 }
      );
    }

    // Get VDOT history
    const data = getVDOTHistory(limit);

    return NextResponse.json({
      data,
      count: data.length,
    });
  } catch (error) {
    console.error('Error fetching VDOT data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

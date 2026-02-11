/**
 * GET /api/activities
 * Get list of activities with pagination and filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivities } from '@/lib/db';
import { ActivityQueryParams } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const params: ActivityQueryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      type: searchParams.get('type') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // Validate parameters
    if (params.page! < 1) {
      return NextResponse.json(
        { error: 'Page must be >= 1' },
        { status: 400 }
      );
    }

    if (params.limit! < 1 || params.limit! > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Get activities
    const result = getActivities(params);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

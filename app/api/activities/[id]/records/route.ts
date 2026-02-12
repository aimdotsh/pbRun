/**
 * GET /api/activities/:id/records
 * Get record-level data for an activity (heart rate, cadence, stride trend over time).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityRecords, getActivityById } from '@/lib/db';
import type { ActivityRecord } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const activityId = parseInt(id);

    if (isNaN(activityId)) {
      return NextResponse.json(
        { error: 'Invalid activity ID' },
        { status: 400 }
      );
    }

    const activity = getActivityById(activityId);
    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    let records: ActivityRecord[];
    try {
      records = getActivityRecords(activityId);
    } catch {
      records = [];
    }

    return NextResponse.json({
      activity_id: activityId,
      records,
    });
  } catch (error) {
    console.error('Error fetching activity records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

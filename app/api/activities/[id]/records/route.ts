/**
 * GET /api/activities/:id/records
 * Get record-level data for an activity (heart rate, cadence, stride trend over time).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityRecords, getActivityById } from '@/app/lib/db';
import type { ActivityRecord } from '@/app/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Invalid activity ID' },
        { status: 400 }
      );
    }

    const activity = getActivityById(id);
    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    let records: ActivityRecord[];
    try {
      records = getActivityRecords(id);
    } catch {
      records = [];
    }

    return NextResponse.json({
      activity_id: id,
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

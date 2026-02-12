/**
 * GET /api/activities/:id/laps
 * Get laps for an activity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityLaps, getActivityById } from '@/lib/db';

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

    // Check if activity exists
    const activity = getActivityById(activityId);
    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    // Get laps
    const laps = getActivityLaps(activityId);

    return NextResponse.json({
      activity_id: activityId,
      laps,
    });
  } catch (error) {
    console.error('Error fetching laps:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

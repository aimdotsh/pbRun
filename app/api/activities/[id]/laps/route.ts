/**
 * GET /api/activities/:id/laps
 * Get laps for an activity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityLaps, getActivityById } from '@/app/lib/db';

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

    // Check if activity exists
    const activity = getActivityById(id);
    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    // Get laps
    const laps = getActivityLaps(id);

    return NextResponse.json({
      activity_id: id,
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

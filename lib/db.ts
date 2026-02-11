/**
 * SQLite database access layer using better-sqlite3.
 */

import Database from 'better-sqlite3';
import path from 'path';
import {
  Activity,
  ActivityLap,
  ActivityQueryParams,
  PaginatedResponse,
  StatsResponse,
  VDOTDataPoint,
} from './types';

// Database connection (singleton)
let db: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'activities.db');
    db = new Database(dbPath, { readonly: true });
  }
  return db;
}

/**
 * Get activities with pagination and filtering.
 */
export function getActivities(
  params: ActivityQueryParams
): PaginatedResponse<Activity> {
  const { page = 1, limit = 20, type, startDate, endDate } = params;
  const offset = (page - 1) * limit;

  const db = getDatabase();

  // Build query
  let query = 'SELECT * FROM activities WHERE 1=1';
  const queryParams: any[] = [];

  if (type) {
    query += ' AND activity_type = ?';
    queryParams.push(type);
  }
  if (startDate) {
    query += ' AND start_time >= ?';
    queryParams.push(startDate);
  }
  if (endDate) {
    query += ' AND start_time <= ?';
    queryParams.push(endDate);
  }

  // Get total count
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countResult = db.prepare(countQuery).get(...queryParams) as { count: number };
  const total = countResult.count;

  // Get paginated data
  query += ' ORDER BY start_time DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  const stmt = db.prepare(query);
  const data = stmt.all(...queryParams) as Activity[];

  return {
    data,
    pagination: {
      page,
      limit,
      total,
    },
  };
}

/**
 * Get a single activity by ID.
 */
export function getActivityById(activityId: number): Activity | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM activities WHERE activity_id = ?');
  const result = stmt.get(activityId) as Activity | undefined;
  return result || null;
}

/**
 * Get laps for an activity.
 */
export function getActivityLaps(activityId: number): ActivityLap[] {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT * FROM activity_laps WHERE activity_id = ? ORDER BY lap_index'
  );
  return stmt.all(activityId) as ActivityLap[];
}

/**
 * Get statistics for a time period.
 */
export function getStats(period?: 'week' | 'month' | 'year'): StatsResponse {
  const db = getDatabase();

  // Build date filter
  let dateFilter = '';
  if (period) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    dateFilter = `WHERE start_time >= '${startDate.toISOString()}'`;
  }

  // Query stats
  const query = `
    SELECT
      COUNT(*) as totalActivities,
      SUM(distance) as totalDistance,
      SUM(duration) as totalDuration,
      AVG(average_pace) as averagePace,
      AVG(average_heart_rate) as averageHeartRate,
      SUM(total_ascent) as totalAscent,
      AVG(vdot_value) as averageVDOT
    FROM activities
    ${dateFilter}
  `;

  const result = db.prepare(query).get() as any;

  return {
    totalActivities: result.totalActivities || 0,
    totalDistance: result.totalDistance || 0,
    totalDuration: result.totalDuration || 0,
    averagePace: result.averagePace || undefined,
    averageHeartRate: result.averageHeartRate || undefined,
    totalAscent: result.totalAscent || undefined,
    averageVDOT: result.averageVDOT || undefined,
  };
}

/**
 * Get VDOT history data.
 */
export function getVDOTHistory(limit: number = 50): VDOTDataPoint[] {
  const db = getDatabase();

  const query = `
    SELECT
      activity_id,
      start_time,
      vdot_value,
      distance,
      duration
    FROM activities
    WHERE vdot_value IS NOT NULL
    ORDER BY start_time DESC
    LIMIT ?
  `;

  const stmt = db.prepare(query);
  return stmt.all(limit) as VDOTDataPoint[];
}

/**
 * Close database connection.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

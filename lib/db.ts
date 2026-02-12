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
  HrZoneStat,
  VDOTTrendPoint,
  HrZoneAnalysisParams,
  VDOTTrendParams,
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
 * Helper: Get period string from date
 */
function getPeriodFromDate(dateStr: string, groupBy: 'week' | 'month'): string {
  const date = new Date(dateStr);

  if (groupBy === 'month') {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  } else {
    const year = date.getUTCFullYear();
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const daysSinceStartOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
    const weekNo = Math.ceil((daysSinceStartOfYear + startOfYear.getUTCDay() + 1) / 7);
    return `${year}-W${String(weekNo).padStart(2, '0')}`;
  }
}

/**
 * Get HR zone stats from cache table
 */
function getHrZoneStatsFromCache(params: HrZoneAnalysisParams): HrZoneStat[] {
  const db = getDatabase();
  const { startDate, endDate, groupBy } = params;

  let query = `
    SELECT
      period,
      period_type,
      hr_zone,
      activity_count,
      total_duration,
      total_distance,
      avg_pace,
      avg_cadence,
      avg_stride_length,
      avg_heart_rate
    FROM hr_zone_stats_cache
    WHERE period_type = ?
  `;

  const queryParams: any[] = [groupBy];

  if (startDate) {
    const startPeriod = getPeriodFromDate(startDate, groupBy);
    query += ' AND period >= ?';
    queryParams.push(startPeriod);
  }

  if (endDate) {
    const endPeriod = getPeriodFromDate(endDate, groupBy);
    query += ' AND period <= ?';
    queryParams.push(endPeriod);
  }

  query += ' ORDER BY period, hr_zone';

  return db.prepare(query).all(...queryParams) as HrZoneStat[];
}

/**
 * Get HR zone stats using real-time calculation
 */
function getHrZoneStatsRealtime(params: HrZoneAnalysisParams): HrZoneStat[] {
  const { startDate, endDate, groupBy } = params;
  const db = getDatabase();

  // Get MAX_HR and RESTING_HR from environment
  const maxHr = process.env.MAX_HR ? parseInt(process.env.MAX_HR) : 190;
  const restingHr = process.env.RESTING_HR ? parseInt(process.env.RESTING_HR) : 55;

  // Build date filter
  let dateFilter = 'WHERE average_heart_rate IS NOT NULL';
  const queryParams: any[] = [];

  if (startDate) {
    dateFilter += ' AND start_time >= ?';
    queryParams.push(startDate);
  }
  if (endDate) {
    dateFilter += ' AND start_time <= ?';
    queryParams.push(endDate);
  }

  // Get all activities with heart rate data
  const query = `
    SELECT
      activity_id,
      start_time,
      duration,
      distance,
      average_pace,
      average_cadence,
      average_stride_length,
      average_heart_rate
    FROM activities
    ${dateFilter}
    ORDER BY start_time
  `;

  const activities = db.prepare(query).all(...queryParams) as any[];

  // Helper function to calculate HR zone
  const getHrZone = (avgHr: number): number => {
    if (avgHr <= 0) return 0;
    const hrPercent = (avgHr / maxHr) * 100;
    if (hrPercent < 70) return 1;
    if (hrPercent < 80) return 2;
    if (hrPercent < 87) return 3;
    if (hrPercent < 93) return 4;
    return 5;
  };

  // Helper function to get period string
  const getPeriod = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (groupBy === 'month') {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    } else {
      // ISO week number
      const year = date.getUTCFullYear();
      const startOfYear = new Date(Date.UTC(year, 0, 1));
      const weekNo = Math.ceil((((date.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getUTCDay() + 1) / 7);
      return `${year}-W${String(weekNo).padStart(2, '0')}`;
    }
  };

  // Aggregate by period and HR zone
  const statsMap: Map<string, HrZoneStat> = new Map();

  for (const activity of activities) {
    if (!activity.average_heart_rate) continue;

    const hrZone = getHrZone(activity.average_heart_rate);
    if (hrZone === 0) continue;

    const period = getPeriod(activity.start_time);
    const key = `${period}_${hrZone}`;

    if (!statsMap.has(key)) {
      statsMap.set(key, {
        period,
        period_type: groupBy,
        hr_zone: hrZone,
        activity_count: 0,
        total_duration: 0,
        total_distance: 0,
        avg_pace: null,
        avg_cadence: null,
        avg_stride_length: null,
        avg_heart_rate: null,
      });
    }

    const stat = statsMap.get(key)!;
    stat.activity_count += 1;
    stat.total_duration += activity.duration || 0;
    stat.total_distance += activity.distance || 0;

    // Accumulate for averaging
    const prevAvgPace = stat.avg_pace || 0;
    const prevAvgCadence = stat.avg_cadence || 0;
    const prevAvgStride = stat.avg_stride_length || 0;
    const prevAvgHr = stat.avg_heart_rate || 0;

    stat.avg_pace = activity.average_pace
      ? (prevAvgPace * (stat.activity_count - 1) + activity.average_pace) / stat.activity_count
      : prevAvgPace || null;
    stat.avg_cadence = activity.average_cadence
      ? (prevAvgCadence * (stat.activity_count - 1) + activity.average_cadence) / stat.activity_count
      : prevAvgCadence || null;
    stat.avg_stride_length = activity.average_stride_length
      ? (prevAvgStride * (stat.activity_count - 1) + activity.average_stride_length) / stat.activity_count
      : prevAvgStride || null;
    stat.avg_heart_rate = activity.average_heart_rate
      ? (prevAvgHr * (stat.activity_count - 1) + activity.average_heart_rate) / stat.activity_count
      : prevAvgHr || null;
  }

  return Array.from(statsMap.values()).sort((a, b) => {
    if (a.period !== b.period) return a.period.localeCompare(b.period);
    return a.hr_zone - b.hr_zone;
  });
}

/**
 * Merge HR zone stats from cache and realtime
 */
function mergeHrZoneStats(cached: HrZoneStat[], realtime: HrZoneStat[]): HrZoneStat[] {
  const merged = [...cached, ...realtime];
  return merged.sort((a, b) => {
    if (a.period !== b.period) return a.period.localeCompare(b.period);
    return a.hr_zone - b.hr_zone;
  });
}

/**
 * Get heart rate zone statistics grouped by week or month.
 * Uses intelligent data source selection (cache vs realtime).
 */
export function getHrZoneStats(params: HrZoneAnalysisParams): HrZoneStat[] {
  const { startDate, endDate, groupBy } = params;

  // Calculate "freshness threshold" (7 days ago)
  const now = new Date();
  const freshThreshold = new Date(now);
  freshThreshold.setDate(now.getDate() - 7);
  const freshDate = freshThreshold.toISOString().split('T')[0];

  // Strategy 1: Query range is entirely before 7 days ago → use cache
  if (endDate && endDate < freshDate) {
    return getHrZoneStatsFromCache(params);
  }

  // Strategy 2: Query range is entirely within last 7 days → realtime
  if (startDate && startDate >= freshDate) {
    return getHrZoneStatsRealtime(params);
  }

  // Strategy 3: Hybrid mode → cache + realtime
  const cachedData = getHrZoneStatsFromCache({
    ...params,
    endDate: freshDate,
  });

  const realtimeData = getHrZoneStatsRealtime({
    ...params,
    startDate: freshDate,
  });

  return mergeHrZoneStats(cachedData, realtimeData);
}

/**
 * Get VDOT trend from cache table
 */
function getVDOTTrendFromCache(params: VDOTTrendParams): VDOTTrendPoint[] {
  const db = getDatabase();
  const { startDate, endDate, groupBy } = params;

  let query = `
    SELECT
      period,
      period_type,
      avg_vdot,
      max_vdot,
      min_vdot,
      activity_count,
      total_distance,
      total_duration
    FROM vdot_trend_cache
    WHERE period_type = ?
  `;

  const queryParams: any[] = [groupBy];

  if (startDate) {
    const startPeriod = getPeriodFromDate(startDate, groupBy);
    query += ' AND period >= ?';
    queryParams.push(startPeriod);
  }

  if (endDate) {
    const endPeriod = getPeriodFromDate(endDate, groupBy);
    query += ' AND period <= ?';
    queryParams.push(endPeriod);
  }

  query += ' ORDER BY period';

  return db.prepare(query).all(...queryParams) as VDOTTrendPoint[];
}

/**
 * Get VDOT trend using real-time calculation
 */
function getVDOTTrendRealtime(params: VDOTTrendParams): VDOTTrendPoint[] {
  const { startDate, endDate, groupBy } = params;
  const db = getDatabase();

  // Build date filter
  let dateFilter = 'WHERE vdot_value IS NOT NULL';
  const queryParams: any[] = [];

  if (startDate) {
    dateFilter += ' AND start_time >= ?';
    queryParams.push(startDate);
  }
  if (endDate) {
    dateFilter += ' AND start_time <= ?';
    queryParams.push(endDate);
  }

  // Get all activities with VDOT data
  const query = `
    SELECT
      start_time,
      vdot_value,
      distance,
      duration
    FROM activities
    ${dateFilter}
    ORDER BY start_time
  `;

  const activities = db.prepare(query).all(...queryParams) as any[];

  // Helper function to get period string
  const getPeriod = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (groupBy === 'month') {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    } else {
      const year = date.getUTCFullYear();
      const startOfYear = new Date(Date.UTC(year, 0, 1));
      const weekNo = Math.ceil((((date.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getUTCDay() + 1) / 7);
      return `${year}-W${String(weekNo).padStart(2, '0')}`;
    }
  };

  // Aggregate by period
  const trendsMap: Map<string, VDOTTrendPoint> = new Map();

  for (const activity of activities) {
    const period = getPeriod(activity.start_time);

    if (!trendsMap.has(period)) {
      trendsMap.set(period, {
        period,
        period_type: groupBy,
        avg_vdot: 0,
        max_vdot: null,
        min_vdot: null,
        activity_count: 0,
        total_distance: 0,
        total_duration: 0,
      });
    }

    const trend = trendsMap.get(period)!;
    trend.activity_count += 1;
    trend.total_distance += activity.distance || 0;
    trend.total_duration += activity.duration || 0;

    // Update VDOT stats
    const vdot = activity.vdot_value;
    trend.avg_vdot = (trend.avg_vdot * (trend.activity_count - 1) + vdot) / trend.activity_count;
    trend.max_vdot = trend.max_vdot === null ? vdot : Math.max(trend.max_vdot, vdot);
    trend.min_vdot = trend.min_vdot === null ? vdot : Math.min(trend.min_vdot, vdot);
  }

  return Array.from(trendsMap.values()).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Merge VDOT trend data from cache and realtime
 */
function mergeVDOTTrend(cached: VDOTTrendPoint[], realtime: VDOTTrendPoint[]): VDOTTrendPoint[] {
  const merged = [...cached, ...realtime];
  return merged.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get VDOT trend data grouped by week or month.
 * Uses intelligent data source selection (cache vs realtime).
 */
export function getVDOTTrend(params: VDOTTrendParams): VDOTTrendPoint[] {
  const { startDate, endDate, groupBy } = params;

  // Calculate "freshness threshold" (7 days ago)
  const now = new Date();
  const freshThreshold = new Date(now);
  freshThreshold.setDate(now.getDate() - 7);
  const freshDate = freshThreshold.toISOString().split('T')[0];

  // Strategy 1: Query range is entirely before 7 days ago → use cache
  if (endDate && endDate < freshDate) {
    return getVDOTTrendFromCache(params);
  }

  // Strategy 2: Query range is entirely within last 7 days → realtime
  if (startDate && startDate >= freshDate) {
    return getVDOTTrendRealtime(params);
  }

  // Strategy 3: Hybrid mode → cache + realtime
  const cachedData = getVDOTTrendFromCache({
    ...params,
    endDate: freshDate,
  });

  const realtimeData = getVDOTTrendRealtime({
    ...params,
    startDate: freshDate,
  });

  return mergeVDOTTrend(cachedData, realtimeData);
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

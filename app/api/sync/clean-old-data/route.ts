/**
 * POST /api/sync/clean-old-data
 * Clean activities without source (old demo data)
 */

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'app/data/activities.db');

export async function POST() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    
    // 检查是否有无来源数据
    const countResult = db.prepare(`
      SELECT COUNT(*) as count FROM activities 
      WHERE source IS NULL OR source = '' OR source = 'unknown'
    `).get();
    
    if (countResult.count === 0) {
      db.close();
      return NextResponse.json({ 
        success: true, 
        message: '没有需要清理的数据' 
      });
    }
    
    // 删除无来源活动的 records
    const deleteRecords = db.prepare(`
      DELETE FROM activity_records WHERE activity_id IN (
        SELECT activity_id FROM activities WHERE source IS NULL OR source = '' OR source = 'unknown'
      )
    `);
    const recordsResult = deleteRecords.run();
    
    // 删除无来源活动的 laps
    const deleteLaps = db.prepare(`
      DELETE FROM activity_laps WHERE activity_id IN (
        SELECT activity_id FROM activities WHERE source IS NULL OR source = '' OR source = 'unknown'
      )
    `);
    const lapsResult = deleteLaps.run();
    
    // 删除无来源的活动
    const deleteActivities = db.prepare(`
      DELETE FROM activities WHERE source IS NULL OR source = '' OR source = 'unknown'
    `);
    const activitiesResult = deleteActivities.run();
    
    // 清理统计缓存
    db.exec('DELETE FROM hr_zone_stats_cache');
    db.exec('DELETE FROM vdot_trend_cache');
    
    db.close();
    
    return NextResponse.json({ 
      success: true, 
      message: `已清理 ${activitiesResult.changes} 条活动、${lapsResult.changes} 条分段、${recordsResult.changes} 条记录`
    });
  } catch (error) {
    console.error('Clean old data error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '清理失败' 
    }, { status: 500 });
  }
}

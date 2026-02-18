#!/usr/bin/env node
/**
 * Sync COROS activities and parse FIT files to SQLite database
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const CorosClient = require('./coros-client');
const GarminFITParser = require('./fit-parser');
const VDOTCalculator = require('./vdot-calculator');
const DatabaseManager = require('./db-manager');

const FIT_CACHE_DIR = path.join(process.cwd(), '.cache', 'fit');

function isZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4B;
}

async function extractFitFromZip(zipBuffer) {
  const { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } = await import('@zip.js/zip.js');
  const u8 = Buffer.isBuffer(zipBuffer) ? new Uint8Array(zipBuffer) : new Uint8Array(zipBuffer);
  const reader = new ZipReader(new Uint8ArrayReader(u8));
  const entries = await reader.getEntries();
  const fitEntry = entries.find(e => !e.directory && (e.filename.toLowerCase().endsWith('.fit') || e.filename.toLowerCase().endsWith('.fit.gz')));
  if (!fitEntry) {
    await reader.close();
    return null;
  }
  const data = await fitEntry.getData(new Uint8ArrayWriter());
  await reader.close();
  return Buffer.from(data);
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class CorosSync {
  constructor(options = {}) {
    this.account = process.env.COROS_ACCOUNT;
    this.password = process.env.COROS_PASSWORD;
    this.maxHr = process.env.MAX_HR ? parseInt(process.env.MAX_HR) : null;
    this.restingHr = process.env.RESTING_HR ? parseInt(process.env.RESTING_HR) : null;
    this.onlyRunning = options.onlyRunning !== false;
    this.withLaps = options.withLaps !== false;
    this.limit = options.limit || null;
    this.force = options.force || false;
    this.dbPath = options.dbPath || 'app/data/activities.db';

    if (!this.account || !this.password) {
      throw new Error('COROS_ACCOUNT and COROS_PASSWORD environment variables must be set');
    }

    this.client = new CorosClient(this.account, this.password);
    this.fitParser = new GarminFITParser();
    this.db = new DatabaseManager(this.dbPath);

    this.vdotCalculator = null;
    if (this.maxHr && this.restingHr) {
      this.vdotCalculator = new VDOTCalculator(this.maxHr, this.restingHr);
    }
  }

  async syncAll() {
    try {
      log('\n╔═══════════════════════════════════════════════════════╗', 'blue');
      log('║        COROS 数据同步                                  ║', 'blue');
      log('║        Starting COROS Data Synchronization            ║', 'blue');
      log('╚═══════════════════════════════════════════════════════╝\n', 'blue');

      await fs.mkdir(FIT_CACHE_DIR, { recursive: true });

      log('检查 COROS 认证...', 'cyan');
      await this.client.login();
      log('✓ 认证成功\n', 'green');

      const existingIds = new Set(this.db.getAllActivityIds());
      log(`发现 ${existingIds.size} 个现有活动\n`, 'cyan');

      log('从 COROS 获取活动列表...', 'yellow');
      const allActivities = await this.client.fetchActivityIds(this.onlyRunning);
      log(`✓ 找到 ${allActivities.length} 个活动\n`, 'green');

      let activitiesToSync;
      if (this.force) {
        log('⚠ 强制模式：将重新处理所有活动\n', 'yellow');
        activitiesToSync = allActivities;
      } else {
        activitiesToSync = allActivities.filter(
          act => !existingIds.has(`coros_${act.labelId}`)
        );
      }

      if (activitiesToSync.length === 0) {
        log('✓ 所有活动已同步！', 'green');
        return { success: true, synced: 0, total: allActivities.length };
      }

      log(`开始同步 ${activitiesToSync.length} 个活动...\n`, 'yellow');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coros-fit-'));

      try {
        let successCount = 0;
        const total = activitiesToSync.length;

        for (let i = 0; i < activitiesToSync.length; i++) {
          const activity = activitiesToSync[i];
          const progress = `[${i + 1}/${total}]`;

          try {
            const result = await this._syncActivity(activity, tempDir);
            if (result.success) {
              successCount++;
              log(`${progress} ✓ COROS活动 ${activity.labelId}`, 'green');
            } else {
              log(`${progress} ○ COROS活动 ${activity.labelId} 跳过`, 'yellow');
            }
          } catch (error) {
            log(`${progress} ✗ COROS活动 ${activity.labelId} ${error.message}`, 'red');
          }

          await this._sleep(300);
        }

        log(`\n✓ 同步完成: ${successCount}/${total} 个活动`, 'green');
        return { success: true, synced: successCount, total };

      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }

    } catch (error) {
      log(`\n✗ 同步失败: ${error.message}`, 'red');
      throw error;
    } finally {
      this.db.close();
    }
  }

  async _syncActivity(activityMeta, tempDir) {
    const labelId = activityMeta.labelId;
    const activityId = `coros_${labelId}`;

    const cachePath = path.join(FIT_CACHE_DIR, `coros_${labelId}`);
    let rawData = null;
    let fromCache = false;

    try {
      rawData = await fs.readFile(cachePath);
      fromCache = true;
    } catch {
      rawData = await this.client.downloadFitFile(labelId, activityMeta.sportType);
      if (rawData) {
        await fs.writeFile(cachePath, Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData));
      }
    }

    if (!rawData) {
      return { success: false };
    }

    let fitData = rawData;
    if (isZip(fitData)) {
      const extracted = await extractFitFromZip(fitData);
      if (!extracted) return { success: false };
      fitData = extracted;
    }

    const fitFilePath = path.join(tempDir, `${labelId}.fit`);
    await fs.writeFile(fitFilePath, Buffer.isBuffer(fitData) ? fitData : Buffer.from(fitData));

    const { activity: activityData, laps: lapsData, records: recordsData } = await this.fitParser.parseFitFile(fitFilePath);

    if (!activityData) {
      return { success: false };
    }

    const sessionAvgHr = activityData.average_heart_rate != null ? Number(activityData.average_heart_rate) : null;
    const sessionMaxHr = activityData.max_heart_rate != null ? Number(activityData.max_heart_rate) : null;
    const hasHrInRecords = Array.isArray(recordsData) && recordsData.some(r => r.heart_rate != null && Number(r.heart_rate) > 0);
    const hasHeartRate = (sessionAvgHr != null && sessionAvgHr > 0) ||
      (sessionMaxHr != null && sessionMaxHr > 0) ||
      hasHrInRecords;

    if (!hasHeartRate) {
      await fs.unlink(fitFilePath).catch(() => {});
      return { success: false, skipped: true, reason: 'no_heart_rate' };
    }

    activityData.activity_id = activityId;
    // 使用 COROS 返回的名称，或根据日期生成
    if (activityMeta.name) {
      activityData.name = activityMeta.name;
    } else {
      const date = new Date(activityData.start_time);
      const dateStr = date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      const distanceKm = (activityData.distance || 0).toFixed(1);
      activityData.name = `${dateStr} 跑步 ${distanceKm}km`;
    }
    activityData.activity_type = 'running';
    activityData.source = 'coros';

    // 使用 COROS 返回的训练负荷（如果有）
    if (activityMeta.trainingLoad && !activityData.training_load) {
      activityData.training_load = activityMeta.trainingLoad;
    }

    if (this.vdotCalculator && activityData.average_heart_rate) {
      const vdot = this.vdotCalculator.calculateVdotFromPace(
        (activityData.distance || 0) * 1000,
        activityData.duration || 0,
        activityData.average_heart_rate
      );
      activityData.vdot_value = vdot;

      const trainingLoad = this.vdotCalculator.calculateTrainingLoad(
        activityData.duration || 0,
        activityData.average_heart_rate
      );
      activityData.training_load = trainingLoad;
    }

    this.db.upsertActivity(activityData);

    if (this.withLaps && lapsData.length > 0) {
      const lapsWithId = lapsData.map(lap => ({
        ...lap,
        activity_id: activityId
      }));
      this.db.insertLaps(activityId, lapsWithId);
    }

    if (recordsData && recordsData.length > 0) {
      const recordsWithId = recordsData.map(rec => ({
        ...rec,
        activity_id: activityId
      }));
      this.db.insertActivityRecords(activityId, recordsWithId);
    }

    await fs.unlink(fitFilePath);

    return { success: true, fromCache };
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    onlyRunning: !args.includes('--all-types'),
    withLaps: !args.includes('--no-laps'),
    force: args.includes('--force'),
    limit: null,
    dbPath: 'app/data/activities.db'
  };

  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    options.limit = parseInt(args[limitIndex + 1]);
  }

  const dbIndex = args.indexOf('--db');
  if (dbIndex !== -1 && args[dbIndex + 1]) {
    options.dbPath = args[dbIndex + 1];
  }

  try {
    const sync = new CorosSync(options);
    const result = await sync.syncAll();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    log(`\nFatal error: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = CorosSync;

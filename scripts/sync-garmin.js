#!/usr/bin/env node
/**
 * Sync Garmin activities and parse FIT files to SQLite database
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const GarminClient = require('./garmin-client');
const GarminFITParser = require('./fit-parser');
const VDOTCalculator = require('./vdot-calculator');
const DatabaseManager = require('./db-manager');

/** FIT 缓存目录，避免重复拉取 */
const FIT_CACHE_DIR = path.join(process.cwd(), '.cache', 'fit');

/** Garmin returns ZIP containing .fit; detect and extract. */
function isZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4B; // PK
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

// ANSI colors
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

class GarminSync {
  constructor(options = {}) {
    this.secretString = process.env.GARMIN_SECRET_STRING;
    this.maxHr = process.env.MAX_HR ? parseInt(process.env.MAX_HR) : null;
    this.restingHr = process.env.RESTING_HR ? parseInt(process.env.RESTING_HR) : null;
    this.onlyRunning = options.onlyRunning !== false;
    this.withLaps = options.withLaps !== false;
    this.limit = options.limit || null;
    this.dbPath = options.dbPath || 'data/activities.db';

    if (!this.secretString) {
      throw new Error('GARMIN_SECRET_STRING environment variable not set');
    }

    // Initialize components
    this.client = new GarminClient(this.secretString);
    this.fitParser = new GarminFITParser();
    this.db = new DatabaseManager(this.dbPath);

    // VDOT calculator (if heart rate data available)
    this.vdotCalculator = null;
    if (this.maxHr && this.restingHr) {
      this.vdotCalculator = new VDOTCalculator(this.maxHr, this.restingHr);
    }
  }

  async syncAll() {
    try {
      log('\n╔═══════════════════════════════════════════════════════╗', 'blue');
      log('║        Garmin 数据同步                                 ║', 'blue');
      log('║        Starting Garmin Data Synchronization           ║', 'blue');
      log('╚═══════════════════════════════════════════════════════╝\n', 'blue');

      // Ensure FIT cache directory exists
      await fs.mkdir(FIT_CACHE_DIR, { recursive: true });

      // Check authentication
      log('检查 Garmin 认证...', 'cyan');
      const authValid = await this.client.checkAuth();
      if (!authValid) {
        throw new Error('Garmin authentication failed. Please check your token.');
      }
      log('✓ 认证成功\n', 'green');

      // Get existing activity IDs
      const existingIds = new Set(this.db.getAllActivityIds());
      log(`发现 ${existingIds.size} 个现有活动\n`, 'cyan');

      // Fetch activities from Garmin
      log('从 Garmin Connect 获取活动列表...', 'yellow');
      const allActivities = await this._fetchAllActivities();
      log(`✓ 找到 ${allActivities.length} 个活动\n`, 'green');

      // Filter out already synced activities
      const newActivities = allActivities.filter(
        act => !existingIds.has(act.activityId)
      );

      if (newActivities.length === 0) {
        log('✓ 所有活动已同步！', 'green');
        return { success: true, synced: 0, total: allActivities.length };
      }

      log(`开始同步 ${newActivities.length} 个新活动...\n`, 'yellow');

      // Create temp directory
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'garmin-fit-'));

      try {
        let successCount = 0;
        const total = newActivities.length;

        for (let i = 0; i < newActivities.length; i++) {
          const activity = newActivities[i];
          const progress = `[${i + 1}/${total}]`;

          try {
            const result = await this._syncActivity(activity, tempDir);
            if (result.success) {
              successCount++;
              const source = result.fromCache ? '缓存' : '远程';
              log(`${progress} ✓ ${activity.activityName} (${source})`, 'green');
            } else if (result.skipped && result.reason === 'no_heart_rate') {
              log(`${progress} ○ ${activity.activityName} - 跳过（无心率）`, 'yellow');
            } else {
              log(`${progress} ✗ ${activity.activityName} - 失败`, 'red');
            }
          } catch (error) {
            log(`${progress} ✗ ${activity.activityName} - ${error.message}`, 'red');
          }

          // Small delay to avoid rate limiting
          await this._sleep(300);
        }

        log(`\n✓ 同步完成: ${successCount}/${total} 个活动`, 'green');
        return { success: true, synced: successCount, total: total };

      } finally {
        // Cleanup temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }

    } catch (error) {
      log(`\n✗ 同步失败: ${error.message}`, 'red');
      throw error;
    } finally {
      this.db.close();
    }
  }

  async _fetchAllActivities() {
    const allActivities = [];
    const batchSize = 100;
    let start = 0;

    while (true) {
      const activities = await this.client.getActivities(start, batchSize);
      if (!activities || activities.length === 0) {
        break;
      }

      // Filter by activity type if needed
      const filtered = this.onlyRunning
        ? activities.filter(act => act.activityType?.typeKey === 'running')
        : activities;

      allActivities.push(...filtered);
      start += batchSize;

      if (this.limit && allActivities.length >= this.limit) {
        return allActivities.slice(0, this.limit);
      }

      // Small delay
      await this._sleep(500);
    }

    return allActivities;
  }

  async _syncActivity(activityMeta, tempDir) {
    const activityId = activityMeta.activityId;
    const activityName = activityMeta.activityName || 'Unknown';

    // 优先从 .cache/fit 读取，避免重复拉取
    const cachePath = path.join(FIT_CACHE_DIR, String(activityId));
    let rawData = null;
    let fromCache = false;
    try {
      rawData = await fs.readFile(cachePath);
      fromCache = true;
    } catch {
      // 缓存未命中，从 Garmin 下载
      rawData = await this.client.downloadFitFile(activityId);
      if (rawData) {
        await fs.writeFile(cachePath, Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData));
      }
    }
    if (!rawData) {
      return { success: false };
    }

    // Garmin 可能返回 ZIP 或裸 FIT，统一处理
    let fitData = rawData;
    if (isZip(fitData)) {
      const extracted = await extractFitFromZip(fitData);
      if (!extracted) return { success: false };
      fitData = extracted;
    }

    // Save to temp file
    const fitFilePath = path.join(tempDir, `${activityId}.fit`);
    await fs.writeFile(fitFilePath, Buffer.isBuffer(fitData) ? fitData : Buffer.from(fitData));

    // Parse FIT file
    const { activity: activityData, laps: lapsData } = await this.fitParser.parseFitFile(fitFilePath);

    if (!activityData) {
      return { success: false };
    }

    // 过滤没有心率的数据（不同步）
    const hasHeartRate = activityData.average_heart_rate != null && Number(activityData.average_heart_rate) > 0;
    if (!hasHeartRate) {
      await fs.unlink(fitFilePath).catch(() => {});
      return { success: false, skipped: true, reason: 'no_heart_rate' };
    }

    // Add activity metadata
    activityData.activity_id = activityId;
    activityData.name = activityName;
    activityData.activity_type = activityMeta.activityType?.typeKey || 'running';

    // Calculate VDOT if possible
    if (this.vdotCalculator && activityData.average_heart_rate) {
      const vdot = this.vdotCalculator.calculateVdotFromPace(
        (activityData.distance || 0) * 1000,  // Convert km to meters
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

    // Save to database
    this.db.upsertActivity(activityData);

    // Save laps if enabled
    if (this.withLaps && lapsData.length > 0) {
      // Add activity_id to each lap
      const lapsWithId = lapsData.map(lap => ({
        ...lap,
        activity_id: activityId
      }));

      this.db.insertLaps(activityId, lapsWithId);
    }

    // Cleanup temp file
    await fs.unlink(fitFilePath);

    return { success: true, fromCache };
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options = {
    onlyRunning: !args.includes('--all-types'),
    withLaps: !args.includes('--no-laps'),
    limit: null,
    dbPath: 'data/activities.db'
  };

  // Parse limit
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    options.limit = parseInt(args[limitIndex + 1]);
  }

  // Parse db path
  const dbIndex = args.indexOf('--db');
  if (dbIndex !== -1 && args[dbIndex + 1]) {
    options.dbPath = args[dbIndex + 1];
  }

  try {
    const sync = new GarminSync(options);
    const result = await sync.syncAll();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    log(`\nFatal error: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = GarminSync;

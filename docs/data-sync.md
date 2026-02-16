# 数据同步说明

本文档详细介绍 Garmin 数据同步的原理、配置和使用方法。

## 目录

- [同步原理](#同步原理)
- [数据流程](#数据流程)
- [配置方法](#配置方法)
- [使用方法](#使用方法)
- [数据结构](#数据结构)
- [常见问题](#常见问题)

---

## 同步原理

### 数据来源

本项目从 **Garmin Connect 国际区** 同步运动数据。Garmin Connect 提供了以下数据：

1. **活动列表 API**: 获取所有活动的元数据（ID、日期、距离、时间等）
2. **FIT 文件 API**: 下载每个活动的原始 FIT 文件（包含详细的记录点数据）

### FIT 文件格式

FIT (Flexible and Interoperable Data Transfer) 是 Garmin 设备使用的二进制数据格式，包含：

- **会话数据 (Session)**: 活动的汇总信息（总距离、总时间、平均心率等）
- **分段数据 (Laps)**: 按公里或手动分段的数据
- **记录点数据 (Records)**: 每秒或每隔几秒的详细数据（GPS、心率、配速等）

### 数据解析

项目使用 `fit-file-parser` 库解析 FIT 文件，提取以下 **28+ 字段**：

#### 活动级别字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `activity_id` | 活动 ID | `14234567890` |
| `activity_name` | 活动名称 | `晨跑 10K` |
| `start_time` | 开始时间 | `2026-02-13 06:30:00` |
| `sport` | 运动类型 | `跑步` |
| `sub_sport` | 子类型 | `路跑` / `跑步机` / `越野` |
| `total_distance` | 总距离 (米) | `10000` |
| `total_timer_time` | 总用时 (秒) | `3000` |
| `total_elapsed_time` | 总经过时间 (秒) | `3010` |
| `avg_speed` | 平均速度 (m/s) | `3.33` |
| `max_speed` | 最大速度 (m/s) | `4.5` |
| `avg_heart_rate` | 平均心率 (bpm) | `150` |
| `max_heart_rate` | 最大心率 (bpm) | `175` |
| `total_calories` | 总卡路里 (kcal) | `500` |
| `avg_cadence` | 平均步频 (spm) | `170` |
| `max_cadence` | 最大步频 (spm) | `185` |
| `total_ascent` | 总爬升 (米) | `120` |
| `total_descent` | 总下降 (米) | `110` |
| `avg_stride_length` | 平均步幅 (米) | `1.18` |
| `training_effect` | 训练效果 | `3.5` |
| `vdot` | VDOT 跑力值 | `52.3` |

#### 分段级别字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `lap_index` | 分段索引 | `1` |
| `start_time` | 分段开始时间 | `2026-02-13 06:30:00` |
| `total_distance` | 分段距离 (米) | `1000` |
| `total_timer_time` | 分段用时 (秒) | `300` |
| `avg_speed` | 平均速度 (m/s) | `3.33` |
| `avg_heart_rate` | 平均心率 (bpm) | `150` |
| `avg_cadence` | 平均步频 (spm) | `170` |
| `total_ascent` | 分段爬升 (米) | `15` |

### VDOT 计算

VDOT (V̇O2max) 是由 Jack Daniels 提出的跑力指标，基于跑步成绩和心率计算。

计算公式：

```
1. 计算速度 (m/min):
   velocity = distance (meters) / duration (minutes)

2. 计算 VO2max:
   VO2max = -4.60 + 0.182258 * velocity + 0.000104 * velocity²

3. 计算能量消耗比例:
   energy_percent = 0.8 + 0.1894393 * e^(-0.012778 * duration_minutes) + 0.2989558 * e^(-0.1932605 * duration_minutes)

4. 计算 VDOT:
   VDOT = VO2max / energy_percent

5. 心率校准 (可选):
   如果提供了 MAX_HR 和 RESTING_HR，会根据心率储备百分比进行校准
```

详细公式推导请参考 [VDOT 计算说明](vdot-calculation.md)。

---

## 数据流程

```
┌────────────────────────────────────────────────────────────────┐
│                        数据同步流程                              │
└────────────────────────────────────────────────────────────────┘

1. 获取活动列表
   ↓
   Garmin Connect API
   GET /activitylist-service/activities/search/activities
   ↓
   返回最近 N 条活动的元数据
   [{activityId, activityName, startTimeLocal, distance, ...}]

2. 下载 FIT 文件
   ↓
   对于每个活动，检查本地是否已存在
   ↓
   如果不存在，下载 FIT 文件
   GET /download-service/files/activity/{activityId}
   ↓
   保存到 .cache/fit/{activityId}.fit

3. 解析 FIT 文件
   ↓
   使用 fit-file-parser 解析 FIT 文件
   ↓
   提取 Session 数据 (活动汇总)
   提取 Lap 数据 (分段信息)
   提取 Record 数据 (记录点)

4. 计算 VDOT
   ↓
   根据距离、时间、心率计算 VDOT
   ↓
   支持心率校准 (基于 MAX_HR 和 RESTING_HR)

5. 存储到数据库
   ↓
   写入 activities 表 (活动汇总)
   写入 laps 表 (分段数据)
   写入 records 表 (记录点数据)
   ↓
   SQLite 数据库 (app/data/activities.db)

6. 预计算统计缓存
   ↓
   计算心率区间分布 (hr_zones 表)
   计算 VDOT 趋势 (vdot_trend 表)
   ↓
   加速 API 查询速度

7. 提交到 Git
   ↓
   git add app/data/activities.db
   git commit -m "chore: update garmin data YYYY-MM-DD"
   git push
   ↓
   触发 Vercel 自动部署
```

---

## 配置方法

### 1. 获取 Garmin Token

运行以下命令获取认证 Token：

```bash
python3 scripts/get_garmin_token.py
```

脚本会从 .env 读取 `GARMIN_EMAIL`/`GARMIN_PASSWORD`（未配置时按提示输入），并输出 `GARMIN_SECRET_STRING`。

**原理**:

1. 使用 Garmin OAuth2 流程获取 OAuth1 和 OAuth2 令牌
2. 将令牌序列化为 Base64 编码的 JSON 字符串
3. 此 Token 可长期使用，除非密码更改

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# Garmin 认证
GARMIN_SECRET_STRING="eyJhbGci...很长的字符串"

# 心率参数
MAX_HR=190        # 最大心率
RESTING_HR=55     # 静息心率
```

### 3. 配置 GitHub Secrets

在 GitHub 仓库的 **Settings > Secrets > Actions** 中添加：

- `GARMIN_SECRET_STRING`
- `MAX_HR`
- `RESTING_HR`

---

## 使用方法

### 本地同步

#### 初次同步所有历史数据

```bash
npm run init:data
```

这会同步所有历史活动，并自动处理增量更新。

#### 手动同步

```bash
# 同步最近 10 条活动
node scripts/sync-garmin.js --limit 10

# 同步所有新活动 (增量同步)
node scripts/sync-garmin.js

# 强制重新解析所有活动
node scripts/sync-garmin.js --force
```

#### 更新统计缓存

```bash
# 更新心率区间和 VDOT 趋势
node scripts/preprocess-stats-cache.js --mode full --clear
```

### GitHub Actions 自动同步

配置完成后，GitHub Actions 会：

- **每日自动运行** (UTC 00:00)
- **推送到 main 分支时运行** (排除仅 DB 变更)
- **支持手动触发** (Actions 页面点击 Run workflow)

同步完成后，会自动提交数据库并推送到 GitHub，触发 Vercel 重新部署。

---

## 数据结构

### 数据库表结构

#### activities 表

存储活动汇总数据。

```sql
CREATE TABLE activities (
  activity_id INTEGER PRIMARY KEY,
  activity_name TEXT,
  start_time TEXT,
  sport TEXT,
  sub_sport TEXT,
  total_distance REAL,
  total_timer_time REAL,
  total_elapsed_time REAL,
  avg_speed REAL,
  max_speed REAL,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  total_calories INTEGER,
  avg_cadence INTEGER,
  max_cadence INTEGER,
  total_ascent REAL,
  total_descent REAL,
  avg_stride_length REAL,
  training_effect REAL,
  vdot REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### laps 表

存储分段数据。

```sql
CREATE TABLE laps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER,
  lap_index INTEGER,
  start_time TEXT,
  total_distance REAL,
  total_timer_time REAL,
  avg_speed REAL,
  avg_heart_rate INTEGER,
  avg_cadence INTEGER,
  max_cadence INTEGER,
  total_ascent REAL,
  total_descent REAL,
  FOREIGN KEY (activity_id) REFERENCES activities(activity_id)
);
```

#### records 表

存储记录点数据（每秒或每几秒一条）。

```sql
CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER,
  timestamp TEXT,
  distance REAL,
  speed REAL,
  heart_rate INTEGER,
  cadence INTEGER,
  altitude REAL,
  position_lat REAL,
  position_long REAL,
  FOREIGN KEY (activity_id) REFERENCES activities(activity_id)
);
```

#### hr_zones 表 (统计缓存)

存储心率区间分布数据。

```sql
CREATE TABLE hr_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER,
  zone_1_time INTEGER,  -- 有氧基础区
  zone_2_time INTEGER,  -- 有氧耐力区
  zone_3_time INTEGER,  -- 乳酸阈值区
  zone_4_time INTEGER,  -- 无氧区
  zone_5_time INTEGER,  -- 最大区
  FOREIGN KEY (activity_id) REFERENCES activities(activity_id)
);
```

#### vdot_trend 表 (统计缓存)

存储 VDOT 趋势数据。

```sql
CREATE TABLE vdot_trend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  vdot REAL,
  activity_id INTEGER,
  FOREIGN KEY (activity_id) REFERENCES activities(activity_id)
);
```

---

## 常见问题

### Q1: 同步失败，提示 "Garmin authentication failed"

**原因**: Token 过期或配置错误。

**解决方案**:

```bash
# 重新获取 Token
python3 scripts/get_garmin_token.py

# 更新 .env 和 GitHub Secrets
```

### Q2: 某些活动没有 VDOT 数据

**原因**: VDOT 计算需要距离 > 1000 米且心率数据有效。

**解决方案**:

- 确保 Garmin 设备在跑步时记录了心率数据
- 短距离活动 (<1000m) 不计算 VDOT

### Q3: 同步速度很慢

**原因**: 需要下载大量 FIT 文件。

**优化方案**:

- 首次同步使用 `--limit` 限制数量
- FIT 文件会缓存在 `.cache/fit/` 目录，避免重复下载
- GitHub Actions 每日增量同步，不会重复下载已有数据

### Q4: 数据库文件变大怎么办？

**方案**:

```bash
# 清理旧数据 (保留最近 1 年)
node scripts/db-manager.js --clean --keep-days 365

# 压缩数据库
node scripts/db-manager.js --vacuum
```

### Q5: 如何导出数据？

```bash
# 导出为 CSV
sqlite3 app/data/activities.db "SELECT * FROM activities" -csv > activities.csv

# 导出为 JSON
sqlite3 app/data/activities.db "SELECT json_group_array(json_object('id', activity_id, 'name', activity_name)) FROM activities" > activities.json
```

### Q6: 支持其他运动类型吗？

目前主要针对跑步进行优化，但理论上支持所有 Garmin 记录的运动类型。

可以在 `scripts/sync-garmin.js` 中修改过滤条件：

```javascript
// 当前仅同步跑步
const SPORT_FILTER = ['running'];

// 修改为支持多种运动
const SPORT_FILTER = ['running', 'cycling', 'swimming'];
```

---

## 下一步

- 查看 [部署指南](deployment.md) 了解如何部署到 Vercel
- 查看 [API 参考](api-reference.md) 了解如何使用 API
- 查看 [VDOT 计算说明](vdot-calculation.md) 了解跑力计算原理

---

如有其他问题，请在 [GitHub Issues](https://github.com/your-username/garmin_data/issues) 中提出。

/**
 * TypeScript type definitions for Garmin activities data.
 */

export interface Activity {
  // 基础信息
  activity_id: number;                           // 活动ID（主键）
  name: string;                                  // 活动名称
  activity_type: string;                         // 活动类型（默认：跑步）
  start_time: string;                            // 开始时间（UTC）
  start_time_local: string;                      // 开始时间（本地时区）

  // 基础指标
  distance: number;                              // 距离（米）
  duration: number;                              // 总时长（秒）
  moving_time: number;                           // 移动时间（秒）
  elapsed_time: number;                          // 经过时间（秒）

  // 配速和速度
  average_pace?: number;                         // 平均配速（秒/公里）
  average_speed?: number;                        // 平均速度（公里/小时）
  max_speed?: number;                            // 最大速度（米/秒）

  // 心率数据
  average_heart_rate?: number;                   // 平均心率（bpm）
  max_heart_rate?: number;                       // 最大心率（bpm）

  // 跑步动态数据
  average_cadence?: number;                      // 平均步频（步/分钟）
  max_cadence?: number;                          // 最大步频（步/分钟）
  average_stride_length?: number;                // 平均步幅（米）
  average_vertical_oscillation?: number;         // 平均垂直摆动（厘米）
  average_vertical_ratio?: number;               // 平均垂直步幅比（%）
  average_ground_contact_time?: number;          // 平均触地时间（毫秒）
  average_gct_balance?: number;                  // 平均触地时间平衡（%）
  average_step_rate_loss?: number;               // 平均步速损失（厘米/秒）
  average_step_rate_loss_percent?: number;       // 平均步速损失百分比（%）

  // 功率数据
  average_power?: number;                        // 平均功率（瓦）
  max_power?: number;                            // 最大功率（瓦）
  average_power_to_weight?: number;              // 平均功率体重比（瓦/公斤）
  max_power_to_weight?: number;                  // 最大功率体重比（瓦/公斤）

  // 爬升数据
  total_ascent?: number;                         // 累计爬升（米）
  total_descent?: number;                        // 累计下降（米）

  // 其他
  calories?: number;                             // 热量消耗（卡路里）
  average_temperature?: number;                  // 平均温度（摄氏度）

  // VDOT 跑力值
  vdot_value?: number;                           // VDOT 跑力值
  training_load?: number;                        // 训练负荷

  // 元数据
  created_at: string;                            // 创建时间
  updated_at: string;                            // 更新时间
}

export interface ActivityLap {
  id: number;                                    // 分段ID（主键，自增）
  activity_id: number;                           // 活动ID（外键）
  lap_index: number;                             // 分段编号

  // 时间数据
  duration: number;                              // 分段时长（秒）
  cumulative_time: number;                       // 累积时间（秒）
  moving_time?: number;                          // 移动时间（秒）

  // 距离和配速
  distance: number;                              // 分段距离（米）
  average_pace?: number;                         // 平均配速（秒/公里）
  average_pace_gap?: number;                     // 平均坡度调整配速（秒/公里）
  best_pace?: number;                            // 最佳配速（秒/公里）
  average_speed?: number;                        // 平均速度（公里/小时）
  average_moving_pace?: number;                  // 平均移动配速（秒/公里）

  // 心率
  average_heart_rate?: number;                   // 平均心率（bpm）
  max_heart_rate?: number;                       // 最大心率（bpm）

  // 爬升
  total_ascent?: number;                         // 累计爬升（米）
  total_descent?: number;                        // 累计下降（米）

  // 功率
  average_power?: number;                        // 平均功率（瓦）
  average_power_to_weight?: number;              // 平均功率体重比（瓦/公斤）
  max_power?: number;                            // 最大功率（瓦）
  max_power_to_weight?: number;                  // 最大功率体重比（瓦/公斤）

  // 跑步动态
  average_cadence?: number;                      // 平均步频（步/分钟）
  max_cadence?: number;                          // 最大步频（步/分钟）
  average_stride_length?: number;                // 平均步幅（米）
  average_ground_contact_time?: number;          // 平均触地时间（毫秒）
  average_gct_balance?: number;                  // 平均触地时间平衡（%）
  average_vertical_oscillation?: number;         // 平均垂直摆动（厘米）
  average_vertical_ratio?: number;               // 平均垂直步幅比（%）
  average_step_rate_loss?: number;               // 平均步速损失（厘米/秒）
  average_step_rate_loss_percent?: number;       // 平均步速损失百分比（%）

  // 其他
  calories?: number;                             // 热量消耗（卡路里）
  average_temperature?: number;                  // 平均温度（摄氏度）
}

export interface ActivityQueryParams {
  page?: number;                                 // 页码
  limit?: number;                                // 每页数量
  type?: string;                                 // 活动类型过滤
  startDate?: string;                            // 开始日期
  endDate?: string;                              // 结束日期
}

export interface PaginatedResponse<T> {
  data: T[];                                     // 数据列表
  pagination: {
    page: number;                                // 当前页码
    limit: number;                               // 每页数量
    total: number;                               // 总数量
  };
}

export interface StatsResponse {
  totalDistance: number;                         // 总距离（米）
  totalDuration: number;                         // 总时长（秒）
  totalActivities: number;                       // 活动总数
  averagePace?: number;                          // 平均配速（秒/公里）
  averageHeartRate?: number;                     // 平均心率（bpm）
  totalAscent?: number;                          // 总爬升（米）
  averageVDOT?: number;                          // 平均 VDOT 跑力值
}

export interface VDOTDataPoint {
  activity_id: number;                           // 活动ID
  start_time: string;                            // 开始时间
  vdot_value: number;                            // VDOT 跑力值
  distance: number;                              // 距离（米）
  duration: number;                              // 时长（秒）
}

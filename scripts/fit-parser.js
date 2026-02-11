/**
 * FIT file parser for Garmin activities (binary .fit from Garmin Connect)
 */

const FitParser = require('fit-file-parser').default;
const fs = require('fs').promises;

class GarminFITParser {
  constructor() {
    // FitParser is initialized per file
  }

  /**
   * Parse FIT file and extract activity and lap data
   */
  async parseFitFile(fitFilePath) {
    try {
      // Read file buffer (binary .fit)
      const buffer = await fs.readFile(fitFilePath);

      const parser = new FitParser({
        force: true,
        speedUnit: 'km/h',
        lengthUnit: 'km',
        temperatureUnit: 'celsius',
        elapsedRecordField: true,
        mode: 'both'
      });

      const fitData = await parser.parseAsync(buffer);

      if (!fitData || !fitData.activity) {
        return { activity: null, laps: [] };
      }

      // Extract activity data
      const activityData = this._extractActivityData(fitData);

      // Extract lap data
      const lapsData = this._extractLapsData(fitData);

      return { activity: activityData, laps: lapsData };
    } catch (error) {
      const msg = error && typeof error === 'object' && error.message != null ? error.message : String(error);
      console.error(`Error parsing FIT file ${fitFilePath}:`, msg);
      return { activity: null, laps: [] };
    }
  }

  _extractActivityData(fitData) {
    // Get session data (activity summary)
    const sessions = fitData.sessions || [];
    if (sessions.length === 0) return null;

    const session = sessions[0];

    const activityData = {
      start_time: this._convertTimestamp(session.start_time),
      start_time_local: this._convertTimestamp(session.timestamp),
      distance: this._safeGetFloat(session, 'total_distance'),
      duration: this._safeGetInt(session, 'total_elapsed_time'),
      moving_time: this._safeGetInt(session, 'total_timer_time'),
      elapsed_time: this._safeGetInt(session, 'total_elapsed_time'),
    };

    // Calculate pace and speed (fit-file-parser with lengthUnit 'km' gives distance in km)
    const distance = activityData.distance;
    const duration = activityData.duration;
    if (distance != null && duration && duration > 0 && distance > 0) {
      activityData.average_speed = (distance * 1000) / duration; // m/s
      activityData.average_pace = duration / distance; // sec/km
    }

    // Heart rate
    activityData.average_heart_rate = this._safeGetInt(session, 'avg_heart_rate');
    activityData.max_heart_rate = this._safeGetInt(session, 'max_heart_rate');

    // Speed
    activityData.max_speed = this._safeGetFloat(session, 'max_speed');

    // Cadence (convert to steps per minute if needed)
    const avgCadence = this._safeGetInt(session, 'avg_cadence');
    if (avgCadence) {
      activityData.average_cadence = avgCadence * 2;
    }

    const maxCadence = this._safeGetInt(session, 'max_cadence');
    if (maxCadence) {
      activityData.max_cadence = maxCadence * 2;
    }

    // Running dynamics (FIT data is in mm, convert to meters)
    const stepLength = this._safeGetFloat(session, 'avg_step_length') ?? this._safeGetFloat(session, 'avg_stride_length');
    if (stepLength) {
      activityData.average_stride_length = stepLength / 1000;
    }

    // Vertical oscillation (FIT data is in mm, convert to cm)
    const vo = this._safeGetFloat(session, 'avg_vertical_oscillation');
    if (vo) {
      activityData.average_vertical_oscillation = vo / 10;
    }

    activityData.average_vertical_ratio = this._safeGetFloat(session, 'avg_vertical_ratio');

    // Ground contact time (fit-file-parser may use avg_stance_time)
    const gct = this._safeGetFloat(session, 'avg_ground_contact_time') ?? this._safeGetFloat(session, 'avg_stance_time');
    if (gct) {
      activityData.average_ground_contact_time = gct;
    }

    activityData.average_gct_balance = this._safeGetFloat(session, 'avg_gct_balance') ?? this._safeGetFloat(session, 'avg_stance_time_balance');
    activityData.average_step_rate_loss = this._safeGetFloat(session, 'avg_step_rate_loss');
    activityData.average_step_rate_loss_percent = this._safeGetFloat(session, 'avg_step_rate_loss_percent');

    // Power
    activityData.average_power = this._safeGetInt(session, 'avg_power');
    activityData.max_power = this._safeGetInt(session, 'max_power');
    activityData.average_power_to_weight = this._safeGetFloat(session, 'avg_power_to_weight');
    activityData.max_power_to_weight = this._safeGetFloat(session, 'max_power_to_weight');

    // Elevation
    activityData.total_ascent = this._safeGetFloat(session, 'total_ascent');
    activityData.total_descent = this._safeGetFloat(session, 'total_descent');

    // Other
    activityData.calories = this._safeGetInt(session, 'total_calories');
    activityData.average_temperature = this._safeGetFloat(session, 'avg_temperature');

    return activityData;
  }

  _extractLapsData(fitData) {
    const laps = fitData.laps || [];
    const lapsData = [];
    let cumulativeTime = 0;

    for (let lapIndex = 0; lapIndex < laps.length; lapIndex++) {
      const lap = laps[lapIndex];

      const lapData = {
        lap_index: lapIndex,
        duration: this._safeGetInt(lap, 'total_elapsed_time'),
        distance: this._safeGetFloat(lap, 'total_distance'),
      };

      // Cumulative time
      cumulativeTime += lapData.duration || 0;
      lapData.cumulative_time = cumulativeTime;

      // Moving time
      lapData.moving_time = this._safeGetInt(lap, 'total_timer_time');

      // Calculate pace and speed (distance in km from fit-file-parser)
      const distance = lapData.distance;
      const duration = lapData.duration;
      if (distance != null && duration && duration > 0 && distance > 0) {
        lapData.average_speed = (distance / duration) * 3600; // km/h (distance in km, duration in seconds)
        lapData.average_pace = duration / distance; // sec/km
      }

      // Pace variations
      lapData.average_pace_gap = this._safeGetFloat(lap, 'avg_pace_gap');
      lapData.best_pace = this._safeGetFloat(lap, 'best_lap_time');

      const movingTime = lapData.moving_time;
      if (distance != null && movingTime && movingTime > 0 && distance > 0) {
        lapData.average_moving_pace = movingTime / distance; // sec/km
      }

      // Heart rate
      lapData.average_heart_rate = this._safeGetInt(lap, 'avg_heart_rate');
      lapData.max_heart_rate = this._safeGetInt(lap, 'max_heart_rate');

      // Elevation
      lapData.total_ascent = this._safeGetFloat(lap, 'total_ascent');
      lapData.total_descent = this._safeGetFloat(lap, 'total_descent');

      // Power
      lapData.average_power = this._safeGetInt(lap, 'avg_power');
      lapData.average_power_to_weight = this._safeGetFloat(lap, 'avg_power_to_weight');
      lapData.max_power = this._safeGetInt(lap, 'max_power');
      lapData.max_power_to_weight = this._safeGetFloat(lap, 'max_power_to_weight');

      // Cadence
      const avgCadence = this._safeGetInt(lap, 'avg_cadence');
      if (avgCadence) {
        lapData.average_cadence = avgCadence * 2;
      }

      const maxCadence = this._safeGetInt(lap, 'max_cadence');
      if (maxCadence) {
        lapData.max_cadence = maxCadence * 2;
      }

      // Running dynamics (FIT data is in mm, convert to meters)
      const stepLength = this._safeGetFloat(lap, 'avg_step_length') ?? this._safeGetFloat(lap, 'avg_stride_length');
      if (stepLength) {
        lapData.average_stride_length = stepLength / 1000;
      }

      const gct = this._safeGetFloat(lap, 'avg_ground_contact_time') ?? this._safeGetFloat(lap, 'avg_stance_time');
      if (gct) {
        lapData.average_ground_contact_time = gct;
      }

      lapData.average_gct_balance = this._safeGetFloat(lap, 'avg_gct_balance') ?? this._safeGetFloat(lap, 'avg_stance_time_balance');

      const vo = this._safeGetFloat(lap, 'avg_vertical_oscillation');
      if (vo) {
        lapData.average_vertical_oscillation = vo / 10;
      }

      lapData.average_vertical_ratio = this._safeGetFloat(lap, 'avg_vertical_ratio');
      lapData.average_step_rate_loss = this._safeGetFloat(lap, 'avg_step_rate_loss');
      lapData.average_step_rate_loss_percent = this._safeGetFloat(lap, 'avg_step_rate_loss_percent');

      // Other
      lapData.calories = this._safeGetInt(lap, 'total_calories');
      lapData.average_temperature = this._safeGetFloat(lap, 'avg_temperature');

      lapsData.push(lapData);
    }

    return lapsData;
  }

  _convertTimestamp(timestamp) {
    if (!timestamp) return null;
    try {
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }
      return new Date(timestamp).toISOString();
    } catch (error) {
      return null;
    }
  }

  _safeGetFloat(data, key) {
    const value = data[key];
    if (value === null || value === undefined) return null;
    try {
      return parseFloat(value);
    } catch (error) {
      return null;
    }
  }

  _safeGetInt(data, key) {
    const value = data[key];
    if (value === null || value === undefined) return null;
    try {
      return parseInt(value);
    } catch (error) {
      return null;
    }
  }
}

module.exports = GarminFITParser;

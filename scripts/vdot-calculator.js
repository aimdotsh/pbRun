/**
 * VDOT calculator based on heart rate zones
 */

class VDOTCalculator {
  constructor(maxHr, restingHr) {
    this.maxHr = maxHr;
    this.restingHr = restingHr;
    this.hrReserve = maxHr - restingHr;
  }

  /**
   * Get heart rate zone (1-5) based on percentage of max HR
   */
  getHrZone(avgHr) {
    if (avgHr <= 0) return 0;

    const hrPercent = (avgHr / this.maxHr) * 100;

    if (hrPercent < 70) return 1;      // Zone 1: <70% (轻松跑)
    if (hrPercent < 80) return 2;      // Zone 2: 70-80% (有氧基础)
    if (hrPercent < 87) return 3;      // Zone 3: 80-87% (节奏跑)
    if (hrPercent < 93) return 4;      // Zone 4: 87-93% (乳酸阈)
    return 5;                          // Zone 5: >93% (最大摄氧量)
  }

  /**
   * Calculate VDOT using Daniels Running Formula
   */
  calculateVdotFromPace(distanceMeters, durationSeconds, avgHr = null) {
    if (durationSeconds <= 0 || distanceMeters <= 0) {
      return null;
    }

    // Convert to km and hours
    const distanceKm = distanceMeters / 1000;
    const durationHours = durationSeconds / 3600;

    // Velocity in km/h
    const velocity = distanceKm / durationHours;

    if (velocity <= 0) return null;

    // Calculate VO2max using Daniels formula
    const vo2max = -4.60 + 0.182258 * velocity + 0.000104 * (velocity ** 2);

    // Calculate percent of VO2max based on distance
    const percentVo2max = 1 - Math.exp(-0.012 * (distanceKm / velocity));

    if (percentVo2max <= 0) return null;

    // Calculate base VDOT
    let vdot = vo2max / percentVo2max;

    // Adjust VDOT based on heart rate zone if available
    if (avgHr && avgHr > 0) {
      const hrZone = this.getHrZone(avgHr);

      // Zone multipliers (higher zones indicate better fitness)
      const zoneMultipliers = {
        1: 0.90,  // Easy run - lower intensity
        2: 0.95,  // Aerobic base
        3: 1.00,  // Tempo run - baseline
        4: 1.05,  // Lactate threshold - higher quality
        5: 1.10   // VO2max - highest quality
      };

      const multiplier = zoneMultipliers[hrZone] || 1.0;
      vdot *= multiplier;
    }

    return Math.round(vdot * 10) / 10;
  }

  /**
   * Calculate training load based on duration and heart rate
   */
  calculateTrainingLoad(durationSeconds, avgHr = null) {
    if (durationSeconds <= 0) return 0;

    const durationHours = durationSeconds / 3600;

    // Base load from duration
    let baseLoad = durationHours * 100;

    // Adjust by HR zone if available
    if (avgHr && avgHr > 0) {
      const hrZone = this.getHrZone(avgHr);

      // Zone factors for training load
      const zoneFactors = {
        1: 0.6,   // Easy recovery
        2: 0.8,   // Aerobic base
        3: 1.0,   // Tempo
        4: 1.3,   // Threshold
        5: 1.5    // VO2max
      };

      const factor = zoneFactors[hrZone] || 1.0;
      baseLoad *= factor;
    }

    return Math.round(baseLoad);
  }

  /**
   * Analyze heart rate distribution across zones
   */
  analyzeHrDistribution(hrRecords) {
    if (!hrRecords || hrRecords.length === 0) {
      return {};
    }

    const zoneCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const hr of hrRecords) {
      if (hr > 0) {
        const zone = this.getHrZone(hr);
        if (zone in zoneCounts) {
          zoneCounts[zone]++;
        }
      }
    }

    const total = Object.values(zoneCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return {};

    const distribution = {};
    for (const [zone, count] of Object.entries(zoneCounts)) {
      distribution[`zone_${zone}`] = (count / total) * 100;
    }

    return distribution;
  }
}

module.exports = VDOTCalculator;

export interface EstimateObservation {
  estimatedMinutes: number;
  actualMinutes: number;
  occurredAt: Date;
  atypical?: boolean;
}

export interface EstimateLearningResult {
  sampleCount: number;
  medianRatio: number | null;
  meanRatio: number | null;
  multiplier: number;
  confidence: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Conservative, deterministic starting point from the learning policy:
 * - ignore marked atypical observations
 * - do not automatically adapt before 3 useful samples
 * - use robust median as the primary signal
 * - clamp automatic adjustment so one context cannot explode future estimates
 */
export function deriveEstimateLearning(observations: EstimateObservation[]): EstimateLearningResult {
  const usable = observations.filter(
    (item) => !item.atypical && item.estimatedMinutes > 0 && item.actualMinutes > 0,
  );
  if (usable.length === 0) {
    return { sampleCount: 0, medianRatio: null, meanRatio: null, multiplier: 1, confidence: 0 };
  }
  const ratios = usable.map((item) => item.actualMinutes / item.estimatedMinutes);
  const med = median(ratios);
  const mean = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  const confidence = usable.length < 3 ? 0 : usable.length <= 5 ? 0.3 : usable.length <= 10 ? 0.6 : 0.8;
  const rawMultiplier = usable.length < 3 ? 1 : med;
  const multiplier = Math.max(0.75, Math.min(1.5, rawMultiplier));
  return { sampleCount: usable.length, medianRatio: med, meanRatio: mean, multiplier, confidence };
}

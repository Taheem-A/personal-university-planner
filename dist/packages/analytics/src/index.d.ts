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
/**
 * Conservative, deterministic starting point from the learning policy:
 * - ignore marked atypical observations
 * - do not automatically adapt before 3 useful samples
 * - use robust median as the primary signal
 * - clamp automatic adjustment so one context cannot explode future estimates
 */
export declare function deriveEstimateLearning(observations: EstimateObservation[]): EstimateLearningResult;

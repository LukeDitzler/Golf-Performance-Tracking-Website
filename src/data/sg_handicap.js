// Per-handicap baselines derived by scaling Tour baseline.
// Scale factors anchored to Broadie / Shot Scope / Pinpoint published data.
export const HCP_BANDS = [0, 5, 10, 15, 20, 28];

export const SCALE_FACTORS = {
  fairway:  [1.00, 1.22, 1.42, 1.60, 1.78, 2.05],
  rough:    [1.00, 1.30, 1.55, 1.80, 2.05, 2.40],
  sand:     [1.00, 1.35, 1.65, 1.95, 2.25, 2.65],
  recovery: [1.00, 1.40, 1.75, 2.10, 2.45, 2.90],
  tee:      [1.00, 1.18, 1.35, 1.52, 1.68, 1.92],
  green:    [1.00, 1.08, 1.16, 1.24, 1.32, 1.45],
};
// Note: the calculator interpolates between bands for fractional handicaps.
// You do not need the full pre-computed table — the calculator derives it at runtime.
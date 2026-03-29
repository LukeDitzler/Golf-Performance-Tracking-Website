/**
 * sg_calculator.js — Strokes Gained utility for Fairway Caddie
 *
 * METHODOLOGY
 * ───────────
 * Off-green expected strokes: looked up from SG_TOUR table, interpolated between
 *   the two nearest sampled distances. Fitted to Mark Broadie's Table 5.2 anchor
 *   points from "Every Shot Counts".
 *
 * Putting expected strokes: E_tour(ft) = 1 + exp(−0.011 × ft + 0.14)
 *   Fitted to PGA Tour ShotLink putting make-rate data. Applied directly rather
 *   than via lookup table for smooth sub-foot interpolation.
 *
 * Handicap scaling: E_hcp(d, lie, hcp) = E_tour(d, lie) × scale(lie, hcp)
 *   Scale factors anchored to:
 *     - Tour = 1.0 by definition
 *     - Pinpoint Golf published 15-hcp expected strokes table
 *     - Shot Scope 80M-shot database benchmarks for 10 and 20-hcp bands
 *     - Broadie's amateur examples from "Every Shot Counts"
 *   Linear interpolation between anchor bands for fractional handicaps.
 *
 * FORMULA (per shot)
 * ──────────────────
 *   SG = E_start − E_end − 1
 *   (if end = holed, E_end = 0)
 *
 * USAGE
 * ─────
 *   import { getExpected, calcSG, calcRoundSG } from './sg_calculator';
 *
 *   // Expected strokes for a specific lie, distance, and handicap benchmark
 *   const expected = getExpected({ distYards: 150, lie: 'fairway', benchmarkHcp: 15 });
 *
 *   // SG for a single shot
 *   const sg = calcSG({
 *     startDistYards: 150, startLie: 'fairway',
 *     endDistYards: 20,   endLie: 'rough',
 *     benchmarkHcp: 15
 *   });
 *
 *   // Full round SG breakdown from a Fairway Caddie round object
 *   const breakdown = calcRoundSG(round, benchmarkHcp);
 */

import { SG_TOUR } from './data/sg_tour.js';
import { HCP_BANDS, SCALE_FACTORS } from './data/sg_handicap.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Interpolate a scale factor for any fractional handicap between bands.
 * @param {string} lie
 * @param {number} hcp
 * @returns {number}
 */
function interpolateScale(lie, hcp) {
  // SCALE_FACTORS keys match lie names; fall back to fairway for unknown lies
  const factors = SCALE_FACTORS[lie] ?? SCALE_FACTORS.fairway;
  const clampedHcp = Math.max(0, Math.min(hcp, HCP_BANDS[HCP_BANDS.length - 1]));

  for (let i = 0; i < HCP_BANDS.length - 1; i++) {
    if (clampedHcp <= HCP_BANDS[i + 1]) {
      const t = (clampedHcp - HCP_BANDS[i]) / (HCP_BANDS[i + 1] - HCP_BANDS[i]);
      return factors[i] + t * (factors[i + 1] - factors[i]);
    }
  }
  return factors[factors.length - 1];
}

/**
 * Look up Tour expected strokes from the SG_TOUR table, interpolating linearly
 * between the two nearest sampled distances.
 * @param {number} distYards
 * @param {string} lie  - 'fairway'|'rough'|'sand'|'recovery'|'tee'
 * @returns {number}
 */
function tourExpectedOffGreen(distYards, lie) {
  const table = SG_TOUR.off_green[lie] ?? SG_TOUR.off_green.fairway;
  const distances = Object.keys(table).map(Number).sort((a, b) => a - b);
  const d = Math.max(distances[0], Math.min(distYards, distances[distances.length - 1]));

  // Exact match
  if (table[d] !== undefined) return table[d];

  // Find surrounding keys and interpolate
  let lo = distances[0], hi = distances[distances.length - 1];
  for (let i = 0; i < distances.length - 1; i++) {
    if (distances[i] <= d && d <= distances[i + 1]) {
      lo = distances[i];
      hi = distances[i + 1];
      break;
    }
  }
  const t = (d - lo) / (hi - lo);
  return table[lo] + t * (table[hi] - table[lo]);
}

/**
 * Tour expected putts from distance in feet.
 * Computed directly from the fitted curve for smooth interpolation at any distance.
 * E(ft) = 1 + exp(−0.011 × ft + 0.14)
 * @param {number} distFeet
 * @returns {number}
 */
function tourExpectedPutt(distFeet) {
  const ft = Math.max(0.5, distFeet);
  return 1 + Math.exp(-0.011 * ft + 0.14);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get expected strokes from any position, for any benchmark handicap.
 *
 * @param {object} params
 * @param {number}  params.distYards      - distance to hole in yards (off green)
 * @param {number}  [params.distFeet]     - distance to hole in feet (on green / putting)
 * @param {string}  params.lie            - 'fairway'|'rough'|'sand'|'recovery'|'tee'|'green'
 * @param {number}  [params.benchmarkHcp] - benchmark handicap (default: 0 = Tour)
 * @returns {number} expected strokes to hole out
 */
export function getExpected({ distYards, distFeet, lie, benchmarkHcp = 0 }) {
  const scaleLie = lie === 'green' ? 'green' : lie;
  const scale = interpolateScale(scaleLie, benchmarkHcp);

  if (lie === 'green') {
    // Accept feet directly, or convert yards → feet
    const ft = distFeet ?? (distYards * 3);
    return tourExpectedPutt(ft) * scale;
  }

  return tourExpectedOffGreen(distYards, lie) * scale;
}

/**
 * Calculate strokes gained for a single shot.
 *
 * @param {object} params
 * @param {number}  params.startDistYards  - distance to hole before shot (yards)
 * @param {number}  [params.startDistFeet] - distance before shot if on green (feet)
 * @param {string}  params.startLie        - lie before shot
 * @param {number}  [params.endDistYards]  - distance after shot (yards); omit if holed
 * @param {number}  [params.endDistFeet]   - distance after shot if on green (feet)
 * @param {string}  [params.endLie]        - lie after shot; omit if holed
 * @param {number}  [params.benchmarkHcp]  - benchmark handicap (default: 0 = Tour)
 * @returns {number} strokes gained (positive = better than benchmark)
 */
export function calcSG({
  startDistYards, startDistFeet, startLie,
  endDistYards, endDistFeet, endLie,
  benchmarkHcp = 0,
}) {
  const eStart = getExpected({
    distYards: startDistYards,
    distFeet: startDistFeet,
    lie: startLie,
    benchmarkHcp,
  });

  // If holed, E_end = 0
  const holed = !endLie || (!endDistYards && !endDistFeet);
  const eEnd = holed
    ? 0
    : getExpected({
        distYards: endDistYards,
        distFeet: endDistFeet,
        lie: endLie,
        benchmarkHcp,
      });

  return eStart - eEnd - 1;
}

/**
 * Derive SG breakdown from a Fairway Caddie round object.
 *
 * Works with the existing round data shape in App.jsx:
 *   round.holes[i] = { par, score, putts, fh, gir, gh, teeClub, approachClub,
 *                      upAndDown, distToPin, teeDistToPin, ... }
 *
 * distToPin and teeDistToPin are optional — when present they enable precise
 * per-shot SG for approach and off-tee. When absent, statistical estimation
 * is used from binary flags (fh, gir, upAndDown, putts).
 *
 * @param {object} round        - Fairway Caddie round object
 * @param {number} benchmarkHcp - benchmark handicap (default: 0 = Tour)
 * @returns {{ offTee, approach, aroundGreen, putting, total }}
 */
export function calcRoundSG(round, benchmarkHcp = 0) {
  const holes = round.holes || [];
  let sgOffTee = 0, sgApproach = 0, sgAroundGreen = 0, sgPutting = 0;

  // Pre-compute the nearest handicap band for rate lookups
  const nearestBand = HCP_BANDS.reduce((prev, b) =>
    Math.abs(b - benchmarkHcp) < Math.abs(prev - benchmarkHcp) ? b : prev
  );

  // Benchmark GIR rates by hcp band (Shot Scope data)
  const GIR_BENCHMARK_RATES = { 0: 0.65, 5: 0.55, 10: 0.45, 15: 0.38, 20: 0.30, 28: 0.22 };
  const benchmarkGirRate = GIR_BENCHMARK_RATES[nearestBand];

  // Benchmark fairway rates by hcp band (Shot Scope data)
  const FH_BENCHMARK_RATES = { 0: 0.62, 5: 0.57, 10: 0.52, 15: 0.47, 20: 0.42, 28: 0.35 };
  const benchmarkFhRate = FH_BENCHMARK_RATES[nearestBand];

  for (const hole of holes) {
    if (!hole.score || hole.score === '') continue;

    const par = hole.par || 4;
    const putts = parseInt(hole.putts, 10);
    const girHit = hole.gir === true;
    const fhHit = hole.fh === true;

    // ── SG: Putting ─────────────────────────────────────────────────────────
    // Use actual distToPin on the green if available, otherwise estimate.
    // If GIR hit: first putt from ~25ft is typical amateur proximity.
    // If GIR missed: chip/pitch left ~10ft.
    if (!isNaN(putts)) {
      const firstPuttFt = hole.distToPin
        ? hole.distToPin * 3          // distToPin stored in yards → convert to feet
        : girHit ? 25 : 10;           // statistical fallback
      const expectedPutts = getExpected({ distFeet: firstPuttFt, lie: 'green', benchmarkHcp });
      sgPutting += expectedPutts - putts;
    }

    // ── SG: Around-the-Green ────────────────────────────────────────────────
    // Only applies on holes where GIR was missed.
    // upAndDown === true  → gained ~0.5 vs benchmark (made it in 2 from off-green)
    // upAndDown === false → lost ~0.35 vs benchmark
    if (!girHit && par >= 4) {
      if (hole.upAndDown === true)  sgAroundGreen += 0.50;
      if (hole.upAndDown === false) sgAroundGreen -= 0.35;
    }

    // ── SG: Approach ────────────────────────────────────────────────────────
    // Precise path: use distToPin (yards remaining after approach) if logged.
    // Estimated path: compare GIR result to benchmark GIR rate.
    if (par >= 4) {
      if (hole.distToPin !== undefined && hole.distToPin !== '') {
        // Precise: SG = E(approach start) − E(result on green) − 1
        // We don't store approach start distance yet, so use hole yardage proxy.
        // This will be replaced once teeDistToPin is also captured.
        const endDistFt = +hole.distToPin * 3;
        const approachEndE = getExpected({ distFeet: endDistFt, lie: 'green', benchmarkHcp });
        // For now we only have the end position precisely — credit/debit vs expected from green
        // Full shot SG requires both start and end; this gives a directionally correct signal.
        const benchmarkProximityFt = girHit ? 25 : 45; // benchmark first putt distance by GIR result
        const benchmarkEndE = getExpected({ distFeet: benchmarkProximityFt, lie: 'green', benchmarkHcp });
        sgApproach += benchmarkEndE - approachEndE; // positive = you hit it closer than benchmark
      } else {
        // Estimated: binary GIR vs benchmark rate
        if (girHit && benchmarkGirRate < 0.99)  sgApproach += (1 - benchmarkGirRate) * 0.45;
        if (!girHit && benchmarkGirRate > 0.01) sgApproach -= benchmarkGirRate * 0.45;
      }
    }

    // ── SG: Off-the-Tee ─────────────────────────────────────────────────────
    // Precise path: use teeDistToPin (yards remaining after tee shot) if logged.
    // Estimated path: compare fairway result to benchmark fairway rate.
    if (par >= 4) {
      if (hole.teeDistToPin !== undefined && hole.teeDistToPin !== '') {
        // Precise: know where tee shot ended up relative to hole
        const teeEndLie = fhHit ? 'fairway' : 'rough';
        const teeEndE = getExpected({ distYards: +hole.teeDistToPin, lie: teeEndLie, benchmarkHcp });
        // Benchmark: average tee shot leaves ~170yd in fairway for Tour; scales with hcp
        const benchmarkTeeDistYds = 170 + (benchmarkHcp * -2.5); // rough hcp adjustment
        const benchmarkTeeEndE = getExpected({ distYards: Math.max(50, benchmarkTeeDistYds), lie: 'fairway', benchmarkHcp });
        sgOffTee += benchmarkTeeEndE - teeEndE;
      } else {
        // Estimated: binary FH vs benchmark rate
        if (fhHit && benchmarkFhRate < 0.99)  sgOffTee += (1 - benchmarkFhRate) * 0.25;
        if (!fhHit && benchmarkFhRate > 0.01) sgOffTee -= benchmarkFhRate * 0.25;
      }
    }
  }

  return {
    offTee:      +sgOffTee.toFixed(2),
    approach:    +sgApproach.toFixed(2),
    aroundGreen: +sgAroundGreen.toFixed(2),
    putting:     +sgPutting.toFixed(2),
    total:       +(sgOffTee + sgApproach + sgAroundGreen + sgPutting).toFixed(2),
  };
}

/**
 * Full per-shot SG calculation — use this once shot-level data is captured.
 *
 * Example shot data shape to add to each hole:
 *   shots: [
 *     { type: 'tee',      startDist: 420, startLie: 'tee',     endDist: 130, endLie: 'fairway' },
 *     { type: 'approach', startDist: 130, startLie: 'fairway', endDist: 20,  endLie: 'green' },
 *     { type: 'putt',     startDist: 20,  startLie: 'green',   endDist: 4,   endLie: 'green' },
 *     { type: 'putt',     startDist: 4,   startLie: 'green',   holed: true },
 *   ]
 *
 * @param {Array}  shots
 * @param {number} benchmarkHcp
 * @returns {{ offTee, approach, aroundGreen, putting, total }}
 */
export function calcShotLevelSG(shots, benchmarkHcp = 0) {
  const result = { offTee: 0, approach: 0, aroundGreen: 0, putting: 0 };

  for (const shot of shots) {
    const onGreenStart = shot.startLie === 'green';
    const onGreenEnd   = !shot.holed && shot.endLie === 'green';

    const sg = calcSG({
      startDistYards: onGreenStart ? undefined : shot.startDist,
      startDistFeet:  onGreenStart ? shot.startDist * 3 : undefined,
      startLie: shot.startLie,
      endDistYards: (!shot.holed && !onGreenEnd) ? shot.endDist : undefined,
      endDistFeet:  onGreenEnd ? shot.endDist * 3 : undefined,
      endLie: shot.holed ? null : shot.endLie,
      benchmarkHcp,
    });

    if      (shot.type === 'tee')      result.offTee       += sg;
    else if (shot.type === 'approach') result.approach     += sg;
    else if (shot.type === 'short')    result.aroundGreen  += sg;
    else if (shot.type === 'putt')     result.putting      += sg;
  }

  return {
    offTee:      +result.offTee.toFixed(2),
    approach:    +result.approach.toFixed(2),
    aroundGreen: +result.aroundGreen.toFixed(2),
    putting:     +result.putting.toFixed(2),
    total:       +(result.offTee + result.approach + result.aroundGreen + result.putting).toFixed(2),
  };
}
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase auth client (uses public anon key — safe for browser) ────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ALL_CLUBS is the single source of truth for club dropdowns throughout the app
const ALL_CLUBS = ["Dr","3w","Hybrid","4i","5i","6i","7i","8i","9i","PW","GW","SW","LW"];

const defaultHoles = (courseHoles) =>
  Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: courseHoles ? courseHoles[i].par : 4,
    handicap: courseHoles ? courseHoles[i].handicap : i + 1,
    yardage: courseHoles ? (courseHoles[i].yardage || "") : "",
    score: "",
    teeClub: "",
    fh: null,
    gir: null,
    approachClub: "",
    gh: null,
    putts: "",
    upAndDown: null,
    penalty: 0,
    // Precision SG distance fields
    teeResult: "",
    approachResult: "",
    shortGameDist: "",
    putt1: "",
    putt2: "",
  }));

const defaultRound = (course) => ({
  id: Date.now(),
  date: new Date().toISOString().split("T")[0],
  courseId: course ? course.id : null,
  course: course ? course.name : "",
  holes: defaultHoles(course ? course.holes : null),
});

const defaultCourse = () => ({
  id: Date.now(),
  name: "",
  par: 72,
  yardage: "",
  slope: "",
  rating: "",
  state: "",
  holes: Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: 4,
    handicap: i + 1,
    yardage: "",
  })),
});

// ── Storage helpers ───────────────────────────────────────────────────────────
const API = "/api/data";
const COURSES_API = "/api/courses";
const MATCHES_API = "/api/matches";

// Matches — shared across all users (public leaderboard data)
async function loadMatches() {
  try {
    const res = await fetch(MATCHES_API);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch { return []; }
}

async function saveMatches(matches, token) {
  try {
    const res = await fetch(MATCHES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ matches }),
    });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch (err) { console.error("Could not save matches:", err); return []; }
}

async function deleteMatch(id, token) {
  try {
    await fetch(MATCHES_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
  } catch (err) { console.error("Could not delete match:", err); }
}

// Rounds — still stored per-user in golf_data
async function loadRounds(token) {
  try {
    const res = await fetch(API, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.rounds || [];
  } catch { return []; }
}

async function saveRounds(rounds, token) {
  try {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ rounds }),
    });
  } catch (err) { console.error("Could not save rounds:", err); }
}

// Courses — shared across all users
async function loadCourses() {
  try {
    const res = await fetch(COURSES_API);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch { return []; }
}

async function createCourse(course, token) {
  const res = await fetch(COURSES_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(course),
  });
  return await res.json();
}

async function updateCourse(course, token) {
  const res = await fetch(COURSES_API, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(course),
  });
  return await res.json();
}

async function deleteCourse(id, token) {
  await fetch(COURSES_API, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
}

// Profiles — public read, owner write
const PROFILES_API = "/api/profiles";

async function loadProfiles() {
  try {
    const res = await fetch(PROFILES_API);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch { return []; }
}

async function saveProfile(profile, token) {
  try {
    await fetch(PROFILES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(profile),
    });
  } catch (err) { console.error("Could not save profile:", err); }
}

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#fafaf8",
  surface: "#ffffff",
  border: "#e8e6e1",
  text: "#1a1a18",
  muted: "#8a8880",
  accent: "#2d6a4f",
  accentLight: "#e8f4ef",
  accentMid: "#52b788",
  red: "#c0392b",
  yellow: "#d4a017",
};

const pill = (active, color = C.accent) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500,
  cursor: "pointer", border: `1.5px solid ${active ? color : C.border}`,
  background: active ? color : "transparent",
  color: active ? "#fff" : C.muted,
  transition: "all 0.15s",
  userSelect: "none",
});

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text,
  background: C.bg, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600, color: C.muted,
  marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase",
};

// ── Strokes Gained — inlined data + calculator ───────────────────────────────
const SG_TOUR_DATA = {
  off_green: {
    fairway:  {10:1.383,15:1.600,20:1.773,25:1.920,30:2.049,40:2.261,50:2.431,60:2.574,75:2.759,100:3.072,125:3.337,150:3.544,175:3.721,200:3.876,225:4.015,250:4.140,275:4.255,300:4.360,350:4.551,400:4.720,450:4.872,500:5.011},
    rough:    {10:1.556,15:1.806,20:2.001,25:2.164,30:2.307,40:2.550,50:2.742,60:2.904,75:3.109,100:3.462,125:3.753,150:4.025,175:4.220,200:4.395,225:4.552,250:4.695,275:4.825,300:4.946,350:5.163,400:5.355,450:5.531,500:5.692},
    sand:     {10:1.651,15:1.951,20:2.147,25:2.311,30:2.455,40:2.699,50:2.897,60:3.064,75:3.272,100:3.625,125:3.915,150:4.188,175:4.382,200:4.559,225:4.716,250:4.860,275:4.990,300:5.111,350:5.326,400:5.519,450:5.694,500:5.855},
    recovery: {10:1.708,15:2.014,20:2.215,25:2.382,30:2.528,40:2.776,50:2.976,60:3.145,75:3.356,100:3.713,125:4.006,150:4.283,175:4.479,200:4.658,225:4.817,250:4.962,275:5.095,300:5.217,350:5.434,400:5.629,450:5.806,500:5.968},
    tee:      {10:1.340,15:1.551,20:1.720,25:1.863,30:1.988,40:2.194,50:2.361,60:2.501,75:2.681,100:2.988,125:3.248,150:3.460,175:3.640,200:3.798,225:3.939,250:4.066,275:4.182,300:4.290,350:4.483,400:4.655,450:4.809,500:4.949},
  },
  putting: {
    green: {1:1.142,2:1.159,3:1.180,4:1.207,5:1.239,6:1.276,7:1.317,8:1.361,9:1.407,10:1.454,12:1.550,15:1.683,18:1.805,20:1.878,25:2.043,30:2.188,35:2.316,40:2.430,50:2.626,60:2.789},
  },
};
const HCP_BANDS = [0, 5, 10, 15, 20, 28];
const SCALE_FACTORS = {
  fairway:  [1.00, 1.22, 1.42, 1.60, 1.78, 2.05],
  rough:    [1.00, 1.30, 1.55, 1.80, 2.05, 2.40],
  sand:     [1.00, 1.35, 1.65, 1.95, 2.25, 2.65],
  recovery: [1.00, 1.40, 1.75, 2.10, 2.45, 2.90],
  tee:      [1.00, 1.18, 1.35, 1.52, 1.68, 1.92],
  green:    [1.00, 1.08, 1.16, 1.24, 1.32, 1.45],
};
function sgInterpolateScale(lie, hcp) {
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
function sgTourExpectedOffGreen(distYards, lie) {
  const table = SG_TOUR_DATA.off_green[lie] ?? SG_TOUR_DATA.off_green.fairway;
  const distances = Object.keys(table).map(Number).sort((a, b) => a - b);
  const d = Math.max(distances[0], Math.min(distYards, distances[distances.length - 1]));
  if (table[d] !== undefined) return table[d];
  let lo = distances[0], hi = distances[distances.length - 1];
  for (let i = 0; i < distances.length - 1; i++) {
    if (distances[i] <= d && d <= distances[i + 1]) { lo = distances[i]; hi = distances[i + 1]; break; }
  }
  const t = (d - lo) / (hi - lo);
  return table[lo] + t * (table[hi] - table[lo]);
}
function sgTourExpectedPutt(distFeet) {
  // Interpolate from Broadie's empirical table — correctly increasing with distance
  const table = SG_TOUR_DATA.putting.green;
  const distances = Object.keys(table).map(Number).sort((a, b) => a - b);
  const ft = Math.max(distances[0], Math.min(distFeet, distances[distances.length - 1]));
  if (table[ft] !== undefined) return table[ft];
  let lo = distances[0], hi = distances[distances.length - 1];
  for (let i = 0; i < distances.length - 1; i++) {
    if (distances[i] <= ft && ft <= distances[i + 1]) { lo = distances[i]; hi = distances[i + 1]; break; }
  }
  const t = (ft - lo) / (hi - lo);
  return table[lo] + t * (table[hi] - table[lo]);
}
function sgGetExpected({ distYards, distFeet, lie, benchmarkHcp = 0 }) {
  const scale = sgInterpolateScale(lie === 'green' ? 'green' : lie, benchmarkHcp);
  if (lie === 'green') {
    const ft = distFeet ?? (distYards * 3);
    return sgTourExpectedPutt(ft) * scale;
  }
  return sgTourExpectedOffGreen(distYards, lie) * scale;
}
function sgCalcRound(round, benchmarkHcp = 0) {
  const holes = round.holes || [];
  let sgOffTee = 0, sgApproach = 0, sgAroundGreen = 0, sgPutting = 0;
  const nearestBand = HCP_BANDS.reduce((prev, b) =>
    Math.abs(b - benchmarkHcp) < Math.abs(prev - benchmarkHcp) ? b : prev);
  const GIR_RATES = { 0:0.65, 5:0.55, 10:0.45, 15:0.38, 20:0.30, 28:0.22 };
  const FH_RATES  = { 0:0.62, 5:0.57, 10:0.52, 15:0.47, 20:0.42, 28:0.35 };
  const benchmarkGirRate = GIR_RATES[nearestBand];
  const benchmarkFhRate  = FH_RATES[nearestBand];
  for (const hole of holes) {
    if (!hole.score || hole.score === '') continue;
    const par = hole.par || 4;
    const putts = parseInt(hole.putts, 10);
    const girHit = hole.gir === true;
    const fhHit  = hole.fh === true;
    // ── SG: Putting ─────────────────────────────────────────────────────────
    if (!isNaN(putts)) {
      // putt1 (precision) → distToPin (legacy) → statistical fallback
      const firstPuttFt = (hole.putt1 !== "" && hole.putt1 !== undefined)
        ? +hole.putt1 * 3
        : hole.distToPin ? hole.distToPin * 3
        : girHit ? 25 : 10;
      const expectedPutts = sgGetExpected({ distFeet: firstPuttFt, lie: 'green', benchmarkHcp });
      sgPutting += expectedPutts - putts;
    }
    // ── SG: Around-the-Green ────────────────────────────────────────────────
    if (!girHit && par >= 4) {
      if (hole.upAndDown === true)  sgAroundGreen += 0.50;
      if (hole.upAndDown === false) sgAroundGreen -= 0.35;
    }
    // ── SG: Approach ────────────────────────────────────────────────────────
    if (par >= 4) {
      // shortGameDist (precision) → distToPin (legacy) → statistical fallback
      const approachEndYds = (hole.shortGameDist !== "" && hole.shortGameDist !== undefined)
        ? +hole.shortGameDist
        : (hole.distToPin !== undefined && hole.distToPin !== '') ? +hole.distToPin
        : null;
      if (approachEndYds !== null) {
        const endDistFt = approachEndYds * 3;
        const approachEndE = sgGetExpected({ distFeet: endDistFt, lie: 'green', benchmarkHcp });
        const benchmarkProximityFt = girHit ? 25 : 45;
        const benchmarkEndE = sgGetExpected({ distFeet: benchmarkProximityFt, lie: 'green', benchmarkHcp });
        sgApproach += benchmarkEndE - approachEndE;
      } else {
        if (girHit && benchmarkGirRate < 0.99)  sgApproach += (1 - benchmarkGirRate) * 0.45;
        if (!girHit && benchmarkGirRate > 0.01) sgApproach -= benchmarkGirRate * 0.45;
      }
    }
    // ── SG: Off-the-Tee ─────────────────────────────────────────────────────
    if (par >= 4) {
      // teeResult (precision) → teeDistToPin (legacy) → statistical fallback
      const teeResultYds = (hole.teeResult !== "" && hole.teeResult !== undefined)
        ? +hole.teeResult
        : (hole.teeDistToPin !== undefined && hole.teeDistToPin !== '') ? +hole.teeDistToPin
        : null;
      if (teeResultYds !== null) {
        const teeEndLie = fhHit ? 'fairway' : 'rough';
        const teeEndE = sgGetExpected({ distYards: teeResultYds, lie: teeEndLie, benchmarkHcp });
        const benchmarkTeeDistYds = Math.max(50, 170 + benchmarkHcp * -2.5);
        const benchmarkTeeEndE = sgGetExpected({ distYards: benchmarkTeeDistYds, lie: 'fairway', benchmarkHcp });
        sgOffTee += benchmarkTeeEndE - teeEndE;
      } else {
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

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: accent ? C.accent : C.surface,
      border: `1px solid ${accent ? C.accent : C.border}`,
      borderRadius: 16, padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: accent ? "rgba(255,255,255,0.7)" : C.muted }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: accent ? "#fff" : C.text, fontFamily: "'DM Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: accent ? "rgba(255,255,255,0.6)" : C.muted }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ pct, color = C.accentMid }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
    </div>
  );
}

// ── AUTH MODAL ───────────────────────────────────────────────────────────────
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function AuthModal({ onClose, onProfileSaved }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [handicap, setHandicap] = useState("");
  const [homeState, setHomeState] = useState("");
  const [handedness, setHandedness] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (m) => { setMode(m); setError(""); setMessage(""); };

  const handleSubmit = async () => {
    setError(""); setMessage(""); setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onClose();
    } else {
      if (!firstName.trim() || !lastName.trim()) { setError("First and last name are required."); setLoading(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      // Save profile immediately — will be linked once email is confirmed
      if (data?.user) {
        await saveProfile({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          age: age ? +age : null,
          handicap: handicap !== "" ? +handicap : null,
          home_state: homeState || null,
          handedness: handedness || null,
        }, data.session?.access_token || "");
      }
      setMessage("Check your email for a confirmation link, then log in.");
    }
    setLoading(false);
  };

  const inp = { ...inputStyle, padding: "8px 12px", fontSize: 13 };
  const half = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: 20, padding: 32, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>
          {mode === "login" ? "Log in to access your rounds." : "Set up your profile to join the leaderboard."}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Email + Password — always shown */}
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inp} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>

          {/* Signup-only profile fields */}
          {mode === "signup" && (<>
            <div style={{ height: 1, background: C.border, margin: "2px 0" }} />
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted }}>Profile Info</div>

            <div style={half}>
              <div>
                <label style={labelStyle}>First Name *</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={labelStyle}>Last Name *</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} style={inp} />
              </div>
            </div>

            <div style={half}>
              <div>
                <label style={labelStyle}>Age</label>
                <input type="number" min={10} max={100} value={age} onChange={e => setAge(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={labelStyle}>GHIN Handicap</label>
                <input type="number" step={0.1} min={-10} max={54} value={handicap} onChange={e => setHandicap(e.target.value)} style={inp} />
              </div>
            </div>

            <div style={half}>
              <div>
                <label style={labelStyle}>Home State</label>
                <select value={homeState} onChange={e => setHomeState(e.target.value)} style={{ ...inp, background: C.bg }}>
                  <option value="">— Select —</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Handedness</label>
                <select value={handedness} onChange={e => setHandedness(e.target.value)} style={{ ...inp, background: C.bg }}>
                  <option value="">— Select —</option>
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </select>
              </div>
            </div>
          </>)}

          {error && <div style={{ fontSize: 13, color: C.red, background: "#fdf0ef", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}
          {message && <div style={{ fontSize: 13, color: C.accent, background: C.accentLight, borderRadius: 8, padding: "8px 12px" }}>{message}</div>}

          <button onClick={handleSubmit} disabled={loading} style={{
            background: C.accent, color: "#fff", border: "none", borderRadius: 10,
            padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer",
            opacity: loading ? 0.7 : 1, transition: "opacity 0.15s", fontFamily: "inherit",
          }}>
            {loading ? "…" : mode === "login" ? "Log In" : "Create Account"}
          </button>

          <div style={{ textAlign: "center", fontSize: 13, color: C.muted }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              style={{ color: C.accent, fontWeight: 600, cursor: "pointer" }}>
              {mode === "login" ? "Sign up" : "Log in"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SHARED FILTER BAR ────────────────────────────────────────────────────────
function FilterBar({ timeFilter, setTimeFilter, stateFilter, setStateFilter, courseFilter, setCourseFilter, statesInUse, coursesWithRounds, totalRounds, activeFilterCount, onClear, children }) {
  const FilterPill = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
      padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      cursor: "pointer", border: `1.5px solid ${active ? C.accent : C.border}`,
      background: active ? C.accent : "transparent",
      color: active ? "#fff" : C.muted,
      transition: "all 0.15s", fontFamily: "inherit", whiteSpace: "nowrap",
    }}>{label}</button>
  );

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Top row: mode toggle slot + clear */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {children}
        {activeFilterCount > 0 && (
          <button onClick={onClear} style={{
            fontSize: 12, color: C.muted, background: "none", border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
          }}>Clear filters ×</button>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: C.border }} />

      {/* Horizontal filter row */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* Time */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, flexShrink: 0 }}>Time</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[{ id: "all", label: "All" }, { id: "3m", label: "3 mo" }, { id: "1m", label: "1 mo" }].map(f => (
              <FilterPill key={f.id} label={f.label} active={timeFilter === f.id} onClick={() => setTimeFilter(f.id)} />
            ))}
          </div>
        </div>

        {/* State */}
        {statesInUse.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, flexShrink: 0 }}>State</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <FilterPill label="All" active={stateFilter === "all"} onClick={() => { setStateFilter("all"); setCourseFilter("all"); }} />
              {statesInUse.map(s => (
                <FilterPill key={s} label={s} active={stateFilter === s} onClick={() => { setStateFilter(s); setCourseFilter("all"); }} />
              ))}
            </div>
          </div>
        )}

        {/* Course */}
        {coursesWithRounds.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, flexShrink: 0 }}>Course</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <FilterPill label="All" active={courseFilter === "all"} onClick={() => setCourseFilter("all")} />
              {coursesWithRounds
                .filter(c => stateFilter === "all" || c.state === stateFilter)
                .map(c => (
                  <FilterPill key={c.id} label={c.name} active={courseFilter === c.id} onClick={() => setCourseFilter(c.id)} />
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {(totalRounds > 0 || activeFilterCount > 0) && (
        <div style={{ fontSize: 12, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          Showing <span style={{ fontWeight: 700, color: C.text }}>{totalRounds}</span> round{totalRounds !== 1 ? "s" : ""}
          {activeFilterCount > 0 && " matching active filters"}
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ rounds, courses, sgMode = false, userHandicap = null }) {
  const [mode, setMode] = useState("basic");
  const [timeFilter, setTimeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");

  if (rounds.length === 0) return (
    <div style={{ textAlign: "center", padding: "80px 0", color: C.muted }}>
      <div style={{ fontSize: 48 }}>⛳</div>
      <div style={{ marginTop: 12, fontSize: 16 }}>No rounds yet. Log your first round to see stats.</div>
    </div>
  );

  // ── Build filter options from actual round data ────────────────────────────
  const roundsWithCourses = rounds.map(r => {
    const courseObj = courses.find(c => c.id === r.courseId);
    return { ...r, courseObj };
  });

  // States: only from courses that have logged rounds
  const statesInUse = [...new Set(
    roundsWithCourses.map(r => r.courseObj?.state).filter(Boolean)
  )].sort();

  // Courses: only those with at least one logged round
  const coursesWithRounds = [...new Map(
    roundsWithCourses
      .filter(r => r.courseObj)
      .map(r => [r.courseObj.id, r.courseObj])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  // ── Apply all filters ─────────────────────────────────────────────────────
  const now = new Date();
  const filteredRounds = roundsWithCourses.filter(r => {
    if (timeFilter !== "all") {
      const months = timeFilter === "1m" ? 1 : 3;
      const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
      if (new Date(r.date) < cutoff) return false;
    }
    if (stateFilter !== "all") {
      if (r.courseObj?.state !== stateFilter) return false;
    }
    if (courseFilter !== "all") {
      if (r.courseId !== courseFilter) return false;
    }
    return true;
  });

  const allHoles = filteredRounds.flatMap(r => r.holes.filter(h => h.score !== ""));
  const totalHoles = allHoles.length;
  const totalRounds = filteredRounds.filter(r => r.holes.some(h => h.score !== "")).length;

  const avgScoreNum = totalRounds > 0 ? allHoles.reduce((s, h) => s + (+h.score - h.par), 0) / totalRounds : null;
  const avgScore = avgScoreNum !== null ? avgScoreNum.toFixed(1) : "—";

  const girHoles = allHoles.filter(h => h.gir === true);
  const girPct = totalHoles ? Math.round((girHoles.length / totalHoles) * 100) : 0;
  const fhHoles  = allHoles.filter(h => h.par > 3 && h.fh !== null);
  const fhHit    = fhHoles.filter(h => h.fh === true).length;
  const fhLeft   = fhHoles.filter(h => h.fh === "left").length;
  const fhRight  = fhHoles.filter(h => h.fh === "right").length;
  const fhPct    = fhHoles.length ? Math.round((fhHit / fhHoles.length) * 100) : 0;
  const puttHoles = allHoles.filter(h => h.putts !== "");
  const avgPutts = puttHoles.length ? (puttHoles.reduce((s, h) => s + +h.putts, 0) / puttHoles.length).toFixed(1) : "—";
  const udHoles  = allHoles.filter(h => h.upAndDown !== null && h.upAndDown !== "na");
  const udHit    = udHoles.filter(h => h.upAndDown === true).length;
  const udPct    = udHoles.length ? Math.round((udHit / udHoles.length) * 100) : 0;

  const roundStats = filteredRounds.map(r => {
    const hs = r.holes.filter(h => h.score !== "");
    if (!hs.length) return null;
    const rel = hs.reduce((s, h) => s + (+h.score - h.par), 0);
    const total = hs.reduce((s, h) => s + +h.score, 0);
    const par = hs.reduce((s, h) => s + h.par, 0);
    return { course: r.course || r.courseObj?.name || "Unnamed", date: r.date, rel, total, par };
  }).filter(Boolean).slice(-8);

  const birdieOrBetter = allHoles.filter(h => +h.score <= h.par - 1).length;
  const pars = allHoles.filter(h => +h.score === h.par).length;
  const bogeys = allHoles.filter(h => +h.score === h.par + 1).length;
  const doubles = allHoles.filter(h => +h.score >= h.par + 2).length;

  const clubMap = {};
  allHoles.forEach(h => {
    if (h.approachClub) {
      if (!clubMap[h.approachClub]) clubMap[h.approachClub] = { attempts: 0, gir: 0 };
      clubMap[h.approachClub].attempts++;
      if (h.gir === true) clubMap[h.approachClub].gir++;
    }
  });
  const APPROACH_ORDER = ["SW","GW","PW","9i","8i","7i","6i","5i","4i","Hybrid"];
  const clubStats = Object.entries(clubMap)
    .map(([club, { attempts, gir }]) => ({ club, attempts, gir, girPct: Math.round((gir / attempts) * 100) }))
    .sort((a, b) => {
      const ai = APPROACH_ORDER.indexOf(a.club), bi = APPROACH_ORDER.indexOf(b.club);
      if (ai === -1 && bi === -1) return b.attempts - a.attempts;
      if (ai === -1) return 1; if (bi === -1) return -1;
      return ai - bi;
    });

  const noData = totalHoles === 0;
  const activeFilterCount = [timeFilter !== "all", stateFilter !== "all", courseFilter !== "all"].filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <FilterBar
        timeFilter={timeFilter} setTimeFilter={setTimeFilter}
        stateFilter={stateFilter} setStateFilter={setStateFilter}
        courseFilter={courseFilter} setCourseFilter={setCourseFilter}
        statesInUse={statesInUse} coursesWithRounds={coursesWithRounds}
        totalRounds={totalRounds} activeFilterCount={activeFilterCount}
        onClear={() => { setTimeFilter("all"); setStateFilter("all"); setCourseFilter("all"); }}
      >
        {/* Basic / Advanced toggle lives inside the filter bar's top row */}
        <div style={{ display: "flex", background: C.bg, borderRadius: 12, padding: 3, gap: 2, border: `1px solid ${C.border}` }}>
          {["basic", "advanced"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "6px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: "pointer", border: "none", fontFamily: "inherit",
              background: mode === m ? C.accent : "transparent",
              color: mode === m ? "#fff" : C.muted,
              transition: "all 0.18s",
            }}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
          ))}
        </div>
      </FilterBar>

      {/* ── Advanced: Strokes Gained Dashboard ───────────────────────────── */}
      {mode === "advanced" && <AdvancedDashboard filteredRounds={filteredRounds} noData={noData} sgMode={sgMode} userHandicap={userHandicap} />}

      {/* ── Basic stats (hidden in advanced mode) ────────────────────────── */}
      {mode === "basic" && (noData ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
          <div style={{ fontSize: 36 }}>🗓️</div>
          <div style={{ marginTop: 10, fontSize: 15 }}>No rounds match the active filters.</div>
        </div>
      ) : (<>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatCard label="Avg Score" value={avgScoreNum !== null ? (avgScoreNum >= 0 ? `+${avgScore}` : avgScore) : "—"} sub={`${totalRounds} rounds`} accent />
        <StatCard label="GIR %" value={`${girPct}%`} sub={`${girHoles.length}/${totalHoles}`} />
        <StatCard label="FW Hit %" value={`${fhPct}%`} sub={`${fhHit}/${fhHoles.length}`} />
        <StatCard label="Avg Putts" value={avgPutts} sub="per hole" />
        <StatCard label="Up & Down %" value={udHoles.length ? `${udPct}%` : "—"} sub={udHoles.length ? `${udHit}/${udHoles.length}` : "no data"} />
      </div>

      {/* ── Club Performance with group subtotals ────────────────────────── */}
      {clubStats.length > 0 && (() => {
        const GROUPS = [
          { label: "Wedges",      clubs: ["LW","SW","GW","PW"] },
          { label: "Short irons", clubs: ["9i","8i","7i"] },
          { label: "Long irons",  clubs: ["6i","5i","4i"] },
          { label: "Woods",       clubs: ["Hybrid","3w","Dr"] },
        ];
        const groupSummaries = GROUPS.map(({ label, clubs }) => {
          const matching = clubStats.filter(cs => clubs.includes(cs.club));
          if (!matching.length) return null;
          const totalAttempts = matching.reduce((s, c) => s + c.attempts, 0);
          const totalGir      = matching.reduce((s, c) => s + c.gir, 0);
          const pct = totalAttempts ? Math.round(totalGir / totalAttempts * 100) : 0;
          return { label, pct, attempts: totalAttempts };
        }).filter(Boolean);
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Club Performance</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: groupSummaries.length ? 20 : 0 }}>
              {clubStats.map(({ club, attempts, gir, girPct: gp }) => {
                const color = gp >= 60 ? C.accentMid : gp >= 35 ? C.yellow : C.red;
                return (
                  <div key={club} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 52, fontWeight: 700, fontSize: 14, color: C.text, fontFamily: "'DM Mono', monospace" }}>{club}</div>
                    <div style={{ flex: 1 }}><MiniBar pct={gp} color={color} /></div>
                    <div style={{ width: 52, textAlign: "right", fontWeight: 700, fontSize: 14, color, fontFamily: "'DM Mono', monospace" }}>{gp}%</div>
                    <div style={{ width: 64, fontSize: 12, color: C.muted, textAlign: "right", fontFamily: "'DM Mono', monospace" }}>{gir}/{attempts}</div>
                  </div>
                );
              })}
            </div>
            {groupSummaries.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: "grid", gridTemplateColumns: `repeat(${groupSummaries.length}, 1fr)`, gap: 8 }}>
                {groupSummaries.map(({ label, pct, attempts }) => {
                  const color = pct >= 60 ? C.accentMid : pct >= 35 ? C.yellow : C.red;
                  return (
                    <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: C.bg, borderRadius: 10, padding: "10px 6px" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{pct}%</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textAlign: "center", letterSpacing: "0.04em" }}>{label}</div>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono', monospace" }}>{attempts} shots</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Score vs GIR + Putts by GIR side-by-side ────────────────────── */}
      {(() => {
        // Score vs GIR data
        const girHit  = allHoles.filter(h => h.gir === true  && h.score !== "");
        const girMiss = allHoles.filter(h => h.gir === false && h.score !== "");
        const hasGIR  = girHit.length > 0 || girMiss.length > 0;
        const avgHit  = girHit.length  ? girHit.reduce((s, h)  => s + (+h.score - h.par), 0) / girHit.length  : null;
        const avgMiss = girMiss.length ? girMiss.reduce((s, h) => s + (+h.score - h.par), 0) / girMiss.length : null;
        const roundGIR = filteredRounds.map(r => {
          const hs = r.holes.filter(h => h.score !== "");
          if (hs.length < 9) return null;
          const girCount = hs.filter(h => h.gir === true).length;
          return { girPct: Math.round(girCount / hs.length * 100), rel: hs.reduce((s, h) => s + (+h.score - h.par), 0), course: r.course || r.courseObj?.name || "" };
        }).filter(Boolean).sort((a, b) => a.girPct - b.girPct);
        const fmtRel = v => v === null ? "—" : (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
        const hitCol  = avgHit  !== null ? (avgHit  <= 0 ? C.accentMid : avgHit  <= 0.3 ? C.yellow : C.red) : C.muted;
        const missCol = avgMiss !== null ? (avgMiss <= 1 ? C.yellow : C.red) : C.muted;

        // Putts by GIR data
        const puttPanels = [
          { label: "Hit GIR",    holes: allHoles.filter(h => h.gir === true  && h.putts !== "") },
          { label: "Missed GIR", holes: allHoles.filter(h => h.gir === false && h.putts !== "") },
        ].filter(p => p.holes.length > 0);
        const hasPutts = puttPanels.length > 0;

        if (!hasGIR && !hasPutts) return null;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Score vs GIR — full width */}
            {hasGIR && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Score vs GIR</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: roundGIR.length > 1 ? 16 : 0 }}>
                  {[
                    { label: "Hit GIR",    value: fmtRel(avgHit),  color: hitCol },
                    { label: "Missed GIR", value: fmtRel(avgMiss), color: missCol },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted }}>{label}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>avg vs par</div>
                    </div>
                  ))}
                </div>
                {roundGIR.length > 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, marginBottom: 2 }}>Rounds by GIR %</div>
                    {roundGIR.map((r, i) => {
                      const col = r.rel <= 0 ? C.accentMid : r.rel <= 5 ? C.yellow : C.red;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 34, fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: C.accent, textAlign: "right" }}>{r.girPct}%</div>
                          <div style={{ flex: 1 }}><MiniBar pct={r.girPct} color={C.accentMid} /></div>
                          <div style={{ width: 90, fontSize: 11, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.course}</div>
                          <div style={{ width: 34, fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color: col, textAlign: "right" }}>{r.rel >= 0 ? `+${r.rel}` : r.rel}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Putts by GIR — full width */}
            {hasPutts && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Putts by GIR</div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${puttPanels.length}, 1fr)`, gap: 12 }}>
                  {puttPanels.map(({ label, holes }) => {
                    const avg = (holes.reduce((s, h) => s + +h.putts, 0) / holes.length).toFixed(2);
                    const one   = holes.filter(h => +h.putts === 1).length;
                    const two   = holes.filter(h => +h.putts === 2).length;
                    const three = holes.filter(h => +h.putts >= 3).length;
                    const avgCol = +avg <= 1.7 ? C.accentMid : +avg <= 2.0 ? C.yellow : C.red;
                    return (
                      <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, marginBottom: 3 }}>{label}</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                            <span style={{ fontSize: 24, fontWeight: 700, color: avgCol, fontFamily: "'DM Mono', monospace" }}>{avg}</span>
                            <span style={{ fontSize: 11, color: C.muted }}>avg putts</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                          {[
                            { label: "1-putt",  count: one,   color: C.accentMid },
                            { label: "2-putt",  count: two,   color: C.accent },
                            { label: "3-putt+", count: three, color: C.red },
                          ].map(({ label: pl, count, color }) => (
                            <div key={pl} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                                <span style={{ color: C.muted }}>{pl}</span>
                                <span style={{ fontWeight: 600, color: C.text, fontFamily: "'DM Mono', monospace" }}>{Math.round(count / holes.length * 100)}%</span>
                              </div>
                              <MiniBar pct={count / holes.length * 100} color={color} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        );
      })()}

      {/* ── Scoring by Par Type ─────────────────────────────────────────────── */}
      {(() => {
        const parData = [3, 4, 5].map(par => {
          const hs = allHoles.filter(h => h.par === par);
          if (!hs.length) return null;
          const avgRel = hs.reduce((s, h) => s + (+h.score - h.par), 0) / hs.length;
          const bird = hs.filter(h => +h.score <= h.par - 1).length;
          const pars2 = hs.filter(h => +h.score === h.par).length;
          const bog = hs.filter(h => +h.score === h.par + 1).length;
          const dbl = hs.filter(h => +h.score >= h.par + 2).length;
          return { par, count: hs.length, avgRel, bird, pars: pars2, bog, dbl };
        }).filter(Boolean);
        if (!parData.length) return null;
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Scoring by Par Type</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {parData.map(({ par, count, avgRel, bird, pars: p, bog, dbl }) => {
                const relCol = avgRel <= 0 ? C.accentMid : avgRel <= 0.5 ? C.yellow : C.red;
                const relStr = avgRel >= 0 ? `+${avgRel.toFixed(2)}` : avgRel.toFixed(2);
                return (
                  <div key={par}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Par {par}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 20, color: relCol }}>{relStr}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>avg / hole</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Birdie+", count: bird, color: C.accentMid },
                        { label: "Par",     count: p,    color: C.accent },
                        { label: "Bogey",   count: bog,  color: C.yellow },
                        { label: "Dbl+",    count: dbl,  color: C.red },
                      ].map(({ label, count: c, color }) => (
                        <div key={label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span style={{ color: C.muted }}>{label}</span>
                            <span style={{ fontWeight: 600, color: C.text, fontFamily: "'DM Mono', monospace" }}>{count ? Math.round(c / count * 100) : 0}%</span>
                          </div>
                          <MiniBar pct={count ? c / count * 100 : 0} color={color} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Fairway Distribution + Scoring Distribution + Recent Rounds ─── */}
      {(() => {
        const total = fhHoles.length;
        const leftPct  = total ? Math.round(fhLeft / total * 100) : 0;
        const hitPct   = total ? Math.round(fhHit  / total * 100) : 0;
        const rightPct = total ? Math.round(fhRight / total * 100) : 0;
        const FW = 140, FH = 80, fcx = FW / 2, fcy = FH, fr = 68, fri = 42;
        const toRad = d => (d - 90) * Math.PI / 180;
        const halfArc = (s0, s1, ro, ri) => {
          const s = toRad(s0), e = toRad(s1);
          const x1 = fcx + ro * Math.cos(s), y1 = fcy + ro * Math.sin(s);
          const x2 = fcx + ro * Math.cos(e), y2 = fcy + ro * Math.sin(e);
          const x3 = fcx + ri * Math.cos(e), y3 = fcy + ri * Math.sin(e);
          const x4 = fcx + ri * Math.cos(s), y4 = fcy + ri * Math.sin(s);
          return `M${x1},${y1} A${ro},${ro} 0 0 1 ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 0 0 ${x4},${y4} Z`;
        };
        const g = 1.5;
        const fa0 = -90, fa1 = fa0 + leftPct * 1.8, fa2 = fa1 + hitPct * 1.8, fa3 = fa2 + rightPct * 1.8;
        const scoringData = [
          { label: "Birdie+",  count: birdieOrBetter, color: C.accentMid },
          { label: "Par",      count: pars,            color: C.accent },
          { label: "Bogey",    count: bogeys,          color: C.yellow },
          { label: "Double+",  count: doubles,         color: C.red },
        ];
        const parOrBetterPct = totalHoles ? Math.round((birdieOrBetter + pars) / totalHoles * 100) : 0;
        const DS = 130, dcx = DS / 2, dcy = DS / 2, dr = 57, dri = 37;
        const fullArc = (s0, s1, ro, ri) => {
          const s = toRad(s0), e = toRad(s1);
          const x1 = dcx + ro * Math.cos(s), y1 = dcy + ro * Math.sin(s);
          const x2 = dcx + ro * Math.cos(e), y2 = dcy + ro * Math.sin(e);
          const x3 = dcx + ri * Math.cos(e), y3 = dcy + ri * Math.sin(e);
          const x4 = dcx + ri * Math.cos(s), y4 = dcy + ri * Math.sin(s);
          const lg = (s1 - s0) > 180 ? 1 : 0;
          return `M${x1},${y1} A${ro},${ro} 0 ${lg} 1 ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 ${lg} 0 ${x4},${y4} Z`;
        };
        let cursor = 0;
        const segments = scoringData.map(({ label, count, color }) => {
          const sweep = totalHoles ? (count / totalHoles) * 360 : 0;
          const start = cursor; cursor += sweep;
          return { label, pct: totalHoles ? Math.round(count / totalHoles * 100) : 0, color, start, sweep };
        });
        const showFairway = fhHoles.length > 0;
        const showRecent  = roundStats.length > 0;
        const cols = showFairway
          ? (showRecent ? "2fr 2fr 1fr" : "1fr 1fr")
          : (showRecent ? "2fr 1fr" : "1fr");
        return (
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "stretch" }}>
            {showFairway && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Fairway Distribution</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
                  <svg width={FW} height={FH} viewBox={`0 0 ${FW} ${FH}`} style={{ overflow: "visible", flexShrink: 0 }}>
                    <path d={halfArc(-90, 90, fr, fri)} fill={C.border} />
                    {leftPct  > 0.5 && <path d={halfArc(fa0 + g/2, fa1 - g/2, fr, fri)} fill={C.yellow} />}
                    {hitPct   > 0.5 && <path d={halfArc(fa1 + g/2, fa2 - g/2, fr, fri)} fill={C.accentMid} />}
                    {rightPct > 0.5 && <path d={halfArc(fa2 + g/2, fa3 - g/2, fr, fri)} fill={C.yellow} />}
                  </svg>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                    {[
                      { label: "Left miss",   pct: leftPct,  color: C.yellow },
                      { label: "Hit fairway", pct: hitPct,   color: C.accentMid },
                      { label: "Right miss",  pct: rightPct, color: C.yellow },
                    ].map(({ label, pct, color }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>{label}</span>
                        <span style={{ fontSize: 17, fontWeight: 700, color: label === "Hit fairway" ? C.accent : C.text, fontFamily: "'DM Mono', monospace" }}>{pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Scoring Distribution</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
                <svg width={DS} height={DS} viewBox={`0 0 ${DS} ${DS}`} style={{ flexShrink: 0 }}>
                  {segments.map(({ label, sweep, start, color }) =>
                    sweep > 0.5 ? <path key={label} d={fullArc(start + 1, start + sweep - 1, dr, dri)} fill={color} /> : null
                  )}
                  <text x={dcx} y={dcy - 6}  textAnchor="middle" fontSize="15" fontWeight="700" fill={C.accent} fontFamily="'DM Mono', monospace">{parOrBetterPct}%</text>
                  <text x={dcx} y={dcy + 7}  textAnchor="middle" fontSize="8.5" fill={C.muted} fontFamily="Georgia">par or</text>
                  <text x={dcx} y={dcy + 17} textAnchor="middle" fontSize="8.5" fill={C.muted} fontFamily="Georgia">better</text>
                </svg>
                <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                  {segments.map(({ label, pct, color }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>{label}</span>
                      <span style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {showRecent && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Recent Rounds</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  {[...roundStats].reverse().map((r, i) => {
                    const col = r.rel <= 0 ? C.accentMid : r.rel <= 5 ? C.yellow : C.red;
                    const relStr = r.rel >= 0 ? `+${r.rel}` : `${r.rel}`;
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1, paddingBottom: 8, borderBottom: i < roundStats.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ fontSize: 11, color: C.muted }}>{r.date}</div>
                        <div style={{ fontSize: 12, color: C.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.course || "—"}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: col, fontSize: 14 }}>
                          {r.total} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>({relStr})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      </>))}
    </div>
  );
}
// ── ADVANCED DASHBOARD (Strokes Gained) ──────────────────────────────────────
function SGBar({ value, maxAbs = 3 }) {
  const pct = Math.min(Math.abs(value) / maxAbs * 50, 50);
  const positive = value >= 0;
  return (
    <div style={{ position: "relative", height: 8, borderRadius: 4, background: C.border, width: "100%" }}>
      {/* Center line */}
      <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: C.muted, opacity: 0.4 }} />
      {/* Bar */}
      <div style={{
        position: "absolute",
        top: 0, height: "100%", borderRadius: 4,
        width: `${pct}%`,
        left: positive ? "50%" : `${50 - pct}%`,
        background: positive ? C.accentMid : C.red,
        transition: "width 0.5s ease",
      }} />
    </div>
  );
}

function SGCategoryCard({ label, value, icon, roundValues = [] }) {
  const color = value > 0.3 ? C.accentMid : value < -0.3 ? C.red : C.yellow;
  const sign = value >= 0 ? "+" : "";
  const trend = roundValues.length >= 3
    ? roundValues.slice(-3).reduce((s, v) => s + v, 0) / 3
    : null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>{label}</span>
        </div>
        {trend !== null && (
          <span style={{ fontSize: 11, color: trend >= 0 ? C.accentMid : C.red, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(2)} 3-rnd
          </span>
        )}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 36, fontWeight: 700, color, lineHeight: 1 }}>
        {sign}{value.toFixed(2)}
      </div>
      <SGBar value={value} />
      <div style={{ fontSize: 11, color: C.muted }}>strokes gained vs benchmark</div>
    </div>
  );
}

function AdvancedDashboard({ filteredRounds, noData, sgMode = false, userHandicap = null }) {
  // Use user's own handicap as the baseline. SG = 0 means performing exactly as expected.
  // Clamp to valid range; default to 0 (Tour) if no handicap set.
  const benchmarkHcp = userHandicap !== null ? Math.max(0, Math.min(+userHandicap, 28)) : 0;
  const [sgDropdownOpen, setSgDropdownOpen] = useState(false);

  if (noData) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
      <div style={{ fontSize: 36 }}>📐</div>
      <div style={{ marginTop: 10, fontSize: 15 }}>No rounds match the active filters.</div>
    </div>
  );

  // Compute per-round SG
  const roundSGs = filteredRounds
    .filter(r => r.holes.some(h => h.score !== ""))
    .map(r => ({ ...sgCalcRound(r, benchmarkHcp), date: r.date, course: r.course || r.courseObj?.name || "—" }));

  if (roundSGs.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
      <div style={{ fontSize: 36 }}>📐</div>
      <div style={{ marginTop: 10, fontSize: 15 }}>No completed rounds to analyze.</div>
    </div>
  );

  // Aggregate averages
  const avg = (key) => roundSGs.reduce((s, r) => s + r[key], 0) / roundSGs.length;
  const avgOffTee      = avg("offTee");
  const avgApproach    = avg("approach");
  const avgAroundGreen = avg("aroundGreen");
  const avgPutting     = avg("putting");
  const avgTotal       = avg("total");

  // Per-round arrays for trends
  const offTeeVals      = roundSGs.map(r => r.offTee);
  const approachVals    = roundSGs.map(r => r.approach);
  const aroundGreenVals = roundSGs.map(r => r.aroundGreen);
  const puttingVals     = roundSGs.map(r => r.putting);

  // Strongest & weakest
  const cats = [
    { key: "offTee",      label: "Off the Tee",      icon: "🏌️", avg: avgOffTee },
    { key: "approach",    label: "Approach",          icon: "🎯", avg: avgApproach },
    { key: "aroundGreen", label: "Around the Green",  icon: "⛳", avg: avgAroundGreen },
    { key: "putting",     label: "Putting",           icon: "🏳️", avg: avgPutting },
  ];
  const strongest = [...cats].sort((a, b) => b.avg - a.avg)[0];
  const weakest   = [...cats].sort((a, b) => a.avg - b.avg)[0];

  // SG lookup table for the explainer — sample distances
  const TABLE_DISTANCES = [10, 25, 50, 100, 150, 200, 250, 300];
  const TABLE_LIES = ["fairway", "rough", "sand", "tee"];

  const sgSign = (v) => v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
  const sgColor = (v) => v > 0.3 ? C.accentMid : v < -0.3 ? C.red : C.yellow;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Handicap baseline indicator ───────────────────────────────────── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Your Baseline</span>
          <span style={{ background: C.accent, color: "#fff", borderRadius: 20, padding: "4px 14px", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
            {userHandicap !== null ? `${(+userHandicap).toFixed(1)} HCP` : "No HCP set"}
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, textAlign: "right" }}>
          {userHandicap !== null ? (
            <>SG = 0 means you're playing <strong style={{ color: C.text }}>exactly as expected</strong> for a {(+userHandicap).toFixed(1)} handicap. Positive = better than expected.</>
          ) : (
            <>Set your GHIN handicap in <strong style={{ color: C.text }}>⚙️ Settings</strong> to personalise your SG baseline. Currently using Tour (scratch) as baseline.</>
          )}
        </div>
      </div>

      {/* ── Precision vs estimated banner ─────────────────────────────────── */}
      {!sgMode ? (
        <div style={{ background: "#fffbea", border: `1px solid ${C.yellow}`, borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>📊</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Estimated SG — based on binary flags</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>GIR, FH, and Up&Down are used to estimate strokes gained. Enable Precision SG in ⚙️ Settings to log distances for accurate per-shot values.</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.yellow, background: "#fef3cd", borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>ESTIMATED</span>
        </div>
      ) : (
        <div style={{ background: C.accentLight, border: `1px solid ${C.accentMid}`, borderRadius: 12, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>✓</span>
          <div style={{ fontSize: 12, color: C.accent }}>
            <strong>Precision SG active.</strong> Holes with distances logged use exact calculations. Holes without fall back to flag-based estimation.
          </div>
        </div>
      )}

      {/* ── Total SG hero ──────────────────────────────────────────────────── */}
      <div style={{ background: avgTotal >= 0 ? C.accent : C.red, borderRadius: 18, padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Total Strokes Gained / Round</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 52, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
            {avgTotal >= 0 ? "+" : ""}{avgTotal.toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>avg over {roundSGs.length} round{roundSGs.length !== 1 ? "s" : ""} · {userHandicap !== null ? `${(+userHandicap).toFixed(1)} HCP baseline` : "scratch baseline"}{!sgMode ? " · estimated" : ""}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 18px", display: "flex", gap: 18 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Strength</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginTop: 2 }}>{strongest.icon} {strongest.label}</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Weakness</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginTop: 2 }}>{weakest.icon} {weakest.label}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Four SG category cards ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <SGCategoryCard label="Off the Tee"     icon="🏌️" value={avgOffTee}      roundValues={offTeeVals} />
        <SGCategoryCard label="Approach"         icon="🎯" value={avgApproach}    roundValues={approachVals} />
        <SGCategoryCard label="Around the Green" icon="⛳" value={avgAroundGreen} roundValues={aroundGreenVals} />
        <SGCategoryCard label="Putting"          icon="🏳️" value={avgPutting}     roundValues={puttingVals} />
      </div>

      {/* ── Round-by-round SG table ────────────────────────────────────────── */}
      {roundSGs.length > 1 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Round-by-Round Breakdown</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Date", "Course", "Off Tee", "Approach", "Arg", "Putting", "Total"].map(h => (
                    <th key={h} style={{ textAlign: h === "Date" || h === "Course" ? "left" : "right", padding: "6px 10px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...roundSGs].reverse().map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.muted }}>{r.date}</td>
                    <td style={{ padding: "10px 10px", fontSize: 12, color: C.text, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.course}</td>
                    {[r.offTee, r.approach, r.aroundGreen, r.putting, r.total].map((v, j) => (
                      <td key={j} style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: sgColor(v), fontSize: 13 }}>{sgSign(v)}</td>
                    ))}
                  </tr>
                ))}
                {/* Averages row */}
                <tr style={{ background: C.accentLight }}>
                  <td colSpan={2} style={{ padding: "10px 10px", fontSize: 12, fontWeight: 700, color: C.accent }}>Average</td>
                  {[avgOffTee, avgApproach, avgAroundGreen, avgPutting, avgTotal].map((v, j) => (
                    <td key={j} style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: sgColor(v), fontSize: 13 }}>{sgSign(v)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SG Contribution bar ────────────────────────────────────────────── */}
      {(() => {
        const contributions = [
          { label: "Off Tee",    value: avgOffTee,      color: "#3d9970",  icon: "🏌️" },
          { label: "Approach",   value: avgApproach,    color: "#2d6a4f",  icon: "🎯" },
          { label: "Arg",        value: avgAroundGreen, color: "#52b788",  icon: "⛳" },
          { label: "Putting",    value: avgPutting,     color: "#1b4332",  icon: "🏳️" },
        ];
        const totalAbs = contributions.reduce((s, c) => s + Math.abs(c.value), 0);
        if (totalAbs === 0) return null;
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>SG Contribution Breakdown</div>
            {/* Stacked bar */}
            <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 16, gap: 2 }}>
              {contributions.map(({ label, value, color }) => {
                const pct = totalAbs ? Math.abs(value) / totalAbs * 100 : 0;
                return (
                  <div key={label} title={`${label}: ${sgSign(value)}`} style={{
                    width: `${pct}%`, background: value >= 0 ? color : C.red,
                    opacity: Math.abs(value) < 0.05 ? 0.3 : 1,
                    transition: "width 0.5s ease",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {pct > 10 && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>{pct.toFixed(0)}%</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {contributions.map(({ label, value, color, icon }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: C.bg, borderRadius: 10, padding: "10px 6px" }}>
                  <div style={{ fontSize: 16 }}>{icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: sgColor(value), fontFamily: "'DM Mono', monospace" }}>{sgSign(value)}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textAlign: "center", letterSpacing: "0.04em" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Methodology explainer — collapsible dropdown ───────────────────── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <button
          onClick={() => setSgDropdownOpen(o => !o)}
          style={{
            width: "100%", background: "none", border: "none", cursor: "pointer",
            padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>📐</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>How is Strokes Gained calculated?</span>
          </div>
          <span style={{ fontSize: 16, color: C.muted, transform: sgDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </button>

        {sgDropdownOpen && (
          <div style={{ padding: "0 24px 28px", display: "flex", flexDirection: "column", gap: 24, borderTop: `1px solid ${C.border}` }}>

            {/* Formula */}
            <div style={{ paddingTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>The Formula</div>
              <div style={{ background: C.accentLight, border: `1px solid ${C.accentMid}`, borderRadius: 12, padding: "16px 20px", fontFamily: "'DM Mono', monospace", fontSize: 14, color: C.accent, letterSpacing: "0.02em" }}>
                SG (shot) = E(start) − E(end) − 1
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: C.muted, lineHeight: 1.65 }}>
                For each shot, <strong style={{ color: C.text }}>E(start)</strong> is the expected strokes to hole out from where you started, and <strong style={{ color: C.text }}>E(end)</strong> is the expected strokes from where you ended up. Subtracting 1 accounts for the shot itself. A positive SG means you performed better than the benchmark; negative means worse.
              </div>
            </div>

            {/* Benchmark section */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Benchmark Scale Factors by Handicap</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
                Expected strokes at each distance are scaled from PGA Tour baselines using data anchored to Broadie (Every Shot Counts), Shot Scope 80M-shot database, and Pinpoint Golf benchmarks. Your {userHandicap !== null ? `${(+userHandicap).toFixed(1)}-handicap` : "scratch"} baseline is interpolated between these bands.
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 10px", color: C.muted, borderBottom: `1px solid ${C.border}`, fontWeight: 600, letterSpacing: "0.05em" }}>Lie</th>
                      {HCP_BANDS.map(b => (
                        <th key={b} style={{
                          textAlign: "right", padding: "6px 10px", borderBottom: `1px solid ${C.border}`,
                          color: b === benchmarkHcp ? C.accent : C.muted, fontWeight: 600, letterSpacing: "0.05em",
                          background: b === benchmarkHcp ? C.accentLight : "transparent",
                        }}>{b === 0 ? "Tour" : `${b} hcp`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(SCALE_FACTORS).map(([lie, factors], i) => (
                      <tr key={lie} style={{ background: i % 2 === 0 ? C.bg : C.surface }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: C.text, textTransform: "capitalize" }}>{lie}</td>
                        {factors.map((f, j) => (
                          <td key={j} style={{
                            padding: "8px 10px", textAlign: "right",
                            fontFamily: "'DM Mono', monospace", fontSize: 12,
                            color: HCP_BANDS[j] === benchmarkHcp ? C.accent : C.text,
                            fontWeight: HCP_BANDS[j] === benchmarkHcp ? 700 : 400,
                            background: HCP_BANDS[j] === benchmarkHcp ? C.accentLight : "transparent",
                          }}>{f.toFixed(2)}×</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expected strokes table */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
                Expected Strokes Table — {userHandicap !== null ? `${(+userHandicap).toFixed(1)} Handicap Baseline` : "Scratch / Tour Baseline"}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
                How many strokes a {userHandicap !== null ? `${(+userHandicap).toFixed(1)}-handicap golfer` : "scratch golfer"} is expected to need to hole out from each distance and lie. These are the E(start) values used in the SG formula.
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 10px", color: C.muted, borderBottom: `1px solid ${C.border}`, fontWeight: 600, letterSpacing: "0.05em" }}>Dist (yds)</th>
                      {TABLE_LIES.map(lie => (
                        <th key={lie} style={{ textAlign: "right", padding: "6px 10px", color: C.muted, borderBottom: `1px solid ${C.border}`, fontWeight: 600, letterSpacing: "0.05em", textTransform: "capitalize" }}>{lie}</th>
                      ))}
                      <th style={{ textAlign: "right", padding: "6px 10px", color: C.muted, borderBottom: `1px solid ${C.border}`, fontWeight: 600, letterSpacing: "0.05em" }}>Putt (ft)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TABLE_DISTANCES.map((dist, i) => (
                      <tr key={dist} style={{ background: i % 2 === 0 ? C.bg : C.surface }}>
                        <td style={{ padding: "8px 10px", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.accent }}>{dist}</td>
                        {TABLE_LIES.map(lie => (
                          <td key={lie} style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'DM Mono', monospace", color: C.text }}>
                            {sgGetExpected({ distYards: dist, lie, benchmarkHcp }).toFixed(2)}
                          </td>
                        ))}
                        {/* Putt column uses feet directly */}
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'DM Mono', monospace", color: C.muted, fontSize: 11 }}>
                          {dist <= 60 ? sgGetExpected({ distFeet: dist, lie: 'green', benchmarkHcp }).toFixed(2) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
                <strong style={{ color: C.text }}>Putting distances above are in feet.</strong> Off-green distances are in yards. Tour baseline fitted to Mark Broadie's Table 5.2 anchor points from <em>Every Shot Counts</em>. Putting values interpolated directly from Broadie's empirical make-rate table.
              </div>
            </div>

            {/* Data quality note */}
            <div style={{ background: "#fffbea", border: `1px solid ${C.yellow}`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.yellow, marginBottom: 5, letterSpacing: "0.04em" }}>⚠️ Data Quality Note</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                {sgMode ? (
                  <>Precision SG is active. Holes where you logged distances use exact calculations. Any holes missing distances fall back to flag-based estimation (GIR, FH, Up&amp;Down). The more holes you complete, the more accurate your SG becomes.</>
                ) : (
                  <>Without distance data, SG is estimated from binary flags (GIR, FH, Up&amp;Down). Results are directionally accurate but imprecise. Enable <strong style={{ color: C.text }}>Precision SG Tracking</strong> in ⚙️ Settings to unlock distance fields in Log Round.</>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// ── SETTINGS MODAL ───────────────────────────────────────────────────────────
function SettingsModal({ onClose, userId, token, profiles, onProfileUpdated }) {
  const existing = profiles.find(p => p.id === userId) || {};
  const [firstName, setFirstName] = useState(existing.first_name || "");
  const [lastName, setLastName] = useState(existing.last_name || "");
  const [age, setAge] = useState(existing.age ?? "");
  const [handicap, setHandicap] = useState(existing.handicap ?? "");
  const [homeState, setHomeState] = useState(existing.home_state || "");
  const [handedness, setHandedness] = useState(existing.handedness || "");
  const [sgMode, setSgMode] = useState(existing.sg_mode || false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError("First and last name are required."); return; }
    setSaving(true); setError("");
    await saveProfile({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      age: age !== "" ? +age : null,
      handicap: handicap !== "" ? +handicap : null,
      home_state: homeState || null,
      handedness: handedness || null,
      sg_mode: sgMode,
    }, token);
    await loadProfiles().then(onProfileUpdated);
    setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  const inp = { ...inputStyle, padding: "8px 12px", fontSize: 13 };
  const half = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: 20, padding: 32, width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Profile Settings</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 22 }}>Update your profile info and leaderboard details.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={half}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} style={inp} />
            </div>
          </div>

          <div style={half}>
            <div>
              <label style={labelStyle}>Age</label>
              <input type="number" min={10} max={100} value={age} onChange={e => setAge(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={labelStyle}>GHIN Handicap</label>
              <input type="number" step={0.1} min={-10} max={54} value={handicap} onChange={e => setHandicap(e.target.value)} style={inp} />
            </div>
          </div>

          <div style={half}>
            <div>
              <label style={labelStyle}>Home State</label>
              <select value={homeState} onChange={e => setHomeState(e.target.value)} style={{ ...inp, background: C.bg }}>
                <option value="">— Select —</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Handedness</label>
              <select value={handedness} onChange={e => setHandedness(e.target.value)} style={{ ...inp, background: C.bg }}>
                <option value="">— Select —</option>
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </div>
          </div>

          {/* ── Precision SG Toggle ── */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>Precision SG Tracking</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
                  Unlocks distance fields (yards to pin) in the Log Round scorecard for accurate Strokes Gained calculations. Adds 5 optional fields per hole.
                </div>
              </div>
              <button
                onClick={() => setSgMode(v => !v)}
                style={{
                  flexShrink: 0,
                  width: 44, height: 24, borderRadius: 12,
                  background: sgMode ? C.accent : C.border,
                  border: "none", cursor: "pointer",
                  position: "relative", transition: "background 0.2s",
                }}
              >
                <span style={{
                  position: "absolute", top: 2,
                  left: sgMode ? 22 : 2,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  transition: "left 0.2s",
                  display: "block",
                }} />
              </button>
            </div>
            {sgMode && (
              <div style={{ marginTop: 10, background: C.accentLight, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.accent }}>
                ✓ Active — distance fields will appear in Log Round after you enter your score and flags for each hole.
              </div>
            )}
          </div>

          {error && <div style={{ fontSize: 13, color: C.red, background: "#fdf0ef", borderRadius: 8, padding: "8px 12px" }}>{error}</div>}

          <button onClick={handleSave} disabled={saving} style={{
            background: saved ? C.accentMid : C.accent, color: "#fff", border: "none",
            borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700,
            cursor: "pointer", opacity: saving ? 0.7 : 1, transition: "all 0.2s", fontFamily: "inherit",
          }}>
            {saved ? "✓ Saved" : saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
function Leaderboard({ rounds, courses, profiles, userId, matches = [], onDeleteMatch }) {
  const [lbMode, setLbMode] = useState("season"); // "season" | "stats"
  const [timeFilter, setTimeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");

  // Build filter metadata from all rounds across all users
  const roundsWithCourses = rounds.map(r => ({ ...r, courseObj: courses.find(c => c.id === r.courseId) }));
  const statesInUse = [...new Set(roundsWithCourses.map(r => r.courseObj?.state).filter(Boolean))].sort();
  const coursesWithRounds = [...new Map(
    roundsWithCourses.filter(r => r.courseObj).map(r => [r.courseObj.id, r.courseObj])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  const now = new Date();
  const filterRounds = (userRounds) => userRounds.filter(r => {
    const rc = courses.find(c => c.id === r.courseId);
    if (timeFilter !== "all") {
      const months = timeFilter === "1m" ? 1 : 3;
      const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
      if (new Date(r.date) < cutoff) return false;
    }
    if (stateFilter !== "all" && rc?.state !== stateFilter) return false;
    if (courseFilter !== "all" && r.courseId !== courseFilter) return false;
    return true;
  });

  const activeFilterCount = [timeFilter !== "all", stateFilter !== "all", courseFilter !== "all"].filter(Boolean).length;

  // Build per-user stats. Since rounds are private per-user, the only rounds
  // we have are the current user's own. We attribute them to the logged-in user
  // and show null stats for everyone else until cross-user rounds are available.
  const userStats = profiles.map(p => {
    const isCurrentUser = p.id === userId;
    const userRounds = isCurrentUser ? filterRounds(rounds) : [];
    const holes = userRounds.flatMap(r => r.holes.filter(h => h.score !== ""));
    const totalRounds = userRounds.filter(r => r.holes.some(h => h.score !== "")).length;
    const avgScore = totalRounds > 0 ? holes.reduce((s, h) => s + (+h.score - h.par), 0) / totalRounds : null;
    const girHoles = holes.filter(h => h.gir === true);
    const girPct = holes.length ? Math.round(girHoles.length / holes.length * 100) : null;
    const puttHoles = holes.filter(h => h.putts !== "");
    const avgPutts = puttHoles.length ? +(puttHoles.reduce((s, h) => s + +h.putts, 0) / puttHoles.length).toFixed(2) : null;
    const fhHoles = holes.filter(h => h.par > 3 && h.fh !== null);
    const fhPct = fhHoles.length ? Math.round(fhHoles.filter(h => h.fh === true).length / fhHoles.length * 100) : null;
    const udHoles = holes.filter(h => h.upAndDown === true || h.upAndDown === false);
    const udPct = udHoles.length ? Math.round(holes.filter(h => h.upAndDown === true).length / udHoles.length * 100) : null;
    return { ...p, totalRounds, avgScore, girPct, avgPutts, fhPct, udPct };
  }).filter(p => p.first_name);

  const name = (p) => `${p.first_name} ${p.last_name}`;
  const isMe = (p) => p.id === userId;

  const RankWidget = ({ title, players, valueKey, format, ascending = true, suffix = "" }) => {
    const sorted = [...players]
      .filter(p => p[valueKey] !== null && p[valueKey] !== undefined)
      .sort((a, b) => ascending ? a[valueKey] - b[valueKey] : b[valueKey] - a[valueKey]);
    const unsorted = players.filter(p => p[valueKey] === null || p[valueKey] === undefined);

    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>{title}</div>
        {sorted.length === 0 && (
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "20px 0" }}>No data yet</div>
        )}
        {sorted.map((p, i) => {
          const me = isMe(p);
          const val = format ? format(p[valueKey]) : `${p[valueKey]}${suffix}`;
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
              borderBottom: i < sorted.length - 1 ? `1px solid ${C.border}` : "none",
              background: me ? C.accentLight : "transparent",
              margin: me ? "2px -8px" : "0",
              padding: me ? "10px 8px" : "10px 0",
              borderRadius: me ? 8 : 0,
            }}>
              <div style={{ width: 24, textAlign: "center", fontSize: 14 }}>
                {medal || <span style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono', monospace" }}>{i + 1}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: me ? 700 : 500, color: me ? C.accent : C.text }}>
                  {name(p)}{me && <span style={{ fontSize: 11, color: C.accentMid, marginLeft: 6 }}>you</span>}
                </div>
                {p.home_state && <div style={{ fontSize: 11, color: C.muted }}>{p.home_state}</div>}
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 15, color: me ? C.accent : C.text }}>{val}</div>
              {title === "Handicap" && <div style={{ fontSize: 11, color: C.muted }}>{p.totalRounds} rds</div>}
            </div>
          );
        })}
        {unsorted.length > 0 && sorted.length > 0 && (
          <div style={{ fontSize: 11, color: C.muted, paddingTop: 8, borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
            {unsorted.map(p => name(p)).join(", ")} — no data
          </div>
        )}
      </div>
    );
  };

  // ── Season standings computed from matches ─────────────────────────────────
  const playerIds = [...new Set(matches.flatMap(m => [m.giver_id, m.receiver_id]))];
  const activePlayers = profiles.filter(p => playerIds.includes(p.id) && p.first_name);

  const getRecord = (pid) => {
    const myMatches = matches.filter(m => m.giver_id === pid || m.receiver_id === pid);
    let W = 0, L = 0, D = 0, net = 0;
    myMatches.forEach(m => {
      const iAmGiver = m.giver_id === pid;
      const won = (iAmGiver && m.result === "giver") || (!iAmGiver && m.result === "receiver");
      const lost = (iAmGiver && m.result === "receiver") || (!iAmGiver && m.result === "giver");
      if (won) { W++; net += m.stake; }
      else if (lost) { L++; net -= m.stake; }
      else D++;
    });
    const pts = W * 2 + D;
    // last 5 form (most recent first)
    const form = [...myMatches]
      .sort((a, b) => new Date(b.round_date) - new Date(a.round_date))
      .slice(0, 5)
      .map(m => {
        const iAmGiver = m.giver_id === pid;
        const won = (iAmGiver && m.result === "giver") || (!iAmGiver && m.result === "receiver");
        const lost = (iAmGiver && m.result === "receiver") || (!iAmGiver && m.result === "giver");
        return won ? "W" : lost ? "L" : "D";
      });
    return { pid, W, L, D, pts, net, played: W+L+D, form };
  };

  const standings = activePlayers
    .map(p => ({ ...p, ...getRecord(p.id) }))
    .sort((a, b) => b.pts - a.pts || b.W - a.W || a.L - b.L);

  // H2H record between two players
  const h2h = (pidA, pidB) => {
    const pair = matches.filter(m =>
      (m.giver_id === pidA && m.receiver_id === pidB) ||
      (m.giver_id === pidB && m.receiver_id === pidA)
    );
    let W = 0, L = 0, D = 0;
    pair.forEach(m => {
      const aWon = (m.giver_id === pidA && m.result === "giver") || (m.receiver_id === pidA && m.result === "receiver");
      const aLost = (m.giver_id === pidA && m.result === "receiver") || (m.receiver_id === pidA && m.result === "giver");
      if (aWon) W++;
      else if (aLost) L++;
      else D++;
    });
    return { W, L, D, played: W+L+D };
  };

  const pName = (p) => p ? `${p.first_name} ${p.last_name[0]}.` : "—";
  const pNameFull = (p) => p ? `${p.first_name} ${p.last_name}` : "—";
  const formDot = (r) => {
    const col = r === "W" ? C.accentMid : r === "L" ? C.red : C.yellow;
    return <span key={Math.random()} style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: col, margin: "0 1px" }} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Mode toggle in FilterBar ──────────────────────────────────────── */}
      <FilterBar
        timeFilter={timeFilter} setTimeFilter={setTimeFilter}
        stateFilter={stateFilter} setStateFilter={setStateFilter}
        courseFilter={courseFilter} setCourseFilter={setCourseFilter}
        statesInUse={statesInUse} coursesWithRounds={coursesWithRounds}
        totalRounds={null} activeFilterCount={activeFilterCount}
        onClear={() => { setTimeFilter("all"); setStateFilter("all"); setCourseFilter("all"); }}
      >
        <div style={{ display: "flex", background: C.bg, borderRadius: 12, padding: 3, gap: 2, border: `1px solid ${C.border}` }}>
          {[{ id: "season", label: "Season" }, { id: "stats", label: "Stats" }].map(m => (
            <button key={m.id} onClick={() => setLbMode(m.id)} style={{
              padding: "6px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: "pointer", border: "none", fontFamily: "inherit",
              background: lbMode === m.id ? C.accent : "transparent",
              color: lbMode === m.id ? "#fff" : C.muted,
              transition: "all 0.18s",
            }}>{m.label}</button>
          ))}
        </div>
      </FilterBar>

      {/* ── SEASON MODE ──────────────────────────────────────────────────────── */}
      {lbMode === "season" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {matches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
              <div style={{ fontSize: 40 }}>🏆</div>
              <div style={{ marginTop: 12, fontSize: 15, fontWeight: 600, color: C.text }}>No matches yet</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>Log matches in the round scorecard to build the season standings.</div>
            </div>
          ) : (<>

          {/* Standings table */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>🏆</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Season Standings</span>
              <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>{matches.length} match{matches.length !== 1 ? "es" : ""} played</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {["#", "Player", "W", "L", "D", "Pts", "Net $", "Form"].map((h, hi) => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: hi < 2 ? "left" : "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((p, i) => {
                    const me = p.id === userId;
                    const netCol = p.net > 0 ? C.accentMid : p.net < 0 ? C.red : C.muted;
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, background: me ? C.accentLight : i % 2 === 0 ? "transparent" : "#fafaf8" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: C.muted, fontSize: 12 }}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: me ? 700 : 500, color: me ? C.accent : C.text }}>
                            {pNameFull(p)}{me && <span style={{ fontSize: 11, color: C.accentMid, marginLeft: 6 }}>you</span>}
                          </div>
                          {p.handicap && <div style={{ fontSize: 11, color: C.muted }}>{p.handicap} HCP</div>}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.accentMid }}>{p.W}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: p.L > 0 ? C.red : C.muted }}>{p.L}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "'DM Mono', monospace", color: C.muted }}>{p.D}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.text }}>{p.pts}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: netCol }}>
                          {p.net >= 0 ? `+$${p.net}` : `-$${Math.abs(p.net)}`}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 2, justifyContent: "center", alignItems: "center" }}>
                            {p.form.length > 0 ? p.form.map((r, fi) => formDot(r)) : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "10px 20px", fontSize: 11, color: C.muted, borderTop: `1px solid ${C.border}` }}>
              Points: Win = 2 · Draw = 1 · Loss = 0 · Form = last 5 results
            </div>
          </div>

          {/* H2H Matrix */}
          {activePlayers.length >= 2 && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚔️</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Head to Head</span>
                <span style={{ fontSize: 12, color: C.muted }}>row beats column</span>
              </div>
              <div style={{ overflowX: "auto", padding: "0 0 4px" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: C.muted, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>Player</th>
                      {activePlayers.map(p => (
                        <th key={p.id} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: p.id === userId ? C.accent : C.muted, fontSize: 11, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                          {pName(p)}
                        </th>
                      ))}
                      <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: C.muted, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePlayers.map((rowP, ri) => {
                      const rec = getRecord(rowP.id);
                      const me = rowP.id === userId;
                      return (
                        <tr key={rowP.id} style={{ borderBottom: `1px solid ${C.border}`, background: me ? C.accentLight : ri % 2 === 0 ? "transparent" : "#fafaf8" }}>
                          <td style={{ padding: "10px 16px", fontWeight: me ? 700 : 500, color: me ? C.accent : C.text, whiteSpace: "nowrap" }}>
                            {pNameFull(rowP)}{me && <span style={{ fontSize: 10, color: C.accentMid, marginLeft: 5 }}>you</span>}
                          </td>
                          {activePlayers.map((colP, ci) => {
                            if (rowP.id === colP.id) {
                              return <td key={colP.id} style={{ padding: "10px 12px", textAlign: "center", background: C.bg, color: C.border, fontSize: 16 }}>—</td>;
                            }
                            const r = h2h(rowP.id, colP.id);
                            if (r.played === 0) {
                              return <td key={colP.id} style={{ padding: "10px 12px", textAlign: "center", color: C.muted, fontSize: 11 }}>—</td>;
                            }
                            const winPct = r.W / r.played;
                            const cellColor = winPct > 0.5 ? C.accentMid : winPct < 0.5 ? C.red : C.yellow;
                            return (
                              <td key={colP.id} style={{ padding: "10px 12px", textAlign: "center" }}>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: cellColor, fontSize: 13 }}>
                                  {r.W}-{r.L}{r.D > 0 ? `-${r.D}` : ""}
                                </span>
                              </td>
                            );
                          })}
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: rec.W > rec.L ? C.accentMid : rec.W < rec.L ? C.red : C.yellow, fontSize: 13 }}>
                              {rec.W}-{rec.L}{rec.D > 0 ? `-${rec.D}` : ""}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Matches log */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>📋</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Recent Results</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[...matches].sort((a, b) => new Date(b.round_date) - new Date(a.round_date)).slice(0, 15).map((m, i) => {
                const giver = profiles.find(p => p.id === m.giver_id);
                const receiver = profiles.find(p => p.id === m.receiver_id);
                const winnerColor = m.result === "giver" ? C.accentMid : m.result === "receiver" ? C.red : C.yellow;
                const resultLabel = m.result === "draw" ? "Draw" : m.result === "giver" ? `${pNameFull(giver)} won` : `${pNameFull(receiver)} won`;
                const myMatch = m.giver_id === userId || m.receiver_id === userId;
                return (
                  <div key={m.id} style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, background: myMatch ? C.accentLight : "transparent" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: m.result === "giver" ? C.accentMid : C.text }}>{pNameFull(giver)}</span>
                        <span style={{ fontSize: 11, color: C.muted, background: C.accentLight, borderRadius: 4, padding: "1px 6px", fontFamily: "'DM Mono', monospace" }}>-{m.strokes}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>vs</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: m.result === "receiver" ? C.accentMid : C.text }}>{pNameFull(receiver)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.round_date}{m.course_name ? ` · ${m.course_name}` : ""}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: winnerColor }}>{resultLabel}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>${m.stake}</div>
                    </div>
                    {(m.logged_by === userId) && onDeleteMatch && (
                      <button onClick={() => onDeleteMatch(m.id)} title="Delete match" style={{ background: "none", border: "none", cursor: "pointer", color: C.border, fontSize: 16, padding: "0 4px", flexShrink: 0 }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          </>)}
        </div>
      )}

      {/* ── STATS MODE (existing rank widgets) ───────────────────────────────── */}
      {lbMode === "stats" && (
        profiles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
            <div style={{ fontSize: 36 }}>🏆</div>
            <div style={{ marginTop: 10, fontSize: 15 }}>No players yet. Be the first to sign up.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <RankWidget title="Handicap" players={userStats} valueKey="handicap" ascending={true}
              format={v => v % 1 === 0 ? `${v}.0` : `${v}`} />
            <RankWidget title="Avg Score vs Par" players={userStats} valueKey="avgScore" ascending={true}
              format={v => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)} />
            <RankWidget title="GIR %" players={userStats} valueKey="girPct" ascending={false} suffix="%" />
            <RankWidget title="Avg Putts / Hole" players={userStats} valueKey="avgPutts" ascending={true} />
            <RankWidget title="FW Hit %" players={userStats} valueKey="fhPct" ascending={false} suffix="%" />
            <RankWidget title="Up & Down %" players={userStats} valueKey="udPct" ascending={false} suffix="%" />
          </div>
        )
      )}
    </div>
  );
}

// ── COURSE SEARCH DROPDOWN ───────────────────────────────────────────────────
function CourseSearch({ courses, value, onChange }) {
  const [query, setQuery] = useState(value?.name || "");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const ref = useCallback(node => {
    if (!node) return;
    const handler = e => { if (!node.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim().length === 0
    ? courses
    : courses.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

  const select = (course) => {
    setQuery(course.name);
    setOpen(false);
    onChange(course);
  };

  const handleKey = (e) => {
    if (!open) { if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[highlighted]) select(filtered[highlighted]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(0); onChange(null); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder="Search courses…"
        style={inputStyle}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10,
          marginTop: 4, maxHeight: 240, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
        }}>
          {filtered.map((c, i) => (
            <div key={c.id} onMouseDown={() => select(c)}
              style={{
                padding: "10px 14px", cursor: "pointer", fontSize: 14,
                background: i === highlighted ? C.accentLight : "transparent",
                color: i === highlighted ? C.accent : C.text,
                borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none",
              }}
              onMouseEnter={() => setHighlighted(i)}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                Par {c.par}{c.yardage ? ` · ${c.yardage} yds` : ""}{c.rating ? ` · Rating ${c.rating}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query.trim().length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10,
          marginTop: 4, padding: "12px 14px", fontSize: 13, color: C.muted,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
        }}>
          No courses match "{query}" — add it in the Courses tab first.
        </div>
      )}
    </div>
  );
}

// ── COURSES TAB ──────────────────────────────────────────────────────────────
function Courses({ courses, onSave, onDelete, userId }) {
  const [mode, setMode] = useState("list");
  const [editing, setEditing] = useState(null);
  const [course, setCourse] = useState(defaultCourse());
  const [saved, setSaved] = useState(false);

  const startNew = () => { setCourse(defaultCourse()); setEditing(null); setMode("new"); };
  const startEdit = (c) => { setCourse(JSON.parse(JSON.stringify(c))); setEditing(c.id); setMode("edit"); };

  const setHoleField = (i, field, val) => {
    setCourse(c => {
      const holes = [...c.holes];
      holes[i] = { ...holes[i], [field]: val };
      const totalPar = holes.reduce((s, h) => s + (h.par ? +h.par : 0), 0);
      const totalYardage = holes.reduce((s, h) => s + (h.yardage ? +h.yardage : 0), 0);
      return { ...c, holes, par: totalPar, yardage: totalYardage || "" };
    });
  };

  const handleSave = () => {
    if (!course.name.trim()) return;
    onSave(course, editing);
    setSaved(true);
    setTimeout(() => { setSaved(false); setMode("list"); }, 1200);
  };

  if (mode === "list") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: C.muted }}>{courses.length} course{courses.length !== 1 ? "s" : ""} in the shared library</div>
        <button onClick={startNew} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Add Course
        </button>
      </div>
      {courses.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
          <div style={{ fontSize: 40 }}>🏌️</div>
          <div style={{ marginTop: 12 }}>No courses yet. Be the first to add one.</div>
        </div>
      )}
      {courses.map(c => {
        const isOwner = c.created_by === userId;
        return (
          <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>{c.name}</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: C.muted }}>Par {c.par}</span>
                {c.yardage && <span style={{ fontSize: 12, color: C.muted }}>{c.yardage} yds</span>}
                {c.state && <span style={{ fontSize: 12, color: C.muted }}>{c.state}</span>}
                {c.rating && <span style={{ fontSize: 12, color: C.muted }}>Rating {c.rating}</span>}
                {c.slope && <span style={{ fontSize: 12, color: C.muted }}>Slope {c.slope}</span>}
                {!isOwner && <span style={{ fontSize: 11, color: C.border, fontStyle: "italic" }}>added by another user</span>}
              </div>
            </div>
            {isOwner && <>
              <button onClick={() => startEdit(c)} style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentMid}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
              <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.border, fontSize: 18, padding: 4 }}>✕</button>
            </>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setMode("list")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0 }}>← Back</button>
        <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{editing ? "Edit Course" : "New Course"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Course Name *</label>
          <input value={course.name} onChange={e => setCourse(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Pebble Beach" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>State</label>
          <input value={course.state} onChange={e => setCourse(c => ({ ...c, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="CA" maxLength={2} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Course Rating</label>
          <input type="number" step="0.1" value={course.rating} onChange={e => setCourse(c => ({ ...c, rating: e.target.value }))} placeholder="72.4" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Slope Rating</label>
          <input type="number" value={course.slope} onChange={e => setCourse(c => ({ ...c, slope: e.target.value }))} placeholder="133" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Yardage</label>
          <input type="number" value={course.yardage} readOnly style={{ ...inputStyle, background: C.accentLight, color: C.accent, fontWeight: 700 }} />
        </div>
        <div>
          <label style={labelStyle}>Total Par</label>
          <input type="number" value={course.par} readOnly style={{ ...inputStyle, background: C.accentLight, color: C.accent, fontWeight: 700 }} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>Hole Details</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                {["Hole", "Par", "Yardage", "Handicap"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", color: C.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 11, textAlign: h === "Hole" ? "left" : "center" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {course.holes.map((h, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : "#fafaf8" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: C.muted }}>{i + 1}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center" }}>
                    <select value={h.par} onChange={e => setHoleField(i, "par", +e.target.value)}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 13, background: "transparent", color: C.text }}>
                      {[3, 4, 5].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "center" }}>
                    <input type="number" min={0} value={h.yardage}
                      onChange={e => setHoleField(i, "yardage", e.target.value)}
                      placeholder="—"
                      style={{ width: 64, textAlign: "center", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 13, background: "transparent", outline: "none", color: C.text }} />
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "center" }}>
                    <input type="number" min={1} max={18} value={h.handicap}
                      onChange={e => setHoleField(i, "handicap", +e.target.value)}
                      style={{ width: 52, textAlign: "center", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 13, background: "transparent", outline: "none", color: C.text }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button onClick={handleSave} style={{
        background: saved ? C.accentMid : C.accent, color: "#fff",
        border: "none", borderRadius: 12, padding: "13px 28px",
        fontSize: 14, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start", transition: "all 0.2s",
      }}>
        {saved ? "✓ Saved" : "Save Course"}
      </button>
    </div>
  );
}

// ── Three-way toggle: ✓ / ✗ / — ─────────────────────────────────────────────
function ThreeWay({ value, onChange }) {
  const next = () => {
    if (value === null) onChange(true);
    else if (value === true) onChange(false);
    else if (value === false) onChange("na");
    else onChange(null);
  };
  const label = value === true ? "✓" : value === false ? "✗" : value === "na" ? "—" : "·";
  const color = value === true ? C.accentMid : value === false ? C.red : value === "na" ? C.muted : C.border;
  const bg = value === true ? C.accentMid : value === false ? C.red : value === "na" ? "#f0eeeb" : "transparent";
  return (
    <span onClick={next} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 30, height: 26, borderRadius: 6, fontSize: 13, fontWeight: 700,
      cursor: "pointer", border: `1.5px solid ${color}`,
      background: (value === true || value === false) ? bg : "transparent",
      color: (value === true || value === false) ? "#fff" : color,
      userSelect: "none", transition: "all 0.15s",
    }}>{label}</span>
  );
}

// ── Two-way toggle: ✓ / ✗ ────────────────────────────────────────────────────
function TwoWay({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
      <span onClick={() => onChange(value === true ? null : true)} style={pill(value === true, C.accentMid)}>✓</span>
      <span onClick={() => onChange(value === false ? null : false)} style={pill(value === false, C.red)}>✗</span>
    </div>
  );
}

// ── Fairway toggle: ✓ hit / ← missed left / → missed right / null ───────────
function FairwayToggle({ value, onChange }) {
  const opts = [
    { val: true,    label: "✓", activeColor: C.accentMid },
    { val: "left",  label: "←", activeColor: C.yellow },
    { val: "right", label: "→", activeColor: C.yellow },
  ];
  return (
    <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
      {opts.map(({ val, label, activeColor }) => {
        const active = value === val;
        return (
          <span key={String(val)} onClick={() => onChange(active ? null : val)} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "4px 8px", borderRadius: 6, fontSize: 13, fontWeight: 700,
            cursor: "pointer", border: `1.5px solid ${active ? activeColor : C.border}`,
            background: active ? activeColor : "transparent",
            color: active ? "#fff" : C.muted,
            userSelect: "none", transition: "all 0.15s",
          }}>{label}</span>
        );
      })}
    </div>
  );
}

// ── Club dropdown ─────────────────────────────────────────────────────────────
function ClubSelect({ value, onChange, placeholder = "—" }) {
  return (
    <select value={value || ""} onChange={e => onChange(e.target.value)}
      style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 4px", fontSize: 11, background: "transparent", color: value ? C.text : C.muted, width: 62 }}>
      <option value="">{placeholder}</option>
      {ALL_CLUBS.map(c => <option key={c}>{c}</option>)}
    </select>
  );
}

// ── SCORECARD ENTRY ──────────────────────────────────────────────────────────
function ScorecardEntry({ onSave, onUpdate, editingRound, courses, sgMode = false, userId = null, profiles = [], onSaveMatches = null }) {
  const [round, setRound] = useState(() => editingRound ? JSON.parse(JSON.stringify(editingRound)) : defaultRound());
  const [saved, setSaved] = useState(false);
  const [matchEntries, setMatchEntries] = useState([]); // [{giverId, receiverId, strokes, result}]
  const [matchSaved, setMatchSaved] = useState(false);

  // When editingRound changes (user clicks Edit on a different round), re-seed
  useEffect(() => {
    setRound(editingRound ? JSON.parse(JSON.stringify(editingRound)) : defaultRound());
    setSaved(false);
  }, [editingRound]);

  const selectCourse = (courseId) => {
    const course = courses.find(c => c.id === courseId) || null;
    setRound(r => ({ ...defaultRound(course), date: r.date }));
  };

  const setField = (idx, field, val) => {
    setRound(r => {
      const holes = [...r.holes];
      const updated = { ...holes[idx], [field]: val };
      const isP3 = updated.par === 3;

      if (isP3) {
        // Par 3: tee club IS the approach club — mirror silently
        if (field === "teeClub") updated.approachClub = val;
        // Par 3: GIR directly determines GH (no separate input needed)
        if (field === "gir") updated.gh = val === true ? true : val === false ? false : null;
      } else {
        // All holes: GIR = true means GH is also true — fill it behind the scenes
        if (field === "gir" && val === true) { updated.gh = true; updated.upAndDown = "na"; }
        // If GIR is cleared, also reset the auto-set fields so they're back to manual
        if (field === "gir" && val === null) { updated.gh = null; updated.upAndDown = null; }
      }

      holes[idx] = updated;
      return { ...r, holes };
    });
  };

  const handleSave = () => {
    if (editingRound) {
      onUpdate(round);
    } else {
      onSave(round);
    }
    setSaved(true);
    setTimeout(() => { setSaved(false); if (!editingRound) setRound(defaultRound()); }, 1500);
  };

  const total = round.holes.reduce((s, h) => s + (h.score !== "" ? +h.score : 0), 0);
  const totalPar = round.holes.reduce((s, h) => s + h.par, 0);
  const rel = total - totalPar;

  const th = (centered = true) => ({
    padding: "8px 4px", color: C.muted, fontWeight: 600,
    letterSpacing: "0.05em", textTransform: "uppercase", fontSize: 10,
    textAlign: centered ? "center" : "left", whiteSpace: "nowrap",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Course</label>
          <CourseSearch
            courses={courses}
            value={round.courseId ? courses.find(c => c.id === round.courseId) : null}
            onChange={course => {
              if (course) selectCourse(course.id);
              else setRound(r => ({ ...defaultRound(), date: r.date }));
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={round.date} onChange={e => setRound(r => ({ ...r, date: e.target.value }))} style={inputStyle} />
        </div>
      </div>

      {/* ── Match Play Section ─────────────────────────────────────────────── */}
      {(() => {
        // Only the logged-in user appears as "you" in match dropdowns.
        // Other players are drawn from profiles (minus self).
        const otherProfiles = profiles.filter(p => p.id !== userId && p.first_name);
        const allPlayers = [
          ...(profiles.find(p => p.id === userId) ? [{ ...profiles.find(p => p.id === userId), isMe: true }] : []),
          ...otherProfiles,
        ];
        const pName = (id) => {
          if (id === userId) return "You";
          const p = profiles.find(p => p.id === id);
          return p ? `${p.first_name} ${p.last_name[0]}.` : "—";
        };

        const addMatch = () => setMatchEntries(m => [...m, { giverId: userId || "", receiverId: "", strokes: 0, result: "" }]);
        const removeMatch = (i) => setMatchEntries(m => m.filter((_, j) => j !== i));
        const updateMatch = (i, field, val) => setMatchEntries(m => m.map((e, j) => j === i ? { ...e, [field]: val } : e));

        const canSaveMatches = matchEntries.length > 0 &&
          matchEntries.every(e => e.giverId && e.receiverId && e.giverId !== e.receiverId && e.result);

        const handleSaveMatchesClick = async () => {
          if (!canSaveMatches || !onSaveMatches) return;
          const courseObj = round.courseId ? courses.find(c => c.id === round.courseId) : null;
          const payload = matchEntries.map(e => ({
            round_date:  round.date,
            course_name: courseObj?.name || round.course || null,
            giver_id:    e.giverId,
            receiver_id: e.receiverId,
            strokes:     +e.strokes,
            result:      e.result,
            stake:       10,
          }));
          await onSaveMatches(payload);
          setMatchSaved(true);
          setTimeout(() => setMatchSaved(false), 2000);
        };

        const resultBtn = (i, val, label, color) => {
          const active = matchEntries[i]?.result === val;
          return (
            <button onClick={() => updateMatch(i, "result", active ? "" : val)} style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              border: `1.5px solid ${active ? color : C.border}`,
              background: active ? color : "transparent",
              color: active ? "#fff" : C.muted,
            }}>{label}</button>
          );
        };

        const selectStyle = {
          border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px",
          fontSize: 13, background: C.bg, color: C.text, outline: "none",
          fontFamily: "inherit", cursor: "pointer",
        };

        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🏆</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Match Play</span>
                <span style={{ fontSize: 11, color: C.muted }}>optional</span>
              </div>
              <button onClick={addMatch} style={{
                background: C.accentLight, color: C.accent, border: `1px solid ${C.accentMid}`,
                borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>+ Add Match</button>
            </div>

            {matchEntries.length === 0 && (
              <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                Log $10 match play results for the Season Standings. Hit "+ Add Match" for each 1v1 that happened today.
              </div>
            )}

            {matchEntries.map((entry, i) => (
              <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Row 1: giver → strokes → receiver */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Giver dropdown */}
                  <select value={entry.giverId} onChange={e => updateMatch(i, "giverId", e.target.value)} style={selectStyle}>
                    <option value="">— Giving strokes —</option>
                    {allPlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.isMe ? "You" : `${p.first_name} ${p.last_name}`}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>gave</span>
                  {/* Strokes input */}
                  <input
                    type="number" min={0} max={36} value={entry.strokes}
                    onChange={e => updateMatch(i, "strokes", e.target.value)}
                    style={{ width: 52, textAlign: "center", border: `1.5px solid ${C.accent}`, borderRadius: 8, padding: "6px 4px", fontSize: 14, fontWeight: 700, color: C.accent, background: C.accentLight, outline: "none", fontFamily: "'DM Mono', monospace" }}
                  />
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>strokes to</span>
                  {/* Receiver dropdown */}
                  <select value={entry.receiverId} onChange={e => updateMatch(i, "receiverId", e.target.value)} style={selectStyle}>
                    <option value="">— Receiving strokes —</option>
                    {allPlayers.filter(p => p.id !== entry.giverId).map(p => (
                      <option key={p.id} value={p.id}>{p.isMe ? "You" : `${p.first_name} ${p.last_name}`}</option>
                    ))}
                  </select>
                  <button onClick={() => removeMatch(i)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16, lineHeight: 1, padding: "2px 4px" }}>✕</button>
                </div>
                {/* Row 2: result */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginRight: 4 }}>Result:</span>
                  {resultBtn(i, "giver",    entry.giverId    ? `${pName(entry.giverId)} won`    : "Giver won",    C.accentMid)}
                  {resultBtn(i, "draw",     "Draw",                                                               C.yellow)}
                  {resultBtn(i, "receiver", entry.receiverId ? `${pName(entry.receiverId)} won` : "Receiver won", C.red)}
                </div>
              </div>
            ))}

            {matchEntries.length > 0 && (
              <button onClick={handleSaveMatchesClick} disabled={!canSaveMatches} style={{
                background: matchSaved ? C.accentMid : canSaveMatches ? C.accent : C.border,
                color: canSaveMatches ? "#fff" : C.muted,
                border: "none", borderRadius: 10, padding: "10px 22px",
                fontSize: 13, fontWeight: 700, cursor: canSaveMatches ? "pointer" : "default",
                alignSelf: "flex-start", transition: "all 0.2s", fontFamily: "inherit",
              }}>
                {matchSaved ? "✓ Matches Saved" : `Save ${matchEntries.length} Match${matchEntries.length !== 1 ? "es" : ""}`}
              </button>
            )}
          </div>
        );
      })()}

      {/* ── SG mode indicator banner ─────────────────────────────────────────── */}
      {sgMode && (
        <div style={{ background: C.accentLight, border: `1px solid ${C.accentMid}`, borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 3 }}>Precision SG Mode — Distance Tracking Active</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              After entering your score and flags for each hole, a green <strong style={{ color: C.accent }}>📍 SG</strong> row will appear below it with contextual distance fields. All distances are in <strong>yards</strong>. Fields are optional — holes without distances fall back to estimated SG.
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: C.muted }}>
              <span>🏌️ <strong>After Tee</strong> — yards to pin after your drive (Par 4/5)</span>
              <span>⛳ <strong>After 2nd</strong> — yards to pin after 2nd shot (Par 5)</span>
              <span>🌿 <strong>Chip from</strong> — yards to pin for your chip/pitch (missed GIR)</span>
              <span>🎯 <strong>Putt 1</strong> — distance of first putt in yards</span>
              <span>🔁 <strong>Putt 2</strong> — only appears on 3-putt holes</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto", width: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              <th style={th(false)}>Hole</th>
              <th style={th()}>Par</th>
              <th style={th()}>HCP</th>
              <th style={th()}>Score</th>
              <th style={th()}>Tee Club</th>
              <th style={th()}>FH</th>
              <th style={th()}>GIR</th>
              <th style={th()}>FW Club</th>
              <th style={th()}>GH</th>
              <th style={th()}>Putts</th>
              <th style={th()}>Up & Down</th>
              <th style={th()}>Penalty</th>
            </tr>
          </thead>
          <tbody>
            {round.holes.map((h, i) => {
              const scoreNum = h.score !== "" ? +h.score : null;
              const relScore = scoreNum !== null ? scoreNum - h.par : null;
              const scoreColor = relScore === null ? C.muted : relScore <= -1 ? C.accentMid : relScore === 0 ? C.text : relScore === 1 ? C.yellow : C.red;
              const isP3 = h.par === 3;
              const holeRow = (
                <tr key={`hole-${i}`} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : "#fafaf8" }}>
                  <td style={{ padding: "6px 6px", fontWeight: 700, color: C.muted, fontSize: 13 }}>{i + 1}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600, color: C.text, fontFamily: "'DM Mono', monospace" }}>{h.par}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center", color: C.muted, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{h.handicap || "—"}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <input type="number" min={1} max={12} value={h.score}
                      onChange={e => setField(i, "score", e.target.value)}
                      style={{ width: 42, textAlign: "center", border: `1.5px solid ${h.score !== "" ? scoreColor : C.border}`, borderRadius: 7, padding: "4px", fontSize: 14, fontWeight: 700, color: scoreColor, background: "transparent", outline: "none", fontFamily: "'DM Mono', monospace" }} />
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <ClubSelect value={h.teeClub} onChange={v => setField(i, "teeClub", v)} />
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    {isP3
                      ? null
                      : <FairwayToggle value={h.fh} onChange={v => setField(i, "fh", v)} />}
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <TwoWay value={h.gir} onChange={v => setField(i, "gir", v)} />
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    {isP3
                      ? null
                      : <ClubSelect value={h.approachClub} onChange={v => setField(i, "approachClub", v)} />}
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    {isP3 || h.gir === true
                      ? null
                      : <TwoWay value={h.gh} onChange={v => setField(i, "gh", v)} />}
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <input type="number" min={0} max={6} value={h.putts}
                      onChange={e => setField(i, "putts", e.target.value)}
                      style={{ width: 38, textAlign: "center", border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px", fontSize: 13, background: "transparent", outline: "none", fontFamily: "'DM Mono', monospace", color: C.text }} />
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    {h.gir === true
                      ? null
                      : <ThreeWay value={h.upAndDown} onChange={v => setField(i, "upAndDown", v)} />}
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <input type="number" min={0} max={9} value={h.penalty}
                      onChange={e => setField(i, "penalty", e.target.value)}
                      style={{ width: 38, textAlign: "center", border: `1px solid ${h.penalty > 0 ? C.red : C.border}`, borderRadius: 7, padding: "4px", fontSize: 13, background: "transparent", outline: "none", fontFamily: "'DM Mono', monospace", color: h.penalty > 0 ? C.red : C.text }} />
                  </td>
                </tr>
              );

              // ── Precision SG distance row (only when sgMode is on) ─────────────────
              // Shown after the hole row, contextually based on par + flags already set
              const hasSomeFlag = h.score !== "" || h.gir !== null || h.fh !== null || h.putts !== "";
              const isP5 = h.par === 5;
              const girMissed = h.gir === false;
              const showPutt2 = h.putts !== "" && +h.putts >= 3;
              const distInput = (field, label, placeholder = "yds", color = C.muted) => (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 58 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color }}>{label}</span>
                  <input
                    type="number" min={0} max={999} value={h[field] ?? ""}
                    onChange={e => setField(i, field, e.target.value)}
                    placeholder={placeholder}
                    style={{
                      width: 52, textAlign: "center",
                      border: `1.5px solid ${h[field] ? C.accent : C.border}`,
                      borderRadius: 7, padding: "4px 2px",
                      fontSize: 12, fontWeight: h[field] ? 700 : 400,
                      color: h[field] ? C.accent : C.muted,
                      background: h[field] ? C.accentLight : "transparent",
                      outline: "none", fontFamily: "'DM Mono', monospace",
                    }}
                  />
                </div>
              );
              const sgRow = sgMode && hasSomeFlag ? (
                <tr key={`sg-${i}`} style={{ background: "#f5f9f7", borderBottom: `1px solid ${C.border}` }}>
                  <td colSpan={12} style={{ padding: "6px 8px 8px 28px" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.accentMid, paddingBottom: 4, flexShrink: 0 }}>📍 SG</span>
                      {/* Tee result: par 4 & 5 only */}
                      {h.par >= 4 && distInput("teeResult", "After Tee")}
                      {/* 2nd shot result: par 5 only */}
                      {isP5 && distInput("approachResult", "After 2nd")}
                      {/* Short game: only when GIR missed */}
                      {girMissed && distInput("shortGameDist", "Chip from", "yds", C.yellow)}
                      {/* Putt 1: always */}
                      {distInput("putt1", "Putt 1")}
                      {/* Putt 2: only if 3-putt+ */}
                      {showPutt2 && distInput("putt2", "Putt 2")}
                      {/* Completion indicator */}
                      {(() => {
                        const needed = [
                          h.par >= 4 ? "teeResult" : null,
                          isP5 ? "approachResult" : null,
                          girMissed ? "shortGameDist" : null,
                          "putt1",
                          showPutt2 ? "putt2" : null,
                        ].filter(Boolean);
                        const filled = needed.filter(f => h[f] !== "" && h[f] !== undefined && h[f] !== null).length;
                        const allFilled = filled === needed.length && needed.length > 0;
                        return (
                          <span style={{ fontSize: 10, color: allFilled ? C.accentMid : C.muted, paddingBottom: 4, fontWeight: allFilled ? 700 : 400 }}>
                            {allFilled ? "✓ complete" : `${filled}/${needed.length}`}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ) : null;

              // After hole 9: insert front-9 summary row
              if (i === 8) {
                const f9 = round.holes.slice(0, 9);
                const f9Score = f9.reduce((s, h) => s + (h.score !== "" ? +h.score : 0), 0);
                const f9Par   = f9.reduce((s, h) => s + h.par, 0);
                const f9Rel   = f9Score - f9Par;
                const f9GIR   = f9.filter(h => h.gir === true).length;
                const f9FHH   = f9.filter(h => h.par > 3 && h.fh !== null && h.fh !== "na");
                const f9FH    = f9FHH.length ? `${f9FHH.filter(h => h.fh === true).length}/${f9FHH.length} FH` : null;
                const f9Putts = f9.filter(h => h.putts !== "").reduce((s, h) => s + +h.putts, 0);
                const f9UDH   = f9.filter(h => h.upAndDown !== null && h.upAndDown !== "na");
                const f9UD    = f9UDH.length ? `${f9UDH.filter(h => h.upAndDown === true).length}/${f9UDH.length} U&D` : null;
                const f9Col   = f9Rel > 0 ? C.red : f9Rel < 0 ? C.accentMid : C.text;
                return [holeRow, sgRow, (
                  <tr key="summary-front" style={{ background: C.accentLight, borderTop: `2px solid ${C.accentMid}`, borderBottom: `2px solid ${C.accentMid}` }}>
                    <td colSpan={12} style={{ padding: "8px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", width: "60%", minWidth: 380 }}>
                        <span style={{ fontWeight: 800, fontSize: 12, color: C.accent, letterSpacing: "0.08em", textTransform: "uppercase", flex: "0 0 64px" }}>Front 9</span>
                        <span style={{ fontWeight: 800, fontSize: 14, color: f9Col, fontFamily: "'DM Mono', monospace", flex: 1, textAlign: "center" }}>
                          {f9Score > 0 ? `${f9Score} (${f9Rel >= 0 ? "+" : ""}${f9Rel})` : "—"}
                        </span>
                        <span style={{ fontSize: 12, color: C.muted, flex: 1, textAlign: "center" }}>{f9GIR}/9 GIR</span>
                        <span style={{ fontSize: 12, color: C.muted, flex: 1, textAlign: "center" }}>{f9FH ?? "— FH"}</span>
                        <span style={{ fontSize: 12, color: C.muted, flex: 1, textAlign: "center" }}>{f9Putts > 0 ? `${f9Putts} putts` : "—"}</span>
                        <span style={{ fontSize: 12, color: C.muted, flex: 1, textAlign: "center" }}>{f9UD ?? "— U&D"}</span>
                      </div>
                    </td>
                  </tr>
                )];
              }
              return [holeRow, sgRow].filter(Boolean);
            })}

            {/* Back 9 summary after hole 18 */}
            {(() => {
              const b9 = round.holes.slice(9, 18);
              const b9Score = b9.reduce((s, h) => s + (h.score !== "" ? +h.score : 0), 0);
              const b9Par   = b9.reduce((s, h) => s + h.par, 0);
              const b9Rel   = b9Score - b9Par;
              const b9GIR   = b9.filter(h => h.gir === true).length;
              const b9FHH   = b9.filter(h => h.par > 3 && h.fh !== null && h.fh !== "na");
              const b9FH    = b9FHH.length ? `${b9FHH.filter(h => h.fh === true).length}/${b9FHH.length} FH` : null;
              const b9Putts = b9.filter(h => h.putts !== "").reduce((s, h) => s + +h.putts, 0);
              const b9UDH   = b9.filter(h => h.upAndDown !== null && h.upAndDown !== "na");
              const b9UD    = b9UDH.length ? `${b9UDH.filter(h => h.upAndDown === true).length}/${b9UDH.length} U&D` : null;
              const b9Col   = b9Rel > 0 ? C.red : b9Rel < 0 ? C.accentMid : C.text;
              return (
                <tr key="summary-back" style={{ background: C.accentLight, borderTop: `2px solid ${C.accentMid}`, borderBottom: `2px solid ${C.accentMid}` }}>
                  <td colSpan={12} style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", width: "60%", minWidth: 380 }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: C.accent, letterSpacing: "0.08em", textTransform: "uppercase", flex: "0 0 64px" }}>Back 9</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: b9Col, fontFamily: "'DM Mono', monospace", flex: 1, textAlign: "center" }}>
                        {b9Score > 0 ? `${b9Score} (${b9Rel >= 0 ? "+" : ""}${b9Rel})` : "—"}
                      </span>
                      <span style={{ fontSize: 12, color: C.muted, flex: 1, textAlign: "center" }}>{b9GIR}/9 GIR</span>
                      <span style={{ fontSize: 12, color: C.muted, flex: 1, textAlign: "center" }}>{b9FH ?? "— FH"}</span>
                      <span style={{ fontSize: 12, color: C.muted, flex: 1, textAlign: "center" }}>{b9Putts > 0 ? `${b9Putts} putts` : "—"}</span>
                      <span style={{ fontSize: 12, color: C.muted, flex: 1, textAlign: "center" }}>{b9UD ?? "— U&D"}</span>
                    </div>
                  </td>
                </tr>
              );
            })()}
          </tbody>
          <tfoot>
            {/* Total round summary */}
            {(() => {
              const allH = round.holes;
              const totScore = allH.reduce((s, h) => s + (h.score !== "" ? +h.score : 0), 0);
              const totPar   = allH.reduce((s, h) => s + h.par, 0);
              const totRel   = totScore - totPar;
              const totGIR   = allH.filter(h => h.gir === true).length;
              const totFHH   = allH.filter(h => h.par > 3 && h.fh !== null && h.fh !== "na");
              const totFH    = totFHH.length ? `${totFHH.filter(h => h.fh === true).length}/${totFHH.length} FH` : null;
              const totPutts = allH.filter(h => h.putts !== "").reduce((s, h) => s + +h.putts, 0);
              const totUDH   = allH.filter(h => h.upAndDown !== null && h.upAndDown !== "na");
              const totUD    = totUDH.length ? `${totUDH.filter(h => h.upAndDown === true).length}/${totUDH.length} U&D` : null;
              const totCol   = totRel > 0 ? C.red : totRel < 0 ? C.accentMid : C.text;
              const tc       = (a) => totScore > 0 ? a : C.muted;
              const tw       = totScore > 0 ? "rgba(255,255,255,0.75)" : C.muted;
              return (
                <tr style={{ background: totScore > 0 ? C.accent : C.surface, borderTop: `2px solid ${C.accent}` }}>
                  <td colSpan={12} style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", width: "60%", minWidth: 380 }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: totScore > 0 ? "rgba(255,255,255,0.7)" : C.muted, letterSpacing: "0.08em", textTransform: "uppercase", flex: "0 0 64px" }}>Total</span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: totScore > 0 ? "#fff" : C.muted, fontFamily: "'DM Mono', monospace", flex: 1, textAlign: "center" }}>
                        {totScore > 0 ? `${totScore} (${totRel >= 0 ? "+" : ""}${totRel})` : "—"}
                      </span>
                      <span style={{ fontSize: 12, color: tw, flex: 1, textAlign: "center" }}>{totGIR}/18 GIR</span>
                      <span style={{ fontSize: 12, color: tw, flex: 1, textAlign: "center" }}>{totFH ?? "— FH"}</span>
                      <span style={{ fontSize: 12, color: tw, flex: 1, textAlign: "center" }}>{totPutts > 0 ? `${totPutts} putts` : "—"}</span>
                      <span style={{ fontSize: 12, color: tw, flex: 1, textAlign: "center" }}>{totUD ?? "— U&D"}</span>
                    </div>
                  </td>
                </tr>
              );
            })()}
          </tfoot>
        </table>
      </div>

      <button onClick={handleSave} style={{
        background: saved ? C.accentMid : C.accent, color: "#fff",
        border: "none", borderRadius: 12, padding: "13px 28px",
        fontSize: 14, fontWeight: 700, cursor: "pointer",
        letterSpacing: "0.04em", alignSelf: "flex-start", transition: "all 0.2s",
      }}>
        {saved ? "✓ Saved" : editingRound ? "Update Round" : "Save Round"}
      </button>
    </div>
  );
}

// ── ROUND VIEWER (read-only scorecard) ───────────────────────────────────────
function RoundViewer({ round, onClose, onEdit }) {
  const hs = round.holes.filter(h => h.score !== "");
  const total = hs.reduce((s, h) => s + +h.score, 0);
  const par = hs.reduce((s, h) => s + h.par, 0);
  const rel = total - par;
  const gir = hs.filter(h => h.gir === true).length;
  const fhH = hs.filter(h => h.par > 3 && h.fh !== null);
  const fhHit = fhH.filter(h => h.fh === true).length;
  const puttsArr = hs.filter(h => h.putts !== "");
  const avgPutts = puttsArr.length ? (puttsArr.reduce((s, h) => s + +h.putts, 0) / puttsArr.length).toFixed(1) : null;

  const relCol = rel <= 0 ? C.accentMid : rel <= 5 ? C.yellow : C.red;

  const badge = (val, par) => {
    const r = val - par;
    const color = r <= -2 ? C.accentMid : r === -1 ? C.accentMid : r === 0 ? C.text : r === 1 ? C.yellow : C.red;
    const num = <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 12, color, lineHeight: 1, position: "relative", zIndex: 1 }}>{val}</span>;
    const size = 28;
    const wrap = (children) => <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, position: "relative" }}>{children}</span>;

    if (r <= -2) {
      // Eagle or better: double circle
      return wrap(<>
        <span style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `1.5px solid ${color}`, top: 0, left: 0 }} />
        <span style={{ position: "absolute", width: size - 5, height: size - 5, borderRadius: "50%", border: `1.5px solid ${color}`, top: 2.5, left: 2.5 }} />
        {num}
      </>);
    }
    if (r === -1) {
      // Birdie: single circle
      return wrap(<>
        <span style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `1.5px solid ${color}`, top: 0, left: 0 }} />
        {num}
      </>);
    }
    if (r === 0) {
      // Par: no shape
      return wrap(num);
    }
    if (r === 1) {
      // Bogey: single square
      return wrap(<>
        <span style={{ position: "absolute", width: size, height: size, borderRadius: 3, border: `1.5px solid ${color}`, top: 0, left: 0 }} />
        {num}
      </>);
    }
    // Double bogey or worse: double square
    return wrap(<>
      <span style={{ position: "absolute", width: size, height: size, borderRadius: 3, border: `1.5px solid ${color}`, top: 0, left: 0 }} />
      <span style={{ position: "absolute", width: size - 5, height: size - 5, borderRadius: 2, border: `1.5px solid ${color}`, top: 2.5, left: 2.5 }} />
      {num}
    </>);
  };

  const chip = (val) => {
    if (val === true) return <span style={{ color: C.accentMid, fontWeight: 700 }}>✓</span>;
    if (val === false) return <span style={{ color: C.red, fontWeight: 700 }}>✗</span>;
    if (val === "left") return <span style={{ color: C.yellow, fontWeight: 700 }}>←</span>;
    if (val === "right") return <span style={{ color: C.yellow, fontWeight: 700 }}>→</span>;
    if (val === "na") return <span style={{ color: C.border }}>—</span>;
    return <span style={{ color: C.border }}>·</span>;
  };

  const td = { padding: "7px 6px", textAlign: "center", fontSize: 12, borderBottom: `1px solid ${C.border}` };
  const tdL = { ...td, textAlign: "left" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0, fontFamily: "inherit" }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: C.text }}>{round.course || "Unnamed Course"}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{round.date}</div>
        </div>
        <button onClick={() => onEdit(round)} style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentMid}`, borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Edit Round</button>
      </div>

      {/* Summary stat pills */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { label: "Score", value: hs.length ? `${rel >= 0 ? "+" : ""}${rel} (${total})` : "—", color: relCol },
          { label: "GIR", value: `${gir}/${hs.length}` },
          { label: "FH", value: fhH.length ? `${fhHit}/${fhH.length}` : "—" },
          { label: "Putts/hole", value: avgPutts ?? "—" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted }}>{label}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 15, color: color || C.text }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Scorecard table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {["Hole","Par","HCP","Score","Tee","FH","GIR","Club","GH","Putts","U&D","Pen"].map((h, i) => (
                <th key={h} style={{ padding: "8px 6px", color: C.muted, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", fontSize: 10, textAlign: i === 0 ? "left" : "center", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {round.holes.map((h, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C.bg }}>
                <td style={{ ...tdL, fontWeight: 600, color: C.muted }}>{i + 1}</td>
                <td style={td}>{h.par}</td>
                <td style={{ ...td, color: C.muted }}>{h.handicap}</td>
                <td style={td}>{h.score !== "" ? badge(+h.score, h.par) : <span style={{ color: C.border }}>—</span>}</td>
                <td style={{ ...td, color: C.muted }}>{h.teeClub || "—"}</td>
                <td style={td}>{h.par === 3 ? <span style={{ color: C.border }}>—</span> : chip(h.fh)}</td>
                <td style={td}>{chip(h.gir)}</td>
                <td style={{ ...td, color: C.muted }}>{h.approachClub || "—"}</td>
                <td style={td}>{chip(h.gh)}</td>
                <td style={{ ...td, fontFamily: "'DM Mono', monospace" }}>{h.putts !== "" ? h.putts : <span style={{ color: C.border }}>—</span>}</td>
                <td style={td}>{chip(h.upAndDown)}</td>
                <td style={{ ...td, color: h.penalty > 0 ? C.red : C.border, fontWeight: h.penalty > 0 ? 700 : 400 }}>{h.penalty > 0 ? h.penalty : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {(() => {
              const totPutts = puttsArr.reduce((s, h) => s + +h.putts, 0);
              const totUD = hs.filter(h => h.upAndDown === true).length;
              const udAttempts = hs.filter(h => h.upAndDown === true || h.upAndDown === false).length;
              const ftd = { ...td, fontWeight: 700, fontFamily: "'DM Mono', monospace", background: C.accentLight };
              const ftdMuted = { ...ftd, color: C.muted, fontFamily: "inherit" };
              return (
                <tr style={{ borderTop: `2px solid ${C.border}` }}>
                  <td colSpan={3} style={{ ...tdL, fontWeight: 700, color: C.accent, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", background: C.accentLight }}>Total</td>
                  <td style={{ ...ftd, color: relCol }}>
                    {hs.length ? <>{total} <span style={{ fontSize: 11, color: relCol }}>({rel >= 0 ? "+" : ""}{rel})</span></> : "—"}
                  </td>
                  <td style={{ ...ftdMuted, background: C.accentLight }}>—</td>
                  <td style={{ ...ftd, color: C.text }}>{fhH.length ? fhHit : "—"}</td>
                  <td style={{ ...ftd, color: C.text }}>{gir}</td>
                  <td style={{ ...ftdMuted, background: C.accentLight }}>—</td>
                  <td style={{ ...ftdMuted, background: C.accentLight }}>—</td>
                  <td style={{ ...ftd, color: C.text }}>{puttsArr.length ? totPutts : "—"}</td>
                  <td style={{ ...ftd, color: C.text }}>{udAttempts ? totUD : "—"}</td>
                  <td style={{ ...ftdMuted, background: C.accentLight }}>—</td>
                </tr>
              );
            })()}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── ROUND HISTORY ────────────────────────────────────────────────────────────
function History({ rounds, onDelete, onEdit }) {
  const [viewing, setViewing] = useState(null);

  if (viewing) {
    return <RoundViewer round={viewing} onClose={() => setViewing(null)} onEdit={r => { setViewing(null); onEdit(r); }} />;
  }

  if (!rounds.length) return <div style={{ color: C.muted, padding: "40px 0", textAlign: "center" }}>No rounds logged yet.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[...rounds].reverse().map(r => {
        const hs = r.holes.filter(h => h.score !== "");
        const total = hs.reduce((s, h) => s + +h.score, 0);
        const par = hs.reduce((s, h) => s + h.par, 0);
        const rel = total - par;
        const gir = hs.filter(h => h.gir === true).length;
        const girPct = hs.length ? Math.round(gir / hs.length * 100) : 0;
        const fhH = hs.filter(h => h.par > 3 && h.fh !== null);
        const fhHit = fhH.filter(h => h.fh === true).length;
        const fhPct = fhH.length ? Math.round(fhHit / fhH.length * 100) : null;
        const puttsArr = hs.filter(h => h.putts !== "");
        const avgPutts = puttsArr.length ? (puttsArr.reduce((s, h) => s + +h.putts, 0) / puttsArr.length).toFixed(1) : null;

        return (
          <div key={r.id} onClick={() => setViewing(r)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: "flex", gap: 20, alignItems: "center", cursor: "pointer", transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.accentMid}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{r.course || "Unnamed Course"}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{r.date}</span>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {hs.length > 0 && <span style={{ fontSize: 13, color: rel > 0 ? C.red : rel <= 0 ? C.accentMid : C.text, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{rel >= 0 ? "+" : ""}{rel} ({total})</span>}
                <span style={{ fontSize: 12, color: C.muted }}>GIR {girPct}%</span>
                {fhPct !== null && <span style={{ fontSize: 12, color: C.muted }}>FH {fhPct}%</span>}
                {avgPutts && <span style={{ fontSize: 12, color: C.muted }}>{avgPutts} putts/hole</span>}
                <span style={{ fontSize: 12, color: C.muted }}>{hs.length} holes</span>
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); onEdit(r); }} style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentMid}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
            <button onClick={e => { e.stopPropagation(); onDelete(r.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.border, fontSize: 18, padding: 4 }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ── APP ROOT ─────────────────────────────────────────────────────────────────
export default function GolfTracker() {
  const [tab, setTab] = useState("dashboard");
  const [rounds, setRounds] = useState([]);
  const [matches, setMatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editingRound, setEditingRound] = useState(null);
  const [session, setSession] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ── Listen for auth state changes ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) { setRounds([]); setLoaded(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load shared courses and profiles once on mount ────────────────────────
  useEffect(() => {
    loadCourses().then(setCourses);
    loadProfiles().then(setProfiles);
    loadMatches().then(setMatches);
  }, []);

  // ── Load user's rounds when session is available ───────────────────────────
  useEffect(() => {
    if (!session?.access_token) return;
    setLoaded(false);
    loadRounds(session.access_token).then(r => {
      setRounds(r || []);
      setLoaded(true);
    });
  }, [session]);

  const token = session?.access_token;
  const userId = session?.user?.id;

  const handleSaveRound = useCallback((round) => {
    setRounds(prev => {
      const updated = [...prev, round];
      saveRounds(updated, token);
      return updated;
    });
  }, [token]);

  const handleDeleteRound = useCallback((id) => {
    const updated = rounds.filter(r => r.id !== id);
    setRounds(updated);
    saveRounds(updated, token);
  }, [rounds, token]);

  const handleEditRound = useCallback((round) => {
    setEditingRound(round);
    setTab("log");
  }, []);

  const handleUpdateRound = useCallback((round) => {
    setRounds(prev => {
      const updated = prev.map(r => r.id === round.id ? round : r);
      saveRounds(updated, token);
      return updated;
    });
    setEditingRound(null);
  }, [token]);

  const handleSaveMatches = useCallback(async (newMatches) => {
    const saved = await saveMatches(newMatches, token);
    if (saved && saved.length) {
      setMatches(prev => [...prev, ...saved]);
    }
  }, [token]);

  const handleDeleteMatch = useCallback(async (id) => {
    await deleteMatch(id, token);
    setMatches(prev => prev.filter(m => m.id !== id));
  }, [token]);

  const handleSaveCourse = useCallback(async (course, editingId) => {
    if (editingId) {
      const updated = await updateCourse({ ...course, id: editingId }, token);
      setCourses(prev => prev.map(c => c.id === editingId ? updated : c));
    } else {
      const created = await createCourse(course, token);
      setCourses(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    }
  }, [token]);

  const handleDeleteCourse = useCallback(async (id) => {
    await deleteCourse(id, token);
    setCourses(prev => prev.filter(c => c.id !== id));
  }, [token]);

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "history", label: "History" },
    { id: "courses", label: "Courses" },
  ];

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; width: 100%; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        @media (max-width: 600px) {
          .fairway-nav { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
        }
      `}</style>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          userId={userId}
          token={token}
          profiles={profiles}
          onProfileUpdated={setProfiles}
        />
      )}

      {/* Header */}
      <div className="fairway-nav" style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 3vw", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: C.accent }}>⛳ Fairway Caddie</span>
          <span style={{ fontSize: 13, color: C.muted, fontFamily: "'DM Mono', monospace" }}>powered by BGM</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {/* Leaderboard always visible; rest only when logged in */}
          {tabs.filter(t => session || t.id === "leaderboard").map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "log") setEditingRound(null); }} style={{
              background: tab === t.id ? C.accentLight : "transparent",
              border: `1px solid ${tab === t.id ? C.accentMid : "transparent"}`,
              color: tab === t.id ? C.accent : C.muted,
              borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>{t.label}</button>
          ))}
          {session ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => { setTab("log"); setEditingRound(null); }} style={{
                background: tab === "log" ? C.accent : C.accent,
                border: "none",
                color: "#fff",
                borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: "0 1px 4px rgba(45,106,79,0.25)",
              }}>＋ Log Round</button>
              <button onClick={() => setShowSettings(true)} title="Profile settings" style={{
                background: "transparent", border: `1px solid ${C.border}`,
                color: C.muted, borderRadius: 8, padding: "6px 10px",
                fontSize: 15, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center",
              }}>⚙️</button>
              <button onClick={() => supabase.auth.signOut()} style={{
                background: "transparent", border: `1px solid ${C.border}`,
                color: C.muted, borderRadius: 8, padding: "6px 14px",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>Log Out</button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{
              background: C.accent, color: "#fff", border: "none",
              borderRadius: 8, padding: "6px 16px",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Log In</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ width: "94vw", margin: "0 auto", padding: "32px 0" }}>
        {/* Leaderboard is public — visible without login */}
        {tab === "leaderboard" && <Leaderboard rounds={rounds} courses={courses} profiles={profiles} userId={userId} matches={matches} onDeleteMatch={handleDeleteMatch} />}

        {!session && tab !== "leaderboard" ? (
          <div style={{ textAlign: "center", padding: "100px 0", color: C.muted }}>
            <div style={{ fontSize: 52 }}>⛳</div>
            <div style={{ marginTop: 16, fontSize: 20, fontWeight: 700, color: C.text }}>Fairway Caddie</div>
            <div style={{ marginTop: 8, fontSize: 15, marginBottom: 28 }}>Track your rounds, improve your game.</div>
            <button onClick={() => setShowAuth(true)} style={{
              background: C.accent, color: "#fff", border: "none", borderRadius: 12,
              padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>Get Started</button>
          </div>
        ) : !loaded && session && tab !== "leaderboard" ? (
          <div style={{ padding: 40, color: C.muted }}>Loading…</div>
        ) : session && tab !== "leaderboard" ? (
          <>
            {tab === "dashboard" && <Dashboard rounds={rounds} courses={courses} sgMode={!!(profiles.find(p => p.id === userId)?.sg_mode)} userHandicap={profiles.find(p => p.id === userId)?.handicap ?? null} />}
            {tab === "log" && <ScorecardEntry courses={courses} editingRound={editingRound} sgMode={!!(profiles.find(p => p.id === userId)?.sg_mode)} userId={userId} profiles={profiles} onSaveMatches={handleSaveMatches} onSave={r => { handleSaveRound(r); setTab("history"); }} onUpdate={r => { handleUpdateRound(r); setTab("history"); }} />}
            {tab === "history" && <History rounds={rounds} onDelete={handleDeleteRound} onEdit={handleEditRound} />}
            {tab === "courses" && <Courses courses={courses} onSave={handleSaveCourse} onDelete={handleDeleteCourse} userId={userId} />}
          </>
        ) : null}
      </div>
    </div>
  );
}
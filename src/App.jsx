import { useState, useEffect, useCallback } from "react";

// ALL_CLUBS is the single source of truth for club dropdowns throughout the app
const ALL_CLUBS = ["Dr","3w","Hybrid","4i","5i","6i","7i","8i","9i","PW","GW","SW","LW"];

const defaultHoles = (courseHoles) =>
  Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: courseHoles ? courseHoles[i].par : 4,
    handicap: courseHoles ? courseHoles[i].handicap : i + 1,
    score: "",
    teeClub: "",
    fh: null,
    gir: null,
    approachClub: "",
    gh: null,
    putts: "",
    upAndDown: null,
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
  holes: Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: 4,
    handicap: i + 1,
  })),
});

// ── Storage helpers (local server → data.json) ───────────────────────────────
const API = "http://localhost:3001/api/data";

async function loadData() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { rounds: [], courses: [] };
  }
}

async function saveData(rounds, courses) {
  try {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds, courses }),
    });
  } catch (err) {
    console.error("Could not save data:", err);
  }
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

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ rounds }) {
  if (rounds.length === 0) return (
    <div style={{ textAlign: "center", padding: "80px 0", color: C.muted }}>
      <div style={{ fontSize: 48 }}>⛳</div>
      <div style={{ marginTop: 12, fontSize: 16 }}>No rounds yet. Log your first round to see stats.</div>
    </div>
  );

  const allHoles = rounds.flatMap(r => r.holes.filter(h => h.score !== ""));
  const totalHoles = allHoles.length;
  const totalRounds = rounds.filter(r => r.holes.some(h => h.score !== "")).length;

  const avgScoreNum = totalHoles ? allHoles.reduce((s, h) => s + (+h.score - h.par), 0) / totalRounds : null;
  const avgScore = avgScoreNum !== null ? avgScoreNum.toFixed(1) : "—";

  const girHoles = allHoles.filter(h => h.gir === true);
  const girPct = totalHoles ? Math.round((girHoles.length / totalHoles) * 100) : 0;
  const fhHoles = allHoles.filter(h => h.par > 3 && h.fh !== null && h.fh !== "na");
  const fhPct = fhHoles.length ? Math.round((fhHoles.filter(h => h.fh === true).length / fhHoles.length) * 100) : 0;
  const puttHoles = allHoles.filter(h => h.putts !== "");
  const avgPutts = puttHoles.length ? (puttHoles.reduce((s, h) => s + +h.putts, 0) / puttHoles.length).toFixed(1) : "—";

  const roundStats = rounds.map(r => {
    const hs = r.holes.filter(h => h.score !== "");
    if (!hs.length) return null;
    const rel = hs.reduce((s, h) => s + (+h.score - h.par), 0);
    return { course: r.course || "Unnamed", date: r.date, rel };
  }).filter(Boolean).slice(-8);

  const birdieOrBetter = allHoles.filter(h => +h.score <= h.par - 1).length;
  const pars = allHoles.filter(h => +h.score === h.par).length;
  const bogeys = allHoles.filter(h => +h.score === h.par + 1).length;
  const doubles = allHoles.filter(h => +h.score >= h.par + 2).length;

  const clubMap = {};
  allHoles.forEach(h => {
    if (h.approachClub && h.approachClub !== "") {
      if (!clubMap[h.approachClub]) clubMap[h.approachClub] = { attempts: 0, gir: 0 };
      clubMap[h.approachClub].attempts++;
      if (h.gir === true) clubMap[h.approachClub].gir++;
    }
  });
  const clubStats = Object.entries(clubMap)
    .map(([club, { attempts, gir }]) => ({ club, attempts, girPct: Math.round((gir / attempts) * 100) }))
    .sort((a, b) => b.attempts - a.attempts);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatCard label="Avg Score" value={avgScoreNum !== null ? (avgScoreNum >= 0 ? `+${avgScore}` : avgScore) : "—"} sub={`${totalRounds} rounds`} accent />
        <StatCard label="GIR %" value={`${girPct}%`} sub={`${girHoles.length} of ${totalHoles} holes`} />
        <StatCard label="FW Hit %" value={`${fhPct}%`} sub="Par 4s & 5s" />
        <StatCard label="Avg Putts" value={avgPutts} sub="per hole" />
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Scoring Distribution</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
          {[
            { label: "Birdie+", count: birdieOrBetter, color: C.accentMid },
            { label: "Par", count: pars, color: C.accent },
            { label: "Bogey", count: bogeys, color: C.yellow },
            { label: "Double+", count: doubles, color: C.red },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: C.muted }}>{label}</span>
                <span style={{ fontWeight: 600, color: C.text, fontFamily: "'DM Mono', monospace" }}>{totalHoles ? Math.round(count / totalHoles * 100) : 0}%</span>
              </div>
              <MiniBar pct={totalHoles ? count / totalHoles * 100 : 0} color={color} />
              <div style={{ fontSize: 11, color: C.muted }}>{count} holes</div>
            </div>
          ))}
        </div>
      </div>

      {clubStats.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Club Performance</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {clubStats.map(({ club, attempts, girPct: gp }) => {
              const color = gp >= 60 ? C.accentMid : gp >= 35 ? C.yellow : C.red;
              return (
                <div key={club} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 52, fontWeight: 700, fontSize: 14, color: C.text, fontFamily: "'DM Mono', monospace" }}>{club}</div>
                  <div style={{ flex: 1 }}><MiniBar pct={gp} color={color} /></div>
                  <div style={{ width: 52, textAlign: "right", fontWeight: 700, fontSize: 14, color, fontFamily: "'DM Mono', monospace" }}>{gp}%</div>
                  <div style={{ width: 72, fontSize: 12, color: C.muted, textAlign: "right" }}>{attempts} attempt{attempts !== 1 ? "s" : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {roundStats.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Recent Rounds</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...roundStats].reverse().map((r, i) => {
              const col = r.rel <= 0 ? C.accentMid : r.rel <= 5 ? C.yellow : C.red;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 13, color: C.muted, width: 90, flexShrink: 0 }}>{r.date}</div>
                  <div style={{ fontSize: 14, color: C.text, flex: 1, fontWeight: 500 }}>{r.course || "—"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: col, fontFamily: "'DM Mono', monospace", width: 50, textAlign: "right" }}>
                    {r.rel >= 0 ? `+${r.rel}` : r.rel}
                  </div>
                  <div style={{ width: 80 }}><MiniBar pct={Math.min(100, 60 + r.rel * -3)} color={col} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── COURSES TAB ──────────────────────────────────────────────────────────────
function Courses({ courses, onSave, onDelete }) {
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
      return { ...c, holes, par: totalPar };
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
        <div style={{ fontSize: 13, color: C.muted }}>{courses.length} course{courses.length !== 1 ? "s" : ""} saved</div>
        <button onClick={startNew} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Add Course
        </button>
      </div>
      {courses.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
          <div style={{ fontSize: 40 }}>🏌️</div>
          <div style={{ marginTop: 12 }}>No courses yet. Add one to speed up round logging.</div>
        </div>
      )}
      {courses.map(c => (
        <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>{c.name}</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: C.muted }}>Par {c.par}</span>
              {c.yardage && <span style={{ fontSize: 12, color: C.muted }}>{c.yardage} yds</span>}
              {c.rating && <span style={{ fontSize: 12, color: C.muted }}>Rating {c.rating}</span>}
              {c.slope && <span style={{ fontSize: 12, color: C.muted }}>Slope {c.slope}</span>}
            </div>
          </div>
          <button onClick={() => startEdit(c)} style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accentMid}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
          <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.border, fontSize: 18, padding: 4 }}>✕</button>
        </div>
      ))}
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
          <label style={labelStyle}>Yardage</label>
          <input type="number" value={course.yardage} onChange={e => setCourse(c => ({ ...c, yardage: e.target.value }))} placeholder="6800" style={inputStyle} />
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
                {["Hole", "Par", "Handicap"].map(h => (
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
function ScorecardEntry({ onSave, courses }) {
  const [round, setRound] = useState(defaultRound());
  const [saved, setSaved] = useState(false);

  const selectCourse = (courseId) => {
    const course = courses.find(c => c.id === +courseId) || null;
    setRound(r => ({ ...defaultRound(course), date: r.date }));
  };

  const setField = (idx, field, val) => {
    setRound(r => {
      const holes = [...r.holes];
      const updated = { ...holes[idx], [field]: val };
      if (field === "gir" && val !== false) updated.approachClub = "";
      holes[idx] = updated;
      return { ...r, holes };
    });
  };

  const handleSave = () => {
    onSave(round);
    setSaved(true);
    setTimeout(() => { setSaved(false); setRound(defaultRound()); }, 1500);
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
          {courses.length > 0 ? (
            <select value={round.courseId || ""}
              onChange={e => e.target.value ? selectCourse(e.target.value) : setRound(r => ({ ...defaultRound(), date: r.date }))}
              style={inputStyle}>
              <option value="">— Select or type below —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <input value={round.course} onChange={e => setRound(r => ({ ...r, course: e.target.value }))}
              placeholder="Course name" style={inputStyle} />
          )}
          {courses.length > 0 && !round.courseId && (
            <input value={round.course} onChange={e => setRound(r => ({ ...r, course: e.target.value }))}
              placeholder="Or type course name" style={{ ...inputStyle, marginTop: 8 }} />
          )}
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={round.date} onChange={e => setRound(r => ({ ...r, date: e.target.value }))} style={inputStyle} />
        </div>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {round.holes.map((h, i) => {
              const scoreNum = h.score !== "" ? +h.score : null;
              const relScore = scoreNum !== null ? scoreNum - h.par : null;
              const scoreColor = relScore === null ? C.muted : relScore <= -1 ? C.accentMid : relScore === 0 ? C.text : relScore === 1 ? C.yellow : C.red;
              const isP3 = h.par === 3;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : "#fafaf8" }}>
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
                      ? <span style={{ color: C.border, fontSize: 13, fontWeight: 700 }}>—</span>
                      : <ThreeWay value={h.fh} onChange={v => setField(i, "fh", v)} />
                    }
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <TwoWay value={h.gir} onChange={v => setField(i, "gir", v)} />
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <ClubSelect value={h.approachClub} onChange={v => setField(i, "approachClub", v)} />
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <TwoWay value={h.gh} onChange={v => setField(i, "gh", v)} />
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <input type="number" min={0} max={6} value={h.putts}
                      onChange={e => setField(i, "putts", e.target.value)}
                      style={{ width: 38, textAlign: "center", border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px", fontSize: 13, background: "transparent", outline: "none", fontFamily: "'DM Mono', monospace", color: C.text }} />
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <ThreeWay value={h.upAndDown} onChange={v => setField(i, "upAndDown", v)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${C.border}` }}>
              <td colSpan={3} style={{ padding: "10px 6px", fontWeight: 700, fontSize: 13, color: C.muted }}>Total</td>
              <td style={{ textAlign: "center", padding: "10px 4px", fontWeight: 800, fontSize: 15, color: rel > 0 ? C.red : rel < 0 ? C.accentMid : C.text, fontFamily: "'DM Mono', monospace" }}>
                {total > 0 ? `${total} (${rel >= 0 ? "+" : ""}${rel})` : "—"}
              </td>
              <td colSpan={7} />
            </tr>
          </tfoot>
        </table>
      </div>

      <button onClick={handleSave} style={{
        background: saved ? C.accentMid : C.accent, color: "#fff",
        border: "none", borderRadius: 12, padding: "13px 28px",
        fontSize: 14, fontWeight: 700, cursor: "pointer",
        letterSpacing: "0.04em", alignSelf: "flex-start", transition: "all 0.2s",
      }}>
        {saved ? "✓ Round Saved" : "Save Round"}
      </button>
    </div>
  );
}

// ── ROUND HISTORY ────────────────────────────────────────────────────────────
function History({ rounds, onDelete }) {
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
        const fhH = hs.filter(h => h.par > 3 && h.fh !== null && h.fh !== "na");
        const fhPct = fhH.length ? Math.round(fhH.filter(h => h.fh).length / fhH.length * 100) : null;
        const puttsArr = hs.filter(h => h.putts !== "");
        const avgPutts = puttsArr.length ? (puttsArr.reduce((s, h) => s + +h.putts, 0) / puttsArr.length).toFixed(1) : null;

        return (
          <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: "flex", gap: 20, alignItems: "center" }}>
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
            <button onClick={() => onDelete(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.border, fontSize: 18, padding: 4 }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ── APP ROOT ─────────────────────────────────────────────────────────────────
export default function GolfTracker() {
  const [tab, setTab] = useState("log");
  const [rounds, setRounds] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadData().then(({ rounds: r, courses: c }) => {
      setRounds(r || []);
      setCourses(c || []);
      setLoaded(true);
    });
  }, []);

  const handleSaveRound = useCallback((round) => {
    const updatedRounds = [...rounds, round];
    setRounds(updatedRounds);
    saveData(updatedRounds, courses);
  }, [rounds, courses]);

  const handleDeleteRound = useCallback((id) => {
    const updatedRounds = rounds.filter(r => r.id !== id);
    setRounds(updatedRounds);
    saveData(updatedRounds, courses);
  }, [rounds, courses]);

  const handleSaveCourse = useCallback((course, editingId) => {
    const updatedCourses = editingId
      ? courses.map(c => c.id === editingId ? { ...course, id: editingId } : c)
      : [...courses, { ...course, id: Date.now() }];
    setCourses(updatedCourses);
    saveData(rounds, updatedCourses);
  }, [rounds, courses]);

  const handleDeleteCourse = useCallback((id) => {
    const updatedCourses = courses.filter(c => c.id !== id);
    setCourses(updatedCourses);
    saveData(rounds, updatedCourses);
  }, [rounds, courses]);

  if (!loaded) return <div style={{ padding: 40, color: C.muted, fontFamily: "Georgia, serif" }}>Loading…</div>;

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "log", label: "Log Round" },
    { id: "history", label: "History" },
    { id: "courses", label: "Courses" },
  ];

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: C.accent }}>⛳ Fairway</span>
          <span style={{ fontSize: 13, color: C.muted, fontFamily: "'DM Mono', monospace" }}>golf tracker</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? C.accentLight : "transparent",
              border: `1px solid ${tab === t.id ? C.accentMid : "transparent"}`,
              color: tab === t.id ? C.accent : C.muted,
              borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content — full width with 100px side buffers */}
      <div style={{ width: "100%", boxSizing: "border-box", padding: "32px 100px" }}>
        {tab === "dashboard" && <Dashboard rounds={rounds} />}
        {tab === "log" && <ScorecardEntry courses={courses} onSave={r => { handleSaveRound(r); setTab("history"); }} />}
        {tab === "history" && <History rounds={rounds} onDelete={handleDeleteRound} />}
        {tab === "courses" && <Courses courses={courses} onSave={handleSaveCourse} onDelete={handleDeleteCourse} />}
      </div>
    </div>
  );
}
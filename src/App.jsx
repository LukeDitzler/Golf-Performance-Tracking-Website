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
    penalty: 0,
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
const API = "/api/data";

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
  const [timeFilter, setTimeFilter] = useState("all");

  if (rounds.length === 0) return (
    <div style={{ textAlign: "center", padding: "80px 0", color: C.muted }}>
      <div style={{ fontSize: 48 }}>⛳</div>
      <div style={{ marginTop: 12, fontSize: 16 }}>No rounds yet. Log your first round to see stats.</div>
    </div>
  );

  const now = new Date();
  const filteredRounds = rounds.filter(r => {
    if (timeFilter === "all") return true;
    const months = timeFilter === "1m" ? 1 : 3;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return new Date(r.date) >= cutoff;
  });

  const allHoles = filteredRounds.flatMap(r => r.holes.filter(h => h.score !== ""));
  const totalHoles = allHoles.length;
  const totalRounds = filteredRounds.filter(r => r.holes.some(h => h.score !== "")).length;

  const avgScoreNum = totalRounds > 0 ? allHoles.reduce((s, h) => s + (+h.score - h.par), 0) / totalRounds : null;
  const avgScore = avgScoreNum !== null ? avgScoreNum.toFixed(1) : "—";

  const girHoles = allHoles.filter(h => h.gir === true);
  const girPct = totalHoles ? Math.round((girHoles.length / totalHoles) * 100) : 0;
  const fhHoles    = allHoles.filter(h => h.par > 3 && h.fh !== null);
  const fhHit      = fhHoles.filter(h => h.fh === true).length;
  const fhLeft     = fhHoles.filter(h => h.fh === "left").length;
  const fhRight    = fhHoles.filter(h => h.fh === "right").length;
  const fhPct      = fhHoles.length ? Math.round((fhHit / fhHoles.length) * 100) : 0;
  const puttHoles = allHoles.filter(h => h.putts !== "");
  const avgPutts = puttHoles.length ? (puttHoles.reduce((s, h) => s + +h.putts, 0) / puttHoles.length).toFixed(1) : "—";
  const udHoles  = allHoles.filter(h => h.upAndDown !== null && h.upAndDown !== "na");
  const udHit    = udHoles.filter(h => h.upAndDown === true).length;
  const udPct    = udHoles.length ? Math.round((udHit / udHoles.length) * 100) : 0;

  const roundStats = filteredRounds.map(r => {
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
  const APPROACH_ORDER = ["SW","GW","PW","9i","8i","7i","6i","5i","4i","Hybrid"];
  const clubStats = Object.entries(clubMap)
    .map(([club, { attempts, gir }]) => ({ club, attempts, gir, girPct: Math.round((gir / attempts) * 100) }))
    .sort((a, b) => {
      const ai = APPROACH_ORDER.indexOf(a.club), bi = APPROACH_ORDER.indexOf(b.club);
      if (ai === -1 && bi === -1) return b.attempts - a.attempts;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  const TIME_FILTERS = [
    { id: "all", label: "All" },
    { id: "3m", label: "3 Months" },
    { id: "1m", label: "1 Month" },
  ];

  const noData = totalHoles === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Time filter pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {TIME_FILTERS.map(f => (
          <button key={f.id} onClick={() => setTimeFilter(f.id)} style={{
            padding: "5px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
            cursor: "pointer", border: `1.5px solid ${timeFilter === f.id ? C.accent : C.border}`,
            background: timeFilter === f.id ? C.accent : "transparent",
            color: timeFilter === f.id ? "#fff" : C.muted,
            transition: "all 0.15s", fontFamily: "inherit",
          }}>{f.label}</button>
        ))}
        {timeFilter !== "all" && (
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>
            {totalRounds} round{totalRounds !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {noData ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.muted }}>
          <div style={{ fontSize: 36 }}>🗓️</div>
          <div style={{ marginTop: 10, fontSize: 15 }}>No rounds in this period.</div>
        </div>
      ) : (<>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatCard label="Avg Score" value={avgScoreNum !== null ? (avgScoreNum >= 0 ? `+${avgScore}` : avgScore) : "—"} sub={`${totalRounds} rounds`} accent />
        <StatCard label="GIR %" value={`${girPct}%`} sub={`${girHoles.length}/${totalHoles}`} />
        <StatCard label="FW Hit %" value={`${fhPct}%`} sub={`${fhHit}/${fhHoles.length}`} />
        <StatCard label="Avg Putts" value={avgPutts} sub="per hole" />
        <StatCard label="Up & Down %" value={udHoles.length ? `${udPct}%` : "—"} sub={udHoles.length ? `${udHit}/${udHoles.length}` : "no data"} />
      </div>

      {fhHoles.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Fairway Distribution</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { label: "← Left",  count: fhLeft,  color: C.yellow },
              { label: "✓ Hit",   count: fhHit,   color: C.accentMid },
              { label: "Right →", count: fhRight, color: C.yellow },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: C.muted }}>{label}</span>
                  <span style={{ fontWeight: 600, color: C.text, fontFamily: "'DM Mono', monospace" }}>{fhHoles.length ? Math.round(count / fhHoles.length * 100) : 0}%</span>
                </div>
                <MiniBar pct={fhHoles.length ? count / fhHoles.length * 100 : 0} color={color} />
                <div style={{ fontSize: 11, color: C.muted }}>{count} of {fhHoles.length}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        </div>
      )}

      {/* ── Scoring by Par Type ─────────────────────────────────────────────── */}
      {(() => {
        const parTypes = [3, 4, 5];
        const parData = parTypes.map(par => {
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
                const dist = [
                  { label: "Birdie+", count: bird, color: C.accentMid },
                  { label: "Par", count: p, color: C.accent },
                  { label: "Bogey", count: bog, color: C.yellow },
                  { label: "Dbl+", count: dbl, color: C.red },
                ];
                return (
                  <div key={par}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Par {par}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 20, color: relCol }}>{relStr}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>avg / hole · {count} holes</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                      {dist.map(({ label, count: c, color }) => (
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

      {/* ── Score vs GIR ───────────────────────────────────────────────────── */}
      {(() => {
        const girHit = allHoles.filter(h => h.gir === true && h.score !== "");
        const girMiss = allHoles.filter(h => h.gir === false && h.score !== "");
        if (!girHit.length && !girMiss.length) return null;
        const avgHit = girHit.length ? (girHit.reduce((s, h) => s + (+h.score - h.par), 0) / girHit.length) : null;
        const avgMiss = girMiss.length ? (girMiss.reduce((s, h) => s + (+h.score - h.par), 0) / girMiss.length) : null;

        const roundGIR = rounds.map(r => {
          const hs = r.holes.filter(h => h.score !== "");
          if (hs.length < 9) return null;
          const girCount = hs.filter(h => h.gir === true).length;
          const girPctR = Math.round(girCount / hs.length * 100);
          const rel = hs.reduce((s, h) => s + (+h.score - h.par), 0);
          return { date: r.date, course: r.course || "Unnamed", girPct: girPctR, rel };
        }).filter(Boolean).sort((a, b) => a.girPct - b.girPct);

        const fmtRel = v => v === null ? "—" : (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
        const hitCol = avgHit !== null ? (avgHit <= 0 ? C.accentMid : avgHit <= 0.3 ? C.yellow : C.red) : C.muted;
        const missCol = avgMiss !== null ? (avgMiss <= 1 ? C.yellow : C.red) : C.muted;

        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Score vs GIR</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: roundGIR.length > 1 ? 20 : 0 }}>
              {[
                { label: "Hit GIR", value: fmtRel(avgHit), sub: `${girHit.length} holes`, color: hitCol },
                { label: "Missed GIR", value: fmtRel(avgMiss), sub: `${girMiss.length} holes`, color: missCol },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>avg vs par · {sub}</div>
                </div>
              ))}
            </div>
            {roundGIR.length > 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, marginBottom: 2 }}>Rounds by GIR% (low → high)</div>
                {roundGIR.map((r, i) => {
                  const col = r.rel <= 0 ? C.accentMid : r.rel <= 5 ? C.yellow : C.red;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: C.accent, textAlign: "right" }}>{r.girPct}%</div>
                      <div style={{ flex: 1 }}><MiniBar pct={r.girPct} color={C.accentMid} /></div>
                      <div style={{ width: 110, fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.course}</div>
                      <div style={{ width: 40, fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: col, textAlign: "right" }}>{r.rel >= 0 ? `+${r.rel}` : r.rel}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Putts by GIR ───────────────────────────────────────────────────── */}
      {(() => {
        const panels = [
          { label: "Hit GIR", holes: allHoles.filter(h => h.gir === true && h.putts !== "") },
          { label: "Missed GIR", holes: allHoles.filter(h => h.gir === false && h.putts !== "") },
        ].filter(p => p.holes.length > 0);
        if (!panels.length) return null;

        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 16 }}>Putts by GIR</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${panels.length}, 1fr)`, gap: 16 }}>
              {panels.map(({ label, holes }) => {
                const avg = (holes.reduce((s, h) => s + +h.putts, 0) / holes.length).toFixed(2);
                const one = holes.filter(h => +h.putts === 1).length;
                const two = holes.filter(h => +h.putts === 2).length;
                const three = holes.filter(h => +h.putts >= 3).length;
                const avgCol = +avg <= 1.7 ? C.accentMid : +avg <= 2.0 ? C.yellow : C.red;
                const puttDist = [
                  { label: "1-putt", count: one, color: C.accentMid },
                  { label: "2-putt", count: two, color: C.accent },
                  { label: "3-putt+", count: three, color: C.red },
                ];
                return (
                  <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>{label}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 26, fontWeight: 700, color: avgCol, fontFamily: "'DM Mono', monospace" }}>{avg}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>avg putts · {holes.length} holes</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {puttDist.map(({ label: pl, count, color }) => (
                        <div key={pl} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
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
        );
      })()}

      {/* ── Recent Rounds ──────────────────────────────────────────────────── */}
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
      </>)}
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
function ScorecardEntry({ onSave, onUpdate, editingRound, courses }) {
  const [round, setRound] = useState(() => editingRound ? JSON.parse(JSON.stringify(editingRound)) : defaultRound());
  const [saved, setSaved] = useState(false);

  // When editingRound changes (user clicks Edit on a different round), re-seed
  useEffect(() => {
    setRound(editingRound ? JSON.parse(JSON.stringify(editingRound)) : defaultRound());
    setSaved(false);
  }, [editingRound]);

  const selectCourse = (courseId) => {
    const course = courses.find(c => c.id === +courseId) || null;
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
                return [holeRow, (
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
              return holeRow;
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
  const [tab, setTab] = useState("log");
  const [rounds, setRounds] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editingRound, setEditingRound] = useState(null);

  useEffect(() => {
    loadData().then(({ rounds: r, courses: c }) => {
      setRounds(r || []);
      setCourses(c || []);
      setLoaded(true);
    });
  }, []);

  const handleSaveRound = useCallback((round) => {
    setRounds(prev => {
      const updatedRounds = [...prev, round];
      saveData(updatedRounds, courses);
      return updatedRounds;
    });
  }, [courses]);

  const handleDeleteRound = useCallback((id) => {
    const updatedRounds = rounds.filter(r => r.id !== id);
    setRounds(updatedRounds);
    saveData(updatedRounds, courses);
  }, [rounds, courses]);

  const handleEditRound = useCallback((round) => {
    setEditingRound(round);
    setTab("log");
  }, []);

  const handleUpdateRound = useCallback((round) => {
    setRounds(prev => {
      const updatedRounds = prev.map(r => r.id === round.id ? round : r);
      saveData(updatedRounds, courses);
      return updatedRounds;
    });
    setEditingRound(null);
  }, [courses]);

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

      {/* Global reset — removes body/html margin that can squeeze layout */}
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

      {/* Header */}
      <div className="fairway-nav" style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 3vw", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: C.accent }}>⛳ Fairway</span>
          <span style={{ fontSize: 13, color: C.muted, fontFamily: "'DM Mono', monospace" }}>golf tracker</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "log") setEditingRound(null); }} style={{
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

      {/* Content — 94% of viewport width, centered, scales to any screen */}
      <div style={{ width: "94vw", margin: "0 auto", padding: "32px 0" }}>
        {tab === "dashboard" && <Dashboard rounds={rounds} />}
        {tab === "log" && <ScorecardEntry courses={courses} editingRound={editingRound} onSave={r => { handleSaveRound(r); setTab("history"); }} onUpdate={r => { handleUpdateRound(r); setTab("history"); }} />}
        {tab === "history" && <History rounds={rounds} onDelete={handleDeleteRound} onEdit={handleEditRound} />}
        {tab === "courses" && <Courses courses={courses} onSave={handleSaveCourse} onDelete={handleDeleteCourse} />}
      </div>
    </div>
  );
}
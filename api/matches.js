// api/matches.js — match play results (public read, owner write/delete)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getUser(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET: all matches, no auth required (public leaderboard) ───────────────
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("round_date", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // All mutations require auth
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  // ── POST: log one or more matches for a round ──────────────────────────────
  if (req.method === "POST") {
    const { matches } = req.body;
    if (!Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ error: "matches array required" });
    }

    const rows = matches.map(m => ({
      round_date:   m.round_date,
      course_name:  m.course_name || null,
      giver_id:     m.giver_id,
      receiver_id:  m.receiver_id,
      strokes:      m.strokes,
      result:       m.result,
      stake:        m.stake ?? 10,
      logged_by:    user.id,
    }));

    const { data, error } = await supabase
      .from("matches")
      .insert(rows)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── DELETE: remove a match (only the person who logged it) ────────────────
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error, count } = await supabase
      .from("matches")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("logged_by", user.id);
    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(403).json({ error: "Not your match" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
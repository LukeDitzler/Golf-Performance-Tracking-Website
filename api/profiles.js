// api/profiles.js — user profiles (public read, owner write)
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET: fetch all profiles (public) ──────────────────────────────────────
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, age, handicap, home_state, handedness, sg_mode")
      .order("handicap", { ascending: true, nullsLast: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // Mutations require auth
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  // ── POST / PUT: upsert the current user's profile ─────────────────────────
  if (req.method === "POST" || req.method === "PUT") {
    const { first_name, last_name, age, handicap, home_state, handedness, sg_mode } = req.body;
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { id: user.id, first_name, last_name, age, handicap, home_state, handedness, sg_mode },
        { onConflict: "id" }
      );
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
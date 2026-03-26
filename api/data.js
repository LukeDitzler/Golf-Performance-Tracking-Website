// api/data.js — Vercel serverless function with per-user auth
import { createClient } from "@supabase/supabase-js";

// Admin client — used to verify the user's JWT and access data
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Verify the user's JWT from the Authorization header ───────────────────
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Not logged in" });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid session" });

  const userId = user.id;

  // ── GET: load this user's rounds + courses ────────────────────────────────
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("golf_data")
      .select("rounds, courses")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      rounds: data?.rounds ?? [],
      courses: data?.courses ?? [],
    });
  }

  // ── POST: save this user's rounds + courses ───────────────────────────────
  if (req.method === "POST") {
    const { rounds, courses } = req.body;

    const { error } = await supabase
      .from("golf_data")
      .upsert(
        { user_id: userId, rounds, courses, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const USER_ID = "default";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("golf_data")
      .select("rounds, courses")
      .eq("user_id", USER_ID)
      .single();

    if (error && error.code !== "PGRST116") {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      rounds: data?.rounds ?? [],
      courses: data?.courses ?? [],
    });
  }

  if (req.method === "POST") {
    const { rounds, courses } = req.body;

    const { error } = await supabase
      .from("golf_data")
      .upsert(
        { user_id: USER_ID, rounds, courses, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

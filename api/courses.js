// api/courses.js — shared courses, readable by all, writable by creator
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET: all courses, no auth required ─────────────────────────────────────
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // All mutating methods require auth
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  // ── POST: create a new course ───────────────────────────────────────────────
  if (req.method === "POST") {
    const course = { ...req.body, created_by: user.id };
    delete course.id; // let Supabase generate the id
    const { data, error } = await supabase
      .from("courses")
      .insert(course)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── PUT: update a course (creator only) ────────────────────────────────────
  if (req.method === "PUT") {
    const { id, ...fields } = req.body;
    const { data, error } = await supabase
      .from("courses")
      .update({ ...fields, created_by: user.id })
      .eq("id", id)
      .eq("created_by", user.id) // enforces ownership
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(403).json({ error: "Not your course" });
    return res.status(200).json(data);
  }

  // ── DELETE: delete a course (creator only) ─────────────────────────────────
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error, count } = await supabase
      .from("courses")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("created_by", user.id);
    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(403).json({ error: "Not your course" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

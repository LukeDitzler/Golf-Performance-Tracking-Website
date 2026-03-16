import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = 3001;

// Create data.json with empty structure if it doesn't exist yet
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ rounds: [], courses: [] }, null, 2));
  console.log("Created data.json");
}

const app = express();
app.use(express.json());

// Allow Vite dev server to call this backend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Load all data
app.get("/api/data", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    res.json(data);
  } catch {
    res.json({ rounds: [], courses: [] });
  }
});

// Save all data (client sends full { rounds, courses } object)
app.post("/api/data", (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Fairway data server running on http://localhost:${PORT}`);
});

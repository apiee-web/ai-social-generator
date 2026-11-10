/**
 * server.cjs — local development server
 * ---------------------------------------------------------------------------
 * Production runs on Vercel, where every file in /api/ becomes an endpoint.
 * This file exists so you can develop offline: it loads .env and serves the
 * exact same handlers, so local behaviour matches the deployed one.
 *
 * Run:  npm run server   (in a second terminal, with `npm run dev` running)
 * ---------------------------------------------------------------------------
 */

const express = require("express");
const path = require("node:path");

try {
  require("dotenv").config();
} catch {
  /* dotenv is optional if you set env vars another way */
}

const PORT = Number(process.env.PORT || 8787);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "";

(async () => {
  /* The api/ folder is ES modules (the project sets "type": "module"). */
  const [{ default: health }, { default: generate }, { default: checkout }] = await Promise.all([
    import("./api/health.js"),
    import("./api/generate.js"),
    import("./api/checkout.js"),
  ]);

  const app = express();
  app.use(express.json({ limit: "256kb" }));

  /* Only needed when the frontend runs on another port without the Vite proxy. */
  if (ALLOW_ORIGIN) {
    app.use((req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      if (req.method === "OPTIONS") return res.sendStatus(204);
      return next();
    });
  }

  /* Same files Vercel deploys — one implementation, two environments. */
  app.get("/api/health", health);
  app.post("/api/generate", generate);
  app.post("/api/checkout", checkout);

  /* Serve the production build (npm run build) if it exists. */
  const distDir = path.join(__dirname, "dist");
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distDir, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.listen(PORT, () => {
    console.log(`Local API listening on http://localhost:${PORT}`);
    console.log(`  model:    ${process.env.AI_MODEL || "gpt-4o-mini"}`);
    console.log(`  key:      ${process.env.AI_API_KEY ? "set" : "MISSING — add AI_API_KEY to .env"}`);
    if (!process.env.STRIPE_SECRET_KEY) console.log("  checkout: demo mode (no Stripe key)");
  });
})().catch((err) => {
  console.error("Failed to start the local server:", err);
  process.exit(1);
});

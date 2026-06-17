import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { syncRSSNews } from "./rss";
import { apiRouter } from "./api";

import fs from "fs";

// kick off initial sync in bg
syncRSSNews();
setInterval(syncRSSNews, 1000 * 60 * 15); // Sync every 15 minutes

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple session handling for User Settings
  app.use((req, res, next) => {
    let sessionId = req.headers['x-session-id'] as string;
    if (!sessionId) sessionId = req.cookies?.session_id || 'default_session';
    (req as any).sessionId = sessionId;
    next();
  });

  // API Routes
  app.use('/api', apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

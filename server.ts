import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { syncRSSNews } from "./rss";
import { apiRouter } from "./api";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";

// kick off initial sync in bg
syncRSSNews();
setInterval(syncRSSNews, 1000 * 60 * 15); // Sync every 15 minutes

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Reliable session handling
  app.use((req, res, next) => {
    let sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId && req.cookies && req.cookies.session_id) {
       sessionId = req.cookies.session_id;
    }
    
    if (!sessionId) {
       sessionId = uuidv4();
       res.cookie('session_id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year
       });
    }
    
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

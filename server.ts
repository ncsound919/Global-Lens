import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { syncRSSNews } from "./rss";
import { apiRouter } from "./api";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import cron from "node-cron";

// kick off initial sync in bg
syncRSSNews();

// Run cron job every morning at 6:00 AM
cron.schedule("0 6 * * *", () => {
  console.log("Running scheduled morning RSS sync...");
  syncRSSNews();
});

async function startServer() {
  // Startup assertions
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !process.env.APP_URL) {
     console.warn("WARNING: APP_URL is not set in production. CORS may not be locked down effectively.");
  }

  const app = express();
  const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.set("trust proxy", 1);
  
  // Explicit CORS Allowlist
  const allowedOrigins = [
    process.env.APP_URL, 
    'http://localhost:3000', 
    'http://127.0.0.1:3000'
  ].filter(Boolean) as string[];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || !isProd) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by CORS'));
      }
    },
    credentials: true,
  }));

  app.use(express.json());
  app.use(cookieParser());

  // Basic HTTP Request Logger for Production Visibility
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
       const ms = Date.now() - start;
       console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms ${req.ip}`);
    });
    next();
  });

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
          secure: isProd,
          sameSite: isProd ? 'none' : 'lax', // Support cross-origin split deployment safely
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
      console.log('HTTP server closed.');
      import('./db').then(({ default: db }) => {
         db.close();
         console.log('Database connection closed.');
         process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(console.error);

import "dotenv/config";
import { loadEcosystemEnv } from "./server/ecosystemEnv.js";
loadEcosystemEnv();
import express from "express";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import { syncRSSNews, backfillArticleImages } from "./server/rss.js";
import { syncSportsAPI } from "./server/sports.js";
import { syncResearchPapers } from "./server/research.js";
import { syncTrendsAndDiscoveries } from "./server/trends.js";
import { syncDomainResearchWithEditorial } from "./server/domainResearch.js";
import { synthesizeResearchPapers } from "./server/researchSynthesis.js";
import { syncCrossDomainSignals } from "./server/crossDomain.js";
import { apiRouter } from "./server/api.js";
import db from "./server/db.js";
import { repairMojibake } from "./server/encoding.js";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import cron from "node-cron";
import rateLimit from "express-rate-limit";

// Vercel serverless mode: no long-running process. The Express app is wrapped by
// api/index.ts; boot syncs and node-cron are disabled and replaced by Vercel
// Cron hitting /api/cron/sync.
const isVercel = process.env.VERCEL === "1";

// kick off initial sync in bg â€” staggered so the five syncs don't pile onto
// the same event loop tick at boot (that cold-start contention spiked CPU/mem
// and made the first /api/health probes slow). Each sync is already guarded by
// its own in-module reentrancy lock; spacing them keeps the server responsive.
// (Skipped on Vercel â€” the cron endpoint triggers these instead.)
if (!isVercel) {
  const STAGGER_MS = 3_000;
  setTimeout(() => syncRSSNews(), 0);
  setTimeout(() => syncSportsAPI(), STAGGER_MS);
  setTimeout(() => syncResearchPapers(), STAGGER_MS * 2);
  setTimeout(() => syncTrendsAndDiscoveries(), STAGGER_MS * 3);
  setTimeout(() => {
    backfillArticleImages(25).catch((e) => console.warn(`[image] initial backfill failed: ${e.message}`));
  }, STAGGER_MS * 4);
  setTimeout(() => {
    syncDomainResearchWithEditorial().catch((e) =>
      console.warn(`[domain] initial domain research sync failed: ${e.message}`)
    );
  }, STAGGER_MS * 5);
  setTimeout(() => {
    synthesizeResearchPapers()
      .then((r) => console.log(`[synthesis] initial research synthesis: ${JSON.stringify(r)}`))
      .catch((e) => console.warn(`[synthesis] initial synthesis failed: ${e.message}`));
  }, STAGGER_MS * 6);
  setTimeout(() => {
    syncCrossDomainSignals()
      .then((r) => console.log(`[cross-domain] initial cross-domain sync: ${JSON.stringify(r)}`))
      .catch((e) => console.warn(`[cross-domain] initial cross-domain sync failed: ${e.message}`));
  }, STAGGER_MS * 7);

  // Comic Metaphor Engine connectivity probe (observability only)
  if (process.env.COMIC_ENGINE_URL) {
    const probe = `${process.env.COMIC_ENGINE_URL.replace(/\/$/, "")}/health`;
    fetch(probe, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: any) =>
        console.log(`[metaphor] Comic engine reachable: ${j?.service} v${j?.version} (${j?.protocols_loaded ?? "?"} protocols)`)
      )
      .catch((e: any) => console.warn(`[metaphor] Comic engine unreachable at ${probe}: ${e.message}`));
  }

  // Run cron job every 3 hours
  cron.schedule("0 */3 * * *", () => {
    console.log("Running scheduled morning RSS and Sports sync...");
    syncRSSNews();
    syncSportsAPI();
  }, { timezone: "UTC" });

  // Daily ecosystem content sync (research papers + trends/discoveries) at 02:15 UTC
  cron.schedule("15 2 * * *", () => {
    console.log("Running daily ecosystem content sync...");
    const papers = syncResearchPapers();
    const insights = syncTrendsAndDiscoveries();
    console.log(`Ecosystem content sync complete. Papers: ${JSON.stringify(papers)}. Insights: ${JSON.stringify(insights)}`);
  }, { timezone: "UTC" });

  // Daily research synthesis at 02:20 UTC â€” bundle the science programs into
  // definitive papers, re-run through the Overlay Science engines, synthesize.
  cron.schedule("20 2 * * *", () => {
    console.log("Running daily research synthesis...");
    synthesizeResearchPapers()
      .then((r) => console.log(`Research synthesis complete. ${JSON.stringify(r)}`))
      .catch((e) => console.warn(`Research synthesis failed: ${e.message}`));
  }, { timezone: "UTC" });

  // Daily cross-domain sync at 02:25 UTC â€” detect cross-pillar signals.
  cron.schedule("25 2 * * *", () => {
    console.log("Running daily cross-domain sync...");
    syncCrossDomainSignals()
      .then((r) => console.log(`Cross-domain sync complete. ${JSON.stringify(r)}`))
      .catch((e) => console.warn(`Cross-domain sync failed: ${e.message}`));
  }, { timezone: "UTC" });

  // Daily domain research repopulation at 02:30 UTC â€” pulls updated APIs + our new
  // research, cross-analyzes against established literature, and regenerates the
  // outlet's research database + editorial articles. Keeps the research archive
  // growing every day (compounding credibility).
  cron.schedule("30 2 * * *", () => {
    console.log("Running daily domain research repopulation...");
    syncDomainResearchWithEditorial()
      .then((r) => console.log(`Domain research repopulation complete. ${JSON.stringify(r)}`))
      .catch((e) => console.warn(`Domain research repopulation failed: ${e.message}`));
  }, { timezone: "UTC" });
}

/**
 * Resolve the production build directory independently of the current working
 * directory. The bundled server.mjs lives inside dist/, so `import.meta.dirname`
 * differs between dev (tsx server.ts â†’ project root) and prod (bundle â†’ dist/).
 * Tries every plausible location and picks the one that actually contains
 * index.html so the catch-all route never serves HTML for /assets/* (MIME errors).
 */
function resolveDistDir(): string {
  const candidates = [
    process.env.DIST_DIR,
    path.resolve(process.cwd(), "dist"),
    path.resolve(import.meta.dirname, "dist"),
    path.resolve(import.meta.dirname, "..", "dist"),
    import.meta.dirname,
  ].filter((p): p is string => !!p);
  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, "index.html"))) return c;
    } catch {
      /* ignore unreadable candidate */
    }
  }
  const fallback = path.resolve(process.cwd(), "dist");
  console.warn(`[dist] Could not locate dist/index.html; falling back to ${fallback}`);
  return fallback;
}

function escapeHtml(unsafe: string): string {
  return (unsafe || "")
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}

async function createApp() {
  // Startup assertions
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !process.env.APP_URL) {
     console.warn("WARNING: APP_URL is not set in production. CORS may not be locked down effectively.");
  }

  const app = express();

  app.set("trust proxy", 1);

  // Secure helmet HTTP headers configured for AI Studio's sandbox frame and Vite development environments
  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginEmbedderPolicy: false
  }));
  
  // Explicit CORS Allowlist
  const allowedOrigins = [
    process.env.APP_URL?.replace(/\/$/, ''), 
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

  // Stripe webhooks need the raw body for signature verification.
  app.use("/api/donate/webhook", express.raw({ type: "*/*" }));
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
  app.use(async (req, res, next) => {
    let sessionId: string | undefined = undefined;
    
    if (req.cookies) {
       sessionId = req.cookies.bgl_session;
    }
    
    if (sessionId) {
      // Validate session is not expired
      try {
        const session = await db.prepare('SELECT created_at, expires_at FROM sessions WHERE session_id = ?').get(sessionId) as any;
        if (session) {
          const createdAt = new Date(session.created_at).getTime();
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          const isExpired = (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) || (createdAt < thirtyDaysAgo);
          if (isExpired) {
            // Expired! Clean up from database
            await db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
            sessionId = undefined;
          }
        }
      } catch (e) {
        console.error("Session verification failed:", e);
      }
    }
    
    if (!sessionId) {
       sessionId = uuidv4();
    }
    
    // Set consolidated bgl_session cookie
    res.cookie('bgl_session', sessionId, {
       httpOnly: true,
       secure: isProd,
       sameSite: 'lax', // Unified to Lax to guarantee stable session cookie behavior on single-domain deployment
       maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
    });
    
    (req as any).sessionId = sessionId;
    next();
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100, // Reduced from 1000 to 100/min for secure rate limiting
    validate: { xForwardedForHeader: false }
  });

  // API Routes
  app.use('/api', apiLimiter, apiRouter);

  // Vercel Cron / ops sync trigger — CRON_SECRET guarded. Serverless deployments
  // have no node-cron, so Vercel Cron (or Draymond) calls this to repopulate.
  // GET is allowed for Vercel Cron (it sends no auth header); POST requires the
  // shared CRON_SECRET so fleet/downstream callers can trigger it too.
  // Registered BEFORE the SPA catch-all so /api/cron/sync is not swallowed.
  app.all("/api/cron/sync", async (_req, res) => {
    const secret = process.env.CRON_SECRET;
    const auth = String(_req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET> automatically when
    // CRON_SECRET is set. All callers (Vercel Cron, Draymond, manual) must auth.
    if (!secret || auth !== secret) {
      return res.status(401).json({ detail: "unauthorized" });
    }
    // Await the core syncs before responding — serverless functions are frozen
    // after the response, so fire-and-forget work would never complete.
    try {
      await Promise.all([
        syncRSSNews(),
        syncSportsAPI(),
        syncResearchPapers(),
        syncTrendsAndDiscoveries(),
      ]);
      res.json({ started: true, completed: true, at: new Date().toISOString() });
    } catch (e: any) {
      console.warn(`[cron] sync error: ${e?.message || e}`);
      res.json({ started: true, completed: false, at: new Date().toISOString() });
    }
  });

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get("host")}/sitemap.xml`);
  });

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const articles = await db.prepare("SELECT url_hash, pub_date FROM articles ORDER BY pub_date DESC LIMIT 1000").all() as any[];
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

      // Add homepage
      xml += `
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>`;

      // Add articles
      for (const article of articles) {
        xml += `
  <url>
    <loc>${baseUrl}/?article=${escapeHtml(article.url_hash)}</loc>
    <lastmod>${new Date(article.pub_date || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      }

      xml += `\n</urlset>`;

      res.header("Content-Type", "application/xml");
      res.send(xml);
    } catch (err) {
      console.error(err);
      res.status(500).end();
    }
  });

  let cachedProdTemplate: string | null = null;
  if (isProd) {
    const distPath = resolveDistDir();
    try {
      cachedProdTemplate = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
    } catch (e: any) {
      // API routes don't need the SPA shell; only the catch-all does. Don't crash
      // the whole app because static assets are missing or being deployed.
      console.warn(`[dist] index.html not found at ${distPath}: ${e?.message}`);
    }
  }

  const renderHtml = async (req: express.Request, res: express.Response, rawHtml: string) => {
    let articleId = req.query.article as string;
    if (articleId && typeof articleId === "string") {
      // Validate that articleId is purely alphanumeric with dashes/underscores to block XSS vector completely
      if (!/^[a-zA-Z0-9\-_]+$/.test(articleId)) {
        articleId = "";
      }
    }
    
    let finalHtml = rawHtml;
    const baseUrl = (process.env.PUBLIC_URL || process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, '');

    if (articleId) {
      try {
        const article = await db.prepare(`
          SELECT a.original_url, a.image_url, a.source_name, a.pub_date,
                 c.reframed_headline, c.cultural_lens_analysis
          FROM articles a
          LEFT JOIN article_ai_cache c ON a.url_hash = c.url_hash
          WHERE a.url_hash = ? OR a.id = ?
          LIMIT 1
        `).get(articleId, articleId) as any;

        if (article) {
          const headline = escapeHtml(repairMojibake(article.reframed_headline || 'Global Lens Story'));
          const description = escapeHtml(repairMojibake((article.cultural_lens_analysis || '').slice(0, 200)));
          const image = escapeHtml(article.image_url || `${baseUrl}/og-default.jpg`);
          const canonicalUrl = `${baseUrl}/?article=${escapeHtml(articleId)}`;

          const ogTags = `
            <meta property="og:type" content="article" />
            <meta property="og:title" content="${headline}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:url" content="${canonicalUrl}" />
            <meta property="og:image" content="${image}" />
            <meta name="twitter:card" content="summary_large_image" />
          `;
          
          const titleTag = `<title>${headline} — Overlay Global Lens</title>`;
          finalHtml = finalHtml
            .replace(/<title>[\s\S]*?<\/title>/i, titleTag)
            .replace('</head>', `    <link rel="canonical" href="${canonicalUrl}" />\n    ${ogTags}\n  </head>`);
        }
      } catch (err) {
        console.error("Error generating OG tags", err);
      }
    } else {
       finalHtml = finalHtml.replace('</head>', `    <link rel="canonical" href="${baseUrl}/" />\n  </head>`);
    }
    res.send(finalHtml);
  };

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(import.meta.dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        await renderHtml(req, res, template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Production static serving
    const distPath = resolveDistDir();
    app.use(express.static(distPath, { index: false }));
    app.get("*", (req, res) => {
      // Never serve index.html for missing static assets — 404 instead, so the
      // browser gets a real MIME type (or a proper miss) rather than text/html.
      if (/\.(js|mjs|css|json|png|jpg|jpeg|gif|svg|ico|webp|avif|woff2?|ttf|eot|map|txt|xml)$/i.test(req.path)) {
        return res.status(404).end();
      }
      if (!cachedProdTemplate) {
        return res.status(503).type("text/plain").send("SPA assets not ready — retry shortly.");
      }
      renderHtml(req, res, cachedProdTemplate);
    });
  }

  return app;
}

async function startServer() {
  const app = await createApp();
  const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
      console.log('HTTP server closed.');
      db.close();
      console.log('Database connection closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { createApp };

if (!isVercel) {
  startServer().catch(console.error);
}

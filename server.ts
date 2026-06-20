import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { syncRSSNews } from "./rss";
import { apiRouter } from "./api";
import db from "./db";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import cron from "node-cron";
import rateLimit from "express-rate-limit";

// kick off initial sync in bg
syncRSSNews();

// Run cron job every morning at 6:00 AM
cron.schedule("0 6 * * *", () => {
  console.log("Running scheduled morning RSS sync...");
  syncRSSNews();
}, { timezone: "UTC" });

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

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    validate: { xForwardedForHeader: false }
  });

  // API Routes
  app.use('/api', apiLimiter, apiRouter);

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get("host")}/sitemap.xml`);
  });

  app.get("/sitemap.xml", (req, res) => {
    try {
      const articles = db.prepare("SELECT url_hash, pub_date FROM articles ORDER BY pub_date DESC LIMIT 1000").all() as any[];
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
    <loc>${baseUrl}/?article=${article.url_hash}</loc>
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
    const distPath = path.join(process.cwd(), "dist");
    cachedProdTemplate = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
  }

  const renderHtml = async (req: express.Request, res: express.Response, rawHtml: string) => {
    const articleId = req.query.article as string;
    let finalHtml = rawHtml;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    if (articleId) {
      try {
        const article = db.prepare(`
          SELECT a.original_url, a.image_url, a.source_name, a.pub_date,
                 c.reframed_headline, c.cultural_lens_analysis
          FROM articles a
          LEFT JOIN article_ai_cache c ON a.url_hash = c.url_hash
          WHERE a.url_hash = ? OR a.id = ?
          LIMIT 1
        `).get(articleId, articleId) as any;

        if (article) {
          const headline = (article.reframed_headline || 'Global Lens Story').replace(/"/g, '&quot;');
          const description = (article.cultural_lens_analysis || '').slice(0, 200).replace(/"/g, '&quot;');
          const image = article.image_url || `${baseUrl}/og-default.jpg`;
          const canonicalUrl = `${baseUrl}/?article=${articleId}`;

          const ogTags = `
            <meta property="og:type" content="article" />
            <meta property="og:title" content="${headline}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:url" content="${canonicalUrl}" />
            <meta property="og:image" content="${image}" />
            <meta name="twitter:card" content="summary_large_image" />
          `;
          
          const titleTag = `<title>${headline} — Black Global Lens</title>`;
          finalHtml = finalHtml
            .replace(/<title>.*?<\/title>/, titleTag)
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        await renderHtml(req, res, template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", (req, res) => {
      renderHtml(req, res, cachedProdTemplate as string);
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

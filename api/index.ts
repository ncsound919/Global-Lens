import { createApp } from '../server';
import type { Express } from 'express';

// Vercel serverless entrypoint. Vercel's Node runtime calls the default export
// with Node (req, res); an Express app is itself a (req, res) handler, so we
// hand the request straight to it. Warm instances reuse the built app (which
// keeps the shared DB driver + migrations promise alive).
let app: Express | null = null;

export default async function handler(req: unknown, res: unknown) {
  if (!app) {
    app = await createApp();
  }
  (app as unknown as (r: unknown, s: unknown) => void)(req, res);
}
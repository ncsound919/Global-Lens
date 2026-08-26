import { createApp } from '../server';
import serverless from 'serverless-http';

// Vercel serverless entrypoint: wrap the Express app once, reuse the handler
// across invocations (warm instances keep the DB connection + prepared state).
let cached: ReturnType<typeof serverless> | null = null;

export default async function handler(req: unknown, res: unknown) {
  if (!cached) {
    const app = await createApp();
    cached = serverless(app);
  }
  return cached(req, res);
}
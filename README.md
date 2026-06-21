# Global Lens

A contextual backend for analyzing global news feeds using custom-trained AI filtering.

## Deployment Requirements

### 1. Environment Variables
This applet requires the following environment variables (which must be mapped as secrets if using the provided GitHub Actions workflow):
- `GEMINI_API_KEY`: API key for Gemini models.
- `OPENROUTER_API_KEY`: API key for OpenRouter models (fallback).
- `MISTRAL_API_KEY`: API key for Mistral models (fallback).
- `SESSION_SECRET`: Secret used for signing session cookies.
- `APP_URL`: The fully qualified public URL where this app resides (e.g., `https://your-domain.com`). Critical for securely locking down CORS.
- `NODE_ENV`: Should be set to `production` in deployed environments.

Note: In the `deploy.yml` workflow, the Cloud Run region is set to `us-central1`. Please ensure your GCP setup and secret manager matches this exactly.

### 2. Network & Ports
- The Express API and static renderer start on **Port 3000** (`process.env.PORT || 3000`).
- The application binds to host `0.0.0.0` natively, ensuring Docker container network readiness.

### 3. Database Persistence
- SQLite is utilized for both articles and offline caching.
- Production hosts must mount a persistent volume containing root context to retain `database.sqlite` between deployments and container upgrades.

### 4. Build & Start Commands
`global-lens` uses Vite for frontend bundling and ESBuild for compiling the backend natively. 
- **Setup Check**: Install dependencies correctly using `npm install`.
- **Compile command**: `npm run build`
    - Creates static payload in `/dist`.
    - Generates standalone server runtime to `dist/server.cjs`.
- **Runtime command**: `npm run start`

## Observability
Access logging is automatically shipped via `console.log` middleware output. Any health, network status or systemic API limits are streamed here. Listen to `/api/health` target for orchestrated uptime checks.

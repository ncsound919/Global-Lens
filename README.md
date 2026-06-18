# Global Lens

A contextual backend for analyzing global news feeds using custom-trained AI filtering.

## Deployment Requirements

### 1. Environment Variables
This applet requires the following environment variables. Define these in your production host:
- `GEMINI_API_KEY`: API key for Gemini models (or configure `OPENAI_API_KEY`, etc. if fallback is needed)
- `APP_URL`: The fully qualified public URL where this app resides (e.g., `https://your-domain.com`). Critical for securely locking down CORS.
- `NODE_ENV`: Should be set to `production` in deployed environments.

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

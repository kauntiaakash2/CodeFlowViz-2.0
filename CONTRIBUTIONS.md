# Contribution guidelines for CodeFlowViz 2.0

### Technology Stack

| Layer            | Tools                                                          |
| ---------------- | -------------------------------------------------------------- |
| Frontend         | Next.js 14, React, Tailwind CSS, Framer Motion, Monaco Editor  |
| Backend          | Node.js, Express, worker threads                               |
| Execution Engine | AST instrumentation, sandboxed execution, line-level snapshots |
| Deployment       | Vercel frontend, Railway backend                               |
| Initial Language | JavaScript                                                     |

## Local Development Setup

This section is the **single source of truth** for getting CodeFlowViz 2.0 running on your own machine. Follow each step in order.

### Repository Layout

```text
CodeFlowViz-2.0/
├── frontend/        # Next.js 14 cockpit UI  →  http://localhost:3000
├── backend/         # Express + AST engine   →  http://localhost:4000
└── package.json     # Root npm workspace (manages both)
```

---

### Step 0 — Prerequisites

Make sure the following tools are installed **before** you begin:

| Tool        | Minimum version            | Download              |
| ----------- | -------------------------- | --------------------- |
| **Node.js** | v18 (v20+ recommended)     | <https://nodejs.org>  |
| **npm**     | v9+ (bundled with Node.js) | —                     |
| **Git**     | any recent version         | <https://git-scm.com> |

Verify your versions:

```bash
node -v   # should print v18.x.x or higher
npm -v    # should print 9.x.x or higher
git -v
```

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/<your-org>/CodeFlowViz-2.0.git
cd "CodeFlowViz-2.0"
```

---

### Step 2 — Install dependencies

Run a **single command from the repo root**. npm workspaces automatically installs packages for both `frontend/` and `backend/`:

```bash
npm install
```

What gets installed:

| Workspace   | Key packages                                                                    |
| ----------- | ------------------------------------------------------------------------------- |
| `frontend/` | `next@14`, `react`, `react-dom`, `@monaco-editor/react`, `typescript`, `eslint` |
| `backend/`  | `express`, `acorn`                                                              |

> **Tip:** If you ever need to install packages for just one workspace, use:
>
> ```bash
> npm install --workspace frontend
> npm install --workspace backend
> ```

---

### Step 3 — Create environment files

The app requires two small `.env` files for local development. **These files are git-ignored and must be created manually.**

#### 3a. Frontend — `frontend/.env.local`

This tells the Next.js UI where to send code-execution requests:

**macOS / Linux / Git Bash:**

```bash
echo 'NEXT_PUBLIC_EXECUTE_API_URL=http://localhost:4000/api/execute' > frontend/.env.local
```

**Windows (PowerShell):**

```powershell
Set-Content frontend\.env.local 'NEXT_PUBLIC_EXECUTE_API_URL=http://localhost:4000/api/execute'
```

Or simply create the file manually in your editor with the content:

```env
NEXT_PUBLIC_EXECUTE_API_URL=http://localhost:4000/api/execute
```

#### 3b. Backend — `backend/.env`

This configures the Express server port and CORS policy:

**macOS / Linux / Git Bash:**

```bash
printf 'PORT=4000\nCORS_ORIGIN=http://localhost:3000\n' > backend/.env
```

**Windows (PowerShell):**

```powershell
Set-Content backend\.env "PORT=4000`nCORS_ORIGIN=http://localhost:3000"
```

Or create manually with content:

```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

> **Note:** If you skip `backend/.env`, the backend falls back to `PORT=4000` and `CORS_ORIGIN=*`. The `*` wildcard is fine for local use but never deploy with it.

---

### Dummy environment variables (quick-start bypass)

If you hit errors on first run because of missing variables, copy-paste the values below — they are safe placeholders that satisfy every validation check during local development.

**`frontend/.env.local`**

```env
NEXT_PUBLIC_EXECUTE_API_URL=http://localhost:4000/api/execute
```

**`backend/.env`**

```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

---

### Step 4 — Start the development servers

#### Option A — start both with one command (recommended)

From the repo root:

```bash
npm run dev
```

This runs `npm run dev:backend` and `npm run dev:frontend` concurrently.

#### Option B — start each server in its own terminal

**Terminal 1** (Next.js frontend — hot-reload enabled):

```bash
npm run dev:frontend
```

**Terminal 2** (Node.js backend — file-watch restart via `--watch`):

```bash
npm run dev:backend
```

#### Available npm scripts (root workspace)

| Script                   | What it does                                   |
| ------------------------ | ---------------------------------------------- |
| `npm run dev`            | Starts both servers concurrently               |
| `npm run dev:frontend`   | `next dev` inside `frontend/`                  |
| `npm run dev:backend`    | `node --watch src/server.js` inside `backend/` |
| `npm run build`          | Production build of the Next.js frontend       |
| `npm run start:frontend` | Serves the production Next.js build            |
| `npm run start:backend`  | Starts the backend without file-watch          |
| `npm run lint`           | Runs ESLint on the frontend                    |

---

### Step 5 — Verify everything is running

| Check          | URL                            | Expected                                           |
| -------------- | ------------------------------ | -------------------------------------------------- |
| Frontend       | <http://localhost:3000>        | CodeFlowViz cockpit loads in the browser           |
| Backend health | <http://localhost:4000/health> | `{ "ok": true, "service": "codeflowviz-backend" }` |

Quick health-check via CLI:

```bash
curl http://localhost:4000/health
```

---

### Step 6 — Production build (optional)

To compile the Next.js frontend into a production bundle:

```bash
npm run build          # builds frontend/
npm run start:frontend # serves the built bundle
```

To run the backend without the file-watcher:

```bash
npm run start:backend
```

---

### Troubleshooting

| Symptom                              | Fix                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install` fails                  | Check `node -v` ≥ 18 and `npm -v` ≥ 9; reinstall Node.js if needed                                                                                                    |
| Frontend shows "Failed to fetch"     | Confirm `frontend/.env.local` exists and `NEXT_PUBLIC_EXECUTE_API_URL` points to `http://localhost:4000/api/execute`                                                  |
| CORS error in browser console        | Confirm `backend/.env` has `CORS_ORIGIN=http://localhost:3000` (exact match, no trailing slash)                                                                       |
| Port 4000 already in use             | Change `PORT` in `backend/.env` and update `NEXT_PUBLIC_EXECUTE_API_URL` to match                                                                                     |
| Backend starts but returns no traces | Check backend terminal for parser errors; test directly: `curl -X POST http://localhost:4000/api/execute -H "Content-Type: application/json" -d "{\"code\":\"1+1\"}"` |
| `next: command not found`            | Run `npm install` from the repo root (not inside `frontend/`)                                                                                                         |

## Deployment

### API Contract (frontend ↔ backend)

The frontend posts source code to the backend execution endpoint:

- **Method:** `POST`
- **Endpoint:** `/api/execute`
- **Content-Type:** `application/json`

Example payload:

```json
{
  "code": "function add(a,b){return a+b}; add(2,3);"
}
```

The backend responds with trace telemetry consumed by the timeline and variable inspector panels.

### Frontend on Vercel

1. Import the repository into Vercel.
2. Set the project root to `frontend/`.
3. Add `NEXT_PUBLIC_EXECUTE_API_URL` with the deployed backend `/api/execute` URL.
4. Deploy.

### Backend on Railway

1. Create a Railway service from the same repository.
2. Set the service root to `backend/`.
3. Add `PORT` if required by your Railway configuration.
4. Add `CORS_ORIGIN` with the Vercel frontend URL.
5. Deploy the Express service.

### Post-deployment checklist

1. Open the deployed frontend URL and run a simple snippet (`const x = 1 + 1`) to verify trace rendering.
2. Confirm backend health is reachable from the public host: `GET /health`.
3. Validate CORS by checking that browser requests to `/api/execute` succeed without preflight errors.
4. Verify backend logs show execution steps and no worker-thread crashes.

## Troubleshooting

- **`Failed to fetch` from frontend**: Ensure `NEXT_PUBLIC_EXECUTE_API_URL` points to the backend `/api/execute` path and protocol (https/http) matches deployment.
- **CORS errors in browser console**: Verify `CORS_ORIGIN` exactly matches the frontend origin, including scheme and subdomain.
- **Port binding failures on Railway**: Confirm the service uses Railway-provided `PORT` and does not hardcode `4000` in production.
- **No trace events returned**: Inspect backend logs for parser/runtime errors; test the same snippet directly against the API with `curl`.

## Note: For running in windows
- Install concurrently package as a development dependency.
- Run this in the root of the project:

```bash
npm install concurrently --save-dev
```

## Roadmap

- **Multi-language execution** — Python and C++ tracing after the JavaScript execution path is hardened.
- **Advanced Logic Node overlays** — Higher-level control-flow nodes rendered above raw trace events.
- **Trace sharing** — Exportable sessions for code reviews, incident analysis, and teaching.
- **Custom cockpit layouts** — Persisted panels for architecture reviews, demos, and debugging workflows.
- **Expanded sandbox policies** — More granular limits for memory, execution time, and API access.

## Open Source Program Context

This repository is prepared for **GirlScript Summer of Code (GSSoC)** contributions and mentoring workflows.

> Note: **GSSoC** refers to **GirlScript Summer of Code**, not Google Summer of Code (GSoC).

If you are contributing through GSSoC, please mention the relevant issue number and program context in your pull request description so maintainers can track contributions accurately.

## Contributing

Contributions are welcome. If you care about debuggers, visualization, language tooling, developer education, or high-performance UI systems, there is room to help.

Recommended first steps:

1. Open an issue with the problem, proposal, or trace scenario you want to improve.
2. Fork the repository and create a focused feature branch.
3. Keep changes small, typed, and easy to review.
4. Include screenshots or trace payload examples when UI behavior changes.
5. Submit a pull request with a clear summary and validation notes.

## License

License details have not been published yet. Add a `LICENSE` file before distributing or accepting external production use.
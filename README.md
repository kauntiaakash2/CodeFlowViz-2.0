# CodeFlowViz 2.0

<p align="center">
  <strong>Visualize JavaScript execution as a real-time cockpit: line-by-line flow, variable state, and replayable runtime telemetry for architects and engineers.</strong>
</p>

<p align="center">
  <a href="https://code-flow-viz-2-0.vercel.app"><strong>Launch the live Vercel deployment →</strong></a>
</p>

<p align="center">
  <img alt="Next.js 14" src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img alt="AST Tracing" src="https://img.shields.io/badge/AST-Tracing-7C3AED?style=for-the-badge" />
  <img alt="Monorepo" src="https://img.shields.io/badge/Architecture-Decoupled%20Monorepo-0EA5E9?style=for-the-badge" />
</p>

---

## Visual Preview

> **Execution Cockpit / Void design system preview**  
> Replace this placeholder with a production screenshot at `docs/assets/execution-cockpit-void.png` once the cockpit capture is finalized.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ CODEFLOWVIZ EXECUTION COCKPIT · VOID                                       │
├───────────────────────────────┬───────────────────────┬────────────────────┤
│ Monaco Code Pane              │ Timeline / Scrubber   │ Variable Inspector │
│  ▸ active line illumination   │  step 001 ━━━━━●────  │  value  number  6  │
│  ▸ AST trace markers          │  step into / over/ out│  result number  8  │
│  ▸ sandbox execution status   │  replay snapshots     │  logs   structured │
└───────────────────────────────┴───────────────────────┴────────────────────┘
```

<!--
![CodeFlowViz Execution Cockpit — Void design system](docs/assets/execution-cockpit-void.png)
-->

## Core Features

| Capability | Cockpit Signal |
| --- | --- |
| **Real-time AST Tracing** | Instruments JavaScript syntax trees before execution to capture line-level snapshots as code runs. |
| **Live Variable Inspector** | Surfaces scoped runtime values with type badges, serialized previews, and snapshot-aware inspection. |
| **Playback Scrubber** | Replays execution history so engineers can step into, over, and out of logic flow without rerunning mental simulations. |
| **Tonal Layering “Void” Aesthetic** | Uses high-contrast depth, restrained neon accents, and cockpit-style panels to keep dense telemetry readable. |

## Why CodeFlowViz?

Traditional debuggers are powerful, but they are often optimized for local breakpoints rather than system-level comprehension. CodeFlowViz 2.0 turns execution into a navigable visual timeline, helping teams explain algorithms, review control flow, and reason about state transitions with less context switching.

## The Deployment Story

CodeFlowViz 2.0 is intentionally split into a decoupled monorepo:

- `frontend/` runs the cockpit UI as a Next.js 14 application, optimized for Vercel delivery.
- `backend/` runs the Express execution service in a long-lived Node.js environment, designed for Railway or a comparable host.

This separation solves a practical production constraint: sandboxed code tracing can exceed short serverless execution windows. By moving AST instrumentation and worker-thread execution to Railway while keeping the interface on Vercel, the project preserves a fast frontend deployment path without forcing the execution engine into serverless timeout limits.

## Architecture

```text
┌────────────────────────────┐       HTTPS        ┌─────────────────────────────┐
│ Frontend · Vercel          │ ─────────────────▶ │ Backend · Railway           │
│ Next.js 14 cockpit UI      │                    │ Node.js + Express API       │
│ Tailwind CSS design layer  │ ◀───────────────── │ AST instrumentation sandbox │
│ Framer Motion transitions  │    trace payloads  │ Worker-thread isolation     │
└────────────────────────────┘                    └─────────────────────────────┘
```

### Technology Stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js 14, React, Tailwind CSS, Framer Motion, Monaco Editor |
| Backend | Node.js, Express, worker threads |
| Execution Engine | AST instrumentation, sandboxed execution, line-level snapshots |
| Deployment | Vercel frontend, Railway backend |
| Initial Language | JavaScript |

## Installation & Setup

### Repository Layout

```text
CodeFlowViz-2.0/
├── frontend/   # Next.js cockpit UI (Vercel target)
├── backend/    # Express + AST execution service (Railway target)
└── package.json
```

The root workspace orchestrates both projects so common scripts (`npm run dev`, `npm run build`) can execute frontend and backend tasks together.

### Prerequisites

- Node.js 20+
- npm 10+
- A Vercel project for `frontend/` deployment
- A Railway service, or another long-running Node.js host, for `backend/` deployment

### 1. Clone the monorepo

```bash
git clone https://github.com/<your-org>/CodeFlowViz-2.0.git
cd CodeFlowViz-2.0
npm install
```

### 2. Configure environment variables

Create environment files for local development.

#### Frontend: `frontend/.env.local`

```bash
NEXT_PUBLIC_EXECUTE_API_URL=http://localhost:4000/api/execute
```

For production on Vercel, point this value to the deployed Railway endpoint:

```bash
NEXT_PUBLIC_EXECUTE_API_URL=https://<your-railway-service>.up.railway.app/api/execute
```

#### Backend: `backend/.env`

```bash
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

For production on Railway, set `CORS_ORIGIN` to your Vercel deployment URL:

```bash
CORS_ORIGIN=https://<your-vercel-project>.vercel.app
```

### 3. Run the full cockpit locally

```bash
npm run dev
```

This starts both workspaces:

| Workspace | Default URL | Command |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | `npm run dev:frontend` |
| Backend | `http://localhost:4000` | `npm run dev:backend` |

### 3.1 Build and production preview

```bash
npm run build
npm run start
```

Use this flow to verify production bundles before deploying to Vercel/Railway.

### 4. Verify the backend health endpoint

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{
  "ok": true,
  "service": "codeflowviz-backend"
}
```

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

## Roadmap

- **Multi-language execution** — Python and C++ tracing after the JavaScript execution path is hardened.
- **Advanced Logic Node overlays** — Higher-level control-flow nodes rendered above raw trace events.
- **Trace sharing** — Exportable sessions for code reviews, incident analysis, and teaching.
- **Custom cockpit layouts** — Persisted panels for architecture reviews, demos, and debugging workflows.
- **Expanded sandbox policies** — More granular limits for memory, execution time, and API access.


## Open Source Program Context

This repository is prepared for **GirlScript Summer of Code (GSSoC) 2026** contributions and mentoring workflows.

> Note: **GSSoC** refers to **GirlScript Summer of Code**, not Google Summer of Code (GSoC).

### GSSoC 2026 status and timeline

- **Application status**: Accepted (Project Admin track context provided by contributor).
- **Contribution window**: **15 May 2026 to 14 August 2026**.
- **Last day to submit pull requests**: **14 August 2026**.
- **Results, certificates, and prizes**: **September 2026**.

### Issue and PR workflow for GSSoC 2026

If you are contributing through GSSoC 2026, follow this flow for issues:

1. Use project filters (for example, "Good First Issues") and shortlist multiple issues before starting work.
2. Comment on the issue to claim it (example: `Hi, I am a GSSoC 2026 contributor and would like to work on this.`).
3. Wait for maintainer/admin acknowledgement before opening a large PR.
4. In your PR description, include:
   - the issue number,
   - the GSSoC 2026 context,
   - what you tried and what changed.

### Points and label reminder

For contributors, points are awarded only when PRs are merged with required review and the expected GSSoC labels (including approval). PRs marked invalid/spam/AI-slop are not eligible for points.

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

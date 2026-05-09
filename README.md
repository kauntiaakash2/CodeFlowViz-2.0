# CodeFlowViz 2.0

CodeFlowViz is organized as a strict npm workspace monorepo with the deployable UI and execution service separated.

## Workspaces

- `frontend/` - Next.js application containing the UI only. It calls the execution API through `NEXT_PUBLIC_EXECUTE_API_URL`, defaulting to `http://localhost:4000/api/execute` for local development.
- `backend/` - Node.js/Express application containing the execution API, sandbox worker, and tracing/instrumentation logic.

## Local development

```bash
npm install
npm run dev
```

Run a single workspace when needed:

```bash
npm run dev:frontend
npm run dev:backend
```

## Deployment

Deploy `frontend/` to Vercel or another static/Next.js host. Deploy `backend/` to a long-running Node.js environment that supports worker threads and the required execution time for sandboxed traces. Set `NEXT_PUBLIC_EXECUTE_API_URL` in the frontend environment to the deployed backend `/api/execute` URL.

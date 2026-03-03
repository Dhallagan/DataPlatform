# Deploy BasedHoc (Render + Vercel)

This repo deploys cleanly as two services:

- Backend API (`FastAPI`) on Render
- Frontend app (`Next.js`) on Vercel

## 1) Deploy backend on Render

Create a new **Web Service** from this repo with:

- Root Directory: `backend`
- Runtime: `Python 3`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Set these Render environment variables:

- `ANTHROPIC_API_KEY`
- `MOTHERDUCK_TOKEN`
- `MOTHERDUCK_DATABASE` (optional; defaults to `browserbase_demo`)
- `FRONTEND_ORIGIN` = your Vercel app URL (for example `https://your-app.vercel.app`)

After deploy, confirm:

- `https://<your-render-service>.onrender.com/health` returns `{"status":"healthy"}`

## 2) Deploy frontend on Vercel

Create a new Vercel project with:

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Build Command: `npm run build`

Set this Vercel environment variable:

- `NEXT_PUBLIC_BACKEND_URL` = your Render backend URL (for example `https://your-api.onrender.com`)

Then deploy.

## 3) Verify end-to-end

1. Open your Vercel URL
2. Trigger a chat request from the UI
3. In browser devtools, verify frontend requests hit `/api/chat`
4. Confirm those requests resolve successfully through the rewrite to Render

## Notes

- Frontend rewrite now uses `NEXT_PUBLIC_BACKEND_URL` and falls back to `http://localhost:8000` for local development.
- Backend CORS now supports:
  - `FRONTEND_ORIGIN` (single origin), or
  - `FRONTEND_ORIGINS` (comma-separated origins)
- If neither CORS env var is set, backend defaults to localhost frontend origins.

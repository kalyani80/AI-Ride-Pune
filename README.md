# AI-Ride Pune

Ride booking app for Pune with rider, driver, and manager apps. Google Maps routing, AI fare pricing, OTP start, live tracking, and cash payment.

## Local setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Set `DATABASE_URL`, `SECRET_KEY`, `GOOGLE_MAPS_API_KEY`, and `GEMINI_API_KEY` in `backend/.env`.

```bash
python create_tables.py
python seed.py
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Demo logins (password `password123`):

- rider1@example.com
- driver1@example.com
- manager1@example.com

### Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173

Enable Places, Maps JavaScript, and Routes APIs on the same Google key.

## Docker

```bash
docker compose up --build
```

Then run `python create_tables.py` and `python seed.py` inside the backend container once.

## Deploy later

1. Create a PostgreSQL database (Render, Railway, or Neon).
2. Deploy FastAPI with `uvicorn main:app --host 0.0.0.0 --port 8000`.
3. Set `DATABASE_URL`, `SECRET_KEY`, `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`, and `CORS_ORIGINS` to your frontend URL.
4. Build the frontend with `VITE_API_URL` pointing at the public API and `VITE_GOOGLE_MAPS_API_KEY`.
5. Host the `frontend/dist` folder on Vercel, Netlify, or Cloudflare Pages.

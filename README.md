# ai-social-generator

A social media post generator built with React, Vite and Tailwind CSS, backed by a
real language model. Pick a platform and a tone, describe your idea, and get three
ready-to-post captions with hashtags. Includes a credit counter and a pricing modal.

## What's in here

| File | What it is |
| --- | --- |
| `src/App.jsx` | The whole screen: input, platform/tone pickers, credit counter, generated captions, pricing modal. |
| `server.cjs` | A small Express backend that calls the AI provider and handles checkout. Your API key lives here, never in the browser. |
| `.env.example` | Template for your `.env`. Copy it, don't edit it in place. |
| `vite.config.js` | Forwards `/api/*` from the dev server to the backend on port 8787. |

## Setup

```bash
npm install
cp .env.example .env      # then paste your AI key into AI_API_KEY
```

Start both halves in two terminals:

```bash
npm run server   # backend on http://localhost:8787
npm run dev      # app on http://localhost:5173
```

The app is working when the header shows a credit count and no yellow
"No AI key found" banner appears.

## Choosing an AI provider

Anything that speaks the OpenAI `/chat/completions` shape works — only `.env` changes:

| Provider | `AI_BASE_URL` | `AI_MODEL` example |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Groq (generous free tier) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| Together | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| Ollama on your machine | `http://localhost:11434/v1` | `llama3.1` (any text as the key) |

## Tuning the product

Everything worth changing sits at the top of `src/App.jsx`:

- `FREE_CREDITS` — credits a new visitor starts with (default `3`).
- `CREDIT_COST` — charged per generation (default `1`).
- `PLANS` — names, prices, credit amounts and perks in the pricing modal.
- `PLATFORMS` / `TONES` — add or remove options. Keep the matching tables in
  `server.cjs` in sync or the server will reject the request.
- `MAX_RESULTS` — how many past generations stay on screen.

## Payments

`POST /api/checkout` runs in **demo mode** by default: it adds the plan's credits
and charges nothing, so the flow can be tested end to end. The modal's fine print
says so. To charge real money, uncomment the Stripe block in `server.cjs`,
`npm i stripe` and set `STRIPE_SECRET_KEY`. A paid flow also needs a webhook that
credits the balance on `checkout.session.completed`.

## Two things to know before shipping

1. **Credits live in the browser** (`localStorage`), which is fine for a demo or a
   free tool, but a determined user can edit them. If people are paying, keep the
   balance in a database and check it in `/api/generate` before spending money on
   a model call.
2. **`server.cjs` needs a Node host.** Vercel, Render, Railway, Fly and a plain VPS
   all work. Static hosting alone will not run it — move the routes into a
   serverless function instead. Never move the key into the React app to avoid
   that, because anyone visiting the site could read it.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Yellow "No AI key found" banner | `.env` is missing, or the server was not restarted after editing it. |
| "Couldn't reach the AI server" | `npm run server` is not running, or the proxy target/port does not match. |
| "The AI provider rejected your key (401)" | Wrong key, or the key belongs to a different provider than `AI_BASE_URL`. |
| "AI provider error: model not found" | `AI_MODEL` is wrong for that provider. |
| Captions arrive as one long sentence | The model ignored the JSON instruction; try a stronger model. |

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

import { SDK } from 'groq';

export default async function handler(req, res) {
  // Beveiliging voor CORS (zorgt dat je frontend met je backend mag praten)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { topic, platform, tone, includeEmojis, includeHashtags } = req.body;

    // Direct jouw Groq sleutel geactiveerd voor deze test
    const apiKey = "gsk_JltakaANQFbLUS0dTdgyWGdyb3FYa4KFw4LM4yywSDPFKFWH5Hk";
    
    const groq = new SDK({ apiKey: apiKey });

    const prompt = `Write 3 high-quality social media captions for ${platform} about the following topic: "${topic}". The tone should be ${tone}. ${includeEmojis ? 'Include emojis.' : 'No emojis.'} ${includeHashtags ? 'Include hashtags.' : 'No hashtags.'} Return the result as a clean JSON array with 3 string elements only, no markdown formatting.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-20b',
    });

    const responseText = chatCompletion.choices[0].message.content;
    const captions = JSON.parse(responseText.trim());

    return res.status(200).json(captions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Fout bij het genereren van de AI teksten.' });
  }
}


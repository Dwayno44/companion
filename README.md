# A quiet place to talk

A gentle, private chat companion — a warm, always-available presence to talk to.
Built as a small gift: a webpage your Mum can open any time, with no login and
nothing to install.

It is **not** a therapist or a crisis service, and it's designed to know its own
limits and point to real help when that's what's needed.

## How it's put together

- **The page** (`index.html`, `styles.css`, `app.js`, `config.js`) — a plain
  webpage hosted free on GitHub Pages. Her conversations are saved only in her
  own browser; they never leave her device except to fetch a reply.
- **The Worker** (`worker/`) — a tiny program on Cloudflare's free tier that
  holds your Anthropic API key out of public view and relays messages to Claude.
  The companion's personality and safety guidance live here.

```
  Her browser ──▶ Cloudflare Worker (holds the key) ──▶ Claude (Sonnet 4.6)
       ▲                                                       │
       └──────────────── reply streams back ──────────────────┘
```

Designed mobile-first — it's built to feel right on an iPad or phone, and she
can "Add to Home Screen" so it opens like an app with its own icon.

## Setting it up (one time)

You'll do this once. It takes about 20 minutes. Three free accounts are
involved: GitHub (hosts the page), Cloudflare (runs the Worker), and Anthropic
(provides Claude). Only the Anthropic one has a cost — a few dollars a month.

### 1. Get an Anthropic API key
1. Sign up at <https://console.anthropic.com>.
2. Add a little credit (Billing → even $5 lasts a long time at one person's use).
3. Create an API key (API Keys → Create Key) and copy it somewhere safe.

### 2. Deploy the Worker (holds the key)
With [Node.js](https://nodejs.org) installed, from inside the `worker/` folder:

```bash
npx wrangler login                      # opens your browser to Cloudflare (free signup)
npx wrangler secret put ANTHROPIC_API_KEY   # paste your key when prompted
npx wrangler deploy
```

The last command prints the Worker's address, e.g.
`https://companion.yourname.workers.dev`. Copy it.

### 3. Point the page at the Worker
Open `config.js` and paste that address:

```js
const WORKER_URL = "https://companion.yourname.workers.dev";
```

### 4. Publish the page on GitHub Pages
1. Create a new GitHub repository and upload these files (everything except the
   `worker/` folder, though leaving it in is harmless).
2. In the repo: **Settings → Pages → Build from branch → `main` / root → Save**.
3. After a minute, GitHub gives you a web address like
   `https://yourname.github.io/companion/`. That's the link for your Mum —
   bookmark it on her phone or computer.

## Trying it before you deploy
Open `index.html` in a browser as-is and it runs in **demo mode** — the layout
and feel are real, the replies are canned placeholders. Once `config.js` points
at your Worker, it becomes the real thing.

## Making it yours
- **Which Claude model** — the `MODEL` line near the top of `worker/worker.js`.
  It's set to `claude-sonnet-4-6` (warm and cost-effective); change it to
  `claude-opus-4-8` if you ever want the most capable model.
- **Her companion's warmth and what it knows** — edit the `PERSONALISATION`
  block at the top of `worker/worker.js`, then run `npx wrangler deploy` again.
- **Words on the welcome screen** — edit the `#welcome` section of `index.html`.
- **Colours and text size** — the variables at the top of `styles.css`.

## A note on care
This was built with love, but it has real limits. It can be a comfort and a
listening ear; it cannot replace a doctor, a counsellor, or the people who love
her. The safety guidance gently steers toward real help — in Australia,
**Lifeline 13 11 14** (24/7) and **000** in an emergency.

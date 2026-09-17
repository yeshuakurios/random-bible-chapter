# Random Bible Chapter

A tiny static web app that gives you a random, never-repeated Bible chapter
to read, and keeps track of what you've already read so you can work
through the whole Bible in random order without duplicates.

- No build step, no backend — plain HTML/CSS/JS.
- Reading progress is stored in your browser's `localStorage` (per browser,
  not synced across devices).
- A level, rank, and XP system turns your reading history into a number you
  can actually be proud of — see "Levels, XP, and anti-farming" below.
- Optionally, pasting a GitHub token under "Reading log sync" appends each
  chapter you mark as read to `reading-log.json` in a private GitHub repo
  (via the GitHub Contents API), so other tools (like a commentary pipeline)
  can look up what you read today. Using GitHub's API instead of a bespoke
  backend keeps the log reachable from sandboxed environments that only
  allow a small domain allowlist. The token is never stored in this repo —
  only in your browser's `localStorage` — and should be a fine-grained
  personal access token scoped to just that one repo's Contents permission.
- Randomness comes from the Web Crypto API (`crypto.getRandomValues`) with
  rejection sampling, rather than `Math.random()`. See "How random is it?"
  below.

## Running locally

Just open `index.html` in a browser, or serve the folder with any static
file server, e.g.:

```sh
python3 -m http.server
```

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that deploys the site on every push to
`main`. To enable it:

1. Go to the repository's **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.
3. Push to `main` (or re-run the workflow) — the site will be published at
   `https://<username>.github.io/<repo>/`.

## Levels, XP, and anti-farming

Your level is meant to be an honest signal of how much time you've actually
spent reading Scripture — something you could tell a friend and have it mean
something — so it's deliberately hard to inflate:

- **A reading timer.** When a chapter comes up, "Mark as Read" stays disabled
  for a short dwell period. You can't rubber-stamp your way through the
  Bible with rapid clicks.
- **A daily soft cap on XP.** The first 15 chapters you mark in a calendar
  day earn full XP toward your level; chapters beyond that still count
  fully toward your reading progress and achievements, just at a reduced XP
  rate. A single binge session can't out-level weeks of steady, consistent
  reading.
- **Lifetime leveling.** Finishing every chapter of the Bible banks that
  cycle's XP permanently and automatically starts a fresh no-repeat cycle —
  your level never resets, and reading through the whole Bible again keeps
  raising it. Each full completion is tracked and shown on your level card,
  so "Level 63, two full journeys through Scripture" is a real, comparable
  achievement.

The one true reset is "Erase everything & start over" under Reading
history, which wipes your level and completions too — for when you
actually want to start from zero.

## How random is it?

The app uses `crypto.getRandomValues()`, the browser's cryptographically
secure pseudorandom number generator (CSPRNG), instead of `Math.random()`.
It's seeded from the operating system's own entropy sources and is good
enough for security-sensitive uses like generating tokens — well beyond
what's needed here, but it also avoids the subtle statistical biases
`Math.random()` can have. The selection is also done via rejection
sampling over the exact number of unread chapters, so every remaining
chapter has an equal chance of being picked (no modulo bias).

True hardware randomness (e.g. from atmospheric noise or radioactive
decay) isn't available to a browser sandbox, so this is the strongest
randomness a client-side web app can offer.

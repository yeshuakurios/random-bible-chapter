# Random Bible Chapter

A tiny static web app that gives you a random, never-repeated Bible chapter
to read, and keeps track of what you've already read so you can work
through the whole Bible in random order without duplicates.

- No build step, no backend — plain HTML/CSS/JS.
- Reading progress is stored in your browser's `localStorage` (per browser,
  not synced across devices).
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

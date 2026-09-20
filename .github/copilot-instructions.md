# Copilot instructions

A plain static PWA — HTML/CSS/JS with a manifest and icons, no build step,
no framework, no server-side code.

## Stack
- Static site: `index.html`, `app.js`, `data.js`, `style.css`, `manifest.json`, `icons/`
- No `wrangler.jsonc`/`wrangler.toml` in this repo — how/where this deploys (Cloudflare Pages dashboard, GitHub Pages, etc.) isn't documented here. Don't assume a Cloudflare Workers deploy process.

## Deploy
- Don't run any deploy command — there's no CI or deploy tooling visible in this repo to run.
- If a task seems to need a deploy step, say so in the PR instead of guessing at one.

## Coding rules
- Keep the app framework-free and dependency-free unless a task explicitly asks to add tooling.
- Use relative asset paths.
- Never hardcode secrets or API keys.
- Keep changes small and scoped to exactly what the task asks for.
- One branch per task, one focused PR.

## Working notes for the agent
- You can't interact with the running PWA in this workflow — describe what you changed and what should be checked in the deployed app after merge.
- If a task description is ambiguous or too large, say so in the PR description rather than guessing scope.

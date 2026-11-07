# Blueprint (working name)

A phone-first, offline-first concept journal for chefs who want to open their own restaurant. Capture ideas in seconds (text, photo, voice), let the app sort them into seven pillars, answer "Still you?" to find what you truly love, and export a one-page concept summary.

**Front end only.** All data lives on the device in IndexedDB. No accounts, no backend, no analytics. A Supabase backend is planned later (see [Seams for later](#seams-for-later)).

The app name is not final: change `APP_NAME` in [`src/config.ts`](src/config.ts) (it feeds the header, install manifest and one-pager footer).

## Run

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN)
```

Open it in a phone-sized viewport. The service worker only runs in a production build, so to test installing and offline:

```bash
npm run build
npm run preview      # http://localhost:4173
```

Then load the page once, switch the network off (DevTools > Network > Offline) and reload. It should still open and work.

## Test

```bash
npm test             # Vitest: scheduler, strength, pillar suggestion, one-pager, weekly, metrics
npm run build        # also typechecks (tsc --noEmit)
```

## Deploy (Vercel)

Static Vite build, no server.

```bash
npm i -g vercel
vercel               # preview
vercel --prod        # production
```

Or import the repo in the Vercel dashboard. Framework preset: Vite. Build command `npm run build`, output `dist`. [`vercel.json`](vercel.json) already sets the SPA fallback and `no-cache` headers for `sw.js` and the manifest, so updates reach installed phones.

PWA installs require HTTPS (Vercel provides it). On the phone: open the site, then "Add to Home Screen". Camera, microphone and the share sheet also need HTTPS.

## Try it with sample data

First launch is empty. Tap **Load sample data** (Capture screen or Settings) for a made-up West African x Southern counter-service concept. Sample items are badged "Sample" and **Clear sample data** removes only those.

## How it works

| Area | Where |
| --- | --- |
| Capture (text, photo, voice, instant save, optional origin/tags/pillar) | `src/screens/CaptureScreen.tsx`, `src/lib/capture.ts` |
| Pillars, fill pips, moodboard, sort inbox, archive | `src/screens/BlueprintScreen.tsx`, `src/lib/blueprint.ts` |
| Pillar suggestion (`suggestPillar`) | `src/lib/suggestPillar.ts` |
| "Still you?" scheduler (pure) | `src/lib/scheduler.ts` |
| Strength scoring (pure) | `src/lib/strength.ts` |
| One-pager content and canvas renderer, PDF and image export | `src/lib/onepager.ts`, `src/lib/onepagerRender.ts` |
| Weekly day-off view | `src/lib/weekly.ts`, `src/screens/WeekScreen.tsx` |
| Local usage log and metrics | `src/lib/events.ts` |

Rules of thumb:

- **Resurfacing ladder:** first prompt after 2 days, then 7, 21 and 45 days. 🔥 climbs a rung, 🤷 pushes back 7 days, ✗ archives (recoverable in Blueprint > Archived). Never more than 5 prompts; "Dismiss all" hides the stack until 4am.
- **Strength:** new idea = 1, each 🔥 +2, each 🤷 -1 (floor 0). "Strong" is 3 or more. Pillar fill = strong ideas out of 5.
- **One-pager:** only strong ideas (max 2 per pillar), 3 to 6 hero photos, thin pillars show a "still to find" nudge instead of a blank block.

### Pillar suggestion and the optional LLM hook

`suggestPillar(input, opts)` is the single entry point. The default is a local keyword heuristic. A clearly marked hook (`llmSuggester`) can call an endpoint you provide, but it is **off by default** and only used after an explicit opt-in in Settings. It sends the **text** of an idea (never photos or audio) and falls back to the heuristic on any error. Expected contract: `POST { text, tags, pillars }` returns `{ "pillar": "<pillar id>" }`.

### Local usage data

An on-device event log records captures, prompts shown and answered, exports and install time. In **Settings**, tap the version line 7 times to reveal **Export my usage data**. The JSON holds counts, timings and ids only, never the content of any idea. Metrics: captures per week, resonance response rate, install-to-first-export time, ideas with 🔥 more than once (sample data excluded).

## Seams for later

- **Persistence:** screens use the `Repo` interface in [`src/data/repo.ts`](src/data/repo.ts) (plus live reads in `src/data/hooks.ts`). A Supabase/sync implementation can replace `localRepo` without touching screens. No Supabase code or env vars exist yet.
- **Pillar suggestion:** swap or add a `PillarSuggester`.
- Out of scope for the MVP and not built: accounts and sync, push notifications, sharing, dish costing, permits checklists, payments, real-time AI chat.

## Known limits

- **Voice transcription is not included.** Chrome's Web Speech API sends audio to a server, which would break "nothing leaves the device". Voice notes can carry an optional typed caption.
- Camera and microphone flows need a real phone over HTTPS for a full check.
- Clearing site data in the browser deletes the journal (there is no cloud copy yet). Export a one-pager to keep a snapshot.
- iOS Safari may evict site data for PWAs that are not installed and unused for a long time; installing to the home screen avoids that.

## Cloud backup (optional, Supabase)

The app is still local-first: IndexedDB is what the UI reads, and it works fully offline. Signing in (Settings > Cloud backup) adds a background sync to a Supabase project:

- **Sign-in:** email and password (Supabase Auth). If "Confirm email" is still on in the project, new accounts must click the emailed link once before signing in; turn it off under Authentication > Sign In / Providers > Email. There is no password-reset screen yet.
- **What syncs:** captures (text, tags, pillar, resonance history), photos and voice notes (private Storage bucket `captures`, folder per user), and the one-pager name/pitch/hero photos. **Never synced:** sample data, usage event log, settings (theme, LLM endpoint).
- **Conflicts:** last-write-wins by `updatedAt`. Pull first, then push. Runs on sign-in, 3s after changes, and when the phone comes back online.
- **Security:** row-level security on `captures` and `concept_meta` (`auth.uid() = user_id`), storage policies scoped to `<uid>/`.
- **Code:** `src/data/sync.ts`, `src/data/mapping.ts` (pure, tested), `src/data/auth.ts`, `src/components/CloudCard.tsx`.

Setup: copy `.env.example` to `.env.local` and fill in your project URL and publishable key. On Vercel, add the same two variables (`vercel env add VITE_SUPABASE_URL`, `vercel env add VITE_SUPABASE_ANON_KEY`) before deploying. Without them the cloud card says "Not configured" and the app stays local-only.

Schema lives in the `blueprint_sync_schema` migration (tables `captures`, `concept_meta`, bucket `captures`).

# Chat City

[Public city](https://raj921.github.io/chat-city/) · [Demo video](https://youtu.be/3b-vYiftHgU)

**Your chat codes a city, one building per viewer.**

A viewer types `!build a ramen shop with a flickering neon sign`. The streamer approves it. A real Codex SDK thread writes a standalone Three.js module while a crane and live progress ticker show what is happening. The validated building rises from its plot with the viewer's name. Raids open districts, subscriptions add gold beams, and hype trains circle the city.

Plain JavaScript ESM. No framework, bundler, models or building textures. Four direct dependencies: `@openai/codex-sdk`, `three`, `ws`, and `dotenv`.

## Run it

Use **Node 25 or newer**. Node 22 can run most application code, but its permission model cannot enforce the network denial required by generated-code validation. Validation fails closed when the selected Node lacks that capability.

```sh
npm ci
cp .env.example .env
codex login
npm test
npm start
```

If `.env` already exists, preserve it. Codex uses your ChatGPT/Codex login and quota; an OpenAI API key is not needed to generate buildings. If a host launches an older Node, set `VALIDATOR_NODE` to the absolute path of an installed Node 25+ executable. On the development Mac this is `/opt/homebrew/bin/node`.

Open:

| Page | URL |
| --- | --- |
| Public-style city explorer | http://localhost:3000/city.html |
| Streamer approval desk | http://localhost:3000/dashboard.html |
| Simulated Twitch input | http://localhost:3000/dev |
| Transparent OBS source | http://localhost:3000/overlay.html |
| Full city camera | http://localhost:3000/overlay.html?full=1 |

Start in `/dev`: submit a description, open the streamer desk, and click **Approve build**. This invokes the real runtime builder and spends Codex quota. The simulated event buttons exercise raids, subscriptions and hype trains without Twitch credentials. Their activity entries explicitly say simulated. There is no template fallback pretending to be a runtime Codex build.

Fourteen checked-in starter buildings are validated and seeded automatically before the queue starts. They are preserved across restarts and not regenerated. The current city also contains a real runtime smoke-test building by `demo_viewer`. `npm run dev` watches server source; reload pages after front-end changes.

### OBS

Add a **Browser** source, width **1920**, height **1080**, URL `http://localhost:3000/overlay.html`. Leave its background transparent. The city occupies the bottom-right 40% of the screen, with a compact queue panel. Add `?full=1` for a dedicated full-frame city camera. Keep the Node server running.

### Twitch setup

1. Register a Twitch application at [the developer console](https://dev.twitch.tv/console/apps), with redirect `http://localhost:3000`.
2. Obtain a **user access token** for the broadcaster account. Using the broadcaster as the bot keeps the single-token setup simple.
3. Set `TWITCH_CLIENT_ID`, `TWITCH_USER_ACCESS_TOKEN`, `TWITCH_BROADCASTER_ID`, and `TWITCH_BOT_USER_ID` in `.env`. Use numeric IDs, not usernames. Set `PUBLIC_CITY_URL` to your deployed public city.
4. Restart `npm start`. The desk reports Twitch connected after EventSub subscriptions are created.

Required chat scopes are `user:read:chat user:write:chat`. Optional event scopes are `channel:read:redemptions channel:read:subscriptions channel:read:hype_train`. Optional subscriptions can fail on non-Affiliate/Partner channels; the client logs the failure and continues with chat and raids. See [the checked EventSub reference](docs/twitch-reference.md).

```sh
brew install twitchdev/twitch/twitch-cli
twitch configure
twitch token -u -s "user:read:chat user:write:chat channel:read:redemptions channel:read:subscriptions channel:read:hype_train"
```

Do not paste tokens into chat, screenshots, Git or submission material. Enter the token only into the ignored local environment file. Twitch authentication and an actual channel test remain separate from the automated/mock tests.

### Twitch CLI mock

In another terminal:

```sh
twitch event websocket start-server
```

Start the app pointed at the mock (the shell variable overrides `.env`):

```sh
TWITCH_EVENTSUB_URL=ws://127.0.0.1:8080/ws npm start
```

Leave the Twitch IDs and token blank; on a loopback URL the client uses mock identities and derives `http://127.0.0.1:8080/eventsub/subscriptions`. Then, in a third terminal:

```sh
twitch event trigger channel.raid --transport=websocket
twitch event trigger channel.subscribe --transport=websocket
twitch event trigger channel.channel_points_custom_reward_redemption.add --transport=websocket
twitch event trigger channel.hype_train.begin --transport=websocket
twitch event trigger channel.hype_train.end --transport=websocket
```

Verified with Twitch CLI 1.1.24: raid, subscribe and channel-points subscriptions succeed, and the events above create a raid district with a landmark job, a priority subscriber build and a level-2 hype train. That CLI version has no `channel.chat.message` trigger and only hype train **v1**, so the app's chat and hype-train v2 subscriptions log HTTP 400 against the mock; the mock still delivers v1 hype-train events and the app handles them. Use the `/dev` page for `!build`, `!city` and `!demolish`. Match the reward title **Build in Chat City** for channel-point builds. The mock client never sends a real Twitch chat reply.

### Queue and persistence

- Approval starts **off for auto-approval**, including after every restart. Approve individual descriptions in the desk. Turning auto-approval on applies to new descriptions.
- Each ordinary viewer reserves one slot per stream; moderators and the broadcaster may build repeatedly. Skip, moderation rejection, interrupted generation and failed validation refund the viewer slot.
- At most **two** runtime jobs run concurrently. Channel points, subscriber credits and raid landmarks have priority, but still pass moderation and streamer approval.
- `MAX_BUILDS_PER_STREAM` defaults to **25 actual job starts**. Failed jobs still count against the generation budget to prevent unlimited quota retries. Each job gets at most one repair turn. Use **Start a new stream** only when waiting/running jobs are cleared; this resets slots and budget while keeping the city.
- Raids create an edge district. New builders are routed there for ten minutes; existing chatters keep the main city. A district landmark goes through the same building queue.
- Subscribers receive gold trim and a beam on an existing plot, or a priority clubhouse job if they have no plot. The hype train has one car per level and leaves when the event ends.
- State is atomically written to `city/city.json`. An interrupted build is marked failed on restart and its slot refunded. Approved waiting jobs return to manual approval. A corrupt file is rejected rather than overwritten.

### Public export — no account needed

```sh
npm run export
```

`dist/` is a self-contained, anonymous, read-only city. It contains relative URLs, Three.js, building source and a sanitized city snapshot. It does not contain streamer controls, `.env`, jobs, internal job errors or usage logs. Serve it over HTTP; opening `index.html` directly with `file://` will not support module/fetch loading.

Upload `dist/` to any static host. For GitHub Pages, `npm run prepare-pages` copies the validated export into `docs/`; publish the `main` branch's `/docs` directory in repository **Settings → Pages**. `.nojekyll` is included. Pages work beneath `/chat-city/` without a bundler. Re-export and publish after a stream to update the public snapshot. The public snapshot is not a cloud-hosted Codex builder; generation runs on the streamer's machine.

### Vercel public deployment

Import `raj921/chat-city` into Vercel and deploy the `main` branch. The checked-in `vercel.json` selects the **Other** framework, skips installation and building, and serves the validated `docs/` export. No environment variables are needed for the public city explorer. The production domain should be accessible without Vercel Authentication; confirm it in a signed-out browser before sharing it.

For CLI deployments, `.vercelignore` includes only `docs/` and `vercel.json`. Refresh the snapshot with `npm run prepare-pages` before deploying. Keep the complete source in GitHub for local use and judging.

This deployment includes city navigation, the building directory, author/request details and generated-source inspection. It serves a saved snapshot. Live Twitch ingestion, streamer controls and new Codex builds still run in the local Node server. Hosting that runtime requires authenticated streamer controls, durable shared city/job storage and authenticated Codex execution; publishing the static export does not deploy those services.

## How Codex is used

This project was implemented in one parent Codex thread, with bounded implementation subtasks. At runtime, each building gets a new SDK thread in `city/jobs/<id>/`. Its working directory contains a contract, a small example and `check.js`, which uses the exact same validator as the server.

Thread options: workspace-write sandbox, no network/web search, no approvals, low reasoning effort, and skip Git-repository checks. Descriptions are truncated to 200 characters, backtick-escaped and fenced as `VIEWER_DESCRIPTION`, with explicit instructions to treat them as visual data. Safe progress summaries from SDK events are broadcast to all scenes. A validator failure produces **Codex is fixing it**, followed by one repair on the same thread. Only successfully validated bytes are promoted into `city/buildings/`.

Every `turn.completed` token usage and job timing is appended to `city/usage.log`. Run `npm run timings` for current measurements. Never regenerate starter buildings to get a timing number.

### Measured runtime

Three end-to-end successful runtime builds were measured: **58.041 s**, **68.447 s**, and **87.939 s**. The 87.939-second bubble tea shop is the build shown in the demo. Across these three completed jobs, min/median/max are 58.041 / 68.447 / 87.939 s and the mean is 71.476 s. This is a small sample, not a performance guarantee. One earlier infrastructure failure came from a preview host using Node 24; the selected Node 25 validator configuration fixed it. These measurements use real Codex jobs, not the injected SDK used by unit tests.

## Security model

Viewer descriptions and generated JavaScript are untrusted. OpenAI moderation uses `omni-moderation-latest` only when `OPENAI_API_KEY` is configured; without a key it makes no API request. Moderation service errors fail closed, and the server console shows the OpenAI HTTP status (the public overlay only says it is unavailable). A shell-exported `OPENAI_API_KEY` overrides `.env`, so an expired key in your shell profile blocks every build; start with `OPENAI_API_KEY= npm start` to skip moderation. Streamer approval is enabled by default regardless of moderation availability.

Validation first applies a token denylist and a 30,000-byte source limit. It freezes the inspected source, then runs an isolated Node 25+ child with explicit filesystem read grants, **no network grant**, no writes, subprocesses, workers or native addons, a memory ceiling, a three-second timeout and bounded output. It checks the returned Group, materials, lights, finite geometry, triangle/mesh limits, footprint, bottom height and animation at sampled times. The child independently verifies that native network access is denied. A source hash guards against changing code after validation.

**This is a shortcut, not a complete JavaScript sandbox.** Static filtering is not a parser, sampling does not prove all future animation states, and permission flags are not a browser execution sandbox. Keep manual approval on for live demonstrations. Before an unmoderated large-channel launch, move generation/render execution into stronger worker/iframe/container isolation and add operational limits.

Streamer controls bind to loopback, reject other hostnames and cross-origin requests, limit request bodies, and use an explicit static-file allowlist. Generated code is never executed in the server process. Public hosting serves only a validated read-only snapshot.

## Verification and submission

The complete `npm test` run passed **38 tests, 0 failures, 0 skips** on 1 November 2026 with Node 25. A real browser session exercised plot reservation and approval, and the completed runtime buildings are saved in the city.

`npm test` uses `node:test`: validator limits/hangs/network isolation, prompt framing, same-thread repair, usage logging, command parsing, queue concurrency/refunds/budgets/recovery, injected Twitch sessions and export sanitization. HTTP/WebSocket integration uses a real loopback server; environments forbidding listening sockets cannot run that one check. Browser QA also exercised reservation and approval against the real runtime.

See [the demo script](submission/DEMO.md), [Devpost draft](submission/DEVPOST.md), and [release checklist](submission/CHECKLIST.md). Mock events must be labeled as simulated in the video; do not claim real-channel verification until it has been done.

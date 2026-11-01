# Chat City

## Elevator pitch

Your Twitch chat codes a city live on stream, one building per viewer.

## Inspiration

Stream chat creates jokes, rituals and a shared history, but that history usually scrolls away. We wanted every viewer to leave a visible address in the stream's world, and to make the act of building entertaining enough to watch.

## What it does

A viewer types `!build a ramen shop with a flickering neon sign`. The streamer approves the idea. A scaffold and crane appear while a runtime Codex agent writes a small Three.js building from primitives. A live ticker exposes progress. The server validates the module, lets Codex fix one rejected attempt, and raises the finished building with the viewer's name.

Raids open a named district for new chatters. Subscribers unlock a gold beam or priority build. Hype trains become an actual train circling the neighborhood. The streamer can approve, skip and demolish. The city persists between streams and exports to a public, anonymous explorer where visitors can inspect each building's prompt and source.

## How we built it

Plain JavaScript ESM on Node, Three.js and WebSockets. Twitch EventSub provides chat, raids, channel points, subscriptions and hype trains. Runtime buildings use @openai/codex-sdk, one sandboxed thread per job, with explicit progress, usage and duration logging. The queue and event effects are deterministic application code.

Codex is both a development tool and the live building engine. The parent development thread ID is `01a19621-7c50-719b-b487-f4dcea12a095`. Runtime threads are separately recorded in local usage logs.

## Challenges

The interesting boundary is accepting creative descriptions while treating both chat and generated JavaScript as untrusted. We enforce geometry/resource limits, freeze validated source, and check it in a restricted child process. We discovered that native network denial requires Node 25's permission model, then added explicit validator-runtime selection for hosts launching an older Node.

Generation latency and Codex quota also shape the design: two concurrent jobs, one repair attempt, cached starter buildings, per-viewer reservations and a per-stream generation budget. One successful runtime smoke build measured 58.041 seconds; the sample is too small to claim typical performance.

## What we're proud of

Watching the crane turn an individual message into a persistent neighborhood address. Codex's work is visible at runtime, and every finished object keeps its author, original description and inspectable source.

## What we learned

The safety contract, operational recovery and on-stream feedback matter as much as the generated geometry. An isolated process with a denylist is not a full JavaScript sandbox; manual streamer approval remains the default.

## What's next

Stronger worker/container execution isolation, better latency measurements, creator-curated neighborhoods and richer viewer-driven upgrades.

## Submission accuracy notes

Use the verified repository and deployed URL from the release checklist. Include the public demo-video link after recording/upload. Twitch CLI and developer-page effects are simulated, and must be labeled that way. A live channel test has not yet been completed. Optional API moderation is disabled until configured. Do not claim that this draft has been submitted.

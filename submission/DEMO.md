# Chat City — 2:55 demo script

Record at 1920×1080. Use actual app output, not a generated imitation of the interface. Keep auto-approve off. Crop credentials, environment files and OAuth pages out of every shot.

| Time | Shot | Narration |
| --- | --- | --- |
| 0:00–0:10 | Full city cam; slow orbit, clear city title | “Your chat codes a city. One building, one viewer, one permanent place in the neighborhood.” |
| 0:10–0:25 | Developer playground: submit a real description. Label “simulated Twitch input” | “A viewer describes their building. The streamer approves the idea before code runs.” |
| 0:25–0:50 | Approve in desk; scaffold/crane and real Codex ticker. Time-lapse any wait and label it | “A runtime Codex thread writes a Three.js module from primitives. Its progress is visible while the building takes shape.” |
| 0:50–1:10 | Finished building rise; click author/prompt/code | “The server checks geometry and resource limits before accepting the building. Every address keeps its author, prompt and source.” |
| 1:10–1:35 | Simulated raid gate, a queued landmark and newcomer scaffold; sub beam; hype train | “Raids open districts for ten minutes. Subscribers get a beacon. A hype train becomes a train. These event inputs are simulated for this recording.” |
| 1:35–1:55 | Desk skip/refund and moderator demolition | “The streamer can approve, skip or demolish. Viewer slots are refunded on failure, and a fixed stream budget protects Codex quota.” |
| 1:55–2:20 | Terminal: tests for rejected/hanging code and same-thread repair; show actual log, label injected test if not a real failure | “Descriptions are untrusted data. Modules face a denylist and a restricted Node child with no network or writes. A failed check gets one Codex repair. This is a shortcut, not a full sandbox, so manual approval stays on.” |
| 2:20–2:40 | AGENTS.md, code structure, runtime thread logs without sensitive values | “Codex built the application, and Codex is also the engine running inside it. One successful runtime smoke build took 58 seconds.” |
| 2:40–2:55 | Public city URL; anonymous visitor click/code view | “The city survives the stream and exports to a public link. Chat doesn't just watch the world. It builds it.” |

For a real Twitch demonstration, replace the simulated chat shot with a real authorized channel and test it beforehand. Do not represent developer buttons or Twitch CLI as real viewer activity. If no genuine runtime repair occurs, show the automated repair test with an explicit “injected validation test” caption.

The saved `demo_viewer` module is a real runtime result. You can use it for the final reveal, but a new on-camera build spends another Codex job. Run `npm run timings` immediately before recording and use the current measured number.

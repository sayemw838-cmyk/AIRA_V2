# AIRA Build Plan

## Direction

Evolve AIRA from a single-page assistant into a **task-aware personal agent** with an optional desktop companion. The uploaded Coucou project is an architecture and interaction reference only; AIRA will use its own name, visual language, character, sounds, and assets.

## Product principles

- **User-controlled:** consequential actions require explicit approval.
- **Honest:** AIRA never claims an action happened without tool evidence.
- **Local-first:** keys and personal state stay on the user's device where practical.
- **Fail-open:** a companion or relay must never block the underlying workflow.
- **Focus-aware:** one active task can be in focus while other tasks remain visible.
- **Cross-platform later:** keep the web core independent from any desktop shell.

## Staged roadmap

### Phase 1 — Web task core (current build)

1. Normalize task states: `idle`, `thinking`, `working`, `searching`, `waiting_for_input`, `waiting_for_approval`, `error`, `ratelimited`, `finished`, and `cancelled`.
2. Add a small task/activity HUD to the chat composer so users can see the active task, current action, and state without reading the full transcript.
3. Make `/tasks`, `/skills`, model failover, and tool activity publish the same state events.
4. Keep the task launcher as a prompt picker; clicking it fills the composer and never auto-sends.
5. Add focused-task persistence and a compact task history view.

### Phase 2 — AIRA desktop companion

1. Create a separate Tauri 2 shell around a small AIRA companion UI.
2. Define a narrow bridge contract: `task.started`, `task.progress`, `task.waiting`, `task.finished`, `task.failed`, `approval.requested`, and `model.changed`.
3. Store secrets through OS credential storage; do not copy browser API keys into desktop files.
4. Add native notifications and an always-available task/status surface.
5. Keep the bridge optional and fail-open when the desktop companion is closed.

### Phase 3 — Safe desktop relay

1. Add a local relay for desktop events and optional Claude Code hooks.
2. Use short timeouts and never block Claude Code if AIRA is unavailable.
3. Show approval/question states with explicit Allow/Deny or answer controls.
4. Keep installation changes reviewable, backed up, and user-confirmed.

### Phase 4 — Integrations

1. Add opt-in connectors for GitHub, calendar, email, workflow automation, and deployments.
2. Model every connector action as a task with evidence, permissions, and a reversible path where possible.
3. Surface rate limits and provider/model failover as visible states.

### Phase 5 — Original AIRA companion identity

1. Design an original AIRA visual companion and icon set.
2. Do not reuse Coucou/Mochi artwork, sounds, names, screenshots, or media.
3. Add visual states only after the task-state contract is stable.

## First slice being built now

Add the shared web task-state contract and a compact activity HUD in `index.html`. This gives `/tasks`, `/skills`, and model failover a common surface and creates the event boundary the future desktop companion can consume.

## Reference and licensing boundary

Coucou source code is MIT licensed, but its names, character, artwork, sounds, icons, and media are separately protected according to `LICENSE-ASSETS.md`. This plan borrows concepts and architecture, not protected assets or branding.

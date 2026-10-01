# AIRA Upgrade Backlog

This backlog is based on an audit of the current AIRA single-page build and the uploaded Coucou reference. It focuses on systems that materially improve reliability, transparency, and daily usefulness.

## Highest priority

### 1. Real Task Center

**Current gap:** `/tasks` records task summaries in local storage, but the HUD and task records are not yet one unified task system.

**Upgrade:** create a focused task store with:

- stable task ID
- goal and owner
- current state
- current step
- progress count
- activity events
- model/provider used
- retry count
- created/updated/completed timestamps
- focus selection
- pause/resume/cancel

**Why:** this becomes the foundation for Lock In, notifications, desktop companion support, and background execution.

### 2. Task Executor Registry

**Current gap:** arbitrary `/tasks <goal>` work often stops at a plan because only a few built-in task types have local executors.

**Upgrade:** define explicit executor types:

- `calculator`
- `workspace-file`
- `research`
- `finance-analysis`
- `report-generation`
- `lockin`
- `integration-action`

Each executor should declare its tools, required inputs, approval level, and verification rules.

### 3. Structured task reports

**Current gap:** generic task completion is parsed from plain-text fields such as `Outcome:` and `Verification:`. Formatting variation can produce false incomplete or false complete results.

**Upgrade:** request and validate a JSON result schema, then render the same schema in Markdown for the user. Reject malformed reports as `PARTIAL` rather than guessing.

### 4. Provider health and model router

**Current gap:** model failover works at request time but does not maintain a durable health view or explain routing decisions.

**Upgrade:** maintain short-lived provider health records:

- available / rate-limited / schema-incompatible / auth-failed
- last failure and cooldown
- latency estimate
- tool support profile
- task-type suitability
- selected-model explanation

### 5. Approval center and audit log

**Current gap:** deletion approval exists, but there is no general approval queue or durable evidence record.

**Upgrade:** add a permission object for every consequential action:

- exact action
- target
- reason
- data to be sent
- reversibility
- allow once / always allow / deny
- timestamp and decision

Keep a local audit timeline of intentions, tools, results, approvals, and verification.

## Reliability upgrades

### 6. Secure secret storage boundary

API keys currently live in browser local storage. That is convenient but vulnerable to any script running in the page context. Add a storage adapter with Web Crypto where possible, and let the future desktop shell use OS credential storage. Never place secrets in task history or exports.

### 7. Workspace versioning and export

The IndexedDB workspace needs:

- file search
- rename and move
- version history
- diff view
- import/export as ZIP
- backup and restore
- per-project instructions
- clear workspace controls

### 8. Background task recovery

A task should recover after refresh or tab closure:

- persist a resumable checkpoint
- mark interrupted work as `paused` rather than failed
- offer Resume / Retry / Cancel
- prevent duplicate execution through an idempotency key

### 9. Tool capability negotiation

Before an agent call, build a capability profile for the selected model/provider. Do not send incompatible tools. Record why a tool was omitted, and retry only when the error is classified.

### 10. Offline and network states

Add explicit states for offline, provider timeout, authentication failure, rate limit, and schema incompatibility. Queue safe local work offline and defer network work with a clear retry action.

## Finance-focused upgrades

### 11. Finance Workbench

A dedicated workspace mode for accounting work:

- close checklist
- bank reconciliation checklist
- budget vs actual
- variance explanations
- journal-entry review
- KPI and cash-flow summaries
- source/evidence links
- reviewer sign-off
- export to Excel/PDF

### 12. Spreadsheet and CSV pipeline

Add safe local parsing and analysis for CSV/XLSX with:

- schema preview
- column type detection
- formula/result distinction
- outlier checks
- reconciliation totals
- chart generation
- source file hash and report evidence

### 13. Review and segregation of duties

For finance workflows, separate preparer and reviewer roles. AIRA can draft and calculate, but a human must approve posting, sending, publishing, or changing accounting records.

## User experience upgrades

### 14. Command palette and keyboard layer

Add a searchable command palette for task launch, model selection, workspace search, Lock In, new conversation, and approval actions. Make all primary controls keyboard accessible.

### 15. Memory with controls

Add explicit memory categories:

- profile
- preferences
- projects
- recurring workflows
- temporary context

Every memory item needs source, confidence, created time, edit, and forget controls.

### 16. Conversation branching

Support branch from any message, compare branches, retry with another model, and merge a selected answer back into the main conversation.

### 17. Attachments and context packs

Add local file drag-and-drop with a context preview, file type limits, redaction controls, and a clear list of what will be sent to a provider.

### 18. Accessibility and responsive polish

Add keyboard focus states, reduced-motion support, screen-reader labels, high-contrast testing, mobile layout checks, and clearer error recovery controls.

## Architecture upgrades

### 19. Split the single HTML file

The current application is a large single-file build. Move toward modules:

- `core/state.js`
- `core/events.js`
- `core/storage.js`
- `core/models.js`
- `agent/router.js`
- `agent/tools.js`
- `tasks/task-store.js`
- `tasks/executors.js`
- `ui/chat.js`
- `ui/settings.js`
- `ui/task-center.js`

Keep the current file working during the migration with a small build step.

### 20. Test harness and CI

There is currently no package/build/test setup in the AIRA repository. Add:

- JavaScript syntax/type checks
- unit tests for command parsing and task state transitions
- mocked provider tests
- failover tests
- workspace CRUD tests
- approval boundary tests
- a browser smoke test
- CI checks before any Git addition

### 21. Desktop companion bridge

Once the web task contract is stable, build a separate Tauri shell with a small event bridge:

```text
task.started
task.progress
task.waiting
task.finished
task.failed
approval.requested
model.changed
```

The companion must be optional and fail-open. It should not duplicate the web app's business logic.

## Recommended next three builds

1. **Real Task Center + unified task store**
2. **Task Executor Registry + structured JSON reports**
3. **Approval Center + audit timeline**

These three upgrades will make AIRA feel like a reliable agent rather than a chat interface and will give the future desktop companion a stable foundation.

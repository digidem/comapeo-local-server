# Progress

## Current Status

- Date: 2026-03-06
- Active task: Batch 4 – Invite automation
- Status: Batch 3 complete
- Owner: orchestration agent

## Completed Work

### Batch 1 – Repo bootstrap (all 4 tasks)

- Task: Create repo skeleton with src/config, src/core, src/daemon, test, Docker files
- Task: Pin Node 24.x; document linux/arm64 primary, linux/amd64 optional
- Task: Add smoke startup command (node --run start:smoke)
- Task: Batch 1 review – install clean, tests pass, smoke passes
- Commit: feat: bootstrap repo skeleton with Node-first daemon structure

### Evidence

- Commands run:
  - `npm install` → 544 packages, no errors (devEngines warn for Node 25 on dev machine is expected)
  - `npm run typecheck` → clean
  - `npm test` → 5/5 passed (test/config.test.ts)
  - `node --run start:smoke` → daemon boots, loads config, exits cleanly on SIGINT
- Tests/checks: all passed
- Result: green

### Files Changed

- `package.json` – Node-first ESM project, tsx, vitest, comapeo-core deps
- `tsconfig.json` – NodeNext module/resolution, strict
- `.gitignore`
- `.nvmrc` – already present (24.13.0)
- `.env.example`
- `src/config/index.ts` – typed Config + loadConfig skeleton (full impl in Batch 2)
- `src/core/index.ts` – CoreHandle type placeholder
- `src/daemon/index.ts` – entrypoint with config load and signal handling
- `scripts/smoke.ts` – smoke-start runner (temp dir, SIGINT after 2s)
- `test/config.test.ts` – 5 unit tests for loadConfig
- `Dockerfile` – multi-stage, arm64/amd64, native-dep build tools
- `docker-compose.yml` – host networking, /data volume, env pass-through

## Decisions

- Decision: Use `tsx` (not `--experimental-strip-types`) for running TypeScript
  - Reason: More reliable, no limitations with module syntax; consistent with dev workflow
  - Follow-up: evaluate stripping at compile time if container size matters

- Decision: Use `.js` extensions in ESM imports even in TypeScript source
  - Reason: NodeNext module resolution requires explicit extensions; tsc maps .js → .ts
  - Follow-up: none

- Decision: `defaultIsArchiveDevice: true` will be preserved from desktop reference (Batch 3)
  - Reason: PLAN.md says to preserve archive-device defaults
  - Follow-up: confirm in Batch 3 implementation

- Decision: docker-compose uses `network_mode: host` for mDNS (ciao) to work
  - Reason: PLAN.md explicitly requires this
  - Follow-up: Batch 5 will verify mDNS visibility

## Open Blockers

None.

### Batch 2 – Config and persistence

- Task: Full valibot-based env parsing/validation for all 7 env vars
- Task: Root-key generation and file persistence with env override support
- Task: Batch 2 review – identity stability confirmed across restarts
- Commit: feat: implement valibot config validation and root-key persistence

### Evidence (Batch 2)

- Commands run:
  - `npm test` → 20/20 pass (13 config + 7 root-key)
  - `npm run typecheck` → clean
  - `node --run start:smoke` → boots and exits cleanly
- Tests: all passed
- Result: green

### Files Changed (Batch 2)

- `src/config/index.ts` – full valibot schema, loadConfig(env?) with error wrapping
- `src/config/root-key.ts` – loadOrCreateRootKey(), file persistence, env override
- `test/config.test.ts` – 13 tests covering all env vars and validation
- `test/root-key.test.ts` – 7 tests: first-run, persistence, override, corruption, mkdir

### Batch 3 – Core bootstrap and lifecycle

- Task: MapeoManager bootstrap (no Electron/utilityProcess/@sentry)
- Task: Storage directory initialization (sqlite-dbs, core-storage, maps)
- Task: setDeviceInfo on startup
- Task: Graceful SIGTERM/SIGINT shutdown (mDNS → discovery → Fastify → manager.close)
- Task: Batch 3 review – confirmed full startup/shutdown cycle via smoke run
- Commit: feat: implement core bootstrap, storage init, device info, graceful shutdown

### Evidence (Batch 3)

- Commands run:
  - Full manual smoke with DEBUG=comapeo:* → complete startup + clean shutdown log
  - `npm test` → 20/20 pass
  - `npm run typecheck` → clean
- Startup sequence confirmed:
  1. Storage dirs created
  2. MapeoManager initialized
  3. Device info set (name + deviceType)
  4. Local peer discovery started (TCP server)
  5. mDNS service advertised via ciao
  6. "READY" written to stdout
  7. On SIGINT: mDNS shutdown → discovery stop → Fastify stop → manager.close
  8. "Core stopped cleanly" / "Daemon stopped cleanly"

### Files Changed (Batch 3)

- `src/core/index.ts` – full MapeoManager bootstrap, storage init, discovery, shutdown
- `src/daemon/index.ts` – wired to initCore + loadOrCreateRootKey, READY signal

### Decisions (Batch 3)

- Decision: Use createRequire instead of import.meta.resolve for drizzle migrations path
  - Reason: tsx resolves import.meta.resolve to index.jsx file not the directory; createRequire is stable
  - Follow-up: none
- Decision: defaultIsArchiveDevice=true preserved from desktop reference
  - Reason: PLAN.md explicitly requires it
- Decision: Shutdown errors are non-fatal (logged but don't throw)
  - Reason: Best-effort cleanup; process should exit even if one step fails

## Next Handoff

- Next task: Batch 4 – Invite automation
  1. Subscribe to manager.invite events, auto-accept when COMAPEO_AUTO_ACCEPT_INVITES=true
  2. Boot-time reconciliation of pending invites
  3. Idempotent handling of joined/canceled/failed invites
- Preconditions: Batch 3 complete (done)
- Notes: See node_modules/@comapeo/core/src/invite/invite-api.js for InviteApi events and accept() signature

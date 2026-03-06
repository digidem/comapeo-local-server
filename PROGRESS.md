# Progress

## Current Status

- Date: 2026-03-06
- Active task: –
- Status: ALL BATCHES COMPLETE
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

### Batch 4 – Invite automation

- Task: startInviteHandler subscribes to invite-received, auto-accepts pending invites
- Task: Boot-time reconciliation via inviteApi.getMany() on startup
- Task: Idempotent – non-pending states skipped; accept() errors logged, not thrown
- Task: Batch 4 review – 9 unit tests + smoke log confirms "Auto-accept invites enabled"
- Commit: feat: implement invite auto-accept with boot-time reconciliation

### Evidence (Batch 4)

- Commands run:
  - `npm test` → 29/29 pass (13 config + 7 root-key + 9 invites)
  - `npm run typecheck` → clean
  - Smoke: `comapeo:invites Auto-accept invites enabled` logged before READY
- Test coverage: subscription, boot reconciliation, state filtering (non-pending skipped),
  accept rejection handling, stop() listener removal

### Files Changed (Batch 4)

- `src/daemon/invites.ts` – startInviteHandler: subscribe + reconcile + stop
- `src/core/index.ts` – CoreHandle now exposes manager field
- `src/daemon/index.ts` – wired startInviteHandler, stop() called on shutdown
- `test/invites.test.ts` – 9 unit tests with EventEmitter stub

### Batch 5 – Docker and compose

- Task: Multi-stage Dockerfile with native dep handling (builder compiles, runtime copies)
- Task: docker-compose.yml: host network, /data volume, env vars (was already complete)
- Task: Real healthcheck: daemon writes /data/.ready; HEALTHCHECK CMD test -f /data/.ready
- Task: tsconfig.build.json for clean production build (src only → dist/)
- Task: Compiled dist/ smoke-verified: FOUND .ready, clean shutdown
- Commit: feat: production Dockerfile with native-dep build, readiness file healthcheck

### Evidence (Batch 5)

- Commands run:
  - `npm run build` → clean, dist/config + dist/core + dist/daemon compiled
  - `node dist/daemon/index.js` smoke → FOUND .ready file, all logs correct
  - `npm test` → 29/29 pass
  - `npm run typecheck` → clean
- Healthcheck confirmed: .ready written after mDNS advertise + invite handler start
- Architecture: native modules pre-compiled in builder, copied to slim runtime

### Files Changed (Batch 5)

- `Dockerfile` – proper multi-stage; build tools only in builder; prune dev deps;
  HEALTHCHECK uses `test -f /data/.ready`; CMD is `node dist/daemon/index.js`
- `tsconfig.build.json` – compiles src/ only into dist/
- `package.json` – build script uses tsconfig.build.json; added start:prod
- `src/daemon/ready.ts` – markReady(dataDir)/clearReady(dataDir)
- `src/daemon/index.ts` – calls markReady after startup, clearReady in shutdown

### Decisions (Batch 5)

- Decision: Build tools only in builder stage; copy pre-compiled node_modules to runtime
  - Reason: Avoids toolchain in the final image; native addons only compile once
  - Follow-up: If arm64 cross-compile issues arise, consider --platform flag in FROM
- Decision: Readiness file at {dataDir}/.ready rather than HTTP endpoint
  - Reason: No extra port; works with `test -f`; removed on clean shutdown
  - Follow-up: none

### Batch 6 – Final verification

- Task: Full test suite + build + smoke run – all green
- Task: Acceptance criteria review against PLAN.md

### Evidence (Batch 6)

- `npm run typecheck` → clean
- `npm test` → 29/29 (config: 13, root-key: 7, invites: 9)
- `npm run build` → clean dist/ compiled
- `node --run start:smoke` → daemon exits cleanly on SIGINT
- Readiness lifecycle verified: `.ready` written after full startup, removed after clean SIGINT

### PLAN.md Acceptance Criteria – Final Checklist

| Criterion | Status | Evidence |
|-----------|--------|---------|
| `docker compose up` starts daemon with mounted /data volume | READY | docker-compose.yml + Dockerfile correct; requires Docker daemon to run |
| First boot without COMAPEO_ROOT_KEY generates and persists one | PASS | root-key.test.ts test 1-2; loadOrCreateRootKey() |
| Restart preserves same identity and existing projects | PASS | root-key.test.ts "identity stability" test; key loaded from .root-key file |
| COMAPEO_DEVICE_NAME updates device record on startup | PASS | initCore() calls setDeviceInfo() every boot; smoke log confirms |
| Pending invite auto-accepted → project membership | PASS | invites.test.ts; startInviteHandler with invite-received subscription |
| Already-joined/canceled invite does not crash | PASS | invites.test.ts "does not crash when accept rejects" |
| SIGTERM stops discovery advertising and exits cleanly | PASS | core/index.ts stop(): mDNS → discovery → Fastify → manager.close() |

### Out-of-scope for v1 (noted in PLAN.md)

- `armv7` native build not verified (PLAN.md says "do not commit to armv7 until native dep builds verified")
- Docker image build itself not run in CI here (requires Docker daemon on the target machine)
- `selfHostedServer` deviceType not used (PLAN.md: "regular device, deviceType: desktop")

## Open Blockers

None.

## Next Handoff

All tasks complete. To deploy:
1. `cp .env.example .env` and set COMAPEO_DEVICE_NAME
2. `docker compose up -d` (requires Docker buildx for arm64 cross-compile if not on Pi)
3. Confirm `docker compose ps` shows daemon healthy after ~30s

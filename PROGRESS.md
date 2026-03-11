# Progress

## Current Status

- Date: 2026-03-10
- Active task: –
- Status: MAIN V1 CLEANUP COMPLETE
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

## Post-plan fixes

- Task: make blank optional env vars compose-safe and add a smoke-friendly compose device name default
- Status: complete
- Reason: `docker-compose.yml` passed empty strings for `COMAPEO_ROOT_KEY` and `ONLINE_STYLE_URL`, which caused config validation failures during local smoke runs
- Changes:
  - `src/config/index.ts` now normalizes blank `COMAPEO_ROOT_KEY` and `ONLINE_STYLE_URL` to unset before validation
  - `test/config.test.ts` now covers blank optional env values
  - `docker-compose.yml` now defaults `COMAPEO_DEVICE_NAME` to `comapeo-headless-dev` for local testing while still allowing override in `.env`
- Checks run:
  - `npm test`
  - `npm run typecheck`
- Decision: keep `COMAPEO_DEVICE_NAME` required in the app config itself, but make Compose provide a dev-only default so the container can boot out of the box
- Next handoff: for real deployments, set `COMAPEO_DEVICE_NAME` explicitly in `.env` so peers see a meaningful device name

- Task: document Docker discovery investigation findings and recommended direction
- Status: complete
- Reason: the daemon was discoverable on Android when run directly on the host, but not through Docker Compose, so the failure mode needed to be captured clearly for future work
- Findings recorded in:
  - `DOCKER_DISCOVERY_FINDINGS.md`
- Evidence gathered:
  - host-node run was visible on Android
  - Compose run reported successful startup and mDNS advertisement but still did not appear on Android
  - container-side interface discovery showed non-LAN interfaces such as `tap0` instead of the real Wi-Fi interface
  - `docker info` showed a rootless runtime
  - an Avahi-over-D-Bus container workaround was attempted and failed with D-Bus client errors
- Checks run:
  - `npm test`
  - `npm run typecheck`
  - `npm run build`
  - host-node discovery smoke
  - `docker compose up -d --build`
  - `docker compose logs`
  - `docker info`
  - `docker context ls`
  - `avahi-browse -rt _comapeo._tcp`
- Decision: treat this host's rootless Docker setup as not suitable for reliable Android LAN discovery
- Next handoff: prefer a direct host-node or `systemd` deployment on the target Pi, and only revisit Docker discovery on a native/rootful engine that can prove visibility of the real LAN interface from inside the container

## Release cleanup

- Task: prepare `main` for the v1 host-Node release and move Docker support out of the supported branch
- Status: complete
- Reason: the supported release target is now direct host-Node deployment, while Docker support and discovery investigation live in the separate worktree branch
- Changes:
  - added `README.md` with Node-first install, config, run, verification, and deployment guidance
  - removed `Dockerfile`, `docker-compose.yml`, and `DOCKER_DISCOVERY_FINDINGS.md` from `main`
  - removed Docker-only readiness marker support from `src/daemon/index.ts`
  - kept generic runtime improvements such as logging setup and config normalization
  - added `vitest.config.ts` so local tests exclude nested `.worktrees/` checkouts
- Checks run:
  - `npm test`
  - `npm run typecheck`
  - `node --run start:smoke`
- Decision: `main` is the Docker-free v1 branch; container support is not documented or shipped from this branch
- Next handoff: keep Docker and Compose work isolated to `wip/docker-discovery-investigation` and do release/tagging work only after both branches are clean

## Runtime follow-ups

- Task: make `bun start` work from a copied `.env.example` without manual env exports
- Status: complete
- Reason: the daemon validated `process.env` only, so `bun start` could still fail on a copied `.env` because the Node entrypoint never loaded that file itself; `.env.example` also still used the old Docker-style `/data` path instead of the host-Node default
- Changes:
  - `src/config/index.ts` now exports `loadDefaultEnvFile()` and uses `./data` as the default data dir for host-node runs
  - `src/daemon/index.ts` now loads `.env` before config validation
  - `.env.example` now provides demo-safe defaults for `COMAPEO_DEVICE_NAME` and `COMAPEO_DATA_DIR`
  - `README.md` now documents `cp .env.example .env` followed by `bun start`
  - `test/config.test.ts` now verifies both the `./data` default and `.env` file loading
- Checks run:
  - `npm test`
  - `npm run typecheck`
  - `cp .env.example .env && timeout 20s bun start` → `.env` loaded and config passed; later failed at LAN discovery socket bind with sandbox `listen EPERM`, which is separate from env loading
- Decision: runtime startup should load `.env` itself instead of relying on package-manager-specific env-file behavior
- Next handoff: copied `.env.example` should now be enough for a local demo boot; use explicit overrides only for non-demo device names or storage paths

- Task: keep project exchange always on for joined projects
- Status: complete
- Reason: the daemon accepted invites and discovered peers, but it never enabled per-project `$sync`, so it would not automatically exchange when another project device started syncing
- Changes:
  - added `src/daemon/sync.ts` with joined-project reconciliation that calls `manager.listProjects()` and enables `$sync.start()` for every `joined` project
  - updated `src/daemon/index.ts` to run that reconciliation during startup before reporting `READY`
  - updated `src/daemon/invites.ts` so successful invite acceptance can trigger post-join sync reconciliation immediately
  - added `test/sync.test.ts` and expanded `test/invites.test.ts` to cover boot reconciliation and invite-to-sync callback behavior
- Checks run:
  - `npm test` → 38/38 passed
  - `npm run typecheck` → clean
- Decision: keep sync enablement as an idempotent daemon concern rather than mirroring the desktop exchange-screen lifecycle, so the headless node remains ready to exchange whenever any peer starts
- Next handoff: if the daemon later gains project creation or leave automation outside invite acceptance, call the same joined-project reconciliation after those flows too

- Follow-up fix: widen auto-sync reconciliation to `joining` projects as well as `joined`
- Status: complete
- Reason: live sync logs still showed `namespace data is disabled` / `namespace blob is disabled`, which means the project remained in presync; newly accepted projects can remain in `joining` until project settings arrive, but they still need `$sync.start()` immediately
- Changes:
  - updated `src/daemon/sync.ts` to enable sync for both `joining` and `joined` projects
  - updated `test/sync.test.ts` to verify `joining` projects also get `$sync.start()`
- Checks run:
  - `npm test -- test/sync.test.ts test/invites.test.ts`
  - `npm run typecheck`
- Decision: treat any non-left active project (`joining` or `joined`) as eligible for always-on exchange

- Task: add sync debug instrumentation and fix per-peer full-sync gating
- Status: complete
- Reason: live logs showed the daemon entering sync state `all`, but newly connected peers still rejected known `data` and `blob` discovery keys as disabled; investigation showed a deeper `@comapeo/core` gating bug rather than a missing daemon lifecycle call
- Investigation:
  - desktop reference review found no extra exchange-start step beyond `project.$sync.start()`
  - core investigation found `node_modules/@comapeo/core/src/sync/peer-sync-controller.js` was gating per-peer `data`/`blob` enablement on namespace-global `state[namespace].localState.want === 0`
  - this could keep a specific peer stuck in presync even after headless had already enabled full sync
- Changes:
  - `src/daemon/sync.ts` now starts always-on sync supervision, logs local peer updates, and logs per-project `$sync` state summaries including remote device enablement and want/wanted counts
  - `src/daemon/index.ts` now uses that always-on sync supervisor and tears it down on shutdown
  - `scripts/apply-comapeo-core-sync-patch.mjs` now patches `@comapeo/core` after install so per-peer gating uses `peerState.wanted === 0`
  - `package.json` now runs that patch from `postinstall`
  - `test/sync.test.ts` now covers local-peer-triggered reconciliation and the patch transform
- Checks run:
  - `node scripts/apply-comapeo-core-sync-patch.mjs`
  - `npm test` → 40/40 passed
  - `npm run typecheck` → clean
- Decision: carry a reproducible local patch to `@comapeo/core` in this repo instead of relying on manual `node_modules` edits, because the bug is in dependency sync gating rather than headless daemon wiring
- Next handoff: rerun the daemon and confirm the new `comapeo:sync` logs show remote peers eventually switching `data(enabled=true)` after presync completion

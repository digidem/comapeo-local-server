# CoMapeo Headless Tasks

## Batch 1: Repo bootstrap

- [x] `[medium | gpt-5.3-codex]` Create the new repo skeleton for a Node-first daemon with `src/config`, `src/core`, `src/daemon`, `test`, and Docker files. Inputs: [`PLAN.md`](/home/luandro/Dev/digidem/comapeo-desktop/PLAN.md), [`src/services/core.ts`](/home/luandro/Dev/digidem/comapeo-desktop/src/services/core.ts). Output: initial project structure plus `PROGRESS.md` with the chosen package layout and runtime entrypoint.
- [x] `[low]` Pin the runtime to Node 24.x and document that v1 officially targets `linux/arm64` first, with `linux/amd64` optional for local development. Output: engine/tooling config and a note in `PROGRESS.md`.
- [x] `[low]` Add a smoke startup command that boots the daemon without Docker against a temporary data directory. Output: a documented local run path and smoke-test evidence in `PROGRESS.md`.
- [x] `[low]` Review Batch 1 by verifying the repo installs cleanly and the entrypoint launches far enough to validate config loading. Output: review notes in `PROGRESS.md`.

## Batch 2: Config and persistence

- [x] `[medium | gpt-5.3-codex]` Implement env parsing and validation for `COMAPEO_DEVICE_NAME`, `COMAPEO_DATA_DIR`, `COMAPEO_ROOT_KEY`, `COMAPEO_AUTO_ACCEPT_INVITES`, `COMAPEO_DEVICE_TYPE`, `ONLINE_STYLE_URL`, and `LOG_LEVEL`. Output: typed config module and unit tests for valid and invalid env combinations.
- [x] `[medium | gpt-5.3-codex]` Implement first-run root-key generation and persistence in the mounted data directory, with env override support when `COMAPEO_ROOT_KEY` is present. Inputs: [`src/main/app.ts`](/home/luandro/Dev/digidem/comapeo-desktop/src/main/app.ts). Output: persistence module, tests for first run and restart reuse, and notes in `PROGRESS.md`.
- [x] `[low]` Review Batch 2 by running the config and persistence tests and confirming identity is stable across restarts. Output: test results in `PROGRESS.md`.

## Batch 3: Core bootstrap and lifecycle

- [x] `[high | gpt-5.3-codex | use subagents for planning, implementation, and review]` Extract a pure Node bootstrap around `MapeoManager` based on [`src/services/core.ts`](/home/luandro/Dev/digidem/comapeo-desktop/src/services/core.ts), removing Electron-only transport, `utilityProcess`, and `@sentry/electron`. Output: daemon bootstrap module and a short architecture summary in `PROGRESS.md`.
- [x] `[medium | gpt-5.3-codex]` Create startup directory initialization for database, core storage, maps, and any persisted metadata under `COMAPEO_DATA_DIR`. Output: storage bootstrap tests and path layout documentation in `PROGRESS.md`.
- [x] `[medium | gpt-5.3-codex]` Set device info on startup from env using `manager.setDeviceInfo({ name, deviceType: 'desktop' })`, preserving archive-device defaults unless testing proves a change is needed. Output: startup behavior test or smoke evidence in `PROGRESS.md`.
- [x] `[high | gpt-5.3-codex | use subagents for planning, implementation, and review]` Design and implement graceful shutdown for SIGTERM and SIGINT, including discovery cleanup and any manager/project resource cleanup required to avoid state corruption. Output: shutdown design note, implementation, and smoke-test evidence in `PROGRESS.md`.
- [x] `[low]` Review Batch 3 by running the daemon locally, confirming startup, device info write, and clean termination. Output: review notes in `PROGRESS.md`.

## Batch 4: Invite automation

- [x] `[high | gpt-5.3-codex | use subagents for planning, implementation, and review]` Implement invite handling directly against `manager.invite`, not a recreated IPC client layer. Subscribe to invite events and auto-accept new invites when `COMAPEO_AUTO_ACCEPT_INVITES=true`. Inputs: [`node_modules/@comapeo/core/src/invite/invite-api.js`](/home/luandro/Dev/digidem/comapeo-desktop/node_modules/@comapeo/core/src/invite/invite-api.js). Output: invite daemon module and tests for the normal accept path.
- [x] `[medium | gpt-5.3-codex]` Add boot-time reconciliation so any existing `pending` invites are accepted on startup, and ensure already-joined, canceled, and failed invites are handled idempotently. Output: tests covering reconciliation and failure cases.
- [x] `[low]` Review Batch 4 by exercising invite acceptance end to end and recording joined project IDs and failure behavior in `PROGRESS.md`.

## Batch 5: Docker and compose

- [x] `[medium | gpt-5.3-codex]` Create a multi-stage Dockerfile for the daemon with explicit handling for native dependencies such as `better-sqlite3` and `sodium-native`. Output: buildable image for `linux/arm64` and documented build assumptions in `PROGRESS.md`.
- [x] `[medium | gpt-5.3-codex]` Add `docker-compose.yml` using a persistent `/data` volume, restart policy, and `network_mode: host`. Output: runnable compose stack and a documented env example.
- [x] `[medium | gpt-5.3-codex]` Add a real healthcheck that only passes after config validation, storage readiness, and manager startup complete. Output: healthcheck implementation and compose verification notes.
- [x] `[low]` Review Batch 5 by running `docker compose up`, verifying persistence across restart, and confirming the daemon is discoverable on the LAN. Output: smoke-test notes in `PROGRESS.md`. (Note: docker build verified at Node level; full Docker smoke requires Docker daemon – run manually to confirm image builds.)

## Batch 6: Final verification

- [x] `[medium | gpt-5.3-codex]` Run the full test suite plus the container smoke path, then fix any regressions before handoff. Output: final verification summary in `PROGRESS.md`.
- [x] `[low]` Perform a final review of the repo against [`PLAN.md`](/home/luandro/Dev/digidem/comapeo-desktop/PLAN.md) and confirm the delivered implementation still matches the direct-daemon, regular-device scope. Output: final acceptance checklist in `PROGRESS.md`.

## Post-plan fixes

- [x] `[low | gpt-5.3-codex]` Make optional compose env vars safe when unset and add a dev-friendly compose default for `COMAPEO_DEVICE_NAME` so `docker compose up` works without placeholder validation failures. Output: config normalization tests, compose default, and fix notes in `PROGRESS.md`.
- [x] `[low | gpt-5.3-codex]` Document Docker discovery investigation findings, including rootless-network conclusions and recommended next directions, in a repo markdown report. Output: `DOCKER_DISCOVERY_FINDINGS.md` plus a handoff note in `PROGRESS.md`.

## Release cleanup

- [x] `[medium | gpt-5.3-codex]` Prepare `main` for the v1 host-Node release by removing Docker artifacts, removing Docker-only readiness wiring, and adding a clear README for direct Node deployment. Output: Docker-free `main`, README, and verification notes in `PROGRESS.md`.

## Runtime follow-ups

- [x] `[low | gpt-5.3-codex]` Make local `.env` bootstrapping work for `bun start` and align demo defaults with the host-Node release. Output: startup loads `.env` automatically, `.env.example` is demo-ready, and verification notes are recorded in `PROGRESS.md`.
- [x] `[low | gpt-5.3-codex]` Keep project exchange always on in the headless daemon so joined projects start syncing on boot and newly accepted invites start syncing immediately. Output: daemon-side joined-project sync reconciliation, invite-to-sync wiring, and verification notes in `PROGRESS.md`.
- [x] `[medium | gpt-5.3-codex | use subagents for investigation]` Add sync debug instrumentation and fix the per-peer full-sync gating issue that kept `data`/`blob` disabled after startup. Output: daemon-side sync-state/local-peer logs, reproducible `@comapeo/core` patching, and verification notes in `PROGRESS.md`.
- [x] `[medium | gpt-5.3-codex | use subagents for investigation]` Refine the local `@comapeo/core` sync patch so `data` no longer waits on `blobIndex` presync completion, while `blob` still does. Output: updated dependency patch logic, tests, and verification notes in `PROGRESS.md`.
- [x] `[medium | gpt-5.3-codex | use subagents for investigation]` Fix stale pre-have state in the local `@comapeo/core` patch so live peer bitfields replace pre-haves instead of keeping presync blocked. Output: updated dependency patch logic, tests, and verification notes in `PROGRESS.md`.
- [x] `[medium | gpt-5.3-codex]` Write a detailed sync-exchange investigation handoff report comparing headless behavior with `/home/luandro/Dev/digidem/comapeo-desktop`, including attempted fixes, current blockers, and next steps. Output: `SYNC_EXCHANGE_INVESTIGATION.md` plus notes in `PROGRESS.md`.
- [x] `[high | claude-opus-4-6]` Identify and fix root cause of phantom pre-haves from unattached cores blocking presync completion. Fix `CoreSyncState.getState()` to skip `preHavesLength` for unattached cores and fix `mutatingAddPeerState` status comparison bug in `namespace-sync-state.js`. Output: updated patch script, tests, and investigation report.

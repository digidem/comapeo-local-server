# CoMapeo Headless Tasks

## Batch 1: Repo bootstrap

- [x] `[medium | gpt-5.3-codex]` Create the new repo skeleton for a Node-first daemon with `src/config`, `src/core`, `src/daemon`, `test`, and Docker files. Inputs: [`PLAN.md`](/home/luandro/Dev/digidem/comapeo-desktop/PLAN.md), [`src/services/core.ts`](/home/luandro/Dev/digidem/comapeo-desktop/src/services/core.ts). Output: initial project structure plus `PROGRESS.md` with the chosen package layout and runtime entrypoint.
- [x] `[low]` Pin the runtime to Node 24.x and document that v1 officially targets `linux/arm64` first, with `linux/amd64` optional for local development. Output: engine/tooling config and a note in `PROGRESS.md`.
- [x] `[low]` Add a smoke startup command that boots the daemon without Docker against a temporary data directory. Output: a documented local run path and smoke-test evidence in `PROGRESS.md`.
- [x] `[low]` Review Batch 1 by verifying the repo installs cleanly and the entrypoint launches far enough to validate config loading. Output: review notes in `PROGRESS.md`.

## Batch 2: Config and persistence

- [ ] `[medium | gpt-5.3-codex]` Implement env parsing and validation for `COMAPEO_DEVICE_NAME`, `COMAPEO_DATA_DIR`, `COMAPEO_ROOT_KEY`, `COMAPEO_AUTO_ACCEPT_INVITES`, `COMAPEO_DEVICE_TYPE`, `ONLINE_STYLE_URL`, and `LOG_LEVEL`. Output: typed config module and unit tests for valid and invalid env combinations.
- [ ] `[medium | gpt-5.3-codex]` Implement first-run root-key generation and persistence in the mounted data directory, with env override support when `COMAPEO_ROOT_KEY` is present. Inputs: [`src/main/app.ts`](/home/luandro/Dev/digidem/comapeo-desktop/src/main/app.ts). Output: persistence module, tests for first run and restart reuse, and notes in `PROGRESS.md`.
- [ ] `[low]` Review Batch 2 by running the config and persistence tests and confirming identity is stable across restarts. Output: test results in `PROGRESS.md`.

## Batch 3: Core bootstrap and lifecycle

- [ ] `[high | gpt-5.3-codex | use subagents for planning, implementation, and review]` Extract a pure Node bootstrap around `MapeoManager` based on [`src/services/core.ts`](/home/luandro/Dev/digidem/comapeo-desktop/src/services/core.ts), removing Electron-only transport, `utilityProcess`, and `@sentry/electron`. Output: daemon bootstrap module and a short architecture summary in `PROGRESS.md`.
- [ ] `[medium | gpt-5.3-codex]` Create startup directory initialization for database, core storage, maps, and any persisted metadata under `COMAPEO_DATA_DIR`. Output: storage bootstrap tests and path layout documentation in `PROGRESS.md`.
- [ ] `[medium | gpt-5.3-codex]` Set device info on startup from env using `manager.setDeviceInfo({ name, deviceType: 'desktop' })`, preserving archive-device defaults unless testing proves a change is needed. Output: startup behavior test or smoke evidence in `PROGRESS.md`.
- [ ] `[high | gpt-5.3-codex | use subagents for planning, implementation, and review]` Design and implement graceful shutdown for SIGTERM and SIGINT, including discovery cleanup and any manager/project resource cleanup required to avoid state corruption. Output: shutdown design note, implementation, and smoke-test evidence in `PROGRESS.md`.
- [ ] `[low]` Review Batch 3 by running the daemon locally, confirming startup, device info write, and clean termination. Output: review notes in `PROGRESS.md`.

## Batch 4: Invite automation

- [ ] `[high | gpt-5.3-codex | use subagents for planning, implementation, and review]` Implement invite handling directly against `manager.invite`, not a recreated IPC client layer. Subscribe to invite events and auto-accept new invites when `COMAPEO_AUTO_ACCEPT_INVITES=true`. Inputs: [`node_modules/@comapeo/core/src/invite/invite-api.js`](/home/luandro/Dev/digidem/comapeo-desktop/node_modules/@comapeo/core/src/invite/invite-api.js). Output: invite daemon module and tests for the normal accept path.
- [ ] `[medium | gpt-5.3-codex]` Add boot-time reconciliation so any existing `pending` invites are accepted on startup, and ensure already-joined, canceled, and failed invites are handled idempotently. Output: tests covering reconciliation and failure cases.
- [ ] `[low]` Review Batch 4 by exercising invite acceptance end to end and recording joined project IDs and failure behavior in `PROGRESS.md`.

## Batch 5: Docker and compose

- [ ] `[medium | gpt-5.3-codex]` Create a multi-stage Dockerfile for the daemon with explicit handling for native dependencies such as `better-sqlite3` and `sodium-native`. Output: buildable image for `linux/arm64` and documented build assumptions in `PROGRESS.md`.
- [ ] `[medium | gpt-5.3-codex]` Add `docker-compose.yml` using a persistent `/data` volume, restart policy, and `network_mode: host`. Output: runnable compose stack and a documented env example.
- [ ] `[medium | gpt-5.3-codex]` Add a real healthcheck that only passes after config validation, storage readiness, and manager startup complete. Output: healthcheck implementation and compose verification notes.
- [ ] `[low]` Review Batch 5 by running `docker compose up`, verifying persistence across restart, and confirming the daemon is discoverable on the LAN. Output: smoke-test notes in `PROGRESS.md`.

## Batch 6: Final verification

- [ ] `[medium | gpt-5.3-codex]` Run the full test suite plus the container smoke path, then fix any regressions before handoff. Output: final verification summary in `PROGRESS.md`.
- [ ] `[low]` Perform a final review of the repo against [`PLAN.md`](/home/luandro/Dev/digidem/comapeo-desktop/PLAN.md) and confirm the delivered implementation still matches the direct-daemon, regular-device scope. Output: final acceptance checklist in `PROGRESS.md`.

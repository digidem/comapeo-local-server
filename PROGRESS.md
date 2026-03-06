# Progress

## Current Status

- Date: 2026-03-06
- Active task: Batch 2 – Config and persistence
- Status: Batch 1 complete
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

## Next Handoff

- Next task: Batch 2 – Config and persistence
  1. Full valibot-based env parsing and validation (all 7 env vars)
  2. Root-key generation and file persistence under COMAPEO_DATA_DIR
  3. Identity stability across restarts
- Preconditions: Batch 1 complete (done)
- Notes: See src/main/app.ts loadRootKey() in comapeo-desktop for reference on key generation

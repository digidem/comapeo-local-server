# Headless Exchange Investigation

## Summary

This report documents the investigation into why the headless CoMapeo node
does not complete exchange with a mobile device even after the daemon forces
project sync on startup and after peer connection.

This repo is `/home/luandro/Dev/digidem/comapeo-headless`.
The desktop reference repo is `/home/luandro/Dev/digidem/comapeo-desktop`.

Current status as of commit `813e849`:

- Headless daemon starts cleanly.
- Project sync is forced on at startup and on peer updates.
- The daemon reaches `$sync` state `"all"`.
- Peer auth/config/blobIndex namespaces replicate.
- `data` and `blob` still do not enable for the peer.
- Exchange is still not completing.

## Goal

Expected behavior:

- headless node should always have exchange on
- when another device on the same project starts exchange, the headless node
  should also exchange automatically

Actual behavior:

- headless node enables sync locally
- peer connects and presync begins
- peer never progresses to `data` sync
- peer later disconnects without exchange completing

## Desktop Reference

The desktop app exchange flow was used as the working baseline.

Relevant file:

- `/home/luandro/Dev/digidem/comapeo-desktop/src/renderer/src/routes/app/projects/$projectId/_main-tabs/exchange/index.tsx`

What desktop does:

- uses `useStartSync({ projectId })`
- uses `useStopSync({ projectId })`
- calls `startSync.mutate(undefined, ...)` from the exchange screen
- calls `projectApi.$sync.stop()` on route leave

What desktop does not do:

- no extra exchange bootstrap step beyond `$sync.start()`
- no explicit `connectServers()` for LAN exchange
- no special autostop override for the local LAN exchange case

Conclusion from desktop comparison:

- headless is not missing an obvious desktop-side lifecycle step
- the remaining issue is likely in `@comapeo/core` sync behavior, not in daemon
  orchestration alone

## Current Headless Changes

Relevant files in this repo:

- `src/daemon/index.ts`
- `src/daemon/invites.ts`
- `src/daemon/sync.ts`
- `scripts/apply-comapeo-core-sync-patch.mjs`
- `test/sync.test.ts`

Behavior added in headless:

- sync is enabled for `joining` and `joined` projects
- sync reconciliation runs on startup
- sync reconciliation re-runs on `local-peers` updates
- invite acceptance triggers another reconciliation pass
- daemon logs local peer updates and per-project sync state summaries

## Investigation Timeline

### 1. Always-on exchange

Commit:

- `66d6bb2 feat: keep headless project exchange always enabled`

Change:

- call `$sync.start()` for joined projects on startup
- call reconciliation after successful invite acceptance

Result:

- not sufficient
- logs still showed `namespace data is disabled` and `namespace blob is disabled`

### 2. Include `joining` projects

Commit:

- `e6ef56d fix: enable headless sync for joining projects`

Reason:

- newly accepted projects can remain in `joining` before settings fully land

Result:

- still not sufficient

### 3. Add sync diagnostics and patch per-peer gating

Commit:

- `024b711 fix: patch per-peer sync gating and add diagnostics`

Changes:

- added `comapeo:sync` logs for:
  - startup/local-peer reconciliation
  - project sync-state summary
  - remote peer `initial`/`data` enabled state and `want`/`wanted`
- added postinstall patch for
  - `peer-sync-controller.js`
  - changed gating from namespace-global
    `state[namespace].localState.want === 0`
    to peer-specific
    `peerState.wanted === 0`

Reason:

- original `@comapeo/core` logic gated a peer using namespace-global want state

Result:

- diagnostics improved understanding
- still unresolved

### 4. Let `data` start before `blobIndex` fully completes

Commit:

- `0e584a1 fix: let data sync start before blob index completes`

Change:

- patch `peer-sync-controller.js` so:
  - `data` waits for `auth` and `config`
  - `blob` waits for `auth`, `config`, and `blobIndex`

Reason:

- logs suggested `blobIndex` was blocking `data`

Result:

- still unresolved

### 5. Stop stale pre-haves from blocking sync

Commit:

- `813e849 fix: stop stale pre-haves from blocking sync`

Change:

- patch `core-sync-state.js` so live peer bitfields replace pre-haves instead of
  OR-ing with them forever

Reason:

- `core-sync-state.js` comments imply pre-haves are temporary
- implementation kept pre-haves merged into live haves
- this matched the persistent `initial(... wanted=1)` symptom

Result:

- code and tests are in place
- runtime symptom is still unresolved based on latest logs

## Latest Observed Runtime Behavior

Representative sequence from the latest run:

1. daemon starts and loads project
2. local sync transitions from:
   - `initial(enabled=true) data(enabled=false)`
   - to `initial(enabled=true) data(enabled=true)`
3. peer connects
4. remote summary shows:
   - `initial(enabled=false,want=531,wanted=0) data(enabled=false,want=0,wanted=0)`
5. after role resolution and presync:
   - `initial(enabled=true,want=0,wanted=1) data(enabled=false,want=0,wanted=2)`
6. `config` and `blobIndex` are enabled
7. `data` remains disabled
8. later logs still show:
   - `Received discovery key ddb62d9 ... but namespace data is disabled`
   - `Received discovery key 8ef8d1e ... but namespace data is disabled`
9. peer disconnects after about 40s

Most important unresolved line:

- `remote=[c1c5aef:initial(enabled=true,want=0,wanted=1) data(enabled=false,want=0,wanted=2)]`

Interpretation:

- one presync block is still considered outstanding
- because presync does not fully settle, `data` never enables for this peer

## Things Already Ruled Out

- Missing headless startup sync: no, headless reaches sync state `"all"`
- Missing invite reconciliation: no
- Missing desktop-only exchange step: no obvious one exists
- Joined vs joining status: addressed
- Namespace-global peer gating bug: patched
- `data` waiting on `blobIndex`: patched
- Pre-haves persisting after live bitfields: patched locally

## Possible Remaining Issues

These are the current most plausible unresolved causes.

### 1. Another stale presync accounting issue remains in `@comapeo/core`

The persistent `initial(... wanted=1)` still suggests one block is being
counted as needed even after config/blobIndex replication starts.

Likely places:

- `@comapeo/core/src/sync/core-sync-state.js`
- `@comapeo/core/src/sync/namespace-sync-state.js`
- `@comapeo/core/src/sync/peer-sync-controller.js`
- `@comapeo/core/src/sync/sync-api.js`

Specific suspicion:

- the remote sync summary is aggregated by namespace group
- the remaining `wanted=1` may come from a specific presync core whose
  bitfield/have accounting is still inconsistent

### 2. Unknown discovery keys may correspond to cores not being added locally

Observed repeatedly:

- unknown discovery keys such as `59789bd`, `20ed78d`, `76b1368`, `7fd481b`,
  `9f57338`, `a97e366`, `0fdf239`

Possible meaning:

- peer is advertising cores that local project core index does not know about
- one of those may be relevant to completion of presync
- if the missing key belongs to a presync core path, that would explain the
  stuck `wanted=1`

### 3. Peer disconnect is caused by no data-phase progress

The mobile peer disconnects after roughly 40 seconds.

Possible interpretation:

- the peer times out or gives up because no meaningful exchange progress happens
- disconnection may be a consequence, not the root cause

## Important Code Paths

### Headless repo

- `src/daemon/index.ts`
  - starts daemon
  - starts always-on sync supervision
- `src/daemon/sync.ts`
  - reconciles project sync
  - logs sync-state and local peer updates
- `scripts/apply-comapeo-core-sync-patch.mjs`
  - carries reproducible local patches to `@comapeo/core`

### Desktop repo

- `/home/luandro/Dev/digidem/comapeo-desktop/src/renderer/src/routes/app/projects/$projectId/_main-tabs/exchange/index.tsx`
  - exchange UI start/stop flow

### Patched dependency targets

- `node_modules/@comapeo/core/src/sync/peer-sync-controller.js`
- `node_modules/@comapeo/core/src/sync/core-sync-state.js`

## Current Patch Script Behavior

`scripts/apply-comapeo-core-sync-patch.mjs` currently applies three changes:

1. `peer-sync-controller.js`
   - peer sync status uses `peerState.wanted === 0`
   - not namespace-global `state[namespace].localState.want === 0`

2. `peer-sync-controller.js`
   - `data` waits for `auth` + `config`
   - `blob` waits for `auth` + `config` + `blobIndex`

3. `core-sync-state.js`
   - live peer bitfields replace pre-haves
   - pre-haves are no longer OR-ed indefinitely with live haves

The script runs from `postinstall`.

## Reproduction

Run headless daemon:

```bash
node --import tsx/esm src/daemon/index.ts
```

Expected useful logs:

- `comapeo:sync Reconciling project sync: reason=startup`
- `Setting sync enabled state to "all"`
- `Project ... sync-state ...`

Current failure signature:

- remote peer reaches `initial(enabled=true,want=0,wanted=1)`
- `data(enabled=false,...)` never flips to true
- repeated `namespace data is disabled`
- peer disconnects

## Verification Already Performed

Commands:

- `node scripts/apply-comapeo-core-sync-patch.mjs`
- `npm test`
- `npm run typecheck`

Current automated verification at the time of writing:

- `npm test` passes
- `npm run typecheck` passes

These checks validate the repo changes and patch script behavior, but they do
not prove runtime exchange completion on-device.

## Recommended Next Steps

### 1. Instrument exact presync namespace source of `wanted=1`

Add temporary logging that breaks `initial` down by namespace:

- auth
- config
- blobIndex

Needed answer:

- which specific namespace is contributing the final outstanding `wanted=1`

Without that, the aggregated `initial` summary is still too coarse.

### 2. Instrument unknown discovery keys

Add logging to map unknown discovery keys to:

- whether they belong to a peer core not yet added
- whether they are outside the project
- whether they correspond to a presync namespace

This may reveal whether a required core is missing from local core registration.

### 3. Compare runtime on desktop with the same debug surface

If possible, run the desktop app against the same project/device and compare:

- does desktop ever show a transient `initial(... wanted=1)`?
- how long does it last?
- does desktop see the same unknown discovery keys?

This would help decide whether the issue is specific to headless runtime or is
present but masked differently in desktop flows.

### 4. Consider upstreaming or isolating the `@comapeo/core` issue

At this point the problem appears strongly centered in `@comapeo/core` sync
internals. If another engineer continues, they should be ready to:

- patch deeper in dependency behavior
- reduce the issue to a minimal reproduction
- open or prepare an upstream fix against `@comapeo/core`

## Recommended Handoff Checklist

For the next developer:

1. Read this report.
2. Read `PROGRESS.md`.
3. Read `src/daemon/sync.ts`.
4. Read `scripts/apply-comapeo-core-sync-patch.mjs`.
5. Compare with desktop exchange route in:
   `/home/luandro/Dev/digidem/comapeo-desktop/src/renderer/src/routes/app/projects/$projectId/_main-tabs/exchange/index.tsx`
6. Reproduce the issue with current `HEAD`.
7. Instrument per-namespace presync accounting for the remote peer.

## Files to Review First

- `/home/luandro/Dev/digidem/comapeo-headless/SYNC_EXCHANGE_INVESTIGATION.md`
- `/home/luandro/Dev/digidem/comapeo-headless/PROGRESS.md`
- `/home/luandro/Dev/digidem/comapeo-headless/src/daemon/sync.ts`
- `/home/luandro/Dev/digidem/comapeo-headless/scripts/apply-comapeo-core-sync-patch.mjs`
- `/home/luandro/Dev/digidem/comapeo-desktop/src/renderer/src/routes/app/projects/$projectId/_main-tabs/exchange/index.tsx`


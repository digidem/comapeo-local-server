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

## Root Cause Identified (commit after 813e849)

### Primary: Phantom pre-haves from unattached cores blocking presync

Pre-haves arrive via extension messages for ALL cores the remote peer knows
about, including cores of other project devices that the local node has not
yet received core-ownership documents for. `NamespaceSyncState.#insertPreHaves`
creates `CoreSyncState` objects for these unknown cores via `#getCoreState`,
but those `CoreSyncState` objects never have `attachCore()` called (since we
don't know the core key yet). In `CoreSyncState.getState()`, the iteration
length was computed as:

```
Math.max(localCoreLength, this.#preHavesLength)
```

For unattached cores, `localCoreLength = 0` but `preHavesLength > 0`. The
`deriveState` loop then iterates over the pre-have range and computes:

```
iWantFromThem = peerHaves & ~localHaves & localWants
```

Since the peer's `peerHaves` comes from pre-haves (no live `#haves` bitfield
was ever set), and `localHaves = 0` (no local core), and `localWants = all 1s`
(wants everything), the result is non-zero. This phantom `wanted` count is
aggregated into the namespace-level state and prevents `getSyncStatus` from
returning `'synced'` for that presync namespace.

### Secondary: Status comparison bug in `mutatingAddPeerState`

In `namespace-sync-state.js`, the `mutatingAddPeerState` function had a bug
at line 211:

```js
accumulator.status === 'stopped'  // comparison, not assignment!
```

This should be `accumulator.status = 'stopped'` (assignment). The bug means
that when a phantom core has the peer in `stopped` status (because the core
is never replicated), that `stopped` status does not propagate into the
namespace aggregate. The aggregate shows `started` (from real cores) while
the phantom `wanted` still leaks through. This creates the observed state:

```
initial(enabled=true, want=0, wanted=1)
```

where `enabled=true` (aggregate status is 'started' due to the bug) and
`wanted=1` (phantom pre-have counts leak through). `getSyncStatus` then
returns `'syncing'` instead of `'synced'`, blocking data sync.

### Fix applied

Two patches added to `scripts/apply-comapeo-core-sync-patch.mjs`:

1. `core-sync-state.js` `getState()`: use `this.#core ? this.#preHavesLength : 0`
   so unattached cores report zero length and produce zero want/wanted counts

2. `namespace-sync-state.js` `mutatingAddPeerState`: change `===` to `=` for
   the stopped status propagation

## Previous Hypotheses (now resolved)

### 1. Stale presync accounting (partially correct)

The `wanted=1` was indeed from presync cores, but not from stale pre-haves
in connected cores. It was from phantom pre-haves in cores that were never
attached locally.

### 2. Unknown discovery keys (related)

The unknown discovery keys correspond to cores the local node doesn't have
yet. These are the same cores that produce phantom pre-haves. The fix
prevents them from blocking presync, but the unknown keys themselves are
expected and harmless.

### 3. Peer disconnect (consequence, not cause)

Confirmed: the peer disconnects because data sync never starts, not the
other way around.

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
- `node_modules/@comapeo/core/src/sync/namespace-sync-state.js`

## Current Patch Script Behavior

`scripts/apply-comapeo-core-sync-patch.mjs` currently applies five changes:

1. `peer-sync-controller.js`
   - peer sync status uses `peerState.wanted === 0`
   - not namespace-global `state[namespace].localState.want === 0`

2. `peer-sync-controller.js`
   - `data` waits for `auth` + `config`
   - `blob` waits for `auth` + `config` + `blobIndex`

3. `core-sync-state.js`
   - live peer bitfields replace pre-haves
   - pre-haves are no longer OR-ed indefinitely with live haves

4. `core-sync-state.js`
   - `getState()` uses `this.#core ? this.#preHavesLength : 0` for iteration
     length so unattached cores produce zero want/wanted counts

5. `namespace-sync-state.js`
   - fixes `accumulator.status === 'stopped'` (comparison, no-op) to
     `accumulator.status = 'stopped'` (assignment) in `mutatingAddPeerState`

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

### 1. Runtime verification

Run the headless daemon against a mobile peer and confirm:

- `initial(... wanted=0)` is reached after presync
- `data(enabled=true)` follows
- exchange completes successfully

If the fix works, the `wanted=1` should no longer persist.

### 2. If exchange still does not complete

The phantom pre-have fix addresses the most credible root cause. If the
issue persists, the next areas to investigate are:

- whether `core.update({ wait: true })` never resolves for a specific core,
  keeping `status` at `'starting'` indefinitely
- whether there are additional pre-have accounting issues beyond unattached
  cores (e.g., pre-haves for cores in a different namespace than expected)
- whether the mobile peer's sync controller has its own version of this bug

### 3. Consider upstreaming the patches

The five patches in `scripts/apply-comapeo-core-sync-patch.mjs` fix real
bugs in `@comapeo/core`. Consider:

- opening upstream issues against `@comapeo/core` for each bug
- preparing minimal reproductions for the upstream maintainers
- tracking upstream releases that might incorporate these fixes

## Files to Review First

- `/home/luandro/Dev/digidem/comapeo-headless/SYNC_EXCHANGE_INVESTIGATION.md`
- `/home/luandro/Dev/digidem/comapeo-headless/PROGRESS.md`
- `/home/luandro/Dev/digidem/comapeo-headless/src/daemon/sync.ts`
- `/home/luandro/Dev/digidem/comapeo-headless/scripts/apply-comapeo-core-sync-patch.mjs`


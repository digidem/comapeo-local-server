# Scripts

This directory contains utility scripts for the comapeo-local-server project.

## apply-comapeo-core-sync-patch.mjs

**Purpose:** Patches `@comapeo/core` sync internals after `npm install`.

### Why This Exists

This script works around upstream bugs in `@comapeo/core` that block synchronization in this project. The fixes have not yet been released in an official version of `@comapeo/core`, so we patch `node_modules` after installation.

### What It Patches

The script modifies three files in `node_modules/@comapeo/core/src/sync/`:

#### 1. peer-sync-controller.js

**Fix:** Sync status check

- Changes `state[namespace].localState.want === 0` to `peerState.wanted === 0`
- Corrects the property used to determine if a peer wants data from a namespace

#### 2. core-sync-state.js

**Fixes:** Three issues with core state management

- **`have()` method** - Returns pre-haves only when haves don't exist, avoiding incorrect fallback logic
- **`haveWord()` method** - Same fix for bitfield operations
- **`getState()` method** - Returns completely empty state for unattached cores (cores known only from pre-haves)

The `getState()` fix prevents "phantom" pre-have cores from blocking sync completion. Without a local core, we can't actually sync, so these cores should not affect wanted counts or appear as peer status entries.

#### 3. namespace-sync-state.js

**Fix:** Comparison bug in `mutatingAddPeerState`

- Changes `accumulator.status === 'stopped'` to `accumulator.status = 'stopped'`
- The original used comparison (`===`) instead of assignment (`=`), causing stopped status to never propagate
- This bug accidentally hid stopped status of phantom cores while their wanted counts still leaked through

### Usage

Run manually:

```bash
node scripts/apply-comapeo-core-sync-patch.mjs
```

The script is also automatically run via `npm install` if configured as a postinstall hook in `package.json`.

### Safety

The script checks if patches are already applied before modifying files. It will skip patches that are already in place and throw an error if expected code patterns are not found (indicating the upstream code has changed).

### Future

Once these fixes are released in `@comapeo/core`, this script can be removed.

## smoke.ts

**Purpose:** Smoke test for verifying daemon functionality.

Runs a quick end-to-end test of the daemon to ensure basic functionality works correctly.

## check-staged-secrets.mjs

**Purpose:** Runs `gitleaks` against staged git changes for the pre-commit hook.

The script fails fast with a clear message when `gitleaks` is not installed locally.

## prepare-husky.mjs

**Purpose:** Installs Husky hooks during `npm install` when the repo has a `.git` directory and Husky is available.

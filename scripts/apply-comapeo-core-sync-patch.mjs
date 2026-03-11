import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function patchPeerSyncControllerSource(source) {
	let next = source

	const syncStatusOriginal = `    } else if (
      peerState.status === 'started' &&
      state[namespace].localState.want === 0
    ) {`

	const syncStatusPatched = `    } else if (
      peerState.status === 'started' &&
      peerState.wanted === 0
    ) {`

	if (next.includes(syncStatusOriginal)) {
		next = next.replace(syncStatusOriginal, syncStatusPatched)
	} else if (!next.includes('peerState.wanted === 0')) {
		throw new Error(
			'Could not find expected @comapeo/core sync-status snippet to patch',
		)
	}

	const dataGateOriginal = `        } else if (isDataSyncEnabled) {
          const arePresyncNamespacesSynced = PRESYNC_NAMESPACES.every(
            (ns) => this.#syncStatus[ns] === 'synced'
          )
          // Only enable data namespaces once the pre-sync namespaces have synced
          if (arePresyncNamespacesSynced) {
            this.#enableNamespace(ns)
          }
        } else {
          this.#disableNamespace(ns)
        }`

	const dataGatePatched = `        } else if (isDataSyncEnabled) {
          const areAuthAndConfigSynced =
            this.#syncStatus.auth === 'synced' &&
            this.#syncStatus.config === 'synced'
          const isBlobIndexSynced = this.#syncStatus.blobIndex === 'synced'
          if (ns === 'data') {
            if (areAuthAndConfigSynced) {
              this.#enableNamespace(ns)
            } else {
              this.#disableNamespace(ns)
            }
          } else if (ns === 'blob') {
            if (areAuthAndConfigSynced && isBlobIndexSynced) {
              this.#enableNamespace(ns)
            } else {
              this.#disableNamespace(ns)
            }
          } else {
            this.#disableNamespace(ns)
          }
        } else {
          this.#disableNamespace(ns)
        }`

	if (next.includes(dataGateOriginal)) {
		next = next.replace(dataGateOriginal, dataGatePatched)
	} else if (
		!next.includes("const areAuthAndConfigSynced =") &&
		!next.includes("const areAuthAndConfigSynced =\n")
	) {
		throw new Error(
			'Could not find expected @comapeo/core data/blob gating snippet to patch',
		)
	}

	return next
}

export function patchCoreSyncStateSource(source) {
	let next = source

	const haveOriginal = `  have(index) {
    return this.#haves?.get(index) || this.#preHaves.get(index)
  }`

	const havePatched = `  have(index) {
    if (this.#haves) return this.#haves.get(index)
    return this.#preHaves.get(index)
  }`

	if (next.includes(haveOriginal)) {
		next = next.replace(haveOriginal, havePatched)
	} else if (!next.includes('if (this.#haves) return this.#haves.get(index)')) {
		throw new Error(
			'Could not find expected @comapeo/core have() snippet to patch',
		)
	}

	const haveWordOriginal = `  haveWord(index) {
    const preHaveWord = getBitfieldWord(this.#preHaves, index)
    if (!this.#haves) return preHaveWord
    return preHaveWord | getBitfieldWord(this.#haves, index)
  }`

	const haveWordPatched = `  haveWord(index) {
    if (this.#haves) return getBitfieldWord(this.#haves, index)
    return getBitfieldWord(this.#preHaves, index)
  }`

	if (next.includes(haveWordOriginal)) {
		next = next.replace(haveWordOriginal, haveWordPatched)
	} else if (
		!next.includes('if (this.#haves) return getBitfieldWord(this.#haves, index)')
	) {
		throw new Error(
			'Could not find expected @comapeo/core haveWord() snippet to patch',
		)
	}

	// Patch getState() so cores without an attached local Hypercore instance
	// (i.e. cores known only from pre-haves) return completely empty state.
	// Without a local core we cannot actually sync, so pre-have data for
	// these phantom cores should not affect presync completion at all —
	// neither through inflated wanted/want counts NOR through phantom peer
	// status entries (which would block via stopped/starting status).
	const getStateMethodOriginal = `  getState() {
    const localCoreLength = this.#core?.length || 0
    return deriveState({
      length: Math.max(localCoreLength, this.#preHavesLength),`

	const getStateMethodPatched = `  getState() {
    if (!this.#core) {
      return { coreLength: 0, localState: { have: 0, want: 0, wanted: 0 }, remoteStates: {} }
    }
    const localCoreLength = this.#core.length || 0
    return deriveState({
      length: Math.max(localCoreLength, this.#preHavesLength),`

	// Also handle the case where our previous length-only patch was applied
	const getStatePrevPatched = `  getState() {
    const localCoreLength = this.#core?.length || 0
    return deriveState({
      length: Math.max(localCoreLength, this.#core ? this.#preHavesLength : 0),`

	const getStatePrevPatchedReplacement = `  getState() {
    if (!this.#core) {
      return { coreLength: 0, localState: { have: 0, want: 0, wanted: 0 }, remoteStates: {} }
    }
    const localCoreLength = this.#core.length || 0
    return deriveState({
      length: Math.max(localCoreLength, this.#preHavesLength),`

	if (next.includes(getStateMethodOriginal)) {
		next = next.replace(getStateMethodOriginal, getStateMethodPatched)
	} else if (next.includes(getStatePrevPatched)) {
		next = next.replace(getStatePrevPatched, getStatePrevPatchedReplacement)
	} else if (!next.includes('if (!this.#core)')) {
		throw new Error(
			'Could not find expected @comapeo/core getState() snippet to patch',
		)
	}

	return next
}

export function patchNamespaceSyncStateSource(source) {
	let next = source

	// Fix comparison-instead-of-assignment bug in mutatingAddPeerState.
	// The original code uses === (comparison, no-op) instead of = (assignment),
	// so a 'stopped' status from one core never propagates into the namespace
	// aggregate.  This bug accidentally hides the stopped status of phantom
	// pre-have-only cores while their wanted counts still leak through.
	const statusBugOriginal = "      accumulator.status === 'stopped'"
	const statusBugPatched = "      accumulator.status = 'stopped'"

	if (next.includes(statusBugOriginal)) {
		next = next.replace(statusBugOriginal, statusBugPatched)
	} else if (!next.includes("accumulator.status = 'stopped'")) {
		throw new Error(
			'Could not find expected @comapeo/core mutatingAddPeerState status bug to patch',
		)
	}

	return next
}

function applySinglePatch({ targetPath, transform, label }) {
	const existing = readFileSync(targetPath, 'utf8')
	const next = transform(existing)

	if (next !== existing) {
		writeFileSync(targetPath, next)
		console.log('Applied', label + ':', path.relative(process.cwd(), targetPath))
	} else {
		console.log(label + ' already applied:', path.relative(process.cwd(), targetPath))
	}
}

export function applyPatch() {
	applySinglePatch({
		targetPath: path.resolve(
			'node_modules/@comapeo/core/src/sync/peer-sync-controller.js',
		),
		transform: patchPeerSyncControllerSource,
		label: '@comapeo/core peer sync controller patch',
	})
	applySinglePatch({
		targetPath: path.resolve(
			'node_modules/@comapeo/core/src/sync/core-sync-state.js',
		),
		transform: patchCoreSyncStateSource,
		label: '@comapeo/core core sync state patch',
	})
	applySinglePatch({
		targetPath: path.resolve(
			'node_modules/@comapeo/core/src/sync/namespace-sync-state.js',
		),
		transform: patchNamespaceSyncStateSource,
		label: '@comapeo/core namespace sync state patch',
	})
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	applyPatch()
}

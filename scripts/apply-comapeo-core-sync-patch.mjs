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

export function applyPatch(targetPath = path.resolve(
	'node_modules/@comapeo/core/src/sync/peer-sync-controller.js',
)) {
	const existing = readFileSync(targetPath, 'utf8')
	const next = patchPeerSyncControllerSource(existing)

	if (next !== existing) {
		writeFileSync(targetPath, next)
		console.log(
			'Applied @comapeo/core peer sync controller patch:',
			path.relative(process.cwd(), targetPath),
		)
	} else {
		console.log(
			'@comapeo/core peer sync controller patch already applied:',
			path.relative(process.cwd(), targetPath),
		)
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	applyPatch()
}

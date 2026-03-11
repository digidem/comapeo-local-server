import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function patchPeerSyncControllerSource(source) {
	if (source.includes('peerState.wanted === 0')) {
		return source
	}

	const original = `    } else if (
      peerState.status === 'started' &&
      state[namespace].localState.want === 0
    ) {`

	const patched = `    } else if (
      peerState.status === 'started' &&
      peerState.wanted === 0
    ) {`

	if (!source.includes(original)) {
		throw new Error(
			'Could not find expected @comapeo/core peer sync controller snippet to patch',
		)
	}

	return source.replace(original, patched)
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

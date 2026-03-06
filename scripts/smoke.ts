/**
 * Smoke-start script: boots the daemon with a temp data directory,
 * waits a short time to confirm no startup crash, then sends SIGINT.
 *
 * Usage: node --run start:smoke
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const tmpDir = mkdtempSync(join(tmpdir(), 'comapeo-smoke-'))
const daemonPath = fileURLToPath(new URL('../src/daemon/index.ts', import.meta.url))

console.log('[smoke] Starting daemon with data dir:', tmpDir)

const child = spawn(
	process.execPath,
	['--import', 'tsx/esm', daemonPath],
	{
		env: {
			...process.env,
			COMAPEO_DEVICE_NAME: 'smoke-test-device',
			COMAPEO_DATA_DIR: tmpDir,
			DEBUG: 'comapeo:*',
		},
		stdio: 'inherit',
	},
)

child.on('error', (err) => {
	console.error('[smoke] Failed to start daemon:', err)
	cleanup(1)
})

child.on('exit', (code, signal) => {
	if (signal === 'SIGINT' || code === 0) {
		console.log('[smoke] Daemon exited cleanly')
		cleanup(0)
	} else {
		console.error('[smoke] Daemon exited with code', code, 'signal', signal)
		cleanup(1)
	}
})

// Give the daemon 2 seconds to boot, then send SIGINT.
setTimeout(() => {
	console.log('[smoke] Sending SIGINT to daemon')
	child.kill('SIGINT')
}, 2000)

function cleanup(exitCode: number) {
	try {
		rmSync(tmpDir, { recursive: true, force: true })
	} catch {
		// best effort
	}
	process.exit(exitCode)
}

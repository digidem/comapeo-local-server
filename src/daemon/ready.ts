import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import debug from 'debug'

const log = debug('comapeo:daemon:ready')

const READY_FILE_NAME = '.ready'

/**
 * Write the readiness marker file so the Docker healthcheck can detect that
 * the daemon has fully started (config valid, storage ready, manager up).
 */
export function markReady(dataDir: string): void {
	const readyPath = join(dataDir, READY_FILE_NAME)
	writeFileSync(readyPath, String(Date.now()), { encoding: 'utf8' })
	log('Readiness marker written: %s', readyPath)
}

/**
 * Remove the readiness marker on clean shutdown so the container is not
 * considered healthy after the daemon has exited.
 */
export function clearReady(dataDir: string): void {
	const readyPath = join(dataDir, READY_FILE_NAME)
	try {
		rmSync(readyPath)
		log('Readiness marker removed: %s', readyPath)
	} catch {
		// best effort – the file may not exist if startup failed before markReady
	}
}

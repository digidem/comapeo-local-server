import debug from 'debug'

import { loadConfig } from '../config/index.js'
import { loadOrCreateRootKey } from '../config/root-key.js'
import { initCore } from '../core/index.js'
import { configureLogging } from '../logging/index.js'
import { startInviteHandler } from './invites.js'
import { markReady, clearReady } from './ready.js'

const log = debug('comapeo:daemon')

async function main() {
	// ── Config ────────────────────────────────────────────────────────────────
	const config = loadConfig()
	const activeDebugNamespaces = configureLogging(config.logLevel)
	log(
		'Starting CoMapeo headless daemon: logLevel=%s debug=%s',
		config.logLevel,
		activeDebugNamespaces || '(disabled)',
	)
	log('Config loaded: device=%s dataDir=%s', config.deviceName, config.dataDir)

	// ── Root key ──────────────────────────────────────────────────────────────
	const rootKey = loadOrCreateRootKey(config.dataDir, config.rootKey)
	log('Root key ready')

	// ── Core bootstrap ────────────────────────────────────────────────────────
	const core = await initCore(config, rootKey)
	log('Core ready – daemon is fully started')

	// ── Invite handler ────────────────────────────────────────────────────────
	const inviteHandler = startInviteHandler(
		core.manager.invite,
		config.autoAcceptInvites,
	)

	// Signal readiness: stdout marker for smoke tests + file marker for Docker healthcheck.
	markReady(config.dataDir)
	process.stdout.write('READY\n')

	// ── Signal handling ───────────────────────────────────────────────────────
	await new Promise<void>((resolve) => {
		async function shutdown(signal: string) {
			log('Received %s, shutting down', signal)
			clearReady(config.dataDir)
			inviteHandler.stop()
			await core.stop()
			resolve()
		}

		process.once('SIGTERM', () => void shutdown('SIGTERM'))
		process.once('SIGINT', () => void shutdown('SIGINT'))
	})

	log('Daemon stopped cleanly')
}

main().catch((err) => {
	console.error('Fatal error during daemon startup:', err)
	process.exit(1)
})

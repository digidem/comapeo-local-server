import debug from 'debug'

import { loadConfig, loadDefaultEnvFile } from '../config/index.js'
import { loadOrCreateRootKey } from '../config/root-key.js'
import { initCore } from '../core/index.js'
import { configureLogging } from '../logging/index.js'
import { startInviteHandler } from './invites.js'
import { enableSyncForJoinedProjects, startAlwaysOnSync } from './sync.js'

const log = debug('comapeo:daemon')

async function main() {
	// ── Config ────────────────────────────────────────────────────────────────
	loadDefaultEnvFile()
	const config = loadConfig()
	const activeDebugNamespaces = configureLogging(config.logLevel)
	log(
		'Starting CoMapeo local-server daemon: logLevel=%s debug=%s',
		config.logLevel,
		activeDebugNamespaces || '(disabled)',
	)
	log('Config loaded: device=%s dataDir=%s', config.deviceName, config.dataDir)

	// ── Root key ──────────────────────────────────────────────────────────────
	const rootKey = loadOrCreateRootKey(config.dataDir, config.rootKey)
	log('Root key ready')

	// ── Core bootstrap ────────────────────────────────────────────────────────
	const core = await initCore(config, rootKey)
	const alwaysOnSync = startAlwaysOnSync(core.manager)
	log('Core ready – daemon is fully started')

	// ── Invite handler ────────────────────────────────────────────────────────
	const inviteHandler = startInviteHandler(
		core.manager.invite,
		config.autoAcceptInvites,
		() => enableSyncForJoinedProjects(core.manager),
	)

	// Signal readiness for smoke tests once startup is complete.
	process.stdout.write('READY\n')

	// ── Signal handling ───────────────────────────────────────────────────────
	await new Promise<void>((resolve) => {
		async function shutdown(signal: string) {
			log('Received %s, shutting down', signal)
			inviteHandler.stop()
			alwaysOnSync.stop()
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

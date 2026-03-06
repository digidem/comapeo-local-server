import debug from 'debug'

import { loadConfig } from '../config/index.js'

const log = debug('comapeo:daemon')

async function main() {
	log('Starting CoMapeo headless daemon')

	const config = loadConfig()

	log('Config loaded: device=%s dataDir=%s', config.deviceName, config.dataDir)

	// Core bootstrap (Batch 3) and invite handling (Batch 4) will be wired here.

	log('Daemon ready')

	// Keep the process alive until a signal is received.
	await new Promise<void>((resolve) => {
		function shutdown(signal: string) {
			log('Received %s, shutting down', signal)
			resolve()
		}

		process.once('SIGTERM', () => shutdown('SIGTERM'))
		process.once('SIGINT', () => shutdown('SIGINT'))
	})

	log('Daemon stopped')
}

main().catch((err) => {
	console.error('Fatal error during daemon startup:', err)
	process.exit(1)
})

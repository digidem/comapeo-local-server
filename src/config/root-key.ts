import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'

const ROOT_KEY_FILE_NAME = '.root-key'

/**
 * Load or create the 16-byte root key used to initialize MapeoManager.
 *
 * Resolution order:
 * 1. If `envOverride` is set (COMAPEO_ROOT_KEY), use it directly (no persistence).
 * 2. If a persisted key file exists under `dataDir`, read and return it.
 * 3. Otherwise generate a new 16-byte key, persist it, and return it.
 *
 * The persisted file is written with mode 0o600 (owner-read-only).
 */
export function loadOrCreateRootKey(dataDir: string, envOverride?: string): Buffer {
	if (envOverride) {
		return Buffer.from(envOverride, 'hex')
	}

	const keyPath = join(dataDir, ROOT_KEY_FILE_NAME)

	try {
		const hex = readFileSync(keyPath, 'utf8').trim()
		if (hex.length !== 32) {
			throw new Error(
				`Persisted root key at ${keyPath} is corrupted (expected 32 hex chars, got ${hex.length})`,
			)
		}
		return Buffer.from(hex, 'hex')
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
			throw err
		}

		// First boot: generate and persist a new root key.
		mkdirSync(dirname(keyPath), { recursive: true })
		const key = randomBytes(16)
		writeFileSync(keyPath, key.toString('hex'), {
			encoding: 'utf8',
			mode: 0o600,
		})
		return key
	}
}

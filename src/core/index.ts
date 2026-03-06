import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FastifyController, MapeoManager } from '@comapeo/core'
import ciao, { type Protocol } from '@homebridge/ciao'
import debug from 'debug'
import Fastify from 'fastify'

import type { Config } from '../config/index.js'

const log = debug('comapeo:core')

// Storage directory names – must match desktop conventions.
const DB_DIR_NAME = 'sqlite-dbs'
const CORE_STORAGE_DIR_NAME = 'core-storage'
const CUSTOM_MAPS_DIR_NAME = 'maps'
const DEFAULT_CUSTOM_MAP_FILE_NAME = 'default.smp'

// Use createRequire so the path is stable regardless of ESM loader (tsx vs node).
const _require = createRequire(import.meta.url)
const COMAPEO_CORE_PKG_ROOT = path.dirname(
	path.dirname(_require.resolve('@comapeo/core')),
)
const DATABASE_MIGRATIONS_DIRECTORY = path.join(COMAPEO_CORE_PKG_ROOT, 'drizzle')

const DEFAULT_CONFIG_PATH = fileURLToPath(
	import.meta.resolve(
		'@comapeo/default-categories/dist/comapeo-default-categories.comapeocat',
	),
)

export type CoreHandle = {
	/** The initialized MapeoManager instance. */
	manager: MapeoManager
	/** Stop all services and close resources cleanly. */
	stop: () => Promise<void>
}

/**
 * Bootstrap MapeoManager, peer discovery, and set device info.
 *
 * Returns a CoreHandle with a `stop()` method for graceful shutdown.
 */
export async function initCore(
	config: Config,
	rootKey: Buffer,
): Promise<CoreHandle> {
	const { dataDir, deviceName, deviceType, onlineStyleUrl } = config

	// ── 1. Storage directories ───────────────────────────────────────────────
	const databaseDirectory = path.join(dataDir, DB_DIR_NAME)
	const coreStorageDirectory = path.join(dataDir, CORE_STORAGE_DIR_NAME)
	const customMapsDirectory = path.join(dataDir, CUSTOM_MAPS_DIR_NAME)

	mkdirSync(databaseDirectory, { recursive: true })
	mkdirSync(coreStorageDirectory, { recursive: true })
	mkdirSync(customMapsDirectory, { recursive: true })

	log(
		'Storage directories ready under %s: %s, %s, %s',
		dataDir,
		DB_DIR_NAME,
		CORE_STORAGE_DIR_NAME,
		CUSTOM_MAPS_DIR_NAME,
	)

	// ── 2. Fastify + MapeoManager ─────────────────────────────────────────────
	const fastify = Fastify({ logger: false })

	// Allow cross-origin access to the map tile server.
	fastify.addHook('onSend', async (_request, reply, payload) => {
		reply.header('Access-Control-Allow-Origin', '*')
		return payload
	})

	const fastifyController = new FastifyController({ fastify })

	const manager = new MapeoManager({
		rootKey,
		dbFolder: databaseDirectory,
		coreStorage: coreStorageDirectory,
		clientMigrationsFolder: path.join(DATABASE_MIGRATIONS_DIRECTORY, 'client'),
		projectMigrationsFolder: path.join(
			DATABASE_MIGRATIONS_DIRECTORY,
			'project',
		),
		fastify,
		defaultConfigPath: DEFAULT_CONFIG_PATH,
		defaultOnlineStyleUrl: onlineStyleUrl,
		defaultIsArchiveDevice: true,
		customMapPath: path.join(customMapsDirectory, DEFAULT_CUSTOM_MAP_FILE_NAME),
	})

	// Start Fastify in the background; methods that need it will await internally.
	fastifyController.start().catch((err) => {
		log('Fastify start error (non-fatal at this stage):', err)
	})

	log('MapeoManager initialized')

	// ── 3. Device info ────────────────────────────────────────────────────────
	await manager.setDeviceInfo({ name: deviceName, deviceType: deviceType as 'desktop' | 'mobile' })
	log('Device info set: name=%s deviceType=%s', deviceName, deviceType)

	// ── 4. Peer discovery ─────────────────────────────────────────────────────
	const { name: discoveryName, port: discoveryPort } =
		await manager.startLocalPeerDiscoveryServer()

	log(
		'Local peer discovery server started: name=%s port=%d',
		discoveryName,
		discoveryPort,
	)

	const responder = ciao.getResponder()

	const service = responder.createService({
		domain: 'local',
		name: discoveryName,
		port: discoveryPort,
		protocol: 'tcp' as Protocol,
		type: 'comapeo',
	})

	await service.advertise()
	log('mDNS service advertised')

	// ── 5. Shutdown handle ────────────────────────────────────────────────────
	let stopCalled = false

	async function stop(): Promise<void> {
		if (stopCalled) return
		stopCalled = true

		log('Stopping mDNS responder')
		await responder.shutdown().catch((err) => {
			log('mDNS responder shutdown error (non-fatal):', err)
		})

		log('Stopping peer discovery server')
		await manager.stopLocalPeerDiscoveryServer().catch((err) => {
			log('Peer discovery stop error (non-fatal):', err)
		})

		log('Stopping Fastify')
		await fastifyController.stop().catch((err) => {
			log('Fastify stop error (non-fatal):', err)
		})

		log('Closing MapeoManager')
		await manager.close().catch((err) => {
			log('MapeoManager close error (non-fatal):', err)
		})

		log('Core stopped cleanly')
	}

	return { manager, stop }
}

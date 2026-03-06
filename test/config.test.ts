import { describe, it, expect, afterEach } from 'vitest'

import { loadConfig } from '../src/config/index.js'

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
	const saved: Record<string, string | undefined> = {}
	for (const [key, value] of Object.entries(overrides)) {
		saved[key] = process.env[key]
		if (value === undefined) {
			delete process.env[key]
		} else {
			process.env[key] = value
		}
	}
	try {
		fn()
	} finally {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = value
			}
		}
	}
}

describe('loadConfig', () => {
	afterEach(() => {
		delete process.env['COMAPEO_DEVICE_NAME']
		delete process.env['COMAPEO_DATA_DIR']
		delete process.env['COMAPEO_ROOT_KEY']
		delete process.env['COMAPEO_AUTO_ACCEPT_INVITES']
		delete process.env['COMAPEO_DEVICE_TYPE']
		delete process.env['ONLINE_STYLE_URL']
		delete process.env['LOG_LEVEL']
	})

	it('throws when COMAPEO_DEVICE_NAME is missing', () => {
		withEnv({ COMAPEO_DEVICE_NAME: undefined }, () => {
			expect(() => loadConfig()).toThrow('COMAPEO_DEVICE_NAME is required')
		})
	})

	it('returns defaults for optional fields', () => {
		withEnv({ COMAPEO_DEVICE_NAME: 'my-device' }, () => {
			const config = loadConfig()
			expect(config.deviceName).toBe('my-device')
			expect(config.dataDir).toBe('/data')
			expect(config.autoAcceptInvites).toBe(true)
			expect(config.deviceType).toBe('desktop')
			expect(config.logLevel).toBe('info')
			expect(config.rootKey).toBeUndefined()
			expect(config.onlineStyleUrl).toBeUndefined()
		})
	})

	it('reads COMAPEO_DATA_DIR from env', () => {
		withEnv({ COMAPEO_DEVICE_NAME: 'dev', COMAPEO_DATA_DIR: '/tmp/test' }, () => {
			expect(loadConfig().dataDir).toBe('/tmp/test')
		})
	})

	it('sets autoAcceptInvites to false when env is "false"', () => {
		withEnv(
			{ COMAPEO_DEVICE_NAME: 'dev', COMAPEO_AUTO_ACCEPT_INVITES: 'false' },
			() => {
				expect(loadConfig().autoAcceptInvites).toBe(false)
			},
		)
	})

	it('reads COMAPEO_ROOT_KEY from env', () => {
		withEnv({ COMAPEO_DEVICE_NAME: 'dev', COMAPEO_ROOT_KEY: 'abc123' }, () => {
			expect(loadConfig().rootKey).toBe('abc123')
		})
	})
})

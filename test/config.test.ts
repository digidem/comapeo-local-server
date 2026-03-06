import { describe, it, expect } from 'vitest'

import { loadConfig } from '../src/config/index.js'

describe('loadConfig', () => {
	it('throws when COMAPEO_DEVICE_NAME is missing', () => {
		expect(() => loadConfig({})).toThrow('Config validation failed')
		expect(() => loadConfig({})).toThrow('COMAPEO_DEVICE_NAME')
	})

	it('throws when COMAPEO_DEVICE_NAME is empty string', () => {
		expect(() => loadConfig({ COMAPEO_DEVICE_NAME: '' })).toThrow(
			'Config validation failed',
		)
	})

	it('returns defaults for optional fields', () => {
		const config = loadConfig({ COMAPEO_DEVICE_NAME: 'my-device' })
		expect(config.deviceName).toBe('my-device')
		expect(config.dataDir).toBe('/data')
		expect(config.autoAcceptInvites).toBe(true)
		expect(config.deviceType).toBe('desktop')
		expect(config.logLevel).toBe('info')
		expect(config.rootKey).toBeUndefined()
		expect(config.onlineStyleUrl).toBeUndefined()
	})

	it('reads COMAPEO_DATA_DIR from env', () => {
		const config = loadConfig({
			COMAPEO_DEVICE_NAME: 'dev',
			COMAPEO_DATA_DIR: '/tmp/test',
		})
		expect(config.dataDir).toBe('/tmp/test')
	})

	it('sets autoAcceptInvites to false when env is "false"', () => {
		const config = loadConfig({
			COMAPEO_DEVICE_NAME: 'dev',
			COMAPEO_AUTO_ACCEPT_INVITES: 'false',
		})
		expect(config.autoAcceptInvites).toBe(false)
	})

	it('throws when COMAPEO_AUTO_ACCEPT_INVITES is not "true" or "false"', () => {
		expect(() =>
			loadConfig({
				COMAPEO_DEVICE_NAME: 'dev',
				COMAPEO_AUTO_ACCEPT_INVITES: 'yes',
			}),
		).toThrow('Config validation failed')
	})

	it('accepts a valid 32-char hex COMAPEO_ROOT_KEY', () => {
		const hex = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
		const config = loadConfig({ COMAPEO_DEVICE_NAME: 'dev', COMAPEO_ROOT_KEY: hex })
		expect(config.rootKey).toBe(hex)
	})

	it('throws when COMAPEO_ROOT_KEY is wrong length', () => {
		expect(() =>
			loadConfig({ COMAPEO_DEVICE_NAME: 'dev', COMAPEO_ROOT_KEY: 'abc123' }),
		).toThrow('Config validation failed')
	})

	it('throws when COMAPEO_ROOT_KEY is not hex', () => {
		expect(() =>
			loadConfig({
				COMAPEO_DEVICE_NAME: 'dev',
				COMAPEO_ROOT_KEY: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
			}),
		).toThrow('Config validation failed')
	})

	it('accepts a valid ONLINE_STYLE_URL', () => {
		const url = 'https://tiles.example.com/style.json'
		const config = loadConfig({ COMAPEO_DEVICE_NAME: 'dev', ONLINE_STYLE_URL: url })
		expect(config.onlineStyleUrl).toBe(url)
	})

	it('throws when ONLINE_STYLE_URL is not a valid URL', () => {
		expect(() =>
			loadConfig({ COMAPEO_DEVICE_NAME: 'dev', ONLINE_STYLE_URL: 'not-a-url' }),
		).toThrow('Config validation failed')
	})

	it('reads COMAPEO_DEVICE_TYPE from env', () => {
		const config = loadConfig({
			COMAPEO_DEVICE_NAME: 'dev',
			COMAPEO_DEVICE_TYPE: 'mobile',
		})
		expect(config.deviceType).toBe('mobile')
	})

	it('reads LOG_LEVEL from env', () => {
		const config = loadConfig({ COMAPEO_DEVICE_NAME: 'dev', LOG_LEVEL: 'debug' })
		expect(config.logLevel).toBe('debug')
	})
})

import createDebug from 'debug'
import { afterEach, describe, expect, it } from 'vitest'

import { configureLogging } from '../src/logging/index.js'

describe('configureLogging', () => {
	afterEach(() => {
		createDebug.disable()
		delete process.env.DEBUG
	})

	it('enables comapeo debug logs for LOG_LEVEL=info', () => {
		const namespaces = configureLogging('info')

		expect(namespaces).toBe('comapeo:*,mapeo:*')
		expect(createDebug('comapeo:test').enabled).toBe(true)
		expect(createDebug('mapeo:test').enabled).toBe(true)
		expect(createDebug('other:test').enabled).toBe(false)
	})

	it('disables comapeo debug logs for LOG_LEVEL=warn', () => {
		const namespaces = configureLogging('warn')

		expect(namespaces).toBe('')
		expect(createDebug('comapeo:test').enabled).toBe(false)
	})

	it('does not override an explicit DEBUG pattern', () => {
		process.env.DEBUG = 'custom:*'

		const namespaces = configureLogging('warn')

		expect(namespaces).toBe('custom:*')
		expect(createDebug('custom:test').enabled).toBe(true)
		expect(createDebug('comapeo:test').enabled).toBe(false)
	})
})

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { loadOrCreateRootKey } from '../src/config/root-key.js'

let tmpDir: string

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), 'comapeo-rootkey-test-'))
})

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true })
})

describe('loadOrCreateRootKey', () => {
	it('generates a 16-byte key on first run', () => {
		const key = loadOrCreateRootKey(tmpDir)
		expect(Buffer.isBuffer(key)).toBe(true)
		expect(key.length).toBe(16)
	})

	it('persists the key as a 32-char hex file', () => {
		loadOrCreateRootKey(tmpDir)
		const persisted = readFileSync(join(tmpDir, '.root-key'), 'utf8').trim()
		expect(persisted).toMatch(/^[0-9a-f]{32}$/)
	})

	it('returns the same key on subsequent calls (identity stability)', () => {
		const key1 = loadOrCreateRootKey(tmpDir)
		const key2 = loadOrCreateRootKey(tmpDir)
		expect(key1.equals(key2)).toBe(true)
	})

	it('uses the env override when provided and does not persist it', () => {
		const overrideHex = 'deadbeefdeadbeefdeadbeefdeadbeef'
		const key = loadOrCreateRootKey(tmpDir, overrideHex)
		expect(key.toString('hex')).toBe(overrideHex)

		// No .root-key file should have been written
		expect(() => readFileSync(join(tmpDir, '.root-key'))).toThrow()
	})

	it('env override takes priority over a persisted key', () => {
		// Persist a key first
		const persisted = loadOrCreateRootKey(tmpDir)

		// Override should ignore the persisted key
		const overrideHex = 'cafebabecafebabecafebabecafebabe'
		const key = loadOrCreateRootKey(tmpDir, overrideHex)
		expect(key.toString('hex')).toBe(overrideHex)
		expect(key.equals(persisted)).toBe(false)
	})

	it('throws if the persisted file is corrupted', () => {
		// Write a bad key file
		writeFileSync(join(tmpDir, '.root-key'), 'tooshort', 'utf8')
		expect(() => loadOrCreateRootKey(tmpDir)).toThrow('corrupted')
	})

	it('creates the data directory if it does not exist', () => {
		const nestedDir = join(tmpDir, 'nested', 'subdir')
		const key = loadOrCreateRootKey(nestedDir)
		expect(key.length).toBe(16)
		const persisted = readFileSync(join(nestedDir, '.root-key'), 'utf8').trim()
		expect(persisted.length).toBe(32)
	})
})

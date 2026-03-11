import { describe, expect, it, vi } from 'vitest'

import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { enableSyncForJoinedProjects, startAlwaysOnSync } from '../src/daemon/sync.js'

const patchScriptSource = readFileSync(
	path.resolve('scripts/apply-comapeo-core-sync-patch.mjs'),
	'utf8',
)

function makeSyncProject(start = vi.fn()) {
	const emitter = new EventEmitter()
	return {
		$sync: {
			start,
			getState: vi.fn(() => ({
				initial: { isSyncEnabled: true },
				data: { isSyncEnabled: true },
				remoteDeviceSyncState: {},
			})),
			on: vi.fn((event, listener) => emitter.on(event, listener)),
			removeListener: vi.fn((event, listener) =>
				emitter.removeListener(event, listener),
			),
		},
	}
}

describe('enableSyncForJoinedProjects', () => {
	it('starts sync for each joined or joining project', async () => {
		const startA = vi.fn()
		const startB = vi.fn()
		const startC = vi.fn()
		const projectA = makeSyncProject(startA)
		const projectB = makeSyncProject(startB)
		const projectC = makeSyncProject(startC)
		const manager = {
			listProjects: vi.fn().mockResolvedValue([
				{ projectId: 'joined-a', status: 'joined' },
				{ projectId: 'joining-a', status: 'joining' },
				{ projectId: 'left-a', status: 'left' },
				{ projectId: 'joined-b', status: 'joined' },
			]),
			getProject: vi
				.fn()
				.mockResolvedValueOnce(projectA)
				.mockResolvedValueOnce(projectB)
				.mockResolvedValueOnce(projectC),
		}

		await enableSyncForJoinedProjects(manager as never)

		expect(manager.listProjects).toHaveBeenCalledOnce()
		expect(manager.getProject).toHaveBeenNthCalledWith(1, 'joined-a')
		expect(manager.getProject).toHaveBeenNthCalledWith(2, 'joining-a')
		expect(manager.getProject).toHaveBeenNthCalledWith(3, 'joined-b')
		expect(startA).toHaveBeenCalledOnce()
		expect(startB).toHaveBeenCalledOnce()
		expect(startC).toHaveBeenCalledOnce()
	})

	it('does nothing when no projects exist', async () => {
		const manager = {
			listProjects: vi.fn().mockResolvedValue([]),
			getProject: vi.fn(),
		}

		await enableSyncForJoinedProjects(manager as never)

		expect(manager.listProjects).toHaveBeenCalledOnce()
		expect(manager.getProject).not.toHaveBeenCalled()
	})

	it('reconciles sync again when local peers update', async () => {
		const start = vi.fn()
		const project = makeSyncProject(start)
		const emitter = new EventEmitter()
		const manager = Object.assign(emitter, {
			listProjects: vi
				.fn()
				.mockResolvedValue([{ projectId: 'joined-a', status: 'joined' }]),
			getProject: vi.fn().mockResolvedValue(project),
			removeListener: vi.fn((event, listener) =>
				EventEmitter.prototype.removeListener.call(emitter, event, listener),
			),
			on: vi.fn((event, listener) =>
				EventEmitter.prototype.on.call(emitter, event, listener),
			),
		})

		const sync = startAlwaysOnSync(manager as never)
		await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1))

		emitter.emit('local-peers', [
			{ deviceId: 'peer-1', status: 'connected', name: 'Peer', deviceType: 'mobile' },
		])

		await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2))

		sync.stop()
		expect(manager.removeListener).toHaveBeenCalledWith(
			'local-peers',
			expect.any(Function),
		)
	})

	it('patch script patches @comapeo/core peer sync gating to use peer-specific wanted state', () => {
		expect(patchScriptSource).toContain('peerState.wanted === 0')
	})

	it('patch script lets data wait for auth/config while blob still waits for blobIndex', () => {
		expect(patchScriptSource).toContain("this.#syncStatus.auth === 'synced'")
		expect(patchScriptSource).toContain("this.#syncStatus.config === 'synced'")
		expect(patchScriptSource).toContain("this.#syncStatus.blobIndex === 'synced'")
		expect(patchScriptSource).toContain("if (ns === 'data')")
		expect(patchScriptSource).toContain("} else if (ns === 'blob')")
	})

	it('patch script drops stale pre-haves once live peer bitfields exist', () => {
		expect(patchScriptSource).toContain(
			'if (this.#haves) return this.#haves.get(index)',
		)
		expect(patchScriptSource).toContain(
			'if (this.#haves) return getBitfieldWord(this.#haves, index)',
		)
	})
})

import { describe, expect, it, vi } from 'vitest'

import { EventEmitter } from 'node:events'

import { enableSyncForJoinedProjects, startAlwaysOnSync } from '../src/daemon/sync.js'
// @ts-expect-error Local postinstall script module is intentionally imported in tests.
import { patchPeerSyncControllerSource } from '../scripts/apply-comapeo-core-sync-patch.mjs'

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

	it('patches @comapeo/core peer sync gating to use peer-specific wanted state', () => {
		const source = `    } else if (
      peerState.status === 'started' &&
      state[namespace].localState.want === 0
    ) {
        } else if (isDataSyncEnabled) {
          const arePresyncNamespacesSynced = PRESYNC_NAMESPACES.every(
            (ns) => this.#syncStatus[ns] === 'synced'
          )
          // Only enable data namespaces once the pre-sync namespaces have synced
          if (arePresyncNamespacesSynced) {
            this.#enableNamespace(ns)
          }
        } else {
          this.#disableNamespace(ns)
        }`

		expect(patchPeerSyncControllerSource(source)).toContain(
			'peerState.wanted === 0',
		)
	})

	it('patches data gating so data waits for auth/config and blob waits for blobIndex', () => {
		const source = `    } else if (
      peerState.status === 'started' &&
      state[namespace].localState.want === 0
    ) {
        } else if (isDataSyncEnabled) {
          const arePresyncNamespacesSynced = PRESYNC_NAMESPACES.every(
            (ns) => this.#syncStatus[ns] === 'synced'
          )
          // Only enable data namespaces once the pre-sync namespaces have synced
          if (arePresyncNamespacesSynced) {
            this.#enableNamespace(ns)
          }
        } else {
          this.#disableNamespace(ns)
        }`

		const patched = patchPeerSyncControllerSource(source)
		expect(patched).toContain("this.#syncStatus.auth === 'synced'")
		expect(patched).toContain("this.#syncStatus.config === 'synced'")
		expect(patched).toContain("this.#syncStatus.blobIndex === 'synced'")
		expect(patched).toContain("if (ns === 'data')")
		expect(patched).toContain("} else if (ns === 'blob')")
	})
})

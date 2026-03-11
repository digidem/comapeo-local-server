import { describe, expect, it, vi } from 'vitest'

import { enableSyncForJoinedProjects } from '../src/daemon/sync.js'

describe('enableSyncForJoinedProjects', () => {
	it('starts sync for each joined project', async () => {
		const startA = vi.fn()
		const startB = vi.fn()
		const manager = {
			listProjects: vi.fn().mockResolvedValue([
				{ projectId: 'joined-a', status: 'joined' },
				{ projectId: 'joining-a', status: 'joining' },
				{ projectId: 'left-a', status: 'left' },
				{ projectId: 'joined-b', status: 'joined' },
			]),
			getProject: vi
				.fn()
				.mockResolvedValueOnce({ $sync: { start: startA } })
				.mockResolvedValueOnce({ $sync: { start: startB } }),
		}

		await enableSyncForJoinedProjects(manager as never)

		expect(manager.listProjects).toHaveBeenCalledOnce()
		expect(manager.getProject).toHaveBeenNthCalledWith(1, 'joined-a')
		expect(manager.getProject).toHaveBeenNthCalledWith(2, 'joined-b')
		expect(startA).toHaveBeenCalledOnce()
		expect(startB).toHaveBeenCalledOnce()
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
})

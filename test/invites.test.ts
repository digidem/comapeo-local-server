import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'

import { startInviteHandler } from '../src/daemon/invites.js'

// Minimal stub for InviteApi
type InviteStub = {
	on: ReturnType<typeof vi.fn>
	removeListener: ReturnType<typeof vi.fn>
	getMany: ReturnType<typeof vi.fn>
	accept: ReturnType<typeof vi.fn>
}

function makeInviteStub(manyInvites: unknown[] = []): InviteStub {
	const emitter = new EventEmitter()
	return {
		on: vi.fn((event, handler) => emitter.on(event, handler)),
		removeListener: vi.fn((event, handler) =>
			emitter.removeListener(event, handler),
		),
		getMany: vi.fn(() => manyInvites),
		accept: vi.fn().mockResolvedValue('project-abc'),
	}
}

type FakeInvite = { inviteId: string; state: string }

describe('startInviteHandler', () => {
	let stub: InviteStub

	beforeEach(() => {
		stub = makeInviteStub()
	})

	it('does not subscribe when autoAccept is false', () => {
		startInviteHandler(stub as never, false)
		expect(stub.on).not.toHaveBeenCalled()
		expect(stub.getMany).not.toHaveBeenCalled()
	})

	it('subscribes to invite-received when autoAccept is true', () => {
		startInviteHandler(stub as never, true)
		expect(stub.on).toHaveBeenCalledWith('invite-received', expect.any(Function))
	})

	it('runs boot-time reconciliation on startup', () => {
		startInviteHandler(stub as never, true)
		expect(stub.getMany).toHaveBeenCalledOnce()
	})

	it('accepts a pending invite on invite-received', async () => {
		startInviteHandler(stub as never, true)

		// Grab the registered handler and call it directly
		const handler = stub.on.mock.calls[0]![1] as (invite: FakeInvite) => void
		handler({ inviteId: 'beef01', state: 'pending' })

		// Allow the async handler to settle
		await vi.waitFor(() => expect(stub.accept).toHaveBeenCalledWith({ inviteId: 'beef01' }))
	})

	it('calls the joined-project callback after accepting an invite', async () => {
		const onProjectJoined = vi.fn().mockResolvedValue(undefined)
		startInviteHandler(stub as never, true, onProjectJoined)

		const handler = stub.on.mock.calls[0]![1] as (invite: FakeInvite) => void
		handler({ inviteId: 'beef04', state: 'pending' })

		await vi.waitFor(() =>
			expect(onProjectJoined).toHaveBeenCalledWith('project-abc'),
		)
	})

	it('does not call accept for non-pending invite on invite-received', async () => {
		startInviteHandler(stub as never, true)

		const handler = stub.on.mock.calls[0]![1] as (invite: FakeInvite) => void
		for (const state of ['joining', 'canceled', 'rejected', 'error']) {
			handler({ inviteId: 'beef02', state })
		}

		await new Promise((r) => setTimeout(r, 10))
		expect(stub.accept).not.toHaveBeenCalled()
	})

	it('accepts pending invites found during boot-time reconciliation', async () => {
		const pendingInvite = { inviteId: 'boot01', state: 'pending' }
		const canceledInvite = { inviteId: 'boot02', state: 'canceled' }
		stub = makeInviteStub([pendingInvite, canceledInvite])

		startInviteHandler(stub as never, true)

		await vi.waitFor(() =>
			expect(stub.accept).toHaveBeenCalledWith({ inviteId: 'boot01' }),
		)
		expect(stub.accept).not.toHaveBeenCalledWith({ inviteId: 'boot02' })
	})

	it('does not crash when accept rejects (already joined)', async () => {
		stub.accept.mockRejectedValue(new Error('Already joining or in project'))
		const onProjectJoined = vi.fn()

		startInviteHandler(stub as never, true, onProjectJoined)

		const handler = stub.on.mock.calls[0]![1] as (invite: FakeInvite) => void
		handler({ inviteId: 'beef03', state: 'pending' })

		// Should not throw; give it time to settle
		await new Promise((r) => setTimeout(r, 20))
		expect(onProjectJoined).not.toHaveBeenCalled()
	})

	it('stop() removes the event listener', () => {
		const { stop } = startInviteHandler(stub as never, true)
		stop()
		expect(stub.removeListener).toHaveBeenCalledWith(
			'invite-received',
			expect.any(Function),
		)
	})

	it('stop() is a no-op when autoAccept is false', () => {
		const { stop } = startInviteHandler(stub as never, false)
		expect(() => stop()).not.toThrow()
	})
})

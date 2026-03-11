import debug from 'debug'
import type { MapeoManager } from '@comapeo/core'
import type { InviteApi } from '@comapeo/core'

const log = debug('comapeo:invites')

type Invite = InviteApi.Invite

/**
 * Start the invite handler. When `autoAccept` is true, any incoming invite
 * in state `'pending'` is automatically accepted.
 *
 * Also reconciles any invites already in the InviteApi on startup (e.g. if
 * invites arrived during the tiny window before subscription).
 *
 * @returns a `stop()` function that removes the event listener.
 */
export function startInviteHandler(
	inviteApi: InstanceType<typeof MapeoManager>['invite'],
	autoAccept: boolean,
	onProjectJoined?: (projectId: string) => void | Promise<void>,
): { stop: () => void } {
	if (!autoAccept) {
		log('Auto-accept invites disabled; not subscribing')
		return { stop: () => {} }
	}

	log('Auto-accept invites enabled')

	async function handleInvite(invite: Invite): Promise<void> {
		const { inviteId, state } = invite

		if (state !== 'pending') {
			log('Invite %s is in state %s – skipping', inviteId, state)
			return
		}

		log('Accepting invite %s', inviteId)

		try {
			const projectId = await inviteApi.accept({ inviteId })
			log('Accepted invite %s → joined project %s', inviteId, projectId)
			await onProjectJoined?.(projectId)
		} catch (err) {
			// These are all expected idempotent-failure scenarios; log but don't crash.
			const message = err instanceof Error ? err.message : String(err)
			log('Could not accept invite %s: %s', inviteId, message)
		}
	}

	// ── Subscribe to new invites ──────────────────────────────────────────────
	inviteApi.on('invite-received', (invite) => {
		handleInvite(invite).catch((err) => {
			log('Unexpected error in invite handler:', err)
		})
	})

	// ── Boot-time reconciliation ──────────────────────────────────────────────
	// Accept any invites that arrived in the InviteApi before our subscription,
	// or that were pending from before this session started.
	const existing = inviteApi.getMany()
	if (existing.length > 0) {
		log('Boot-time reconciliation: found %d invite(s)', existing.length)
		for (const invite of existing) {
			handleInvite(invite).catch((err) => {
				log('Boot-time reconciliation error for invite %s: %s', invite.inviteId, err)
			})
		}
	}

	return {
		stop: () => {
			// TypedEmitter uses removeListener; off is an alias.
			inviteApi.removeListener('invite-received', handleInvite as Parameters<typeof inviteApi.on>[1])
		},
	}
}

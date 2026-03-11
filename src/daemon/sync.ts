import debug from 'debug'
import type { MapeoManager } from '@comapeo/core'

const log = debug('comapeo:sync')

type RemoteNamespaceSyncState = {
	isSyncEnabled: boolean
	want?: number
	wanted?: number
}

type ProjectSyncState = {
	initial: RemoteNamespaceSyncState
	data: RemoteNamespaceSyncState
	remoteDeviceSyncState: Record<
		string,
		{
			initial: RemoteNamespaceSyncState
			data: RemoteNamespaceSyncState
		}
	>
}

type SyncableProject = {
	$sync: {
		start: () => void
		getState?: () => ProjectSyncState
		on: (event: 'sync-state', listener: (state: ProjectSyncState) => void) => void
		removeListener: (
			event: 'sync-state',
			listener: (state: ProjectSyncState) => void,
		) => void
	}
}

type SyncManager = Pick<
	MapeoManager,
	'listProjects' | 'getProject' | 'on' | 'removeListener'
>

type LocalPeerInfo = {
	deviceId?: string
	status?: string
	name?: string
	deviceType?: string
}

/**
 * Ensure full data sync is enabled for every active project on this device.
 *
 * Re-running this is safe and keeps joining/newly joined projects synced without
 * depending on any UI exchange screen lifecycle.
 */
export async function enableSyncForJoinedProjects(
	manager: SyncManager,
	projectSyncListeners = new Map<
		string,
		(state: ProjectSyncState) => void
	>(),
): Promise<void> {
	const projects = await manager.listProjects()

	if (projects.length === 0) {
		log('No projects found for sync reconciliation')
		return
	}

	for (const projectInfo of projects) {
		if (
			projectInfo.status !== 'joined' &&
			projectInfo.status !== 'joining'
		) {
			log(
				'Project %s is in status %s; skipping sync enable',
				projectInfo.projectId,
				projectInfo.status,
			)
			continue
		}

		const project = (await manager.getProject(
			projectInfo.projectId,
		)) as SyncableProject
		attachProjectSyncLogger(
			projectInfo.projectId,
			project,
			projectSyncListeners,
		)
		project.$sync.start()
		log(
			'Enabled sync for project %s with status %s',
			projectInfo.projectId,
			projectInfo.status,
		)
	}
}

export function startAlwaysOnSync(manager: SyncManager): {
	stop: () => void
} {
	const projectSyncListeners = new Map<
		string,
		(state: ProjectSyncState) => void
	>()

	const reconcile = (reason: string) => {
		log('Reconciling project sync: reason=%s', reason)
		enableSyncForJoinedProjects(manager, projectSyncListeners).catch((err) => {
			log('Project sync reconciliation failed: %O', err)
		})
	}

	const handleLocalPeers = (peers: LocalPeerInfo[]) => {
		const connectedPeers = peers.filter((peer) => peer.status === 'connected')
		log(
			'Local peers update: total=%d connected=%d peers=%o',
			peers.length,
			connectedPeers.length,
			connectedPeers.map((peer) => ({
				deviceId: peer.deviceId?.slice(0, 7),
				name: peer.name,
				deviceType: peer.deviceType,
				status: peer.status,
			})),
		)
		reconcile('local-peers')
	}

	manager.on('local-peers', handleLocalPeers)
	reconcile('startup')

	return {
		stop: () => {
			manager.removeListener('local-peers', handleLocalPeers)
			for (const [projectId, listener] of projectSyncListeners) {
				manager
					.getProject(projectId)
					.then((project) => {
						;(project as SyncableProject).$sync.removeListener(
							'sync-state',
							listener,
						)
					})
					.catch(() => {})
			}
			projectSyncListeners.clear()
		},
	}
}

function attachProjectSyncLogger(
	projectId: string,
	project: SyncableProject,
	projectSyncListeners: Map<string, (state: ProjectSyncState) => void>,
) {
	if (projectSyncListeners.has(projectId)) {
		return
	}

	const onSyncState = (state: ProjectSyncState) => {
		log(
			'Project %s sync-state local=%s remote=%s',
			projectId,
			formatNamespaceStateSummary({
				initial: state.initial,
				data: state.data,
			}),
			formatRemoteDeviceStateSummary(state.remoteDeviceSyncState),
		)
	}

	project.$sync.on('sync-state', onSyncState)
	projectSyncListeners.set(projectId, onSyncState)

	const initialState = project.$sync.getState?.()
	if (initialState) {
		onSyncState(initialState)
	}
}

function formatNamespaceStateSummary(state: {
	initial: RemoteNamespaceSyncState
	data: RemoteNamespaceSyncState
}) {
	return `initial(enabled=${state.initial.isSyncEnabled}) data(enabled=${state.data.isSyncEnabled})`
}

function formatRemoteDeviceStateSummary(
	remoteDeviceSyncState: ProjectSyncState['remoteDeviceSyncState'],
) {
	const entries = Object.entries(remoteDeviceSyncState)
	if (entries.length === 0) {
		return '[]'
	}

	return `[${entries
		.map(([deviceId, state]) => {
			return `${deviceId.slice(0, 7)}:initial(enabled=${state.initial.isSyncEnabled},want=${state.initial.want ?? '?'},wanted=${state.initial.wanted ?? '?'}) data(enabled=${state.data.isSyncEnabled},want=${state.data.want ?? '?'},wanted=${state.data.wanted ?? '?'})`
		})
		.join('; ')}]`
}

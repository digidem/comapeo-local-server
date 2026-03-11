import debug from 'debug'
import type { MapeoManager } from '@comapeo/core'

const log = debug('comapeo:sync')

type SyncableProject = {
	$sync: {
		start: () => void
	}
}

type SyncManager = Pick<MapeoManager, 'listProjects' | 'getProject'>

/**
 * Ensure full data sync is enabled for every joined project on this device.
 *
 * Re-running this is safe and keeps newly joined projects synced without
 * depending on any UI exchange screen lifecycle.
 */
export async function enableSyncForJoinedProjects(
	manager: SyncManager,
): Promise<void> {
	const projects = await manager.listProjects()

	if (projects.length === 0) {
		log('No projects found for sync reconciliation')
		return
	}

	for (const projectInfo of projects) {
		if (projectInfo.status !== 'joined') {
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
		project.$sync.start()
		log('Enabled sync for project %s', projectInfo.projectId)
	}
}

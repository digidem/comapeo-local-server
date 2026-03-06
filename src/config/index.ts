// Config module - env parsing and validation.
// Full implementation in Batch 2.

export type Config = {
	deviceName: string
	dataDir: string
	rootKey?: string
	autoAcceptInvites: boolean
	deviceType: string
	onlineStyleUrl?: string
	logLevel: string
}

/**
 * Parse and validate environment variables into a typed Config object.
 * Throws if required variables are missing or invalid.
 */
export function loadConfig(): Config {
	const deviceName = process.env['COMAPEO_DEVICE_NAME']
	if (!deviceName) {
		throw new Error('COMAPEO_DEVICE_NAME is required')
	}

	return {
		deviceName,
		dataDir: process.env['COMAPEO_DATA_DIR'] ?? '/data',
		rootKey: process.env['COMAPEO_ROOT_KEY'],
		autoAcceptInvites:
			(process.env['COMAPEO_AUTO_ACCEPT_INVITES'] ?? 'true') !== 'false',
		deviceType: process.env['COMAPEO_DEVICE_TYPE'] ?? 'desktop',
		onlineStyleUrl: process.env['ONLINE_STYLE_URL'],
		logLevel: process.env['LOG_LEVEL'] ?? 'info',
	}
}

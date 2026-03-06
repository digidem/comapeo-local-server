import * as v from 'valibot'

// Env var names mapped to typed, validated Config fields.
const EnvSchema = v.object({
	COMAPEO_DEVICE_NAME: v.pipe(
		v.string('COMAPEO_DEVICE_NAME must be a string'),
		v.minLength(1, 'COMAPEO_DEVICE_NAME is required and must not be empty'),
	),
	COMAPEO_DATA_DIR: v.optional(v.string(), '/data'),
	COMAPEO_ROOT_KEY: v.optional(
		v.pipe(
			v.string(),
			v.hexadecimal('COMAPEO_ROOT_KEY must be a hexadecimal string'),
			v.length(
				32,
				'COMAPEO_ROOT_KEY must be exactly 32 hex characters (16 bytes)',
			),
		),
	),
	COMAPEO_AUTO_ACCEPT_INVITES: v.optional(
		v.picklist(
			['true', 'false'],
			'COMAPEO_AUTO_ACCEPT_INVITES must be "true" or "false"',
		),
		'true',
	),
	COMAPEO_DEVICE_TYPE: v.optional(v.string(), 'desktop'),
	ONLINE_STYLE_URL: v.optional(
		v.pipe(v.string(), v.url('ONLINE_STYLE_URL must be a valid URL')),
	),
	LOG_LEVEL: v.optional(v.string(), 'info'),
})

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
 * Accepts an optional env object (defaults to process.env) for testability.
 * Throws a descriptive Error if any required variable is missing or invalid.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
	let parsed: v.InferOutput<typeof EnvSchema>

	try {
		parsed = v.parse(EnvSchema, env)
	} catch (err) {
		if (v.isValiError(err)) {
			const messages = err.issues
				.map((issue) => {
					const field = issue.path?.[0]?.key ?? 'unknown field'
					return `${field}: ${issue.message}`
				})
				.join('; ')
			throw new Error(`Config validation failed: ${messages}`)
		}
		throw err
	}

	return {
		deviceName: parsed.COMAPEO_DEVICE_NAME,
		dataDir: parsed.COMAPEO_DATA_DIR,
		rootKey: parsed.COMAPEO_ROOT_KEY,
		autoAcceptInvites: parsed.COMAPEO_AUTO_ACCEPT_INVITES === 'true',
		deviceType: parsed.COMAPEO_DEVICE_TYPE,
		onlineStyleUrl: parsed.ONLINE_STYLE_URL,
		logLevel: parsed.LOG_LEVEL,
	}
}

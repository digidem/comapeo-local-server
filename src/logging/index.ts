import createDebug from 'debug'

const DEFAULT_DEBUG_NAMESPACES = 'comapeo:*,mapeo:*'
const QUIET_LOG_LEVELS = new Set(['warn', 'error', 'fatal', 'silent', 'off', 'none'])

function resolveDebugNamespaces(logLevel: string): string {
	const normalized = logLevel.trim().toLowerCase()

	if (
		normalized.startsWith('comapeo:') ||
		normalized.includes('*') ||
		normalized.includes(',')
	) {
		return logLevel
	}

	if (QUIET_LOG_LEVELS.has(normalized)) {
		return ''
	}

	return DEFAULT_DEBUG_NAMESPACES
}

export function configureLogging(
	logLevel: string,
	debugPattern = process.env.DEBUG,
): string {
	const namespaces = debugPattern?.trim()
		? debugPattern
		: resolveDebugNamespaces(logLevel)

	if (namespaces) {
		createDebug.enable(namespaces)
	} else {
		createDebug.disable()
	}

	return namespaces
}

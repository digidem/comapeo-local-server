import { spawnSync } from 'node:child_process'

const result = spawnSync(
	'gitleaks',
	[
		'git',
		'--pre-commit',
		'--staged',
		'--no-banner',
		'--no-color',
		'--redact',
		'--exit-code',
		'1',
		'.',
	],
	{
		encoding: 'utf8',
		stdio: 'pipe',
	},
)

if (result.status === null) {
	const message =
		result.error?.message ??
		'gitleaks is required for secret scanning. Install it and rerun the commit.'
	console.error('[pre-commit] Failed to execute gitleaks:', message)
	process.exit(1)
}

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

process.exit(result.status)

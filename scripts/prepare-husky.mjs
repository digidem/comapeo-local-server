import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const huskyBin = path.join(repoRoot, 'node_modules', '.bin', 'husky')

if (!existsSync(path.join(repoRoot, '.git')) || !existsSync(huskyBin)) {
	process.exit(0)
}

const result = spawnSync(huskyBin, [], { stdio: 'inherit' })

if (result.error) {
	console.error('[prepare] Failed to install Husky hooks:', result.error.message)
	process.exit(1)
}

process.exit(result.status ?? 0)

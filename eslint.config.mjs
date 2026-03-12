import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
	{
		ignores: ['dist/**', 'node_modules/**', 'data/**'],
	},
	{
		files: ['**/*.{js,mjs,cjs}'],
		...js.configs.recommended,
		languageOptions: {
			...js.configs.recommended.languageOptions,
			globals: {
				...globals.node,
			},
		},
	},
	...tseslint.configs.recommendedTypeChecked.map((config) => ({
		...config,
		files: ['**/*.{ts,mts,cts}'],
	})),
	{
		files: ['**/*.{ts,mts,cts}'],
		languageOptions: {
			globals: {
				...globals.node,
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ['test/**/*.{ts,mts,cts}'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.vitest,
			},
		},
		rules: {
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
		},
	},
	{
		files: ['vitest.config.ts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['vitest.config.ts'],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		linterOptions: {
			reportUnusedDisableDirectives: 'error',
		},
	},
)

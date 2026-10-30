// Ejecuta src/**/*.test.mjs salvo *.database.test.mjs, sin depender de extglob (Node 22 en CI).
// Uso: node scripts/run-admin-tests.mjs [--coverage]
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const withCoverage = process.argv.includes('--coverage')

function collect(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collect(path))
    else if (entry.name.endsWith('.test.mjs') && !entry.name.endsWith('.database.test.mjs')) files.push(path)
  }
  return files
}

const files = collect('src').sort()
if (files.length === 0) {
  console.error('No se encontraron pruebas en src/.')
  process.exit(1)
}

const args = ['--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--test']
if (withCoverage) {
  mkdirSync('coverage', { recursive: true })
  args.push(
    '--experimental-test-coverage',
    '--test-coverage-include=src/**',
    '--test-coverage-exclude=**/*.test.mjs',
    '--test-coverage-exclude=**/mocks/**',
    '--test-reporter=lcov',
    '--test-reporter-destination=coverage/lcov.info',
    '--test-reporter=dot',
    '--test-reporter-destination=stdout',
  )
}

const result = spawnSync(process.execPath, [...args, ...files], { stdio: 'inherit' })
process.exit(result.status ?? 1)

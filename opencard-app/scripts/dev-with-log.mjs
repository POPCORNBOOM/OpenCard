import { appendFileSync, createWriteStream } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(scriptDirectory, '..')
const logPath = resolve(projectDirectory, '.vite-dev.log')

appendFileSync(logPath, `\n=== Vite session ${new Date().toISOString()} ===\n`)

const viteScript = resolve(projectDirectory, 'node_modules/vite/bin/vite.js')
const vite = spawn(process.execPath, [viteScript, ...process.argv.slice(2)], {
  cwd: projectDirectory,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
})

const log = createWriteStream(logPath, { flags: 'a' })
const forward = (chunk) => {
  process.stdout.write(chunk)
  log.write(chunk)
}
const forwardError = (chunk) => {
  process.stderr.write(chunk)
  log.write(chunk)
}

vite.stdout.on('data', forward)
vite.stderr.on('data', forwardError)
vite.on('error', error => {
  forwardError(`${error.stack ?? error.message}\n`)
  log.end()
  process.exitCode = 1
})
vite.on('close', (code, signal) => {
  log.end()
  process.exitCode = code ?? (signal ? 1 : 0)
})

process.on('SIGINT', () => vite.kill('SIGINT'))
process.on('SIGTERM', () => vite.kill('SIGTERM'))

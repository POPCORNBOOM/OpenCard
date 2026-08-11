import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { cleanupE2eWorkspace, prepareE2eWorkspace } from './e2e/support/workspace.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const appBinaryPath = process.env.OPENCARD_E2E_BINARY
  ? resolve(process.env.OPENCARD_E2E_BINARY)
  : resolve(root, 'src-tauri/target/release/OpenCard.exe')
const driverImages = ['tauri-driver.exe', 'msedgedriver.exe']
let existingDriverPids = new Set()

function listDriverPids() {
  return new Set(driverImages.flatMap(image => {
    const output = execFileSync('tasklist.exe', ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
    })
    return [...output.matchAll(/^"[^"]+","(\d+)"/gm)].map(match => Number(match[1]))
  }))
}

function prepareSuite() {
  existingDriverPids = listDriverPids()
  prepareE2eWorkspace()
}

function cleanupSuite() {
  cleanupE2eWorkspace()
  for (const pid of listDriverPids()) {
    if (existingDriverPids.has(pid)) continue
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      // The service may finish the process between enumeration and cleanup.
    }
  }
}

export const config = {
  runner: 'local',
  specs: ['./e2e/specs/**/*.e2e.mjs'],
  maxInstances: 1,
  services: [[
    '@wdio/tauri-service',
    {
      appBinaryPath,
      driverProvider: 'external',
      autoInstallTauriDriver: false,
      autoDownloadEdgeDriver: true,
    },
  ]],
  capabilities: [{
    browserName: 'tauri',
    'tauri:options': { application: appBinaryPath },
  }],
  logLevel: 'warn',
  bail: 1,
  waitforTimeout: 15_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  framework: 'mocha',
  reporters: ['spec'],
  onPrepare: prepareSuite,
  onComplete: cleanupSuite,
  before: async (_capabilities, _specs, browser) => {
    const handle = await browser.getWindowHandle()
    await browser.switchToWindow(handle)
  },
  mochaOpts: {
    ui: 'bdd',
    bail: true,
    timeout: 120_000,
  },
}

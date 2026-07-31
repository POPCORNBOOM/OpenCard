/**
 * Manifest-driven module path rename.
 *
 * Updates only relative ES module specifiers that resolve to a renamed file.
 * It deliberately does not rewrite symbols, arbitrary strings, or protocol keys.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = process.cwd()
const writeMode = process.argv.includes('--write')
const manifestArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'))

if (!manifestArgument) {
  console.error('Usage: node scripts/rename-modules.mjs <manifest.json> [--write]')
  process.exit(1)
}

const skippedDirectories = new Set(['.git', 'dist', 'node_modules', 'target'])
const codeExtensions = new Set(['.js', '.mjs', '.ts', '.tsx', '.vue'])
const resolvableExtensions = ['', '.ts', '.tsx', '.vue', '.js', '.mjs']
const moduleSpecifierPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)(['"])([^'"]+)\1/g

function normalizePath(path) {
  return resolve(path).split(sep).join('/')
}

function normalizeRepoPath(path) {
  if (isAbsolute(path)) throw new Error(`manifest paths must be relative: ${path}`)
  const absolutePath = resolve(projectRoot, path)
  const relativePath = relative(projectRoot, absolutePath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`manifest path escapes the project: ${path}`)
  }
  return absolutePath
}

function pathKey(path) {
  const normalized = normalizePath(path)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function readManifest(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(parsed.renames) || parsed.renames.length === 0) {
    throw new Error('manifest must contain a non-empty renames array')
  }
  return parsed.renames.map((entry) => {
    if (typeof entry?.from !== 'string' || typeof entry?.to !== 'string') {
      throw new Error('every rename must contain string from/to paths')
    }
    return { from: normalizeRepoPath(entry.from), to: normalizeRepoPath(entry.to) }
  })
}

function validateRenames(renames) {
  const sources = new Set()
  const targets = new Set()
  for (const rename of renames) {
    const sourceKey = pathKey(rename.from)
    const targetKey = pathKey(rename.to)
    if (!existsSync(rename.from) || !statSync(rename.from).isFile()) {
      throw new Error(`source file does not exist: ${relative(projectRoot, rename.from)}`)
    }
    if (!existsSync(dirname(rename.to))) {
      throw new Error(`target directory does not exist: ${relative(projectRoot, dirname(rename.to))}`)
    }
    if (sources.has(sourceKey)) throw new Error(`duplicate source: ${relative(projectRoot, rename.from)}`)
    if (targets.has(targetKey)) throw new Error(`duplicate target: ${relative(projectRoot, rename.to)}`)
    if (sourceKey !== targetKey && existsSync(rename.to)) {
      throw new Error(`target already exists: ${relative(projectRoot, rename.to)}`)
    }
    sources.add(sourceKey)
    targets.add(targetKey)
  }
}

function collectCodeFiles(directory, result = []) {
  for (const entry of readdirSync(directory)) {
    if (skippedDirectories.has(entry)) continue
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) collectCodeFiles(path, result)
    else if (codeExtensions.has(extname(path))) result.push(path)
  }
  return result
}

function resolveModule(importer, specifier) {
  const queryIndex = specifier.search(/[?#]/)
  const pathPart = queryIndex >= 0 ? specifier.slice(0, queryIndex) : specifier
  if (!pathPart.startsWith('.')) return null
  const basePath = resolve(dirname(importer), pathPart)
  const candidates = resolvableExtensions.map(extension => `${basePath}${extension}`)
  candidates.push(join(basePath, 'index.ts'), join(basePath, 'index.vue'))
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile()) ?? null
}

function formatModuleSpecifier(importer, target, originalSpecifier) {
  const queryIndex = originalSpecifier.search(/[?#]/)
  const query = queryIndex >= 0 ? originalSpecifier.slice(queryIndex) : ''
  const originalPath = queryIndex >= 0 ? originalSpecifier.slice(0, queryIndex) : originalSpecifier
  const keepsExtension = codeExtensions.has(extname(originalPath))
  let targetPath = target
  if (!keepsExtension && codeExtensions.has(extname(targetPath))) {
    targetPath = targetPath.slice(0, -extname(targetPath).length)
  }
  let specifier = relative(dirname(importer), targetPath).split(sep).join('/')
  if (!specifier.startsWith('.')) specifier = `./${specifier}`
  return `${specifier}${query}`
}

function planEdits(renames) {
  const renameBySource = new Map(renames.map(rename => [pathKey(rename.from), rename]))
  const finalPathBySource = new Map(renames.map(rename => [pathKey(rename.from), rename.to]))
  const edits = []

  for (const importer of collectCodeFiles(projectRoot)) {
    const original = readFileSync(importer, 'utf8')
    const finalImporter = finalPathBySource.get(pathKey(importer)) ?? importer
    const updated = original.replace(moduleSpecifierPattern, (match, quote, specifier) => {
      const resolvedModule = resolveModule(importer, specifier)
      if (!resolvedModule) return match
      const rename = renameBySource.get(pathKey(resolvedModule))
      if (!rename) return match
      const replacement = formatModuleSpecifier(finalImporter, rename.to, specifier)
      return match.slice(0, match.length - specifier.length - 1) + replacement + quote
    })
    if (updated !== original) edits.push({ importer, finalImporter, updated })
  }
  return edits
}

function runGitMove(from, to) {
  const result = spawnSync('git', ['mv', '--', relative(projectRoot, from), relative(projectRoot, to)], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git mv failed: ${from}`)
}

function applyRenames(renames, edits) {
  for (const rename of renames) {
    if (pathKey(rename.from) === pathKey(rename.to) && normalizePath(rename.from) !== normalizePath(rename.to)) {
      const temporary = `${rename.from}.rename-tmp`
      runGitMove(rename.from, temporary)
      runGitMove(temporary, rename.to)
    } else {
      runGitMove(rename.from, rename.to)
    }
  }
  for (const edit of edits) writeFileSync(edit.finalImporter, edit.updated, 'utf8')
}

try {
  const manifestPath = normalizeRepoPath(manifestArgument)
  const renames = readManifest(manifestPath)
  validateRenames(renames)
  const edits = planEdits(renames)

  console.log(`[rename:modules] ${writeMode ? 'apply' : 'dry-run'}: ${renames.length} rename(s), ${edits.length} import file(s)`)
  for (const rename of renames) {
    console.log(`- ${relative(projectRoot, rename.from)} -> ${relative(projectRoot, rename.to)}`)
  }
  for (const edit of edits) console.log(`  import edits: ${relative(projectRoot, edit.importer)}`)

  if (writeMode) applyRenames(renames, edits)
  else console.log('[rename:modules] no files changed; pass --write to apply')
} catch (error) {
  console.error(`[rename:modules] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

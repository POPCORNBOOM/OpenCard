/**
 * TypeScript Language Service symbol rename driven by an explicit manifest.
 *
 * Vue template symbols and protocol strings are intentionally outside this tool.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import ts from 'typescript'

const projectRoot = process.cwd()
const writeMode = process.argv.includes('--write')
const manifestArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'))

if (!manifestArgument) {
  console.error('Usage: node scripts/rename-symbols.mjs <manifest.json> [--write]')
  process.exit(1)
}

function projectPath(path) {
  if (isAbsolute(path)) throw new Error(`manifest paths must be relative: ${path}`)
  const absolutePath = resolve(projectRoot, path)
  const localPath = relative(projectRoot, absolutePath)
  if (localPath.startsWith('..') || isAbsolute(localPath)) throw new Error(`path escapes project: ${path}`)
  return absolutePath
}

function readManifest(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(parsed.renames) || parsed.renames.length === 0) {
    throw new Error('manifest must contain a non-empty renames array')
  }
  return parsed.renames.map((entry) => {
    for (const key of ['file', 'from', 'to', 'anchor']) {
      if (typeof entry?.[key] !== 'string' || entry[key].length === 0) {
        throw new Error(`every symbol rename must contain a non-empty ${key}`)
      }
    }
    if (!/^[$A-Z_a-z][$\w]*$/.test(entry.from) || !/^[$A-Z_a-z][$\w]*$/.test(entry.to)) {
      throw new Error(`symbol names must be identifiers: ${entry.from} -> ${entry.to}`)
    }
    return { ...entry, file: projectPath(entry.file) }
  })
}

function loadProject() {
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json')
  if (!configPath) throw new Error('tsconfig.json not found')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot)
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'))
  }
  return parsed
}

function createProjectService(project) {
  const texts = new Map()
  const originalTexts = new Map()
  const versions = new Map()
  const actualPaths = new Map()

  function fileKey(fileName) {
    const absolutePath = resolve(fileName)
    return process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath
  }

  function getText(fileName) {
    const key = fileKey(fileName)
    actualPaths.set(key, resolve(fileName))
    if (!texts.has(key)) texts.set(key, readFileSync(fileName, 'utf8'))
    return texts.get(key)
  }

  function updateText(fileName, text) {
    const key = fileKey(fileName)
    if (!originalTexts.has(key)) originalTexts.set(key, getText(fileName))
    texts.set(key, text)
    versions.set(key, (versions.get(key) ?? 0) + 1)
  }

  const host = {
    getCompilationSettings: () => project.options,
    getScriptFileNames: () => project.fileNames,
    getScriptVersion: fileName => String(versions.get(fileKey(fileName)) ?? 0),
    getScriptSnapshot: (fileName) => {
      if (!existsSync(fileName)) return undefined
      return ts.ScriptSnapshot.fromString(getText(fileName))
    },
    getCurrentDirectory: () => projectRoot,
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
  }

  return {
    service: ts.createLanguageService(host, ts.createDocumentRegistry()),
    getText,
    updateText,
    changedFiles: () => [...originalTexts.keys()]
      .filter(key => originalTexts.get(key) !== texts.get(key))
      .map(key => actualPaths.get(key)),
  }
}

function locateSymbol(serviceState, rename) {
  const text = serviceState.getText(rename.file)
  const anchorStart = text.indexOf(rename.anchor)
  if (anchorStart < 0 || text.indexOf(rename.anchor, anchorStart + rename.anchor.length) >= 0) {
    const nearbyLine = text.split(/\r?\n/).find(line => line.includes(rename.from))?.trim()
    throw new Error(`anchor must occur exactly once in ${relative(projectRoot, rename.file)}: ${rename.anchor}${nearbyLine ? `; actual: ${nearbyLine}` : ''}`)
  }
  const symbolOffset = rename.anchor.indexOf(rename.from)
  if (symbolOffset < 0) throw new Error(`anchor does not contain ${rename.from}: ${rename.anchor}`)
  return anchorStart + symbolOffset
}

function applySymbolRename(serviceState, rename) {
  const position = locateSymbol(serviceState, rename)
  const info = serviceState.service.getRenameInfo(rename.file, position)
  if (!info.canRename) throw new Error(`cannot rename ${rename.from}: ${info.localizedErrorMessage}`)
  const locations = serviceState.service.findRenameLocations(rename.file, position, false, false, true)
  if (!locations || locations.length === 0) throw new Error(`no rename locations found for ${rename.from}`)

  const byFile = new Map()
  for (const location of locations) {
    const edits = byFile.get(location.fileName) ?? []
    edits.push(location)
    byFile.set(location.fileName, edits)
  }

  for (const [fileName, edits] of byFile) {
    let text = serviceState.getText(fileName)
    for (const edit of edits.sort((a, b) => b.textSpan.start - a.textSpan.start)) {
      const before = text.slice(0, edit.textSpan.start)
      const after = text.slice(edit.textSpan.start + edit.textSpan.length)
      text = `${before}${edit.prefixText ?? ''}${rename.to}${edit.suffixText ?? ''}${after}`
    }
    serviceState.updateText(fileName, text)
  }
  return locations.length
}

try {
  const manifest = readManifest(projectPath(manifestArgument))
  const serviceState = createProjectService(loadProject())
  const results = []

  for (const rename of manifest) {
    results.push({ rename, locations: applySymbolRename(serviceState, rename) })
  }

  const changedFiles = serviceState.changedFiles()
  console.log(`[rename:symbols] ${writeMode ? 'apply' : 'dry-run'}: ${manifest.length} symbol(s), ${changedFiles.length} file(s)`)
  for (const result of results) {
    console.log(`- ${result.rename.from} -> ${result.rename.to}: ${result.locations} location(s)`)
  }
  for (const fileName of changedFiles) console.log(`  edits: ${relative(projectRoot, fileName)}`)

  if (writeMode) {
    for (const fileName of changedFiles) writeFileSync(fileName, serviceState.getText(fileName), 'utf8')
  } else {
    console.log('[rename:symbols] no files changed; pass --write to apply')
  }
} catch (error) {
  console.error(`[rename:symbols] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

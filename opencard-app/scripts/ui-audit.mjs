import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const srcRoot = path.join(projectRoot, 'src')
const hexEnforcedRoots = [
  path.join(srcRoot, 'components', 'base'),
  path.join(srcRoot, 'shared', 'ui', 'primitives'),
  path.join(srcRoot, 'shared', 'ui', 'foundation'),
]

const allowedHexFiles = new Set([
  path.join(srcRoot, 'shared', 'ui', 'foundation', 'themes.ts'),
])

const allowedRawControlFiles = new Set([
  path.join(srcRoot, 'components', 'card', 'CardViewport.vue'),
  path.join(srcRoot, 'components', 'editors', 'property-fields', 'BackgroundPropertyField.vue'),
  path.join(srcRoot, 'components', 'editors', 'property-fields', 'BooleanPropertyField.vue'),
  path.join(srcRoot, 'components', 'editors', 'property-fields', 'ColorPropertyField.vue'),
])

const stateRequiredFiles = [
  path.join(srcRoot, 'shared', 'ui', 'primitives', 'OcPressable.vue'),
]

const violations = []

async function walk(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

function isVueFile(fullPath) {
  return fullPath.endsWith('.vue')
}

function isScanTextFile(fullPath) {
  return fullPath.endsWith('.vue') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')
}

function pushViolation(rule, fullPath, detail) {
  violations.push({
    rule,
    file: path.relative(projectRoot, fullPath),
    detail,
  })
}

function checkHexColors(fullPath, content) {
  if (!isScanTextFile(fullPath)) {
    return
  }
  const shouldEnforce = hexEnforcedRoots.some((rootPath) => fullPath.startsWith(rootPath))
  if (!shouldEnforce) {
    return
  }
  if (allowedHexFiles.has(fullPath)) {
    return
  }

  const matches = content.match(/#[0-9a-fA-F]{3,8}\b/g)
  if (!matches) {
    return
  }

  pushViolation('hex-color', fullPath, `Found hard-coded color(s): ${matches.join(', ')}`)
}

function checkRawControls(fullPath, content) {
  if (!isVueFile(fullPath)) {
    return
  }

  const inPrimitiveOrBase =
    fullPath.includes(`${path.sep}src${path.sep}shared${path.sep}ui${path.sep}primitives${path.sep}`)
    || fullPath.includes(`${path.sep}src${path.sep}components${path.sep}base${path.sep}`)

  if (inPrimitiveOrBase || allowedRawControlFiles.has(fullPath)) {
    return
  }

  const matches = [...content.matchAll(/<(button|input|select|textarea)\b/gi)]
  if (matches.length === 0) {
    return
  }

  const controls = matches.map((match) => match[1].toLowerCase())
  pushViolation('raw-control', fullPath, `Raw controls must be wrapped: ${controls.join(', ')}`)
}

async function checkStateCompleteness() {
  for (const fullPath of stateRequiredFiles) {
    const content = await fs.readFile(fullPath, 'utf8')
    const hasHover = content.includes(':hover')
    const hasDisabled = content.includes(':disabled') || content.includes("aria-disabled='true'")
    const hasFocus = content.includes(':focus') || content.includes('focus-visible')
    const hasActive = content.includes('is-active') || content.includes(':active')

    if (!hasHover || !hasDisabled || !hasFocus || !hasActive) {
      pushViolation(
        'state-missing',
        fullPath,
        `Need hover/disabled/focus/active. got hover=${hasHover} disabled=${hasDisabled} focus=${hasFocus} active=${hasActive}`,
      )
    }
  }
}

async function main() {
  const files = await walk(srcRoot)
  for (const fullPath of files) {
    if (!isScanTextFile(fullPath)) {
      continue
    }
    const content = await fs.readFile(fullPath, 'utf8')
    checkHexColors(fullPath, content)
    checkRawControls(fullPath, content)
  }

  await checkStateCompleteness()

  if (violations.length > 0) {
    console.error('[ui-audit] FAILED')
    for (const violation of violations) {
      console.error(`- [${violation.rule}] ${violation.file}: ${violation.detail}`)
    }
    process.exit(1)
  }

  console.log('[ui-audit] PASS')
}

await main()

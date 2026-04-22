import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const srcRoot = path.join(projectRoot, 'src')
const hexEnforcedRoots = [
  path.join(srcRoot, 'components', 'base'),
  path.join(srcRoot, 'components', 'ui-kit'),
  path.join(srcRoot, 'shared', 'ui', 'primitives'),
  path.join(srcRoot, 'shared', 'ui', 'foundation'),
]
const hexEnforcedFiles = new Set([
  path.join(srcRoot, 'views', 'UiKitShowcase.vue'),
  path.join(srcRoot, 'views', 'MainIDE.vue'),
  path.join(srcRoot, 'components', 'editors', 'CardDesignEditor.vue'),
  path.join(srcRoot, 'components', 'editors', 'ImagePreviewEditor.vue'),
  path.join(srcRoot, 'components', 'ui', 'TreeNode.vue'),
  path.join(srcRoot, 'components', 'editors', 'property-fields', 'FilePathPropertyField.vue'),
])

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

const uiKitRequiredSectionIds = ['foundation', 'primitives', 'base']
const uiKitRequiredColumnTitles = ['Default', 'Variants', 'States', 'Layout']

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
    || hexEnforcedFiles.has(fullPath)
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

async function checkUiKitShowcaseStructure() {
  const viewPath = path.join(srcRoot, 'views', 'UiKitShowcase.vue')
  const catalogPath = path.join(srcRoot, 'views', 'ui-kit', 'catalog.ts')
  const gridPath = path.join(srcRoot, 'components', 'ui-kit', 'ExampleGrid.vue')
  const rendererPath = path.join(srcRoot, 'components', 'ui-kit', 'ShowcaseExampleRenderer.vue')

  const viewContent = await fs.readFile(viewPath, 'utf8')
  const catalogContent = await fs.readFile(catalogPath, 'utf8')
  const gridContent = await fs.readFile(gridPath, 'utf8')
  const rendererContent = await fs.readFile(rendererPath, 'utf8')

  const usesCatalogDrivenSectionLoop =
    viewContent.includes(':id="section.id"')
    && viewContent.includes('UI_KIT_SECTIONS')

  if (usesCatalogDrivenSectionLoop) {
    for (const sectionId of uiKitRequiredSectionIds) {
      if (!catalogContent.includes(`id: '${sectionId}'`)) {
        pushViolation('ui-kit-structure', catalogPath, `Missing section id "${sectionId}" in catalog`)
      }
    }
  } else {
    for (const sectionId of uiKitRequiredSectionIds) {
      if (!viewContent.includes(`id="${sectionId}"`)) {
        pushViolation('ui-kit-structure', viewPath, `Missing section id "${sectionId}"`)
      }
    }
  }

  if (!viewContent.includes('<ShowcaseExampleRenderer')) {
    pushViolation('ui-kit-structure', viewPath, 'UiKitShowcase must render demos via <ShowcaseExampleRenderer>')
  }

  for (const title of uiKitRequiredColumnTitles) {
    if (!gridContent.includes(title)) {
      pushViolation('ui-kit-structure', gridPath, `Missing matrix column "${title}"`)
    }
  }

  const catalogIds = [...catalogContent.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1])
  const exampleIds = catalogIds.filter((id) => !uiKitRequiredSectionIds.includes(id))

  const demoBlocksCount = (catalogContent.match(/demoBlocks:\s*SHOWCASE_MATRIX_COLUMNS/g) ?? []).length
  if (demoBlocksCount !== exampleIds.length) {
    pushViolation(
      'ui-kit-structure',
      catalogPath,
      `Every example must use SHOWCASE_MATRIX_COLUMNS. expected=${exampleIds.length} actual=${demoBlocksCount}`,
    )
  }

  const stateCoverageCount = (catalogContent.match(/stateCoverage:\s*\[/g) ?? []).length
  if (stateCoverageCount !== exampleIds.length) {
    pushViolation(
      'ui-kit-structure',
      catalogPath,
      `Every example must define stateCoverage. expected=${exampleIds.length} actual=${stateCoverageCount}`,
    )
  }

  for (const exampleId of exampleIds) {
    const marker = `exampleId === '${exampleId}'`
    const start = rendererContent.indexOf(marker)
    if (start < 0) {
      pushViolation('ui-kit-structure', rendererPath, `Missing renderer case for "${exampleId}"`)
      continue
    }

    const next = rendererContent.indexOf("exampleId === '", start + marker.length)
    const block = rendererContent.slice(start, next >= 0 ? next : undefined)

    const hasDefault = block.includes("column === 'default'")
    const hasVariants = block.includes("column === 'variants'")
    const hasStates = block.includes("column === 'states'")
    const hasLayoutFallback = block.includes('v-else')

    if (!hasDefault || !hasVariants || !hasStates || !hasLayoutFallback) {
      pushViolation(
        'ui-kit-structure',
        rendererPath,
        `Renderer "${exampleId}" must cover Default/Variants/States/Layout columns`,
      )
    }
  }
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

async function checkNoLegacyGlobalUiClasses() {
  const stylesPath = path.join(srcRoot, 'styles.css')
  const stylesContent = await fs.readFile(stylesPath, 'utf8')
  const forbiddenSelectors = [
    '.oc-button--',
    '.oc-input',
    '.oc-panel-stack',
    '.oc-panel-body',
    '.oc-panel-scroll-body',
  ]

  for (const selector of forbiddenSelectors) {
    if (stylesContent.includes(selector)) {
      pushViolation(
        'legacy-global-style',
        stylesPath,
        `Move "${selector}" out of global styles and into primitives/base`,
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
  await checkUiKitShowcaseStructure()
  await checkNoLegacyGlobalUiClasses()

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

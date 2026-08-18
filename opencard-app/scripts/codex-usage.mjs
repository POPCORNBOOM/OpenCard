import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, sep } from 'node:path'

const LONG_CONTEXT_THRESHOLD = 272_000
const PRICE_SOURCE = 'https://developers.openai.com/api/docs/pricing'
const PRICES_PER_MILLION = {
  'gpt-5.6-sol': {
    short: { input: 5, cachedInput: 0.5, output: 30 },
    long: { input: 10, cachedInput: 1, output: 45 },
  },
  'gpt-5.6-terra': {
    short: { input: 2, cachedInput: 0.2, output: 12 },
    long: { input: 4, cachedInput: 0.4, output: 18 },
  },
  'gpt-5.6-luna': {
    short: { input: 0.2, cachedInput: 0.02, output: 1.2 },
    long: { input: 0.4, cachedInput: 0.04, output: 1.8 },
  },
  'gpt-5.3-codex': {
    short: { input: 1.75, cachedInput: 0.175, output: 14 },
    long: { input: 1.75, cachedInput: 0.175, output: 14 },
  },
  'gpt-5.4': {
    short: { input: 2.5, cachedInput: 0.25, output: 15 },
    long: { input: 5, cachedInput: 0.5, output: 22.5 },
  },
  'gpt-5.5': {
    short: { input: 5, cachedInput: 0.5, output: 30 },
    long: { input: 10, cachedInput: 1, output: 45 },
  },
  'gpt-5.4-mini': {
    short: { input: 0.75, cachedInput: 0.075, output: 4.5 },
  },
}

const args = process.argv.slice(2)
const jsonOutput = args.includes('--json')
const projectArg = args.find(arg => arg !== '--json')
const projectPath = normalizePath(projectArg ?? process.cwd())
const codexRoot = resolve(process.env.CODEX_HOME ?? `${homedir()}/.codex`)
const logRoots = [resolve(codexRoot, 'sessions'), resolve(codexRoot, 'archived_sessions')]
const logFiles = logRoots.flatMap(root => existsSync(root) ? findJsonlFiles(root) : [])
const totalsByModel = new Map()
let taskCount = 0

for (const logFile of logFiles) {
  const task = readTask(logFile)
  if (!task || normalizePath(task.cwd) !== projectPath) continue

  taskCount += 1
  attributeTaskUsage(task, totalsByModel)
}

const rows = [...totalsByModel.values()]
  .map(row => ({ ...row, total: row.uncachedInput + row.cachedInput + row.output }))
  .sort((left, right) => right.total - left.total)

if (jsonOutput) {
  console.log(JSON.stringify({
    project: projectPath,
    tasks: taskCount,
    priceSource: PRICE_SOURCE,
    models: rows.map(row => ({ ...row, estimatedUsd: estimatePrice(row) })),
  }, null, 2))
} else {
  printTable(rows)
}

function normalizePath(path) {
  return resolve(path).split(sep).join('/').toLowerCase()
}

function findJsonlFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...findJsonlFiles(fullPath))
    else if (entry.name.endsWith('.jsonl')) files.push(fullPath)
  }
  return files
}

function readTask(logFile) {
  let cwd
  let currentModel = 'unknown'
  let finalUsage
  const snapshots = []

  for (const line of readFileSync(logFile, 'utf8').split(/\r?\n/)) {
    if (!line) continue

    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }

    if (event.type === 'session_meta') cwd = event.payload?.cwd
    if (event.type === 'turn_context') currentModel = event.payload?.model ?? currentModel
    if (event.type !== 'event_msg' || event.payload?.type !== 'token_count') continue

    const total = event.payload.info?.total_token_usage
    if (!total) continue

    snapshots.push({
      model: currentModel,
      tier: (event.payload.info?.last_token_usage?.input_tokens ?? 0) > LONG_CONTEXT_THRESHOLD
        ? 'long'
        : 'short',
      total,
    })
    finalUsage = total
  }

  return cwd && finalUsage ? { cwd, finalUsage, snapshots } : null
}

function attributeTaskUsage(task, destination) {
  const weights = new Map()
  let previous = emptyUsage()

  for (const snapshot of task.snapshots) {
    const key = `${snapshot.model}\0${snapshot.tier}`
    const weight = weights.get(key) ?? emptyRow(snapshot.model, snapshot.tier)
    const inputDelta = positiveDelta(snapshot.total.input_tokens, previous.input_tokens)
    const cachedDelta = positiveDelta(
      snapshot.total.cached_input_tokens,
      previous.cached_input_tokens,
    )

    weight.cachedInput += cachedDelta
    weight.uncachedInput += Math.max(0, inputDelta - cachedDelta)
    weight.output += positiveDelta(snapshot.total.output_tokens, previous.output_tokens)
    weight.reasoningOutput += positiveDelta(
      snapshot.total.reasoning_output_tokens,
      previous.reasoning_output_tokens,
    )
    weights.set(key, weight)
    previous = snapshot.total
  }

  const fallback = task.snapshots.at(-1)
  distribute(weights, destination, 'uncachedInput', Math.max(
    0,
    task.finalUsage.input_tokens - task.finalUsage.cached_input_tokens,
  ), fallback)
  distribute(weights, destination, 'cachedInput', task.finalUsage.cached_input_tokens, fallback)
  distribute(weights, destination, 'output', task.finalUsage.output_tokens, fallback)
  distribute(
    weights,
    destination,
    'reasoningOutput',
    task.finalUsage.reasoning_output_tokens,
    fallback,
  )
}

function distribute(weights, destination, field, authoritativeTotal, fallback) {
  const weightTotal = [...weights.values()].reduce((sum, row) => sum + row[field], 0)
  const sourceRows = weightTotal > 0
    ? [...weights.values()].filter(row => row[field] > 0)
    : [emptyRow(fallback.model, fallback.tier)]

  for (const source of sourceRows) {
    const key = `${source.model}\0${source.tier}`
    const target = destination.get(key) ?? emptyRow(source.model, source.tier)
    const ratio = weightTotal > 0 ? source[field] / weightTotal : 1
    target[field] += authoritativeTotal * ratio
    destination.set(key, target)
  }
}

function positiveDelta(current = 0, previous = 0) {
  return Math.max(0, current - previous)
}

function emptyUsage() {
  return {
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
  }
}

function emptyRow(model, tier) {
  return {
    model,
    tier,
    uncachedInput: 0,
    cachedInput: 0,
    output: 0,
    reasoningOutput: 0,
  }
}

function estimatePrice(row) {
  const price = PRICES_PER_MILLION[row.model]?.[row.tier]
  if (!price) return null

  return (
    row.uncachedInput * price.input
    + row.cachedInput * price.cachedInput
    + row.output * price.output
  ) / 1_000_000
}

function printTable(modelRows) {
  const tableRows = modelRows.map(row => ({
    Model: row.model,
    Tier: row.tier,
    'Uncached input': formatTokens(row.uncachedInput),
    'Cached input': formatTokens(row.cachedInput),
    Output: formatTokens(row.output),
    'Reasoning output': formatTokens(row.reasoningOutput),
    Total: formatTokens(row.total),
    'Est. USD': estimatePrice(row)?.toFixed(2) ?? 'n/a',
  }))
  const pricedTotal = modelRows.reduce((sum, row) => sum + (estimatePrice(row) ?? 0), 0)
  const unpricedModels = [...new Set(
    modelRows.filter(row => estimatePrice(row) == null).map(row => row.model),
  )]

  console.log(`Project: ${projectPath}`)
  console.log(`Tasks: ${taskCount}`)
  console.table(tableRows)
  console.log(`Priced subtotal: $${pricedTotal.toFixed(2)}`)
  if (unpricedModels.length > 0) {
    console.log(`Unpriced models: ${unpricedModels.join(', ')}`)
  }
  console.log(`Price source: ${PRICE_SOURCE}`)
  console.log('Cached input is included in input usage; reasoning output is included in output usage.')
}

function formatTokens(value) {
  return Math.round(value).toLocaleString('en-US')
}

import { createBlock, createCustomBlock, type CardBlock, type CardDocument, type CardFaceKey, type CardInstanceRecord } from '../../entities/card/model'
import { visitCardBlockTree } from '../../entities/card/tree'
import { parseRichTextHtml, type RichTextCustomBlockNode, type RichTextDocument, type RichTextNode } from '../../shared/rich-text/richTextHtml'
import type { ProjectInformation } from '../workspace/model/projectMetadata'
import { getProjectCustomBlockPublicFields } from '../workspace/services/projectCustomBlockPublicFields'
import { createCardPipelineIssue, type CardPipelineIssue } from './cardPipelineIssue'
import { expandCustomBlocks, wrapExpandedCustomBlocks, type CustomBlockRuntimeCatalog } from './expandCustomBlocks'
import { isRenderFieldValueValid, parseRenderDocument } from './renderParser'
import type { RenderReadyCardBlock, RenderReadyCustomBlock } from './render.types'
import { resolveReferences } from './resolveCardBindings'
import type { DeepReadonly } from 'vue'

const MAX_RICH_TEXT_EMBED_DEPTH = 12
const MAX_RICH_TEXT_EMBED_COUNT = 512

export type PreparedRichText = {
  document: RichTextDocument
  embeddedBlocks: ReadonlyMap<string, DeepReadonly<RenderReadyCustomBlock>>
  diagnostics: readonly CardPipelineIssue[]
  valid: boolean
}

export type PreparedRichTextCatalog = ReadonlyMap<string, PreparedRichText>

type RichTextHost = {
  block: CardBlock
  faceKey: CardFaceKey
  ancestors: readonly string[]
}

type EmbedWork = {
  host: RichTextHost
  node: RichTextCustomBlockNode
  identity: string
}

function customBlockNodes(nodes: readonly RichTextNode[]): RichTextCustomBlockNode[] {
  const result: RichTextCustomBlockNode[] = []
  const visit = (node: RichTextNode): void => {
    if (node.type === 'customBlock') result.push(node)
    else if (node.type === 'element') node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return result
}

function createProxy(host: RichTextHost, embeds: readonly EmbedWork[]): CardBlock {
  const proxy = createBlock('simple-container-block', {
    id: `rich-host:${host.block.id}`,
    width: host.block.width,
    height: host.block.height,
  })
  const source = host.block as unknown as Record<string, unknown>
  const target = proxy as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(source)) {
    if (key !== 'id' && key !== 'type' && key !== 'children') target[key] = structuredClone(value)
  }
  proxy.id = `rich-host:${host.block.id}`
  proxy.type = 'simple-container-block'
  proxy.children = embeds.map((embed, index) => {
    const instance = createCustomBlock({
      id: embed.identity,
      customBlockKey: embed.node.customBlockKey,
      name: embed.node.customBlockKey,
    })
    Object.assign(instance, embed.node.properties)
    return {
      block: instance,
      location: {
        id: `${embed.identity}::location`, type: 'simple-container-location' as const,
        anchor: 'lt' as const, x: '0px', y: `${index}px`,
      },
    }
  })
  return proxy
}

function findRenderBlock(root: RenderReadyCardBlock, id: string): RenderReadyCardBlock | null {
  if (root.id === id) return root
  if (root.type !== 'simple-container-block' && root.type !== 'flow-container-block') return null
  for (const child of root.children) {
    const found = findRenderBlock(child.block, id)
    if (found) return found
  }
  return null
}

function hasInvalidPublicFieldValue(
  block: CardBlock,
  catalogEntry: NonNullable<ReturnType<CustomBlockRuntimeCatalog['get']>>,
): boolean {
  const definitions = getProjectCustomBlockPublicFields(
    catalogEntry as unknown as Parameters<typeof getProjectCustomBlockPublicFields>[0],
  )
  const source = block as unknown as Record<string, unknown>
  return Object.entries(definitions).some(([fieldKey, definition]) => (
    Object.prototype.hasOwnProperty.call(source, fieldKey)
      && !isRenderFieldValueValid(source[fieldKey], definition)
  ))
}

function issueForHost(
  document: CardDocument,
  host: RichTextHost,
  type: CardPipelineIssue['type'],
  instanceId: string | null = null,
): CardPipelineIssue {
  return createCardPipelineIssue({
    type,
    location: {
      documentId: document.id, instanceId, faceKey: host.faceKey,
      owner: { kind: 'block', id: host.block.id }, blockId: host.block.id, fieldKey: 'content',
    },
  })
}

export function prepareRichText(options: {
  document: CardDocument
  currentCard?: CardInstanceRecord | null
  project?: Readonly<ProjectInformation> | null
  dictionary?: Readonly<Record<string, string>> | null
  customBlockCatalog?: CustomBlockRuntimeCatalog
}): { catalog: PreparedRichTextCatalog, issues: CardPipelineIssue[], rootParseCount: number, nestedParseCount: number, batchCount: number } {
  const customBlockCatalog = options.customBlockCatalog ?? new Map()
  const prepared = new Map<string, { document: RichTextDocument, embeddedBlocks: Map<string, RenderReadyCustomBlock>, diagnostics: CardPipelineIssue[], valid: boolean }>()
  const issues: CardPipelineIssue[] = []
  let rootParseCount = 0
  let nestedParseCount = 0
  let batchCount = 0
  let embedCount = 0
  const reportedHostIssues = new Set<string>()

  function reportHost(host: RichTextHost, type: CardPipelineIssue['type']): void {
    const identity = `${host.faceKey}\u0000${host.block.id}\u0000${type}`
    if (reportedHostIssues.has(identity)) return
    reportedHostIssues.add(identity)
    const issue = issueForHost(options.document, host, type, options.currentCard?.id ?? null)
    issues.push(issue)
    prepared.get(host.block.id)?.diagnostics.push(issue)
  }

  let hosts: RichTextHost[] = []
  for (const [faceKey, face] of Object.entries(options.document.faces) as [CardFaceKey, CardDocument['faces'][CardFaceKey]][]) {
    for (const child of face.children) visitCardBlockTree(child.block, block => {
      if (block.type === 'text-block') hosts.push({ block, faceKey, ancestors: [] })
    })
  }

  for (let depth = 0; hosts.length > 0 && depth <= MAX_RICH_TEXT_EMBED_DEPTH; depth += 1) {
    const nextHosts: RichTextHost[] = []
    const work: EmbedWork[] = []
    const grouped = new Map<string, EmbedWork[]>()

    for (const host of hosts) {
      if (depth === 0) rootParseCount += 1
      else nestedParseCount += 1
      const parsed = parseRichTextHtml(String((host.block as unknown as Record<string, unknown>).content ?? ''), {
        resolveCustomBlock: key => {
          const catalogEntry = customBlockCatalog.get(key.toLowerCase())
          return catalogEntry
            ? { publicFieldKeys: Object.keys(getProjectCustomBlockPublicFields(catalogEntry)) }
            : null
        },
      })
      const entry = {
        document: parsed.document,
        embeddedBlocks: new Map<string, RenderReadyCustomBlock>(),
        diagnostics: [] as CardPipelineIssue[],
        valid: parsed.canEnterVisualMode,
      }
      prepared.set(host.block.id, entry)
      if (!parsed.canEnterVisualMode) {
        reportHost(host, 'card-designer.rich-text.invalid-html')
        continue
      }
      for (const node of customBlockNodes(parsed.document.children)) {
        if (embedCount >= MAX_RICH_TEXT_EMBED_COUNT || depth >= MAX_RICH_TEXT_EMBED_DEPTH) {
          reportHost(host, 'card-designer.rich-text.limit-exceeded')
          continue
        }
        const keyIdentity = node.customBlockKey.toLowerCase()
        if (host.ancestors.includes(keyIdentity)) {
          reportHost(host, 'card-designer.custom-block.content-error')
          continue
        }
        const embed: EmbedWork = {
          host, node, identity: `${host.block.id}::embed:${node.embedId}`,
        }
        embedCount += 1
        work.push(embed)
        const list = grouped.get(host.block.id) ?? []
        list.push(embed)
        grouped.set(host.block.id, list)
      }
    }
    if (work.length === 0) break
    batchCount += 1

    const workDocument: CardDocument = {
      ...options.document,
      id: `${options.document.id}::rich-text:${depth}`,
      faces: Object.fromEntries((Object.entries(options.document.faces) as [CardFaceKey, CardDocument['faces'][CardFaceKey]][])
        .map(([faceKey, face]) => [faceKey, {
          ...face,
          children: hosts.filter(host => host.faceKey === faceKey && grouped.has(host.block.id)).map(host => ({
            block: createProxy(host, grouped.get(host.block.id) ?? []),
            location: { id: `rich-root:${host.block.id}`, type: 'simple-container-location', anchor: 'lt', x: '0px', y: '0px' },
          })),
        }])) as CardDocument['faces'],
      instances: [],
    }
    const expanded = expandCustomBlocks(workDocument, customBlockCatalog)
    const resolved = resolveReferences(expanded.document, {
      currentCard: options.currentCard,
      project: options.project,
      dictionary: options.dictionary,
    })
    const parsed = parseRenderDocument(resolved.document)
    const wrapped = wrapExpandedCustomBlocks(parsed.document, expanded.hosts)
    const hostForRuntimeId = (runtimeId: string | null): RichTextHost | null => {
      if (!runtimeId) return null
      const embed = work.find(candidate => runtimeId === candidate.identity || runtimeId.startsWith(`${candidate.identity}::`))
      if (embed) return embed.host
      return hosts.find(host => runtimeId === `rich-host:${host.block.id}` || runtimeId.startsWith(`rich-host:${host.block.id}::`)) ?? null
    }
    for (const issue of [...resolved.issues, ...parsed.issues]) {
      const host = hostForRuntimeId(issue.location.blockId ?? issue.location.owner.id)
      if (host) reportHost(host, 'card-designer.custom-block.content-error')
    }
    for (const issue of expanded.issues) {
      const host = hostForRuntimeId(issue.blockId)
      if (host) reportHost(host, issue.reason === 'missing'
        ? 'card-designer.custom-block.unavailable'
        : 'card-designer.custom-block.content-error')
    }
    for (const [blockId, expansionHost] of expanded.hosts) {
      if (!expansionHost.hasResourceErrors) continue
      const host = hostForRuntimeId(blockId)
      if (host) reportHost(host, 'card-designer.custom-block.resource-error')
    }

    for (const embed of work) {
      const catalogEntry = customBlockCatalog.get(embed.node.customBlockKey.toLowerCase())
      if (catalogEntry) {
        const projectedProperties = createCustomBlock({ id: embed.identity, customBlockKey: embed.node.customBlockKey })
        Object.assign(projectedProperties, embed.node.properties)
        if (hasInvalidPublicFieldValue(projectedProperties, catalogEntry)) {
          reportHost(embed.host, 'card-designer.custom-block.content-error')
          continue
        }
      }
      const face = wrapped.faces[embed.host.faceKey]
      const proxy = face.children.map(child => child.block).find(block => block.id === `rich-host:${embed.host.block.id}`)
      const block = proxy ? findRenderBlock(proxy, embed.identity) : null
      if (block?.type !== 'custom-block') continue
      prepared.get(embed.host.block.id)?.embeddedBlocks.set(embed.node.embedId, block)

      const sourceProxy = resolved.document.faces[embed.host.faceKey].children
        .map(child => child.block).find(block => block.id === `rich-host:${embed.host.block.id}`)
      if (!sourceProxy) continue
      let sourceEmbed: CardBlock | null = null
      visitCardBlockTree(sourceProxy, candidate => { if (candidate.id === embed.identity) sourceEmbed = candidate })
      if (!sourceEmbed) continue
      visitCardBlockTree(sourceEmbed, candidate => {
        if (candidate.type === 'text-block') nextHosts.push({
          block: candidate,
          faceKey: embed.host.faceKey,
          ancestors: [...embed.host.ancestors, embed.node.customBlockKey.toLowerCase()],
        })
      })
    }
    hosts = nextHosts
  }

  return { catalog: prepared, issues, rootParseCount, nestedParseCount, batchCount }
}

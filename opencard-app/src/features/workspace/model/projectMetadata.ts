import type { EditorPropertyDefinition } from '../../../entities/card/schema'

export const PROJECT_PROFILE_FILE_NAME = '.ocproject'

export type ProjectRemoteResourcePolicy =
  | { mode: 'deny' }
  | { mode: 'allowlist'; allowedHosts: readonly string[] }
  | { mode: 'allow-all' }

export type ProjectProfile = {
  name?: string
  description?: string
  version?: string
  remoteResources?: ProjectRemoteResourcePolicy
}

export type ProjectInformation = {
  name: string
  description: string
  version: string
}

export const projectPropertySchema = {
  name: { fieldType: 'string', categoryId: 'identity', acceptsBinding: false },
  description: { fieldType: 'string', multiline: true, categoryId: 'identity', acceptsBinding: false },
  version: { fieldType: 'string', categoryId: 'identity', acceptsBinding: false },
} as const satisfies Record<string, EditorPropertyDefinition>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeProjectAllowedHost(value: string): string | null {
  const host = value.trim().toLowerCase().replace(/\.$/, '')
  const baseHost = host.startsWith('*.') ? host.slice(2) : host
  if (!baseHost || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(baseHost)) {
    return null
  }
  return host.startsWith('*.') ? `*.${baseHost}` : baseHost
}

function parseRemoteResourcePolicy(value: unknown): ProjectRemoteResourcePolicy | null {
  if (!isRecord(value) || Object.keys(value).some(key => !['mode', 'allowedHosts'].includes(key))) return null
  if (value.mode === 'deny' || value.mode === 'allow-all') {
    if (value.allowedHosts !== undefined) return null
    return { mode: value.mode }
  }
  if (value.mode !== 'allowlist' || !Array.isArray(value.allowedHosts)) return null

  const allowedHosts: string[] = []
  for (const candidate of value.allowedHosts) {
    if (typeof candidate !== 'string') return null
    const host = normalizeProjectAllowedHost(candidate)
    if (!host) return null
    if (!allowedHosts.includes(host)) allowedHosts.push(host)
  }
  return { mode: 'allowlist', allowedHosts }
}

export function parseProjectMetadata(value: unknown): ProjectProfile | null {
  if (!isRecord(value)) return null

  if (['name', 'description', 'version'].some(key => value[key] !== undefined && typeof value[key] !== 'string')) return null

  const profile: ProjectProfile = {}
  if (typeof value.name === 'string' && value.name !== '') profile.name = value.name
  if (typeof value.description === 'string' && value.description !== '') profile.description = value.description
  if (typeof value.version === 'string' && value.version !== '') profile.version = value.version
  if (value.remoteResources !== undefined) {
    const remoteResources = parseRemoteResourcePolicy(value.remoteResources)
    if (!remoteResources) return null
    profile.remoteResources = remoteResources
  }
  return profile
}

export function parseProjectMetadataText(content: string): ProjectProfile | null {
  try {
    return parseProjectMetadata(JSON.parse(content))
  } catch {
    return null
  }
}

export function serializeProjectMetadata(profile: ProjectProfile): string {
  const normalized = parseProjectMetadata(profile)
  if (!normalized) throw new Error('Invalid project profile')
  return JSON.stringify(normalized, null, 2)
}

export function toProjectInformation(profile: ProjectProfile): ProjectInformation {
  return {
    name: profile.name ?? '',
    description: profile.description ?? '',
    version: profile.version ?? '',
  }
}

export function createDefaultProjectInformation(name = ''): ProjectInformation {
  return { name, description: '', version: '' }
}

export function getProjectFieldDefinition(fieldKey: string): EditorPropertyDefinition | undefined {
  return projectPropertySchema[fieldKey as keyof typeof projectPropertySchema]
}

export function getProjectFieldKeys(project: Readonly<ProjectInformation>): string[] {
  return ['name', 'description', 'version'].filter(key => Object.prototype.hasOwnProperty.call(project, key))
}

export function getProjectFieldValueKind(_project: Readonly<ProjectInformation>, fieldKey: string) {
  return getProjectFieldDefinition(fieldKey) ? 'string' as const : 'object' as const
}

export function exposesProjectFieldReference(_project: Readonly<ProjectInformation>, fieldKey: string): boolean {
  return Boolean(getProjectFieldDefinition(fieldKey))
}

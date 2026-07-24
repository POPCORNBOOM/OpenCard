import type { EditorPropertyDefinition } from '../../../entities/card/schema'

export const PROJECT_PROFILE_FILE_NAME = '.opencardprojectprofile'

export type ProjectProfile = {
  name?: string
  description?: string
  version?: string
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

export function parseProjectMetadata(value: unknown): ProjectProfile | null {
  if (!isRecord(value)) return null

  const allowedKeys = new Set(['name', 'description', 'version'])
  if (Object.keys(value).some(key => !allowedKeys.has(key))) return null
  if (Object.values(value).some(field => typeof field !== 'string')) return null

  const profile: ProjectProfile = {}
  if (typeof value.name === 'string' && value.name !== '') profile.name = value.name
  if (typeof value.description === 'string' && value.description !== '') profile.description = value.description
  if (typeof value.version === 'string' && value.version !== '') profile.version = value.version
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

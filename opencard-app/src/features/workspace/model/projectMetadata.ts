import type {
  AdditionalFieldDefinitionMap,
  AdditionalFieldKeyError,
  EditorPropertyDefinition,
  PropertyFieldType,
} from '../../../entities/card/schema'
import {
  additionalFieldTypes,
  createPropertyDefaultValue,
  parseAdditionalFieldDefinitions,
  validateAdditionalFieldKey,
} from '../../../entities/card/schema'

export const PROJECT_CONFIG_FILE_NAME = '.opencardproject'
export const PROJECT_METADATA_VERSION = 1 as const

export type ProjectInformation = Record<string, unknown> & {
  name: string
  description: string
  entry: string
  additionalFieldDefinition?: AdditionalFieldDefinitionMap
}

export const projectPropertySchema = {
  name: {
    fieldType: 'string',
    categoryId: 'identity',
    acceptsBinding: false,
  },
  description: {
    fieldType: 'string',
    multiline: true,
    categoryId: 'content',
    acceptsBinding: false,
  },
  entry: {
    fieldType: 'filePath',
    categoryId: 'data',
    acceptsBinding: false,
    exposesReference: false,
    extensionsFilter: ['.opencard'],
  },
  additionalFieldDefinition: {
    fieldType: 'object',
    objectType: 'AdditionalFieldDefinition',
    isHidden: true,
    acceptsBinding: false,
    exposesReference: false,
  },
} as const satisfies Record<string, EditorPropertyDefinition>

export type PersistedProjectEntry = {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

export type ProjectWorkspaceState = {
  indexedEntries: PersistedProjectEntry[]
  expandedDirectories: string[]
}

export type ProjectMetadata = {
  version: typeof PROJECT_METADATA_VERSION
  project: ProjectInformation
  workspace: ProjectWorkspaceState
}

export function createDefaultProjectInformation(name = ''): ProjectInformation {
  return {
    name,
    description: '',
    entry: 'main.opencard',
  }
}

export function createProjectAdditionalField(
  project: ProjectInformation,
  fieldKeyInput: string,
  fieldType: PropertyFieldType,
  titleInput?: string,
): AdditionalFieldKeyError | null {
  if (!additionalFieldTypes.includes(fieldType as (typeof additionalFieldTypes)[number])) {
    return 'unsupported-field-type'
  }
  const error = validateAdditionalFieldKey(project, Object.keys(projectPropertySchema), fieldKeyInput)
  if (error) return error

  const fieldKey = fieldKeyInput.trim()
  const title = titleInput?.trim() ?? ''
  const definitions = project.additionalFieldDefinition ?? (project.additionalFieldDefinition = {})
  definitions[fieldKey] = {
    fieldType,
    ...(title ? { title } : {}),
  }
  project[fieldKey] = createPropertyDefaultValue({ fieldType } as EditorPropertyDefinition)
  return null
}

export function deleteProjectAdditionalField(project: ProjectInformation, fieldKey: string): boolean {
  if (!project.additionalFieldDefinition?.[fieldKey]) return false
  delete project[fieldKey]
  delete project.additionalFieldDefinition[fieldKey]
  if (Object.keys(project.additionalFieldDefinition).length === 0) {
    delete project.additionalFieldDefinition
  }
  return true
}

export function parseProjectMetadata(value: unknown): ProjectMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  if (source.version !== PROJECT_METADATA_VERSION) return null

  const project = source.project
  const workspace = source.workspace
  if (!project || typeof project !== 'object' || Array.isArray(project)) return null
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) return null

  const projectSource = project as Record<string, unknown>
  const workspaceSource = workspace as Record<string, unknown>
  if (
    typeof projectSource.name !== 'string'
    || typeof projectSource.description !== 'string'
    || typeof projectSource.entry !== 'string'
    || !Array.isArray(workspaceSource.indexedEntries)
    || !Array.isArray(workspaceSource.expandedDirectories)
  ) return null

  const nativeProjectKeys = Object.keys(projectPropertySchema)
  const additionalFieldDefinition = parseAdditionalFieldDefinitions(
    projectSource.additionalFieldDefinition,
    nativeProjectKeys,
  )
  const parsedProject: ProjectInformation = {
    name: projectSource.name,
    description: projectSource.description,
    entry: projectSource.entry,
  }

  for (const fieldKey of Object.keys(additionalFieldDefinition)) {
    const fieldValue = projectSource[fieldKey]
    if (typeof fieldValue === 'string') parsedProject[fieldKey] = fieldValue
  }

  if (Object.keys(additionalFieldDefinition).length > 0) {
    parsedProject.additionalFieldDefinition = additionalFieldDefinition
  }

  const indexedEntries = workspaceSource.indexedEntries
    .filter((entry): entry is PersistedProjectEntry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
      const candidate = entry as Record<string, unknown>
      return typeof candidate.name === 'string'
        && typeof candidate.isDirectory === 'boolean'
        && typeof candidate.isFile === 'boolean'
        && typeof candidate.isSymlink === 'boolean'
    })
    .map((entry) => ({ ...entry }))

  const expandedDirectories = workspaceSource.expandedDirectories
    .filter((path): path is string => typeof path === 'string')

  return {
    version: PROJECT_METADATA_VERSION,
    project: parsedProject,
    workspace: { indexedEntries, expandedDirectories },
  }
}

export function parseProjectMetadataText(content: string): ProjectMetadata | null {
  try {
    return parseProjectMetadata(JSON.parse(content))
  } catch {
    return null
  }
}

export function serializeProjectMetadata(metadata: ProjectMetadata): string {
  return JSON.stringify(metadata, null, 2)
}

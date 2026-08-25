import type { PropertyFieldType } from '../../../entities/card/schema'
import type { ProjectCustomBlockDefinition, ProjectCustomBlockDefinitionCatalogEntry } from '../services/projectCustomBlockDefinition'

export const PROJECT_CUSTOM_BLOCK_EXTENSION = 'ocblock'
export const PROJECT_CUSTOM_BLOCK_SUFFIX = `.${PROJECT_CUSTOM_BLOCK_EXTENSION}`
export const PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS = ['name', 'notes'] as const

export type ProjectCustomBlockPublicField = {
  key: string
  fieldType: PropertyFieldType
  title?: string
  defaultValue?: string
}

export type ProjectCustomBlockResizePolicy = {
  widthLocked: boolean
  heightLocked: boolean
}

export type ProjectCustomBlockIssue = {
  code:
    | 'resource-unavailable'
    | 'host-dependency'
    | 'dependency-unavailable'
    | 'dependency-cycle'
    | 'package-structure-ignored'
  path: string
  message: string
}

export type ProjectCustomBlockCatalogEntry = ProjectCustomBlockDefinitionCatalogEntry & {
  definition: ProjectCustomBlockDefinition
  hasResourceErrors?: boolean
}

export type ProjectCustomBlockCatalog = ReadonlyMap<string, ProjectCustomBlockCatalogEntry>

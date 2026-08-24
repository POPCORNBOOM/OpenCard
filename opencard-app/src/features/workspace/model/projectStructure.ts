export const PROJECT_INTERNAL_DIRECTORY_NAME = '.opencard'

export const PROJECT_PROFILE_FILE_NAME = `${PROJECT_INTERNAL_DIRECTORY_NAME}/project.json`
export const PROJECT_FONT_REGISTRY_FILE_NAME = `${PROJECT_INTERNAL_DIRECTORY_NAME}/fonts/fonts.json`
export const PROJECT_ICON_REGISTRY_FILE_NAME = `${PROJECT_INTERNAL_DIRECTORY_NAME}/icons/icons.json`
export const PROJECT_DICTIONARY_FILE_NAME = `${PROJECT_INTERNAL_DIRECTORY_NAME}/locale.json`
export const PROJECT_PACKAGE_MANIFEST_FILE_NAME = `${PROJECT_INTERNAL_DIRECTORY_NAME}/packages/packages.json`
export const PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME = `${PROJECT_INTERNAL_DIRECTORY_NAME}/blocks/blocks.json`

export const PROJECT_FONT_DIRECTORY = 'fonts'
export const PROJECT_ICON_DIRECTORY = 'icons'
export const PROJECT_CUSTOM_BLOCK_DIRECTORY = 'blocks'
export const PROJECT_PACKAGE_DIRECTORY = 'packages'

export const PROJECT_INTERNAL_FILE_DEFAULTS = Object.freeze({
  [PROJECT_PROFILE_FILE_NAME]: '{}\n',
  [PROJECT_FONT_REGISTRY_FILE_NAME]: '{}\n',
  [PROJECT_ICON_REGISTRY_FILE_NAME]: '{}\n',
  [PROJECT_DICTIONARY_FILE_NAME]: '{}\n',
  [PROJECT_PACKAGE_MANIFEST_FILE_NAME]: '{\n  "type": "opencard-project-packages",\n  "packages": []\n}\n',
  [PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME]: '{}\n',
})

export const PROJECT_INTERNAL_DIRECTORIES = Object.freeze([
  `${PROJECT_INTERNAL_DIRECTORY_NAME}/${PROJECT_FONT_DIRECTORY}`,
  `${PROJECT_INTERNAL_DIRECTORY_NAME}/${PROJECT_ICON_DIRECTORY}`,
  `${PROJECT_INTERNAL_DIRECTORY_NAME}/${PROJECT_CUSTOM_BLOCK_DIRECTORY}`,
  `${PROJECT_INTERNAL_DIRECTORY_NAME}/${PROJECT_PACKAGE_DIRECTORY}`,
])

export function resolveProjectInternalRelativePath(path = ''): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  return normalized ? `${PROJECT_INTERNAL_DIRECTORY_NAME}/${normalized}` : PROJECT_INTERNAL_DIRECTORY_NAME
}

export function isProjectInternalRelativePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  return normalized === PROJECT_INTERNAL_DIRECTORY_NAME
    || normalized.startsWith(`${PROJECT_INTERNAL_DIRECTORY_NAME}/`)
}

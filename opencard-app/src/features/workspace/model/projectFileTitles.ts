/** Editor list titles for the managed project files, keyed by file type so path patterns stay in fileTypes. */
export const PROJECT_FILE_TYPE_TITLE_KEYS: Readonly<Record<string, string>> = {
  'opencard-project-profile': 'projectConfig.title',
  'opencard-dictionary': 'dictionaryEditor.title',
  'opencard-font-registry': 'fontRegistry.title',
  'opencard-icon-registry': 'iconRegistry.title',
  'opencard-project-package-manifest': 'packageManager.title',
}

/** Projects application settings into key-only tree and row view models. */
import { computed, type ComputedRef, type DeepReadonly, type Ref } from 'vue'
import type { OcTreeData } from '../../../shared/ui/tree/tree.types'
import type {
  EditorItem,
  EditorItemActionPart,
  EditorItemEditorPart,
  PropertyCompletionProvider,
  PropertyEditorFieldDefinition,
} from '../../../shared/ui/property-editor/propertyEditor.types'
import {
  OC_THEME_REGISTRY,
  type OcEditableThemeColorKey,
  type OcThemeId,
} from '../../../shared/ui/foundation'
import {
  APP_THEME_PRESETS,
  MAX_CUSTOM_BLOCK_MAX_DEPTH,
  MAX_AUTO_SAVE_INTERVAL_SECONDS,
  MAX_PHASE_IMAGE_SPEED,
  MAX_TITLE_BAR_NOTICE_HISTORY_LIMIT,
  MIN_CUSTOM_BLOCK_MAX_DEPTH,
  MIN_AUTO_SAVE_INTERVAL_SECONDS,
  MIN_PHASE_IMAGE_SPEED,
  MIN_TITLE_BAR_NOTICE_HISTORY_LIMIT,
  resolveThemePresetId,
  type AppSettings,
  type AppThemePresetId,
  type SettingsCategoryKey,
} from '../model/appSettings'

export interface SettingsCategoryViewModel {
  key: SettingsCategoryKey
  title: string
  items: readonly EditorItem[]
  preview?: {
    glassIntensity: number
  }
}

interface UseSettingsWorkspaceOptions {
  settings: Readonly<Ref<DeepReadonly<AppSettings>>>
  categoryKey: Readonly<Ref<SettingsCategoryKey>>
  projectOpen: Readonly<Ref<boolean>>
  systemFontFamilies?: Readonly<Ref<readonly string[]>>
  translate: (key: string, fallback: string) => string
}

function editorPart(
  key: string,
  definition: PropertyEditorFieldDefinition,
  value: unknown,
): EditorItemEditorPart {
  return { type: 'editor', key, definition, value }
}

function fieldItem(
  key: string,
  definition: PropertyEditorFieldDefinition,
  value: unknown,
): EditorItem {
  return { key, title: definition.title, content: [editorPart('value', definition, value)] }
}

function actionPart(
  key: string,
  title: string,
  icon: EditorItemActionPart['icon'],
  options?: { iconOnly?: boolean; disabled?: boolean },
): EditorItemActionPart {
  return {
    type: 'action',
    key,
    title,
    icon,
    iconOnly: options?.iconOnly ?? false,
    variant: 'outline',
    size: 'sm',
    disabled: options?.disabled,
  }
}

const CATEGORY_KEYS: readonly SettingsCategoryKey[] = ['general', 'appearance', 'workspace']

export function useSettingsWorkspace(
  options: UseSettingsWorkspaceOptions,
): {
  categoryTreeData: ComputedRef<OcTreeData>
  activeCategory: ComputedRef<SettingsCategoryViewModel>
} {
  const categoryLabels = computed<Record<SettingsCategoryKey, string>>(() => ({
    general: options.translate('settings.categories.general', 'General'),
    appearance: options.translate('settings.categories.appearance', 'Appearance'),
    workspace: options.translate('settings.categories.workspace', 'Workspace'),
  }))
  const systemFontFamilies = computed(() => options.systemFontFamilies?.value ?? [])

  const categoryTreeData = computed<OcTreeData>(() => ({
    rootKeys: CATEGORY_KEYS,
    items: new Map([
      ['general', { label: categoryLabels.value.general, icon: 'tool.settings' }],
      ['appearance', { label: categoryLabels.value.appearance, icon: 'data.symbol-color' }],
      ['workspace', { label: categoryLabels.value.workspace, icon: 'nav.files' }],
    ]),
    children: new Map(),
  }))

  const activeCategory = computed<SettingsCategoryViewModel>(() => {
    const categoryKey = options.categoryKey.value
    const settings = options.settings.value

    if (categoryKey === 'general') {
      return {
        key: categoryKey,
        title: categoryLabels.value.general,
        items: [
          fieldItem('appearance.locale', {
            title: options.translate('settings.fields.language', 'Language'),
            fieldType: 'string',
            presentation: 'option-group',
            options: ['system', 'zh-CN', 'en-US'],
            optionLabels: {
              system: options.translate('settings.values.systemLanguage', 'System'),
              'zh-CN': '简体中文',
              'en-US': 'English',
            },
          }, settings.appearance.locale),
          fieldItem('shell.titleBarNoticeHistoryLimit', {
            title: options.translate('settings.fields.titleBarNoticeHistoryLimit', 'Instant message history limit'),
            fieldType: 'number', presentation: 'slider',
            min: MIN_TITLE_BAR_NOTICE_HISTORY_LIMIT, max: MAX_TITLE_BAR_NOTICE_HISTORY_LIMIT, step: 1,
            ticks: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
            suffix: options.translate('settings.values.messages', ' messages'),
          }, settings.shell.titleBarNoticeHistoryLimit),
          fieldItem('updates.suppressReleaseNotesAfterUpdate', {
            title: options.translate('settings.fields.suppressReleaseNotesAfterUpdate', 'Do not show release notes after an update'),
            fieldType: 'boolean',
          }, settings.updates.suppressReleaseNotesAfterUpdate),
          fieldItem('exporting.openCdeWorkbookAfterExport', {
            title: options.translate('settings.fields.openCdeWorkbookAfterExport', 'Open CDE workbook after export'),
            fieldType: 'boolean',
          }, settings.exporting.openCdeWorkbookAfterExport),
        ],
      }
    }

    if (categoryKey === 'appearance') {
      const presetLabel = (themeId: OcThemeId, presetId: AppThemePresetId): string => {
        if (presetId === 'default') {
          return themeId === 'dark'
            ? options.translate('settings.values.openCardDarkTheme', 'OpenCard Dark')
            : options.translate('settings.values.openCardLightTheme', 'OpenCard Light')
        }
        const labels: Record<Exclude<AppThemePresetId, 'default'>, [string, string]> = {
          'grass-block': ['grassBlockTheme', 'Grass Block'],
          'deep-sea': ['deepSeaTheme', 'Deep Sea'],
          ember: ['emberTheme', 'Ember'],
          'ink-bamboo': ['inkBambooTheme', 'Ink Bamboo'],
          'morning-mist': ['morningMistTheme', 'Morning Mist'],
          'sakura-paper': ['sakuraPaperTheme', 'Sakura Paper'],
          dune: ['duneTheme', 'Dune'],
          mint: ['mintTheme', 'Mint'],
        }
        const [key, fallback] = labels[presetId]
        return options.translate(`settings.values.${key}`, fallback)
      }
      const fontCompletion: PropertyCompletionProvider = ({ value, cursor }) => {
        const start = value.lastIndexOf(';', Math.max(0, cursor - 1)) + 1
        const nextSeparator = value.indexOf(';', cursor)
        const end = nextSeparator < 0 ? value.length : nextSeparator
        const fragment = value.slice(start, cursor).trim().toLocaleLowerCase()
        return {
          replaceStart: start,
          replaceEnd: end,
          items: systemFontFamilies.value
            .filter(font => !fragment || font.toLocaleLowerCase().includes(fragment))
            .map(font => ({
              key: font,
              label: font,
              labelStyle: { fontFamily: font },
              insertText: start > 0 ? ` ${font}` : font,
            })),
        }
      }
      const themeItem = (themeId: OcThemeId): EditorItem => {
        const presetValue = resolveThemePresetId(
          themeId,
          settings.appearance.themeOverrides[themeId],
          settings.appearance.accentNeighborAngles[themeId],
          settings.appearance.fontFamilies[themeId],
          settings.appearance.userThemePresets[themeId],
        )
        const presetOptions = [
          ...APP_THEME_PRESETS[themeId].map(presetId => ({ value: presetId, label: presetLabel(themeId, presetId) })),
          ...settings.appearance.userThemePresets[themeId].map(preset => ({
            value: `user:${preset.name}`,
            label: `${preset.name} ${options.translate('settings.values.importedTheme', 'Imported')}`,
          })),
        ]
        const colorItems: EditorItem[] = [
          ['accentColor', 'Theme color', '--oc-accent'],
          ['baseBackgroundColor', 'Background', '--oc-bg-base'],
          ['primaryTextColor', 'Foreground', '--oc-fg-default'],
        ].map(([key, fallback, token]) => {
          const colorToken = token as OcEditableThemeColorKey
          const title = options.translate(`settings.fields.${key}`, fallback)
          return fieldItem(`color:${colorToken}`, {
            title, fieldType: 'color', allowAlpha: false,
            defaultValue: settings.appearance.themeOverrides[themeId][colorToken] ?? null,
          }, settings.appearance.themeOverrides[themeId][colorToken] ?? OC_THEME_REGISTRY[themeId][colorToken])
        })
        return {
          key: `theme:${themeId}`,
          title: options.translate(`settings.fields.${themeId}ThemeColors`, themeId === 'dark' ? 'Dark theme' : 'Light theme'),
          children: [
            {
              key: 'preset',
              title: options.translate('settings.fields.themePreset', 'Preset'),
              content: [
                editorPart('value', {
                  title: options.translate('settings.fields.themePreset', 'Preset'),
                  fieldType: 'string', presentation: 'select',
                  options: presetOptions.map(option => option.value),
                  optionLabels: Object.fromEntries(presetOptions.map(option => [option.value, option.label])),
                  placeholder: options.translate('settings.values.selectThemePreset', 'Select preset'),
                }, presetValue),
                actionPart('import', options.translate('settings.actions.importTheme', 'Import theme'), 'action.import', { iconOnly: true }),
                actionPart('export', options.translate('settings.actions.exportTheme', 'Export theme'), 'action.export', { iconOnly: true }),
                actionPart('delete', options.translate('settings.actions.deleteThemePreset', 'Delete imported theme'), 'action.delete', {
                  iconOnly: true, disabled: !presetValue.startsWith('user:'),
                }),
              ],
            },
            ...colorItems,
            fieldItem('font', {
              title: options.translate('settings.fields.uiFont', 'UI font'),
              fieldType: 'string', commitMode: 'blur',
              placeholder: options.translate('settings.values.systemFont', 'System'),
              completion: { provider: fontCompletion },
            }, settings.appearance.fontFamilies[themeId] === 'system' ? '' : settings.appearance.fontFamilies[themeId]),
            fieldItem('angle', {
              title: options.translate('settings.fields.accentNeighborAngle', 'Secondary color phase angle'),
              fieldType: 'number', presentation: 'slider', min: -180, max: 180, step: 1, suffix: '°',
            }, settings.appearance.accentNeighborAngles[themeId]),
          ],
        }
      }

      return {
        key: categoryKey,
        title: categoryLabels.value.appearance,
        preview: { glassIntensity: settings.appearance.glassIntensity },
        items: [
          fieldItem('appearance.theme', {
            title: options.translate('settings.fields.theme', 'Theme'),
            fieldType: 'string', presentation: 'option-group',
            options: ['system', 'dark', 'light'],
            optionLabels: {
              system: options.translate('settings.values.systemTheme', 'System'),
              dark: options.translate('settings.values.dark', 'Dark'),
              light: options.translate('settings.values.light', 'Light'),
            },
          }, settings.appearance.theme),
          fieldItem('appearance.baseFontSize', {
            title: options.translate('settings.fields.baseFontSize', 'Base font size'),
            fieldType: 'number', presentation: 'slider', min: 10, max: 16, step: 1,
            ticks: [10, 11, 12, 13, 14, 15, 16], suffix: 'px',
          }, settings.appearance.baseFontSize),
          fieldItem('appearance.phaseImageSpeed', {
            title: options.translate('settings.fields.phaseImageSpeed', 'Phase animation speed'),
            fieldType: 'number', presentation: 'slider',
            min: MIN_PHASE_IMAGE_SPEED, max: MAX_PHASE_IMAGE_SPEED, step: 5, suffix: '%',
          }, settings.appearance.phaseImageSpeed),
          themeItem('dark'),
          themeItem('light'),
          fieldItem('appearance.glassIntensity', {
            title: options.translate('settings.fields.glassIntensity', 'Glass intensity'),
            fieldType: 'number', presentation: 'slider', min: 0, max: 100, step: 1, suffix: '%',
          }, settings.appearance.glassIntensity),
          {
            key: 'themes.reset',
            title: options.translate('settings.fields.themeSettings', 'Theme settings'),
            content: [actionPart('invoke', options.translate('settings.actions.resetThemes', 'Reset themes'), 'action.restart')],
          },
        ],
      }
    }

    return {
      key: categoryKey,
      title: categoryLabels.value.workspace,
      items: [
        fieldItem('workspace.autoSave', {
          title: options.translate('settings.fields.autoSave', 'Automatically save opened files'), fieldType: 'boolean',
        }, settings.workspace.autoSave),
        fieldItem('workspace.autoSaveIntervalSeconds', {
          title: options.translate('settings.fields.autoSaveInterval', 'Auto-save interval'),
          fieldType: 'number', presentation: 'slider',
          min: MIN_AUTO_SAVE_INTERVAL_SECONDS, max: MAX_AUTO_SAVE_INTERVAL_SECONDS, step: 1,
          ticks: [5, 15, 30, 60, 120, 300],
          suffix: options.translate('settings.values.seconds', ' seconds'),
        }, settings.workspace.autoSaveIntervalSeconds),
        fieldItem('workspace.historyEntryLimit', {
          title: options.translate('settings.fields.historyEntryLimit', 'History entries per editor'),
          fieldType: 'number', presentation: 'slider', min: 10, max: 1000, step: 10,
          ticks: [10, 50, 100, 250, 500, 1000],
          suffix: options.translate('settings.values.historyEntries', ' entries'),
        }, settings.workspace.historyEntryLimit),
        fieldItem('workspace.customBlockMaxDepth', {
          title: options.translate('settings.fields.customBlockMaxDepth', 'Maximum custom block recursion depth'),
          fieldType: 'number', presentation: 'slider',
          min: MIN_CUSTOM_BLOCK_MAX_DEPTH, max: MAX_CUSTOM_BLOCK_MAX_DEPTH, step: 1,
          ticks: [1, 2, 4, 8, 16, 32, 64],
          suffix: options.translate('settings.values.recursionLevels', ' levels'),
        }, settings.workspace.customBlockMaxDepth),
        fieldItem('workspace.structureTreeSelectionBehavior', {
          title: options.translate('settings.fields.structureTreeSelectionBehavior', 'Structure tree selection'),
          fieldType: 'string', presentation: 'option-group',
          options: ['expand-exclusive', 'expand', 'none'],
          optionLabels: {
            'expand-exclusive': options.translate('settings.values.expandExclusive', 'Expand and collapse others'),
            expand: options.translate('settings.values.expand', 'Expand ancestors'),
            none: options.translate('settings.values.noAutoExpand', 'Do not expand'),
          },
        }, settings.workspace.structureTreeSelectionBehavior),
        fieldItem('workspace.structureTreeScrollToSelection', {
          title: options.translate('settings.fields.structureTreeScrollToSelection', 'Scroll to selected block'), fieldType: 'boolean',
        }, settings.workspace.structureTreeScrollToSelection),
        fieldItem('workspace.hideDotFiles', {
          title: options.translate('settings.fields.hideDotFiles', 'Hide files and folders whose names start with a dot'), fieldType: 'boolean',
        }, settings.workspace.hideDotFiles),
        fieldItem('workspace.showSelectionPositionOnMove', {
          title: options.translate('settings.fields.showSelectionPositionOnMove', 'Show anchor and X/Y guides while moving blocks'), fieldType: 'boolean',
        }, settings.workspace.showSelectionPositionOnMove),
        fieldItem('workspace.showSelectionSizeOnResize', {
          title: options.translate('settings.fields.showSelectionSizeOnResize', 'Show width and height labels while resizing blocks'), fieldType: 'boolean',
        }, settings.workspace.showSelectionSizeOnResize),
        fieldItem('workspace.alignmentSnappingEnabledByDefault', {
          title: options.translate('settings.fields.alignmentSnappingEnabledByDefault', 'Enable alignment snapping by default'), fieldType: 'boolean',
        }, settings.workspace.alignmentSnappingEnabledByDefault),
        {
          key: 'project-workspace.reset',
          title: options.translate('settings.fields.projectWorkspaceState', 'Project workspace state'),
          content: [actionPart('invoke', options.translate('settings.actions.reset', 'Reset'), 'action.restart', {
            disabled: !options.projectOpen.value,
          })],
        },
      ],
    }
  })

  return { categoryTreeData, activeCategory }
}

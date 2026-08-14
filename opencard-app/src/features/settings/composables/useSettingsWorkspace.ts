/** Projects application settings into key-only tree and row view models. */
import { computed, type ComputedRef, type DeepReadonly, type Ref } from 'vue'
import type { OcOption } from '../../../components/standard/OcOptionGroup.vue'
import type { IconToken } from '../../../shared/ui/icon/iconRegistry'
import type { OcTreeData } from '../../../shared/ui/tree/tree.types'
import {
  OC_THEME_REGISTRY,
  type OcEditableThemeColorKey,
  type OcThemeId,
} from '../../../shared/ui/foundation'
import {
  APP_THEME_PRESETS,
  resolveThemePresetId,
  type AppSettingKey,
  type AppSettings,
  type AppThemePresetId,
  type SettingsCategoryKey,
} from '../model/appSettings'

export type SettingsFieldViewModel =
  | {
      type: 'options'
      key: AppSettingKey
      label: string
      value: string
      options: readonly OcOption[]
    }
  | {
      type: 'switch'
      key: AppSettingKey
      label: string
      checked: boolean
    }
  | {
      type: 'range'
      key: AppSettingKey
      label: string
      value: number
      min: number
      max: number
      step: number
      suffix: string
    }
  | {
      type: 'text'
      key: AppSettingKey
      label: string
      value: string
      placeholder?: string
      mono?: boolean
    }
  | {
      type: 'theme-color-panel'
      key: string
      label: string
      themeId: OcThemeId
      preset: {
        label: string
        value: string
        placeholder: string
        options: readonly { value: string; label: string }[]
        importLabel: string
        exportLabel: string
        deleteLabel: string
        canDelete: boolean
      }
      accentNeighborAngle: {
        label: string
        value: number
        min: number
        max: number
        step: number
        suffix: string
      }
      fontFamily: {
        label: string
        value: string
        fontFamilies: readonly string[]
        placeholder: string
      }
      colors: readonly {
        key: string
        label: string
        token: OcEditableThemeColorKey
        value: string
        overrideValue: string | null
      }[]
    }
  | {
      type: 'action'
      key: 'project-workspace.reset' | 'themes.reset'
      label: string
      actionLabel: string
      icon: IconToken
      disabled: boolean
      disabledReason?: string
    }

export interface SettingsCategoryViewModel {
  key: SettingsCategoryKey
  title: string
  fields: readonly SettingsFieldViewModel[]
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
        fields: [
          {
            type: 'options',
            key: 'appearance.locale',
            label: options.translate('settings.fields.language', 'Language'),
            value: settings.appearance.locale,
            options: [
              { value: 'system', label: options.translate('settings.values.systemLanguage', 'System') },
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en-US', label: 'English' },
            ],
          },
          {
            type: 'switch',
            key: 'updates.suppressReleaseNotesAfterUpdate',
            label: options.translate(
              'settings.fields.suppressReleaseNotesAfterUpdate',
              'Do not show release notes after an update',
            ),
            checked: settings.updates.suppressReleaseNotesAfterUpdate,
          },
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
      const colorPanel = (themeId: OcThemeId): SettingsFieldViewModel => ({
        type: 'theme-color-panel',
        key: `appearance.${themeId}ThemeColors`,
        label: options.translate(`settings.fields.${themeId}ThemeColors`, themeId === 'dark' ? 'Dark theme' : 'Light theme'),
        themeId,
        preset: {
          label: options.translate('settings.fields.themePreset', 'Preset'),
          value: resolveThemePresetId(
            themeId,
            settings.appearance.themeOverrides[themeId],
            settings.appearance.accentNeighborAngles[themeId],
            settings.appearance.fontFamilies[themeId],
            settings.appearance.userThemePresets[themeId],
          ),
          placeholder: options.translate('settings.values.selectThemePreset', 'Select preset'),
          options: [
            ...APP_THEME_PRESETS[themeId].map(presetId => ({
              value: presetId,
              label: presetLabel(themeId, presetId),
            })),
            ...settings.appearance.userThemePresets[themeId].map(preset => ({
              value: `user:${preset.name}`,
              label: `${preset.name} · ${options.translate('settings.values.importedTheme', 'Imported')}`,
            })),
          ],
          importLabel: options.translate('settings.actions.importTheme', 'Import theme'),
          exportLabel: options.translate('settings.actions.exportTheme', 'Export theme'),
          deleteLabel: options.translate('settings.actions.deleteThemePreset', 'Delete imported theme'),
          canDelete: resolveThemePresetId(
            themeId,
            settings.appearance.themeOverrides[themeId],
            settings.appearance.accentNeighborAngles[themeId],
            settings.appearance.fontFamilies[themeId],
            settings.appearance.userThemePresets[themeId],
          ).startsWith('user:'),
        },
        accentNeighborAngle: {
          label: options.translate('settings.fields.accentNeighborAngle', 'Secondary color phase angle'),
          value: settings.appearance.accentNeighborAngles[themeId],
          min: -180,
          max: 180,
          step: 1,
          suffix: '°',
        },
        fontFamily: {
          label: options.translate('settings.fields.uiFont', 'UI font'),
          value: settings.appearance.fontFamilies[themeId],
          fontFamilies: systemFontFamilies.value,
          placeholder: options.translate('settings.values.systemFont', 'System'),
        },
        colors: [
          ['accentColor', 'Theme color', '--oc-accent'],
          ['baseBackgroundColor', 'Background', '--oc-bg-base'],
          ['primaryTextColor', 'Foreground', '--oc-fg-default'],
        ].map(([key, fallback, token]) => ({
          key,
          label: options.translate(`settings.fields.${key}`, fallback),
          token: token as OcEditableThemeColorKey,
          value: settings.appearance.themeOverrides[themeId][token as OcEditableThemeColorKey]
            ?? OC_THEME_REGISTRY[themeId][token as OcEditableThemeColorKey],
          overrideValue: settings.appearance.themeOverrides[themeId][token as OcEditableThemeColorKey] ?? null,
        })),
      })

      return {
        key: categoryKey,
        title: categoryLabels.value.appearance,
        preview: { glassIntensity: settings.appearance.glassIntensity },
        fields: [
          {
            type: 'options',
            key: 'appearance.theme',
            label: options.translate('settings.fields.theme', 'Theme'),
            value: settings.appearance.theme,
            options: [
              { value: 'system', label: options.translate('settings.values.systemTheme', 'System') },
              { value: 'dark', label: options.translate('settings.values.dark', 'Dark') },
              { value: 'light', label: options.translate('settings.values.light', 'Light') },
            ],
          },
          {
            type: 'range',
            key: 'appearance.baseFontSize',
            label: options.translate('settings.fields.baseFontSize', 'Base font size'),
            value: settings.appearance.baseFontSize,
            min: 10,
            max: 16,
            step: 1,
            suffix: 'px',
          },
          colorPanel('dark'),
          colorPanel('light'),
          {
            type: 'range',
            key: 'appearance.glassIntensity',
            label: options.translate('settings.fields.glassIntensity', 'Glass intensity'),
            value: settings.appearance.glassIntensity,
            min: 0,
            max: 100,
            step: 1,
            suffix: '%',
          },
          {
            type: 'action',
            key: 'themes.reset',
            label: options.translate('settings.fields.themeSettings', 'Theme settings'),
            actionLabel: options.translate('settings.actions.resetThemes', 'Reset themes'),
            icon: 'action.restart',
            disabled: false,
          },
        ],
      }
    }

    return {
      key: categoryKey,
      title: categoryLabels.value.workspace,
      fields: [
        {
          type: 'range',
          key: 'workspace.historyEntryLimit',
          label: options.translate('settings.fields.historyEntryLimit', 'History entries per editor'),
          value: settings.workspace.historyEntryLimit,
          min: 10,
          max: 1000,
          step: 10,
          suffix: options.translate('settings.values.historyEntries', ' entries'),
        },
        {
          type: 'options',
          key: 'workspace.structureTreeSelectionBehavior',
          label: options.translate('settings.fields.structureTreeSelectionBehavior', 'Structure tree selection'),
          value: settings.workspace.structureTreeSelectionBehavior,
          options: [
            {
              value: 'expand-exclusive',
              label: options.translate('settings.values.expandExclusive', 'Expand and collapse others'),
            },
            {
              value: 'expand',
              label: options.translate('settings.values.expand', 'Expand ancestors'),
            },
            {
              value: 'none',
              label: options.translate('settings.values.noAutoExpand', 'Do not expand'),
            },
          ],
        },
        {
          type: 'switch',
          key: 'workspace.structureTreeScrollToSelection',
          label: options.translate('settings.fields.structureTreeScrollToSelection', 'Scroll to selected block'),
          checked: settings.workspace.structureTreeScrollToSelection,
        },
        {
          type: 'switch',
          key: 'workspace.showSelectionPositionOnMove',
          label: options.translate(
            'settings.fields.showSelectionPositionOnMove',
            'Show anchor and X/Y guides while moving blocks',
          ),
          checked: settings.workspace.showSelectionPositionOnMove,
        },
        {
          type: 'switch',
          key: 'workspace.showSelectionSizeOnResize',
          label: options.translate(
            'settings.fields.showSelectionSizeOnResize',
            'Show width and height labels while resizing blocks',
          ),
          checked: settings.workspace.showSelectionSizeOnResize,
        },
        {
          type: 'switch',
          key: 'workspace.alignmentSnappingEnabledByDefault',
          label: options.translate(
            'settings.fields.alignmentSnappingEnabledByDefault',
            'Enable alignment snapping by default',
          ),
          checked: settings.workspace.alignmentSnappingEnabledByDefault,
        },
        {
          type: 'action',
          key: 'project-workspace.reset',
          label: options.translate('settings.fields.projectWorkspaceState', 'Project workspace state'),
          actionLabel: options.translate('settings.actions.reset', 'Reset'),
          icon: 'action.restart',
          disabled: !options.projectOpen.value,
          disabledReason: options.projectOpen.value
            ? undefined
            : options.translate('settings.reasons.openProjectFirst', 'Open a project first'),
        },
      ],
    }
  })

  return { categoryTreeData, activeCategory }
}

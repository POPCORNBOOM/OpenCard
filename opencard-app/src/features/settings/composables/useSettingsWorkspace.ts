/** Projects application settings into key-only tree and row view models. */
import { computed, type ComputedRef, type DeepReadonly, type Ref } from 'vue'
import type { OcOption } from '../../../components/standard/OcOptionGroup.vue'
import type { IconToken } from '../../../shared/ui/icon/iconRegistry'
import type { OcTreeData } from '../../../shared/ui/tree/tree.types'
import type {
  AppSettingKey,
  AppSettings,
  SettingsCategoryKey,
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
      type: 'action'
      key: 'project-workspace.reset'
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
            key: 'appearance.glassIntensity',
            label: options.translate('settings.fields.glassIntensity', 'Glass intensity'),
            value: settings.appearance.glassIntensity,
            min: 0,
            max: 100,
            step: 1,
            suffix: '%',
          },
        ],
      }
    }

    return {
      key: categoryKey,
      title: categoryLabels.value.workspace,
      fields: [
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

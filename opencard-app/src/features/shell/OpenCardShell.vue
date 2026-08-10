<!--
  使用说明：
  - 作为 OpenCard 壳层页面挂载项目树 编辑器区 问题面板与导出入口
  - 依赖 workspace store 与 editor session store 提供真相状态

  职责边界：
  - 负责页面布局 编排与交互意图转发
  - 不沉淀文件系统规则与会话生命周期规则

  主要输出事件：
  - 无 页面组件通过内部编排调用 store/composable
-->
<template>
  <main class="shell-root open-card-shell">
    <ShellTitleBar
      :collapsed="effectiveSidebarCollapsed"
      :brand-label="titleBarBrandLabel"
      brand-logo-src="/opencard-logo.png"
      :menu-groups="titleBarMenus"
      :primary-page-action="primaryPageToggleAction"
      :app-actions="titleBarAppActions"
      :tasks="titleBarTasks"
      :window-controls="windowControls"
      :native-macos-controls="usesNativeMacosWindowControls"
      :collapse-tooltip="t('app.shell.collapseSidebar')"
      :expand-tooltip="t('app.shell.expandSidebar')"
      :cancel-task-label="t('app.shell.cancelTask')"
      :drag-region="!isWindowFullscreen"
      @toggle-sidebar="toggleSidebarCollapsed"
      @menu-action="handleTitleBarMenuAction"
      @app-action="handleTitleBarAppAction"
      @window-control="handleWindowControl"
      @cancel-task="cancelShellProgressTask"
    />

    <div class="shell-main" :class="{ 'shell-main-collapsed': effectiveSidebarCollapsed }" :style="shellMainStyle">
      <ShellSidebar
        :collapsed="effectiveSidebarCollapsed"
        :width="sidebarWidth"
        :head-buttons="sidebarHeadButtons"
        :body-lists="sidebarScrollableLists"
        :bottom-lists="sidebarBottomLists"
        :tail-buttons="sidebarTailButtons"
        :min-resize-width="SIDEBAR_AUTO_COLLAPSE_WIDTH"
        @head-button-clicked="runShellCommand"
        @list-button-clicked="handleSidebarListAction"
        @tail-button-clicked="runShellCommand"
        @resize="handleSidebarResize"
      >
        <template #list-content="{ list }">
          <OcTree
            v-if="list.key === TEMPLATES_LIST_KEY"
            class="open-card-shell__sidebar-tree"
            :data="templateTreeData"
            :actions="templateCatalogActions"
            :selected-keys="selectedTemplateKey ? [selectedTemplateKey] : []"
            :expanded-keys="[USER_TEMPLATES_GROUP_KEY]"
            role="tree"
            selection-mode="single"
            activation-mode="none"
            @intent="handleTemplateTreeIntent"
          />
          <OcTree
            v-else-if="list.key === ICON_PACKS_LIST_KEY && iconPackTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="iconPackTreeData"
            :actions="iconPackActions"
            role="listbox"
            selection-mode="none"
            activation-mode="none"
            @intent="handleIconPackTreeIntent"
          />
          <OcTree
            v-else-if="list.key === CUSTOM_BLOCKS_LIST_KEY && customBlockTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="customBlockTreeData"
            :actions="customBlockActions"
            role="listbox"
            selection-mode="none"
            activation-mode="none"
            @intent="handleCustomBlockTreeIntent"
          />
          <OcTree
            v-else-if="list.key === SETTINGS_CATEGORIES_LIST_KEY"
            class="open-card-shell__sidebar-tree"
            :data="settingsCategoryTreeData"
            :selected-keys="[settingsCategoryKey]"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleSettingsCategoryTreeIntent"
          />
          <OcTree
            v-else-if="list.key === RECENT_PROJECTS_LIST_KEY && recentProjectTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="recentProjectTreeData"
            :actions="recentProjectActions"
            :selected-keys="selectedRecentProjectKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="double-click"
            @intent="handleRecentProjectTreeIntent"
          />
          <OcTree
            v-else-if="list.key === OPENED_EDITORS_LIST_KEY && openedEditorTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="openedEditorTreeData"
            :actions="openedEditorActions"
            :selected-keys="openedEditorSelectedKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleOpenedEditorTreeIntent"
          />
          <OcTree
            v-else-if="list.key === TEMPLATE_ENTRIES_LIST_KEY && exportTemplateEntryTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="exportTemplateEntryTreeData"
            :actions="exportTemplateTreeActions"
            :selected-keys="[]"
            role="listbox"
            selection-mode="none"
            activation-mode="none"
            @intent="handleExportSelectionTreeIntent"
          />
          <OcTree
            v-else-if="list.key === TEMPLATE_COVERS_LIST_KEY && exportTemplateCoverTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="exportTemplateCoverTreeData"
            :actions="exportTemplateTreeActions"
            :selected-keys="[]"
            role="listbox"
            selection-mode="none"
            activation-mode="none"
            @intent="handleExportSelectionTreeIntent"
          />
          <OcTree
            v-else-if="list.key === PROJECT_FILES_LIST_KEY && projectTreeData.rootKeys.length > 0"
            ref="projectTreeRef"
            class="open-card-shell__sidebar-tree"
            :data="isExportTemplateMode ? exportTemplateTreeData : projectTreeData"
            :actions="isExportTemplateMode ? exportTemplateTreeActions : projectEntryActions"
            :selected-keys="selectedFileKeys"
            :expanded-keys="isExportTemplateMode ? exportTemplateExpandedKeys : projectExpandedKeys"
            role="tree"
            selection-mode="single"
            :activation-mode="isExportTemplateMode ? 'none' : 'double-click'"
            @intent="isExportTemplateMode ? handleExportTemplateTreeIntent($event) : handleProjectTreeIntent($event)"
          />
          <ChangeHistoryList
            v-else-if="list.key === CHANGES_LIST_KEY"
            :versions="fileVersions"
            :local-history="localHistoryEntries"
            :empty-label="changeHistoryEmptyLabel"
            :locale="locale"
            :source-filter="changeHistorySourceFilter"
            :active-compare-key="activeCompareKey"
            @select="handleChangeHistorySelect"
            @info="selectedVersionInfoCommitId = $event"
            @restore="requestLocalHistoryRestore"
            @delete="openLocalHistoryDeleteDialog"
          />
          <OcTree
            v-else-if="list.key === VERSION_LIST_KEY && versionTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="versionTreeData"
            :selected-keys="selectedVersionKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="single-click"
            @intent="handleVersionTreeIntent"
          />
          <div v-else class="shell-sidebar-empty">
            <OcButton
              v-if="list.key === PROJECT_FILES_LIST_KEY && !projectPath && !effectiveSidebarCollapsed"
              icon="status.folder-open"
              size="sm"
              variant="ghost"
              @click="openProject"
            >
              {{ list.placeholder }}
            </OcButton>
            <span v-else>{{ list.placeholder }}</span>
          </div>
        </template>
      </ShellSidebar>

      <ShellWorkspaceFrame
        :title="workspaceTitle"
        :actions="workspaceActions"
        lock-body-scroll
        flush-body
        @action="handleWorkspaceFrameAction"
      >
        <div class="open-card-shell__workspace-stack">
          <div class="open-card-shell__workbench">
            <CreateProjectWorkspace
              v-if="isCreateProjectMode"
              ref="createProjectWorkspaceRef"
              :activation-error="projectActivationError"
              :external-busy="isActivatingProject"
              :selected-key="selectedTemplateKey"
              :selected-icon-pack-keys="selectedIconPackKeys"
              :selected-custom-block-keys="selectedCustomBlockKeys"
              @created="handleProjectCreated"
              @update:busy="isCreateProjectOperationBusy = $event"
              @update:selected-key="selectedTemplateKey = $event"
            />
            <ExportTemplateWorkspace
              v-else-if="isExportTemplateMode && projectPath"
              ref="exportTemplateWorkspaceRef"
              :project-path="projectPath"
              @selection-change="exportTemplateSelection = $event"
              @update:busy="isExportTemplateBusy = $event"
            />
            <SettingsWorkspace
              v-else-if="isSettingsMode"
              :view-model="activeSettingsCategory"
              @intent="handleSettingsIntent"
            />
            <AboutWorkspace
              v-else-if="isAboutMode"
              :current-release-notes="currentReleaseNotes"
              :available-update-version="availableUpdate ? updateVersion : undefined"
              @back="showPrimaryShellPage(getCurrentPrimaryShellPage())"
              @show-available-release="releaseNotesDialogMode = 'available'"
              @send-feedback="openFeedbackCenter('submit')"
              @view-feedback="openFeedbackCenter('history')"
            />
            <WelcomeWorkspace
              v-else-if="isWelcomeMode"
              @new-project="openCreateProject"
              @open-project="openProject"
            />
            <WorkbenchWorkspace v-else-if="isWorkbenchMode" :has-active-editor="Boolean(activeSession)">
              <div v-if="activeSession" class="open-card-shell__editor-stack">
                <div
                  class="open-card-shell__source-editor"
                  :class="{ 'is-comparing': Boolean(compareSession) }"
                  :inert="Boolean(compareSession)"
                  :aria-hidden="compareSession ? 'true' : undefined"
                >
                  <component
                    :is="currentEditorComponent"
                    :key="currentEditorKey"
                    ref="currentEditorRef"
                    v-bind="editorPropsWithVersioning"
                    @modified="handleEditorModified"
                    @save="handleEditorSave"
                    @open-file="handleOpenFile"
                    @update-viewport-transform="handleViewportTransformUpdate"
                    @update:pixelated="handleImagePreviewPixelatedUpdate"
                    @update:card-designer-mode="handleCardDesignerModeUpdate"
                    @update-card-designer-layout="handleCardDesignerLayoutUpdate"
                    @update-card-designer-view="handleCardDesignerViewUpdate"
                    @issue-snapshot="handleEditorIssueSnapshot(activeSession.id, $event)"
                  />
                </div>
                <VersionDiffHost
                  v-if="compareSession"
                  class="open-card-shell__compare-editor"
                  :session="compareSession"
                  :language="currentDiffLanguage"
                  :theme-id="currentEditorThemeId"
                  :theme-overrides="currentEditorThemeOverrides"
                  @close="closeCompare"
                />
              </div>
            </WorkbenchWorkspace>
          </div>

          <WorkspaceBottomPanel
            :expanded="isBottomPanelExpanded"
            :active-tab="activeBottomTab"
            :issue-count="visibleIssueCount"
            :issue-severity="visibleIssueSeverity"
            :issue-tree-data="visibleIssueTreeData"
            :issue-navigation-targets="issueNavigationTargets"
            :expanded-issue-keys="expandedIssueKeys"
            :output-entries="appConsoleEntries"
            :issues-label="t('app.problems.tab')"
            :output-label="t('app.problems.outputTab')"
            :issue-empty-label="t('app.problems.empty')"
            :output-empty-label="t('app.problems.outputEmpty')"
            :output-filter-empty-label="t('app.problems.outputFilterEmpty')"
            :output-clear-label="t('app.problems.clearOutput')"
            :output-copy-label="t('app.problems.copyOutput')"
            :output-locale="locale"
            :output-severity-filter-label="t('app.problems.severityFilter')"
            :output-severity-labels="{
              debug: t('app.problems.severities.debug'),
              log: t('app.problems.severities.log'),
              info: t('app.problems.severities.info'),
              warn: t('app.problems.severities.warn'),
              error: t('app.problems.severities.error'),
            }"
            :expand-label="t('app.shell.expandBottomPanel')"
            :collapse-label="t('app.shell.collapseBottomPanel')"
            :pin-label="t('app.shell.pinBottomPanel')"
            :unpin-label="t('app.shell.unpinBottomPanel')"
            @expanded-change="isBottomPanelExpanded = $event"
            @tab-change="activeBottomTab = $event"
            @issue-expansion-change="setIssueNodeExpanded"
            @issue-navigate="handleWorkspaceIssueNavigate"
            @output-clear="clearAppConsoleEntries"
          />
        </div>
      </ShellWorkspaceFrame>
    </div>

    <!-- 隐藏的导出渲染器 -->
    <div v-if="showExportRenderer" style="position: fixed; top: -9999px; left: -9999px;">
      <CardFaceRenderer
        v-if="exportCardFace"
        ref="exportRendererRef"
        :face="exportCardFace"
        :clip-to-face="true"
        :resource-root-path="exportResourceRootPath"
        :remote-resource-policy="exportRemoteResourcePolicy"
        :project-icon-catalog="exportProjectIconCatalog"
      />
    </div>

    <ProjectExportDialog :open="projectExportDialogOpen" :model-value="projectExportDialogTask"
      :documents="projectExportDocumentCandidates" :busy="isExportPreparing || isProjectExportRunning"
      :preparation-issues="exportPreparationIssues"
      @update:model-value="projectExportDialogTask = $event" @close="closeProjectExportDialog"
      @submit="startProjectExport" />

    <SaveVersionDialog
      :confirmation="saveVersionConfirmation"
      :busy="versionWriteState.status === 'running'"
      :error="versioningErrorMessage"
      @close="cancelSaveVersion"
      @submit="handleSaveVersionConfirm"
    />
    <VersionInfoDialog
      :version="selectedVersionInfo"
      :current-commit-id="versionStatus?.current?.commitId ?? null"
      :busy="versionWriteState.status === 'running'"
      :locale="locale"
      :can-restore="!hasWorkspaceVersionChanges"
      @close="selectedVersionInfoCommitId = null"
      @publish="openPublishDialog(false)"
      @edit-release="openPublishDialog(true)"
      @restore="openRestoreDialog"
    />
    <PublishVersionDialog
      :version="publishVersionTarget"
      :allow-renumber="canRenumberPublishTarget"
      :edit-mode="editReleaseMode"
      :busy="versionWriteState.status === 'running'"
      :error="publishVersionErrorMessage"
      @close="closePublishDialog"
      @submit="handlePublishVersionConfirm"
    />
    <OcDialog
      :open="Boolean(localHistoryRestoreTarget)"
      :title="t('versioning.history.restoreTitle')"
      :description="t('versioning.history.restoreDescription')"
      size="sm"
      :dismissible="!localHistoryRestoreBusy"
      :close-on-backdrop="!localHistoryRestoreBusy"
      @request-close="closeLocalHistoryRestoreDialog"
    >
      <div v-if="localHistoryRestoreTarget" class="open-card-shell__restore-dialog">
        <p v-if="localHistoryRestoreError" class="open-card-shell__restore-error" role="alert">
          {{ localHistoryRestoreError }}
        </p>
        <p>{{ t('versioning.history.restoreTarget', { path: localHistoryRestoreTarget.relativePath }) }}</p>
      </div>
      <template #footer>
        <OcButton type="button" variant="ghost" :disabled="localHistoryRestoreBusy" @click="closeLocalHistoryRestoreDialog">
          {{ t('versioning.actions.cancel') }}
        </OcButton>
        <OcButton type="button" variant="solid" :disabled="localHistoryRestoreBusy" @click="handleLocalHistoryRestoreConfirm">
          {{ localHistoryRestoreBusy ? t('versioning.restore.restoring') : t('versioning.actions.restore') }}
        </OcButton>
      </template>
    </OcDialog>
    <OcDialog
      :open="Boolean(localHistoryDeleteTarget)"
      :title="t('versioning.history.deleteTitle')"
      :description="t('versioning.history.deleteDescription')"
      size="sm"
      :dismissible="!localHistoryDeleteBusy"
      :close-on-backdrop="!localHistoryDeleteBusy"
      @request-close="closeLocalHistoryDeleteDialog"
    >
      <div v-if="localHistoryDeleteTarget" class="open-card-shell__restore-dialog">
        <p v-if="localHistoryDeleteError" class="open-card-shell__restore-error" role="alert">
          {{ localHistoryDeleteError }}
        </p>
        <p>{{ t('versioning.history.deleteTarget', {
          path: localHistoryDeleteTarget.relativePath,
          time: new Date(localHistoryDeleteTarget.createdAtUnixMs).toLocaleString(locale),
        }) }}</p>
        <p>{{ t('versioning.history.deleteKeepsFile') }}</p>
      </div>
      <template #footer>
        <OcButton type="button" variant="ghost" :disabled="localHistoryDeleteBusy" @click="closeLocalHistoryDeleteDialog">
          {{ t('versioning.actions.cancel') }}
        </OcButton>
        <OcButton
          type="button"
          variant="solid"
          icon="action.delete"
          icon-tone="danger"
          :disabled="localHistoryDeleteBusy"
          @click="handleLocalHistoryDeleteConfirm"
        >
          {{ localHistoryDeleteBusy ? t('versioning.history.deleting') : t('versioning.history.deleteRecord') }}
        </OcButton>
      </template>
    </OcDialog>
    <OcDialog
      :open="Boolean(restoreVersionTarget)"
      :title="t('versioning.restore.title')"
      :description="t('versioning.restore.description')"
      as="form"
      size="md"
      :dismissible="versionWriteState.status !== 'running'"
      close-on-backdrop
      @request-close="closeRestoreDialog"
      @submit="handleRestoreConfirm"
    >
      <div v-if="restoreVersionTarget" class="open-card-shell__restore-dialog">
        <p v-if="restoreVersionErrorMessage" class="open-card-shell__restore-error" role="alert">
          {{ restoreVersionErrorMessage }}
        </p>
        <p>{{ t('versioning.restore.target', { version: `v${restoreVersionTarget.version}` }) }}</p>
        <label>
          <span>{{ t('versioning.fields.description') }}</span>
          <OcFieldInput
            as="textarea"
            :value="restoreDescription"
            rows="4"
            maxlength="500"
            required
            autofocus
            :disabled="versionWriteState.status === 'running'"
            @input="restoreDescription = ($event.target as HTMLTextAreaElement).value"
          />
        </label>
      </div>
      <template #footer>
        <OcButton type="button" variant="ghost" :disabled="versionWriteState.status === 'running'" @click="closeRestoreDialog">
          {{ t('versioning.actions.cancel') }}
        </OcButton>
        <OcButton type="submit" variant="solid" :disabled="versionWriteState.status === 'running' || restoreDescription.trim().length === 0">
          {{ versionWriteState.status === 'running' ? t('versioning.restore.restoring') : t('versioning.actions.restore') }}
        </OcButton>
      </template>
    </OcDialog>

    <div v-if="isShellFileDropActive" class="shell-file-drop-overlay" role="status" aria-live="polite">
      <OcIcon name="file.generic" size="lg" tone="opencard" />
      <span>{{ t('app.shell.dropFilesToOpen') }}</span>
    </div>

    <UnsavedEditorsDialog
      :open="isUnsavedEditorsDialogOpen"
      :intent-type="pendingCloseIntent?.type"
      :rows="unsavedEditorDecisions"
      :busy="isUnsavedCloseBusy"
      :global-error="unsavedCloseError"
      :selected-count="unsavedSelectedCount"
      :pending-count="unsavedPendingCount"
      :save-count="unsavedSaveCount"
      :discard-count="unsavedDiscardCount"
      :all-pending-selected="allUnsavedPendingSelected"
      :some-pending-selected="someUnsavedPendingSelected"
      :can-confirm="canConfirmUnsavedClose"
      @select-all="setAllUnsavedPendingSelected"
      @select-row="setUnsavedRowSelected"
      @mark-discard="markSelectedUnsavedDiscard"
      @mark-save="markSelectedUnsavedSave"
      @change-decision="resetUnsavedDecision"
      @cancel="cancelUnsavedClose"
      @confirm="confirmUnsavedClose"
      @discard-single="discardSingleUnsavedEditor"
      @save-single="saveSingleUnsavedEditor"
    />

    <ReleaseNotesDialog
      :open="releaseNotesDialogMode !== null"
      :release="displayedReleaseNotes"
      :available="releaseNotesDialogMode === 'available'"
      :installing="isInstallingUpdate"
      @close="closeReleaseNotesDialog"
      @install="installAvailableRelease"
    />

    <FeedbackDialog
      :open="feedbackCenterPage === 'submit'"
      :initial-kind="feedbackDialogKind"
      active-page="submit"
      :diagnostics="latestFeedbackDiagnostics"
      @page-change="feedbackCenterPage = $event"
      @close="feedbackCenterPage = null"
    />

    <FeedbackHistoryDialog
      :open="feedbackCenterPage === 'history'"
      active-page="history"
      :developer-mode="developerMode"
      @page-change="feedbackCenterPage = $event"
      @close="feedbackCenterPage = null"
    />

    <FloatingMenuHost />
  </main>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message as showMessage } from '@tauri-apps/plugin-dialog'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { useProjectStore } from '../workspace/store/projectStore'
import {
  createDefaultOpenCardContent,
  setLocalHistoryRecorder,
  useEditorSessionStore,
} from '../workspace/store/editorSessionStore'
import FloatingMenuHost from '../../components/ui/FloatingMenuHost.vue'
import OcTree from '../../components/standard/OcTree.vue'
import type { OcActionMenuEntry } from '../../components/standard/OcActionMenu.vue'
import OcButton from '../../components/base/OcButton.vue'
import OcIcon from '../../components/base/OcIcon.vue'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent, OcTreeItem } from '../../shared/ui/tree/tree.types'
import SettingsWorkspace from '../settings/components/SettingsWorkspace.vue'
import CreateProjectWorkspace from '../project-templates/components/CreateProjectWorkspace.vue'
import ExportTemplateWorkspace from '../project-templates/components/ExportTemplateWorkspace.vue'
import WorkbenchWorkspace from './components/WorkbenchWorkspace.vue'
import WelcomeWorkspace from './components/WelcomeWorkspace.vue'
import AboutWorkspace from './components/AboutWorkspace.vue'
import WorkspaceBottomPanel, {
  type WorkspaceBottomTab,
} from './components/WorkspaceBottomPanel.vue'
import UnsavedEditorsDialog from './components/UnsavedEditorsDialog.vue'
import ReleaseNotesDialog from './components/ReleaseNotesDialog.vue'
import FeedbackDialog from '../feedback/components/FeedbackDialog.vue'
import FeedbackHistoryDialog from '../feedback/components/FeedbackHistoryDialog.vue'
import type { ProjectExportTask } from '../workspace/model/projectMetadata'
import type { FeedbackKind, FeedbackPage } from '../feedback/model/feedback'
import { useFeedbackDiagnostics } from '../feedback/composables/useFeedbackDiagnostics'
import { appConsoleEntries, clearAppConsoleEntries } from '../logging/appConsole'
import { reportAppError } from '../logging/appErrorCatalog'
import type {
  ProjectTemplate,
  ProjectTemplateKey,
  TemplateExportSelection,
} from '../project-templates/model/projectTemplate'
import { resolveProjectTemplateName } from '../project-templates/model/projectTemplate'
import { useProjectTemplateStore } from '../project-templates/store/projectTemplateStore'
import {
  resolveProjectIconPackName,
  type ProjectIconPackCatalogEntry,
  type ProjectIconPackCatalogKey,
} from '../workspace/model/projectIconPackCatalog'
import { useProjectIconPackStore } from '../workspace/store/projectIconPackStore'
import type {
  UserCustomBlockCatalogEntry,
  UserCustomBlockCatalogKey,
} from '../workspace/model/userCustomBlockCatalog'
import { useUserCustomBlockCatalogStore } from '../workspace/store/userCustomBlockCatalogStore'
import { useSettingsWorkspace } from '../settings/composables/useSettingsWorkspace'
import { useAppSettingsStore } from '../settings/store/appSettingsStore'
import {
  APP_THEME_FILE_EXTENSION,
  APP_THEME_FILE_SUFFIX,
  parseAppTheme,
  serializeAppTheme,
  type SettingsCategoryKey,
  type SettingsIntent,
} from '../settings/model/appSettings'
import CardFaceRenderer from '../card-rendering/components/CardFaceRenderer.vue'
import type {
  EditorIssueSnapshot,
  SessionIssueNavigationRequest,
} from '../editor-runtime/model/editorIssue'
import { CARD_DOCUMENT_SUFFIX, resolveFileType } from '../workspace/model/fileTypes'
import { useProjectExport } from './composables/useProjectExport'
import ProjectExportDialog from '../exporting/components/ProjectExportDialog.vue'
import SaveVersionDialog from '../versioning/components/SaveVersionDialog.vue'
import ChangeHistoryList from '../versioning/components/ChangeHistoryList.vue'
import VersionDiffHost from '../versioning/components/VersionDiffHost.vue'
import VersionInfoDialog from '../versioning/components/VersionInfoDialog.vue'
import PublishVersionDialog from '../versioning/components/PublishVersionDialog.vue'
import OcDialog from '../../components/standard/OcDialog.vue'
import OcFieldInput from '../../components/base/OcFieldInput.vue'
import type { LocalHistoryEntryDto, VersionErrorDto, VersionRecordDto } from '../versioning/model/versioning'
import type { ExportDocumentCandidate } from '../../components/editors/ProjectExportTaskEditor.vue'
import {
  createDefaultProjectExportTask,
  type ExportTaskValidationIssue,
} from '../exporting/exportTask'
import { useAppUpdater } from './composables/useAppUpdater'
import { useShellProgressTasks } from './composables/useShellProgressTasks'
import { useShellCloseCoordinator } from './composables/useShellCloseCoordinator'
import { useShellEditorHost } from './composables/useShellEditorHost'
import { useShellProjectLifecycle } from './composables/useShellProjectLifecycle'
import { useShellWindow } from './composables/useShellWindow'
import { useWorkspaceIssues } from './composables/useWorkspaceIssues'
import { useVersioning } from '../versioning/composables/useVersioning'
import { navigateWorkspaceIssue } from './services/workspaceIssueNavigation'
import {
  OPENED_EDITOR_CLOSE_ACTION_KEY,
  PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY,
  PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY,
  PROJECT_ENTRY_RENAME_ACTION_KEY,
  PROJECT_ENTRY_REVEAL_ACTION_KEY,
  isProjectEntryConfirmDeleteActionKey,
  projectEntryConfirmDeleteActionKey,
  projectEntryDeleteActionKey,
  projectEntryMoreActionKey,
  useShellFileTree,
} from './composables/useShellFileTree'
import ShellSidebar from './components/ShellSidebar.vue'
import ShellTitleBar from './components/ShellTitleBar.vue'
import ShellWorkspaceFrame from './components/ShellWorkspaceFrame.vue'
import {
  classifyExternalOpenPath,
} from './services/externalOpenService'
import { fileSystemService } from '../workspace/services/fileSystemService'
import type {
  ShellButton,
  ShellAction,
  ShellList,
  ShellTitleBarAppAction,
  ShellTitleBarMenuGroup,
  ShellTitleBarWindowControl,
} from './shell.types'
import {
  getOtherPrimaryShellPage,
  getPrimaryShellPage,
  type ProjectCloseDestination,
  type PrimaryShellPage,
  type ShellPage,
} from './shellPage'

const { t, locale } = useI18n()
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_AUTO_COLLAPSE_WIDTH = 168
const PROJECT_FILES_LIST_KEY = 'project-files'
const OPENED_EDITORS_LIST_KEY = 'opened-editors'
const RECENT_PROJECTS_LIST_KEY = 'recent-projects'
const CHANGES_LIST_KEY = 'changes'
const VERSION_LIST_KEY = 'versions'
const CHANGE_HISTORY_REFRESH_ACTION_KEY = 'change-history.refresh'
const CHANGE_HISTORY_FILTER_ACTION_KEY = 'change-history.filter'
const CHANGE_HISTORY_FILTER_ALL_ACTION_KEY = 'change-history.filter.all'
const CHANGE_HISTORY_FILTER_VERSION_ACTION_KEY = 'change-history.filter.version'
const CHANGE_HISTORY_FILTER_LOCAL_ACTION_KEY = 'change-history.filter.local-history'
const SETTINGS_CATEGORIES_LIST_KEY = 'settings-categories'
const TEMPLATES_LIST_KEY = 'templates'
const ICON_PACKS_LIST_KEY = 'icon-packs'
const CUSTOM_BLOCKS_LIST_KEY = 'custom-blocks'
const USER_TEMPLATES_GROUP_KEY = 'template-group:user'
const TEMPLATE_ENTRIES_LIST_KEY = 'template-entries'
const TEMPLATE_COVERS_LIST_KEY = 'template-covers'
const IMPORT_TEMPLATE_ACTION_KEY = 'import-template'
const IMPORT_ICON_PACK_ACTION_KEY = 'import-icon-pack'
const IMPORT_CUSTOM_BLOCK_ACTION_KEY = 'import-custom-block'
const REGISTER_ICON_PACK_ACTION_KEY = 'register-icon-pack'
const REGISTERED_ICON_PACK_ACTION_KEY = 'registered-icon-pack'
const REGISTER_CUSTOM_BLOCK_ACTION_KEY = 'register-custom-block'
const REGISTERED_CUSTOM_BLOCK_ACTION_KEY = 'registered-custom-block'
const RECENT_PROJECT_OPEN_ACTION_KEY = 'recent-project.open'
const RECENT_PROJECT_RELOCATE_ACTION_KEY = 'recent-project.relocate'
const RECENT_PROJECT_REMOVE_ACTION_KEY = 'recent-project.remove'
const TEMPLATE_EXCLUDE_ACTION_KEY = 'template.exclude'
const TEMPLATE_INCLUDE_ACTION_KEY = 'template.include'
const TEMPLATE_COVER_ADD_ACTION_KEY = 'template.cover.add'
const TEMPLATE_COVER_REMOVE_ACTION_KEY = 'template.cover.remove'
const TEMPLATE_ENTRY_ADD_ACTION_KEY = 'template.entry.add'
const TEMPLATE_ENTRY_REMOVE_ACTION_KEY = 'template.entry.remove'
const TEMPLATE_ENTRY_TREE_PREFIX = 'template-entry:'
const TEMPLATE_COVER_TREE_PREFIX = 'template-cover:'
const PROJECT_NEW_FILE_ACTION_KEY = 'project.new-file'
const PROJECT_NEW_OPENCARD_ACTION_KEY = 'project.new-file.ocdocument'
const PROJECT_NEW_PROFILE_ACTION_KEY = 'project.new-file.ocproject'
const PROJECT_NEW_FONT_REGISTRY_ACTION_KEY = 'project.new-file.ocfonts'
const PROJECT_NEW_ICON_REGISTRY_ACTION_KEY = 'project.new-file.ocicons'
const PROJECT_NEW_CUSTOM_BLOCK_REGISTRY_ACTION_KEY = 'project.new-file.ocblocks'
const PROJECT_NEW_DICTIONARY_ACTION_KEY = 'project.new-file.oclocale'
const PROJECT_NEW_FOLDER_ACTION_KEY = 'project.new-folder'
const CARD_DESIGNER_MODE_ACTION_KEY = 'card-designer.toggle-mode'
const CARD_DATA_TABLE_IMPORT_ACTION_KEY = 'card-designer.data-table.import'
const CARD_DATA_TABLE_EXPORT_ACTION_KEY = 'card-designer.data-table.export'
const DICTIONARY_IMPORT_ACTION_KEY = 'dictionary.workbook.import'
const DICTIONARY_EXPORT_ACTION_KEY = 'dictionary.workbook.export'
const EMPTY_TREE_DATA: OcTreeData = {
  rootKeys: [],
  items: new Map(),
  children: new Map(),
}
const projectStore = useProjectStore()
const {
  projectPath,
  projectProfile,
  projectInformation,
  projectFontFiles,
  renderEnvironment: projectRenderEnvironment,
  indexedEntries,
  chooseProjectDirectory,
  isProjectAvailable,
  setProjectPath,
  isDirectoryExpanded,
  readDirectoryEntries,
  readFile: readProjectFile,
  resolveProjectPath,
  setDirectoryExpanded,
  resetProjectWorkspaceState,
  createEntryWithAvailableName,
  createFile,
  trashFile,
  revealEntryInFileManager,
  getRelativeProjectPath,
  moveEntryByDrop,
  renameEntry,
  loadFiles,
  reloadProjectProfile,
  reloadProjectFontRegistry,
  reloadProjectIconRegistry,
  reloadProjectDictionary,
  reloadProjectCustomBlockRegistry,
} = projectStore

const settingsStore = useAppSettingsStore()
const templateStore = useProjectTemplateStore()
const iconPackStore = useProjectIconPackStore()
const customBlockCatalogStore = useUserCustomBlockCatalogStore()
const shellPage = ref<ShellPage>({ type: 'welcome' })
const isSettingsMode = computed(() => shellPage.value.type === 'settings')
const isCreateProjectMode = computed(() => shellPage.value.type === 'create-project')
const isExportTemplateMode = computed(() => shellPage.value.type === 'export-template')
const isAboutMode = computed(() => shellPage.value.type === 'about')
const isWelcomeMode = computed(() => shellPage.value.type === 'welcome')
const isWorkbenchMode = computed(() => shellPage.value.type === 'workbench')
const isAuxiliaryMode = computed(() => (
  isSettingsMode.value || isCreateProjectMode.value || isExportTemplateMode.value || isAboutMode.value
))

function getCurrentPrimaryShellPage(): PrimaryShellPage {
  return getPrimaryShellPage(shellPage.value)
}

function showPrimaryShellPage(page: PrimaryShellPage): void {
  shellPage.value = { type: page }
}
const selectedTemplateKey = ref<ProjectTemplateKey | null>(null)
const selectedIconPackKeys = ref<ProjectIconPackCatalogKey[]>([])
const selectedCustomBlockKeys = ref<UserCustomBlockCatalogKey[]>([])
const createProjectWorkspaceRef = ref<InstanceType<typeof CreateProjectWorkspace> | null>(null)
const exportTemplateWorkspaceRef = ref<InstanceType<typeof ExportTemplateWorkspace> | null>(null)
const exportTemplateSelection = ref<TemplateExportSelection>({
  excludedPaths: [],
  entries: [],
  entryNames: {},
  covers: [],
})
const isCreateProjectOperationBusy = ref(false)
const isImportingIconPack = ref(false)
const isImportingCustomBlock = ref(false)
const isExportTemplateBusy = ref(false)
const isBottomPanelExpanded = ref(false)
const isExportPreparing = ref(false)
const exportPreparationIssues = ref<readonly ExportTaskValidationIssue[]>([])
const projectExportDialogOpen = ref(false)
const projectExportDialogTask = ref<ProjectExportTask>(createDefaultProjectExportTask())
const projectExportDocumentCandidates = ref<readonly ExportDocumentCandidate[]>([])
const developerMode = ref(false)
const usesNativeMacosWindowControls = typeof navigator !== 'undefined'
  && /Macintosh|Mac OS X/.test(navigator.userAgent)
const SHELL_SHORTCUT_KEYS = {
  fullscreen: 'F11',
  newProject: 'n',
  newOpenCard: 'n',
  save: 's',
  undo: 'z',
  redo: 'y',
} as const
const primaryShortcutParts = (key: string, shift = false): readonly string[] => (
  usesNativeMacosWindowControls
    ? [...(shift ? ['⇧'] : []), '⌘', key.toUpperCase()]
    : ['Ctrl', ...(shift ? ['Shift'] : []), key.toUpperCase()]
)
const shellShortcutParts = {
  fullscreen: [SHELL_SHORTCUT_KEYS.fullscreen],
  newProject: primaryShortcutParts(SHELL_SHORTCUT_KEYS.newProject),
  newOpenCard: primaryShortcutParts(SHELL_SHORTCUT_KEYS.newOpenCard, true),
  save: primaryShortcutParts(SHELL_SHORTCUT_KEYS.save),
  undo: primaryShortcutParts(SHELL_SHORTCUT_KEYS.undo),
  redo: usesNativeMacosWindowControls
    ? primaryShortcutParts(SHELL_SHORTCUT_KEYS.undo, true)
    : primaryShortcutParts(SHELL_SHORTCUT_KEYS.redo),
} as const
const {
  viewportWidth,
  isFullscreen: isWindowFullscreen,
  isMaximized: isWindowMaximized,
  isFileDropActive: isShellFileDropActive,
  toggleFullscreen: toggleWindowFullscreen,
  minimize: minimizeWindow,
  toggleMaximize: toggleWindowMaximize,
  requestClose: requestWindowClose,
  destroy: destroyWindow,
  start: startShellWindow,
  dispose: disposeShellWindow,
} = useShellWindow({
  requestApplicationClose: () => requestApplicationClose(),
  handleExternalOpenPaths,
})
const activeBottomTab = ref<WorkspaceBottomTab>('issues')
const isProjectTemplateBusy = computed(() => (
  isActivatingProject.value
  || isCreateProjectOperationBusy.value
  || isImportingIconPack.value
  || isImportingCustomBlock.value
))
const settingsCategoryKey = computed<SettingsCategoryKey>(() =>
  shellPage.value.type === 'settings' ? shellPage.value.categoryKey : 'general'
)
const projectOpen = computed(() => Boolean(projectPath.value))
const systemFontFamilies = ref<readonly string[]>([])
const { categoryTreeData: settingsCategoryTreeData, activeCategory: activeSettingsCategory } = useSettingsWorkspace({
  settings: settingsStore.settings,
  categoryKey: settingsCategoryKey,
  projectOpen,
  systemFontFamilies,
  translate: t,
})

const sidebarCollapsed = computed(() => settingsStore.settings.value.shell.sidebarCollapsed)
const effectiveSidebarCollapsed = computed(() => (
  sidebarCollapsed.value || (viewportWidth.value < 960 && !isCreateProjectMode.value)
))
const sidebarWidth = computed(() => settingsStore.settings.value.shell.sidebarWidth)
const lastExpandedSidebarWidth = ref(sidebarWidth.value)
const exportRendererRef = ref<InstanceType<typeof CardFaceRenderer>>()
const projectTreeRef = ref<{ beginRename: (key: string) => Promise<void> } | null>(null)

const {
  availableUpdate,
  updateVersion,
  availableReleaseNotes,
  currentReleaseNotes,
  hasUnseenCurrentReleaseNotes,
  isChecking: isCheckingForUpdate,
  isInstalling: isInstallingUpdate,
  installProgress: updateInstallProgress,
  developerPreviewProgress: developerUpdateProgress,
  initialize: initializeAppUpdater,
  checkForUpdate,
  markCurrentReleaseNotesSeen,
  installAvailableUpdate,
  startDeveloperPreview: startDeveloperUpdatePreview,
  stopDeveloperPreview: stopDeveloperUpdatePreview,
  dispose: disposeAppUpdater,
} = useAppUpdater()

const releaseNotesDialogMode = ref<'current' | 'available' | null>(null)
const feedbackDialogKind = ref<FeedbackKind>('suggestion')
const feedbackCenterPage = ref<FeedbackPage | null>(null)
const { latestDiagnostics: latestFeedbackDiagnostics } = useFeedbackDiagnostics()

function openFeedbackCenter(page: FeedbackPage, kind: FeedbackKind = 'suggestion'): void {
  feedbackDialogKind.value = kind
  feedbackCenterPage.value = page
}
const displayedReleaseNotes = computed(() => (
  releaseNotesDialogMode.value === 'available'
    ? availableReleaseNotes.value
    : currentReleaseNotes.value
))

watch(
  [hasUnseenCurrentReleaseNotes, () => settingsStore.settings.value.updates.suppressReleaseNotesAfterUpdate],
  ([unseen, suppress]) => {
    if (unseen && !suppress && releaseNotesDialogMode.value === null) {
      releaseNotesDialogMode.value = 'current'
    }
  },
)

watch([isAboutMode, currentReleaseNotes], ([aboutMode, release]) => {
  if (aboutMode && release?.seenAt === null) void markCurrentReleaseNotesSeen()
})

const {
  tasks: titleBarTasks,
  setTask: setShellProgressTask,
  removeTask: removeShellProgressTask,
  cancelTask: cancelShellProgressTask,
} = useShellProgressTasks()
const UPDATE_PROGRESS_TASK_KEY = 'app-update'
const titleBarBrandLabel = computed(() => {
  if (titleBarTasks.value.length === 0) return 'OPENCARD'
  if (titleBarTasks.value.length === 1) return titleBarTasks.value[0]!.title
  return t('app.shell.activeTasks', { count: titleBarTasks.value.length })
})

const {
  sessions,
  activeSession,
  openedEditorItems,
  openFile: openEditorSession,
  openPreviewFile,
  activateSession,
  createDraftSession,
  updateDraftContent,
  setSessionDirtyState,
  updateSessionUiState,
  closeSession,
  closeWorkspaceSessions,
  detachWorkspaceSessions,
  closeSessionsByPath,
  saveSession,
  saveActiveSession,
  prepareSessionContent,
  remapSessionPaths,
  refreshSessionFromDisk,
  reconcileWorkspaceSessionsFromDisk,
} = useEditorSessionStore()

const {
  editorRef: currentEditorRef,
  component: currentEditorComponent,
  key: currentEditorKey,
  props: currentEditorProps,
  themeId: currentEditorThemeId,
  themeOverrides: currentEditorThemeOverrides,
  isCardDesigner: isActiveCardDesignerEditor,
  isDictionaryEditor: isActiveDictionaryEditor,
  cardDesignerMode: activeCardDesignerMode,
  dataTableWorkbookBusy: isDataTableWorkbookBusy,
  canExportDataTableWorkbook,
  importDataTableWorkbook,
  exportDataTableWorkbook,
  handleViewportTransform: handleViewportTransformUpdate,
  handleImagePreviewPixelated: handleImagePreviewPixelatedUpdate,
  handleCardDesignerMode: handleCardDesignerModeUpdate,
  handleCardDesignerLayout: handleCardDesignerLayoutUpdate,
  handleCardDesignerView: handleCardDesignerViewUpdate,
  handleModified: handleEditorModified,
  handleSaveEvent: handleEditorSave,
  save: triggerCurrentEditorSave,
  undo: triggerCurrentEditorUndo,
  redo: triggerCurrentEditorRedo,
  flushAffectedSessions: flushActiveEditorForClose,
  dispose: disposeEditorHost,
} = useShellEditorHost({
  activeSession,
  projectPath,
  projectProfile,
  settings: settingsStore.settings,
  sessionActions: {
    updateDraftContent,
    setSessionDirtyState,
    updateSessionUiState,
    saveActiveSession,
  },
})

const {
  readiness: versionReadiness,
  status: versionStatus,
  versions: projectVersions,
  fileVersions,
  localHistory: localHistoryEntries,
  historyPath,
  loadFileHistory,
  compareSession,
  writeState: versionWriteState,
  saveVersionConfirmation,
  pendingPublishVersion,
  lastError: versioningError,
  openSaveVersion,
  cancelSaveVersion,
  confirmSaveVersion,
  recordLocalHistory,
  openCompare,
  closeCompare,
  publishVersion,
  editReleaseDescription,
  restoreProject,
  restoreLocalHistory,
  deleteLocalHistory,
  prepare: prepareVersioning,
  dispose: disposeVersioning,
} = useVersioning({
  projectPath,
  sessions,
  flushAffectedSessions: flushActiveEditorForClose,
  prepareSessionContent,
  saveSession,
})
setLocalHistoryRecorder(recordLocalHistory)

const changeHistorySourceFilter = ref<'all' | 'version' | 'local-history'>('all')
const changeHistoryEmptyLabel = computed(() => {
  if (!activeSession.value || activeSession.value.resourceKind !== 'workspace') {
    return t('versioning.history.selectProjectFile')
  }
  if (changeHistorySourceFilter.value !== 'all') return t('versioning.history.emptyForSource')
  return t('versioning.history.empty')
})

const activeCompareKey = computed(() => compareSession.value
  ? `${compareSession.value.openedFromHistorySource}:${compareSession.value.openedFromHistoryItemId}`
  : null)

const currentDiffLanguage = computed(() => (
  activeSession.value?.path
    ? resolveFileType(activeSession.value.path).language ?? 'plaintext'
    : 'plaintext'
))

const editorPropsWithVersioning = computed(() => ({
  ...currentEditorProps.value,
  ...(activeSession.value?.editorId === 'project-config'
    ? {
        projectVersionManaged: versionReadiness.value.status === 'ready'
          && Boolean(versionStatus.value?.current),
        projectVersion: versionStatus.value?.current?.version,
      }
    : {}),
}))

watch(
  () => activeSession.value?.path,
  path => {
    if (compareSession.value && compareSession.value.sourcePath !== path) void closeCompare()
    const relativePath = path && projectPath.value
      ? getRelativeProjectPath(path)
      : null
    void loadFileHistory(relativePath ?? '')
  },
  { immediate: true },
)

const versioningErrorMessage = computed(() => (
  versioningError.value
    ? t('versioning.errors.saveFailed', { code: versioningError.value.code })
    : null
))
const selectedVersionInfoCommitId = ref<string | null>(null)
const publishVersionTargetCommitId = ref<string | null>(null)
const editReleaseMode = ref(false)
const selectedVersionInfo = computed<VersionRecordDto | null>(() => (
  projectVersions.value.find(version => version.commitId === selectedVersionInfoCommitId.value) ?? null
))
const publishVersionTarget = computed<VersionRecordDto | null>(() => (
  projectVersions.value.find(version => version.commitId === publishVersionTargetCommitId.value) ?? null
))
const canRenumberPublishTarget = computed(() => (
  Boolean(publishVersionTarget.value)
  && publishVersionTarget.value?.commitId === versionStatus.value?.current?.commitId
  && !publishVersionTarget.value?.release
  && !hasWorkspaceVersionChanges.value
))
const publishVersionErrorMessage = computed(() => (
  versioningError.value ? t('versioning.errors.publishFailed', { code: versioningError.value.code }) : null
))
const restoreVersionTargetCommitId = ref<string | null>(null)
const restoreDescription = ref('')
const restoreVersionTarget = computed<VersionRecordDto | null>(() => (
  projectVersions.value.find(version => version.commitId === restoreVersionTargetCommitId.value) ?? null
))
const restoreVersionErrorMessage = computed(() => (
  versioningError.value ? t('versioning.errors.restoreFailed', { code: versioningError.value.code }) : null
))
const localHistoryRestoreEntryId = ref<string | null>(null)
const localHistoryRestoreTarget = computed(() => localHistoryEntries.value.find(entry => (
  entry.entryId === localHistoryRestoreEntryId.value
)) ?? null)
const localHistoryRestoreBusy = ref(false)
const localHistoryRestoreError = ref('')
const localHistoryDeleteTarget = ref<LocalHistoryEntryDto | null>(null)
const localHistoryDeleteBusy = ref(false)
const localHistoryDeleteError = ref('')

const {
  isActivating: isActivatingProject,
  activationError: projectActivationError,
  openProject,
  openRecentProject,
  relocateRecentProject: relocateRecentProjectPath,
  activateCreatedProject: handleProjectCreated,
  enterCreateProject,
  completeProjectClose,
  ensureProjectTreeLoaded,
} = useShellProjectLifecycle({
  project: {
    projectPath,
    chooseProjectDirectory,
    setProjectPath,
    readDirectoryEntries,
  },
  sessions: {
    detachWorkspaceSessions,
    closeWorkspaceSessions,
    openFile: openEditorSession,
  },
  settings: {
    rememberRecentProject: settingsStore.rememberRecentProject,
    forgetRecentProject: settingsStore.forgetRecentProject,
  },
  templates: {
    load: templateStore.load,
  },
  shellPage,
  translate: t,
})

const {
  pendingIntent: pendingCloseIntent,
  decisions: unsavedEditorDecisions,
  isOpen: isUnsavedEditorsDialogOpen,
  isBusy: isUnsavedCloseBusy,
  globalError: unsavedCloseError,
  selectedCount: unsavedSelectedCount,
  pendingCount: unsavedPendingCount,
  saveCount: unsavedSaveCount,
  discardCount: unsavedDiscardCount,
  allPendingSelected: allUnsavedPendingSelected,
  somePendingSelected: someUnsavedPendingSelected,
  canConfirm: canConfirmUnsavedClose,
  setRowSelected: setUnsavedRowSelected,
  setAllPendingSelected: setAllUnsavedPendingSelected,
  markSelectedDiscard: markSelectedUnsavedDiscard,
  markSelectedSave: markSelectedUnsavedSave,
  resetDecision: resetUnsavedDecision,
  confirm: confirmUnsavedClose,
  cancel: cancelUnsavedClose,
  requestSessionClose,
  requestProjectClose,
  requestPathTrash,
  requestApplicationClose,
  requestFileRestore,
  discardSingle: discardSingleUnsavedEditor,
  saveSingle: saveSingleUnsavedEditor,
} = useShellCloseCoordinator({
  sessions,
  flushAffectedSessions: flushActiveEditorForClose,
  pickDraftDirectory: () => fileSystemService.pickDirectory(t('app.unsavedEditors.pickDraftDirectory')),
  fileExists: path => fileSystemService.fileExists(path),
  saveSession,
  completions: {
    sessions: performSessionClose,
    project: completeProjectClose,
    trash: performPathTrash,
    application: performApplicationClose,
    restoreFile: openLocalHistoryRestoreConfirmation,
  },
})

function formatSessionTitle(session: { name: string; resourceKind: 'workspace' | 'external' | 'draft' }): string {
  if (session.resourceKind === 'external') {
    return t('sidebar.editorTitles.external', { name: session.name })
  }
  if (session.resourceKind === 'draft') {
    return t('sidebar.editorTitles.draft', { name: session.name })
  }
  return session.name
}

const localizedOpenedEditorItems = computed(() => openedEditorItems.value.map((item) => ({
  ...item,
  label: formatSessionTitle({ name: item.label, resourceKind: item.resourceKind }),
})))

function getPathDirectory(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const separatorIndex = normalizedPath.lastIndexOf('/')
  return separatorIndex > 0 ? normalizedPath.slice(0, separatorIndex) : ''
}

const {
  issueTreeData,
  issueNavigationTargets,
  issueCount,
  highestIssueSeverity,
  expandedIssueKeys,
  reportSessionIssueSnapshot,
  clearAllSessionIssues,
  setIssueNodeExpanded,
} = useWorkspaceIssues({ sessions })
const visibleIssueTreeData = computed(() => isWorkbenchMode.value ? issueTreeData.value : EMPTY_TREE_DATA)
const visibleIssueCount = computed(() => isWorkbenchMode.value ? issueCount.value : 0)
const visibleIssueSeverity = computed(() => isWorkbenchMode.value ? highestIssueSeverity.value : null)

watch(locale, clearAllSessionIssues, { flush: 'sync' })
watch(projectPath, (nextPath, previousPath) => {
  if (nextPath !== previousPath) clearAllSessionIssues()
})

const {
  showExportRenderer,
  exportCardFace,
  exportResourceRootPath,
  exportRemoteResourcePolicy,
  exportProjectIconCatalog,
  isRunning: isProjectExportRunning,
  loadDocumentSnapshot,
  prepare: prepareProjectExport,
  run: runProjectExport,
} = useProjectExport({
  sessions,
  exportRendererRef,
  renderEnvironment: projectRenderEnvironment,
  readProjectFile,
  resolveProjectPath,
  getRelativeProjectPath,
  translate: t,
})

const {
  projectTreeData,
  projectExpandedKeys,
  openedEditorTreeData,
  selectedFileKeys,
  openedEditorSelectedKeys,
  handleOpenedEditorsSelect,
  handleFileTreeSelect,
  findProjectEntryByKey,
} = useShellFileTree({
  projectPath,
  indexedEntries,
  openedEditorItems: localizedOpenedEditorItems,
  activeSession,
  isDirectoryExpanded,
  activateSession,
  openPreviewFile,
  translate: t,
  registeredFontSources: computed(() => projectFontFiles.value.map(font => font.source)),
})

function createTemplateItems(templates: readonly ProjectTemplate[]): Map<string, OcTreeItem> {
  const items = new Map<string, OcTreeItem>()
  for (const template of templates) {
    items.set(template.key, { label: resolveProjectTemplateName(template, locale.value), icon: 'file.opencard' })
  }
  return items
}

function createEmptyCatalogItem(key: string, label: string): [string, OcTreeItem] {
  return [key, { label, icon: 'file.generic', disabled: true }]
}

function recentProjectKey(path: string): string {
  return `recent-project:${path}`
}

function createRecentProjectTreeData(
  paths: readonly string[],
  availability: ReadonlyMap<string, boolean>,
): OcTreeData {
  const items = new Map<string, OcTreeItem>()
  const rootKeys = paths.map((path) => {
    const key = recentProjectKey(path)
    const isMissing = availability.get(key) === false
    items.set(key, {
      label: path.split(/[/\\]/).filter(Boolean).pop() || path,
      icon: isMissing ? 'status.folder-alert' : 'status.folder-open',
      iconTone: isMissing ? 'warning' : undefined,
      actions: [
        isMissing ? RECENT_PROJECT_RELOCATE_ACTION_KEY : RECENT_PROJECT_OPEN_ACTION_KEY,
        RECENT_PROJECT_REMOVE_ACTION_KEY,
      ],
    })
    return key
  })
  return { rootKeys, items, children: new Map() }
}

const templateTreeData = computed<OcTreeData>(() => {
  const builtinKeys = templateStore.builtinTemplates.value.map(template => template.key)
  const userKeys = templateStore.userTemplates.value.map(template => template.key)
  const userChildren = userKeys.length > 0 ? userKeys : ['template-empty:user']
  const items = new Map<string, OcTreeItem>([
    [USER_TEMPLATES_GROUP_KEY, {
      label: t('projectTemplates.sections.user'),
      icon: 'file.package',
      actions: [IMPORT_TEMPLATE_ACTION_KEY],
    }],
    ...createTemplateItems(templateStore.templates.value),
    ...(!userKeys.length ? [createEmptyCatalogItem('template-empty:user', t('projectTemplates.status.noUserTemplates'))] : []),
  ])
  return {
    rootKeys: [...builtinKeys, USER_TEMPLATES_GROUP_KEY],
    items,
    children: new Map([
      [USER_TEMPLATES_GROUP_KEY, userChildren],
    ]),
  }
})
const iconPackTreeData = computed<OcTreeData>(() => createIconPackTreeData(iconPackStore.packs.value))
const customBlockTreeData = computed<OcTreeData>(() => createCustomBlockTreeData(customBlockCatalogStore.blocks.value))
const recentProjectAvailability = ref<ReadonlyMap<string, boolean>>(new Map())
const recentProjectTreeData = computed(() => (
  createRecentProjectTreeData(
    settingsStore.settings.value.projectCreation.recentProjects,
    recentProjectAvailability.value,
  )
))

function formatVersionTime(timestamp: number): string {
  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(deltaSeconds)
  const [value, unit] = absoluteSeconds < 60
    ? [deltaSeconds, 'second'] as const
    : absoluteSeconds < 3600
      ? [Math.round(deltaSeconds / 60), 'minute'] as const
      : absoluteSeconds < 86400
        ? [Math.round(deltaSeconds / 3600), 'hour'] as const
        : absoluteSeconds < 2592000
          ? [Math.round(deltaSeconds / 86400), 'day'] as const
          : [Math.round(deltaSeconds / 2592000), 'month'] as const
  return new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }).format(value, unit)
}

const versionTreeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  const rootKeys = projectVersions.value.map(version => {
    const key = `version:${version.commitId}`
    const isCurrent = versionStatus.value?.current?.commitId === version.commitId
    const labels = [
      isCurrent ? t('versioning.list.current') : undefined,
      version.release ? t('versioning.list.published') : t('versioning.list.saved'),
    ].filter((value): value is string => Boolean(value))
    items.set(key, {
      label: `v${version.version}`,
      description: version.description,
      tail: [...labels, formatVersionTime(version.savedAtUnixMs)].join(' · '),
      icon: 'data.version',
      iconTone: isCurrent ? 'primary' : version.release ? 'success' : undefined,
    })
    return key
  })
  return { rootKeys, items, children: new Map() }
})
const selectedRecentProjectKeys = ref<string[]>([])
const selectedVersionKeys = ref<string[]>([])
watch(projectPath, () => {
  selectedRecentProjectKeys.value = []
  selectedVersionKeys.value = []
}, { flush: 'sync' })

let recentProjectProbeRevision = 0
watch(
  () => settingsStore.settings.value.projectCreation.recentProjects,
  async (paths) => {
    const revision = ++recentProjectProbeRevision
    const entries = await Promise.all(paths.map(async (path) => (
      [recentProjectKey(path), await isProjectAvailable(path)] as const
    )))
    if (revision !== recentProjectProbeRevision) return
    recentProjectAvailability.value = new Map(entries)
  },
  { immediate: true },
)
watch(
  () => templateStore.templates.value,
  (templates) => {
    if (selectedTemplateKey.value && templates.some((template) => template.key === selectedTemplateKey.value)) return
    selectedTemplateKey.value = templates[0]?.key ?? null
  },
  { immediate: true },
)
watch(
  () => iconPackStore.packs.value,
  (packs) => {
    selectedIconPackKeys.value = selectedIconPackKeys.value.filter((key) => packs.some((pack) => pack.key === key))
  },
  { immediate: true },
)
watch(
  () => customBlockCatalogStore.blocks.value,
  (blocks) => {
    selectedCustomBlockKeys.value = selectedCustomBlockKeys.value.filter((key) => (
      blocks.some(block => block.key === key)
    ))
  },
  { immediate: true },
)

const projectName = computed(() => {
  if (!projectPath.value) return ''
  return projectInformation.value?.name || projectPath.value.split(/[/\\]/).pop() || ''
})

const projectFolderName = computed(() => {
  if (!projectPath.value) return ''
  return projectPath.value.split(/[/\\]/).filter(Boolean).pop() || ''
})

function hasRootProjectFile(fileName: string): boolean {
  const expectedType = resolveFileType(`${projectPath.value}/${fileName}`, projectPath.value).id
  return indexedEntries.value.some(entry => !entry.isDirectory && (
    resolveFileType(`${projectPath.value}/${entry.name}`, projectPath.value).id === expectedType
  ))
}

const shellMainStyle = computed(() => ({
  '--shell-sidebar-width': effectiveSidebarCollapsed.value ? '0px' : `${sidebarWidth.value}px`,
}))

const openedEditorActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [OPENED_EDITOR_CLOSE_ACTION_KEY, {
    title: t('sidebar.closeEditor', 'Close editor'),
    icon: 'action.close',
  }],
]))

const templateCatalogActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [IMPORT_TEMPLATE_ACTION_KEY, {
    title: t('projectTemplates.actions.import'),
    icon: 'action.import',
  }],
]))

const iconPackActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [REGISTER_ICON_PACK_ACTION_KEY, {
    title: t('projectTemplates.actions.registerIconPack'),
    icon: 'action.add',
  }],
  [REGISTERED_ICON_PACK_ACTION_KEY, {
    title: t('projectTemplates.status.iconPackRegistered'),
    icon: 'action.check',
    iconTone: 'success',
  }],
]))

const customBlockActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [REGISTER_CUSTOM_BLOCK_ACTION_KEY, {
    title: t('projectTemplates.actions.registerCustomBlock'),
    icon: 'action.add',
  }],
  [REGISTERED_CUSTOM_BLOCK_ACTION_KEY, {
    title: t('projectTemplates.status.customBlockRegistered'),
    icon: 'action.check',
    iconTone: 'success',
  }],
]))

const projectEntryActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => {
  const actions = new Map<string, OcTreeActionDefinition>([[PROJECT_ENTRY_RENAME_ACTION_KEY, {
    title: t('sidebar.fileActions.rename'),
    icon: 'action.edit',
  }],
  [PROJECT_ENTRY_REVEAL_ACTION_KEY, {
    title: t('sidebar.fileActions.reveal'),
    icon: 'status.folder-open',
  }],
  [PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY, {
    title: t('sidebar.fileActions.copyRelativePath'),
    icon: 'action.copy',
  }],
  [PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY, {
    title: t('sidebar.fileActions.copyAbsolutePath'),
    icon: 'action.copy',
  }],
  ])

  for (const [entryKey, item] of projectTreeData.value.items) {
    const moreActionKey = projectEntryMoreActionKey(entryKey)
    const deleteActionKey = projectEntryDeleteActionKey(entryKey)
    const confirmDeleteActionKey = projectEntryConfirmDeleteActionKey(entryKey)
    const children = [
      ...(item.renamable === false ? [] : [PROJECT_ENTRY_RENAME_ACTION_KEY]),
      deleteActionKey,
      PROJECT_ENTRY_REVEAL_ACTION_KEY,
      PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY,
      PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY,
    ]
    actions.set(moreActionKey, {
      title: t('sidebar.fileActions.more'),
      icon: 'nav.more',
      children,
    })
    actions.set(deleteActionKey, {
      title: t('sidebar.fileActions.delete'),
      icon: 'action.delete',
      children: [confirmDeleteActionKey],
    })
    actions.set(confirmDeleteActionKey, {
      title: t('sidebar.fileActions.confirmDeleteFile', {
        fileName: entryKey.split(/[\\/]/).pop() ?? item.label,
      }),
      icon: 'action.delete',
      iconTone: 'danger',
    })
  }
  return actions
})

const recentProjectActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [RECENT_PROJECT_OPEN_ACTION_KEY, {
    title: t('sidebar.openRecentProject'),
    icon: 'action.play',
    iconTone: 'success',
  }],
  [RECENT_PROJECT_RELOCATE_ACTION_KEY, {
    title: t('sidebar.relocateRecentProject'),
    icon: 'status.folder-open',
  }],
  [RECENT_PROJECT_REMOVE_ACTION_KEY, {
    title: t('sidebar.removeRecentProject'),
    icon: 'action.close',
  }],
]))

const exportTemplateTreeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [TEMPLATE_EXCLUDE_ACTION_KEY, {
    title: t('templateExport.tree.exclude'),
    icon: 'status.eye-off',
  }],
  [TEMPLATE_INCLUDE_ACTION_KEY, {
    title: t('templateExport.tree.include'),
    icon: 'status.eye',
  }],
  [TEMPLATE_COVER_ADD_ACTION_KEY, {
    title: t('templateExport.tree.addCover'),
    icon: 'action.image-plus',
  }],
  [TEMPLATE_COVER_REMOVE_ACTION_KEY, {
    title: t('templateExport.tree.removeCover'),
    icon: 'action.image-minus',
  }],
  [TEMPLATE_ENTRY_ADD_ACTION_KEY, {
    title: t('templateExport.tree.addEntry'),
    icon: 'action.file-plus',
  }],
  [TEMPLATE_ENTRY_REMOVE_ACTION_KEY, {
    title: t('templateExport.tree.removeEntry'),
    icon: 'action.file-minus',
  }],
]))

function normalizeTreePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function exportRelativePath(key: string): string {
  const root = normalizeTreePath(projectPath.value)
  const normalized = normalizeTreePath(key)
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized
}

function pathContains(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent}/`)
}

function isExportPathExcluded(relativePath: string): boolean {
  return relativePath === '.opencard-cache'
    || relativePath.startsWith('.opencard-cache/')
    || exportTemplateSelection.value.excludedPaths.some((excluded) => pathContains(excluded, relativePath))
}

const exportTemplateTreeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  for (const [key, item] of projectTreeData.value.items) {
    const relativePath = exportRelativePath(key)
    const isProjectFile = [
      '.ocproject',
      '.ocfonts',
      '.ocicons',
      '.ocblocks',
      '.oclocale',
    ].includes(relativePath)
    const isRuntimeCache = relativePath === '.opencard-cache' || relativePath.startsWith('.opencard-cache/')
    const isExcluded = isExportPathExcluded(relativePath)
    const isImage = resolveFileType(key).id === 'image'
    const isOpenCard = relativePath.toLowerCase().endsWith(CARD_DOCUMENT_SUFFIX)
    const actions: string[] = []

    if (!isProjectFile && !isRuntimeCache) {
      actions.push(isExcluded ? TEMPLATE_INCLUDE_ACTION_KEY : TEMPLATE_EXCLUDE_ACTION_KEY)
    }
    if (!isExcluded && isImage) {
      actions.push(exportTemplateSelection.value.covers.includes(relativePath)
        ? TEMPLATE_COVER_REMOVE_ACTION_KEY
        : TEMPLATE_COVER_ADD_ACTION_KEY)
    }
    if (!isExcluded && isOpenCard) {
      actions.push(exportTemplateSelection.value.entries.includes(relativePath)
        ? TEMPLATE_ENTRY_REMOVE_ACTION_KEY
        : TEMPLATE_ENTRY_ADD_ACTION_KEY)
    }

    items.set(key, {
      ...item,
      iconTone: isExcluded ? 'muted' : item.iconTone,
      disabled: isRuntimeCache,
      disabledReason: isRuntimeCache ? t('templateExport.tree.runtimeCache') : undefined,
      actions,
    })
  }
  return {
    rootKeys: projectTreeData.value.rootKeys,
    items,
    children: projectTreeData.value.children,
  }
})

const exportTemplateExpandedKeys = computed(() => [...projectTreeData.value.children.keys()])

function createExportSelectionTreeData(
  paths: readonly string[],
  prefix: string,
  icon: OcTreeItem['icon'],
  removeAction: string,
  labels: Readonly<Record<string, string>> = {},
): OcTreeData {
  const rootKeys = paths.map((path) => `${prefix}${path}`)
  return {
    rootKeys,
    items: new Map(paths.map((path) => [`${prefix}${path}`, {
      label: labels[path] ?? path,
      icon,
      actions: [removeAction],
    }])),
    children: new Map(),
  }
}

const exportTemplateEntryTreeData = computed(() => createExportSelectionTreeData(
  exportTemplateSelection.value.entries,
  TEMPLATE_ENTRY_TREE_PREFIX,
  'file.opencard',
  TEMPLATE_ENTRY_REMOVE_ACTION_KEY,
  exportTemplateSelection.value.entryNames,
))

const exportTemplateCoverTreeData = computed(() => createExportSelectionTreeData(
  exportTemplateSelection.value.covers,
  TEMPLATE_COVER_TREE_PREFIX,
  'file.image',
  TEMPLATE_COVER_REMOVE_ACTION_KEY,
))

const updateOperationProgress = computed<number | null>(() => {
  const isPreview = import.meta.env.DEV && developerMode.value && !availableUpdate.value
  if (!availableUpdate.value && !isPreview) return null
  return availableUpdate.value
    ? (isInstallingUpdate.value ? updateInstallProgress.value ?? 0 : null)
    : developerUpdateProgress.value
})

watch([updateOperationProgress, locale], ([progress]) => {
  if (progress == null) {
    removeShellProgressTask(UPDATE_PROGRESS_TASK_KEY)
    return
  }
  setShellProgressTask({
    key: UPDATE_PROGRESS_TASK_KEY,
    title: t('app.updater.installing'),
    progress,
    weight: 1,
  })
}, { immediate: true })

const titleBarAppActions = computed<ShellTitleBarAppAction[]>(() => {
  const isPreview = import.meta.env.DEV && developerMode.value && !availableUpdate.value
  if (!availableUpdate.value && !isPreview) return []

  const progress = updateOperationProgress.value
  const disabled = availableUpdate.value
    ? isInstallingUpdate.value
    : progress !== null && progress < 1

  return [{
    key: 'install-update',
    icon: 'action.download',
    disabled,
    hoverTip: progress !== null
      ? t('app.updater.installingProgress', { progress: Math.round(progress * 100) })
      : isPreview
        ? t('app.updater.previewAvailable')
        : t('app.updater.available', { version: updateVersion.value }),
  }]
})

const primaryPageToggleAction = computed<ShellTitleBarAppAction>(() => {
  const targetPage = getOtherPrimaryShellPage(shellPage.value)
  return {
    key: 'toggle-primary-page',
    icon: targetPage === 'workbench' ? 'nav.workbench' : 'nav.welcome',
    hoverTip: targetPage === 'workbench'
      ? t('app.menu.goWorkbench')
      : t('app.menu.returnWelcome'),
  }
})

const windowControls = computed<ShellTitleBarWindowControl[]>(() => [
  {
    key: 'toggle-fullscreen',
    icon: isWindowFullscreen.value ? 'window.fullscreen-exit' : 'window.fullscreen',
    group: 'app',
    hoverTip: isWindowFullscreen.value
      ? t('app.shell.exitFullscreen')
      : t('app.shell.enterFullscreen'),
  },
  ...(!usesNativeMacosWindowControls ? [
    { key: 'minimize', icon: 'window.minimize', group: 'window', hoverTip: t('app.shell.minimize') },
    {
      key: 'toggle-maximize',
      icon: isWindowMaximized.value ? 'window.restore' : 'window.maximize',
      group: 'window',
      hoverTip: isWindowMaximized.value ? t('app.shell.restore') : t('app.shell.maximize'),
    },
    { key: 'close', icon: 'action.close', group: 'window', hoverTip: t('app.shell.close'), danger: true },
  ] satisfies ShellTitleBarWindowControl[] : []),
])

const hasWorkspaceVersionChanges = computed(() => (
  (versionStatus.value?.changeSummary.files.length ?? 0) > 0
  || sessions.value.some(session => session.resourceKind === 'workspace' && session.isDirty)
))

const sidebarHeadButtons = computed<ShellButton[]>(() => {
  if (isCreateProjectMode.value || isExportTemplateMode.value) {
    return [{
      key: 'return-primary-page',
      icon: 'nav.arrow-left',
      title: t('projectTemplates.actions.back'),
      disabled: isProjectTemplateBusy.value || isExportTemplateBusy.value,
    }]
  }
  if (isSettingsMode.value) {
    return [{ key: 'return-primary-page', icon: 'nav.arrow-left', title: t('settings.actions.back', 'Back') }]
  }
  if (isAboutMode.value) {
    return [{ key: 'return-primary-page', icon: 'nav.arrow-left', title: t('app.about.back') }]
  }
  if (isWelcomeMode.value) {
    return [
      { key: 'new-project', icon: 'action.folder-plus', title: t('app.menu.newProject') },
      { key: 'open-project', icon: 'status.folder-open', title: t('sidebar.openProject') },
    ]
  }
  return [
    { key: 'new-open-card', icon: 'action.file-plus', title: t('app.menu.newOpenCard') },
    {
      key: 'save-version',
      icon: 'action.save',
      title: t('versioning.save.title'),
      disabled: !projectPath.value
        || versionReadiness.value.status !== 'ready'
        || versionWriteState.value.status !== 'idle'
        || !hasWorkspaceVersionChanges.value,
    },
    {
      key: 'publish-version',
      icon: 'action.publish',
      title: t('app.menu.publishVersion'),
      disabled: !versionStatus.value?.hasManagedContent
        || (!versionStatus.value.current && !hasWorkspaceVersionChanges.value)
        || (!hasWorkspaceVersionChanges.value && Boolean(versionStatus.value.current?.release))
        || versionReadiness.value.status !== 'ready'
        || versionWriteState.value.status !== 'idle'
        || Boolean(compareSession.value),
    },
  ]
})

const sidebarTailButtons = computed<ShellButton[]>(() => {
  if (isAuxiliaryMode.value) return []
  return [{ key: 'open-settings', icon: 'tool.settings', title: t('settings.title', 'Settings') }]
})

const sidebarBodyLists = computed<ShellList[]>(() => {
  if (isAboutMode.value) return []

  if (isSettingsMode.value) {
    return [{
      key: SETTINGS_CATEGORIES_LIST_KEY,
      title: t('settings.title', 'Settings'),
      placeholder: '',
      actions: [],
    }]
  }

  if (isCreateProjectMode.value) {
    return [
      {
        key: TEMPLATES_LIST_KEY,
        title: t('projectTemplates.sections.templates'),
        placeholder: '',
        actions: [],
      },
      {
        key: ICON_PACKS_LIST_KEY,
        title: t('projectTemplates.sections.iconPacks'),
        placeholder: iconPackStore.isLoading.value
          ? t('projectTemplates.status.loadingIconPacks')
          : t('projectTemplates.status.noIconPacks'),
        actions: [{
          key: IMPORT_ICON_PACK_ACTION_KEY,
          icon: 'action.import',
          hoverTip: t('projectTemplates.actions.importIconPack'),
          disabled: isProjectTemplateBusy.value || iconPackStore.isLoading.value,
        }],
      },
      {
        key: CUSTOM_BLOCKS_LIST_KEY,
        title: t('projectTemplates.sections.customBlocks'),
        placeholder: customBlockCatalogStore.isLoading.value
          ? t('projectTemplates.status.loadingCustomBlocks')
          : customBlockCatalogStore.error.value
            ? t('projectTemplates.errors.invalidCustomBlockCatalog')
            : t('projectTemplates.status.noCustomBlocks'),
        actions: [{
          key: IMPORT_CUSTOM_BLOCK_ACTION_KEY,
          icon: 'action.import',
          hoverTip: t('projectTemplates.actions.importCustomBlock'),
          disabled: isProjectTemplateBusy.value || customBlockCatalogStore.isLoading.value,
        }],
      },
    ]
  }

  if (isExportTemplateMode.value) {
    return [
      {
        key: PROJECT_FILES_LIST_KEY,
        title: projectFolderName.value || t('sidebar.files'),
        placeholder: t('sidebar.emptyProject', 'Folder is empty'),
        actions: [],
        maxHeight: 'var(--oc-list-max-height-lg)',
      },
      {
        key: TEMPLATE_ENTRIES_LIST_KEY,
        title: t('projectTemplates.fields.entry'),
        placeholder: t('templateExport.noSelectedEntries'),
        actions: [],
        maxHeight: 'var(--oc-list-max-height-md)',
      },
      {
        key: TEMPLATE_COVERS_LIST_KEY,
        title: t('projectTemplates.fields.covers'),
        placeholder: t('templateExport.noSelectedCovers'),
        actions: [],
        maxHeight: 'var(--oc-list-max-height-md)',
      },
    ]
  }

  if (isWelcomeMode.value) {
    return [{
      key: RECENT_PROJECTS_LIST_KEY,
      title: t('sidebar.recentProjects'),
      placeholder: t('sidebar.noRecentProjects'),
      actions: [],
    }]
  }

  return [
    {
      key: OPENED_EDITORS_LIST_KEY,
      title: t('sidebar.openedEditors'),
      placeholder: t('sidebar.noOpenedEditors', 'No open editors'),
      actions: [],
    },
    {
      key: PROJECT_FILES_LIST_KEY,
      title: projectFolderName.value || t('sidebar.files'),
      placeholder: projectPath.value
        ? t('sidebar.emptyProject', 'Folder is empty')
        : t('sidebar.openProject', 'Open Project Folder'),
      actions: [
        {
          key: PROJECT_NEW_FILE_ACTION_KEY,
          icon: 'action.file-plus',
          hoverTip: t('sidebar.fileActions.newFile'),
          disabled: !projectPath.value,
          children: [
            {
              key: PROJECT_NEW_OPENCARD_ACTION_KEY,
              title: t('sidebar.fileActions.newOpenCard'),
              icon: 'file.opencard',
            },
            ...(!hasRootProjectFile('.ocproject') ? [{
              key: PROJECT_NEW_PROFILE_ACTION_KEY,
              title: t('sidebar.fileActions.newProjectProfile'),
              icon: 'file.opencard-project' as const,
            }] : []),
            ...(!hasRootProjectFile('.ocfonts') ? [{
              key: PROJECT_NEW_FONT_REGISTRY_ACTION_KEY,
              title: t('sidebar.fileActions.newFontRegistry'),
              icon: 'file.font' as const,
            }] : []),
            ...(!hasRootProjectFile('.ocicons') ? [{
              key: PROJECT_NEW_ICON_REGISTRY_ACTION_KEY,
              title: t('sidebar.fileActions.newIconRegistry'),
              icon: 'file.package-variant' as const,
            }] : []),
            ...(!hasRootProjectFile('.ocblocks') ? [{
              key: PROJECT_NEW_CUSTOM_BLOCK_REGISTRY_ACTION_KEY,
              title: t('sidebar.fileActions.newCustomBlockRegistry'),
              icon: 'file.custom-block' as const,
            }] : []),
            ...(!hasRootProjectFile('.oclocale') ? [{
              key: PROJECT_NEW_DICTIONARY_ACTION_KEY,
              title: t('sidebar.fileActions.newDictionary'),
              icon: 'data.collection' as const,
            }] : []),
          ],
        },
        {
          key: PROJECT_NEW_FOLDER_ACTION_KEY,
          icon: 'action.folder-plus',
          hoverTip: t('sidebar.fileActions.newFolder'),
          disabled: !projectPath.value,
        },
      ],
    },
    {
      key: CHANGES_LIST_KEY,
      title: t('sidebar.changes'),
      placeholder: t('sidebar.comingSoon'),
      actions: [{
        key: CHANGE_HISTORY_REFRESH_ACTION_KEY,
        icon: 'action.refresh',
        hoverTip: t('versioning.actions.refresh'),
        disabled: !historyPath.value,
      }, {
        key: CHANGE_HISTORY_FILTER_ACTION_KEY,
        icon: 'data.collection',
        hoverTip: t('versioning.history.filterTitle'),
        children: [{
          key: CHANGE_HISTORY_FILTER_ALL_ACTION_KEY,
          title: t('versioning.history.filters.all'),
          icon: changeHistorySourceFilter.value === 'all' ? 'action.check' : undefined,
        }, {
          key: CHANGE_HISTORY_FILTER_VERSION_ACTION_KEY,
          title: t('versioning.history.filters.versions'),
          icon: changeHistorySourceFilter.value === 'version' ? 'action.check' : undefined,
        }, {
          key: CHANGE_HISTORY_FILTER_LOCAL_ACTION_KEY,
          title: t('versioning.history.filters.localHistory'),
          icon: changeHistorySourceFilter.value === 'local-history' ? 'action.check' : undefined,
        }],
      }],
      maxHeight: 'var(--oc-list-max-height-md)',
    },
    {
      key: VERSION_LIST_KEY,
      title: t('sidebar.versions'),
      placeholder: versionReadiness.value.status === 'preparing'
        ? t('versioning.list.loading')
        : versionReadiness.value.status === 'degraded'
          ? t('versioning.list.unavailable')
          : t('versioning.list.empty'),
      actions: [{
        key: 'version-history.refresh',
        icon: 'action.refresh',
        hoverTip: t('versioning.actions.refresh'),
        disabled: !projectPath.value || versionReadiness.value.status === 'preparing',
      }],
      maxHeight: 'var(--oc-list-max-height-md)',
    },
  ]
})

const sidebarBottomLists = computed(() => sidebarBodyLists.value.filter(list => (
  list.key === CHANGES_LIST_KEY || list.key === VERSION_LIST_KEY
)))
const sidebarScrollableLists = computed(() => sidebarBodyLists.value.filter(list => (
  list.key !== CHANGES_LIST_KEY && list.key !== VERSION_LIST_KEY
)))

const developerModeMenuActions = computed<readonly OcActionMenuEntry[]>(() => (
  import.meta.env.DEV
    ? [{
        key: 'toggle-developer-mode',
        title: developerMode.value
          ? t('app.updater.disableDeveloperMode')
          : t('app.updater.enableDeveloperMode'),
        icon: developerMode.value ? 'action.check' : 'format.code-braces',
      }]
    : []
))

const titleBarMenus = computed<ShellTitleBarMenuGroup[]>(() => [
  {
    key: 'file',
    label: t('app.menu.file'),
    actions: [
      {
        key: 'new-project',
        title: projectPath.value ? t('app.menu.closeAndNewProject') : t('app.menu.newProject'),
        icon: 'action.folder-plus',
        shortcut: shellShortcutParts.newProject,
      },
      {
        key: 'new-open-card',
        title: t('app.menu.newOpenCard'),
        icon: 'action.file-plus',
        shortcut: shellShortcutParts.newOpenCard,
      },
      { type: 'divider', key: 'file-open-divider' },
      { key: 'open-project', title: t('sidebar.openProject'), icon: 'status.folder-open' },
      {
        key: 'close-project-folder',
        title: t('app.menu.closeProjectFolder'),
        icon: 'action.close',
        disabled: !projectPath.value,
      },
      {
        key: 'close-project-and-welcome',
        title: t('app.menu.closeProjectAndWelcome'),
        icon: 'nav.compass',
        disabled: !projectPath.value,
      },
      { type: 'divider', key: 'file-save-divider' },
      {
        key: 'save-active-editor',
        title: t('app.menu.save'),
        icon: 'action.save',
        shortcut: shellShortcutParts.save,
        disabled: !activeSession.value || Boolean(compareSession.value),
      },
      { type: 'divider', key: 'file-export-divider' },
      {
        key: 'export-project-template',
        title: t('templateExport.menu'),
        icon: 'action.export',
        disabled: !projectPath.value,
      },
      {
        key: 'export-card-documents',
        title: t('app.menu.exportCardDocuments'),
        icon: 'action.export',
        disabled: !projectPath.value,
      },
    ],
  },
  {
    key: 'edit',
    label: t('app.menu.edit'),
    actions: [
      {
        key: 'undo-active-editor',
        title: t('app.menu.undo'),
        icon: 'action.undo',
        shortcut: shellShortcutParts.undo,
        disabled: !isActiveCardDesignerEditor.value,
      },
      {
        key: 'redo-active-editor',
        title: t('app.menu.redo'),
        icon: 'action.redo',
        shortcut: shellShortcutParts.redo,
        disabled: !isActiveCardDesignerEditor.value,
      },
      { type: 'divider', key: 'edit-settings-divider' },
      { key: 'open-settings', title: t('settings.title'), icon: 'tool.settings' },
    ],
  },
  {
    key: 'view',
    label: t('app.menu.view'),
    actions: [
      {
        key: 'show-welcome',
        title: t('app.menu.showWelcome'),
        icon: 'nav.compass',
        disabled: isWelcomeMode.value,
      },
      {
        key: 'show-workbench',
        title: t('app.menu.showWorkbench'),
        icon: 'nav.files',
        disabled: isWorkbenchMode.value,
      },
      { type: 'divider', key: 'view-page-divider' },
      {
        key: 'toggle-sidebar',
        title: sidebarCollapsed.value ? t('app.shell.expandSidebar') : t('app.shell.collapseSidebar'),
        icon: sidebarCollapsed.value ? 'nav.sidebar-expand' : 'nav.sidebar-collapse',
      },
      {
        key: 'toggle-bottom-panel',
        title: isBottomPanelExpanded.value
          ? t('app.shell.collapseBottomPanel')
          : t('app.shell.expandBottomPanel'),
        icon: isBottomPanelExpanded.value ? 'nav.chevron-down' : 'nav.chevron-up',
      },
      { type: 'divider', key: 'view-window-divider' },
      {
        key: 'toggle-fullscreen',
        title: isWindowFullscreen.value
          ? t('app.shell.exitFullscreen')
          : t('app.shell.enterFullscreen'),
        icon: isWindowFullscreen.value ? 'window.fullscreen-exit' : 'window.fullscreen',
        shortcut: shellShortcutParts.fullscreen,
      },
    ],
  },
  {
    key: 'help',
    label: t('app.menu.help'),
    actions: [
      {
        key: 'check-for-updates',
        title: isCheckingForUpdate.value
          ? t('app.updater.checking')
          : t('app.updater.check'),
        icon: 'action.refresh',
        disabled: isCheckingForUpdate.value || isInstallingUpdate.value,
      },
      ...developerModeMenuActions.value,
      { type: 'divider', key: 'help-feedback-divider' },
      {
        key: 'send-feedback',
        title: t('app.menu.sendFeedback'),
        icon: 'action.edit',
      },
      {
        key: 'view-feedback',
        title: t('app.menu.viewFeedback'),
        icon: 'data.list-selection',
      },
      { type: 'divider', key: 'help-about-divider' },
      {
        key: 'about-opencard',
        title: t('app.menu.aboutOpenCard'),
        icon: 'status.unknown',
      },
    ],
  },
])

const workspaceTitle = computed(() => {
  if (isCreateProjectMode.value) return t('projectTemplates.title')
  if (isExportTemplateMode.value) return t('templateExport.title')
  if (isSettingsMode.value) return activeSettingsCategory.value.title
  if (isAboutMode.value) return t('app.about.title')
  if (isWelcomeMode.value) return 'OpenCard'
  return activeSession.value
    ? formatSessionTitle(activeSession.value)
    : projectName.value || t('app.menu.workbench')
})

const workspaceActions = computed<ShellAction[]>(() => {
  if (!isWorkbenchMode.value) return []
  if (isActiveDictionaryEditor.value) return [
    {
      key: DICTIONARY_IMPORT_ACTION_KEY,
      icon: 'action.import',
      hoverTip: t('dictionaryEditor.workbook.import'),
      disabled: isDataTableWorkbookBusy.value,
    },
    {
      key: DICTIONARY_EXPORT_ACTION_KEY,
      icon: 'action.export',
      hoverTip: t('dictionaryEditor.workbook.export'),
      disabled: isDataTableWorkbookBusy.value || !canExportDataTableWorkbook.value,
    },
  ]
  if (!isActiveCardDesignerEditor.value) return []
  const tableMode = activeCardDesignerMode.value === 'data-table'
  const modeAction: ShellAction = {
    key: CARD_DESIGNER_MODE_ACTION_KEY,
    icon: tableMode ? 'file.opencard' : 'data.table',
    hoverTip: tableMode
      ? t('cardDesigner.dataTable.switchToDesignMode')
      : t('cardDesigner.dataTable.switchToTableMode'),
  }
  if (!tableMode) return [modeAction]
  return [
    {
      key: CARD_DATA_TABLE_IMPORT_ACTION_KEY,
      icon: 'action.import',
      hoverTip: t('cardDesigner.dataTable.importWorkbook'),
      disabled: isDataTableWorkbookBusy.value,
    },
    {
      key: CARD_DATA_TABLE_EXPORT_ACTION_KEY,
      icon: 'action.export',
      hoverTip: t('cardDesigner.dataTable.exportWorkbook'),
      disabled: isDataTableWorkbookBusy.value || !canExportDataTableWorkbook.value,
    },
    modeAction,
  ]
})

function handleEditorIssueSnapshot(sessionId: string, snapshot: EditorIssueSnapshot): void {
  reportSessionIssueSnapshot(sessionId, snapshot)
}

async function handleWorkspaceIssueNavigate(request: SessionIssueNavigationRequest): Promise<void> {
  await navigateWorkspaceIssue(request, {
    hasSession: (sessionId) => sessions.value.some((session) => session.id === sessionId),
    activateSession,
    waitForEditorMount: nextTick,
    getActiveSessionId: () => activeSession.value?.id ?? null,
    getEditorNavigator: () => currentEditorRef.value,
  })
}

async function handleProjectTreeItemToggle(itemKey: string, expanded: boolean) {
  const entry = findProjectEntryByKey(itemKey)
  if (!entry?.isDirectory) {
    return
  }

  setDirectoryExpanded(entry.key, expanded)

  if (!expanded) {
    return
  }

  try {
    await readDirectoryEntries(entry.key)
  } catch (error) {
    reportAppError('OC-E2001', { path: entry.key, error })
  }
}

async function handleTemplateTreeIntent(intent: OcTreeIntent): Promise<void> {
  if (intent.type === 'action.invoke') {
    if (intent.key !== USER_TEMPLATES_GROUP_KEY || intent.actionKey !== IMPORT_TEMPLATE_ACTION_KEY
      || isProjectTemplateBusy.value || templateStore.isLoading.value) return
    await createProjectWorkspaceRef.value?.beginImport()
    return
  }
  if (intent.type !== 'selection.change') return
  const key = intent.selectedKeys[0] as ProjectTemplateKey | undefined
  if (key && templateStore.findTemplate(key)) selectedTemplateKey.value = key
}

function handleIconPackTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'action.invoke' || intent.actionKey !== REGISTER_ICON_PACK_ACTION_KEY) return
  const key = intent.key as ProjectIconPackCatalogKey
  if (!iconPackStore.findPack(key) || selectedIconPackKeys.value.includes(key)) return
  selectedIconPackKeys.value = [...selectedIconPackKeys.value, key]
}

function handleCustomBlockTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'action.invoke' || intent.actionKey !== REGISTER_CUSTOM_BLOCK_ACTION_KEY) return
  const key = intent.key as UserCustomBlockCatalogKey
  if (!customBlockCatalogStore.findBlock(key) || selectedCustomBlockKeys.value.includes(key)) return
  selectedCustomBlockKeys.value = [...selectedCustomBlockKeys.value, key]
}

function handleRecentProjectTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    selectedRecentProjectKeys.value = intent.selectedKeys
    return
  }
  if (intent.type !== 'node.activate' && intent.type !== 'action.invoke') return
  const path = settingsStore.settings.value.projectCreation.recentProjects.find((item) => (
    recentProjectKey(item) === intent.key
  ))
  if (!path) return

  if (intent.type === 'action.invoke' && intent.actionKey === RECENT_PROJECT_REMOVE_ACTION_KEY) {
    settingsStore.forgetRecentProject(path)
    selectedRecentProjectKeys.value = selectedRecentProjectKeys.value.filter((key) => key !== intent.key)
    return
  }

  if (intent.type === 'action.invoke' && intent.actionKey === RECENT_PROJECT_RELOCATE_ACTION_KEY) {
    void relocateRecentProject(path)
    return
  }

  if (recentProjectAvailability.value.get(intent.key) === false) return

  const shouldOpen = intent.type === 'node.activate'
    || (intent.type === 'action.invoke' && intent.actionKey === RECENT_PROJECT_OPEN_ACTION_KEY)
  if (shouldOpen) void openRecentProject(path)
}

function handleVersionTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    selectedVersionKeys.value = intent.selectedKeys
    return
  }
  if (intent.type === 'node.activate') {
    selectedVersionKeys.value = [intent.key]
    selectedVersionInfoCommitId.value = intent.key.replace(/^version:/, '')
  }
}

function openPublishDialog(editRelease: boolean): void {
  const target = selectedVersionInfo.value ?? versionStatus.value?.current ?? null
  if (!target || (editRelease ? !target.release : Boolean(target.release))) return
  publishVersionTargetCommitId.value = target.commitId
  editReleaseMode.value = editRelease
}

function openRestoreDialog(): void {
  const target = selectedVersionInfo.value
  if (!target || hasWorkspaceVersionChanges.value
    || target.commitId === versionStatus.value?.current?.commitId) return
  restoreVersionTargetCommitId.value = target.commitId
  restoreDescription.value = t('versioning.restore.defaultDescription', { version: `v${target.version}` })
}

function closeRestoreDialog(): void {
  if (versionWriteState.value.status === 'running') return
  restoreVersionTargetCommitId.value = null
  restoreDescription.value = ''
}

async function handleRestoreConfirm(): Promise<void> {
  const target = restoreVersionTarget.value
  const currentStatus = versionStatus.value
  if (!target || !currentStatus || restoreDescription.value.trim().length === 0) return
  try {
    await restoreProject(
      target.commitId,
      currentStatus.expectedHeadCommitId,
      currentStatus.changeSummary.snapshotId,
      restoreDescription.value.trim(),
    )
    await Promise.all([
      loadFiles(),
      reloadProjectProfile(),
      reloadProjectFontRegistry(),
      reloadProjectIconRegistry(),
      reloadProjectDictionary(),
      reloadProjectCustomBlockRegistry(),
    ])
    await reconcileWorkspaceSessionsFromDisk()
    await prepareVersioning(projectPath.value)
    closeRestoreDialog()
    selectedVersionInfoCommitId.value = null
  } catch {
    // Keep the confirmation open so the user can retry without losing the draft description.
  }
}

function closePublishDialog(): void {
  if (versionWriteState.value.status === 'running') return
  publishVersionTargetCommitId.value = null
  editReleaseMode.value = false
}

async function handlePublishVersionConfirm(version: string, description: string): Promise<void> {
  const target = publishVersionTarget.value
  if (!target) return
  try {
    if (editReleaseMode.value) {
      await editReleaseDescription(target.commitId, description)
    } else {
      await publishVersion(target.commitId, version, description)
    }
    await Promise.all([reloadProjectProfile(), reconcileWorkspaceSessionsFromDisk()])
    publishVersionTargetCommitId.value = null
    selectedVersionInfoCommitId.value = null
    editReleaseMode.value = false
  } catch {
    // The versioning flow reports a stable application error and keeps this dialog open.
  }
}

function handleChangeHistorySelect(source: 'version' | 'local-history', id: string): void {
  const session = activeSession.value
  const relativePath = historyPath.value
  if (!session || !relativePath) return
  void openCompare(source, id, session, relativePath)
}

async function requestLocalHistoryRestore(entryId: string): Promise<void> {
  const session = activeSession.value
  if (!historyPath.value || !session || session.resourceKind !== 'workspace') return
  await requestFileRestore(session.id, entryId)
}

function openLocalHistoryRestoreConfirmation(entryId: string): void {
  if (!localHistoryEntries.value.some(entry => entry.entryId === entryId)) return
  localHistoryRestoreEntryId.value = entryId
  localHistoryRestoreError.value = ''
}

function closeLocalHistoryRestoreDialog(): void {
  if (localHistoryRestoreBusy.value) return
  localHistoryRestoreEntryId.value = null
  localHistoryRestoreError.value = ''
}

function openLocalHistoryDeleteDialog(entryId: string): void {
  const target = localHistoryEntries.value.find(entry => entry.entryId === entryId)
  if (!target) return
  localHistoryDeleteTarget.value = target
  localHistoryDeleteError.value = ''
}

function closeLocalHistoryDeleteDialog(): void {
  if (localHistoryDeleteBusy.value) return
  localHistoryDeleteTarget.value = null
  localHistoryDeleteError.value = ''
}

async function handleLocalHistoryDeleteConfirm(): Promise<void> {
  const target = localHistoryDeleteTarget.value
  if (!target || localHistoryDeleteBusy.value) return
  localHistoryDeleteBusy.value = true
  localHistoryDeleteError.value = ''
  try {
    await deleteLocalHistory(target.relativePath, target.entryId)
    localHistoryDeleteBusy.value = false
    closeLocalHistoryDeleteDialog()
  } catch (error) {
    const code = (error as Partial<VersionErrorDto> | null)?.code ?? 'unknown'
    localHistoryDeleteError.value = t('versioning.history.deleteFailed', { code })
    localHistoryDeleteBusy.value = false
  }
}

async function handleLocalHistoryRestoreConfirm(): Promise<void> {
  const entry = localHistoryRestoreTarget.value
  const relativePath = historyPath.value
  if (!entry || !relativePath || localHistoryRestoreBusy.value) return
  localHistoryRestoreBusy.value = true
  localHistoryRestoreError.value = ''
  let restored = false
  try {
    await restoreLocalHistory(relativePath, entry.entryId, entry.contentOid)
    restored = true
    await refreshSessionFromDisk(activeSession.value?.id ?? '')
    const fileName = relativePath.replace(/\\/g, '/').split('/').pop()?.toLowerCase()
    if (fileName === '.ocproject') await reloadProjectProfile()
    else if (fileName === '.ocfonts') await reloadProjectFontRegistry()
    else if (fileName === '.ocicons') await reloadProjectIconRegistry()
    else if (fileName === '.oclocale') await reloadProjectDictionary()
    else if (fileName === '.ocblocks') await reloadProjectCustomBlockRegistry()
  } catch (error) {
    if (!restored) {
      const code = (error as Partial<VersionErrorDto> | null)?.code ?? 'unknown'
      localHistoryRestoreError.value = t('versioning.history.restoreFailed', { code })
    }
  } finally {
    localHistoryRestoreBusy.value = false
    if (restored) closeLocalHistoryRestoreDialog()
  }
}

async function handleSidebarListAction(listKey: string, actionKey: string): Promise<void> {
  if (listKey === CHANGES_LIST_KEY) {
    if (actionKey === CHANGE_HISTORY_REFRESH_ACTION_KEY) {
      if (historyPath.value) await loadFileHistory(historyPath.value)
      return
    }
    if (actionKey === CHANGE_HISTORY_FILTER_ALL_ACTION_KEY) {
      changeHistorySourceFilter.value = 'all'
      return
    }
    if (actionKey === CHANGE_HISTORY_FILTER_VERSION_ACTION_KEY) {
      changeHistorySourceFilter.value = 'version'
      return
    }
    if (actionKey === CHANGE_HISTORY_FILTER_LOCAL_ACTION_KEY) {
      changeHistorySourceFilter.value = 'local-history'
      return
    }
  }

  if (listKey === VERSION_LIST_KEY && actionKey === 'version-history.refresh') {
    await prepareVersioning(projectPath.value)
    return
  }

  if (shellPage.value.type === 'workbench' && listKey === PROJECT_FILES_LIST_KEY) {
    if (actionKey === PROJECT_NEW_OPENCARD_ACTION_KEY) {
      await createProjectEntry('opencard')
      return
    }
    if (actionKey === PROJECT_NEW_PROFILE_ACTION_KEY) {
      await createProjectSpecialFile('.ocproject')
      return
    }
    if (actionKey === PROJECT_NEW_FONT_REGISTRY_ACTION_KEY) {
      await createProjectSpecialFile('.ocfonts')
      return
    }
    if (actionKey === PROJECT_NEW_ICON_REGISTRY_ACTION_KEY) {
      await createProjectSpecialFile('.ocicons')
      return
    }
    if (actionKey === PROJECT_NEW_CUSTOM_BLOCK_REGISTRY_ACTION_KEY) {
      await createProjectSpecialFile('.ocblocks')
      return
    }
    if (actionKey === PROJECT_NEW_DICTIONARY_ACTION_KEY) {
      await createProjectSpecialFile('.oclocale')
      return
    }
    if (actionKey === PROJECT_NEW_FOLDER_ACTION_KEY) {
      await createProjectEntry('folder')
      return
    }
  }

  if (shellPage.value.type !== 'create-project' || isProjectTemplateBusy.value) return
  if (listKey === ICON_PACKS_LIST_KEY && actionKey === IMPORT_ICON_PACK_ACTION_KEY
    && !iconPackStore.isLoading.value) {
    isImportingIconPack.value = true
    try {
      const sourcePath = await iconPackStore.pickUserIconPack(t('projectTemplates.dialogs.chooseIconPack'))
      if (sourcePath) await iconPackStore.importUserIconPack(sourcePath)
    } catch (error) {
      reportAppError('OC-E3013', error)
    } finally {
      isImportingIconPack.value = false
    }
    return
  }
  if (listKey === CUSTOM_BLOCKS_LIST_KEY && actionKey === IMPORT_CUSTOM_BLOCK_ACTION_KEY
    && !customBlockCatalogStore.isLoading.value) {
    isImportingCustomBlock.value = true
    try {
      const sourcePath = await customBlockCatalogStore.pickUserCustomBlock(
        t('projectTemplates.dialogs.chooseCustomBlock'),
      )
      if (sourcePath) await customBlockCatalogStore.importUserCustomBlock(sourcePath)
    } catch (error) {
      reportAppError('OC-E3015', error)
    } finally {
      isImportingCustomBlock.value = false
    }
  }
}

function getProjectEntryParentPath(): string {
  const selectedKey = selectedFileKeys.value[0]
  const selectedEntry = selectedKey ? findProjectEntryByKey(selectedKey) : null
  if (!selectedEntry) return projectPath.value
  if (selectedEntry.isDirectory) return selectedEntry.key
  const separatorIndex = selectedEntry.key.lastIndexOf('/')
  return separatorIndex < 0 ? projectPath.value : selectedEntry.key.slice(0, separatorIndex)
}

async function createProjectSpecialFile(
  fileName: '.ocproject' | '.ocfonts' | '.ocicons' | '.ocblocks' | '.oclocale',
): Promise<void> {
  if (!projectPath.value || hasRootProjectFile(fileName)) return
  const content = fileName === '.ocblocks' ? '{\n  "blocks": []\n}\n' : '{}'
  await createFile(fileName, content)
  const path = `${projectPath.value}/${fileName}`
  selectedFileKeys.value = [path]
  await openEditorSession(path)
}

async function createProjectEntry(kind: 'folder' | 'opencard'): Promise<void> {
  if (!projectPath.value) return
  const parentPath = getProjectEntryParentPath()
  const parentEntry = findProjectEntryByKey(parentPath)
  if (parentEntry?.isDirectory) setDirectoryExpanded(parentPath, true)

  const baseName = kind === 'folder'
    ? t('sidebar.fileActions.newFolderName')
    : kind === 'opencard'
      ? t('sidebar.fileActions.newOpenCardName')
      : ''
  const content = kind === 'opencard'
    ? createDefaultOpenCardContent(baseName)
    : ''
  const path = await createEntryWithAvailableName(
    parentPath,
    baseName,
    kind === 'folder' ? 'folder' : 'file',
    content,
  )

  selectedFileKeys.value = [path]
  await nextTick()
  await projectTreeRef.value?.beginRename(path)
}

function handleSettingsCategoryTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'selection.change') return

  const categoryKey = intent.selectedKeys[0]
  if (categoryKey === 'general' || categoryKey === 'appearance' || categoryKey === 'workspace') {
    const returnPage = getCurrentPrimaryShellPage()
    shellPage.value = { type: 'settings', categoryKey, returnPage }
  }
}

async function importThemeFile(themeId: 'dark' | 'light'): Promise<void> {
  try {
    const path = await fileSystemService.pickFile({
      title: t('settings.actions.importTheme'),
      fileTypeName: t('settings.files.themeFile'),
      extensions: [APP_THEME_FILE_EXTENSION],
    })
    if (!path) return
    const definition = parseAppTheme(await fileSystemService.readFile(path))
    if (!definition) throw new Error(t('settings.errors.invalidThemeFile'))
    const fileName = path.split(/[\\/]/).pop() ?? ''
    const presetName = fileName.toLocaleLowerCase().endsWith(APP_THEME_FILE_SUFFIX)
      ? fileName.slice(0, -APP_THEME_FILE_SUFFIX.length).trim()
      : fileName.trim()
      || t('settings.values.importedTheme')
    settingsStore.importThemePreset(themeId, presetName, definition)
  } catch (cause) {
    await showMessage(cause instanceof Error ? cause.message : t('settings.errors.themeFileOperationFailed'), {
      title: t('settings.actions.importTheme'),
      kind: 'error',
    })
  }
}

async function exportThemeFile(themeId: 'dark' | 'light'): Promise<void> {
  try {
    const path = await fileSystemService.pickSavePath({
      defaultPath: `opencard-${themeId}${APP_THEME_FILE_SUFFIX}`,
      title: t('settings.actions.exportTheme'),
      fileTypeName: t('settings.files.themeFile'),
      extensions: [APP_THEME_FILE_EXTENSION],
    })
    if (!path) return
    const appearance = settingsStore.settings.value.appearance
    await fileSystemService.writeFile(path, serializeAppTheme(
      themeId,
      appearance.themeOverrides[themeId],
      appearance.accentNeighborAngles[themeId],
      appearance.fontFamilies[themeId],
    ))
  } catch (cause) {
    await showMessage(cause instanceof Error ? cause.message : t('settings.errors.themeFileOperationFailed'), {
      title: t('settings.actions.exportTheme'),
      kind: 'error',
    })
  }
}

async function handleSettingsIntent(intent: SettingsIntent): Promise<void> {
  if (intent.type === 'setting.preview') {
    settingsStore.previewSetting(intent.key, intent.value)
    return
  }

  if (intent.type === 'setting.change') {
    settingsStore.updateSetting(intent.key, intent.value)
    return
  }

  if (intent.type === 'theme-color.preview' || intent.type === 'theme-color.cancel') {
    settingsStore.previewThemeColor(intent.themeId, intent.token, intent.value)
    return
  }

  if (intent.type === 'theme-color.change') {
    settingsStore.updateThemeColor(intent.themeId, intent.token, intent.value)
    return
  }

  if (intent.type === 'theme-angle.preview') {
    settingsStore.previewThemeAngle(intent.themeId, intent.value)
    return
  }

  if (intent.type === 'theme-angle.change') {
    settingsStore.updateThemeAngle(intent.themeId, intent.value)
    return
  }

  if (intent.type === 'theme-font.change') {
    settingsStore.updateThemeFont(intent.themeId, intent.value)
    return
  }

  if (intent.type === 'theme-preset.change') {
    settingsStore.applyThemePreset(intent.themeId, intent.presetId)
    return
  }

  if (intent.type === 'theme-preset.delete') {
    settingsStore.deleteThemePreset(intent.themeId, intent.presetId)
    return
  }

  if (intent.type === 'theme.import') {
    await importThemeFile(intent.themeId)
    return
  }

  if (intent.type === 'theme.export') {
    await exportThemeFile(intent.themeId)
    return
  }

  if (intent.type === 'themes.reset') {
    settingsStore.resetThemes()
    return
  }

  await resetProjectWorkspaceState()
}

async function performApplicationClose(): Promise<void> {
  await destroyWindow()
}

function performSessionClose(sessionIds: readonly string[]): void {
  for (const sessionId of sessionIds) closeSession(sessionId)
}

async function performPathTrash(path: string): Promise<void> {
  await trashFile(path)
  closeSessionsByPath(path)
  selectedFileKeys.value = selectedFileKeys.value.filter(key => key !== path)
}

async function handleOpenedEditorTreeIntent(intent: OcTreeIntent) {
  if (intent.type === 'selection.change') {
    handleOpenedEditorsSelect(intent.selectedKeys)
    return
  }

  if (intent.type === 'action.invoke' && intent.actionKey === OPENED_EDITOR_CLOSE_ACTION_KEY) {
    await requestSessionClose([intent.key])
  }
}

async function handleProjectTreeIntent(intent: OcTreeIntent) {
  if (intent.type === 'selection.change') {
    await handleFileTreeSelect(intent.selectedKeys)
    return
  }

  if (intent.type === 'expansion.change') {
    await handleProjectTreeItemToggle(intent.key, intent.expanded)
    return
  }

  if (intent.type === 'rename.request') {
    await projectTreeRef.value?.beginRename(intent.key)
    return
  }

  if (intent.type === 'rename.commit') {
    const result = await renameEntry(intent.key, intent.name)
    if (result.ok) remapSessionPaths(result.fromPath, result.toPath)
    else console.warn('[workspace] Rename rejected:', result.reason)
    return
  }

  if (intent.type === 'move.request') {
    const result = await moveEntryByDrop(intent)
    if (result.ok) remapSessionPaths(result.fromPath, result.toPath)
    else console.warn('[workspace] Move rejected:', result.reason)
    return
  }

  if (intent.type === 'action.invoke') {
    const entry = findProjectEntryByKey(intent.key)
    if (!entry) return

    if (intent.actionKey === PROJECT_ENTRY_RENAME_ACTION_KEY) {
      await projectTreeRef.value?.beginRename(entry.key)
      return
    }

    if (isProjectEntryConfirmDeleteActionKey(intent.actionKey)) {
      await requestPathTrash(entry.key)
      return
    }
    if (intent.actionKey === PROJECT_ENTRY_REVEAL_ACTION_KEY) {
      console.debug('[workspace-action] reveal:start', { actionKey: intent.actionKey, path: entry.key })
      try {
        await revealEntryInFileManager(entry.key)
        console.debug('[workspace-action] reveal:success', { actionKey: intent.actionKey, path: entry.key })
      } catch (error) {
        reportAppError('OC-E2004', {
          actionKey: intent.actionKey,
          path: entry.key,
          error,
        })
      }
      return
    }
    if (intent.actionKey === PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY) {
      await navigator.clipboard.writeText(getRelativeProjectPath(entry.key))
      return
    }
    if (intent.actionKey === PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY) {
      await navigator.clipboard.writeText(entry.key)
    }
    return
  }

  if (intent.type !== 'node.activate') {
    return
  }

  const entry = findProjectEntryByKey(intent.key)
  if (!entry) {
    return
  }

  if (entry.isDirectory) {
    await handleProjectTreeItemToggle(entry.key, !entry.isExpanded)
    return
  }

  if (resolveFileType(entry.key, projectPath.value).id === 'font') return

  await handleOpenFile(entry.key)
}

function handleExportTemplateTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'action.invoke') return
  const relativePath = exportRelativePath(intent.key)
  if (intent.actionKey === TEMPLATE_EXCLUDE_ACTION_KEY || intent.actionKey === TEMPLATE_INCLUDE_ACTION_KEY) {
    exportTemplateWorkspaceRef.value?.togglePathIncluded(relativePath)
    return
  }
  if (intent.actionKey === TEMPLATE_COVER_ADD_ACTION_KEY || intent.actionKey === TEMPLATE_COVER_REMOVE_ACTION_KEY) {
    exportTemplateWorkspaceRef.value?.toggleCover(relativePath)
    return
  }
  if (intent.actionKey === TEMPLATE_ENTRY_ADD_ACTION_KEY || intent.actionKey === TEMPLATE_ENTRY_REMOVE_ACTION_KEY) {
    exportTemplateWorkspaceRef.value?.toggleEntry(relativePath)
  }
}

function handleExportSelectionTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'action.invoke') return
  if (intent.key.startsWith(TEMPLATE_ENTRY_TREE_PREFIX)) {
    exportTemplateWorkspaceRef.value?.toggleEntry(intent.key.slice(TEMPLATE_ENTRY_TREE_PREFIX.length))
    return
  }
  if (intent.key.startsWith(TEMPLATE_COVER_TREE_PREFIX)) {
    exportTemplateWorkspaceRef.value?.toggleCover(intent.key.slice(TEMPLATE_COVER_TREE_PREFIX.length))
  }
}

async function closeProjectFolder(destination: ProjectCloseDestination = 'current'): Promise<void> {
  if (!projectPath.value) return
  await requestProjectClose(destination)
}

async function handleExternalOpenPaths(paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    const normalizedPath = path.replace(/\\/g, '/')
    const kind = classifyExternalOpenPath(normalizedPath)
    if (!kind) continue

    try {
      if (kind === 'project-resource') {
        const projectDirectory = getPathDirectory(normalizedPath)
        if (!projectDirectory) continue
        await openRecentProject(projectDirectory)
        await openEditorSession(normalizedPath)
        continue
      }

      if (kind === 'card' || kind === 'custom-block') {
        await openEditorSession(normalizedPath)
        showPrimaryShellPage('workbench')
        continue
      }

      if (kind === 'template') {
        const imported = await templateStore.importUserTemplate(normalizedPath)
        selectedTemplateKey.value = imported.key
        shellPage.value = { type: 'create-project', returnPage: getCurrentPrimaryShellPage() }
        continue
      }

      if (kind === 'icon-pack') {
        const imported = await iconPackStore.importUserIconPack(normalizedPath)
        if (imported) selectedIconPackKeys.value = [...selectedIconPackKeys.value, imported.key]
        shellPage.value = { type: 'create-project', returnPage: getCurrentPrimaryShellPage() }
      }
    } catch (error) {
      reportAppError('OC-E2002', { path: normalizedPath, error })
    }
  }
}

async function relocateRecentProject(missingPath: string): Promise<void> {
  const selectedPath = await relocateRecentProjectPath(missingPath)
  if (!selectedPath) return
  selectedRecentProjectKeys.value = []
}

async function openCreateProject(): Promise<void> {
  if (isProjectTemplateBusy.value) return
  if (projectPath.value) {
    await requestProjectClose('create-project')
    return
  }

  enterCreateProject()
}

function toggleSidebarCollapsed() {
  if (sidebarCollapsed.value) {
    settingsStore.updateShell({
      sidebarCollapsed: false,
      sidebarWidth: lastExpandedSidebarWidth.value,
    })
    return
  }

  lastExpandedSidebarWidth.value = Math.max(sidebarWidth.value, SIDEBAR_MIN_WIDTH)
  settingsStore.updateShell({ sidebarCollapsed: true })
}

function handleSidebarResize(width: number) {
  if (width <= SIDEBAR_AUTO_COLLAPSE_WIDTH) {
    settingsStore.updateShell({ sidebarCollapsed: true })
    return
  }

  const nextWidth = Math.max(width, SIDEBAR_MIN_WIDTH)
  lastExpandedSidebarWidth.value = nextWidth
  settingsStore.updateShell({
    sidebarCollapsed: false,
    sidebarWidth: nextWidth,
  })
}

function createUntitledOpenCard() {
  showPrimaryShellPage('workbench')
  createDraftSession({
    fileTypeId: 'opencard',
  })
}

async function runShellCommand(actionKey: string) {
  if ((isCreateProjectMode.value && isProjectTemplateBusy.value) || isExportTemplateBusy.value) return
  if (compareSession.value && [
    'save-active-editor',
    'save-version',
    'undo-active-editor',
    'redo-active-editor',
  ].includes(actionKey)) return

  if (actionKey === 'open-settings') {
    shellPage.value = {
      type: 'settings',
      categoryKey: 'general',
      returnPage: getCurrentPrimaryShellPage(),
    }
    return
  }

  if (actionKey === 'check-for-updates') {
    await checkForUpdate()
    return
  }

  if (actionKey === 'toggle-developer-mode' && import.meta.env.DEV) {
    developerMode.value = !developerMode.value
    stopDeveloperUpdatePreview()
    return
  }

  if (actionKey === 'about-opencard') {
    shellPage.value = {
      type: 'about',
      returnPage: getCurrentPrimaryShellPage(),
    }
    return
  }

  if (actionKey === 'send-feedback') {
    openFeedbackCenter('submit')
    return
  }

  if (actionKey === 'view-feedback') {
    openFeedbackCenter('history')
    return
  }

  if (actionKey === 'save-active-editor') {
    await triggerCurrentEditorSave()
    return
  }

  if (actionKey === 'save-version') {
    await openSaveVersion()
    return
  }

  if (actionKey === 'publish-version') {
    if (hasWorkspaceVersionChanges.value) {
      await openSaveVersion(true)
      return
    }
    selectedVersionInfoCommitId.value = versionStatus.value?.current?.commitId ?? null
    openPublishDialog(false)
    return
  }

  if (actionKey === 'undo-active-editor') {
    await triggerCurrentEditorUndo()
    return
  }

  if (actionKey === 'redo-active-editor') {
    await triggerCurrentEditorRedo()
    return
  }

  if (actionKey === 'toggle-sidebar') {
    toggleSidebarCollapsed()
    return
  }

  if (actionKey === 'toggle-bottom-panel') {
    isBottomPanelExpanded.value = !isBottomPanelExpanded.value
    return
  }

  if (actionKey === 'toggle-fullscreen') {
    try {
      await toggleWindowFullscreen()
    } catch (error) {
      console.warn('切换全屏失败:', error)
    }
    return
  }

  if (actionKey === 'show-welcome') {
    showPrimaryShellPage('welcome')
    return
  }

  if (actionKey === 'show-workbench') {
    showPrimaryShellPage('workbench')
    return
  }

  if (actionKey === 'return-primary-page') {
    showPrimaryShellPage(getCurrentPrimaryShellPage())
    return
  }

  if (actionKey === 'new-project') {
    await openCreateProject()
    return
  }

  if (actionKey === 'new-open-card') {
    createUntitledOpenCard()
    return
  }

  if (actionKey === 'open-project') {
    await openProject()
    return
  }

  if (actionKey === 'close-project-folder') {
    await closeProjectFolder()
    return
  }

  if (actionKey === 'close-project-and-welcome') {
    await closeProjectFolder('welcome')
    return
  }

  if (actionKey === 'export-project-template') {
    if (projectPath.value) {
      const returnPage = getCurrentPrimaryShellPage()
      exportTemplateSelection.value = { excludedPaths: [], entries: [], entryNames: {}, covers: [] }
      await ensureProjectTreeLoaded()
      shellPage.value = { type: 'export-template', returnPage }
    }
    return
  }

  if (actionKey === 'export-card-documents' && projectPath.value) {
    await openProjectExportDialog()
  }
}

async function handleSaveVersionConfirm(
  description: string,
  version?: string,
  releaseDescription?: string,
): Promise<void> {
  try {
    await confirmSaveVersion(description, version, releaseDescription)
    await Promise.all([reloadProjectProfile(), reconcileWorkspaceSessionsFromDisk()])
  } catch {
    if (pendingPublishVersion.value) {
      await Promise.all([reloadProjectProfile(), reconcileWorkspaceSessionsFromDisk()])
      publishVersionTargetCommitId.value = pendingPublishVersion.value.commitId
      editReleaseMode.value = false
    }
    // The versioning flow reports the stable application error and keeps the dialog open.
  }
}

function createIconPackTreeData(packs: readonly ProjectIconPackCatalogEntry[]): OcTreeData {
  const items = new Map<string, OcTreeItem>()
  for (const pack of packs) {
    const isRegistered = selectedIconPackKeys.value.includes(pack.key)
    items.set(pack.key, {
      label: resolveProjectIconPackName(pack, locale.value),
      icon: 'file.package-variant',
      actions: [isRegistered ? REGISTERED_ICON_PACK_ACTION_KEY : REGISTER_ICON_PACK_ACTION_KEY],
      ...(isRegistered ? {
        disabledActions: new Map([[REGISTERED_ICON_PACK_ACTION_KEY, t('projectTemplates.status.iconPackRegistered')]]),
      } : {}),
    })
  }
  return {
    rootKeys: packs.map((pack) => pack.key),
    items,
    children: new Map(),
  }
}

function createCustomBlockTreeData(blocks: readonly UserCustomBlockCatalogEntry[]): OcTreeData {
  const items = new Map<string, OcTreeItem>()
  for (const block of blocks) {
    const isRegistered = selectedCustomBlockKeys.value.includes(block.key)
    items.set(block.key, {
      label: block.name,
      icon: 'file.custom-block',
      actions: [isRegistered ? REGISTERED_CUSTOM_BLOCK_ACTION_KEY : REGISTER_CUSTOM_BLOCK_ACTION_KEY],
      ...(isRegistered ? {
        disabledActions: new Map([[
          REGISTERED_CUSTOM_BLOCK_ACTION_KEY,
          t('projectTemplates.status.customBlockRegistered'),
        ]]),
      } : {}),
    })
  }
  return {
    rootKeys: blocks.map(block => block.key),
    items,
    children: new Map(),
  }
}

function copyProjectExportTask(task: ProjectExportTask): ProjectExportTask {
  return { ...task, documentPaths: [...task.documentPaths] }
}

async function openProjectExportDialog(): Promise<void> {
  exportPreparationIssues.value = []
  projectExportDialogTask.value = copyProjectExportTask(
    projectProfile.value?.exportTask ?? createDefaultProjectExportTask(),
  )
  const paths = indexedEntries.value
    .filter(entry => !entry.isDirectory && entry.name.toLocaleLowerCase().endsWith('.ocdocument'))
    .map(entry => entry.name.replace(/\\/g, '/'))
  projectExportDocumentCandidates.value = paths.map(path => ({ path }))
  projectExportDialogOpen.value = true
  projectExportDocumentCandidates.value = await Promise.all(paths.map(async path => {
    try {
      const document = (await loadDocumentSnapshot(path)).document
      const width = Number(document.width)
      const height = Number(document.height)
      return {
        path,
        ...(Number.isFinite(width) && Number.isFinite(height) ? { width, height } : {}),
      }
    } catch {
      return { path }
    }
  }))
}

function closeProjectExportDialog(): void {
  if (!isExportPreparing.value && !isProjectExportRunning.value) projectExportDialogOpen.value = false
}

async function startProjectExport(): Promise<boolean> {
  if (isExportPreparing.value || isProjectExportRunning.value) return false
  isExportPreparing.value = true
  exportPreparationIssues.value = []
  const prepared = await prepareProjectExport(projectExportDialogTask.value)
  if (!prepared.ok) {
    exportPreparationIssues.value = prepared.issues
    isExportPreparing.value = false
    return false
  }
  projectExportDialogOpen.value = false
  isExportPreparing.value = false
  void runProjectExport(prepared.plan)
  return true
}

async function handleTitleBarMenuAction(_menuKey: string, actionKey: string) {
  await runShellCommand(actionKey)
}

async function closeReleaseNotesDialog(): Promise<void> {
  if (releaseNotesDialogMode.value === 'current') {
    await markCurrentReleaseNotesSeen()
  }
  releaseNotesDialogMode.value = null
}

async function installAvailableRelease(): Promise<void> {
  if (!availableUpdate.value) return
  await installAvailableUpdate()
}

async function handleTitleBarAppAction(actionKey: string): Promise<void> {
  if (actionKey === 'toggle-primary-page') {
    showPrimaryShellPage(getOtherPrimaryShellPage(shellPage.value))
    return
  }
  if (actionKey !== 'install-update') return
  if (availableUpdate.value) {
    releaseNotesDialogMode.value = 'available'
    return
  }
  if (import.meta.env.DEV && developerMode.value) startDeveloperUpdatePreview()
}

async function handleWorkspaceFrameAction(actionKey: string) {
  if (actionKey === CARD_DESIGNER_MODE_ACTION_KEY) {
    handleCardDesignerModeUpdate(
      activeCardDesignerMode.value === 'design' ? 'data-table' : 'design',
    )
    return
  }

  if (actionKey === CARD_DATA_TABLE_IMPORT_ACTION_KEY || actionKey === DICTIONARY_IMPORT_ACTION_KEY) {
    await importDataTableWorkbook()
    return
  }

  if (actionKey === CARD_DATA_TABLE_EXPORT_ACTION_KEY || actionKey === DICTIONARY_EXPORT_ACTION_KEY) {
    await exportDataTableWorkbook()
    return
  }

  await runShellCommand(actionKey)
}

async function handleWindowControl(actionKey: string) {
  try {
    if (actionKey === 'close') {
      await requestWindowClose()
      return
    }

    if (actionKey === 'minimize') {
      await minimizeWindow()
      return
    }

    if (actionKey === 'toggle-fullscreen') {
      await toggleWindowFullscreen()
      return
    }

    if (actionKey === 'toggle-maximize') {
      await toggleWindowMaximize()
      return
    }

  } catch (error) {
    if (actionKey === 'close') {
      console.warn('关闭窗口失败:', error)
      return
    }

    console.warn('窗口控制不可用:', error)
  }
}

async function handleOpenFile(path: string) {
  try {
    await openEditorSession(path)
  } catch (error) {
    reportAppError('OC-E2003', { path, error })
  }
}

async function handleGlobalKeydown(event: KeyboardEvent) {
  if (saveVersionConfirmation.value && (event.ctrlKey || event.metaKey)
    && event.key.toLowerCase() === SHELL_SHORTCUT_KEYS.save) {
    event.preventDefault()
    return
  }

  if (event.key === SHELL_SHORTCUT_KEYS.fullscreen) {
    event.preventDefault()
    if (!event.repeat) {
      try {
        await toggleWindowFullscreen()
      } catch (error) {
        console.warn('切换全屏失败:', error)
      }
    }
    return
  }

  if (!(event.ctrlKey || event.metaKey)) {
    return
  }

  const key = event.key.toLowerCase()
  if (compareSession.value && ([
    SHELL_SHORTCUT_KEYS.save,
    SHELL_SHORTCUT_KEYS.undo,
    SHELL_SHORTCUT_KEYS.redo,
  ] as string[]).includes(key)) {
    event.preventDefault()
    return
  }
  if (key === SHELL_SHORTCUT_KEYS.newOpenCard && event.shiftKey) {
    event.preventDefault()
    createUntitledOpenCard()
    return
  }

  if (key === SHELL_SHORTCUT_KEYS.newProject) {
    event.preventDefault()
    await openCreateProject()
    return
  }

  if (key === SHELL_SHORTCUT_KEYS.save) {
    event.preventDefault()
    await triggerCurrentEditorSave()
    return
  }

  if (key === SHELL_SHORTCUT_KEYS.undo) {
    if (!isActiveCardDesignerEditor.value) {
      return
    }

    event.preventDefault()
    if (event.shiftKey) {
      await triggerCurrentEditorRedo()
      return
    }

    await triggerCurrentEditorUndo()
    return
  }

  if (key === SHELL_SHORTCUT_KEYS.redo) {
    if (!isActiveCardDesignerEditor.value) {
      return
    }

    event.preventDefault()
    await triggerCurrentEditorRedo()
  }
}

async function startAppUpdater(): Promise<void> {
  await initializeAppUpdater()
  await checkForUpdate()
}

async function loadSystemFontFamilies(): Promise<void> {
  try {
    systemFontFamilies.value = await invoke<string[]>('list_system_font_families')
  } catch (cause) {
    console.warn('[OpenCard/Settings] Unable to enumerate system fonts.', cause)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  void startShellWindow()
  void startAppUpdater()
  if (isTauri()) {
    void loadSystemFontFamilies()
    void iconPackStore.load().catch((error) => reportAppError('OC-E3013', error))
  }
})

onUnmounted(() => {
  removeShellProgressTask(UPDATE_PROGRESS_TASK_KEY)
  setLocalHistoryRecorder(null)
  disposeEditorHost()
  disposeVersioning()
  window.removeEventListener('keydown', handleGlobalKeydown)
  disposeShellWindow()
  disposeAppUpdater()
})
</script>

<style scoped>
.open-card-shell__workspace-stack {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}

.open-card-shell__workbench {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.open-card-shell__workbench > :deep(*) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.open-card-shell__sidebar-tree {
  width: 100%;
  min-width: 0;
}

.open-card-shell__editor-stack,
.open-card-shell__source-editor,
.open-card-shell__compare-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.open-card-shell__editor-stack {
  position: relative;
  overflow: hidden;
}

.open-card-shell__source-editor,
.open-card-shell__compare-editor {
  position: absolute;
  inset: 0;
}

.open-card-shell__source-editor.is-comparing {
  visibility: hidden;
  pointer-events: none;
}

.open-card-shell__restore-dialog {
  display: grid;
  gap: var(--oc-space-4);
}

.open-card-shell__restore-dialog p {
  margin: 0;
}

.open-card-shell__restore-dialog label {
  display: grid;
  gap: var(--oc-space-2);
}

.open-card-shell__restore-error {
  color: var(--oc-fg-danger);
}

.shell-file-drop-overlay {
  position: fixed;
  inset: 8px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-3, 8px);
  pointer-events: none;
  border: 2px solid var(--oc-border-accent);
  border-radius: var(--oc-radius-lg, 8px);
  background: color-mix(in srgb, var(--oc-bg-base) 88%, transparent);
  color: var(--oc-fg-default);
  font-size: var(--oc-text-lg, 15px);
  font-weight: 600;
}
</style>

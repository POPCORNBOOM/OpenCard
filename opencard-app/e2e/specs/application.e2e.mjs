import { $, $$, browser, expect } from '@wdio/globals'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { e2eWorkspacePath } from '../support/workspace.mjs'

const fixtureName = 'OpenCard E2E 中文项目'
const firstProjectName = 'OpenCard E2E Version One'
const secondProjectName = 'OpenCard E2E Version Two'

async function bodyText() {
  return await (await $('body')).getText()
}

async function waitForText(text) {
  await browser.waitUntil(async () => (await bodyText()).includes(text), {
    timeoutMsg: `Expected the application to show: ${text}`,
  })
}

async function treeRow(text) {
  const row = await $(`//*[contains(concat(' ', normalize-space(@class), ' '), ' oc-tree__row ')][contains(., '${text}')]`)
  await row.waitForDisplayed()
  return row
}

async function projectVersionRow(version) {
  const row = await $(`//div[contains(concat(' ', normalize-space(@class), ' '), ' project-version-list ')]//*[contains(concat(' ', normalize-space(@class), ' '), ' oc-tree__row ')][.//*[contains(concat(' ', normalize-space(@class), ' '), ' oc-tree__label ')][normalize-space(.)='v${version}']]`)
  await row.waitForDisplayed()
  return row
}

async function dialogButton(label) {
  const button = await $(`//*[contains(concat(' ', normalize-space(@class), ' '), ' oc-dialog ')][@role='dialog']//button[normalize-space(.)='${label}']`)
  await button.waitForClickable()
  return button
}

async function closeComparison() {
  const close = await $('.version-diff-host button[aria-label="关闭对比"]')
  await close.waitForClickable()
  await close.click()
  await $('.version-diff-host').waitForExist({ reverse: true })
}

async function focusElement(element) {
  await browser.execute(target => target.focus(), element)
}

async function ensureSidebarListExpanded(title) {
  const list = await $(`//section[contains(concat(' ', normalize-space(@class), ' '), ' shell-sidebar-list ')][.//*[contains(concat(' ', normalize-space(@class), ' '), ' shell-sidebar-list-title ')][normalize-space(.)='${title}']]`)
  const content = await list.$('.shell-sidebar-list-content-wrap')
  if ((await content.getAttribute('class')).split(/\s+/).includes('collapsed')) {
    await (await list.$('.shell-sidebar-list-toggle')).click()
  }
}

describe('OpenCard desktop application', () => {
  it('opens an isolated project in the release application', async () => {
    await waitForText('OpenCard')
    const text = await bodyText()
    expect(text).toContain('新建项目')
    expect(text).toContain('打开项目文件夹')
    expect(text).toContain('最近打开的项目')

    const recentProject = await treeRow(fixtureName)
    await recentProject.doubleClick()
    await waitForText('.ocproject')
    await waitForText('更改')
    await waitForText('版本')
    await waitForText('尚无保存版本')
  })

  it('records explicit save history and opens the structured diff with mouse and keyboard', async () => {
    const projectFile = await treeRow('.ocproject')
    await projectFile.doubleClick()
    await $('.project-profile-editor').waitForDisplayed()

    const nameInput = await $('.project-profile-editor [data-field-key="name"] input')
    await nameInput.setValue(firstProjectName)
    await browser.keys(['Control', 's', 'NULL'])
    const profilePath = join(e2eWorkspacePath, '.ocproject')
    await browser.waitUntil(async () => readFileSync(profilePath, 'utf8').includes(firstProjectName))

    await ensureSidebarListExpanded('更改')
    const historyRow = await $('.change-history-list [data-oc-tree-key^="local-history:"] .oc-tree__row')
    await historyRow.waitForDisplayed()
    await historyRow.waitForClickable()
    expect(await historyRow.getText()).not.toContain('v0.0.1')

    await (await historyRow.$('.oc-tree__label')).click()
    await $('.version-diff-host').waitForDisplayed()
    await $('.project-profile-editor__layout.is-comparison').waitForDisplayed()
    expect(await $$('.version-diff-host input:not(:disabled):not([readonly]), .version-diff-host textarea:not(:disabled):not([readonly]), .version-diff-host [contenteditable="true"]')).toHaveLength(0)
    await closeComparison()

    await focusElement(historyRow)
    await browser.keys('Enter')
    await $('.version-diff-host').waitForDisplayed()
    await closeComparison()

    const currentHistoryRow = await $('.change-history-list [data-oc-tree-key^="local-history:"] .oc-tree__row')
    await focusElement(currentHistoryRow)
    await browser.keys(' ')
    await $('.version-diff-host').waitForDisplayed()
    await closeComparison()
  })

  it('saves and publishes one version without creating a second commit row', async () => {
    const saveVersion = await $('button=保存版本')
    await saveVersion.waitForClickable()
    await saveVersion.click()
    await waitForText('v0.0.1')
    await (await dialogButton('保存版本')).click()
    await browser.waitUntil(async () => (await $$('.project-version-list .oc-tree__row')).length === 1)

    const publishVersion = await $('button=发布版本')
    await publishVersion.waitForClickable()
    await publishVersion.click()
    await (await dialogButton('发布')).click()
    await browser.waitUntil(async () => (await bodyText()).includes('已发布'))
    expect(await $$('.project-version-list .oc-tree__row')).toHaveLength(1)
  })

  it('creates a second version and restores the first as a new current version', async () => {
    const nameInput = await $('.project-profile-editor [data-field-key="name"] input')
    await nameInput.setValue(secondProjectName)
    await browser.keys(['Control', 's', 'NULL'])

    await (await $('button=保存版本')).click()
    await waitForText('v0.0.2')
    await (await dialogButton('保存版本')).click()
    await browser.waitUntil(async () => (await $$('.project-version-list .oc-tree__row')).length === 2)

    const firstVersion = await projectVersionRow('0.0.1')
    await firstVersion.click()
    await waitForText('版本信息')
    await (await dialogButton('恢复到此版本')).click()
    await waitForText('恢复项目')
    await (await dialogButton('恢复到此版本')).click()

    await browser.waitUntil(async () => (await $$('.project-version-list .oc-tree__row')).length === 3)
    await browser.waitUntil(async () => (
      await (await $('.project-profile-editor [data-field-key="name"] input')).getValue()
    ) === firstProjectName)
    expect(await bodyText()).toContain('v0.0.3')
  })

  it('restores an externally deleted file from its explicit save history', async () => {
    const readmeRow = await treeRow('README.md')
    await focusElement(readmeRow)
    await browser.keys('Enter')
    await $('.monaco-editor').waitForDisplayed()
    const editorSurface = await $('.monaco-editor .view-lines')
    await editorSurface.waitForClickable()
    await editorSurface.click()
    await browser.keys(['Control', 'a', 'NULL'])
    await browser.keys('# Updated by desktop E2E')
    await browser.keys(['Control', 's', 'NULL'])

    const readmePath = join(e2eWorkspacePath, 'README.md')
    await browser.waitUntil(async () => readFileSync(readmePath, 'utf8').includes('Updated by desktop E2E'))
    rmSync(readmePath)
    await browser.waitUntil(async () => !existsSync(readmePath))

    await ensureSidebarListExpanded('更改')
    const historyRow = await $('.change-history-list [data-oc-tree-key^="local-history:"] .oc-tree__row')
    await historyRow.waitForClickable()
    await (await historyRow.$('.oc-tree__label')).click()
    await $('.version-diff-host').waitForDisplayed()

    const restoreFile = await (await $('.version-diff-host')).$('button=恢复此文件')
    await restoreFile.waitForClickable()
    await restoreFile.click()
    await (await dialogButton('恢复')).click()

    await browser.waitUntil(async () => existsSync(readmePath))
    expect(readFileSync(readmePath, 'utf8')).toContain('# Updated by desktop E2E')
    await $('.version-diff-host').waitForExist({ reverse: true })
  })
})

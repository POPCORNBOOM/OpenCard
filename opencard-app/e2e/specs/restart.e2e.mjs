import { $, $$, browser, expect } from '@wdio/globals'

const fixtureName = 'OpenCard E2E 中文项目'
const secondaryFixtureName = 'OpenCard E2E Secondary'

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

async function closeComparison() {
  const close = await $('.version-diff-host button[aria-label="关闭对比"]')
  await close.waitForClickable()
  await close.click()
  await $('.version-diff-host').waitForExist({ reverse: true })
}

async function ensureSidebarListExpanded(title) {
  const list = await $(`//section[contains(concat(' ', normalize-space(@class), ' '), ' shell-sidebar-list ')][.//*[contains(concat(' ', normalize-space(@class), ' '), ' shell-sidebar-list-title ')][normalize-space(.)='${title}']]`)
  const content = await list.$('.shell-sidebar-list-content-wrap')
  if ((await content.getAttribute('class')).split(/\s+/).includes('collapsed')) {
    await (await list.$('.shell-sidebar-list-toggle')).click()
  }
}

async function closeProjectToWelcome() {
  const fileMenu = await $("//button[contains(concat(' ', normalize-space(@class), ' '), ' titlebar-menu-button ')][normalize-space(.)='文件']")
  await fileMenu.click()
  const closeProject = await $("//button[@role='menuitem'][.//*[contains(concat(' ', normalize-space(@class), ' '), ' oc-action-menu__label ')][normalize-space(.)='关闭项目并返回欢迎页']]")
  await closeProject.waitForClickable()
  await closeProject.click()
  await waitForText('最近打开的项目')
}

describe('OpenCard desktop restart and project isolation', () => {
  it('reopens both persisted history sources after a cold start', async () => {
    await waitForText('OpenCard')
    await (await treeRow(fixtureName)).doubleClick()
    await waitForText('v0.0.3')

    const projectFile = await treeRow('.ocproject')
    await projectFile.doubleClick()
    await $('.project-profile-editor').waitForDisplayed()
    await ensureSidebarListExpanded('更改')

    const localHistory = await $('.change-history-list [data-oc-tree-key^="local-history:"] .oc-tree__row')
    await localHistory.waitForClickable()
    await (await localHistory.$('.oc-tree__label')).click()
    await $('.version-diff-host').waitForDisplayed()
    await closeComparison()

    const projectVersion = await $('.change-history-list [data-oc-tree-key^="version:"] .oc-tree__row')
    await projectVersion.waitForClickable()
    await (await projectVersion.$('.oc-tree__label')).click()
    await $('.version-diff-host').waitForDisplayed()
    await closeComparison()
  })

  it('keeps project histories isolated while switching projects', async () => {
    await closeProjectToWelcome()
    await (await treeRow(secondaryFixtureName)).doubleClick()
    await waitForText('尚无保存版本')
    expect(await $$('.project-version-list .oc-tree__row')).toHaveLength(0)

    await closeProjectToWelcome()
    await (await treeRow(fixtureName)).doubleClick()
    await waitForText('v0.0.3')
    expect(await $$('.project-version-list .oc-tree__row')).toHaveLength(3)
  })
})

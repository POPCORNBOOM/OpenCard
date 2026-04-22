<template>
  <div class="oc-tab-bar" role="tablist" aria-orientation="horizontal" @keydown="handleKeydown">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'OcTabBar' })

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target
  const currentTarget = event.currentTarget
  if (!(target instanceof HTMLElement) || !(currentTarget instanceof HTMLElement)) {
    return
  }

  const currentTab = target.closest<HTMLElement>('[data-oc-tab]')
  if (!currentTab || currentTab !== target || currentTab.getAttribute('aria-disabled') === 'true') {
    return
  }

  const enabledTabs = Array.from(currentTarget.querySelectorAll<HTMLElement>('[data-oc-tab]'))
    .filter((tab) => tab.getAttribute('aria-disabled') !== 'true')
  if (enabledTabs.length === 0) {
    return
  }

  const currentIndex = enabledTabs.indexOf(currentTab)
  if (currentIndex < 0) {
    return
  }

  let nextIndex = currentIndex
  if (event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % enabledTabs.length
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = enabledTabs.length - 1
  } else {
    return
  }

  event.preventDefault()
  const nextTab = enabledTabs[nextIndex]
  nextTab.focus()
  if (typeof nextTab.scrollIntoView === 'function') {
    nextTab.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }
  nextTab.click()
}
</script>

<style scoped>
.oc-tab-bar {
  display: flex;
  align-items: stretch;
  min-width: 0;
  min-height: 33px;
  overflow-x: auto;
  overflow-y: hidden;
  background: var(--oc-bg-elevated);
  border-bottom: 1px solid var(--oc-border-strong);
  scrollbar-width: thin;
}

.oc-tab-bar::-webkit-scrollbar {
  height: 8px;
}

.oc-tab-bar::-webkit-scrollbar-thumb {
  background: var(--oc-border-strong);
  border-radius: var(--oc-radius-pill);
}

.oc-tab-bar::-webkit-scrollbar-track {
  background: transparent;
}
</style>

<!-- 应用根壳：固定进入 IDE 视图并初始化全局主题。 -->
<script setup lang="ts">
import { computed, watchEffect } from "vue";
import MainIDE from "./views/MainIDE.vue";
import Playground from "./views/Playground.vue";
import { setOcTheme, type OcThemeId } from "./shared/ui/foundation";
import '@vscode/codicons/dist/codicon.css'

const currentView = computed(() => {
  const view = new URLSearchParams(window.location.search).get('view')
  return view === 'playground' ? 'playground' : 'ide'
})

const isPlaygroundView = computed(() => currentView.value === 'playground')

watchEffect(() => {
  const theme: OcThemeId = "dark";
  setOcTheme(theme);
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell-scrollable': isPlaygroundView }">
    <Playground v-if="isPlaygroundView" />
    <MainIDE v-else />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body, html {
  width: 100%;
  height: 100%;
}

#app {
  width: 100%;
  height: 100%;
}

.app-shell {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-shell-scrollable {
  overflow-y: auto;
  overflow-x: hidden;
}
</style>

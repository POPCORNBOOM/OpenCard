<script setup lang="ts">
import { computed, watchEffect } from "vue";
import MainIDE from "./views/MainIDE.vue";
import UiKitShowcase from "./views/UiKitShowcase.vue";
import { setOcTheme, type OcThemeId } from "./shared/ui/foundation";
import { resolveAppView } from "./appView";
import '@vscode/codicons/dist/codicon.css'

const currentView = resolveAppView(window.location.search);
const isUiKitView = computed(() => currentView === "ui-kit");

watchEffect(() => {
  const theme: OcThemeId = isUiKitView.value ? "light" : "dark";
  setOcTheme(theme);
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell-scrollable': isUiKitView }">
    <UiKitShowcase v-if="isUiKitView" />
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

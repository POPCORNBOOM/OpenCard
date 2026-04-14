<script setup lang="ts">
import { computed } from "vue";
import MainIDE from "./views/MainIDE.vue";
import ButtonShowcase from "./views/ButtonShowcase.vue";
import '@vscode/codicons/dist/codicon.css'

const currentView = new URLSearchParams(window.location.search).get("view");
const isButtonsView = computed(() => currentView === "buttons");
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell-scrollable': isButtonsView }">
    <ButtonShowcase v-if="isButtonsView" />
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

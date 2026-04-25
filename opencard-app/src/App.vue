<!-- 应用根壳：固定进入 IDE 视图并初始化全局主题。 -->
<script setup lang="ts">
import { watchEffect } from "vue";
import MainIDE from "./views/MainIDE.vue";
import { setOcTheme, type OcThemeId } from "./shared/ui/foundation";
import '@vscode/codicons/dist/codicon.css'

watchEffect(() => {
  const theme: OcThemeId = "dark";
  setOcTheme(theme);
})
</script>

<template>
  <div class="app-shell">
    <MainIDE />
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
</style>

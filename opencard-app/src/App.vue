<script setup lang="ts">
import MainIDE from "./views/MainIDE.vue";
import '@vscode/codicons/dist/codicon.css'
</script>

<template>
  <MainIDE />
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
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100%;
}
</style>

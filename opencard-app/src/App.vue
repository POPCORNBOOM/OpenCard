<script setup lang="ts">
import MainIDE from './views/MainIDE.vue'
</script>

<template>
  <MainIDE />
</template>

<style>
/* Global reset */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--oc-font-sans);
  font-size: var(--oc-text-base);
  color: var(--oc-fg-default);
  background: var(--oc-bg-base);
  -webkit-font-smoothing: antialiased;
}

</style>

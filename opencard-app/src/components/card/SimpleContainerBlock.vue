<template>
    <div :style="blockStyle">
        <CardBlock v-for="child in block.blocks" :key="child.id" :block="child" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { SimpleContainerBlock } from '../../core/Card'
import { getPositionStyles } from '../../utils/blockStyle'
import CardBlock from './CardBlock.vue'

const props = defineProps<{ block: SimpleContainerBlock }>()

const blockStyle = computed(() => getPositionStyles(props.block))
</script>

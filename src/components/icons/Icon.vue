<template>
  <div class="jj-icon" :class="{ static: isStatic }" :title="title" @click="$emit('click')">
    <div class="jj-icon__wraper">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  button: {
    type: Boolean,
    default: false
  }
})
defineEmits({
  click: null
})
const isStatic = computed(() => !props.button)
</script>

<style lang="scss">
.jj-icon {
  display: inline-block;
  // transition: background-color 0.15s linear, color 0.15s linear;
  border-radius: 50%;

  svg {
    display: inline-block;
    height: 1em;
  }
}

.jj-icon:not(.static):hover {
  cursor: pointer;
  // background: silver;
}

.jj-icon__wraper {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

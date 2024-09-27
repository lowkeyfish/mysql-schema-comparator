<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn'
const locale = zhCn
</script>

<template>
  <el-config-provider size="default" :button="{ autoInsertSpace: true }" :locale="locale">
    <router-view />
  </el-config-provider>
</template>

<style lang="scss">
@use '@/assets/base.scss';
</style>

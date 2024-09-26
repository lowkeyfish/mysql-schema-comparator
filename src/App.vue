<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn'
const locale = zhCn
</script>

<template>
  <el-config-provider size="default" :button="{ autoInsertSpace: true }" :locale="locale">
    <el-button type="primary">test</el-button>
    <el-button type="success">成功</el-button>
    <router-view />
  </el-config-provider>
</template>

<style lang="scss">
@use '@/assets/base.scss';
</style>

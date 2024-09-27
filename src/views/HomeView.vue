<script setup>
import { computed, ref } from 'vue'
import { Plus, Minus } from '@element-plus/icons-vue'

let step = ref('1')
let isStepActivated = computed(() => {
  return (s) => s === step.value
})

let databaseName = ref('')
let tableNameType = ref('全部表')
let tableNames = ref([])
let isAllTable = computed(() => tableNameType.value === '全部表')

function addTableName(index) {
  tableNames.value.splice(index, 0, {
    id: Math.random().toString(),
    name: ''
  })
}

function removeTableName(index) {
  tableNames.value.splice(index, 1)
}

addTableName(0)
console.dir(tableNames.value)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <span class="logo">MySQL Schema Comparator</span>
    </div>
    <div class="page-body">
      <div class="step-tabs">
        <div class="step-tab active">1. 选择数据库</div>
        <div class="step-tab-split">></div>
        <div class="step-tab">2. 提供 Schema</div>
        <div class="step-tab-split">></div>
        <div class="step-tab">3. 比较差异</div>
      </div>
      <div class="step-container active">
        <div class="step1-content">
          <div class="block-title">数据库</div>
          <div class="block">
            <el-input v-model="databaseName"></el-input>
          </div>
          <div class="block-title">表</div>
          <div class="block">
            <el-radio-group v-model="tableNameType" size="default">
              <el-radio-button label="全部表" value="全部表" />
              <el-radio-button label="仅指定使用的表" value="仅指定使用的表" />
              <el-radio-button label="仅指定排除的表" value="仅指定排除的表" />
            </el-radio-group>
            <template v-if="!isAllTable">
              <div class="table-name-area" v-for="(item, index) in tableNames" :key="item.id">
                <el-input v-model="item.name" :clearable="true"></el-input>
                <div class="table-name-button" title="删除">
                  <Minus @click="removeTableName(index)" />
                </div>
                <div class="table-name-button" title="增加">
                  <Plus @click="addTableName(index + 1)" />
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
      <div class="step-container"></div>
      <div class="step-container"></div>
    </div>
  </div>
</template>

<style lang="scss">
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  height: 5rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 2rem;
}

.page-body {
  height: 0;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.logo {
  color: var(--el-color-primary);
  font-size: 2rem;
}

.step-tabs {
  height: 8rem;
  border: 1px solid red;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  column-gap: 2rem;
  line-height: 1;
}

.step-tab-split {
  color: var();
}
.step-tab {
  &.active {
    color: var(--el-color-primary);
    font-weight: bold;
  }
}

.block-title {
  font-size: 1.4rem;
  font-weight: bold;
  margin-bottom: 1rem;
}
.block {
  margin-bottom: 3rem;

  & > div {
    margin-bottom: 1rem;
  }
}

.step-container {
  height: 0;
  flex-grow: 1;
  display: none;
  overflow: auto;

  &.active {
    display: block;
  }
}

.step1-content {
  width: 50rem;
  align-self: center;
  margin: 2rem auto 5rem;
  background-color: white;
  border: 1px solid var(--el-border-color-light);
  border-radius: 5px;
  padding: 3rem 2rem;
  box-shadow: var(--el-box-shadow-light);

  .table-name-area {
    display: flex;
    flex-direction: row;
    align-items: center;
    column-gap: 0.5rem;
  }

  .table-name-button {
    font-size: 14px;
    cursor: pointer;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      height: 1em;
      width: 1em;
    }
  }
}
</style>

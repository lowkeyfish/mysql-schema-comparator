<script setup>
import { computed, ref } from 'vue'
import { Plus, Minus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import _ from 'lodash'
import copy from 'copy-text-to-clipboard'
import XLSX from 'xlsx'

let step = ref('2')
let databaseName = ref('')
let tableNameType = ref('全部表')
let tableNames = ref([])
let sourceName = ref('测试环境')
let targetName = ref('线上环境')
let sourceTables = ref([])
let sourceTablesFile = ref(null)
let sourceColumns = ref([])
let sourceColumnsFile = ref(null)
let sourceIndexes = ref([])
let sourceIndexFile = ref(null)
let targetTables = ref([])
let targetTablesFile = ref(null)
let targetColumns = ref([])
let targetColumnsFile = ref(null)
let targetIndexes = ref([])
let targetIndexFile = ref(null)

let isStepActivated = computed(() => {
  return (s) => s === step.value
})
let isAllTable = computed(() => tableNameType.value === '全部表')
let isIncludeTable = computed(() => tableNameType.value === '仅指定使用的表')
let isExcludeTable = computed(() => tableNameType.value === '仅指定排除的表')
let validTableNames = computed(() =>
  _.uniq(
    _.map(
      _.filter(tableNames.value, (n) => _.trim(n.name) !== ''),
      (n) => _.trim(n.name)
    )
  )
)
let isSourceTablesReady = computed(() => sourceTables.length > 0)
let isSourceColumnsReady = computed(() => sourceColumns.length > 0)
let isSourceIndexesReady = computed(() => sourceIndexes.length > 0)
let isTargetTablesReady = computed(() => targetTables.length > 0)
let isTargetColumnsReady = computed(() => targetColumns.length > 0)
let isTargetIndexesReady = computed(() => targetIndexes.length > 0)

function addTableName(index) {
  tableNames.value.splice(index, 0, {
    id: Math.random().toString(),
    name: ''
  })
}

function removeTableName(index) {
  if (tableNames.value.length > 1) {
    tableNames.value.splice(index, 1)
  }
}

function step1Next() {
  if (_.trim(databaseName.value) === '') {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '未提供数据库'
    })
    return
  }
  if (isIncludeTable.value && validTableNames.value.length === 0) {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '你选择了“仅制定使用的表”，但未提供表'
    })
    return
  }
  if (isExcludeTable.value && validTableNames.value.length === 0) {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '你选择了“仅指定排除的表”，但未提供表'
    })
    return
  }

  activeStep2()
}

function activeStep2() {
  step.value = '2'
}

function step2Prev() {
  step.value = '1'
}

function step2Next() {}

function step3Prev() {}

function copyQueryTableSqlToClipboard() {
  let database = databaseName.value
  let sql = ''
  let tableNamesStr = _.map(validTableNames.value, (n) => `'${n}'`).join(', ')
  if (isIncludeTable.value) {
    sql = ` AND \`TABLE_NAME\` IN(${tableNamesStr})`
  } else if (isExcludeTable.value) {
    sql = ` AND \`TABLE_NAME\` NOT IN(${tableNamesStr})`
  }
  copy(
    `
    SELECT 
    \`TABLE_SCHEMA\`,
    \`TABLE_NAME\`,
    \`TABLE_TYPE\`,
    \`TABLE_COMMENT\`
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = '${database}' ${sql};
    `
  )
  ElMessage({
    type: 'success',
    grouping: true,
    message: '查询数据库表信息的 SQL 已复制'
  })
}

function copyQueryColumnSqlToClipboard() {
  let database = databaseName.value
  let sql = ''
  let tableNamesStr = _.map(validTableNames.value, (n) => `'${n}'`).join(', ')
  if (isIncludeTable.value) {
    sql = ` AND \`TABLE_NAME\` IN(${tableNamesStr})`
  } else if (isExcludeTable.value) {
    sql = ` AND \`TABLE_NAME\` NOT IN(${tableNamesStr})`
  }
  copy(
    `
    SELECT 
    \`TABLE_SCHEMA\`,
    \`TABLE_NAME\`,
    \`COLUMN_NAME\`,
    \`ORDINAL_POSITION\`,
    \`COLUMN_DEFAULT\`,
    \`IS_NULLABLE\`,
    \`DATA_TYPE\`,
    \`CHARACTER_MAXIMUM_LENGTH\`,
    \`NUMERIC_PRECISION\`,
    \`NUMERIC_SCALE\`,
    \`CHARACTER_SET_NAME\`,
    \`COLLATION_NAME\`,
    \`COLUMN_TYPE\`,
    \`EXTRA\`,
    \`COLUMN_COMMENT\`
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '${database}' ${sql};
    `
  )
  ElMessage({
    type: 'success',
    grouping: true,
    message: '查询数据库字段信息的 SQL 已复制'
  })
}

function copyQueryIndexSqlToClipboard() {
  let database = databaseName.value
  let sql = ''
  let tableNamesStr = _.map(validTableNames.value, (n) => `'${n}'`).join(', ')
  if (isIncludeTable.value) {
    sql = ` AND \`TABLE_NAME\` IN(${tableNamesStr})`
  } else if (isExcludeTable.value) {
    sql = ` AND \`TABLE_NAME\` NOT IN(${tableNamesStr})`
  }
  copy(
    `
    SELECT 
    \`TABLE_SCHEMA\`,
    \`TABLE_NAME\`,
    \`NON_UNIQUE\`,
    \`INDEX_NAME\`,
    \`SEQ_IN_INDEX\`,
    \`COLUMN_NAME\`,
    \`COLLATION\`,
    \`INDEX_TYPE\`
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = '${database}' ${sql};
    `
  )
  ElMessage({
    type: 'success',
    grouping: true,
    message: '查询数据库索引信息的 SQL 已复制'
  })
}

function selectSourceTablesFile() {
  sourceTablesFile.value.click()
}
function sourceTablesFileChange() {
  let files = sourceTablesFile.value.files
  if (files.length > 0) {
    let file = files[0]
    let reader = new FileReader()
    reader.onload = (e) => {
      let data = e.target.result
      console.dir(data)
      let workbook = XLSX.read(data, { type: 'string' })
      let firstSheetName = workbook.SheetNames[0]
      console.dir(workbook.SheetNames)
      let worksheet = workbook.Sheets[firstSheetName]
      console.dir(worksheet)
      let json = XLSX.utils.sheet_to_json(worksheet)
      console.dir(json)
    }
    console.dir(file)
    reader.readAsText(file)
  }
}

addTableName(0)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <span class="logo">MySQL Schema Comparator</span>
    </div>
    <div class="page-body">
      <div class="step-tabs">
        <div class="step-tab" :class="{ active: isStepActivated('1') }">1. 选择数据库</div>
        <div class="step-tab-split">></div>
        <div class="step-tab" :class="{ active: isStepActivated('2') }">2. 提供数据库信息</div>
        <div class="step-tab-split">></div>
        <div class="step-tab" :class="{ active: isStepActivated('3') }">3. 比较差异</div>
      </div>
      <div class="step-container" :class="{ active: isStepActivated('1') }">
        <div class="step-content-container">
          <div class="step1-content">
            <div class="block-title">数据库</div>
            <div class="block">
              <el-input v-model="databaseName" :clearable="true"></el-input>
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
        <div class="step-nav">
          <el-button type="primary" class="next" @click="step1Next"
            >下一步: 提供数据库信息</el-button
          >
        </div>
      </div>
      <div class="step-container" :class="{ active: isStepActivated('2') }">
        <div class="step-content-container step2-content-container">
          <div class="step2-content-left">
            <div class="block-title">源数据库</div>
            <div class="block">
              <el-input v-model="sourceName"></el-input>
            </div>
            <div class="block-title">
              表信息<template v-if="isSourceTablesReady">
                <span style="color: var(--el-color-success); margin: 0 1rem">已提供</span
                ><span style="color: var(--el-color-danger); cursor: pointer"
                  >删除文件</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="selectSourceTablesFile"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copyQueryTableSqlToClipboard">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="sourceTablesFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="sourceTablesFileChange"
              />
            </div>
            <div class="block-title">
              字段信息<template v-if="isSourceColumnsReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem">已提供</span
                ><span style="color: var(--el-color-danger); cursor: pointer"
                  >删除文件</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary">选择文件 (仅支持 .csv 或 .xlsx)</el-button>
              <el-button @click="copyQueryColumnSqlToClipboard">复制 SQL 去数据库查询</el-button>
            </div>
            <div class="block-title">
              索引信息<template v-if="isSourceIndexesReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem">已提供</span
                ><span style="color: var(--el-color-danger); cursor: pointer"
                  >删除文件</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary">选择文件 (仅支持 .csv 或 .xlsx)</el-button>
              <el-button @click="copyQueryIndexSqlToClipboard">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="sourceColumnsFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="sourceColumnsFileChange"
              />
            </div>
          </div>
          <div class="step2-content-right">
            <div class="block-title">目标数据库</div>
            <div class="block">
              <el-input v-model="targetName"></el-input>
            </div>
            <div class="block-title">
              表信息
              <template v-if="isTargetTablesReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem">已提供</span
                ><span style="color: var(--el-color-danger); cursor: pointer">删除文件</span>
              </template>
            </div>
            <div class="block">
              <el-button type="primary">选择文件 (仅支持 .csv 或 .xlsx)</el-button>
              <el-button @click="copyQueryTableSqlToClipboard">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="targetTablesFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="targetTablesFileChange"
              />
            </div>
            <div class="block-title">
              字段信息
              <template v-if="isTargetColumnsReady">
                <span style="color: var(--el-color-success); margin: 0 1rem">已提供</span
                ><span style="color: var(--el-color-danger); cursor: pointer"
                  >删除文件</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary">选择文件 (仅支持 .csv 或 .xlsx)</el-button>
              <el-button @click="copyQueryColumnSqlToClipboard">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="targetColumnsFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="targetColumnsFileChange"
              />
            </div>
            <div class="block-title">
              索引信息<template v-if="isTargetIndexesReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem">已提供</span
                ><span style="color: var(--el-color-danger); cursor: pointer"
                  >删除文件</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary">选择文件 (仅支持 .csv 或 .xlsx)</el-button>
              <el-button @click="copyQueryIndexSqlToClipboard">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="targetIndexesFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="targetIndexesFileChange"
              />
            </div>
          </div>
        </div>
        <div class="step-nav">
          <el-button type="primary" class="prev" @click="step2Prev">上一步: 选择数据库</el-button>
          <el-button type="primary" class="next" @click="step2Next">下一步: 比较差异</el-button>
        </div>
      </div>
      <div class="step-container" :class="{ active: isStepActivated('3') }"></div>
    </div>
  </div>
</template>

<style lang="scss">
body {
  background-color: white;
}

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
  // border: 1px solid red;
}

.page-body {
  height: 0;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.logo {
  color: var(--el-color-primary);
  font-size: 1.6rem;
  font-weight: bold;
}

.step-tabs {
  height: 4rem;
  // padding-bottom: 3rem;
  // border: 1px solid red;
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

    &:last-of-type {
      margin-bottom: 0;
    }
  }
}

.step-container {
  display: none;
  flex-direction: column;
  height: 0;
  flex-grow: 1;
  overflow: auto;

  &.active {
    display: flex;
  }
}

.step-content-container {
  height: 0;
  flex-grow: 1;
  // border: 1px solid red;
  overflow: auto;
}

.step-nav {
  width: 50rem;
  display: flex;
  height: 6rem;
  flex-direction: row;
  align-self: center;
  align-items: center;
  // border: 1px solid red;

  .next {
    margin-left: auto;
  }

  .prev {
    margin-right: auto;
  }
}

.step1-content {
  width: 50rem;
  align-self: center;
  padding: 2rem 2rem 0 2rem;
  margin: 0 auto;

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

.step2-content-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 2rem;
}

.step2-content-left {
  // border: 1px solid red;
  padding: 3rem 2rem;
}

.step2-content-right {
  // border: 1px solid red;
  padding: 3rem 2rem;
}
</style>

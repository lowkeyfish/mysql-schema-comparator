<script setup>
import { computed, ref } from 'vue'
import { Plus, Minus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import _ from 'lodash'
import copy from 'copy-text-to-clipboard'
import XLSX from 'xlsx'
import Ajv from 'ajv'

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
let sourceIndexesFile = ref(null)
let targetTables = ref([])
let targetTablesFile = ref(null)
let targetColumns = ref([])
let targetColumnsFile = ref(null)
let targetIndexes = ref([])
let targetIndexesFile = ref(null)

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
let isSourceTablesReady = computed(() => sourceTables.value.length > 0)
let isSourceColumnsReady = computed(() => sourceColumns.value.length > 0)
let isSourceIndexesReady = computed(() => sourceIndexes.value.length > 0)
let isTargetTablesReady = computed(() => targetTables.value.length > 0)
let isTargetColumnsReady = computed(() => targetColumns.value.length > 0)
let isTargetIndexesReady = computed(() => targetIndexes.value.length > 0)

// step1 begin

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

  step1ToStep2()
}

function step1ToStep2() {
  step.value = '2'
  sourceTables.value = []
  sourceTablesFile.value.value = ''
  sourceColumns.value = []
  sourceColumnsFile.value.value = ''
  sourceIndexes.value = []
  sourceIndexesFile.value.value = ''
  targetTables.value = []
  targetTablesFile.value.value = ''
  targetColumns.value = []
  targetColumnsFile.value.value = ''
  targetIndexes.value = []
  targetIndexesFile.value.value = ''
}

// step1 end

// step2 begin

function step2Prev() {
  step.value = '1'
}

function step2Next() {
  let sTables = tables(sourceTables.value, sourceColumns.value, sourceIndexes.value)
  let tTables = tables(targetTables.value, targetColumns.value, targetIndexes.value)
  console.dir(sTables)
  console.dir(tTables)
}

function tables(originalTables, originalColumns, originalIndexes) {
  return _.map(
    _.orderBy(
      _.filter(originalTables, (t) => t.tableType === 'BASE TABLE'),
      (t) => t.tableName
    ),
    (t) => {
      let columns = _.map(
        _.orderBy(
          _.filter(originalColumns, (c) => c.tableName === t.tableName),
          (c) => c.ordinalPosition
        ),
        (c) => {
          return {
            columnName: c.columnName,
            ordinalPosition: c.ordinalPosition,
            coloumnDefault: c.columnDefault,
            isNullable: c.isNullable,
            dataType: c.dataType,
            characterMaximumLength: c.characterMaximumLength,
            numericPercision: c.numericPercision,
            numericScale: c.numericScale,
            characterSetName: c.characterSetName,
            collationName: c.collationName,
            extra: c.extra,
            columnComment: c.columnComment
          }
        }
      )

      let indexes = _.map(
        _.groupBy(
          _.filter(originalIndexes, (i) => i.tableName === t.tableName),
          (i) => i.indexName
        ),
        (items, indexName) => {
          let item = items[0]
          return {
            indexName,
            indexType: item.indexType,
            nonUnique: item.nonUnique,
            columns: _.map(items, (t) => {
              return {
                columnName: t.columnName,
                seqInIndex: t.seqInIndex,
                collation: t.collation
              }
            })
          }
        }
      )

      return {
        tableName: t.tableName,
        tableComment: t.tableComment,
        columns,
        indexes
      }
    }
  )
}

function fileOnClick(isSource, type) {
  if (isSource) {
    if (type === 'tables') {
      sourceTablesFile.value.click()
    } else if (type === 'columns') {
      sourceColumnsFile.value.click()
    } else if (type === 'indexes') {
      sourceIndexesFile.value.click()
    }
  } else {
    if (type === 'tables') {
      targetTablesFile.value.click()
    } else if (type === 'columns') {
      targetColumnsFile.value.click()
    } else if (type === 'indexes') {
      targetIndexesFile.value.click()
    }
  }
}

function copySqlOnClick(type) {
  let database = databaseName.value
  let whereSql = ''
  let tableNamesStr = _.map(validTableNames.value, (n) => `'${n}'`).join(', ')
  if (isIncludeTable.value) {
    whereSql = ` AND \`TABLE_NAME\` IN(${tableNamesStr})`
  } else if (isExcludeTable.value) {
    whereSql = ` AND \`TABLE_NAME\` NOT IN(${tableNamesStr})`
  }
  let sql = ''
  let message = ''
  if (type === 'tables') {
    sql = `
    SELECT
    \`TABLE_SCHEMA\` AS tableSchema,
    \`TABLE_NAME\` AS tableName,
    \`TABLE_TYPE\` AS tableType,
    \`TABLE_COMMENT\` AS tableComment
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = '${database}' ${whereSql} LIMIT 10000
    `
    message = '查询数据库表信息的 SQL 已复制'
  } else if (type === 'columns') {
    sql = `
    SELECT
    \`TABLE_SCHEMA\` AS tableSchema,
    \`TABLE_NAME\` AS tableName,
    \`COLUMN_NAME\` AS columnName,
    \`ORDINAL_POSITION\` AS ordinalPosition,
    \`COLUMN_DEFAULT\` AS columnDefault,
    \`IS_NULLABLE\` AS isNullable,
    \`DATA_TYPE\` AS dataType,
    \`CHARACTER_MAXIMUM_LENGTH\` AS characterMaximumLength,
    \`NUMERIC_PRECISION\` AS numericPercision,
    \`NUMERIC_SCALE\` AS numericScale,
    \`CHARACTER_SET_NAME\` AS characterSetName,
    \`COLLATION_NAME\` AS collationName,
    \`COLUMN_TYPE\` AS columnType,
    \`EXTRA\` AS extra,
    \`COLUMN_COMMENT\` AS columnComment
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '${database}' ${whereSql} LIMIT 10000
    `
    message = '查询数据库字段信息的 SQL 已复制'
  } else if (type === 'indexes') {
    sql = `
    SELECT
    \`TABLE_SCHEMA\` AS tableSchema,
    \`TABLE_NAME\` AS tableName,
    \`NON_UNIQUE\` AS nonUnique,
    \`INDEX_NAME\` AS indexName,
    \`SEQ_IN_INDEX\` AS seqInIndex,
    \`COLUMN_NAME\` AS columnName,
    \`COLLATION\` AS collation,
    \`INDEX_TYPE\` AS indexType
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = '${database}' ${whereSql} LIMIT 10000
    `
    message = '查询数据库索引信息的 SQL 已复制'
  }

  copy(sql)
  ElMessage({
    type: 'success',
    grouping: true,
    message: message
  })
}

function readCsvOrElsxFileToJson(file, jsonHandler) {
  let fileExtension = file.name.toLowerCase().split('.').pop()

  if (fileExtension === 'csv') {
    let reader = new FileReader()
    reader.onload = (e) => {
      let data = e.target.result
      let workbook = XLSX.read(data, { type: 'string' })
      let firstSheetName = workbook.SheetNames[0]
      let worksheet = workbook.Sheets[firstSheetName]
      let json = XLSX.utils.sheet_to_json(worksheet)
      jsonHandler(json)
    }
    reader.readAsText(file)
  } else if (fileExtension === 'xlsx') {
    let reader = new FileReader()
    reader.onload = (e) => {
      let data = new Uint8Array(e.target.result)
      let workbook = XLSX.read(data, { type: 'array' })
      let firstSheetName = workbook.SheetNames[0]
      let worksheet = workbook.Sheets[firstSheetName]
      let json = XLSX.utils.sheet_to_json(worksheet)
      jsonHandler(json)
    }
    reader.readAsArrayBuffer(file)
  } else {
    ElMessage({
      type: 'danger',
      grouping: true,
      message: '仅支持 .csv 或 .xlsx'
    })
  }
}

function validateTablesSchema(tables) {
  let schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        tableSchema: {},
        tableName: {},
        tableType: {},
        tableComment: {}
      },
      additionalProperties: false
    }
  }

  let ajv = new Ajv()
  let valid = ajv.validate(schema, tables)
  return valid
}

function validateColumnsSchema(columns) {
  let schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        tableSchema: {},
        tableName: {},
        columnName: {},
        ordinalPosition: {},
        columnDefault: {},
        isNullable: {},
        dataType: {},
        characterMaximumLength: {},
        numericPercision: {},
        numericScale: {},
        characterSetName: {},
        collationName: {},
        columnType: {},
        extra: {},
        columnComment: {}
      },
      additionalProperties: false
    }
  }

  let ajv = new Ajv()
  let valid = ajv.validate(schema, columns)
  return valid
}

function validateIndexesSchema(indexes) {
  let schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        tableSchema: {},
        tableName: {},
        nonUnique: {},
        indexName: {},
        seqInIndex: {},
        columnName: {},
        collation: {},
        indexType: {}
      },
      additionalProperties: false
    }
  }

  let ajv = new Ajv()
  let valid = ajv.validate(schema, indexes)
  return valid
}

function fileOnChange(isSource, type) {
  let file = null

  if (isSource) {
    if (type === 'tables') {
      sourceTables.value = []
      let files = sourceTablesFile.value.files
      if (files.length > 0) {
        file = files[0]
      }
    } else if (type === 'columns') {
      sourceColumns.value = []
      let files = sourceColumnsFile.value.files
      if (files.length > 0) {
        file = files[0]
      }
    } else if (type === 'indexes') {
      sourceIndexes.value = []
      let files = sourceIndexesFile.value.files
      if (files.length > 0) {
        file = files[0]
      }
    }
  } else {
    if (type === 'tables') {
      targetTables.value = []
      let files = targetTablesFile.value.files
      if (files.length > 0) {
        file = files[0]
      }
    } else if (type === 'columns') {
      targetColumns.value = []
      let files = targetColumnsFile.value.files
      if (files.length > 0) {
        file = files[0]
      }
    } else if (type === 'indexes') {
      targetIndexes.value = []
      let files = targetIndexesFile.value.files
      if (files.length > 0) {
        file = files[0]
      }
    }
  }

  if (file === null) {
    return
  }

  readCsvOrElsxFileToJson(file, (json) => {
    let schemaValid
    let message
    if (type === 'tables') {
      schemaValid = validateTablesSchema(json)
      if (schemaValid) {
        if (isSource) {
          sourceTables.value = json
        } else {
          targetTables.value = json
        }
      }
      message = '表信息文件数据结构无效'
    } else if (type === 'columns') {
      schemaValid = validateColumnsSchema(json)
      if (schemaValid) {
        if (isSource) {
          sourceColumns.value = json
        } else {
          targetColumns.value = json
        }
      }
      message = '字段信息文件数据结构无效'
    } else if (type === 'indexes') {
      schemaValid = validateIndexesSchema(json)
      if (schemaValid) {
        if (isSource) {
          sourceIndexes.value = json
        } else {
          targetIndexes.value = json
        }
        console.dir(json)
      }
      message = '索引信息文件数据结构无效'
    }

    if (!schemaValid) {
      ElMessage({
        type: 'error',
        grouping: true,
        message
      })
    }
  })
}

// step2 end

// step3 begin

function step3Prev() {}

// step3 end

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
                <span style="color: var(--el-color-success); margin: 0 1rem">已提供</span></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(true, 'tables')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick('tables')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="sourceTablesFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(true, 'tables')"
              />
            </div>
            <div class="block-title">
              字段信息<template v-if="isSourceColumnsReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem"
                  >已提供</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(true, 'columns')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick('columns')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="sourceColumnsFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(true, 'columns')"
              />
            </div>
            <div class="block-title">
              索引信息<template v-if="isSourceIndexesReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem"
                  >已提供</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(true, 'indexes')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick('indexes')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="sourceIndexesFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(true, 'indexes')"
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
                ><span style="color: var(--el-color-success); margin: 0 1rem">已提供</span>
              </template>
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(false, 'tables')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick('tables')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="targetTablesFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(false, 'tables')"
              />
            </div>
            <div class="block-title">
              字段信息
              <template v-if="isTargetColumnsReady">
                <span style="color: var(--el-color-success); margin: 0 1rem">已提供</span></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(false, 'columns')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick('columns')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="targetColumnsFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(false, 'columns')"
              />
            </div>
            <div class="block-title">
              索引信息<template v-if="isTargetIndexesReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem"
                  >已提供</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(false, 'indexes')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick('indexes')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="targetIndexesFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(false, 'indexes')"
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

<script setup>
import { computed, ref } from 'vue'
import { Plus, Minus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import _ from 'lodash'
import copy from 'copy-text-to-clipboard'
import XLSX from 'xlsx'
import Ajv from 'ajv'
import { diff } from 'deep-diff'

let step = ref('3')
let sourceDatabaseName = ref('')
let sourceDatabaseRemark = ref('')
let targetDatabaseName = ref('')
let targetDatabaseRemark = ref('')
let tableNameType = ref('全部表')
let tableNames = ref([
  {
    id: Math.random().toString(),
    name: ''
  }
])
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
  if (_.trim(sourceDatabaseName.value) === '') {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '未提供源数据库名'
    })
    return
  }
  if (_.trim(targetDatabaseName.value) === '') {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '未提供目标数据库名'
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

function copySqlOnClick(isSource, type) {
  let database = isSource ? sourceDatabaseName.value : targetDatabaseName.value
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
    IF(\`COLUMN_DEFAULT\` IS NOT NULL, 'YES', 'NO') AS hasDefault,
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
        hasDefault: {},
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

function step2Next() {
  if (!isSourceTablesReady.value) {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '源数据库表信息未提供'
    })
    return
  }
  if (!isSourceColumnsReady.value) {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '源数据库字段信息未提供'
    })
    return
  }
  if (!isSourceIndexesReady.value) {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '源数据库索引信息未提供'
    })
    return
  }
  if (!isTargetTablesReady.value) {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '目标数据库表信息未提供'
    })
    return
  }
  if (!isTargetColumnsReady.value) {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '目标数据库字段信息未提供'
    })
    return
  }
  if (!isTargetIndexesReady.value) {
    ElMessage({
      type: 'warning',
      grouping: true,
      message: '目标数据库索引信息未提供'
    })
    return
  }

  step.value = '3'
  compare()
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
            columnDefault: c.columnDefault === undefined ? '' : c.columnDefault,
            hasDefault: c.hasDefault === 'YES',
            isNullable: c.isNullable === 'YES',
            dataType: c.dataType,
            columnType: c.columnType,
            characterMaximumLength: c.characterMaximumLength,
            numericPercision: c.numericPercision,
            numericScale: c.numericScale,
            characterSetName: c.characterSetName,
            collationName: c.collationName,
            extra: c.extra === undefined ? '' : c.extra,
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
            nonUnique: item.nonUnique === '1',
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

function compare() {
  console.dir(
    _.find(sourceColumns.value, (n) => n.tableName === 'axyg_group' && n.columnName === 'is_del')
  )

  let sTables = tables(sourceTables.value, sourceColumns.value, sourceIndexes.value)
  let tTables = tables(targetTables.value, targetColumns.value, targetIndexes.value)

  let sTablesDifferences = []
  let tTablesDifferences = []

  let sTableNames = _.map(sTables, (n) => n.tableName)
  let tTableNames = _.map(tTables, (n) => n.tableName)
  let allTableNames = _.orderBy(_.union(sTableNames, tTableNames))
  _.forEach(allTableNames, (tn) => {
    let sTable = _.find(sTables, (n) => n.tableName === tn)
    let tTable = _.find(tTables, (n) => n.tableName === tn)

    let sTableDifference = {}
    let tTableDifference = {}
    if (!sTable && tTable) {
      sTableDifference.table = _.cloneDeep(tTable)
      sTableDifference.table.tableDifferenceType = 'CREATE'

      tTableDifference.table = tTable
      tTableDifference.table.tableDifferenceType = 'DROP'
    } else if (sTable && !tTable) {
      sTableDifference.table = sTable
      sTableDifference.table.tableDifferenceType = 'DROP'

      tTableDifference.table = _.cloneDeep(sTable)
      tTableDifference.table.tableDifferenceType = 'CREATE'
    } else {
      sTableDifference.table = {
        tableDifferenceType: 'NONE',
        tableName: sTable.tableName,
        tableComment: sTable.tableComment,
        tableCommentDifferenceType: 'NONE',
        columns: [],
        indexes: []
      }
      tTableDifference.table = {
        tableDifferenceType: 'NONE',
        tableName: tTable.tableName,
        tableComment: tTable.tableComment,
        tableCommentDifferenceType: 'NONE',
        columns: [],
        indexes: []
      }

      if (sTableDifference.table.tableComment !== tTableDifference.table.tableComment) {
        sTableDifference.table.tableDifferenceType = 'ALERT'
        sTableDifference.table.tableCommentDifferenceType = 'ALERT'
        tTableDifference.table.tableDifferenceType = 'ALERT'
        tTableDifference.table.tableCommentDifferenceType = 'ALERT'
      }

      let sTableColumnNames = _.map(sTable.columns, (sc) => sc.columnName)
      let tTableColumnNames = _.map(tTable.columns, (tc) => tc.columnName)
      let allColumnNames = _.orderBy(_.union(sTableColumnNames, tTableColumnNames))
      _.forEach(allColumnNames, (cn) => {
        let sColumn = _.find(sTable.columns, (sc) => sc.columnName === cn)
        let tColumn = _.find(tTable.columns, (tc) => tc.columnName === cn)
        if (!sColumn && tColumn) {
          sTableDifference.table.columns.push({
            ...tColumn,
            columnDifferenceType: 'ADD'
          })
          sTableDifference.table.tableDifferenceType = 'ALERT'
          tTableDifference.table.columns.push({
            ...tColumn,
            columnDifferenceType: 'DROP'
          })
          tTableDifference.table.tableDifferenceType = 'ALERT'
          return
        }

        if (sColumn && !tColumn) {
          sTableDifference.table.columns.push({
            ...sColumn,
            columnDifferenceType: 'DROP'
          })
          sTableDifference.table.tableDifferenceType = 'ALERT'
          tTableDifference.table.columns.push({
            ...sColumn,
            columnDifferenceType: 'ADD'
          })
          tTableDifference.table.tableDifferenceType = 'ALERT'
          return
        }

        let sc = {
          ...sColumn,
          columnDifferenceType: 'NONE'
        }
        let tc = {
          ...tColumn,
          columnDifferenceType: 'NONE'
        }

        let isDifferentColumn =
          sColumn.hasDefault !== tColumn.hasDefault ||
          (sColumn.hasDefault &&
            tColumn.hasDefault &&
            sColumn.columnDefault !== tColumn.columnDefault) ||
          sColumn.isNullable !== tColumn.isNullable ||
          sColumn.columnType !== tColumn.columnType ||
          sColumn.extra !== tColumn.extra ||
          sColumn.columnComment !== tColumn.columnComment
        if (isDifferentColumn) {
          sc.columnDifferenceType = 'CHANGE'
          sc.change = _.cloneDeep(tColumn)
          sTableDifference.table.tableDifferenceType = 'ALERT'
          tc.columnDifferenceType = 'CHANGE'
          tc.change = _.cloneDeep(sColumn)
          tTableDifference.table.tableDifferenceType = 'ALERT'
        }

        sTableDifference.table.columns.push(sc)
        tTableDifference.table.columns.push(tc)
      })

      let sTableIndexNames = _.map(sTable.indexes, (si) => si.indexName)
      let tTableIndexNames = _.map(tTable.indexes, (ti) => ti.indexName)
      let allIndexNames = _.orderBy(_.union(sTableIndexNames, tTableIndexNames))
      _.forEach(allIndexNames, (iname) => {
        let sIndex = _.find(sTable.indexes, (si) => si.indexName === iname)
        let tIndex = _.find(tTable.indexes, (ti) => ti.indexName === iname)
        if (!sIndex && tIndex) {
          sTableDifference.table.indexes.push({
            ...tIndex,
            indexDifferenceType: 'ADD'
          })
          sTableDifference.table.tableDifferenceType = 'ALERT'
          tTableDifference.table.indexes.push({
            ...tIndex,
            indexDifferenceType: 'DROP'
          })
          tTableDifference.table.tableDifferenceType = 'ALERT'
          return
        }

        if (sIndex && !tIndex) {
          sTableDifference.table.indexes.push({
            ...sIndex,
            indexDifferenceType: 'DROP'
          })
          sTableDifference.table.tableDifferenceType = 'ALERT'
          tTableDifference.table.indexes.push({
            ...sIndex,
            indexDifferenceType: 'ADD'
          })
          tTableDifference.table.tableDifferenceType = 'ALERT'
          return
        }

        let si = {
          ...sIndex,
          indexDifferenceType: 'NONE'
        }
        let ti = {
          ...tIndex,
          indexDifferenceType: 'NONE'
        }
        let isDifferentIndex = diff(sIndex, tIndex)
        if (isDifferentIndex) {
          si.indexDifferenceType = 'DROP_ADD'
          si.add = _.cloneDeep(tIndex)
          sTableDifference.table.tableDifferenceType = 'ALERT'
          ti.indexDifferenceType = 'DROP_ADD'
          ti.add = _.cloneDeep(sIndex)
          tTableDifference.table.tableDifferenceType = 'ALERT'
        }

        sTableDifference.table.indexes.push(si)
        tTableDifference.table.indexes.push(ti)
      })
    }

    sTablesDifferences.push(sTableDifference)
    tTablesDifferences.push(tTableDifference)
  })

  console.dir(sTables)
  console.dir(tTables)
  console.dir(sTablesDifferences)
  console.dir(tTablesDifferences)
}

// step2 end

// step3 begin

function step3Prev() {
  step.value = '2'
}

// step3 end
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
            <div class="block-title">源数据库</div>
            <div class="block">
              <el-input v-model="sourceDatabaseName" :clearable="true" placeholder="输入数据库名">
                <template #prepend>名称</template>
              </el-input>
              <el-input
                v-model="sourceDatabaseRemark"
                :clearable="true"
                placeholder="输入备注以便在差异展示时更容易区别数据库"
              >
                <template #prepend>备注</template>
              </el-input>
            </div>
            <div class="block-title">目标数据库</div>
            <div class="block">
              <el-input v-model="targetDatabaseName" :clearable="true" placeholder="输入数据库名">
                <template #prepend>名称</template>
              </el-input>
              <el-input
                v-model="targetDatabaseRemark"
                :clearable="true"
                placeholder="输入备注以便在差异展示时更容易区别数据库"
              >
                <template #prepend>备注</template>
              </el-input>
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
                  <el-input v-model="item.name" :clearable="true" placeholder="输入表名"></el-input>
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
            <div class="block-title">
              源数据库表信息<template v-if="isSourceTablesReady">
                <span style="color: var(--el-color-success); margin: 0 1rem">已提供</span></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(true, 'tables')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick(true, 'tables')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="sourceTablesFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(true, 'tables')"
              />
            </div>
            <div class="block-title">
              源数据库字段信息<template v-if="isSourceColumnsReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem"
                  >已提供</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(true, 'columns')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick(true, 'columns')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="sourceColumnsFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(true, 'columns')"
              />
            </div>
            <div class="block-title">
              源数据库索引信息<template v-if="isSourceIndexesReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem"
                  >已提供</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(true, 'indexes')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick(true, 'indexes')">复制 SQL 去数据库查询</el-button>
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
            <div class="block-title">
              目标数据库表信息
              <template v-if="isTargetTablesReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem">已提供</span>
              </template>
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(false, 'tables')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick(false, 'tables')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="targetTablesFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(false, 'tables')"
              />
            </div>
            <div class="block-title">
              目标数据库字段信息
              <template v-if="isTargetColumnsReady">
                <span style="color: var(--el-color-success); margin: 0 1rem">已提供</span></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(false, 'columns')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick(false, 'columns')">复制 SQL 去数据库查询</el-button>
              <input
                type="file"
                ref="targetColumnsFile"
                style="display: none"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                @change="fileOnChange(false, 'columns')"
              />
            </div>
            <div class="block-title">
              目标数据库索引信息<template v-if="isTargetIndexesReady"
                ><span style="color: var(--el-color-success); margin: 0 1rem"
                  >已提供</span
                ></template
              >
            </div>
            <div class="block">
              <el-button type="primary" @click="fileOnClick(false, 'indexes')"
                >选择文件 (仅支持 .csv 或 .xlsx)</el-button
              >
              <el-button @click="copySqlOnClick(false, 'indexes')">复制 SQL 去数据库查询</el-button>
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
      <div class="step-container" :class="{ active: isStepActivated('3') }">
        <div class="step-content-container step3-content-container">
          <div class="schema-details">
            <div>
              {{ sourceDatabaseName }}
              {{ sourceDatabaseRemark !== '' ? `(${sourceDatabaseRemark})` : '' }}
            </div>
          </div>
          <div class="schema-compare-result"></div>
        </div>
        <div class="step-nav">
          <el-button type="primary" class="prev" @click="step3Prev"
            >上一步: 提供数据库信息</el-button
          >
        </div>
      </div>
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
  padding: 3rem 2rem;
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

.step3-content-container {
  display: flex;
  flex-direction: row;
}
.schema-details {
  border: 1px solid red;
  width: 0;
  flex-grow: 1;
}
.schema-compare-result {
  border: 1px solid red;
  width: 0;
  flex-grow: 1;
}
</style>

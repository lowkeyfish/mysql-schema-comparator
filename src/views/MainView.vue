<script setup>
import { computed, ref } from 'vue'
import { Plus, Minus, MoreFilled, ArrowRight, Tickets } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import _ from 'lodash'
import copy from 'copy-text-to-clipboard'
import XLSX from 'xlsx'
import { diff } from 'deep-diff'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import 'highlight.js/styles/vs.min.css'
import { useFloating } from '@floating-ui/vue'
hljs.registerLanguage('sql', sql)

let step = ref('1')
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
let sourceTablesDifferences = ref([])
let targetTablesDifferences = ref([])
let displayDatabase = ref('target') // source, target
let displayTable = ref('difference') // all, difference
let finalSql = ref('')
let finalSqlHighlightHtml = ref('')
let floating = ref(null)
let floatingReference = ref(null)
floatingReference.value = {
  getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 20,
      right: 20,
      width: 20,
      height: 20
    }
  }
}
const { floatingStyles } = useFloating(floatingReference, floating, {
  placement: 'bottom-start'
})

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
let displayDatabaseName = computed(() => {
  if (displayDatabase.value === 'source') {
    return (
      sourceDatabaseName.value +
      (sourceDatabaseRemark.value !== '' ? ` (${sourceDatabaseRemark.value})` : '')
    )
  } else {
    return (
      targetDatabaseName.value +
      (targetDatabaseRemark.value !== '' ? ` (${targetDatabaseRemark.value})` : '')
    )
  }
})
let displayTablesDifferences = computed(() => {
  let tables
  if (displayDatabase.value === 'source') {
    tables = sourceTablesDifferences.value
  } else {
    tables = targetTablesDifferences.value
  }
  if (displayTable.value === 'difference') {
    tables = _.filter(tables, (n) => n.tableDifferenceType !== 'NONE')
  }
  return tables
})
// let displayAllTable = computed(() => displayTable.value === 'all')
// let displayDifferenceTable = computed(() => displayTable.value === 'difference')

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
  // sourceTables.value = []
  // sourceTablesFile.value.value = ''
  // sourceColumns.value = []
  // sourceColumnsFile.value.value = ''
  // sourceIndexes.value = []
  // sourceIndexesFile.value.value = ''
  // targetTables.value = []
  // targetTablesFile.value.value = ''
  // targetColumns.value = []
  // targetColumnsFile.value.value = ''
  // targetIndexes.value = []
  // targetIndexesFile.value.value = ''
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
    IFNULL(\`TABLE_COMMENT\`, '') AS tableComment,
    IF(\`TABLE_COMMENT\` IS NOT NULL, 'YES', 'NO') AS hasTableComment
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
    IFNULL(\`COLUMN_DEFAULT\`, '') AS columnDefault,
    IF(\`COLUMN_DEFAULT\` IS NOT NULL, 'YES', 'NO') AS hasDefault,
    \`IS_NULLABLE\` AS isNullable,
    \`DATA_TYPE\` AS dataType,
    IFNULL(\`CHARACTER_MAXIMUM_LENGTH\`, 0) AS characterMaximumLength,
    IF(\`CHARACTER_MAXIMUM_LENGTH\` IS NOT NULL, 'YES', 'NO') AS hasCharacterMaximumLength,
    IFNULL(\`NUMERIC_PRECISION\`, 0) AS numericPercision,
    IF(\`NUMERIC_PRECISION\` IS NOT NULL, 'YES', 'NO') AS hasNumericPercision,
    IFNULL(\`NUMERIC_SCALE\`, 0) AS numericScale,
    IF(\`NUMERIC_SCALE\` IS NOT NULL, 'YES', 'NO') AS hasNumericScale,
    IFNULL(\`CHARACTER_SET_NAME\`, '') AS characterSetName,
    IFNULL(\`COLLATION_NAME\`, '') AS collationName,
    \`COLUMN_TYPE\` AS columnType,
    \`EXTRA\` AS extra,
    IFNULL(\`COLUMN_COMMENT\`, '') AS columnComment,
    IF(\`COLUMN_COMMENT\` IS NOT NULL, 'YES', 'NO') AS hasColumnComment
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
      let keys = XLSX.utils.sheet_to_json(worksheet, { raw: false, header: 1 })[0]
      let json = XLSX.utils.sheet_to_json(worksheet, { raw: false })
      jsonHandler(keys, json)
    }
    reader.readAsText(file)
  } else if (fileExtension === 'xlsx') {
    let reader = new FileReader()
    reader.onload = (e) => {
      let data = new Uint8Array(e.target.result)
      let workbook = XLSX.read(data, { type: 'array' })
      let firstSheetName = workbook.SheetNames[0]
      let worksheet = workbook.Sheets[firstSheetName]
      let keys = XLSX.utils.sheet_to_json(worksheet, { raw: false, header: 1 })[0]
      let json = XLSX.utils.sheet_to_json(worksheet, { raw: false })
      jsonHandler(keys, json)
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

function validateTablesSchema(keys) {
  let requiredKeys = ['tableSchema', 'tableName', 'tableType', 'tableComment', 'hasTableComment']
  return requiredKeys.length === keys.length && _.without(keys, ...requiredKeys).length === 0
}

function validateColumnsSchema(keys) {
  let requiredKeys = [
    'tableSchema',
    'tableName',
    'columnName',
    'ordinalPosition',
    'columnDefault',
    'hasDefault',
    'isNullable',
    'dataType',
    'characterMaximumLength',
    'hasCharacterMaximumLength',
    'numericPercision',
    'hasNumericPercision',
    'numericScale',
    'hasNumericScale',
    'characterSetName',
    'collationName',
    'columnType',
    'extra',
    'columnComment',
    'hasColumnComment'
  ]
  return requiredKeys.length === keys.length && _.without(keys, ...requiredKeys).length === 0
}

function validateIndexesSchema(keys) {
  let requiredKeys = [
    'tableSchema',
    'tableName',
    'nonUnique',
    'indexName',
    'seqInIndex',
    'columnName',
    'collation',
    'indexType'
  ]

  return requiredKeys.length === keys.length && _.without(keys, ...requiredKeys).length === 0
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

  readCsvOrElsxFileToJson(file, (keys, json) => {
    let schemaValid
    let message
    if (type === 'tables') {
      schemaValid = validateTablesSchema(keys)
      if (schemaValid) {
        if (isSource) {
          sourceTables.value = json
        } else {
          targetTables.value = json
        }
      }
      message = '表信息文件数据结构无效'
    } else if (type === 'columns') {
      schemaValid = validateColumnsSchema(keys)
      if (schemaValid) {
        if (isSource) {
          sourceColumns.value = json
        } else {
          targetColumns.value = json
        }
      }
      message = '字段信息文件数据结构无效'
    } else if (type === 'indexes') {
      schemaValid = validateIndexesSchema(keys)
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
            ordinalPosition: +c.ordinalPosition,
            columnDefault: (c.columnDefault === undefined ? '' : c.columnDefault) + '',
            hasDefault: c.hasDefault === 'YES',
            isNullable: c.isNullable === 'YES',
            dataType: c.dataType,
            columnType: c.columnType,
            characterMaximumLength:
              (c.characterMaximumLength === undefined ? '0' : c.characterMaximumLength) + '',
            hasCharacterMaximumLength: c.hasCharacterMaximumLength === 'YES',
            numericPercision: (c.numericPercision === undefined ? '0' : c.numericPercision) + '',
            hasNumericPercision: c.hasNumericPercision === 'YES',
            numericScale: (c.numericScale === undefined ? '0' : c.numericScale) + '',
            hasNumericScale: c.hasNumericScale === 'YES',
            characterSetName: c.characterSetName === undefined ? '' : c.characterSetName,
            collationName: c.collationName === undefined ? '' : c.collationName,
            extra: c.extra === undefined ? '' : c.extra,
            columnComment: c.columnComment === undefined ? '' : c.columnComment,
            hasColumnComment: c.hasColumnComment === 'YES'
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
                seqInIndex: +t.seqInIndex,
                collation: t.collation
              }
            })
          }
        }
      )

      return {
        tableName: t.tableName,
        tableComment: t.tableComment === undefined ? '' : t.tableComment,
        hasTableComment: t.hasTableComment === 'YES',
        columns,
        indexes
      }
    }
  )
}

function compare() {
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

    let sTableDifference = {
      tableExpanded: true,
      columnsExpanded: true,
      indexesExpanded: true,
      tableExcluded: false,
      tableCommentExcluded: false
    }
    let tTableDifference = {
      tableExpanded: true,
      columnsExpanded: true,
      indexesExpanded: true,
      tableExcluded: false,
      tableCommentExcluded: false
    }
    if (!sTable && tTable) {
      sTableDifference = { ...sTableDifference, ..._.cloneDeep(tTable) }
      sTableDifference.tableDifferenceType = 'ADD'

      tTableDifference = { ...tTableDifference, ...tTable }
      tTableDifference.tableDifferenceType = 'DELETE'
    } else if (sTable && !tTable) {
      sTableDifference = { ...sTableDifference, ...sTable }
      sTableDifference.tableDifferenceType = 'DELETE'

      tTableDifference = { ...tTableDifference, ..._.cloneDeep(sTable) }
      tTableDifference.tableDifferenceType = 'ADD'
    } else {
      sTableDifference = {
        tableName: sTable.tableName,
        tableComment: sTable.tableComment,
        hasTableComment: sTable.hasTableComment,
        columns: [],
        indexes: [],
        tableDifferenceType: 'NONE',
        tableCommentDifferenceType: 'NONE',
        columnsDifferenceTypes: [],
        indexesDifferenceTypes: [],
        tableExpanded: true,
        columnsExpanded: true,
        indexesExpanded: true,
        tableExcluded: false,
        tableCommentExcluded: false
      }
      tTableDifference = {
        tableName: tTable.tableName,
        tableComment: tTable.tableComment,
        hasTableComment: tTable.hasTableComment,
        columns: [],
        indexes: [],
        tableDifferenceType: 'NONE',
        tableCommentDifferenceType: 'NONE',
        columnsDifferenceTypes: [],
        indexesDifferenceTypes: [],
        tableExpanded: true,
        columnsExpanded: true,
        indexesExpanded: true,
        tableExcluded: false,
        tableCommentExcluded: false
      }

      if (sTableDifference.hasTableComment && !tTableDifference.hasTableComment) {
        sTableDifference.tableDifferenceType = 'UPDATE'
        sTableDifference.tableCommentDifferenceType = 'DELETE'
        sTableDifference.tableCommentDifferenceDetails = `表删除备注<br/>原备注: "${sTableDifference.tableComment}"`

        tTableDifference.tableDifferenceType = 'UPDATE'
        tTableDifference.tableCommentDifferenceType = 'ADD'
        tTableDifference.tableComment = sTableDifference.tableComment
        tTableDifference.hasTableComment = true
        tTableDifference.tableCommentDifferenceDetails = `表新增备注<br/>新备注: "${tTableDifference.tableComment}"`
      } else if (!sTableDifference.hasTableComment && tTableDifference.hasTableComment) {
        sTableDifference.tableDifferenceType = 'UPDATE'
        sTableDifference.tableCommentDifferenceType = 'ADD'
        sTableDifference.tableComment = tTableDifference.tableComment
        sTableDifference.hasTableComment = true
        sTableDifference.tableCommentDifferenceDetails = `表新增备注<br/>新备注: "${sTableDifference.tableComment}"`

        tTableDifference.tableDifferenceType = 'UPDATE'
        tTableDifference.tableCommentDifferenceType = 'DELETE'
        tTableDifference.tableCommentDifferenceDetails = `表删除备注<br/>原备注: "${tTableDifference.tableComment}"`
      } else if (
        sTableDifference.hasTableComment &&
        tTableDifference.hasTableComment &&
        sTableDifference.tableComment !== tTableDifference.tableComment
      ) {
        sTableDifference.tableDifferenceType = 'UPDATE'
        sTableDifference.tableCommentDifferenceType = 'UPDATE'
        sTableDifference.tableCommentUpdate = tTableDifference.tableComment
        sTableDifference.tableCommentDifferenceDetails = `表更新备注<br/>原备注: "${sTableDifference.tableComment}"<br/>新备注: "${sTableDifference.tableCommentUpdate}"`

        tTableDifference.tableDifferenceType = 'UPDATE'
        tTableDifference.tableCommentDifferenceType = 'UPDATE'
        tTableDifference.tableCommentUpdate = sTableDifference.tableComment
        tTableDifference.tableCommentDifferenceDetails = `表更新备注<br/>原备注: "${tTableDifference.tableComment}"<br/>新备注: "${tTableDifference.tableCommentUpdate}"`
      }

      let sTableColumnNames = _.map(sTable.columns, (sc) => sc.columnName)
      let tTableColumnNames = _.map(tTable.columns, (tc) => tc.columnName)
      let allColumnNames = _.orderBy(_.union(sTableColumnNames, tTableColumnNames))
      _.forEach(allColumnNames, (cn) => {
        let sColumn = _.find(sTable.columns, (sc) => sc.columnName === cn)
        let tColumn = _.find(tTable.columns, (tc) => tc.columnName === cn)
        if (!sColumn && tColumn) {
          sTableDifference.columns.push({
            ...tColumn,
            columnDifferenceType: 'ADD',
            columnExcluded: false,
            columnDifferenceDetails: `字段新增<br/>新字段: ${generateTableCreateColumnSql(tColumn)}`
          })
          sTableDifference.tableDifferenceType = 'UPDATE'

          tTableDifference.columns.push({
            ...tColumn,
            columnDifferenceType: 'DELETE',
            columnExcluded: false,
            columnDifferenceDetails: `字段删除<br/>原字段: ${generateTableCreateColumnSql(tColumn)}`
          })
          tTableDifference.tableDifferenceType = 'UPDATE'

          return
        }

        if (sColumn && !tColumn) {
          sTableDifference.columns.push({
            ...sColumn,
            columnDifferenceType: 'DELETE',
            columnExcluded: false,
            columnDifferenceDetails: `字段删除<br/>原字段: ${generateTableCreateColumnSql(sColumn)}`
          })
          sTableDifference.tableDifferenceType = 'UPDATE'

          tTableDifference.columns.push({
            ...sColumn,
            columnDifferenceType: 'ADD',
            columnExcluded: false,
            columnDifferenceDetails: `字段新增<br/>新字段: ${generateTableCreateColumnSql(sColumn)}`
          })
          tTableDifference.tableDifferenceType = 'UPDATE'

          return
        }

        let sc = {
          ...sColumn,
          columnDifferenceType: 'NONE',
          columnExcluded: false
        }
        let tc = {
          ...tColumn,
          columnDifferenceType: 'NONE',
          columnExcluded: false
        }

        let isDifferentColumn =
          sColumn.hasDefault !== tColumn.hasDefault ||
          (sColumn.hasDefault &&
            tColumn.hasDefault &&
            sColumn.columnDefault !== tColumn.columnDefault) ||
          sColumn.isNullable !== tColumn.isNullable ||
          sColumn.columnType !== tColumn.columnType ||
          sColumn.extra !== tColumn.extra ||
          sColumn.hasColumnComment !== tColumn.hasColumnComment ||
          (sColumn.hasColumnComment &&
            tColumn.hasColumnComment &&
            sColumn.columnComment !== tColumn.columnComment)
        if (isDifferentColumn) {
          sc.columnDifferenceType = 'UPDATE'
          sc.update = _.cloneDeep(tColumn)
          sc.columnDifferenceDetails = `字段更新<br/>原字段: ${generateTableCreateColumnSql(sColumn)}<br/>新字段: ${generateTableCreateColumnSql(tColumn)}`
          sTableDifference.tableDifferenceType = 'UPDATE'

          tc.columnDifferenceType = 'UPDATE'
          tc.update = _.cloneDeep(sColumn)
          tc.columnDifferenceDetails = `字段更新<br/>原字段: ${generateTableCreateColumnSql(tColumn)}<br/>新字段: ${generateTableCreateColumnSql(sColumn)}`
          tTableDifference.tableDifferenceType = 'UPDATE'
        }

        sTableDifference.columns.push(sc)
        tTableDifference.columns.push(tc)
      })

      let sTableColumnDifferenceTypes = _.uniq(
        _.map(sTableDifference.columns, (c) => c.columnDifferenceType)
      )
      // if (sTableColumnDifferenceTypes.length === 1 && sTableColumnDifferenceTypes[0] === 'NONE') {
      //   sTableDifference.columnsDifferenceTypes.push('NONE')
      // } else {
      //   _.remove(sTableColumnDifferenceTypes, (dt) => dt === 'NONE')
      //   sTableDifference.columnsDifferenceTypes = sTableColumnDifferenceTypes
      // }
      _.remove(sTableColumnDifferenceTypes, (dt) => dt === 'NONE')
      sTableDifference.columnsDifferenceTypes = sTableColumnDifferenceTypes

      let tTableColumnDifferenceTypes = _.uniq(
        _.map(tTableDifference.columns, (c) => c.columnDifferenceType)
      )
      // if (tTableColumnDifferenceTypes.length === 1 && tTableColumnDifferenceTypes[0] === 'NONE') {
      //   tTableDifference.columnsDifferenceTypes.push('NONE')
      // } else {
      //   _.remove(tTableColumnDifferenceTypes, (dt) => dt === 'NONE')
      //   tTableDifference.columnsDifferenceTypes = tTableColumnDifferenceTypes
      // }
      _.remove(tTableColumnDifferenceTypes, (dt) => dt === 'NONE')
      tTableDifference.columnsDifferenceTypes = tTableColumnDifferenceTypes

      let sTableIndexNames = _.map(sTable.indexes, (si) => si.indexName)
      let tTableIndexNames = _.map(tTable.indexes, (ti) => ti.indexName)
      let allIndexNames = _.orderBy(_.union(sTableIndexNames, tTableIndexNames))
      _.forEach(allIndexNames, (iname) => {
        let sIndex = _.find(sTable.indexes, (si) => si.indexName === iname)
        let tIndex = _.find(tTable.indexes, (ti) => ti.indexName === iname)
        if (!sIndex && tIndex) {
          sTableDifference.indexes.push({
            ...tIndex,
            indexDifferenceType: 'ADD',
            indexExcluded: false,
            indexDifferenceDetails: `索引新增<br/>新索引: ${generateTableCreateIndexSql(tIndex)
              .replace(/^UNIQUE\s+KEY\b/, 'UNIQUE INDEX')
              .replace(/^KEY\b/, 'INDEX')}`
          })
          sTableDifference.tableDifferenceType = 'UPDATE'

          tTableDifference.indexes.push({
            ...tIndex,
            indexDifferenceType: 'DELETE',
            indexExcluded: false,
            indexDifferenceDetails: `索引删除<br/>原索引: ${generateTableCreateIndexSql(tIndex)
              .replace(/^UNIQUE\s+KEY\b/, 'UNIQUE INDEX')
              .replace(/^KEY\b/, 'INDEX')}`
          })
          tTableDifference.tableDifferenceType = 'UPDATE'

          return
        }

        if (sIndex && !tIndex) {
          sTableDifference.indexes.push({
            ...sIndex,
            indexDifferenceType: 'DELETE',
            indexExcluded: false,
            indexDifferenceDetails: `索引删除<br/>原索引: ${generateTableCreateIndexSql(sIndex)
              .replace(/^UNIQUE\s+KEY\b/, 'UNIQUE INDEX')
              .replace(/^KEY\b/, 'INDEX')}`
          })
          sTableDifference.tableDifferenceType = 'UPDATE'

          tTableDifference.indexes.push({
            ...sIndex,
            indexDifferenceType: 'ADD',
            indexExcluded: false,
            indexDifferenceDetails: `索引新增<br/>新索引: ${generateTableCreateIndexSql(sIndex)
              .replace(/^UNIQUE\s+KEY\b/, 'UNIQUE INDEX')
              .replace(/^KEY\b/, 'INDEX')}`
          })
          tTableDifference.tableDifferenceType = 'UPDATE'

          return
        }

        let si = {
          ...sIndex,
          indexDifferenceType: 'NONE',
          indexExcluded: false
        }
        let ti = {
          ...tIndex,
          indexDifferenceType: 'NONE',
          indexExcluded: false
        }
        let isDifferentIndex = diff(sIndex, tIndex)
        if (isDifferentIndex) {
          si.indexDifferenceType = 'UPDATE'
          si.update = _.cloneDeep(tIndex)
          si.indexDifferenceDetails = `索引更新<br/>原索引: ${generateTableCreateIndexSql(sIndex)
            .replace(/^UNIQUE\s+KEY\b/, 'UNIQUE INDEX')
            .replace(/^KEY\b/, 'INDEX')}<br/>新索引: ${generateTableCreateIndexSql(tIndex)
            .replace(/^UNIQUE\s+KEY\b/, 'UNIQUE INDEX')
            .replace(/^KEY\b/, 'INDEX')}`
          sTableDifference.tableDifferenceType = 'UPDATE'

          ti.indexDifferenceType = 'UPDATE'
          ti.update = _.cloneDeep(sIndex)
          ti.indexDifferenceDetails = `索引更新<br/>原索引: ${generateTableCreateIndexSql(tIndex)
            .replace(/^UNIQUE\s+KEY\b/, 'UNIQUE INDEX')
            .replace(/^KEY\b/, 'INDEX')}<br/>新索引: ${generateTableCreateIndexSql(sIndex)
            .replace(/^UNIQUE\s+KEY\b/, 'UNIQUE INDEX')
            .replace(/^KEY\b/, 'INDEX')}`

          tTableDifference.tableDifferenceType = 'UPDATE'
        }

        sTableDifference.indexes.push(si)
        tTableDifference.indexes.push(ti)
      })
    }

    let sTableIndexDifferenceTypes = _.uniq(
      _.map(sTableDifference.indexes, (c) => c.indexDifferenceType)
    )
    _.remove(sTableIndexDifferenceTypes, (dt) => dt === 'NONE')
    sTableDifference.indexesDifferenceTypes = sTableIndexDifferenceTypes

    let tTableIndexDifferenceTypes = _.uniq(
      _.map(tTableDifference.indexes, (c) => c.indexDifferenceType)
    )
    _.remove(tTableIndexDifferenceTypes, (dt) => dt === 'NONE')
    tTableDifference.indexesDifferenceTypes = tTableIndexDifferenceTypes

    sTablesDifferences.push(sTableDifference)
    tTablesDifferences.push(tTableDifference)
  })

  sourceTablesDifferences.value = sTablesDifferences
  targetTablesDifferences.value = tTablesDifferences
}

// step2 end

// step3 begin

function step3Prev() {
  step.value = '2'
}

function closeTable(tableName) {
  let table
  if (displayDatabase.value === 'source') {
    table = _.find(sourceTablesDifferences.value, (n) => n.tableName === tableName)
  } else {
    table = _.find(targetTablesDifferences.value, (n) => n.tableName === tableName)
  }
  if (table) {
    table.tableExpanded = false
  }
}

function expandTable(tableName) {
  let table
  if (displayDatabase.value === 'source') {
    table = _.find(sourceTablesDifferences.value, (n) => n.tableName === tableName)
  } else {
    table = _.find(targetTablesDifferences.value, (n) => n.tableName === tableName)
  }
  if (table) {
    table.tableExpanded = true
  }
}

function closeAllTable() {
  if (displayDatabase.value === 'source') {
    _.forEach(sourceTablesDifferences.value, (n) => {
      n.tableExpanded = false
    })
  } else {
    _.forEach(targetTablesDifferences.value, (n) => {
      n.tableExpanded = false
    })
  }
}

function resetAllExcluded() {
  let tablesDifferences
  if (displayDatabase.value === 'source') {
    tablesDifferences = sourceTablesDifferences.value
  } else {
    tablesDifferences = targetTablesDifferences.value
  }
  _.forEach(tablesDifferences, (n) => {
    if (n.tableExcluded) {
      n.tableExcluded = false
    }

    _.forEach(n.columns, (c) => {
      if (c.columnExcluded) {
        c.columnExcluded = false
      }
    })
    _.forEach(n.indexes, (i) => {
      if (i.indexExcluded) {
        i.indexExcluded = false
      }
    })
  })
}

function excludeDeleteDifference() {
  let tablesDifferences
  if (displayDatabase.value === 'source') {
    tablesDifferences = sourceTablesDifferences.value
  } else {
    tablesDifferences = targetTablesDifferences.value
  }
  _.forEach(tablesDifferences, (n) => {
    if (n.tableDifferenceType === 'DELETE') {
      n.tableExcluded = true
    }

    _.forEach(n.columns, (c) => {
      if (c.columnDifferenceType === 'DELETE') {
        c.columnExcluded = true
      }
    })
    _.forEach(n.indexes, (i) => {
      if (i.indexDifferenceType === 'DELETE') {
        i.indexExcluded = true
      }
    })
  })
}

function moreHandleCommand(command) {
  if (command === 'closeAllTable') {
    closeAllTable()
  } else if (command === 'resetAllExcluded') {
    resetAllExcluded()
  } else if (command === 'excludeDeleteDifference') {
    excludeDeleteDifference()
  }
}

function generateSql() {
  let databaseName
  if (displayDatabase.value === 'source') {
    databaseName = sourceDatabaseName.value
  } else {
    databaseName = targetDatabaseName.value
  }
  let tables = _.filter(
    displayTablesDifferences.value,
    (n) => n.tableDifferenceType !== 'NONE' && !n.tableExcluded
  )
  let tableSqlList = []
  _.forEach(tables, (t) => {
    if (t.tableDifferenceType === 'ADD') {
      tableSqlList.push(generateTableCreateSql(databaseName, t))
    } else if (t.tableDifferenceType === 'DELETE') {
      tableSqlList.push(generateTableDeleteSql(databaseName, t))
    } else if (t.tableDifferenceType === 'UPDATE') {
      tableSqlList.push(generateTableUpdateSql(databaseName, t))
    }
  })

  finalSql.value = _.filter(tableSqlList, (n) => n !== '').join('\r\n\r\n')
  console.log(finalSql.value)
  finalSqlHighlightHtml.value = hljs.highlight(finalSql.value, { language: 'sql' }).value
  console.log(finalSqlHighlightHtml.value)
}

function generateTableCreateSql(databaseName, table) {
  let tableCommentSql = ''
  if (table.hasTableComment) {
    tableCommentSql = ` COMMENT = '${table.tableComment}'`
  }
  let columnAndIndexSql = []
  _.forEach(
    _.orderBy(table.columns, (n) => n.ordinalPosition),
    (c) => columnAndIndexSql.push(generateTableCreateColumnSql(c))
  )
  _.forEach(table.indexes, (i) => columnAndIndexSql.push(generateTableCreateIndexSql(i)))

  let sql = `CREATE TABLE \`${databaseName}\`.\`${table.tableName}\` (\r\n${columnAndIndexSql.join(',\r\n')}\r\n)${tableCommentSql};`
  return sql
}

function generateTableDeleteSql(databaseName, table) {
  if (table.tableExcluded) {
    return ''
  }

  let sql = `DROP TABLE \`${databaseName}\`.\`${table.tableName}\`;`
  return sql
}

function generateTableUpdateSql(databaseName, table) {
  let columnIndexCommentSql = []
  _.forEach(
    _.orderBy(
      _.filter(table.columns, (n) => n.columnDifferenceType !== 'NONE' && !n.columnExcluded),
      (n) => n.ordinalPosition
    ),
    (c) => {
      columnIndexCommentSql.push(generateTableUpdateColumnSql(c))
    }
  )

  _.forEach(
    _.filter(table.indexes, (n) => n.indexDifferenceType !== 'NONE' && !n.indexExcluded),
    (i) => columnIndexCommentSql.push(generateTableUpdateIndexSql(i))
  )

  if (table.tableCommentDifferenceType !== 'NONE' && !table.tableCommentExcluded) {
    if (table.tableCommentDifferenceType === 'ADD') {
      columnIndexCommentSql.push(`COMMENT = '${table.tableComment}'`)
    } else if (table.tableCommentDifferenceType === 'DELETE') {
      columnIndexCommentSql.push(`COMMENT = ''`)
    } else if (table.tableCommentDifferenceType === 'UPDATE') {
      columnIndexCommentSql.push(`COMMENT = '${table.tableCommentUpdate}'`)
    }
  }

  if (columnIndexCommentSql.length === 0) {
    return ''
  }

  let sql = `ALTER TABLE \`${databaseName}\`.\`${table.tableName}\`\r\n${columnIndexCommentSql.join(',\r\n')};`
  return sql
}

function generateTableCreateColumnSql(column) {
  let columnSql = []
  columnSql.push(`\`${column.columnName}\``)
  columnSql.push(column.columnType)
  if (!column.isNullable) {
    columnSql.push('NOT NULL')
  }
  if (column.hasDefault) {
    if (column.columnDefault === 'CURRENT_TIMESTAMP') {
      columnSql.push(`DEFAULT CURRENT_TIMESTAMP`)
    } else {
      columnSql.push(`DEFAULT '${column.columnDefault}'`)
    }
  }
  let extra = column.extra.replace('DEFAULT_GENERATED', '').trim().toUpperCase()
  if (extra) {
    columnSql.push(extra)
  }
  if (column.hasColumnComment) {
    columnSql.push(`COMMENT '${column.columnComment}'`)
  }
  return columnSql.join(' ')
}

function generateTableUpdateColumnSql(column) {
  if (column.columnDifferenceType === 'ADD') {
    return `ADD COLUMN ${generateTableCreateColumnSql(column)}`
  } else if (column.columnDifferenceType === 'DELETE') {
    return `DROP COLUMN \`${column.columnName}\``
  } else if (column.columnDifferenceType === 'UPDATE') {
    return `CHANGE COLUMN \`${column.columnName}\` ${generateTableCreateColumnSql(column.update)}`
  }
}

function generateTableCreateIndexSql(index) {
  let indexSql = []
  if (index.indexName === 'PRIMARY') {
    indexSql.push('PRIMARY KEY')
  } else {
    if (index.nonUnique) {
      indexSql.push('KEY')
      indexSql.push(`\`${index.indexName}\``)
    } else {
      indexSql.push('UNIQUE KEY')
      indexSql.push(`\`${index.indexName}\``)
    }
  }

  let indexColumnsSql = []
  _.forEach(
    _.orderBy(index.columns, (c) => c.seqInIndex),
    (c) => {
      indexColumnsSql.push(`\`${c.columnName}\` ${c.collation === 'A' ? 'ASC' : 'DESC'}`)
    }
  )

  indexSql.push(`(${indexColumnsSql.join(',')})`)
  return indexSql.join(' ')
}

function generateTableUpdateIndexSql(index) {
  let indexesSql = []

  if (index.indexDifferenceType === 'UPDATE' || index.indexDifferenceType === 'DELETE') {
    if (index.indexName === 'PRIMARY') {
      indexesSql.push('DROP PRIMARY KEY')
    } else {
      indexesSql.push(`DROP INDEX \`${index.indexName}\``)
    }
  }

  let indexSql = []
  if (index.indexDifferenceType === 'ADD' || index.indexDifferenceType === 'UPDATE') {
    if (index.indexName === 'PRIMARY') {
      indexSql.push('ADD PRIMARY KEY')
    } else {
      indexSql.push(`ADD${!index.nonUnique ? ' UNIQUE ' : ' '}INDEX \`${index.indexName}\``)
    }

    let index2 = index.indexDifferenceType === 'ADD' ? index : index.update
    let indexColumnsSql = []
    _.forEach(
      _.orderBy(index2.columns, (c) => c.seqInIndex),
      (c) => {
        indexColumnsSql.push(`\`${c.columnName}\` ${c.collation === 'A' ? 'ASC' : 'DESC'}`)
      }
    )
    indexSql.push(`(${indexColumnsSql.join(',')})`)

    indexesSql.push(indexSql.join(' '))
  }
  return indexesSql.join(',\r\n')
}

// function differenceElementOnClick({ clientX, clientY }) {
//   floatingReference.value = {
//     getBoundingClientRect() {
//       return {
//         width: 0,
//         height: 0,
//         x: clientX,
//         y: clientY,
//         top: clientY,
//         left: clientX,
//         right: clientX,
//         bottom: clientY
//       }
//     }
//   }
// }

function step3Next() {
  generateSql()
  step.value = '4'
}

// step3 end

// step4 begin
function step4Prev() {
  step.value = '3'
}

function copyFinalSqlOnClick() {
  copy(finalSql.value)
  ElMessage({
    type: 'success',
    grouping: true,
    message: '数据库同步 SQL 已复制'
  })
}

// step4 end
</script>

<template>
  <div class="page">
    <div class="page-header">
      <span class="logo">MySQL Schema Comparator</span>
    </div>
    <div class="page-body">
      <div class="step-tabs">
        <div class="step-tab" :class="{ active: isStepActivated('1') }">① 选择数据库</div>
        <div class="step-tab-split">
          <el-icon><ArrowRight /></el-icon>
        </div>
        <div class="step-tab" :class="{ active: isStepActivated('2') }">② 提供数据库信息</div>
        <div class="step-tab-split">
          <el-icon><ArrowRight /></el-icon>
        </div>
        <div class="step-tab" :class="{ active: isStepActivated('3') }">③ 比较差异</div>
        <div class="step-tab-split">
          <el-icon><ArrowRight /></el-icon>
        </div>
        <div class="step-tab" :class="{ active: isStepActivated('4') }">④ 生成数据库同步 SQL</div>
      </div>
      <div class="step-container" :class="{ active: isStepActivated('1') }">
        <div class="step-content-container step1-content-container">
          <div class="step1-content">
            <div class="block-title">源数据库</div>
            <div class="block">
              <div class="database-name-area">
                <el-input v-model="sourceDatabaseName" :clearable="true" placeholder="输入数据库名">
                  <template #prepend>名称</template>
                </el-input>
                <el-input
                  v-model="sourceDatabaseRemark"
                  :clearable="true"
                  placeholder="数据库名相同时使用备注区分数据库"
                >
                  <template #prepend>备注</template>
                </el-input>
              </div>
            </div>
            <div class="block-title">目标数据库</div>
            <div class="block">
              <div class="database-name-area">
                <el-input v-model="targetDatabaseName" :clearable="true" placeholder="输入数据库名">
                  <template #prepend>名称</template>
                </el-input>
                <el-input
                  v-model="targetDatabaseRemark"
                  :clearable="true"
                  placeholder="数据库名相同时使用备注区分数据库"
                >
                  <template #prepend>备注</template>
                </el-input>
              </div>
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
                >选择文件 (支持 .csv .xlsx)</el-button
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
                >选择文件 (支持 .csv .xlsx)</el-button
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
                >选择文件 (支持 .csv .xlsx)</el-button
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
                >选择文件 (支持 .csv .xlsx)</el-button
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
                >选择文件 (支持 .csv .xlsx)</el-button
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
                >选择文件 (支持 .csv .xlsx)</el-button
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
          <div class="cr-header">
            <div class="cr-database-name">
              {{ displayDatabaseName }}
            </div>
            <div class="cr-controls">
              <el-radio-group v-model="displayDatabase" size="small">
                <el-radio-button label="源数据库" value="source" />
                <el-radio-button label="目标数据库" value="target" />
              </el-radio-group>
              <el-radio-group v-model="displayTable" size="small">
                <el-radio-button label="全部表" value="all" />
                <el-radio-button label="有差异的表" value="difference" />
              </el-radio-group>
              <el-dropdown trigger="click" @command="moreHandleCommand">
                <el-button :icon="MoreFilled" size="small" circle />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="closeAllTable">折叠全部表</el-dropdown-item>
                    <el-dropdown-item command="resetAllExcluded"
                      >将所有忽略重置为包含</el-dropdown-item
                    >
                    <el-dropdown-item command="excludeDeleteDifference"
                      >忽略所有删除类型差异</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="cr-tables">
            <div class="cr-table" v-for="table in displayTablesDifferences" :key="table.tableName">
              <div class="cr-table-header">
                <div class="table-open-close">
                  <el-icon v-if="!table.tableExpanded" @click="expandTable(table.tableName)">
                    <Plus />
                  </el-icon>
                  <el-icon v-if="table.tableExpanded" @click="closeTable(table.tableName)">
                    <Minus />
                  </el-icon>
                </div>
                <div>{{ table.tableName }}</div>
                <div class="difference-types">
                  <div class="difference-type a" v-if="table.tableDifferenceType === 'ADD'">
                    新增
                  </div>
                  <div class="difference-type u" v-else-if="table.tableDifferenceType === 'UPDATE'">
                    更新
                  </div>
                  <div class="difference-type d" v-else-if="table.tableDifferenceType === 'DELETE'">
                    删除
                  </div>
                  <!-- <div class="difference-type n" v-else>无差异</div> -->
                </div>

                <el-switch
                  v-if="table.tableDifferenceType !== 'NONE'"
                  class="exclude"
                  inline-prompt
                  active-text="忽略"
                  inactive-text="包含"
                  size="small"
                  v-model="table.tableExcluded"
                />
              </div>
              <div class="cr-table-body" v-show="table.tableExpanded">
                <div class="cr-table-comment-header">
                  <div>Comment</div>
                  <template
                    v-if="
                      table.tableDifferenceType === 'UPDATE' &&
                      table.tableCommentDifferenceType !== 'NONE'
                    "
                  >
                    <el-tooltip :content="table.tableCommentDifferenceDetails" raw-content>
                      <div class="difference-details">
                        <el-icon><Tickets /></el-icon>
                      </div>
                    </el-tooltip>
                    <div class="difference-types" v-if="table.tableDifferenceType === 'UPDATE'">
                      <div
                        class="difference-type a"
                        v-if="table.tableCommentDifferenceType === 'ADD'"
                      >
                        新增
                      </div>
                      <div
                        class="difference-type u"
                        v-else-if="table.tableCommentDifferenceType === 'UPDATE'"
                      >
                        更新
                      </div>
                      <div
                        class="difference-type d"
                        v-else-if="table.tableCommentDifferenceType === 'DELETE'"
                      >
                        删除
                      </div>
                    </div>

                    <el-switch
                      class="exclude"
                      inline-prompt
                      active-text="忽略"
                      inactive-text="包含"
                      size="small"
                      v-model="table.tableCommentExcluded"
                    />
                  </template>
                </div>
                <div class="cr-table-comment-body">
                  {{
                    table.tableCommentDifferenceType === 'UPDATE'
                      ? table.tableCommentUpdate
                      : table.tableComment
                  }}
                </div>
                <div class="cr-columns-header">
                  <div>Columns</div>
                  <template
                    v-if="
                      table.tableDifferenceType === 'UPDATE' &&
                      table.columnsDifferenceTypes.length !== 0
                    "
                  >
                    <div class="difference-types">
                      <div
                        class="difference-type"
                        :class="{
                          a: dt === 'ADD',
                          u: dt === 'UPDATE',
                          d: dt === 'DELETE',
                          n: dt === 'NONE'
                        }"
                        v-for="dt in _.filter(table.columnsDifferenceTypes, (n) => n !== 'NONE')"
                        :key="dt"
                      >
                        {{
                          dt === 'ADD'
                            ? '新增'
                            : dt === 'UPDATE'
                              ? '更新'
                              : dt === 'DELETE'
                                ? '删除'
                                : '无变化'
                        }}
                      </div>
                    </div>
                  </template>
                </div>
                <div class="cr-columns-body">
                  <div
                    class="cr-column"
                    v-for="column in table.columns"
                    :key="table.tableName + ':' + column.columnName"
                  >
                    <div class="cr-column-header">
                      <div>{{ column.columnName }}</div>
                      <template
                        v-if="
                          table.tableDifferenceType === 'UPDATE' &&
                          column.columnDifferenceType !== 'NONE'
                        "
                      >
                        <el-tooltip :content="column.columnDifferenceDetails" raw-content>
                          <div class="difference-details">
                            <el-icon><Tickets /></el-icon>
                          </div>
                        </el-tooltip>
                        <div class="difference-types">
                          <div
                            class="difference-type"
                            :class="{
                              a: column.columnDifferenceType === 'ADD',
                              u: column.columnDifferenceType === 'UPDATE',
                              d: column.columnDifferenceType === 'DELETE',
                              n: column.columnDifferenceType === 'NONE'
                            }"
                          >
                            {{
                              column.columnDifferenceType === 'ADD'
                                ? '新增'
                                : column.columnDifferenceType === 'UPDATE'
                                  ? '更新'
                                  : column.columnDifferenceType === 'DELETE'
                                    ? '删除'
                                    : '无变化'
                            }}
                          </div>
                        </div>

                        <el-switch
                          v-if="
                            table.tableDifferenceType === 'UPDATE' &&
                            column.columnDifferenceType !== 'NONE'
                          "
                          class="exclude"
                          inline-prompt
                          active-text="忽略"
                          inactive-text="包含"
                          size="small"
                          v-model="column.columnExcluded"
                        />
                      </template>
                    </div>
                  </div>
                </div>
                <div class="cr-indexes-header">
                  <div>Indexes</div>
                  <div
                    class="difference-types"
                    v-if="
                      table.tableDifferenceType === 'UPDATE' &&
                      table.indexesDifferenceTypes.length > 0
                    "
                  >
                    <div
                      class="difference-type"
                      v-for="dt in _.filter(table.indexesDifferenceTypes, (n) => n !== 'NONE')"
                      :key="dt"
                      :class="{
                        a: dt === 'ADD',
                        u: dt === 'UPDATE',
                        d: dt === 'DELETE',
                        n: dt === 'NONE'
                      }"
                    >
                      {{
                        dt === 'ADD'
                          ? '新增'
                          : dt === 'UPDATE'
                            ? '更新'
                            : dt === 'DELETE'
                              ? '删除'
                              : '无变化'
                      }}
                    </div>
                  </div>
                </div>
                <div class="cr-indexes-body">
                  <div
                    class="cr-index"
                    v-for="index in table.indexes"
                    :key="table.tableName + ':' + index.indexName"
                  >
                    <div class="cr-index-header">
                      <div>{{ index.indexName }}</div>
                      <template
                        v-if="
                          table.tableDifferenceType === 'UPDATE' &&
                          index.indexDifferenceType !== 'NONE'
                        "
                      >
                        <el-tooltip :content="index.indexDifferenceDetails" raw-content>
                          <div class="difference-details">
                            <el-icon><Tickets /></el-icon>
                          </div>
                        </el-tooltip>
                        <div class="difference-types">
                          <div
                            class="difference-type"
                            :class="{
                              a: index.indexDifferenceType === 'ADD',
                              u: index.indexDifferenceType === 'UPDATE',
                              d: index.indexDifferenceType === 'DELETE',
                              n: index.indexDifferenceType === 'NONE'
                            }"
                          >
                            {{
                              index.indexDifferenceType === 'ADD'
                                ? '新增'
                                : index.indexDifferenceType === 'UPDATE'
                                  ? '更新'
                                  : index.indexDifferenceType === 'DELETE'
                                    ? '删除'
                                    : '无变化'
                            }}
                          </div>
                        </div>

                        <el-switch
                          class="exclude"
                          inline-prompt
                          active-text="忽略"
                          inactive-text="包含"
                          size="small"
                          v-model="index.indexExcluded"
                        />
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="step-nav">
          <el-button type="primary" class="prev" @click="step3Prev"
            >上一步: 提供数据库信息</el-button
          >
          <el-button type="primary" class="next" @click="step3Next"
            >下一步: 生成数据库同步 SQL</el-button
          >
        </div>
      </div>
      <div class="step-container" :class="{ active: isStepActivated('4') }">
        <div class="step-content-container step4-content-container">
          <pre v-html="finalSqlHighlightHtml"></pre>
        </div>
        <div class="step-nav">
          <el-button type="primary" class="prev" @click="step4Prev">上一步: 比较差异</el-button>
          <el-button type="primary" class="next" @click="copyFinalSqlOnClick">拷贝 SQL</el-button>
        </div>
      </div>
    </div>
  </div>
  <div class="difference-tip" ref="floating" :style="floatingStyles">哈哈</div>
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
.database-name-area {
  display: flex;
  flex-direction: row;

  .el-input:first-of-type {
    margin-right: 1.2rem;
  }
}

.step-container {
  display: none;
  flex-direction: column;
  height: 0;
  flex-grow: 1;
  align-items: center;
  width: 84rem;
  justify-self: center;
  position: relative;
  margin: auto;

  &.active {
    display: flex;
  }
}

.step-content-container {
  // flex-grow: 1;
  // padding: 3rem 2rem;
  box-sizing: border-box;
  width: 84rem;
  box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  border: 1px solid var(--el-border-color-light);
  // overflow: auto;
  margin: 2rem 0 3rem 0;
  // height: 0;
  // flex-grow: 1;
}

.step-nav {
  width: 84rem;
  display: flex;
  // height: 6rem;
  // min-height: 6rem;
  flex-direction: row;
  align-self: center;
  align-items: center;
  position: sticky;
  bottom: 0;
  background-color: white;
  margin-bottom: 2rem;

  .next {
    margin-left: auto;
  }

  .prev {
    margin-right: auto;
  }
}

.step1-content-container {
  padding: 3rem 2rem;
  overflow: auto;
}

.step1-content {
  align-self: center;
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
  justify-content: space-between;
  padding: 3rem 2rem;
  // width: 80rem;
}

.step2-content-left {
  // border: 1px solid red;
  // padding: 3rem 2rem;
}

.step2-content-right {
  // border: 1px solid red;
  // padding: 3rem 2rem;
}

.step3-content-container {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
.cr-header {
  border-bottom: 1px solid var(--el-border-color-light);
  height: 4rem;
  min-height: 4rem;
  padding: 0 1rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  position: relative;
}
.cr-database-name {
  font-weight: bold;
  font-size: 1.6rem;
}

.cr-tables {
  overflow: auto;
  padding: 0 1rem;
  position: relative;
}

.cr-table-header {
  font-weight: bold;
  position: sticky;
  top: 0;
  z-index: 2;
  background: white;
}
.cr-table-header,
.cr-table-comment-header,
.cr-columns-header,
.cr-indexes-header,
.cr-column-header,
.cr-index-header {
  display: flex;
  flex-direction: row;
  height: 2rem;
  align-items: center;
}

.cr-table-comment-header,
.cr-columns-header,
.cr-indexes-header {
  padding-left: 4rem;
  font-weight: bold;
}
.cr-column-header,
.cr-index-header {
  padding-left: 6rem;
}

.cr-table-comment-body {
  padding-left: 6rem;
}

.difference-types {
  display: flex;
  flex-direction: row;
  margin-left: 0.5rem;
}
.difference-type {
  color: white;
  line-height: 1;
  padding: 0.3rem 0.3rem;
  font-size: 1.1rem;
  border-radius: 0.3rem;
  margin-right: 0.5rem;

  &.a {
    background-color: #19be6b;
  }

  &.u {
    background-color: #ff9900;
  }

  &.d {
    background-color: #ed4014;
  }

  &.n {
    background-color: #909399;
  }
}

.difference-details {
  display: flex;
  align-items: center;
  margin: 0 0.5rem;
  cursor: pointer;
  & + .difference-types {
    margin-left: 0;
  }
}

.cr-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.cr-controls2 {
  position: absolute;
  right: 84rem;
  top: 5rem;

  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1rem;
}

.cr-more {
  position: absolute;
  top: 6rem;
  right: 1rem;

  .el-button {
    color: var(--el-button-border-color);

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

.table-open-close {
  display: flex;
  align-items: center;

  .el-icon {
    cursor: pointer;
    margin-right: 0.6rem;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

.exclude {
  // margin-left: 0.4rem;
}

.final-sql-dialog {
  .el-textarea__inner {
    height: 50rem;
    resize: none;
    padding: 0.4rem;
    white-space: nowrap;
    border-radius: 0;
  }
}

.step4-content-container {
  min-height: 40rem;
  overflow: auto;
  padding: 1rem;

  pre {
    margin: 0;
  }
}

.difference-tip {
  width: 30rem;
  border: 1px solid var(--el-border-color);
  border-radius: 0.5rem;
  position: absolute;
  top: 0;
  left: 0;
  background-color: white;
  padding: 0.4rem;
  box-shadow: 0px 1px 5px 1px var(--el-border-color);
  z-index: 2001;
  display: none;
}
</style>

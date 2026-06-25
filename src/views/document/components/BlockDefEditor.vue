<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick, Loading } from '@element-plus/icons-vue'
import { chatWithAI } from '@/api/ai'
import { markdownToHtml, htmlToMarkdown } from '@/utils/document-helpers'
import {
  parseTemplateDataSourceFile,
  downloadTemplateCsv,
  downloadBatchErrorsCsv,
} from '@/utils/template-data-source'

const props = defineProps({
  def: { type: Object, required: true },
  index: { type: Number, required: true },
  total: { type: Number, required: true },
  templateId: { type: String, default: '' },
})

const emit = defineEmits(['update', 'delete', 'move-up', 'move-down', 'upload-file-batch', 'publish-file-batch'])

const expanded = ref(false)
const activeTab = ref('content')

const blockTypes = [
  { value: 'rich_text', label: '富文本' },
  { value: 'table', label: '表格' },
  { value: 'ai_content', label: 'AI 内容' },
  { value: 'image', label: '图片' },
]

const typeBadgeClass = computed(() => {
  const map = { rich_text: 'badge-blue', table: 'badge-green', ai_content: 'badge-orange', image: 'badge-gray' }
  return map[props.def.type] || 'badge-gray'
})

function patch(partial) { emit('update', { ...props.def, ...partial }) }

function onTypeChange(e) {
  const type = e.target.value
  const defaults = {
    rich_text: { markdown: '请输入内容', html: '<p>请输入内容</p>', rawText: '请输入内容', variables: [] },
    table: { columns: [{ id: 'c1', title: '列1', width: 'auto', align: 'left', headerStyle: {} }], rows: [], style: { borderColor: '#e2e8f0', borderWidth: 1, headerBgColor: '#1e40af', headerTextColor: '#ffffff', stripedRows: true, fontSize: 14 } },
    ai_content: { html: '', rawText: '', prompt: '', model: 'gpt-4', variables: [] },
    image: { url: '', alt: '', width: 'auto', height: 'auto', alignment: 'center' },
  }
  patch({ type, defaultContent: defaults[type] })
}

function onLabelChange(e) { patch({ label: e.target.value }) }
function onRequiredChange(e) { patch({ required: e.target.checked }) }

const dsEnabled = computed(() => !!props.def.dataSourceConfig)
const dataSourceMode = computed(() => props.def.dataSourceConfig?.mode || 'api')
const fileInputRef = ref(null)
const uploadError = ref('')
const aiSqlGenerating = ref(false)

const fileBatches = computed(() => props.def.dataSourceConfig?.fileConfig?.batches ?? [])
const publishedBatchId = computed(() => props.def.dataSourceConfig?.fileConfig?.publishedBatchId || '')
const dataSourceSql = computed(() => props.def.dataSourceConfig?.sql || '')

const latestBatch = computed(() => fileBatches.value[0] || null)
function toggleDataSource() {
  if (props.def.dataSourceConfig) patch({ dataSourceConfig: null })
  else patch({ dataSourceConfig: { mode: 'api', apiEndpoint: '', paramMapping: {}, sql: '', fileConfig: { publishedBatchId: '', batches: [] } } })
}

function updateDataSourceMode(e) {
  if (!props.def.dataSourceConfig) return
  const mode = e.target.value === 'file' ? 'file' : 'api'
  patch({
    dataSourceConfig: {
      ...props.def.dataSourceConfig,
      mode,
      fileConfig: props.def.dataSourceConfig.fileConfig || { publishedBatchId: '', batches: [] },
    },
  })
}

function updateDsEndpoint(e) {
  if (!props.def.dataSourceConfig) return
  patch({ dataSourceConfig: { ...props.def.dataSourceConfig, apiEndpoint: e.target.value } })
}

function updateDsParams(e) {
  if (!props.def.dataSourceConfig) return
  try {
    const obj = JSON.parse(e.target.value)
    patch({ dataSourceConfig: { ...props.def.dataSourceConfig, paramMapping: obj } })
  } catch {}
}

function updateDsSql(e) {
  if (!props.def.dataSourceConfig) return
  patch({ dataSourceConfig: { ...props.def.dataSourceConfig, sql: e.target.value } })
}

function truncateText(value, maxLength = 1000) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function stripHtml(html = '') {
  return String(html).replace(/<[^>]+>/g, ' ')
}

function summarizeTableContent(content = {}) {
  const columns = (content.columns || []).map((column) => column.title).filter(Boolean).join('，')
  const rows = (content.rows || []).slice(0, 3).map((row) => {
    const values = (row.cells || []).map((cell) => cell.value).filter(Boolean)
    return values.join('，')
  }).filter(Boolean)
  return [
    columns ? `表格列：${columns}` : '',
    rows.length ? `示例数据：${rows.join('；')}` : '',
  ].filter(Boolean).join('\n')
}

function summarizeVariables(content = {}) {
  const variables = content.variables || []
  if (!variables.length) return ''
  return variables.map((item) => {
    const parts = [item.key, item.label, item.sourceApi, item.responseField].filter(Boolean)
    return parts.join(' / ')
  }).join('\n')
}

function buildSqlGenerationContext() {
  const content = props.def.defaultContent || {}
  const contentSummaryMap = {
    rich_text: truncateText(content.markdown || content.rawText || stripHtml(content.html)),
    table: summarizeTableContent(content),
    ai_content: truncateText(content.prompt || content.rawText || stripHtml(content.html)),
    image: truncateText(content.alt || content.url),
  }

  return [
    `块名称：${props.def.label || '未命名'}`,
    `块类型：${blockTypes.find((item) => item.value === props.def.type)?.label || props.def.type}`,
    contentSummaryMap[props.def.type] ? `块查询内容：\n${contentSummaryMap[props.def.type]}` : '',
    summarizeVariables(content) ? `变量信息：\n${summarizeVariables(content)}` : '',
    props.def.dataSourceConfig?.apiEndpoint ? `已有 API：${props.def.dataSourceConfig.apiEndpoint}` : '',
    props.def.dataSourceConfig?.paramMapping ? `参数映射：${JSON.stringify(props.def.dataSourceConfig.paramMapping)}` : '',
    dataSourceSql.value ? `已有 SQL 或补充说明：\n${dataSourceSql.value}` : '',
  ].filter(Boolean).join('\n\n')
}

function extractSqlFromAiResponse(content = '') {
  let text = String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
  const fenced = text.match(/```(?:sql)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()
  const sqlStart = text.match(/\b(with|select)\b[\s\S]*/i)
  if (sqlStart) text = sqlStart[0].trim()
  return text.replace(/^`+|`+$/g, '').trim()
}

function validateGeneratedSql(sql) {
  if (!/^\s*(select|with)\b/i.test(sql)) return 'AI 未返回 SELECT 查询语句'
  if (/;\s*\S/.test(sql.replace(/;\s*$/, ''))) return 'AI 返回了多条 SQL，请保留一条查询语句'
  if (/\b(insert|update|delete|drop|alter|truncate|create|merge|call|exec)\b/i.test(sql)) return 'AI 返回的 SQL 包含非查询操作，请调整块内容后重试'
  return ''
}

async function generateSqlByAi() {
  if (!props.def.dataSourceConfig || aiSqlGenerating.value) return
  const context = buildSqlGenerationContext()
  if (!context.trim()) {
    ElMessage.warning('请先完善块名称或默认内容，再生成 SQL')
    return
  }

  aiSqlGenerating.value = true
  try {
    const result = await chatWithAI([
      {
        role: 'system',
        content: '你是政务报表模板的数据源 SQL 生成助手。根据模板块上下文生成一条只读查询 SQL。只返回 SQL，不要 Markdown、解释或注释。SQL 必须以 SELECT 或 WITH 开头，不能包含写入、删除、建表、改表等操作。中文展示字段请使用反引号别名。',
      },
      {
        role: 'user',
        content: `请根据下面的模板块查询内容生成 SQL：\n\n${context}`,
      },
    ])
    const sql = extractSqlFromAiResponse(result)
    const error = validateGeneratedSql(sql)
    if (error) {
      ElMessage.warning(error)
      return
    }
    patch({ dataSourceConfig: { ...props.def.dataSourceConfig, sql } })
    ElMessage.success('SQL 已生成')
  } catch (error) {
    ElMessage.error(error?.message || 'SQL 生成失败，请稍后重试')
  } finally {
    aiSqlGenerating.value = false
  }
}

function openFilePicker() {
  uploadError.value = ''
  if (fileInputRef.value) fileInputRef.value.click()
}

async function onFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const parsed = await parseTemplateDataSourceFile(file)
    emit('upload-file-batch', {
      templateId: props.templateId,
      blockId: props.def.id,
      fileName: file.name,
      headers: parsed.headers,
      records: parsed.records,
    })
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : '文件读取失败，请重试'
  } finally {
    event.target.value = ''
  }
}

function publishBatch(batchId) {
  emit('publish-file-batch', {
    templateId: props.templateId,
    blockId: props.def.id,
    batchId,
  })
}

function downloadDataTemplate() {
  downloadTemplateCsv(props.def)
}

function exportBatchErrors(batch) {
  downloadBatchErrorsCsv(batch, props.def.label || props.def.id)
}

const contentMarkdown = computed(() => {
  const c = props.def.defaultContent || {}
  if (c.markdown) return c.markdown
  if (c.rawText) return c.rawText
  if (c.html) return htmlToMarkdown(c.html)
  return ''
})
function updateContentMarkdown(e) {
  const markdown = e.target.value
  const c = {
    ...(props.def.defaultContent || {}),
    markdown,
    rawText: markdown,
    html: markdownToHtml(markdown),
  }
  patch({ defaultContent: c })
}

const variables = computed(() => props.def.defaultContent?.variables ?? [])

const groupedVariables = computed(() => {
  const groups = new Map()
  variables.value.forEach((v, idx) => {
    const api = (v.sourceApi || '').trim() || '(未配置接口)'
    const list = groups.get(api) || []
    list.push({ ...v, __idx: idx })
    groups.set(api, list)
  })

  return Array.from(groups.entries()).map(([api, items], i) => ({
    api,
    items,
    colorClass: `api-color-${(i % 6) + 1}`,
  }))
})
function addVariable() {
  const c = { ...(props.def.defaultContent || {}) }
  const vars = [...(c.variables || [])]
  vars.push({ key: `{{var_${vars.length + 1}}}`, label: '新变量', value: '', sourceApi: '', responseField: '', fetchedAt: '' })
  c.variables = vars
  patch({ defaultContent: c })
}
function updateVariable(idx, field, value) {
  const c = { ...(props.def.defaultContent || {}) }
  const vars = [...(c.variables || [])]
  vars[idx] = { ...vars[idx], [field]: value }
  c.variables = vars
  patch({ defaultContent: c })
}
function removeVariable(idx) {
  const c = { ...(props.def.defaultContent || {}) }
  const vars = [...(c.variables || [])]
  vars.splice(idx, 1)
  c.variables = vars
  patch({ defaultContent: c })
}

const tableColumns = computed(() => props.def.defaultContent?.columns ?? [])
const tableRows = computed(() => props.def.defaultContent?.rows ?? [])
function addColumn() {
  const c = { ...(props.def.defaultContent || {}) }
  const cols = [...(c.columns || [])]
  cols.push({ id: `col_${Date.now().toString(36)}`, title: '新列', width: 'auto', align: 'left', headerStyle: {} })
  c.columns = cols
  patch({ defaultContent: c })
}
function updateColumn(idx, field, value) {
  const c = { ...(props.def.defaultContent || {}) }
  const cols = [...(c.columns || [])]
  cols[idx] = { ...cols[idx], [field]: value }
  c.columns = cols
  patch({ defaultContent: c })
}
function removeColumn(idx) {
  const c = { ...(props.def.defaultContent || {}) }
  const cols = [...(c.columns || [])]
  cols.splice(idx, 1)
  c.columns = cols
  patch({ defaultContent: c })
}

const aiPrompt = computed(() => props.def.defaultContent?.prompt ?? '')
const aiModel = computed(() => props.def.defaultContent?.model ?? 'gpt-4')
function updateAiPrompt(e) { patch({ defaultContent: { ...(props.def.defaultContent || {}), prompt: e.target.value } }) }
function updateAiModel(e) { patch({ defaultContent: { ...(props.def.defaultContent || {}), model: e.target.value } }) }
</script>

<template>
  <div class="bde" :class="{ expanded }">
    <div class="bde-header" @click="expanded = !expanded">
      <span class="bde-order">#{{ index + 1 }}</span>
      <span :class="['badge', typeBadgeClass]">{{ blockTypes.find(t => t.value === def.type)?.label }}</span>
      <span class="bde-label">{{ def.label || '(未命名)' }}</span>
      <span v-if="def.required" class="bde-req">必填</span>
      <span v-if="def.dataSourceConfig" class="bde-ds-tag">有数据源</span>
      <div class="bde-actions" @click.stop>
        <button class="btn btn-sm btn-outline" :disabled="index === 0" @click="$emit('move-up')">↑</button>
        <button class="btn btn-sm btn-outline" :disabled="index === total - 1" @click="$emit('move-down')">↓</button>
        <button class="btn btn-sm btn-danger" @click="$emit('delete')">删除</button>
      </div>
      <span class="bde-toggle">{{ expanded ? '▾' : '▸' }}</span>
    </div>

    <div v-if="expanded" class="bde-body">
      <div class="bde-row">
        <div class="bde-field">
          <label>块名称</label>
          <input :value="def.label" @change="onLabelChange" />
        </div>
        <div class="bde-field bde-field-sm">
          <label>类型</label>
          <select :value="def.type" @change="onTypeChange">
            <option v-for="t in blockTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="bde-field bde-field-xs">
          <label>&nbsp;</label>
          <label class="bde-check"><input type="checkbox" :checked="def.required" @change="onRequiredChange" />必填</label>
        </div>
      </div>

      <div class="bde-tabs">
        <button :class="['bde-tab', { active: activeTab === 'content' }]" @click="activeTab = 'content'">默认内容</button>
        <button v-if="def.type === 'rich_text' || def.type === 'ai_content'" :class="['bde-tab', { active: activeTab === 'variables' }]" @click="activeTab = 'variables'">变量 ({{ variables.length }})</button>
        <button :class="['bde-tab', { active: activeTab === 'datasource' }]" @click="activeTab = 'datasource'">数据源</button>
      </div>

      <div v-if="activeTab === 'content'" class="bde-tab-panel">
        <template v-if="def.type === 'rich_text'">
          <label class="bde-sm-label">Markdown 模板内容（支持 <code v-pre>{{变量}}</code> 占位符）</label>
          <textarea class="bde-code" rows="6" :value="contentMarkdown" @change="updateContentMarkdown" />
        </template>
        <template v-else-if="def.type === 'ai_content'">
          <div class="bde-row">
            <div class="bde-field"><label>Prompt 模板</label><textarea rows="3" :value="aiPrompt" @change="updateAiPrompt" /></div>
            <div class="bde-field bde-field-sm"><label>模型</label><select :value="aiModel" @change="updateAiModel"><option value="gpt-4">GPT-4</option><option value="gpt-3.5-turbo">GPT-3.5</option><option value="deepseek-v3">DeepSeek V3</option><option value="qwen-max">通义千问 Max</option></select></div>
          </div>
        </template>
        <template v-else-if="def.type === 'table'">
          <div class="bde-section">
            <div class="bde-section-head">
              <span>列定义</span>
              <span class="bde-section-meta">{{ tableColumns.length }} 列 · {{ tableRows.length }} 行默认数据</span>
              <button class="btn btn-sm btn-outline" @click="addColumn">+ 添加列</button>
            </div>
            <div v-for="(col, ci) in tableColumns" :key="col.id" class="bde-col-row">
              <input :value="col.title" placeholder="列标题" @change="e => updateColumn(ci, 'title', e.target.value)" />
              <select :value="col.align" @change="e => updateColumn(ci, 'align', e.target.value)"><option value="left">左</option><option value="center">中</option><option value="right">右</option></select>
              <button class="btn btn-sm btn-danger" @click="removeColumn(ci)">×</button>
            </div>
            <div v-if="tableRows.length" class="bde-table-sample">
              <div class="bde-table-sample-title">默认数据预览（前 5 行）</div>
              <div class="bde-table-sample-wrap">
                <table>
                  <thead>
                    <tr><th v-for="col in tableColumns" :key="col.id">{{ col.title }}</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in tableRows.slice(0, 5)" :key="row.id">
                      <td v-for="col in tableColumns" :key="col.id">{{ row.cells?.find((cell) => cell.columnId === col.id)?.value || '' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </template>
        <template v-else-if="def.type === 'image'"><p class="bde-hint">图片块的默认内容可在文档编辑时设置。</p></template>
      </div>

      <div v-if="activeTab === 'variables'" class="bde-tab-panel">
        <div class="bde-section-head"><span>变量列表 ({{ variables.length }})</span><button class="btn btn-sm btn-outline" @click="addVariable">+ 添加变量</button></div>
        <div v-if="!variables.length" class="bde-hint">暂无变量，点击添加。</div>
        <div v-if="variables.length" class="bde-var-head-row">
          <span>占位符</span>
          <span>标签名</span>
          <span>接口 URL</span>
          <span>返回字段</span>
          <span>操作</span>
        </div>
        <div v-for="group in groupedVariables" :key="group.api" :class="['bde-var-group', group.colorClass]">
          <div class="bde-var-group-head">
            <span class="bde-var-group-api">{{ group.api }}</span>
            <span class="bde-var-group-count">{{ group.items.length }} 个变量</span>
          </div>
          <div v-for="v in group.items" :key="`${group.api}-${v.__idx}`" class="bde-var-row">
            <input :value="v.key" placeholder="{{key}}" @change="e => updateVariable(v.__idx, 'key', e.target.value)" />
            <input :value="v.label" placeholder="标签名" @change="e => updateVariable(v.__idx, 'label', e.target.value)" />
            <input :value="v.sourceApi" placeholder="/api/xxx" @change="e => updateVariable(v.__idx, 'sourceApi', e.target.value)" />
            <input :value="v.responseField" placeholder="字段名" @change="e => updateVariable(v.__idx, 'responseField', e.target.value)" />
            <button class="btn btn-sm btn-danger" @click="removeVariable(v.__idx)">×</button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'datasource'" class="bde-tab-panel">
        <label class="bde-check" style="margin-bottom:8px"><input type="checkbox" :checked="dsEnabled" @change="toggleDataSource" />启用数据源</label>
        <template v-if="def.dataSourceConfig">
          <div class="bde-field bde-field-sm">
            <label>数据源类型</label>
            <select :value="dataSourceMode" @change="updateDataSourceMode">
              <option value="api">API 接口</option>
              <option value="file">CSV 文件</option>
            </select>
          </div>

          <template v-if="dataSourceMode === 'api'">
            <div class="bde-field"><label>API 接口</label><input :value="def.dataSourceConfig.apiEndpoint" placeholder="/api/xxx" @change="updateDsEndpoint" /></div>
            <div class="bde-field"><label>参数映射 (JSON)</label><textarea class="bde-code" rows="3" :value="JSON.stringify(def.dataSourceConfig.paramMapping, null, 2)" @change="updateDsParams" /></div>
            <div class="bde-field">
              <div class="bde-label-row">
                <label>SQL 语句</label>
                <button class="btn btn-sm btn-outline bde-ai-sql-btn" :disabled="aiSqlGenerating" @click="generateSqlByAi">
                  <el-icon :class="{ spin: aiSqlGenerating }">
                    <Loading v-if="aiSqlGenerating" />
                    <MagicStick v-else />
                  </el-icon>
                  {{ aiSqlGenerating ? '生成中' : 'AI生成' }}
                </button>
              </div>
              <textarea class="bde-code" rows="4" :value="dataSourceSql" placeholder="请输入 SELECT 查询 SQL" @change="updateDsSql" />
            </div>
          </template>

          <template v-else>
            <div class="bde-section">
              <div class="bde-section-head">
                <span>文件批次</span>
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-sm btn-outline" @click="downloadDataTemplate">下载模板</button>
                  <button class="btn btn-sm btn-outline" @click="openFilePicker">上传文件</button>
                </div>
              </div>
              <input ref="fileInputRef" type="file" accept=".csv,.xlsx,.xls" style="display:none" @change="onFileSelected" />
              <p v-if="uploadError" class="bde-error">{{ uploadError }}</p>

              <div v-if="latestBatch" class="bde-file-batch">
                <div><strong>最新批次:</strong> {{ latestBatch.fileName }}</div>
                <div><strong>时间:</strong> {{ new Date(latestBatch.uploadedAt).toLocaleString('zh-CN') }}</div>
                <div><strong>记录:</strong> {{ latestBatch.totalCount }}，失败: {{ latestBatch.failCount }}</div>
                <div v-if="latestBatch.errors?.length" class="bde-error-list">
                  <div v-for="(err, ei) in latestBatch.errors.slice(0, 3)" :key="ei">行{{ err.rowNo || '-' }} {{ err.colName }}：{{ err.message }}</div>
                </div>
              </div>

              <div v-if="fileBatches.length" class="bde-batch-list">
                <div v-for="batch in fileBatches.slice(0, 5)" :key="batch.id" class="bde-batch-item">
                  <div class="bde-batch-main">
                    <span>{{ batch.fileName }}</span>
                    <span class="bde-batch-meta">{{ batch.totalCount }} 行</span>
                    <span v-if="publishedBatchId === batch.id" class="badge badge-green">已发布</span>
                  </div>
                  <div style="display:flex; gap:6px;">
                    <button v-if="batch.errors?.length || batch.warnings?.length" class="btn btn-sm btn-outline" @click="exportBatchErrors(batch)">导出报告</button>
                    <button class="btn btn-sm btn-primary" :disabled="!!batch.errors?.length || publishedBatchId === batch.id" @click="publishBatch(batch.id)">发布</button>
                  </div>
                </div>
              </div>
              <div v-else class="bde-hint">暂无上传记录，请先上传 CSV 文件。</div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bde { border:1px solid var(--c-border); border-radius:var(--radius); background:white; margin-bottom:8px; transition:box-shadow .15s; }
.bde.expanded { box-shadow:0 2px 8px rgba(0,0,0,.06); }
.bde-header { display:flex; align-items:center; gap:8px; padding:10px 14px; cursor:pointer; user-select:none; }
.bde-header:hover { background:#f8fafc; }
.bde-order { font-weight:700; font-size:13px; color:var(--c-primary); min-width:24px; }
.bde-label { flex:1; font-weight:500; font-size:14px; }
.bde-req { font-size:11px; color:#dc2626; font-weight:500; }
.bde-ds-tag { font-size:11px; color:#0ea5e9; font-weight:500; }
.bde-actions { display:flex; gap:4px; }
.bde-toggle { color:var(--c-text-secondary); font-size:12px; width:16px; text-align:center; }
.bde-body { padding:0 14px 14px; border-top:1px solid var(--c-border); }
.bde-row { display:flex; gap:10px; margin-top:10px; }
.bde-field { flex:1; display:flex; flex-direction:column; gap:4px; }
.bde-field label { font-size:12px; font-weight:500; color:var(--c-text-secondary); }
.bde-field input,.bde-field select,.bde-field textarea { padding:6px 8px; border:1px solid var(--c-border); border-radius:4px; font-size:13px; font-family:inherit; outline:none; }
.bde-field input:focus,.bde-field select:focus,.bde-field textarea:focus { border-color:var(--c-primary); }
.bde-label-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.bde-ai-sql-btn { display:inline-flex; align-items:center; gap:4px; white-space:nowrap; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.bde-field-sm { flex:0 0 140px; }
.bde-field-xs { flex:0 0 70px; }
.bde-check { display:inline-flex; align-items:center; gap:4px; font-size:13px; cursor:pointer; }
.bde-tabs { display:flex; gap:2px; margin-top:12px; border-bottom:1px solid var(--c-border); }
.bde-tab { padding:6px 14px; border:none; background:transparent; font-size:13px; font-family:inherit; cursor:pointer; color:var(--c-text-secondary); border-bottom:2px solid transparent; margin-bottom:-1px; }
.bde-tab.active { color:var(--c-primary); border-bottom-color:var(--c-primary); }
.bde-tab-panel { padding:12px 0 0; }
.bde-sm-label { font-size:12px; color:var(--c-text-secondary); margin-bottom:4px; display:block; }
.bde-code { width:100%; padding:8px; border:1px solid var(--c-border); border-radius:4px; font-family:Consolas, Monaco, monospace; font-size:13px; outline:none; resize:vertical; }
.bde-code:focus { border-color:var(--c-primary); }
.bde-section { margin-bottom:12px; }
.bde-section-head { display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:500; margin-bottom:6px; }
.bde-section-meta { margin-left:auto; margin-right:8px; font-size:12px; color:var(--c-text-secondary); font-weight:400; }
.bde-col-row,.bde-var-row { display:flex; gap:6px; margin-bottom:4px; }
.bde-col-row input,.bde-var-row input { flex:1; min-width:0; padding:5px 8px; border:1px solid var(--c-border); border-radius:4px; font-size:13px; font-family:inherit; outline:none; }
.bde-col-row select { width:60px; padding:5px 4px; border:1px solid var(--c-border); border-radius:4px; font-size:12px; }
.bde-hint { font-size:13px; color:var(--c-text-secondary); padding:8px 0; }
.bde-error { color:#dc2626; font-size:12px; margin:4px 0; }
.bde-file-batch { padding:8px; border:1px solid var(--c-border); border-radius:6px; background:#f8fafc; margin-bottom:8px; font-size:12px; display:flex; flex-direction:column; gap:4px; }
.bde-error-list { color:#dc2626; display:flex; flex-direction:column; gap:2px; }
.bde-batch-list { display:flex; flex-direction:column; gap:6px; }
.bde-batch-item { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; border:1px solid var(--c-border); border-radius:6px; }
.bde-batch-main { display:flex; align-items:center; gap:8px; font-size:12px; }
.bde-batch-meta { color:var(--c-text-secondary); }
.bde-table-sample { margin-top:10px; border:1px solid var(--c-border); border-radius:6px; overflow:hidden; }
.bde-table-sample-title { padding:6px 8px; font-size:12px; color:var(--c-text-secondary); background:#f8fafc; border-bottom:1px solid var(--c-border); }
.bde-table-sample-wrap { overflow:auto; max-height:220px; }
.bde-table-sample table { width:100%; border-collapse:collapse; font-size:12px; min-width:640px; }
.bde-table-sample th,.bde-table-sample td { border:1px solid var(--c-border); padding:5px 7px; text-align:left; white-space:normal; vertical-align:top; }
.bde-table-sample th { background:#f1f5f9; font-weight:600; }
.bde-var-head-row { display:grid; grid-template-columns: 1fr 1fr 1.2fr 1fr 56px; gap:6px; margin:6px 0 8px; padding:0 2px; font-size:12px; color:var(--c-text-secondary); font-weight:600; }
.bde-var-group { border:1px solid var(--c-border); border-left-width:4px; border-radius:6px; padding:8px; margin-bottom:8px; background:#fff; }
.bde-var-group-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.bde-var-group-api { font-size:12px; font-weight:700; }
.bde-var-group-count { font-size:12px; color:var(--c-text-secondary); }
.api-color-1 { border-left-color:#3b82f6; background:#eff6ff; }
.api-color-2 { border-left-color:#10b981; background:#ecfdf5; }
.api-color-3 { border-left-color:#f59e0b; background:#fffbeb; }
.api-color-4 { border-left-color:#8b5cf6; background:#f5f3ff; }
.api-color-5 { border-left-color:#ef4444; background:#fef2f2; }
.api-color-6 { border-left-color:#14b8a6; background:#f0fdfa; }
</style>

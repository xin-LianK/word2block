<script setup>
import { computed, onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentStore } from '@/stores/document'

const store = useDocumentStore()
const router = useRouter()

const showCreateModal = ref(false)
const modalMode = ref('create')
const editingDocId = ref('')
const newTitle = ref('')
const selectedTemplateId = ref('')
const selectedQuickMonth = ref('')
const createDateRange = ref([])

const modalTitle = computed(() => modalMode.value === 'edit' ? '修改文档标题' : '新建文档')
const submitText = computed(() => modalMode.value === 'edit' ? '保存' : '创建')
const quickMonthOptions = computed(() => {
  const now = new Date()
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const month = formatMonthValue(date)
    return {
      label: index === 0 ? '本月' : index === 1 ? '上月' : `${index}个月前`,
      value: month,
      startDate: getMonthStartDate(month),
      endDate: getMonthEndDate(month),
      text: formatShortDateRangeText(getMonthStartDate(month), getMonthEndDate(month)),
    }
  })
})
const selectedPeriodText = computed(() => {
  const [startDate, endDate] = normalizeDateRange(createDateRange.value)
  if (!startDate || !endDate) return '未选择'
  return formatDateRangeText(startDate, endDate)
})

function ensureDefaultTemplate() {
  if (!selectedTemplateId.value || !store.templates.some((t) => t.id === selectedTemplateId.value)) {
    selectedTemplateId.value = store.templates[0]?.id ?? ''
  }
}

function formatMonthValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatMonthText(month) {
  const [year, monthNum] = String(month).split('-')
  return `${year}年${Number(monthNum)}月`
}

function normalizeDateValue(value) {
  const text = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`
  return ''
}

function getMonthStartDate(month) {
  return `${month}-01`
}

function getMonthEndDate(month) {
  const [year, monthNum] = String(month).split('-').map(Number)
  const day = new Date(year, monthNum, 0).getDate()
  return `${month}-${String(day).padStart(2, '0')}`
}

function getMonthFromDate(date) {
  return normalizeDateValue(date).slice(0, 7)
}

function normalizeDateRange(range) {
  if (!Array.isArray(range) || range.length < 2 || !range[0] || !range[1]) {
    return ['', '']
  }
  const start = normalizeDateValue(range[0])
  const end = normalizeDateValue(range[1])
  if (!start || !end) return ['', '']
  return start <= end ? [start, end] : [end, start]
}

function formatMonthRangeText(startMonth, endMonth) {
  return startMonth === endMonth
    ? formatMonthText(startMonth)
    : `${formatMonthText(startMonth)} 至 ${formatMonthText(endMonth)}`
}

function formatDateText(date) {
  const [year, month, day] = normalizeDateValue(date).split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}

function formatShortDateRangeText(startDate, endDate) {
  return `${startDate.slice(5).replace('-', '.')} - ${endDate.slice(5).replace('-', '.')}`
}

function formatDateRangeText(startDate, endDate) {
  return startDate === endDate
    ? formatDateText(startDate)
    : `${formatDateText(startDate)} 至 ${formatDateText(endDate)}`
}

function resetCreatePeriod() {
  const currentMonth = quickMonthOptions.value[0]
  selectedQuickMonth.value = currentMonth?.value ?? ''
  createDateRange.value = currentMonth ? [currentMonth.startDate, currentMonth.endDate] : []
}

function applyQuickMonth(option) {
  selectedQuickMonth.value = option.value
  createDateRange.value = [option.startDate, option.endDate]
}

function handleDateRangeChange(value) {
  const [startDate, endDate] = normalizeDateRange(value)
  const matchedQuick = quickMonthOptions.value.find((option) => option.startDate === startDate && option.endDate === endDate)
  selectedQuickMonth.value = matchedQuick?.value ?? ''
}

function buildReportPeriod() {
  let [startDate, endDate] = normalizeDateRange(createDateRange.value)
  if (!startDate || !endDate) {
    resetCreatePeriod()
    const normalizedRange = normalizeDateRange(createDateRange.value)
    startDate = normalizedRange[0]
    endDate = normalizedRange[1]
  }

  const matchedQuick = quickMonthOptions.value.find((option) => option.value === selectedQuickMonth.value)
  return {
    startDate,
    endDate,
    startMonth: getMonthFromDate(startDate),
    endMonth: getMonthFromDate(endDate),
    quickLabel: matchedQuick && matchedQuick.startDate === startDate && matchedQuick.endDate === endDate ? matchedQuick.label : '',
  }
}

onMounted(ensureDefaultTemplate)
onActivated(ensureDefaultTemplate)

function openDoc(id) {
  router.push({ name: 'DocumentEdit', params: { id } })
}

function openCreateModal() {
  modalMode.value = 'create'
  editingDocId.value = ''
  newTitle.value = ''
  selectedTemplateId.value = store.templates[0]?.id ?? ''
  resetCreatePeriod()
  showCreateModal.value = true
}

function openEditTitleModal(doc) {
  modalMode.value = 'edit'
  editingDocId.value = doc.id
  newTitle.value = doc.title
  selectedTemplateId.value = doc.templateId
  showCreateModal.value = true
}

function closeModal() {
  showCreateModal.value = false
  modalMode.value = 'create'
  editingDocId.value = ''
}

function createDoc() {
  if (!newTitle.value.trim() || !selectedTemplateId.value) return
  const doc = store.createFromTemplate(selectedTemplateId.value, newTitle.value.trim(), '当前用户', buildReportPeriod())
  closeModal()
  if (doc) openDoc(doc.id)
}

function saveTitle() {
  if (!newTitle.value.trim() || !editingDocId.value) return
  store.updateDocumentTitle(editingDocId.value, newTitle.value.trim())
  closeModal()
}

function submitModal() {
  if (modalMode.value === 'edit') saveTitle()
  else createDoc()
}

function deleteDoc(id) {
  if (confirm('确定要删除这个文档吗？')) {
    store.deleteDocument(id)
  }
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('zh-CN')
}

function getTemplateName(tplId) {
  return store.templates.find((t) => t.id === tplId)?.name ?? tplId
}

function getDocPeriodText(doc) {
  const period = doc.metadata?.reportPeriod
  if (period?.startDate && period?.endDate) {
    return formatDateRangeText(period.startDate, period.endDate)
  }
  if (!period?.startMonth || !period?.endMonth) return ''
  return formatMonthRangeText(period.startMonth, period.endMonth)
}
</script>

<template>
  <div class="doc-list-page">
    <div class="page-header">
      <h2>文档列表</h2>
      <button class="btn btn-primary" @click="openCreateModal">+ 新建文档</button>
    </div>

    <div v-if="!store.documentList.length" class="empty-state">
      <p>暂无文档，点击"新建文档"开始创建</p>
    </div>

    <div v-else class="doc-grid">
      <div
        v-for="doc in store.documentList"
        :key="doc.id"
        class="doc-card card"
        @click="openDoc(doc.id)"
      >
        <div class="doc-card-body">
          <h3>{{ doc.title }}</h3>
          <div class="doc-card-meta">
            <span class="badge badge-gray">{{ getTemplateName(doc.templateId) }}</span>
            <span v-if="getDocPeriodText(doc)" class="badge badge-blue">{{ getDocPeriodText(doc) }}</span>
            <span>{{ doc.blockCount }} 个内容块</span>
          </div>
        </div>
        <div class="doc-card-footer">
          <span>{{ doc.createdBy }}</span>
          <span>{{ formatTime(doc.updatedAt) }}</span>
          <button
            class="btn btn-sm btn-outline"
            @click.stop="openEditTitleModal(doc)"
          >
            修改标题
          </button>
          <button
            class="btn btn-sm btn-danger"
            @click.stop="deleteDoc(doc.id)"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal card doc-create-modal">
          <h3>{{ modalTitle }}</h3>
          <div class="form-group">
            <label>文档标题</label>
            <input
              v-model="newTitle"
              type="text"
              placeholder="请输入文档标题"
              @keydown.enter="submitModal"
            />
          </div>
          <div v-if="modalMode === 'create'" class="form-group">
            <label>选择模板</label>
            <select v-model="selectedTemplateId">
              <option
                v-for="tpl in store.templates"
                :key="tpl.id"
                :value="tpl.id"
              >
                {{ tpl.name }} — {{ tpl.description }}
              </option>
            </select>
          </div>
          <div v-if="modalMode === 'create'" class="form-group">
            <label>快捷筛选日期</label>
            <div class="month-shortcuts">
              <button
                v-for="option in quickMonthOptions"
                :key="option.value"
                type="button"
                :class="['month-chip', { active: selectedQuickMonth === option.value }]"
                @click="applyQuickMonth(option)"
              >
                <span>{{ option.label }}</span>
                <small>{{ option.text }}</small>
              </button>
            </div>
          </div>
          <div v-if="modalMode === 'create'" class="form-group">
            <label>日期范围</label>
            <el-date-picker
              v-model="createDateRange"
              class="date-range-picker"
              type="daterange"
              format="YYYY年MM月DD日"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              :clearable="false"
              @change="handleDateRangeChange"
            />
            <div class="month-range-summary">当前筛选：{{ selectedPeriodText }}</div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-outline" @click="closeModal">取消</button>
            <button class="btn btn-primary" @click="submitModal">{{ submitText }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
.doc-list-page { padding: 20px 24px 24px; }
.page-header h2 { font-size:22px; }
.empty-state { text-align:center; padding:80px 0; color:var(--c-text-secondary); }
.doc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(450px,1fr)); gap:16px; }
.doc-card { cursor:pointer; transition:box-shadow .15s ease, transform .15s ease; }
.doc-card:hover { box-shadow:var(--shadow-md); transform:translateY(-2px); }
.doc-card-body { padding:20px; }
.doc-card-body h3 { font-size:18px; margin-bottom:8px; }
.doc-card-meta { display:flex; align-items:center; gap:8px; font-size:15px; color:var(--c-text-secondary); }
.doc-card-footer { display:flex; align-items:center; gap:12px; padding:12px 20px; border-top:1px solid var(--c-border); font-size:14px; color:var(--c-text-secondary); }
.doc-card-footer .btn:first-of-type { margin-left:auto; }
.doc-create-modal { width:min(560px, 92vw); }
.month-shortcuts { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
.month-chip { min-width:0; min-height:58px; border:1px solid var(--c-border); border-radius:6px; background:#fff; color:var(--c-text); cursor:pointer; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:4px; padding:8px 10px; font-family:inherit; text-align:left; transition:border-color .15s ease, background .15s ease, color .15s ease, box-shadow .15s ease; }
.month-chip:hover { border-color:var(--c-primary); color:var(--c-primary); }
.month-chip.active { border-color:var(--c-primary); background:#eff6ff; color:var(--c-primary); box-shadow:inset 0 0 0 1px var(--c-primary); }
.month-chip span { font-size:14px; font-weight:600; line-height:1.2; }
.month-chip small { font-size:12px; color:var(--c-text-secondary); line-height:1.2; }
.month-chip.active small { color:var(--c-primary); }
.date-range-picker { width:100%; }
.month-range-summary { margin-top:6px; color:var(--c-text-secondary); font-size:12px; }
:deep(.date-range-picker) { width:100%; }
@media (max-width: 560px) {
  .doc-grid { grid-template-columns:1fr; }
  .month-shortcuts { grid-template-columns:repeat(2, minmax(0, 1fr)); }
}
</style>

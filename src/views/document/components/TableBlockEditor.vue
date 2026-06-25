<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({ block: { type: Object, required: true } })
const emit = defineEmits(['save'])

const draftColumns = ref([])
const draftRows = ref([])
const draftStyle = ref({})
const isDirty = ref(false)

function resetDraft() {
  draftColumns.value = JSON.parse(JSON.stringify(props.block.content.columns))
  draftRows.value = JSON.parse(JSON.stringify(props.block.content.rows))
  draftStyle.value = JSON.parse(JSON.stringify(props.block.content.style))
  isDirty.value = false
}

watch(() => props.block.id, resetDraft, { immediate: true })

function markDirty() { isDirty.value = true }

function save() {
  emit('save', {
    columns: JSON.parse(JSON.stringify(draftColumns.value)),
    rows: JSON.parse(JSON.stringify(draftRows.value)),
    style: JSON.parse(JSON.stringify(draftStyle.value)),
  })
  isDirty.value = false
}

function discard() { resetDraft() }

const editingCell = ref(null)
const editingHeader = ref(null)
const showStylePanel = ref(false)
const style = computed(() => draftStyle.value)

function headerCellStyle(col) {
  const s = col.headerStyle
  return {
    backgroundColor: s.bgColor ?? style.value.headerBgColor,
    color: s.textColor ?? style.value.headerTextColor,
    fontWeight: s.fontWeight ?? 'bold',
    fontFamily: s.fontFamily ?? style.value.fontFamily,
    textAlign: col.align,
    width: col.width === 'auto' ? 'auto' : `${col.width}px`,
    fontSize: `${s.fontSize ?? style.value.fontSize}px`,
    border: `${style.value.borderWidth}px solid ${style.value.borderColor}`,
    padding: style.value.cellPadding ?? '8px 12px',
    lineHeight: style.value.lineHeight ?? 1.5,
    verticalAlign: style.value.verticalAlign ?? 'middle',
    whiteSpace: style.value.whiteSpace ?? 'pre-line',
  }
}

function bodyCellStyle(cell, col, rowIdx) {
  const cs = cell.style
  const striped = style.value.stripedRows && rowIdx % 2 === 1
  return {
    backgroundColor: cs?.bgColor ?? (striped ? '#f8fafc' : 'transparent'),
    color: cs?.textColor ?? 'inherit',
    fontWeight: cs?.fontWeight ?? 'normal',
    fontFamily: cs?.fontFamily ?? style.value.fontFamily,
    textAlign: col.align,
    fontSize: `${cs?.fontSize ?? style.value.fontSize}px`,
    border: `${style.value.borderWidth}px solid ${cs?.borderColor ?? style.value.borderColor}`,
    padding: style.value.cellPadding ?? '8px 12px',
    lineHeight: style.value.lineHeight ?? 1.5,
    verticalAlign: style.value.verticalAlign ?? 'middle',
    whiteSpace: style.value.whiteSpace ?? 'pre-line',
  }
}

function startEditHeader(colId) { editingHeader.value = colId }
function finishEditHeader(colId, event) {
  const target = event.target
  const newTitle = target.innerText.trim()
  editingHeader.value = null
  draftColumns.value = draftColumns.value.map((c) => c.id === colId ? { ...c, title: newTitle } : c)
  markDirty()
}

function startEditCell(rowId, colId) { editingCell.value = { rowId, colId } }
function finishEditCell(rowId, colId, event) {
  const target = event.target
  const newValue = target.innerText.trim()
  editingCell.value = null
  draftRows.value = draftRows.value.map((r) => {
    if (r.id !== rowId) return r
    return { ...r, cells: r.cells.map((c) => c.columnId === colId ? { ...c, value: newValue } : c) }
  })
  markDirty()
}

function addRow() {
  const newRow = {
    id: `row_${Date.now()}`,
    cells: draftColumns.value.map((col) => ({ columnId: col.id, value: '' })),
  }
  draftRows.value = [...draftRows.value, newRow]
  markDirty()
}

function removeRow(rowId) {
  draftRows.value = draftRows.value.filter((r) => r.id !== rowId)
  markDirty()
}

function updateStyleField(field, value) {
  draftStyle.value = { ...draftStyle.value, [field]: value }
  markDirty()
}
</script>

<template>
  <div class="table-block">
    <div class="block-toolbar">
      <span class="badge badge-green">表格</span>
      <button class="btn btn-sm btn-outline" @click="showStylePanel = !showStylePanel">{{ showStylePanel ? '收起样式' : '表格样式' }}</button>
      <button class="btn btn-sm btn-outline" @click="addRow">+ 添加行</button>
      <div v-if="isDirty" class="dirty-actions">
        <span class="dirty-hint">有未保存的修改</span>
        <button class="btn btn-sm btn-outline" @click="discard">放弃</button>
        <button class="btn btn-sm btn-primary" @click="save">保存修改</button>
      </div>
    </div>

    <div v-if="showStylePanel" class="style-panel">
      <label>表头背景色<input type="color" :value="style.headerBgColor" @input="updateStyleField('headerBgColor', $event.target.value)" /></label>
      <label>表头文字色<input type="color" :value="style.headerTextColor" @input="updateStyleField('headerTextColor', $event.target.value)" /></label>
      <label>边框颜色<input type="color" :value="style.borderColor" @input="updateStyleField('borderColor', $event.target.value)" /></label>
      <label>边框宽度<input type="number" :value="style.borderWidth" min="0" max="5" @input="updateStyleField('borderWidth', Number($event.target.value))" /></label>
      <label>字号<input type="number" :value="style.fontSize" min="10" max="24" @input="updateStyleField('fontSize', Number($event.target.value))" /></label>
      <label class="checkbox-label"><input type="checkbox" :checked="style.stripedRows" @change="updateStyleField('stripedRows', $event.target.checked)" />斑马纹</label>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th v-for="col in draftColumns" :key="col.id" :style="headerCellStyle(col)" @dblclick="startEditHeader(col.id)">
              <span v-if="editingHeader !== col.id">{{ col.title }}</span>
              <span v-else contenteditable="true" class="editing-cell" @blur="finishEditHeader(col.id, $event)" @keydown.enter.prevent="$event.target.blur()">{{ col.title }}</span>
            </th>
            <th class="action-col" :style="{ border: `${style.borderWidth}px solid ${style.borderColor}`, padding: '8px' }">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIdx) in draftRows" :key="row.id">
            <td v-for="cell in row.cells" :key="cell.columnId" :style="bodyCellStyle(cell, draftColumns.find(c => c.id === cell.columnId), rowIdx)" @dblclick="startEditCell(row.id, cell.columnId)">
              <span v-if="editingCell?.rowId !== row.id || editingCell?.colId !== cell.columnId">{{ cell.value || '—' }}</span>
              <span v-else contenteditable="true" class="editing-cell" @blur="finishEditCell(row.id, cell.columnId, $event)" @keydown.enter.prevent="$event.target.blur()">{{ cell.value }}</span>
            </td>
            <td class="action-col" :style="{ border: `${style.borderWidth}px solid ${style.borderColor}`, padding: '8px', textAlign: 'center' }"><button class="btn btn-sm btn-danger" @click="removeRow(row.id)">删除</button></td>
          </tr>
          <tr v-if="!draftRows.length"><td :colspan="draftColumns.length + 1" style="text-align:center;padding:24px;color:#94a3b8">暂无数据，点击"添加行"开始编辑</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-block { padding: 16px; }
.block-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.dirty-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.dirty-hint { font-size: 12px; color: var(--c-warning); font-weight: 500; }
.style-panel { display:flex; flex-wrap:wrap; gap:16px; padding:12px; margin-bottom:12px; background:#f8fafc; border-radius:var(--radius); border:1px solid var(--c-border); }
.style-panel label { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--c-text-secondary); }
.style-panel input[type='color'] { width:32px; height:28px; border:1px solid var(--c-border); border-radius:4px; padding:0; cursor:pointer; }
.style-panel input[type='number'] { width:60px; padding:4px 6px; border:1px solid var(--c-border); border-radius:4px; font-size:13px; }
.checkbox-label { cursor: pointer; }
.table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
.action-col { width: 60px; background: #f8fafc; }
.editing-cell { display:block; outline:2px solid var(--c-primary); border-radius:2px; padding:2px 4px; min-width:40px; }
</style>

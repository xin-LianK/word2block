<script setup>
import { computed, ref } from 'vue'
import { useDocumentStore } from '@/stores/document'

const props = defineProps({
  templateId: { type: String, required: true },
})

const store = useDocumentStore()
const expandedId = ref(null)

const versions = computed(() => [...store.getTemplateVersions(props.templateId)].reverse())

function toggle(verId) {
  expandedId.value = expandedId.value === verId ? null : verId
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('zh-CN')
}

function formatValue(val) {
  if (val === null || val === undefined) return '(空)'
  const text = typeof val === 'string' ? val : JSON.stringify(val, null, 2)
  return text.length > 800 ? text.slice(0, 800) + '...' : text
}

function diffSummary(changes) {
  return changes?.length ? `${changes.length} 处修改` : '无变更详情'
}

function summaryCount(items = []) {
  return items?.length || 0
}
</script>

<template>
  <div class="version-history">
    <h4>模板导入快照</h4>
    <div v-if="!versions.length" class="empty">暂无模板版本快照</div>
    <div v-else class="timeline">
      <div v-for="ver in versions" :key="ver.id" class="timeline-item" :class="{ expanded: expandedId === ver.id }">
        <div class="timeline-dot" />
        <div class="timeline-content">
          <div class="timeline-header" @click="toggle(ver.id)">
            <span class="badge badge-blue">DOCX 导入</span>
            <span class="ver-num">v{{ ver.version }}</span>
            <span class="ver-time">{{ formatTime(ver.timestamp) }}</span>
            <span class="ver-by">{{ ver.editedBy }}</span>
            <span class="ver-summary">{{ diffSummary(ver.changes) }}</span>
            <span class="ver-toggle">{{ expandedId === ver.id ? '▲' : '▼' }}</span>
          </div>

          <div v-if="expandedId === ver.id" class="ver-detail">
            <div class="summary-grid">
              <div class="summary-card add">新增块 {{ summaryCount(ver.blockSummary?.added) }}</div>
              <div class="summary-card remove">删除块 {{ summaryCount(ver.blockSummary?.removed) }}</div>
              <div class="summary-card edit">标题变更 {{ summaryCount(ver.blockSummary?.relabeled) }}</div>
              <div class="summary-card type">类型变更 {{ summaryCount(ver.blockSummary?.typeChanged) }}</div>
            </div>

            <div v-if="ver.blockSummary?.added?.length" class="summary-section">
              <h5>新增块</h5>
              <ul>
                <li v-for="item in ver.blockSummary.added" :key="`add-${item.index}-${item.label}`">#{{ item.index }} {{ item.label }}（{{ item.type }}）</li>
              </ul>
            </div>

            <div v-if="ver.blockSummary?.removed?.length" class="summary-section">
              <h5>删除块</h5>
              <ul>
                <li v-for="item in ver.blockSummary.removed" :key="`remove-${item.index}-${item.label}`">#{{ item.index }} {{ item.label }}（{{ item.type }}）</li>
              </ul>
            </div>

            <div v-if="ver.blockSummary?.relabeled?.length" class="summary-section">
              <h5>标题变更</h5>
              <ul>
                <li v-for="item in ver.blockSummary.relabeled" :key="`label-${item.index}-${item.before}`">#{{ item.index }} {{ item.before }} → {{ item.after }}</li>
              </ul>
            </div>

            <div v-if="ver.blockSummary?.typeChanged?.length" class="summary-section">
              <h5>类型变更</h5>
              <ul>
                <li v-for="item in ver.blockSummary.typeChanged" :key="`type-${item.index}-${item.before}`">#{{ item.index }} {{ item.before }} → {{ item.after }}</li>
              </ul>
            </div>

            <div v-for="(change, ci) in ver.changes" :key="ci" class="change-item">
              <div class="change-field">字段: <code>{{ change.field }}</code></div>
              <div class="diff-container">
                <div class="diff-col diff-old">
                  <div class="diff-label">导入前</div>
                  <pre class="diff-text">{{ formatValue(change.oldValue) }}</pre>
                </div>
                <div class="diff-arrow">→</div>
                <div class="diff-col diff-new">
                  <div class="diff-label">导入后</div>
                  <pre class="diff-text">{{ formatValue(change.newValue) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.version-history { padding: 12px 16px; border-top: 1px solid #e2e8f0; background: #fafafa; margin-top: 16px; }
h4 { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #475569; }
.empty { font-size: 13px; color: #94a3b8; padding: 8px 0; }
.timeline { display: flex; flex-direction: column; gap: 0; position: relative; padding-left: 20px; }
.timeline::before { content: ''; position: absolute; left: 6px; top: 0; bottom: 0; width: 2px; background: #e2e8f0; }
.timeline-item { position: relative; padding-bottom: 12px; }
.timeline-dot { position: absolute; left: -17px; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; border: 2px solid white; box-shadow: 0 0 0 1px #cbd5e1; }
.timeline-item.expanded .timeline-dot { background: #3b82f6; }
.timeline-content { background: white; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
.timeline-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; user-select: none; flex-wrap: wrap; }
.timeline-header:hover { background: #f8fafc; }
.ver-num { font-weight: 600; font-size: 12px; color: #3b82f6; }
.ver-time, .ver-by, .ver-summary, .ver-toggle { font-size: 12px; color: #64748b; }
.ver-summary { flex: 1; color: #94a3b8; }
.ver-detail { padding: 12px; border-top: 1px solid #f1f5f9; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:12px; }
.summary-card { border-radius:6px; padding:8px 10px; font-size:12px; font-weight:600; }
.summary-card.add { background:#ecfdf5; color:#15803d; border:1px solid #bbf7d0; }
.summary-card.remove { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
.summary-card.edit { background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }
.summary-card.type { background:#faf5ff; color:#7c3aed; border:1px solid #ddd6fe; }
.summary-section { margin-bottom:12px; }
.summary-section h5 { font-size:12px; color:#475569; margin:0 0 6px; }
.summary-section ul { margin:0; padding-left:18px; font-size:12px; color:#64748b; }
.change-item { margin-bottom: 12px; }
.change-field { font-size: 12px; color: #64748b; margin-bottom: 6px; }
.change-field code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
.diff-container { display: flex; gap: 8px; align-items: flex-start; }
.diff-col { flex: 1; min-width: 0; border-radius: 6px; padding: 10px; overflow: auto; }
.diff-old { background: #fef2f2; border: 1px solid #fecaca; }
.diff-new { background: #f0fdf4; border: 1px solid #bbf7d0; }
.diff-label { font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; }
.diff-old .diff-label { color: #b91c1c; }
.diff-new .diff-label { color: #15803d; }
.diff-arrow { flex-shrink: 0; color: #94a3b8; font-size: 16px; padding-top: 24px; }
.diff-text { font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; margin: 0; font-family: Consolas, monospace; }

@media (max-width: 900px) {
  .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
</style>

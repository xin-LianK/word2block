<script setup>
import { ref, onMounted } from 'vue'
import { useDocumentStore } from '@/stores/document'

const props = defineProps({
  blockId: { type: String, required: true },
})

const store = useDocumentStore()
const loaded = ref(false)
const expandedId = ref(null)

onMounted(async () => {
  await store.loadVersions(props.blockId)
  loaded.value = true
})

const changeTypeLabels = {
  create: '创建',
  manual_edit: '手动编辑',
  data_refresh: '数据刷新',
  ai_regenerate: 'AI 重新生成',
}

const changeTypeBadge = {
  create: 'badge-green',
  manual_edit: 'badge-blue',
  data_refresh: 'badge-orange',
  ai_regenerate: 'badge-orange',
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('zh-CN')
}

function toggle(verId) {
  expandedId.value = expandedId.value === verId ? null : verId
}

function formatValue(val) {
  if (val === null || val === undefined) return '(空)'
  if (typeof val === 'string') {
    if (val.length > 300) return val.slice(0, 300) + '...'
    return val
  }
  const json = JSON.stringify(val, null, 2)
  if (json.length > 500) return json.slice(0, 500) + '...'
  return json
}

function isHtml(val) {
  return typeof val === 'string' && /<[a-z][\s\S]*>/i.test(val)
}

function diffSummary(changes) {
  if (!changes.length) return '初始创建，无变更明细'
  return `${changes.length} 处修改`
}
</script>

<template>
  <div class="version-history">
    <h4>版本历史</h4>

    <div v-if="store.isVersionsLoading(blockId)" class="loading">加载中...</div>
    <div v-else-if="!store.getVersions(blockId).length" class="empty">暂无版本记录</div>
    <div v-else class="timeline">
      <div
        v-for="ver in [...store.getVersions(blockId)].reverse()"
        :key="ver.id"
        class="timeline-item"
        :class="{ expanded: expandedId === ver.id }"
      >
        <div class="timeline-dot" />
        <div class="timeline-content">
          <div class="timeline-header" @click="toggle(ver.id)">
            <span class="badge" :class="changeTypeBadge[ver.changeType] || 'badge-blue'">
              {{ changeTypeLabels[ver.changeType] || ver.changeType }}
            </span>
            <span class="ver-num">v{{ ver.version }}</span>
            <span class="ver-time">{{ formatTime(ver.timestamp) }}</span>
            <span class="ver-by">{{ ver.editedBy }}</span>
            <span class="ver-summary">{{ diffSummary(ver.changes) }}</span>
            <span class="ver-toggle">{{ expandedId === ver.id ? '▲' : '▼' }}</span>
          </div>

          <div v-if="expandedId === ver.id" class="ver-detail">
            <div v-if="!ver.changes.length" class="no-changes">无变更详情</div>
            <div v-else>
              <div v-for="(change, ci) in ver.changes" :key="ci" class="change-item">
                <div class="change-field">字段: <code>{{ change.field }}</code></div>
                <div class="diff-container">
                  <div class="diff-col diff-old">
                    <div class="diff-label">修改前</div>
                    <div v-if="isHtml(change.oldValue)" class="diff-html-preview">
                      <div class="diff-rendered" v-html="change.oldValue" />
                      <details>
                        <summary>查看 HTML 源码</summary>
                        <pre>{{ formatValue(change.oldValue) }}</pre>
                      </details>
                    </div>
                    <pre v-else class="diff-text">{{ formatValue(change.oldValue) }}</pre>
                  </div>
                  <div class="diff-arrow">→</div>
                  <div class="diff-col diff-new">
                    <div class="diff-label">修改后</div>
                    <div v-if="isHtml(change.newValue)" class="diff-html-preview">
                      <div class="diff-rendered" v-html="change.newValue" />
                      <details>
                        <summary>查看 HTML 源码</summary>
                        <pre>{{ formatValue(change.newValue) }}</pre>
                      </details>
                    </div>
                    <pre v-else class="diff-text">{{ formatValue(change.newValue) }}</pre>
                  </div>
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
.version-history {
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
  background: #fafafa;
}
h4 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}
.loading, .empty {
  font-size: 13px;
  color: #94a3b8;
  padding: 8px 0;
}
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding-left: 20px;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e2e8f0;
}
.timeline-item {
  position: relative;
  padding-bottom: 12px;
}
.timeline-dot {
  position: absolute;
  left: -17px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
  border: 2px solid white;
  box-shadow: 0 0 0 1px #cbd5e1;
}
.timeline-item.expanded .timeline-dot {
  background: #3b82f6;
}
.timeline-content {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}
.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  flex-wrap: wrap;
}
.timeline-header:hover {
  background: #f8fafc;
}
.ver-num {
  font-weight: 600;
  font-size: 12px;
  color: #3b82f6;
}
.ver-time {
  font-size: 12px;
  color: #64748b;
}
.ver-by {
  font-size: 12px;
  color: #475569;
}
.ver-summary {
  font-size: 12px;
  color: #94a3b8;
  flex: 1;
}
.ver-toggle {
  font-size: 11px;
  color: #94a3b8;
}
.ver-detail {
  padding: 12px;
  border-top: 1px solid #f1f5f9;
}
.no-changes {
  font-size: 13px;
  color: #94a3b8;
}
.change-item {
  margin-bottom: 12px;
}
.change-field {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}
.change-field code {
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}
.diff-container {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.diff-col {
  flex: 1;
  min-width: 0;
  border-radius: 6px;
  padding: 10px;
  overflow: auto;
}
.diff-old {
  background: #fef2f2;
  border: 1px solid #fecaca;
}
.diff-new {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}
.diff-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.diff-old .diff-label { color: #b91c1c; }
.diff-new .diff-label { color: #15803d; }
.diff-arrow {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 16px;
  padding-top: 24px;
}
.diff-text {
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: Consolas, monospace;
}
.diff-html-preview .diff-rendered {
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 6px;
}
.diff-html-preview .diff-rendered :deep(h2) { font-size: 16px; margin-bottom: 4px; }
.diff-html-preview .diff-rendered :deep(h3) { font-size: 14px; margin-bottom: 4px; }
.diff-html-preview .diff-rendered :deep(p) { margin-bottom: 4px; }
.diff-html-preview details { margin-top: 4px; }
.diff-html-preview summary { font-size: 11px; color: #64748b; cursor: pointer; }
.diff-html-preview pre { font-size: 11px; line-height: 1.4; white-space: pre-wrap; word-break: break-all; margin: 4px 0 0; font-family: Consolas, monospace; }
</style>

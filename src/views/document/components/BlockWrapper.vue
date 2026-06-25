<script setup>
import { ref } from 'vue'
import VersionHistory from './VersionHistory.vue'

defineProps({ block: { type: Object, required: true }, index: { type: Number, required: true }, total: { type: Number, required: true } })
defineEmits(['move-up', 'move-down', 'delete', 'refresh-data'])

const showVersions = ref(false)
const showMeta = ref(false)

function formatTime(iso) { return new Date(iso).toLocaleString('zh-CN') }
</script>

<template>
  <div class="block-wrapper card">
    <div class="block-header">
      <span class="block-order">#{{ index + 1 }}</span>
      <span class="block-time">创建: {{ formatTime(block.createdAt) }}</span>
      <span v-if="block.updatedAt !== block.createdAt" class="block-time">更新: {{ formatTime(block.updatedAt) }}</span>
      <div class="block-actions">
        <button class="btn btn-sm btn-outline" title="数据来源" @click="showMeta = !showMeta">来源</button>
        <button class="btn btn-sm btn-outline" @click="showVersions = !showVersions">版本 ({{ block.versionCount }})</button>
        <button class="btn btn-sm btn-outline" :disabled="index === 0" @click="$emit('move-up')">↑</button>
        <button class="btn btn-sm btn-outline" :disabled="index === total - 1" @click="$emit('move-down')">↓</button>
        <button class="btn btn-sm btn-danger" @click="$emit('delete')">删除</button>
      </div>
    </div>

    <div v-if="showMeta" class="meta-panel">
      <div class="meta-row">
        <div class="meta-info">
          <div><strong>来源模式:</strong> {{ block.dataSource.mode === 'file' ? 'CSV 文件' : 'API 接口' }}</div>
          <div v-if="block.dataSource.mode === 'file'"><strong>文件名:</strong> {{ block.dataSource.fileName || '未发布' }}</div>
          <div v-if="block.dataSource.mode === 'file'"><strong>批次ID:</strong> {{ block.dataSource.fileBatchId || '未发布' }}</div>
          <div><strong>接口:</strong> {{ block.dataSource.apiEndpoint || '无' }}</div>
          <div v-if="block.dataSource.sql" class="meta-sql"><strong>SQL:</strong><code>{{ block.dataSource.sql }}</code></div>
          <div><strong>参数:</strong> {{ JSON.stringify(block.dataSource.params) }}</div>
          <div><strong>获取时间:</strong> {{ formatTime(block.dataSource.fetchedAt) }}</div>
          <div v-if="block.dataSource.responseHash"><strong>响应哈希:</strong> {{ block.dataSource.responseHash }}</div>
        </div>
        <button v-if="block.dataSource.mode !== 'file' && block.dataSource.apiEndpoint" class="btn btn-sm btn-primary meta-refresh-btn" @click="$emit('refresh-data')">调用数据刷新</button>
      </div>
    </div>

    <slot />
    <VersionHistory v-if="showVersions" :block-id="block.id" />
  </div>
</template>

<style scoped>
.block-wrapper { margin-bottom:16px; overflow:hidden; }
.block-header { display:flex; align-items:center; gap:12px; padding:10px 16px; background:#f8fafc; border-bottom:1px solid var(--c-border); flex-wrap:wrap; }
.block-order { font-weight:700; font-size:13px; color:var(--c-primary); }
.block-time { font-size:12px; color:var(--c-text-secondary); }
.block-actions { display:flex; gap:4px; margin-left:auto; }
.meta-panel { padding:10px 16px; background:#f0f9ff; border-bottom:1px solid #bae6fd; font-size:13px; }
.meta-row { display:flex; align-items:flex-start; gap:12px; }
.meta-info { flex:1; display:flex; flex-direction:column; gap:4px; }
.meta-sql code { display:block; margin-top:3px; padding:6px 8px; background:#fff; border:1px solid #bae6fd; border-radius:4px; white-space:pre-wrap; word-break:break-word; font-family:Consolas, Monaco, monospace; }
.meta-refresh-btn { white-space:nowrap; flex-shrink:0; align-self:center; }
</style>

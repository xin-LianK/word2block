<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  draft: { type: Object, default: null },
  mode: { type: String, default: 'create' },
  reportContext: {
    type: Object,
    default: () => ({}),
  },
  regressionHistory: {
    type: Array,
    default: () => [],
  },
  candidateOptions: {
    type: Object,
    default: () => ({
      cover: true,
      toc: true,
      footer: true,
      'header-footer': true,
      'short-noise': true,
    }),
  },
})

const emit = defineEmits(['close', 'confirm', 'update:block-label', 'move-block', 'remove-block', 'merge-block', 'cleanup-blocks', 'remove-candidates', 'update:candidate-options', 'export-report'])

const visibleBlocks = computed(() => props.draft?.blockDefinitions || [])
const historyRecords = computed(() => [...(props.regressionHistory || [])].slice().reverse().slice(0, 8))

const reasonLabelMap = {
  cover: '封面候选',
  toc: '目录候选',
  footer: '页脚候选',
  'header-footer': '页眉页脚候选',
  empty: '空块',
  'short-noise': '短噪音候选',
}

function getReasonLabels(block) {
  return (block.importHints?.candidateReasons || []).map((key) => reasonLabelMap[key] || key)
}

function updateCandidateOption(key, checked) {
  emit('update:candidate-options', { ...props.candidateOptions, [key]: checked })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && draft" class="modal-overlay" @click.self="emit('close')">
      <div class="modal card docx-preview-dialog">
        <h3>DOCX 导入预览</h3>

        <div class="preview-summary">
          <div><strong>模板名：</strong>{{ draft.name }}</div>
          <div><strong>块数：</strong>{{ draft.meta.blockCount }}</div>
          <div v-if="draft.meta.rawBlockCount"><strong>优化前块数：</strong>{{ draft.meta.rawBlockCount }}</div>
          <div v-if="draft.meta.rawBlockCount"><strong>减少比例：</strong>{{ Math.round(((draft.meta.rawBlockCount - draft.meta.blockCount) / draft.meta.rawBlockCount) * 100) }}%</div>
          <div><strong>表格块：</strong>{{ draft.meta.tableCount }}</div>
          <div><strong>图片块：</strong>{{ draft.meta.imageCount }}</div>
          <div><strong>告警：</strong>{{ draft.meta.warningCount }}</div>
        </div>

        <div v-if="historyRecords.length" class="regression-panel card-lite">
          <h4>回归结果趋势（最近 {{ historyRecords.length }} 次）</h4>
          <div class="regression-list">
            <div v-for="(item, idx) in historyRecords" :key="`${item.at}-${idx}`" class="regression-item">
              <span class="regression-time">{{ new Date(item.at).toLocaleString('zh-CN') }}</span>
              <span>前 {{ item.rawBlockCount || item.blockCount }}</span>
              <span>后 {{ item.blockCount }}</span>
              <span>减少 {{ item.reducedBlockCount || 0 }}</span>
              <span>比例 {{ item.rawBlockCount ? Math.round(((item.rawBlockCount - item.blockCount) / item.rawBlockCount) * 100) : 0 }}%</span>
              <span>告警 {{ item.warningCount || 0 }}</span>
            </div>
          </div>
        </div>

        <div class="preview-toolbar">
          <button class="btn btn-sm btn-outline" @click="emit('export-report')">导出处理报告</button>
          <button class="btn btn-sm btn-outline" @click="emit('remove-candidates')">一键删除候选块</button>
          <button class="btn btn-sm btn-outline" @click="emit('cleanup-blocks')">一键清理空块/短块</button>
        </div>

        <div class="candidate-options card-lite">
          <label class="candidate-option"><input :checked="candidateOptions.cover" type="checkbox" @change="updateCandidateOption('cover', $event.target.checked)" />封面</label>
          <label class="candidate-option"><input :checked="candidateOptions.toc" type="checkbox" @change="updateCandidateOption('toc', $event.target.checked)" />目录</label>
          <label class="candidate-option"><input :checked="candidateOptions.footer" type="checkbox" @change="updateCandidateOption('footer', $event.target.checked)" />页脚</label>
          <label class="candidate-option"><input :checked="candidateOptions['header-footer']" type="checkbox" @change="updateCandidateOption('header-footer', $event.target.checked)" />页眉页脚</label>
          <label class="candidate-option"><input :checked="candidateOptions['short-noise']" type="checkbox" @change="updateCandidateOption('short-noise', $event.target.checked)" />短噪音</label>
        </div>

        <div class="preview-list card-lite">
          <div v-for="(block, idx) in visibleBlocks" :key="block.id" class="preview-item">
            <span class="preview-item-index">{{ idx + 1 }}</span>
            <input
              class="preview-item-input"
              :value="block.label"
              @input="emit('update:block-label', { index: idx, value: $event.target.value })"
            />
            <span v-if="block.importHints?.removableCandidate" class="preview-item-candidate">建议删除</span>
            <span
              v-for="reason in getReasonLabels(block)"
              :key="reason"
              class="preview-item-reason"
            >
              {{ reason }}
            </span>
            <span class="preview-item-type">{{ block.type }}</span>
            <div class="preview-item-actions">
              <button class="btn btn-xs btn-outline" :disabled="block.type !== 'rich_text' || visibleBlocks[idx + 1]?.type !== 'rich_text'" @click="emit('merge-block', idx)">合并下一个</button>
              <button class="btn btn-xs btn-outline" :disabled="idx === 0" @click="emit('move-block', { index: idx, direction: -1 })">上移</button>
              <button class="btn btn-xs btn-outline" :disabled="idx === visibleBlocks.length - 1" @click="emit('move-block', { index: idx, direction: 1 })">下移</button>
              <button class="btn btn-xs btn-danger" @click="emit('remove-block', idx)">删除</button>
            </div>
          </div>
        </div>

        <div v-if="draft.meta.warnings?.length" class="preview-warnings">
          <h4>导入提示</h4>
          <ul>
            <li v-for="(warning, index) in draft.meta.warnings.slice(0, 6)" :key="index">{{ warning }}</li>
          </ul>
        </div>

        <div class="modal-actions">
          <button class="btn btn-outline" @click="emit('close')">取消</button>
          <button class="btn btn-primary" @click="emit('confirm')">
            {{ mode === 'replace' ? '确认覆盖当前模板' : '确认生成新模板' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.docx-preview-dialog { width:min(760px, 92vw); max-height:86vh; overflow:auto; }
.preview-summary { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px 16px; margin-bottom:12px; font-size:14px; }
.preview-toolbar { display:flex; justify-content:flex-end; margin-bottom:10px; }
.card-lite { border:1px solid var(--c-border); border-radius:8px; background:#f8fafc; }
.candidate-options { display:flex; flex-wrap:wrap; gap:12px; padding:10px; margin-bottom:12px; font-size:13px; }
.candidate-option { display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
.regression-panel { padding:10px; margin-bottom:12px; }
.regression-panel h4 { font-size:13px; margin:0 0 8px; color:var(--c-text-secondary); }
.regression-list { display:flex; flex-direction:column; gap:6px; }
.regression-item { display:flex; flex-wrap:wrap; gap:10px; font-size:12px; color:var(--c-text-secondary); background:#fff; border:1px solid var(--c-border); border-radius:6px; padding:6px 8px; }
.regression-time { color:var(--c-text-primary); font-weight:500; }
.preview-list { padding:10px; display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
.preview-item { display:flex; align-items:center; gap:10px; background:#fff; border:1px solid var(--c-border); border-radius:6px; padding:8px 10px; }
.preview-item-index { width:22px; color:var(--c-text-secondary); font-size:12px; text-align:center; }
.preview-item-input { flex:1; min-width:0; font-size:14px; border:1px solid var(--c-border); border-radius:6px; padding:6px 8px; }
.preview-item-input:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 1px #2563eb inset; }
.preview-item-candidate { font-size:12px; color:#92400e; background:#fef3c7; border:1px solid #fde68a; border-radius:999px; padding:2px 8px; }
.preview-item-reason { font-size:12px; color:#7c3aed; background:#f3e8ff; border:1px solid #ddd6fe; border-radius:999px; padding:2px 8px; }
.preview-item-type { font-size:12px; color:#0369a1; background:#e0f2fe; border:1px solid #bae6fd; border-radius:999px; padding:2px 8px; }
.preview-item-actions { display:flex; gap:6px; }
.preview-more { text-align:center; color:var(--c-text-secondary); font-size:12px; padding-top:4px; }
.preview-warnings { margin-bottom:12px; }
.preview-warnings h4 { font-size:14px; margin-bottom:6px; }
.preview-warnings ul { margin:0; padding-left:18px; color:var(--c-text-secondary); font-size:13px; }

:deep(.btn-xs) { padding:4px 8px; font-size:12px; }

@media (max-width: 640px) {
  .preview-summary { grid-template-columns:1fr; }
  .preview-item { flex-wrap:wrap; }
  .preview-item-actions { width:100%; justify-content:flex-end; }
}
</style>

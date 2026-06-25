<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '目录' },
  items: {
    type: Array,
    default: () => [],
  },
  keyword: { type: String, default: '' },
  activeId: { type: String, default: '' },
  searchPlaceholder: { type: String, default: '搜索标题...' },
  ariaLabel: { type: String, default: '目录' },
  emptyText: { type: String, default: '未找到匹配项' },
})

const emit = defineEmits(['update:keyword', 'jump'])

const filteredItems = computed(() => {
  const keyword = props.keyword.trim().toLowerCase()
  if (!keyword) return props.items
  return props.items.filter((item) => String(item.label || '').toLowerCase().includes(keyword))
})

function onInput(event) {
  emit('update:keyword', event.target.value)
}
</script>

<template>
  <aside class="toc-panel card" :aria-label="ariaLabel">
    <div class="toc-panel-head">
      <h4>{{ title }}</h4>
      <span>{{ filteredItems.length }} / {{ items.length }}</span>
    </div>

    <input
      class="toc-panel-search"
      type="text"
      :value="keyword"
      :placeholder="searchPlaceholder"
      :aria-label="searchPlaceholder"
      @input="onInput"
    />

    <div class="toc-panel-list">
      <button
        v-for="item in filteredItems"
        :key="item.id"
        class="toc-panel-item"
        :class="{ active: activeId === item.id }"
        :aria-current="activeId === item.id ? 'location' : undefined"
        @click="emit('jump', item.id)"
      >
        <span class="toc-panel-item-text">{{ item.label }}</span>
        <span v-if="item.badge" class="toc-panel-item-badge" :class="item.badgeClass">{{ item.badge }}</span>
      </button>

      <div v-if="!filteredItems.length" class="toc-panel-empty">{{ emptyText }}</div>
    </div>
  </aside>
</template>

<style scoped>
.toc-panel { position:fixed; top:96px; right:24px; width:280px; z-index:20; padding:12px; max-height:calc(100vh - 116px); display:flex; flex-direction:column; }
.toc-panel-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; color:var(--c-text-secondary); font-size:12px; }
.toc-panel-head h4 { margin:0; font-size:14px; color:var(--c-text-primary); }
.toc-panel-search { width:100%; margin-bottom:8px; border:1px solid var(--c-border); border-radius:6px; padding:7px 10px; font-size:13px; }
.toc-panel-search:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 1px #2563eb inset; }
.toc-panel-list { display:flex; flex-direction:column; gap:6px; overflow:auto; padding-right:2px; }
.toc-panel-item { border:1px solid var(--c-border); border-radius:6px; background:#fff; color:var(--c-text-primary); text-align:left; padding:8px 10px; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:8px; }
.toc-panel-item:hover { border-color:#94a3b8; }
.toc-panel-item.active { border-color:#2563eb; color:#1e40af; background:#eff6ff; }
.toc-panel-item-text { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.toc-panel-item-badge { font-size:11px; color:#059669; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:999px; padding:1px 6px; }
.toc-panel-item-badge.info { color:#0369a1; background:#e0f2fe; border-color:#bae6fd; }
.toc-panel-empty { color:var(--c-text-secondary); font-size:12px; text-align:center; padding:10px 0; }

@media (max-width: 960px) {
  .toc-panel { position:static; width:auto; max-height:260px; margin-bottom:12px; }
}
</style>

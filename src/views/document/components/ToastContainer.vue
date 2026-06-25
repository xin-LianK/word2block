<script setup>
import { useToast } from '@/composables/useToast'
const { toasts } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast-item" :class="`toast-${t.type}`">
          <span class="toast-icon">
            <template v-if="t.type === 'success'">✓</template>
            <template v-else-if="t.type === 'error'">✗</template>
            <template v-else-if="t.type === 'warning'">⚠</template>
            <template v-else>ℹ</template>
          </span>
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container { position:fixed; top:68px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
.toast-item { display:flex; align-items:center; gap:8px; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:500; box-shadow:0 4px 12px rgba(0,0,0,.12); pointer-events:auto; min-width:200px; }
.toast-success { background:#f0fdf4; color:#166534; border:1px solid #86efac; }
.toast-error { background:#fef2f2; color:#991b1b; border:1px solid #fca5a5; }
.toast-warning { background:#fffbeb; color:#92400e; border:1px solid #fcd34d; }
.toast-info { background:#f0f9ff; color:#1e40af; border:1px solid #93c5fd; }
.toast-icon { font-size:16px; line-height:1; }
.toast-enter-active { transition:all .3s ease; }
.toast-leave-active { transition:all .2s ease; }
.toast-enter-from,.toast-leave-to { opacity:0; transform:translateX(40px); }
</style>

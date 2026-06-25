<script setup>
import { onActivated, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDocumentStore } from '@/stores/document'
import DocumentEditor from '@/views/document/components/DocumentEditor.vue'

const route = useRoute()
const router = useRouter()
const store = useDocumentStore()

async function loadDoc() {
  const id = route.params.id
  if (id) {
    await store.openDocument(id)
    if (!store.currentOutline) {
      router.replace({ name: 'DocumentList' })
    }
  }
}

onMounted(loadDoc)
onActivated(loadDoc)
watch(() => route.params.id, loadDoc)

function goBack() {
  store.closeDocument()
  router.push({ name: 'DocumentList' })
}
</script>

<template>
  <div class="edit-page">
    <div class="edit-page-nav">
      <button class="btn btn-outline" @click="goBack">← 返回列表</button>
    </div>
    <DocumentEditor />
  </div>
</template>

<style scoped>
.edit-page { padding: 20px 24px 24px; }
.edit-page-nav { margin-bottom: 16px; }
</style>

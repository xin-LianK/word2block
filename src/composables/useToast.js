import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function useToast() {
  function show(message, type = 'info', duration = 2500) {
    const id = nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }

  function success(message) { show(message, 'success') }
  function error(message) { show(message, 'error', 4000) }
  function warning(message) { show(message, 'warning', 3500) }
  function info(message) { show(message, 'info') }

  return { toasts, show, success, error, warning, info }
}

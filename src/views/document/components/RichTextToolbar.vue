<script setup>
import { ref, computed } from 'vue'
import mammoth from 'mammoth'

const props = defineProps({ editorEl: { type: Object, default: undefined } })
const emit = defineEmits(['import-html'])

const showColorPicker = ref(false)
const showBgColorPicker = ref(false)
const showLinkInput = ref(false)
const linkUrl = ref('')

const activePanel = ref(null)
const wordResultHtml = ref('')

const imageMode = ref('url')
const imageUrl = ref('')
const imageWidth = ref('')
const imageAlt = ref('')

const videoMode = ref('url')
const videoUrl = ref('')
const videoWidth = ref('100%')

const htmlSource = ref('')
const wordImporting = ref(false)

const imageFileRef = ref()
const videoFileRef = ref()
const wordFileRef = ref()

const presetColors = ['#000000','#434343','#666666','#999999','#cccccc','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#0ea5e9','#6366f1']

function exec(command, value) { props.editorEl?.focus(); document.execCommand(command, false, value) }
function toggleHeading(tag) { props.editorEl?.focus(); document.execCommand('formatBlock', false, tag) }
function setColor(color) { exec('foreColor', color); showColorPicker.value = false }
function setBgColor(color) { exec('hiliteColor', color); showBgColorPicker.value = false }
function insertLink() { if (!linkUrl.value) return; exec('createLink', linkUrl.value); linkUrl.value = ''; showLinkInput.value = false }
function removeLink() { exec('unlink'); showLinkInput.value = false }
function clearFormat() { exec('removeFormat') }

const fontSizes = [12,13,14,15,16,18,20,22,24,28,32,36,48]
const lineHeights = [1.0,1.2,1.4,1.5,1.6,1.8,2.0,2.5,3.0]
const showFontSize = ref(false)
const showLineHeight = ref(false)

function setFontSize(size) {
  if (!props.editorEl) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) { showFontSize.value = false; return }
  const span = document.createElement('span')
  span.style.fontSize = `${size}px`
  range.surroundContents(span)
  showFontSize.value = false
}

function setLineHeight(lh) {
  if (!props.editorEl) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) { props.editorEl.style.lineHeight = String(lh); showLineHeight.value = false; return }
  const range = sel.getRangeAt(0)
  let block = range.startContainer
  if (block.nodeType === Node.TEXT_NODE) block = block.parentElement
  while (block && block !== props.editorEl) {
    const display = window.getComputedStyle(block).display
    if (display === 'block' || display === 'list-item') break
    block = block.parentElement
  }
  if (block && block !== props.editorEl) block.style.lineHeight = String(lh)
  else props.editorEl.style.lineHeight = String(lh)
  showLineHeight.value = false
}

function togglePanel(panel) {
  showLinkInput.value = false
  showColorPicker.value = false
  showBgColorPicker.value = false
  showFontSize.value = false
  showLineHeight.value = false
  activePanel.value = activePanel.value === panel ? null : panel
}

function insertHtmlAtCursor(html) { props.editorEl?.focus(); document.execCommand('insertHTML', false, html) }

function insertImageByUrl() {
  if (!imageUrl.value) return
  const w = imageWidth.value ? ` style="max-width:${imageWidth.value};height:auto"` : ' style="max-width:100%;height:auto"'
  const alt = imageAlt.value ? ` alt="${imageAlt.value}"` : ''
  insertHtmlAtCursor(`<img src="${imageUrl.value}"${alt}${w} />`)
  imageUrl.value = ''; imageAlt.value = ''; imageWidth.value = ''; activePanel.value = null
}

function onImageFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result
    const w = imageWidth.value ? ` style="max-width:${imageWidth.value};height:auto"` : ' style="max-width:100%;height:auto"'
    const alt = imageAlt.value ? ` alt="${imageAlt.value}"` : ` alt="${file.name}"`
    insertHtmlAtCursor(`<img src="${dataUrl}"${alt}${w} />`)
    imageWidth.value = ''; imageAlt.value = ''; activePanel.value = null
  }
  reader.readAsDataURL(file)
  if (imageFileRef.value) imageFileRef.value.value = ''
}

function insertVideoByUrl() {
  if (!videoUrl.value) return
  const w = videoWidth.value || '100%'
  if (isEmbedUrl(videoUrl.value)) {
    const src = toEmbedSrc(videoUrl.value)
    insertHtmlAtCursor(`<div class="video-wrap"><iframe src="${src}" style="width:${w};aspect-ratio:16/9;border:none" allowfullscreen></iframe></div>`)
  } else {
    insertHtmlAtCursor(`<div class="video-wrap"><video src="${videoUrl.value}" controls style="width:${w};max-width:100%"></video></div>`)
  }
  videoUrl.value = ''; videoWidth.value = '100%'; activePanel.value = null
}

function onVideoFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  const w = videoWidth.value || '100%'
  insertHtmlAtCursor(`<div class="video-wrap"><video src="${url}" controls style="width:${w};max-width:100%"></video></div>`)
  videoWidth.value = '100%'; activePanel.value = null
  if (videoFileRef.value) videoFileRef.value.value = ''
}

function isEmbedUrl(url) { return /youtu\.?be|bilibili|vimeo|qq\.com\/x/i.test(url) }
function toEmbedSrc(url) {
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  m = url.match(/bilibili\.com\/video\/(BV[\w]+)/)
  if (m) return `https://player.bilibili.com/player.html?bvid=${m[1]}`
  m = url.match(/vimeo\.com\/(\d+)/)
  if (m) return `https://player.vimeo.com/video/${m[1]}`
  return url
}

function applyHtmlSource() { if (!htmlSource.value.trim()) return; emit('import-html', htmlSource.value); htmlSource.value = ''; activePanel.value = null }
function insertHtmlSourceAtCursor() { if (!htmlSource.value.trim()) return; insertHtmlAtCursor(htmlSource.value); htmlSource.value = ''; activePanel.value = null }

async function onWordFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  wordImporting.value = true
  try {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer }, {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Title'] => h1.doc-title:fresh",
      ],
      convertImage: mammoth.images.imgElement((image) => image.read('base64').then((base64) => ({ src: `data:${image.contentType};base64,${base64}` }))),
    })
    if (result.value) { wordResultHtml.value = result.value; activePanel.value = 'word-confirm' }
    if (result.messages?.length) console.warn('[Word Import]', result.messages)
  } catch (err) {
    console.error('[Word Import Error]', err)
    alert('Word 文件解析失败，请确认文件格式为 .docx')
  } finally {
    wordImporting.value = false
    if (wordFileRef.value) wordFileRef.value.value = ''
  }
}

function wordInsertAtCursor() { insertHtmlAtCursor(wordResultHtml.value); wordResultHtml.value = ''; activePanel.value = null }
function wordReplaceAll() { emit('import-html', wordResultHtml.value); wordResultHtml.value = ''; activePanel.value = null }
function wordCancel() { wordResultHtml.value = ''; activePanel.value = null }

const toolGroups = computed(() => [
  { label: '历史', tools: [{ icon: '↩', title: '撤销 (Ctrl+Z)', action: () => exec('undo') }, { icon: '↪', title: '重做 (Ctrl+Y)', action: () => exec('redo') }] },
  { label: '格式', tools: [{ icon: '<b>B</b>', title: '加粗 (Ctrl+B)', action: () => exec('bold') }, { icon: '<i>I</i>', title: '斜体 (Ctrl+I)', action: () => exec('italic') }, { icon: '<u>U</u>', title: '下划线 (Ctrl+U)', action: () => exec('underline') }, { icon: '<s>S</s>', title: '删除线', action: () => exec('strikeThrough') }, { icon: 'x²', title: '上标', action: () => exec('superscript') }, { icon: 'x₂', title: '下标', action: () => exec('subscript') }] },
  { label: '段落', tools: [{ icon: 'H1', title: '标题1', action: () => toggleHeading('H1') }, { icon: 'H2', title: '标题2', action: () => toggleHeading('H2') }, { icon: 'H3', title: '标题3', action: () => toggleHeading('H3') }, { icon: '¶', title: '正文', action: () => toggleHeading('P') }, { icon: '❝', title: '引用', action: () => exec('formatBlock', 'BLOCKQUOTE') }, { icon: '—', title: '分隔线', action: () => exec('insertHorizontalRule') }] },
  { label: '列表', tools: [{ icon: '•', title: '无序列表', action: () => exec('insertUnorderedList') }, { icon: '1.', title: '有序列表', action: () => exec('insertOrderedList') }, { icon: '⇤', title: '减少缩进', action: () => exec('outdent') }, { icon: '⇥', title: '增加缩进', action: () => exec('indent') }] },
  { label: '对齐', tools: [{ icon: '⫷', title: '左对齐', action: () => exec('justifyLeft') }, { icon: '⫿', title: '居中', action: () => exec('justifyCenter') }, { icon: '⫸', title: '右对齐', action: () => exec('justifyRight') }, { icon: '⫻', title: '两端对齐', action: () => exec('justifyFull') }] },
])
</script>

<template>
  <div class="rt-toolbar">
    <div class="rt-toolbar-row">
      <template v-for="(group, gi) in toolGroups" :key="gi">
        <div class="rt-tool-group">
          <button v-for="(tool, ti) in group.tools" :key="ti" class="rt-tool-btn" :title="tool.title" @mousedown.prevent="tool.action()"><span v-html="tool.icon" /></button>
        </div>
        <div v-if="gi < toolGroups.length - 1" class="rt-divider" />
      </template>

      <div class="rt-divider" />
      <div class="rt-tool-group">
        <div class="rt-dropdown-wrap">
          <button class="rt-tool-btn rt-dropdown-btn" title="字号" @mousedown.prevent="showFontSize = !showFontSize; showLineHeight = false"><span class="rt-dropdown-label">字号</span></button>
          <div v-if="showFontSize" class="rt-dropdown-panel"><button v-for="s in fontSizes" :key="s" class="rt-dropdown-item" :style="{ fontSize: s + 'px' }" @mousedown.prevent="setFontSize(s)">{{ s }}px</button></div>
        </div>
        <div class="rt-dropdown-wrap">
          <button class="rt-tool-btn rt-dropdown-btn" title="行高" @mousedown.prevent="showLineHeight = !showLineHeight; showFontSize = false"><span class="rt-dropdown-label">行高</span></button>
          <div v-if="showLineHeight" class="rt-dropdown-panel"><button v-for="lh in lineHeights" :key="lh" class="rt-dropdown-item" @mousedown.prevent="setLineHeight(lh)">{{ lh }}</button></div>
        </div>
      </div>

      <div class="rt-divider" />
      <div class="rt-tool-group">
        <div class="rt-color-wrap">
          <button class="rt-tool-btn rt-color-btn" title="文字颜色" @mousedown.prevent="showColorPicker = !showColorPicker; showBgColorPicker = false"><span class="rt-color-icon">A</span><span class="rt-color-bar" style="background: #ef4444" /></button>
          <div v-if="showColorPicker" class="rt-color-panel"><button v-for="c in presetColors" :key="c" class="rt-color-swatch" :style="{ background: c }" :title="c" @mousedown.prevent="setColor(c)" /></div>
        </div>
        <div class="rt-color-wrap">
          <button class="rt-tool-btn rt-color-btn" title="背景颜色" @mousedown.prevent="showBgColorPicker = !showBgColorPicker; showColorPicker = false"><span class="rt-color-icon rt-bg-icon">A</span><span class="rt-color-bar" style="background: #fde68a" /></button>
          <div v-if="showBgColorPicker" class="rt-color-panel"><button v-for="c in presetColors" :key="c" class="rt-color-swatch" :style="{ background: c }" :title="c" @mousedown.prevent="setBgColor(c)" /><button class="rt-color-swatch rt-color-none" title="无背景" @mousedown.prevent="setBgColor('transparent')">∅</button></div>
        </div>
      </div>

      <div class="rt-divider" />
      <div class="rt-tool-group">
        <button class="rt-tool-btn" title="插入链接" @mousedown.prevent="showLinkInput = !showLinkInput; activePanel = null">🔗</button>
        <button class="rt-tool-btn" title="清除格式" @mousedown.prevent="clearFormat">Tx</button>
      </div>

      <div class="rt-divider" />
      <div class="rt-tool-group rt-media-group">
        <button class="rt-tool-btn rt-tool-btn-wide" :class="{ active: activePanel === 'image' }" title="插入图片" @mousedown.prevent="togglePanel('image')">🖼</button>
        <button class="rt-tool-btn rt-tool-btn-wide" :class="{ active: activePanel === 'video' }" title="插入视频" @mousedown.prevent="togglePanel('video')">🎬</button>
        <button class="rt-tool-btn rt-tool-btn-wide" :class="{ active: activePanel === 'html' }" title="解析 HTML" @mousedown.prevent="togglePanel('html')">&lt;/&gt;</button>
        <button class="rt-tool-btn rt-tool-btn-wide" :class="{ importing: wordImporting }" title="导入 Word (.docx)" @mousedown.prevent="wordFileRef?.click()"><span v-if="wordImporting" class="rt-spin">↻</span><span v-else>W</span></button>
      </div>
    </div>

    <div v-if="showLinkInput" class="rt-sub-bar"><input v-model="linkUrl" class="rt-input" placeholder="输入链接地址，如 https://..." @keydown.enter.prevent="insertLink" /><button class="btn btn-sm btn-primary" @mousedown.prevent="insertLink">插入</button><button class="btn btn-sm btn-outline" @mousedown.prevent="removeLink">移除链接</button></div>

    <div v-if="activePanel === 'image'" class="rt-sub-bar rt-media-bar">
      <div class="rt-media-head"><div class="rt-tab-row"><button class="rt-tab" :class="{ active: imageMode === 'url' }" @mousedown.prevent="imageMode = 'url'">网络图片</button><button class="rt-tab" :class="{ active: imageMode === 'upload' }" @mousedown.prevent="imageMode = 'upload'">本地上传</button></div></div>
      <div class="rt-media-body">
        <template v-if="imageMode === 'url'"><div class="rt-inline-row"><input v-model="imageUrl" class="rt-input" placeholder="图片 URL，如 https://example.com/img.png" /><button class="btn btn-sm btn-primary rt-btn-fixed" :disabled="!imageUrl" @mousedown.prevent="insertImageByUrl">插入</button></div></template>
        <template v-else><div class="rt-inline-row"><button class="btn btn-sm btn-outline rt-btn-fixed" @mousedown.prevent="imageFileRef?.click()">选择图片文件</button><span class="rt-hint">选择后自动插入</span></div></template>
        <div class="rt-inline-row rt-opts-row"><input v-model="imageAlt" class="rt-input rt-input-sm" placeholder="描述 (alt)" /><input v-model="imageWidth" class="rt-input rt-input-sm" placeholder="宽度 (400px / 50%)" /></div>
      </div>
    </div>

    <div v-if="activePanel === 'video'" class="rt-sub-bar rt-media-bar">
      <div class="rt-media-head"><div class="rt-tab-row"><button class="rt-tab" :class="{ active: videoMode === 'url' }" @mousedown.prevent="videoMode = 'url'">视频链接</button><button class="rt-tab" :class="{ active: videoMode === 'upload' }" @mousedown.prevent="videoMode = 'upload'">本地上传</button></div></div>
      <div class="rt-media-body">
        <template v-if="videoMode === 'url'"><div class="rt-inline-row"><input v-model="videoUrl" class="rt-input" placeholder="视频 URL / YouTube / B站 / Vimeo" /><button class="btn btn-sm btn-primary rt-btn-fixed" :disabled="!videoUrl" @mousedown.prevent="insertVideoByUrl">插入</button></div><div class="rt-hint">支持直链、YouTube、B站、Vimeo，自动识别嵌入</div></template>
        <template v-else><div class="rt-inline-row"><button class="btn btn-sm btn-outline rt-btn-fixed" @mousedown.prevent="videoFileRef?.click()">选择视频文件</button><span class="rt-hint">选择后自动插入</span></div></template>
        <div class="rt-inline-row rt-opts-row"><input v-model="videoWidth" class="rt-input rt-input-sm" placeholder="宽度 (默认 100%)" /></div>
      </div>
    </div>

    <div v-if="activePanel === 'html'" class="rt-sub-bar rt-html-bar">
      <div class="rt-html-label">粘贴 HTML 源码：</div>
      <textarea v-model="htmlSource" class="rt-textarea" rows="5" placeholder="<h2>标题</h2><p>段落内容...</p>" />
      <div class="rt-html-actions"><button class="btn btn-sm btn-primary" :disabled="!htmlSource.trim()" @mousedown.prevent="insertHtmlSourceAtCursor" title="在光标处插入 HTML">插入到光标</button><button class="btn btn-sm btn-outline" :disabled="!htmlSource.trim()" @mousedown.prevent="applyHtmlSource" title="替换整个编辑区内容">替换全部内容</button><div class="rt-html-preview-toggle"><details><summary>预览效果</summary><div class="rt-html-preview" v-html="htmlSource" /></details></div></div>
    </div>

    <div v-if="activePanel === 'word-confirm'" class="rt-sub-bar rt-word-bar">
      <div class="rt-word-info"><span class="rt-word-icon">W</span><span class="rt-word-text">Word 文档解析完成，请选择导入方式：</span></div>
      <div class="rt-word-actions"><button class="btn btn-sm btn-primary" @mousedown.prevent="wordInsertAtCursor">插入到光标处</button><button class="btn btn-sm btn-outline" @mousedown.prevent="wordReplaceAll">替换全部内容</button><button class="btn btn-sm btn-outline rt-word-cancel" @mousedown.prevent="wordCancel">取消</button></div>
      <details class="rt-word-preview-wrap"><summary>预览导入内容</summary><div class="rt-word-preview" v-html="wordResultHtml" /></details>
    </div>

    <input ref="imageFileRef" type="file" accept="image/*" style="display:none" @change="onImageFileChange" />
    <input ref="videoFileRef" type="file" accept="video/*" style="display:none" @change="onVideoFileChange" />
    <input ref="wordFileRef" type="file" accept=".docx" style="display:none" @change="onWordFileChange" />
  </div>
</template>

<style scoped>
.rt-toolbar { border:1px solid var(--c-border); border-bottom:none; border-radius:var(--radius) var(--radius) 0 0; background:#f8fafc; user-select:none; }
.rt-toolbar-row { display:flex; align-items:center; flex-wrap:wrap; gap:2px; padding:4px 6px; }
.rt-tool-group { display:flex; align-items:center; gap:1px; }
.rt-divider { width:1px; height:22px; background:#e2e8f0; margin:0 4px; flex-shrink:0; }
.rt-tool-btn { display:inline-flex; align-items:center; justify-content:center; width:30px; height:28px; border:none; background:transparent; border-radius:4px; cursor:pointer; font-size:13px; font-weight:600; color:#475569; font-family:inherit; transition:all .1s; }
.rt-tool-btn:hover { background:#e2e8f0; color:#1e293b; }
.rt-tool-btn:active { background:#cbd5e1; }
.rt-tool-btn.active { background:#dbeafe; color:#1d4ed8; }
.rt-tool-btn-wide { width:34px; font-size:14px; }
.rt-tool-btn.importing { color: var(--c-primary); }
.rt-spin { display:inline-block; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.rt-color-wrap { position: relative; }
.rt-color-btn { flex-direction:column; gap:1px; height:32px; }
.rt-color-icon { font-size:14px; font-weight:800; line-height:1; }
.rt-bg-icon { background:#fde68a; padding:0 3px; border-radius:2px; }
.rt-color-bar { width:16px; height:3px; border-radius:1px; }
.rt-color-panel { position:absolute; top:100%; left:0; z-index:20; display:flex; flex-wrap:wrap; gap:4px; padding:8px; background:white; border:1px solid var(--c-border); border-radius:var(--radius); box-shadow:0 4px 12px rgba(0,0,0,.12); width:170px; }
.rt-color-swatch { width:24px; height:24px; border:2px solid #e2e8f0; border-radius:4px; cursor:pointer; transition:transform .1s; font-size:0; }
.rt-color-swatch:hover { transform:scale(1.2); border-color:#94a3b8; }
.rt-color-none { font-size:12px; display:flex; align-items:center; justify-content:center; color:#94a3b8; background:white !important; }
.rt-sub-bar { display:flex; align-items:center; gap:6px; padding:6px 8px; border-top:1px solid var(--c-border); background:#f0f9ff; flex-wrap:wrap; }
.rt-input { flex:1; min-width:0; border:1px solid var(--c-border); border-radius:4px; padding:5px 8px; font-size:13px; outline:none; font-family:inherit; }
.rt-input:focus { border-color:var(--c-primary); }
.rt-input-sm { flex:0 1 160px; }
.rt-media-bar { flex-direction:column; align-items:stretch; padding:8px 10px; gap:6px; }
.rt-media-head { display:flex; align-items:center; }
.rt-tab-row { display:flex; gap:2px; }
.rt-tab { padding:3px 10px; border:1px solid var(--c-border); border-radius:4px; background:white; font-size:12px; cursor:pointer; font-family:inherit; color:var(--c-text-secondary); transition:all .1s; }
.rt-tab.active { background:var(--c-primary); color:white; border-color:var(--c-primary); }
.rt-media-body { display:flex; flex-direction:column; gap:6px; }
.rt-inline-row { display:flex; align-items:center; gap:6px; }
.rt-opts-row { max-width:360px; }
.rt-btn-fixed { flex-shrink:0; white-space:nowrap; }
.rt-hint { font-size:11px; color:var(--c-text-secondary); flex-shrink:0; }
.rt-html-bar { flex-direction:column; align-items:stretch; }
.rt-html-label { font-size:12px; font-weight:500; color:var(--c-text-secondary); }
.rt-textarea { width:100%; border:1px solid var(--c-border); border-radius:4px; padding:8px; font-size:13px; font-family:'Consolas','Monaco',monospace; outline:none; resize:vertical; line-height:1.5; }
.rt-textarea:focus { border-color:var(--c-primary); }
.rt-html-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.rt-html-preview-toggle { margin-left:auto; font-size:12px; }
.rt-html-preview-toggle summary { cursor:pointer; color:var(--c-primary); }
.rt-html-preview { margin-top:6px; padding:8px 12px; border:1px dashed var(--c-border); border-radius:4px; background:white; max-height:200px; overflow:auto; line-height:1.6; font-size:14px; }
.rt-dropdown-wrap { position:relative; }
.rt-dropdown-btn { width:auto; padding:0 6px; gap:3px; }
.rt-dropdown-label { font-size:11px; font-weight:500; white-space:nowrap; }
.rt-dropdown-panel { position:absolute; top:100%; left:0; z-index:20; display:flex; flex-direction:column; min-width:72px; max-height:240px; overflow-y:auto; background:white; border:1px solid var(--c-border); border-radius:var(--radius); box-shadow:0 4px 12px rgba(0,0,0,.12); padding:4px 0; }
.rt-dropdown-item { padding:4px 12px; border:none; background:transparent; text-align:left; cursor:pointer; font-family:inherit; font-size:13px; color:var(--c-text); white-space:nowrap; transition:background .1s; }
.rt-dropdown-item:hover { background:#f1f5f9; color:var(--c-primary); }
.rt-word-bar { flex-direction:column; align-items:stretch; padding:10px 12px; gap:8px; background:#f0fdf4; border-top-color:#86efac; }
.rt-word-info { display:flex; align-items:center; gap:8px; }
.rt-word-icon { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; background:#2563eb; color:white; font-weight:800; font-size:14px; border-radius:4px; flex-shrink:0; }
.rt-word-text { font-size:13px; font-weight:500; color:#166534; }
.rt-word-actions { display:flex; gap:6px; align-items:center; }
.rt-word-cancel { color:var(--c-text-secondary) !important; }
.rt-word-preview-wrap { font-size:12px; }
.rt-word-preview-wrap summary { cursor:pointer; color:var(--c-primary); }
.rt-word-preview { margin-top:6px; padding:10px 12px; border:1px dashed var(--c-border); border-radius:4px; background:white; max-height:240px; overflow:auto; line-height:1.6; font-size:14px; }
</style>

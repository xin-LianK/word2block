# 旧版文档管理独立项目

这是从主项目 `src/views/document` 拆出的旧版文档/模板管理前端，用于本地演示和维护文档编辑、模板管理、DOCX 导入、数据源配置、版本记录、导出预览等能力。

项目目前使用前端内存数据模拟后端数据库，刷新页面后运行态变更不会持久化。模板 JSON 导入/导出、DOCX 解析、Word/PDF 导出等浏览器端能力可以独立运行；AI 生成 SQL 和 Python DOCX 预览服务需要额外配置环境变量。

## 技术栈

- Vue 3 + Vite
- Pinia
- Vue Router
- Element Plus
- mammoth：浏览器端 DOCX 解析
- docx、file-saver：Word 导出
- jsPDF、html2canvas：PDF 导出
- xlsx：模板数据源文件解析相关能力

## 启动

```bash
npm install
npm run dev
```

默认开发地址：

```text
http://localhost:5174/
```

生产构建：

```bash
npm run build
```

本地预览构建产物：

```bash
npm run preview
```

## 页面路由

- `/`：重定向到文档列表
- `/document/index`：文档列表，可新建、重命名、删除文档
- `/document/templates`：模板列表，可新建、复制、导入、导出、删除模板
- `/document-edit/:id`：文档编辑页
- `/template-edit/:id`：模板编辑页

## 主要功能

### 文档管理

- 基于模板创建文档，支持选择报告日期范围
- 文档块分页加载和右侧目录跳转
- 支持富文本、表格、AI 内容等内容块编辑
- 内容块可上移、下移、删除
- 动态变量可按块刷新或批量刷新
- 内容变更会写入前端模拟版本记录
- 支持导出预览、导出 Word、导出 PDF

### 模板管理

- 新建、编辑、复制、删除模板
- 模板支持 JSON 导入和导出
- 模板块支持富文本、表格、AI 内容、图片类型
- 模板块可配置 API 数据源或文件数据源
- 文件数据源支持上传批次、校验、发布
- 模板编辑页提供块目录、结构预览和版本历史

### DOCX 导入

- 模板列表页可将 DOCX 生成新模板
- 模板编辑页可用 DOCX 覆盖当前模板草稿
- 优先调用 Python DOCX 预览接口，失败后回退到浏览器端 `mammoth` 解析
- 导入预览支持重命名块、调整顺序、删除候选块、合并富文本块、导出导入报告
- 候选清理规则和标签偏好会存入浏览器 `localStorage`

### 导出

- Word 导出使用 `docx` 生成 `.docx`
- PDF 导出使用 `html2canvas` 渲染后写入 `jsPDF`
- `public/report-template/styles.xml` 会作为 Word 样式模板加载；加载失败时使用代码内置样式

## 环境变量

在项目根目录创建 `.env.local` 可覆盖以下配置：

```ini
VITE_AI_API_URL=
VITE_AI_API_KEY=
VITE_AI_MODEL=
VITE_APP_BASE_API=
```

- `VITE_AI_API_URL`：AI 对话接口地址，用于模板块中“AI 生成 SQL”等能力
- `VITE_AI_API_KEY`：AI 接口鉴权 token，可选
- `VITE_AI_MODEL`：AI 模型名；启用 AI 调用时必填
- `VITE_APP_BASE_API`：Python DOCX 预览接口前缀，接口路径为 `/report/template/import-docx/preview`

未配置 Python DOCX 服务时，DOCX 导入会自动回退到浏览器端解析。

## 目录结构

```text
legacy-document-app/
├─ public/
│  └─ report-template/styles.xml      # Word 导出样式模板
├─ src/
│  ├─ api/                            # AI 和 DOCX 预览接口封装
│  ├─ composables/                    # 通用组合式函数
│  ├─ mock/                           # 内置模板、文档和版本模拟数据
│  ├─ router/                         # 路由配置
│  ├─ stores/                         # Pinia 状态管理
│  ├─ styles/                         # 全局样式
│  ├─ utils/                          # 文档、模板、导入导出工具
│  └─ views/document/                 # 文档与模板页面及组件
├─ index.html
├─ package.json
└─ vite.config.js
```

## 核心文件

- `src/stores/document.js`：文档、模板、版本、分页加载、数据源批次的核心状态逻辑
- `src/views/document/index.vue`：文档列表和创建文档流程
- `src/views/document/templates.vue`：模板列表、JSON/DOCX 导入、模板筛选
- `src/views/document/edit.vue`：文档编辑页入口
- `src/views/document/templateEdit.vue`：模板编辑页入口
- `src/views/document/components/DocumentEditor.vue`：文档编辑器、目录、懒加载、导出预览
- `src/views/document/components/BlockDefEditor.vue`：模板块定义编辑器
- `src/utils/docx-template-import.js`：浏览器端 DOCX 到模板草稿解析
- `src/utils/docx-template-import-provider.js`：Python 优先、浏览器回退的 DOCX 解析调度
- `src/utils/export-document.js`：Word/PDF 导出和导出预览 HTML 生成

## 开发注意事项

- 当前没有接入真实后端，`src/stores/document.js` 中的 `_allDocs` 和 `templates` 是运行时模拟数据。
- 页面刷新会重置未导出的文档和模板修改。
- DOCX 导入的一些用户偏好保存在浏览器 `localStorage`，包括候选块清理规则、标签偏好和导入回归记录。
- `@` 别名指向 `src`，配置见 `vite.config.js`。
- 开发服务器固定端口为 `5174`。

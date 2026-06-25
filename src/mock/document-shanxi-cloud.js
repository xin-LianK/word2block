const ts = '2026-02-05T10:00:00Z'

const blue = { bgColor: '#1E40AF', textColor: '#FFFFFF', fontWeight: 'bold' }
const green = { bgColor: '#059669', textColor: '#FFFFFF', fontWeight: 'bold' }
const red = { bgColor: '#DC2626', textColor: '#FFFFFF', fontWeight: 'bold' }
const tableStyle = { borderColor: '#E5E7EB', borderWidth: 1, headerBgColor: '#1E40AF', headerTextColor: '#FFFFFF', stripedRows: true, fontSize: 13, lineHeight: 1.5, cellPadding: '8px 12px', verticalAlign: 'middle', whiteSpace: 'pre-line' }
const wordBlueTableStyle = { borderColor: '#000000', borderWidth: 1, headerBgColor: '#0070C0', headerTextColor: '#FFFFFF', stripedRows: false, fontSize: 11, fontFamily: '仿宋, FangSong, SimSun, serif', lineHeight: 1.25, cellPadding: '5px 7px', verticalAlign: 'middle', whiteSpace: 'pre-line' }
const wordGrayTableStyle = { borderColor: '#000000', borderWidth: 1, headerBgColor: '#D7D7D7', headerTextColor: '#000000', stripedRows: false, fontSize: 11, fontFamily: '仿宋, FangSong, SimSun, serif', lineHeight: 1.25, cellPadding: '5px 7px', verticalAlign: 'middle', whiteSpace: 'pre-line' }
const redTableStyle = { borderColor: '#FCA5A5', borderWidth: 1, headerBgColor: '#DC2626', headerTextColor: '#FFFFFF', stripedRows: true, fontSize: 12, lineHeight: 1.45, cellPadding: '7px 10px', verticalAlign: 'middle', whiteSpace: 'pre-line' }

const wordBody = 'font-family: 仿宋, FangSong, SimSun, serif; font-size: 14.67px; line-height: 1.5; color: #000000; margin: 0 0 10px; text-indent: 2em;'
const wordH1 = 'font-family: 黑体, SimHei, sans-serif; font-size: 21.33px; line-height: 1.5; color: #000000; font-weight: bold; margin: 16px 0 10px;'
const wordH2 = 'font-family: 黑体, SimHei, sans-serif; font-size: 18.67px; line-height: 1.5; color: #000000; font-weight: bold; margin: 14px 0 8px;'
const wordH3 = 'font-family: 黑体, SimHei, sans-serif; font-size: 16px; line-height: 1.5; color: #000000; font-weight: bold; margin: 12px 0 6px;'
const pdfBody = 'font-family: 仿宋, FangSong, SimSun, serif; font-size: 14px; line-height: 1.75; color: #111827; margin: 0 0 9px; text-indent: 2em;'
const pdfH1 = 'font-family: 黑体, SimHei, sans-serif; font-size: 22px; line-height: 1.55; color: #111827; font-weight: 700; margin: 16px 0 10px;'
const pdfH2 = 'font-family: 黑体, SimHei, sans-serif; font-size: 18px; line-height: 1.55; color: #111827; font-weight: 700; margin: 12px 0 8px;'
const pdfH3 = 'font-family: 黑体, SimHei, sans-serif; font-size: 16px; line-height: 1.55; color: #111827; font-weight: 700; margin: 10px 0 6px;'

function col(id, title, width = 120, align = 'center', headerStyle = blue) {
  return { id, title, width, align, headerStyle }
}

function row(id, columnIds, values) {
  return { id, cells: columnIds.map((columnId, index) => ({ columnId, value: values[index] ?? '' })) }
}

function blankRows(prefix, count, columnIds, overrides = {}) {
  return Array.from({ length: count }, (_, index) => {
    const values = columnIds.map((columnId) => overrides[columnId] ?? '')
    return row(`${prefix}_${index + 1}`, columnIds, values)
  })
}

function applyDefaultRichStyle(html) {
  return String(html)
    .replace(/<h1>/g, `<h1 style="${pdfH1}">`)
    .replace(/<h2>/g, `<h2 style="${pdfH1}">`)
    .replace(/<h3>/g, `<h3 style="${pdfH2}">`)
    .replace(/<h4>/g, `<h4 style="${pdfH3}">`)
    .replace(/<p>/g, `<p style="${pdfBody}">`)
    .replace(/<ol>/g, `<ol style="font-family: 仿宋, FangSong, SimSun, serif; font-size: 14px; line-height: 1.75; color: #111827;">`)
}

function richDef(id, sortOrder, label, html, variables = [], apiEndpoint = '') {
  const styledHtml = applyDefaultRichStyle(html)
  return {
    id,
    type: 'rich_text',
    sortOrder,
    label,
    required: true,
    defaultContent: { html: styledHtml, rawText: styledHtml.replace(/<[^>]+>/g, ''), variables },
    dataSourceConfig: apiEndpoint ? { apiEndpoint, paramMapping: { month: 'currentMonth' } } : null,
  }
}

function tableDef(id, sortOrder, label, columns, rows = [], apiEndpoint = '', style = tableStyle) {
  const resolvedStyle = style === tableStyle && id.startsWith('def_rp_')
    ? (sortOrder <= 16 ? wordBlueTableStyle : wordGrayTableStyle)
    : style
  return {
    id,
    type: 'table',
    sortOrder,
    label,
    required: true,
    defaultContent: { title: label, columns, rows, style: resolvedStyle },
    dataSourceConfig: apiEndpoint ? { apiEndpoint, paramMapping: { month: 'currentMonth' } } : null,
  }
}

function aiDef(id, sortOrder, label, html, prompt, apiEndpoint = '') {
  return {
    id,
    type: 'ai_content',
    sortOrder,
    label,
    required: false,
    defaultContent: { html, rawText: html.replace(/<[^>]+>/g, ''), prompt, model: 'gpt-4', variables: [] },
    dataSourceConfig: apiEndpoint ? { apiEndpoint, paramMapping: { month: 'currentMonth' } } : null,
  }
}

function blockFromDef(def, id, contentOverride) {
  const content = contentOverride || def.defaultContent
  return {
    id,
    type: def.type,
    sortOrder: def.sortOrder,
    content,
    dataSource: {
      mode: def.dataSourceConfig?.apiEndpoint ? 'api' : 'api',
      apiEndpoint: def.dataSourceConfig?.apiEndpoint || '',
      params: def.dataSourceConfig?.apiEndpoint ? { month: '2026-01' } : {},
      fetchedAt: ts,
    },
    versionCount: 1,
    createdAt: ts,
    updatedAt: ts,
  }
}

const resourceColumns = [
  col('item', '条目', 180, 'left'),
  col('count', '数量', 120),
  col('cpu', 'CPU/vCPU（核）', 130),
  col('memory', '内存（GB）', 120),
  col('storage', '存储容量（GB）', 150),
]
const resourceRows = [
  row('res_1', ['item', 'count', 'cpu', 'memory', 'storage'], ['上月底资源统计结果', '139', '1784C', '4680GB', '8100GB']),
  row('res_2', ['item', 'count', 'cpu', 'memory', 'storage'], ['本月扩容数量', 'XX', 'XX', 'XX', 'XX']),
  row('res_3', ['item', 'count', 'cpu', 'memory', 'storage'], ['本月缩容数量', 'XX', 'XX', 'XX', 'XX']),
  row('res_4', ['item', 'count', 'cpu', 'memory', 'storage'], ['本月底资源统计结果', '139', '1784C', '4680GB', '8100GB']),
  row('res_5', ['item', 'count', 'cpu', 'memory', 'storage'], ['资源差值合计', '0', '0', '0', '0']),
]
resourceRows.forEach((item) => {
  item.cells.slice(1).forEach((cell) => { cell.style = { textColor: '#FF0000' } })
})
const storageColumns = [
  col('item', '条目', 180, 'left'),
  col('total', '总存储容量（GB）', 150),
  col('used', '已用存储容量（GB）', 150),
  col('available', '可用存储容量（GB）', 150),
  col('usage', '存储使用率（%）', 130),
]
const storageRows = [
  row('storage_1', ['item', 'total', 'used', 'available', 'usage'], ['上月资源统计结果', 'XX', 'XX', 'XX', '67%']),
  row('storage_2', ['item', 'total', 'used', 'available', 'usage'], ['本月资源统计结果', 'XX', 'XX', 'XX', '71%']),
  row('storage_3', ['item', 'total', 'used', 'available', 'usage'], ['资源差值合计', 'XX', 'XX', '', '4%']),
]
storageRows.forEach((item) => {
  item.cells.slice(1).forEach((cell) => { cell.style = { textColor: '#FF0000' } })
})
const eventCountColumns = [
  col('status', '工单状态', 120, 'left'),
  col('l1', '一级事件', 90),
  col('l2', '二级事件', 90),
  col('l3', '三级事件', 90),
  col('l4', '四级事件', 90),
]
const eventCountRows = ['处理中', '待领取', '已完成', '已关闭', '挂起', '逾期'].map((status, index) =>
  row(`event_count_${index + 1}`, ['status', 'l1', 'l2', 'l3', 'l4'], [status, '', '', '', '']),
)
const eventDetailColumns = [
  col('code', '工单编号', 130),
  col('title', '工单标题', 240, 'left'),
  col('level', '事件级别', 100),
  col('owner', '完成人', 100),
  col('closeCode', '事件关闭代码', 140),
  col('remark', '备注', 180, 'left'),
]
const opsColumns = [
  col('flow', '流程名称', 120, 'left'),
  col('code', '工单编号', 130),
  col('title', '工单标题', 220, 'left'),
  col('unit', '申请单位', 150, 'left'),
  col('owner', '完成人', 100),
  col('result', '实施结果', 120),
  col('remark', '备注', 170, 'left'),
]
const requestColumns = [
  col('flow', '流程名称', 120, 'left'),
  col('code', '工单编号', 130),
  col('title', '工单标题', 220, 'left'),
  col('unit', '申请单位', 150, 'left'),
  col('system', '系统名称', 180, 'left'),
  col('owner', '完成人', 100),
  col('result', '实施结果', 120),
  col('remark', '备注', 170, 'left'),
]
const capacityColumns = [
  col('pool', '资源池', 120, 'left'), col('cpu', 'CPU分配率', 110), col('memory', '内存分配率', 110), col('centralAlloc', '集中存储空间分配率', 160), col('distAlloc', '分布式存储空间分配率', 170), col('centralUsage', '集中存储空间使用率', 160), col('distUsage', '分布式存储空间使用率', 170), col('objectUsage', '对象存储使用率', 140), col('bandwidth', '网络带宽使用率', 140),
]
const demandColumns = [
  col('pool', '资源池', 120, 'left'), col('vm', '云主机数量（台）', 140), col('cpu', 'CPU（核）', 100), col('memory', '内存（GB）', 110), col('central', '集中存储空间（GB）', 160), col('dist', '分布式存储空间（GB）', 170), col('object', '对象存储（GB）', 140), col('remark', '备注', 180, 'left'),
]
const forecastColumns = [
  col('pool', '资源池', 120, 'left'), col('advice', '扩容意见', 140, 'left'), col('cpu', 'vCPU分配率（加锁单后）', 180), col('memory', '内存使用率（加锁单后）', 180), col('central', '集中存储空间使用率（实际使用率）', 220), col('dist', '分布式存储使用率（实际使用率）', 220), col('object', '对象存储使用率（实际使用率）', 190), col('bandwidth', '网络带宽使用率', 140),
]
const capacityRows = [
  row('capacity_xc', capacityColumns.map((item) => item.id), ['信创资源区', '', '', '', '', '', '', '', '移动：\n联通\n电信：']),
]
const demandRows = [
  row('demand_xc', demandColumns.map((item) => item.id), ['信创资源区', '', '', '', '', '', '', '']),
]
const forecastRows = [
  row('forecast_xc', forecastColumns.map((item) => item.id), ['信创资源区', '', '', '', '', '', '', '移动：\n联通\n电信：']),
]

export const resourcePoolTemplate = {
  id: 'tpl_resource_pool_monthly_v4',
  name: '08-山西云时代政务云月度服务报告模板V4',
  description: '从 docs/08-山西云时代政务云月度服务报告模板V4.docx 重新识别生成，按原目录、正文和 12 张表格拆分。',
  blockDefinitions: [
    richDef('def_rp_01', 1, '封面', `<h1 style="font-family: 黑体, SimHei, sans-serif; font-size: 53.33px; line-height: 1.4; color: #000000; text-align:center; margin: 120px 0 36px;">山西云时代政务云</h1><h2 style="font-family: 黑体, SimHei, sans-serif; font-size: 21.33px; line-height: 1.5; color: #000000; text-align:center; margin: 0 0 36px;">{{resource_pool_name}}资源池运维服务报告</h2><p style="font-family: 仿宋, FangSong, SimSun, serif; font-size: 21.33px; line-height: 1.5; color: #000000; text-align:center; margin: 0;">{{report_period_start}}至{{report_period_end}}</p>`, [
      { key: '{{resource_pool_name}}', label: '资源池名称', value: 'XX', sourceApi: '/api/config/resource-pool', responseField: 'resourcePoolName', fetchedAt: '' },
      { key: '{{report_period_start}}', label: '报告起始日期', value: '2025年6月1日', sourceApi: '/api/system/date', responseField: 'periodStart', fetchedAt: '' },
      { key: '{{report_period_end}}', label: '报告结束日期', value: '2025年6月30日', sourceApi: '/api/system/date', responseField: 'periodEnd', fetchedAt: '' },
    ]),
    richDef('def_rp_02', 2, '目录', `<h2 style="${wordH1}; text-align:center;">目录</h2><ol style="font-family: 宋体, SimSun, serif; font-size: 14.67px; line-height: 1.9; color: #000000;"><li>1.云资源池总体情况概述</li><li>2.资源池总体运行情况</li><li>2.1.云资源情况</li><li>2.1.1.虚拟机资源情况概况</li><li>2.1.2.裸金属</li><li>2.1.3.对象存储&文件存储</li><li>2.2.云资源池容量管理</li><li>2.3.云安全防护情况</li><li>3.XX资源池运维服务情况</li><li>3.1.事件管理</li><li>3.2.云平台运维类</li><li>3.3.资源申请类</li><li>3.4.应急响应</li><li>3.5.应急演练</li><li>3.6.重保</li><li>3.6.1.重保工单</li><li>3.6.2.重保材料</li><li>3.7.其他专项活动</li><li>4.XX资源池巡检情况</li><li>4.1.政务外网区</li><li>4.2.互联网区</li><li>5.XX资源池下个月重点工作情况</li></ol>`),
    richDef('def_rp_03', 3, '1. 云资源池总体情况概述', `<h2 style="${wordH1}">1. 云资源池总体情况概述</h2><p style="${wordBody}">本月度（202X年X月X日至202X年X月XX日）政务云平台整体运行基本正常，平台发生故障X次、服务X次中断，整体可用率100%。</p>`),
    richDef('def_rp_04', 4, '2. 资源池总体运行情况 / 2.1 云资源情况', `<h2 style="${wordH1}">2. 资源池总体运行情况</h2><h3 style="${wordH2}">2.1 云资源情况</h3>`),
    tableDef('def_rp_05', 5, '2.1.1 虚拟机资源情况概况', resourceColumns.map((item) => item.id === 'count' ? { ...item, title: '虚拟机（台）' } : item), [], '/api/resources/vm-summary'),
    tableDef('def_rp_06', 6, '2.1.2 裸金属资源情况概况', resourceColumns.map((item) => item.id === 'count' ? { ...item, title: '裸金属（台）' } : item), [], '/api/resources/bare-metal-summary'),
    tableDef('def_rp_07', 7, '2.1.3 对象存储&文件存储资源情况概况', storageColumns, [], '/api/resources/storage-summary'),
    richDef('def_rp_08', 8, '2.2 云资源池容量管理', `<h3 style="${wordH2}">2.2 云资源池容量管理</h3><p style="${wordBody}">本月对政务云平台XX资源池资源分配情况进行汇总，并根据实际情况结合政务云公司容量管理要求进行容量管理分析，具体情况如下：</p>`),
    tableDef('def_rp_09', 9, '2.2.1 资源实际分配/使用情况', capacityColumns, capacityRows, '/api/resources/capacity-usage'),
    tableDef('def_rp_10', 10, '2.2.2 监测周期内客户需求数量', demandColumns, demandRows, '/api/resources/customer-demand'),
    tableDef('def_rp_11', 11, '2.2.3 监测周期扩容预判', forecastColumns, forecastRows, '/api/resources/expansion-forecast'),
    richDef('def_rp_12', 12, '2.3 云安全防护情况', `<h3 style="${wordH2}">2.3 云安全防护情况</h3><p style="${wordBody}">XX资源池本月安全防护情况：</p><p style="${wordBody}">本月XX资源池政务外网区通过XX安全平台，共计发现了6421条告警信息，其中危急1024条，高危2403条、中危668条、低危2326条，所有攻击均已成功防御，无安全泄露事件发生。</p><p style="${wordBody}">【此处如果有截图，加图，安全威胁的列表、概览图等】</p><p style="${wordBody}">本月XX资源池政务外网区通过天眼监控平台，共计发现了6421条告警信息，其中危急1024条，高危2403条、中危668条、低危2326条，所有攻击均已成功防御，无安全泄露事件发生。</p><p style="${wordBody}">【此处如果有截图，加图，安全威胁的列表、概览图等】</p>`),
    tableDef('def_rp_13', 13, '2.3 安全告警统计', [
      col('platform', '监测平台', 150, 'left', red), col('critical', '危急', 90, 'right', red), col('high', '高危', 90, 'right', red), col('middle', '中危', 90, 'right', red), col('low', '低危', 90, 'right', red), col('total', '合计', 90, 'right', red), col('status', '处置状态', 120, 'center', red),
    ], [], '/api/security/summary', redTableStyle),
    richDef('def_rp_14', 14, '3. XX资源池运维服务情况', `<h2 style="${wordH1}">3. XX资源池运维服务情况</h2><p style="${wordBody}">XX资源池运维服务事项包括：事件管理工单、云平台运维类工单、资源申请类工单、应急响应、应急演练、重保和其他专项情况。工单完成情况如下：整体工单XX个，完成XX个，逾期XX个；应急响应事件XX次；应急演练XX次；重保XX次。详细情况如下</p>`),
    richDef('def_rp_15', 15, '3.1 事件管理', `<h3 style="${wordH2}">3.1 事件管理</h3><p style="${wordBody}">山西省级政务云平台XX资源池本月处理X个事件工单，其中一级事件X个，二级事件X个，三级事件X个，四级事件X个。</p>`),
    tableDef('def_rp_16', 16, '3.1.1 事件数量统计', eventCountColumns, [], '/api/events/summary'),
    tableDef('def_rp_17', 17, '3.1.2 事件工单情况汇总', eventDetailColumns, [], '/api/events/detail'),
    richDef('def_rp_18', 18, '3.2 云平台运维类', `<h3 style="${wordH2}">3.2 云平台运维类</h3><p style="${wordBody}">山西省级政务云平台XX资源池本月收到云平台运维类X个工单、完成X个工单、未完成X个工单、关闭X个工单、逾期X个工单。</p>`),
    tableDef('def_rp_19', 19, '3.2 云平台运维类工单情况汇总', opsColumns, [], '/api/workorders/platform-ops'),
    richDef('def_rp_20', 20, '3.3 资源申请类', `<h3 style="${wordH2}">3.3 资源申请类</h3><p style="${wordBody}">山西省级政务云平台XX资源池本月收到资源申请类X个工单、完成X个工单、未完成X个工单、关闭X个。</p>`),
    tableDef('def_rp_21', 21, '3.3 资源申请类工单情况汇总', requestColumns, [], '/api/workorders/resource-request'),
    richDef('def_rp_22', 22, '3.4 应急响应', `<h3 style="${wordH2}">3.4 应急响应</h3><p style="${wordBody}">山西省级政务云平台XX资源池本月处理X个应急响应事件。其中一级事件应急响应X次，二级事件应急响应X次。</p><p style="${wordBody}">（未发生应急响应事件写“不涉及”）</p>`),
    tableDef('def_rp_23', 23, '3.4 应急响应工单情况汇总', [
      col('code', '工单编号', 130), col('title', '工单标题', 240, 'left'), col('level', '事件等级', 100), col('status', '工单状态', 120), col('remark', '备注', 220, 'left'),
    ], [], '/api/workorders/emergency'),
    richDef('def_rp_24', 24, '3.5 应急演练', `<h3 style="${wordH2}">3.5 应急演练</h3><p style="${wordBody}">【列出针对云平台应急演练的相关材料，如应急演练计划、应急预案、应急演练方案、应急演练签到表、应急演练问题记录清单、应急演练总结报告、应急演练现场证明材料】</p>`),
    richDef('def_rp_25', 25, '3.6 重保 / 3.6.1 重保工单', `<h3 style="${wordH2}">3.6 重保</h3><h4 style="${wordH3}">3.6.1 重保工单</h4><p style="${wordBody}">山西省级政务云平台 xx 资源池本月提供重保服务X个。</p>`),
    tableDef('def_rp_26', 26, '3.6.1 重保工单情况汇总', [
      col('unit', '厅局名称', 170, 'left'), col('system', '系统名称', 220, 'left'), col('period', '重保期限', 150), col('status', '工单状态', 120), col('remark', '备注', 220, 'left'),
    ], [], '/api/workorders/key-protection'),
    richDef('def_rp_27', 27, '3.6.2 重保材料', `<h4 style="${wordH3}">3.6.2 重保材料</h4><p style="${wordBody}">【列出重保方案 重保期间人员签到表 重保服务日报 重保服务报告】</p>`),
    richDef('def_rp_28', 28, '3.7 其他专项活动', `<h3 style="${wordH2}">3.7 其他专项活动</h3><p style="${wordBody}">【列出针对云平台的专项活动简介】</p>`),
    richDef('def_rp_29', 29, '4. XX资源池巡检情况', `<h2 style="${wordH1}">4. XX资源池巡检情况</h2><p style="${wordBody}">山西省级政务云平台XX资源池本月通过云智慧监控软件查看服务器、网络等设备运行状态，包括电源、风扇、温度等信息，服务器运行状态正常。</p>`),
    richDef('def_rp_30', 30, '4.1 政务外网区', `<h3 style="${wordH2}">4.1 政务外网区</h3><p style="${wordBody}">【放一张典型的软件巡检界面图，如有异常，请描述】</p>`),
    richDef('def_rp_31', 31, '4.2 互联网区', `<h3 style="${wordH2}">4.2 互联网区</h3><p style="${wordBody}">【放一张典型的软件巡检界面图如有异常，请描述】</p>`),
    richDef('def_rp_32', 32, '5. XX资源池下个月重点工作情况', `<h2 style="${wordH1}">5. XX资源池下个月重点工作情况</h2><p style="${wordBody}">【枚举重点工作】</p>`),
  ],
  createdAt: '2026-03-04T15:22:57Z',
  updatedAt: ts,
}

const resourcePoolDocRows = {
  '2.1.1 虚拟机资源情况概况': resourceRows,
  '2.1.2 裸金属资源情况概况': resourceRows.map((item, index) => ({ ...item, id: `bare_${index + 1}` })),
  '2.1.3 对象存储&文件存储资源情况概况': storageRows,
  '2.2.1 资源实际分配/使用情况': capacityRows,
  '2.2.2 监测周期内客户需求数量': demandRows,
  '2.2.3 监测周期扩容预判': forecastRows,
  '2.3 安全告警统计': [
    row('security_xx', ['platform', 'critical', 'high', 'middle', 'low', 'total', 'status'], ['XX安全平台', '1024', '2403', '668', '2326', '6421', '已成功防御']),
    row('security_tianyan', ['platform', 'critical', 'high', 'middle', 'low', 'total', 'status'], ['天眼监控平台', '1024', '2403', '668', '2326', '6421', '已成功防御']),
  ],
  '3.1.1 事件数量统计': eventCountRows,
  '3.1.2 事件工单情况汇总': [
    row('event_detail_note', ['code', 'title', 'level', 'owner', 'closeCode', 'remark'], ['', '', '', '', '', '对“未完成”、“逾期”做情况说明']),
    ...blankRows('event_detail_blank', 16, ['code', 'title', 'level', 'owner', 'closeCode', 'remark']),
  ],
  '3.2 云平台运维类工单情况汇总': [
    row('ops_note', ['flow', 'code', 'title', 'unit', 'owner', 'result', 'remark'], ['', '', '', '', '', '', '对“未完成”、“逾期”做情况说明']),
    ...blankRows('ops_blank', 16, ['flow', 'code', 'title', 'unit', 'owner', 'result', 'remark']),
  ],
  '3.3 资源申请类工单情况汇总': [
    row('request_note', ['flow', 'code', 'title', 'unit', 'system', 'owner', 'result', 'remark'], ['', '', '', '', '', '', '', '对“未完成”、“逾期”做情况说明']),
    ...blankRows('request_blank', 13, ['flow', 'code', 'title', 'unit', 'system', 'owner', 'result', 'remark']),
  ],
  '3.4 应急响应工单情况汇总': [
    row('emergency_status_note', ['code', 'title', 'level', 'status', 'remark'], ['', '', '', '“处理中”\n“待领取”\n“已完成”\n“已关闭”\n“挂起”\n“逾期”', '']),
    ...blankRows('emergency_blank', 5, ['code', 'title', 'level', 'status', 'remark']),
  ],
  '3.6.1 重保工单情况汇总': [
    row('key_protection_status_note', ['unit', 'system', 'period', 'status', 'remark'], ['', '', '', '完成/未完成', '']),
    ...blankRows('key_protection_blank', 9, ['unit', 'system', 'period', 'status', 'remark']),
  ],
}

export const resourcePoolDoc = {
  id: 'doc_resource_pool_monthly_v4',
  title: '08-山西云时代政务云月度服务报告模板V4',
  templateId: resourcePoolTemplate.id,
  blocks: resourcePoolTemplate.blockDefinitions.map((definition) => {
    if (definition.type === 'table') {
      return blockFromDef(definition, `blk_${definition.id.replace('def_', '')}`, {
        ...definition.defaultContent,
        rows: resourcePoolDocRows[definition.label] || definition.defaultContent.rows,
      })
    }
    return blockFromDef(definition, `blk_${definition.id.replace('def_', '')}`)
  }),
  createdAt: '2026-03-04T15:22:57Z',
  updatedAt: ts,
  createdBy: '山西云时代技术有限公司',
  metadata: { source: 'DOCX重新识别', sourceFile: '08-山西云时代政务云月度服务报告模板V4.docx', sourceTextLength: 4107, sourceTables: 12 },
}

const keyIndicatorColumns = [col('metric', '指标', 240, 'left'), col('value', '2026年1月末', 160, 'right')]
const keyIndicatorRows = [
  ['服务单位数（家）', '96'],
  ['承载系统数（个）', '594'],
  ['非信创云主机（台）', '13,294'],
  ['信创云主机（台）', '4,844'],
  ['非信创 vCPU（核）', '117,179'],
  ['信创 vCPU（核）', '66,960'],
  ['非信创内存（GB）', '339,582'],
  ['信创内存（GB）', '153,616'],
  ['非信创存储（GB）', '12,414,891'],
  ['信创存储（GB）', '6,722,532'],
].map((values, index) => row(`key_${index + 1}`, ['metric', 'value'], values))
const resourceCompareColumns = [
  col('month', '月度', 70),
  col('nvm', '非信创云主机（台）', 150, 'right'),
  col('ncpu', '非信创vCPU（核）', 150, 'right'),
  col('nmem', '非信创内存（GB）', 150, 'right'),
  col('nstorage', '非信创存储（GB）', 160, 'right'),
  col('xvm', '信创云主机（台）', 140, 'right', green),
  col('xcpu', '信创vCPU（核）', 140, 'right', green),
  col('xmem', '信创内存（GB）', 140, 'right', green),
  col('xstorage', '信创存储（GB）', 150, 'right', green),
]
const resourceCompareRows = [
  row('compare_last', ['month', 'nvm', 'ncpu', 'nmem', 'nstorage', 'xvm', 'xcpu', 'xmem', 'xstorage'], ['上月', '13,276', '116,963', '338,790', '12,349,531', '4,828', '66,756', '153,168', '6,711,804']),
  row('compare_current', ['month', 'nvm', 'ncpu', 'nmem', 'nstorage', 'xvm', 'xcpu', 'xmem', 'xstorage'], ['本月', '13,294', '117,179', '339,582', '12,414,891', '4,844', '66,960', '153,616', '6,722,532']),
]
const opsStatsColumns = [
  col('month', '月度', 70),
  col('events', '调度处置事件（起）', 160, 'right'),
  col('requests', '服务请求工单（件）', 160, 'right'),
  col('backupVm', '备份云主机（台）', 150, 'right'),
  col('backupFail', '备份失败（台·次）', 150, 'right'),
  col('drill', '应急演练（次）', 130, 'right'),
]
const attackTopColumns = [
  col('rank', '排名', 60, 'center', red),
  col('unit', '单位名称', 190, 'left', red),
  col('system', '系统名称', 300, 'left', red),
  col('count', '受攻击数（次）', 150, 'right', red),
]
const deliveryColumns = [
  col('no', '序号', 60), col('unit', '单位名称', 180, 'left'), col('system', '系统名称', 260, 'left'), col('type', '云资源类型', 110), col('area', '区域', 110), col('quantity', '资源数量', 90, 'right'), col('cpu', 'vCPU/核', 90, 'right'), col('memory', '内存/GB', 90, 'right'), col('systemDisk', '系统盘/GB', 110, 'right'), col('dataDisk', '数据盘/GB', 110, 'right'), col('cpuUsage', 'vCPU利用率平均值（%）', 150, 'right'), col('memoryUsage', '内存利用率平均值（%）', 150, 'right'), col('confirmed', '确认情况', 100),
]
const deliveryCycleColumns = [
  col('cycle', '交付周期', 120), col('type', '云资源类型', 120), col('quantity', '资源数量', 110, 'right'), col('cpu', 'vCPU/核', 100, 'right'), col('memory', '内存/GB', 100, 'right'), col('systemDisk', '系统盘/GB', 120, 'right'), col('dataDisk', '数据盘/GB', 120, 'right'),
]
const systemUsageColumns = [
  col('no', '序号', 70), col('unit', '单位名称', 220, 'left'), col('system', '系统名称', 360, 'left'), col('usage', '资源使用率（%）', 150, 'right'),
]
const warningColumns = [
  col('no', '序号', 60), col('unit', '单位名称', 190, 'left'), col('system', '系统名称', 260, 'left'), col('ip', '云主机 IP', 140), col('type', '风险类型', 100), col('usage', '使用率（%）', 110, 'right'), col('date', '日期', 120),
]
const securityStatsColumns = [
  col('month', '月度', 80, 'center', red), col('attack', '处置外部攻击次数（万次）', 190, 'right', red), col('vulnerability', '处置高危漏洞（个）', 170, 'right', red), col('weakPassword', '处置弱口令（个）', 150, 'right', red), col('leak', '处置敏感信息泄漏风险（个）', 210, 'right', red), col('remark', '说明', 240, 'left', red),
]

export const provincialReportTemplate = {
  id: 'tpl_provincial_monthly_202601',
  name: '山西省政务云月度运行报告（2026年1月）模板',
  description: '从 PDF 重新识别生成，按 94 页报告的正文、统计表和附录拆分模块。',
  blockDefinitions: [
    richDef('def_pm_01', 1, '封面', '<h1 style="text-align:center">山西省政务云月度运行报告</h1><h2 style="text-align:center">（{{report_year}}年{{report_month}}月）</h2><p style="text-align:center">山西云时代技术有限公司</p>', [
      { key: '{{report_year}}', label: '年份', value: '2026', sourceApi: '/api/system/date', responseField: 'year', fetchedAt: '' },
      { key: '{{report_month}}', label: '月份', value: '1', sourceApi: '/api/system/date', responseField: 'monthNum', fetchedAt: '' },
    ]),
    richDef('def_pm_02', 2, '报告导语', '<p>为贯彻落实山西省数字经济发展战略，支撑全省数字政府建设、数字经济发展，为省直单位提供优质的信息化基础设施服务，总结2026年1月政务云平台运行服务情况。</p>'),
    richDef('def_pm_03', 3, '一、总体运行情况', '<h2>一、山西省政务云平台总体运行情况</h2><p>截至{{report_year}}年{{report_month}}月，山西省政务云平台服务省直单位{{unit_count}}家，支撑政务信息化系统{{system_count}}个，平台整体可用性{{availability}}，未发生重大网络安全事件。</p>', [
      { key: '{{unit_count}}', label: '服务单位数', value: 96, sourceApi: '/api/provincial/overview', responseField: 'unitCount', fetchedAt: '' },
      { key: '{{system_count}}', label: '系统数量', value: 594, sourceApi: '/api/provincial/overview', responseField: 'systemCount', fetchedAt: '' },
      { key: '{{availability}}', label: '可用性', value: '100%', sourceApi: '/api/provincial/overview', responseField: 'availability', fetchedAt: '' },
    ], '/api/provincial/overview'),
    tableDef('def_pm_04', 4, '二（一）月度关键指标总览', keyIndicatorColumns, [], '/api/provincial/key-indicators'),
    tableDef('def_pm_05', 5, '二（二）资源规模月度对比', resourceCompareColumns, [], '/api/provincial/resource-compare'),
    tableDef('def_pm_06', 6, '二（三）资源开通与回收情况', [
      col('category', '类别', 150, 'left'), col('vm', '云主机（台）', 130, 'right'), col('cpu', 'vCPU（核）', 130, 'right'), col('memory', '内存（GB）', 130, 'right'), col('storage', '存储（GB）', 140, 'right'), col('remark', '说明', 300, 'left'),
    ], [], '/api/provincial/resource-change'),
    tableDef('def_pm_07', 7, '二（四）CPU资源使用情况分析', [
      col('range', 'CPU月度平均使用率区间', 190, 'left'), col('systemCount', '系统数量', 120, 'right'), col('unitCount', '涉及厅局', 120, 'right'), col('analysis', '分析说明', 400, 'left'),
    ], [], '/api/provincial/cpu-usage'),
    tableDef('def_pm_08', 8, '二（五）内存资源使用情况分析', [
      col('range', '内存月度平均使用率区间', 190, 'left'), col('systemCount', '系统数量', 120, 'right'), col('unitCount', '涉及厅局', 120, 'right'), col('analysis', '分析说明', 400, 'left'),
    ], [], '/api/provincial/memory-usage'),
    tableDef('def_pm_09', 9, '三（一）运维工作量统计', opsStatsColumns, [], '/api/provincial/ops-workload'),
    richDef('def_pm_10', 10, '三（二）事件处置情况', '<h2>三、运行保障与运维服务</h2><p>本月调度处置事件169起，其中应用系统类事件109起为主要类型；监控预警48起，及时通知业务侧优化处理。</p>'),
    tableDef('def_pm_11', 11, '三（三）服务请求与资源申请工单', [
      col('type', '工单类型', 180, 'left'), col('count', '数量（件）', 120, 'right'), col('completed', '已完成', 120, 'right'), col('processing', '处理中', 120, 'right'), col('remark', '说明', 320, 'left'),
    ], [], '/api/provincial/workorders'),
    richDef('def_pm_12', 12, '三（四）巡检和资源优化', '<p>本月持续开展现场巡检和远程巡检，围绕节点稳定性、资源使用率和故障风险开展优化：完成8台物理节点风险排查，结合实际负载对2台计算节点实施内存扩容，对2台闲置服务器实施优化处置。</p>'),
    richDef('def_pm_13', 13, '四、重点业务系统保障情况', '<h2>四、重点业务系统保障情况</h2><p>围绕省数据局、省发展改革委、省能源局等重点业务系统，完成6个系统、277项资产专项核查，覆盖网络、安全、中间件、数据库和云资源情况。</p>'),
    richDef('def_pm_14', 14, '五、网络安全态势总览', '<h2>五、网络安全态势总览</h2><p>本月外部攻击累计2548.61万次，其中互联网侧2329.77万次、政务外网侧218.84万次，攻击总量环比下降52%。安全防护策略累计成功拦截2527.8万次，收敛形成有效安全告警22.2万次。</p>'),
    tableDef('def_pm_15', 15, '五（一）安全监测指标', [
      col('metric', '安全指标', 220, 'left', red), col('value', '本月数值', 150, 'right', red), col('status', '状态/环比', 150, 'center', red), col('remark', '说明', 330, 'left', red),
    ], [], '/api/security/monthly-stats', redTableStyle),
    tableDef('def_pm_16', 16, '五（二）受攻击较多的应用系统TOP5', attackTopColumns, [], '/api/security/attack-top5', redTableStyle),
    tableDef('def_pm_17', 17, '五（三）攻击来源分布', [
      col('area', '来源区域', 160, 'left', red), col('count', '攻击次数', 150, 'right', red), col('rank', '排名', 80, 'center', red), col('type', '来源类型', 120, 'center', red), col('remark', '说明', 260, 'left', red),
    ], [], '/api/security/attack-source', redTableStyle),
    tableDef('def_pm_18', 18, '五（四）安全监测与处置统计', securityStatsColumns, [], '/api/security/disposal-stats', redTableStyle),
    aiDef('def_pm_19', 19, '五（五）安全态势AI分析', '<p>根据本月攻击总量、拦截量、TOP5受攻击系统、境内外攻击来源分布，生成安全态势分析和整改建议。</p>', '分析2026年1月山西省政务云网络安全态势，并给出重点系统防护和整改建议。', '/api/ai/security-analysis'),
    richDef('def_pm_20', 20, '五（六）重要时期保障与演练', '<h2>五（六）重要时期保障与演练</h2><p>本月累计开展应急演练2次（平台类1次、安全类1次），覆盖云计算管理平台故障及云上业务系统遭受特洛伊木马攻击事件的典型场景。</p><p>1月19日至1月29日，围绕山西省人事考试中心重要考试报名工作，将省人社厅门户网站及省人事考试中心网站纳入专项保障范围，对11台云主机、4台负载设备开展持续监测，并按半小时频率向用户报送运行情况。</p>'),
    richDef('def_pm_21', 21, '六、网络运行与电子政务外网保障', '<h2>六、网络运行与电子政务外网保障</h2><p>本月非信创与信创资源区均保持移动、电信、联通三线出口稳定运行。为保障省人事考试中心考试报名等重点业务活动平稳开展，针对信创及非信创资源区提前实施出口带宽扩容，扩容规模提升至现有的2倍。</p>'),
    tableDef('def_pm_22', 22, '六（一）电子政务外网运行情况', [
      col('month', '月度', 90), col('events', '外网处置事件（故障）（起）', 200, 'right'), col('feature', '运行特征与要点', 480, 'left'),
    ], [], '/api/provincial/network-events'),
    richDef('def_pm_23', 23, '七、资产治理与监控纳管', '<h2>七、资产治理与监控纳管</h2><p>本月围绕省审批局、省发改委、退役军人事务厅相关业务系统开展专项资产梳理工作，重点聚焦6个业务系统，对其中涉及的云主机、拨测链接、中间件、数据库四大类资源进行全面摸排与分类统计，累计梳理资产277项。</p>'),
    richDef('def_pm_24', 24, '八、数据来源与统计口径说明', '<h2>八、数据来源与统计口径说明</h2><ol><li>数据来源：本报告统计数据主要来源于政务云平台监控与运维系统记录。</li><li>统计口径：攻击次数为安全监测平台统计的外部攻击总量；事件（故障）工单为监控派单与ITSM工单系统记录；资源规模为月末省级政务云平台资源池统计口径。</li></ol>'),
    tableDef('def_pm_25', 25, '附件1：省级政务云平台云资源开通交付详情', deliveryColumns, [], '/api/provincial/appendix-delivery'),
    tableDef('def_pm_26', 26, '附件2：省级政务云平台云资源开通交付周期', deliveryCycleColumns, [], '/api/provincial/appendix-delivery-cycle'),
    tableDef('def_pm_27', 27, '附件3：vCPU资源使用率较高的应用系统统计表', systemUsageColumns, [], '/api/provincial/appendix-cpu-high'),
    tableDef('def_pm_28', 28, '附件4：vCPU资源使用率较低的应用系统统计表', systemUsageColumns, [], '/api/provincial/appendix-cpu-low'),
    tableDef('def_pm_29', 29, '附件5：内存资源使用率较高的应用系统统计表', systemUsageColumns, [], '/api/provincial/appendix-memory-high'),
    tableDef('def_pm_30', 30, '附件6：内存资源使用率较低的应用系统统计表', systemUsageColumns, [], '/api/provincial/appendix-memory-low'),
    tableDef('def_pm_31', 31, '附件7：云主机风险预警工单', warningColumns, [], '/api/provincial/appendix-risk-warning'),
    tableDef('def_pm_32', 32, '附件8：运维工单实施情况', [
      col('no', '序号', 70), col('unit', '申请单位', 220, 'left'), col('system', '系统名称', 260, 'left'), col('type', '工单类型', 180, 'left'), col('status', '状态', 100), col('date', '时间', 120),
    ], [], '/api/provincial/appendix-workorders'),
    richDef('def_pm_33', 33, '附件8说明', '<p>PDF附件8为运维工单实施情况明细，共867件服务请求工单。页面数据保留了从PDF可识别出的代表性行、页内连续编号和“867件”总量口径，用于文档模块展示与编辑。</p>'),
    tableDef('def_pm_34', 34, '附件9：网络安全风险处置表', [
      col('no', '序号', 60, 'center', red), col('date', '时间', 120, 'center', red), col('system', '系统名称', 220, 'left', red), col('unit', '单位名称', 180, 'left', red), col('type', '风险类型', 120, 'center', red), col('result', '处置结果', 280, 'left', red), col('status', '处置状态', 110, 'center', red),
    ], [], '/api/security/risk-disposal', redTableStyle),
  ],
  createdAt: '2026-03-04T15:30:06Z',
  updatedAt: ts,
}

const provincialRows = {
  '二（一）月度关键指标总览': keyIndicatorRows,
  '二（二）资源规模月度对比': resourceCompareRows,
  '二（三）资源开通与回收情况': [
    row('change_1', ['category', 'vm', 'cpu', 'memory', 'storage', 'remark'], ['非信创资源区新开通', '18', '216', '792', '65,360', '本月新增资源']),
    row('change_2', ['category', 'vm', 'cpu', 'memory', 'storage', 'remark'], ['信创资源区新开通', '16', '204', '448', '10,728', '本月新增资源']),
    row('change_3', ['category', 'vm', 'cpu', 'memory', 'storage', 'remark'], ['资源回收', '7', '-', '-', '-', '按资源生命周期完成回收']),
    row('change_4', ['category', 'vm', 'cpu', 'memory', 'storage', 'remark'], ['新增开通合计', '34', '420', '1,240', '76,088', '1-3日完成27台，4-10日完成7台']),
  ],
  '二（四）CPU资源使用情况分析': [
    row('cpu_1', ['range', 'systemCount', 'unitCount', 'analysis'], ['高于50%', '5', '5', '主要集中于业务高峰和重点支撑职能系统，运行状态平稳。']),
    row('cpu_2', ['range', 'systemCount', 'unitCount', 'analysis'], ['低于30%', '494', '30', '占系统总量较大，后续可结合业务活跃度开展资源优化。']),
  ],
  '二（五）内存资源使用情况分析': [
    row('mem_1', ['range', 'systemCount', 'unitCount', 'analysis'], ['高于70%', '28', '约15', '内存资源占用相对集中，未发现明显异常。']),
    row('mem_2', ['range', 'systemCount', 'unitCount', 'analysis'], ['低于40%', '262', '20', '资源配置相对充裕，具备进一步优化内存资源配置空间。']),
  ],
  '三（一）运维工作量统计': [
    row('ops_1', ['month', 'events', 'requests', 'backupVm', 'backupFail', 'drill'], ['1月', '169', '867', '18,138', '1', '2']),
  ],
  '三（三）服务请求与资源申请工单': [
    row('wo_1', ['type', 'count', 'completed', 'processing', 'remark'], ['调度处置事件（故障）', '169', '169', '0', '形成监测、派单、处理、改进闭环']),
    row('wo_2', ['type', 'count', 'completed', 'processing', 'remark'], ['服务请求工单（含资源申请）', '867', '867', '0', '含资源开通、权限、VPN、平台运维等类型']),
  ],
  '五（一）安全监测指标': [
    row('sec_1', ['metric', 'value', 'status', 'remark'], ['外部攻击累计（万次）', '2548.61', '环比下降52%', '互联网侧2329.77万次、政务外网侧218.84万次']),
    row('sec_2', ['metric', 'value', 'status', 'remark'], ['成功拦截攻击（万次）', '2527.8', '已拦截', '安全防护策略累计拦截']),
    row('sec_3', ['metric', 'value', 'status', 'remark'], ['有效安全告警（万次）', '22.2', '已收敛', '形成可处置安全告警']),
    row('sec_4', ['metric', 'value', 'status', 'remark'], ['处置高危漏洞（个）', '8', '已闭环', '按要求完成整改闭环']),
    row('sec_5', ['metric', 'value', 'status', 'remark'], ['处置弱口令（个）', '2', '已闭环', '按要求完成整改闭环']),
    row('sec_6', ['metric', 'value', 'status', 'remark'], ['敏感信息泄漏风险（个）', '0', '无', '本月未发现敏感信息泄漏风险']),
  ],
  '五（二）受攻击较多的应用系统TOP5': [
    row('atk_1', ['rank', 'unit', 'system', 'count'], ['1', '山西省消防救援总队', '旧版消防监督管理系统', '4,269,255']),
    row('atk_2', ['rank', 'unit', 'system', 'count'], ['2', '山西省市场监督管理局', '山西省市场安全监管平台', '376,669']),
    row('atk_3', ['rank', 'unit', 'system', 'count'], ['3', '山西省交通运输厅', '山西省国省干线公路交通情况调查系统', '311,219']),
    row('atk_4', ['rank', 'unit', 'system', 'count'], ['4', '山西省自然资源厅', '山西省不动产登记网上“一窗受理”系统', '206,657']),
    row('atk_5', ['rank', 'unit', 'system', 'count'], ['5', '中共山西省委政法委员会', '山西长安网', '128,963']),
  ],
  '五（三）攻击来源分布': [
    row('src_1', ['area', 'count', 'rank', 'type', 'remark'], ['山西', '5,876,803', '1', '境内', '境内攻击主要来源']),
    row('src_2', ['area', 'count', 'rank', 'type', 'remark'], ['广州', '1,129,384', '2', '境内', '境内攻击来源']),
    row('src_3', ['area', 'count', 'rank', 'type', 'remark'], ['甘肃', '968,735', '3', '境内', '境内攻击来源']),
    row('src_4', ['area', 'count', 'rank', 'type', 'remark'], ['美国', '583,878', '1', '境外', '境外攻击主要来源']),
    row('src_5', ['area', 'count', 'rank', 'type', 'remark'], ['瑞典', '293,748', '2', '境外', '境外攻击来源']),
    row('src_6', ['area', 'count', 'rank', 'type', 'remark'], ['荷兰', '183,845', '3', '境外', '境外攻击来源']),
  ],
  '五（四）安全监测与处置统计': [
    row('security_disposal_1', ['month', 'attack', 'vulnerability', 'weakPassword', 'leak', 'remark'], ['1月', '2548.61', '8', '2', '0', '攻击次数为月度汇总值；漏洞、弱口令均已按要求完成处置闭环']),
  ],
  '六（一）电子政务外网运行情况': [
    row('network_1', ['month', 'events', 'feature'], ['1月', '3', '常态化监测与巡检，部分节点机房落地路由器中断，整体运行平稳。']),
  ],
  '附件1：省级政务云平台云资源开通交付详情': [
    row('delivery_1', deliveryColumns.map((item) => item.id), ['1', '山西省交通运输厅', '山西省交通运输厅行政审批和监察平台', '云主机', '互联网', '2', '32', '128', '200', '1600', '2.56', '15.22', '已确认']),
    row('delivery_2', deliveryColumns.map((item) => item.id), ['1', '山西省交通运输厅', '全国交通运输行政执法综合管理系统', '云主机', '政务外网', '2', '24', '48', '200', '1000', '1.52', '23.93', '已确认']),
    row('delivery_3', deliveryColumns.map((item) => item.id), ['1', '山西省交通运输厅', '山西省交通运输招标投标监督平台', '云主机', '互联网', '1', '4', '16', '100', '500', '4.51', '13.84', '已确认']),
    row('delivery_4', deliveryColumns.map((item) => item.id), ['1', '山西省交通运输厅', '山西省民航协调管理工作平台', '云主机', '互联网', '2', '24', '80', '200', '1524', '1.24', '11.23', '已确认']),
    row('delivery_5', deliveryColumns.map((item) => item.id), ['1', '山西省交通运输厅', '安全隐患排查治理循迹信息系统', '云主机', '互联网', '2', '16', '32', '80', '1524', '6.81', '62.97', '已确认']),
    row('delivery_6', deliveryColumns.map((item) => item.id), ['2', '山西省住房和城乡建设厅', '山西省智慧建筑管理服务信息平台', '云主机', '互联网', '0', '/', '/', '/', '4000', '9.75', '78.04', '已确认']),
    row('delivery_7', deliveryColumns.map((item) => item.id), ['2', '山西省住房和城乡建设厅', '山西省投资项目施工图数字化联合审查管理信息平台', '云主机', '互联网', '0', '/', '/', '/', '35000', '1.57', '17.45', '已确认']),
    row('delivery_8', deliveryColumns.map((item) => item.id), ['3', '山西省科学技术厅', '山西科技报告服务系统', '云主机', '互联网', '2', '32', '64', '200', '1600', '6.57', '60.09', '已确认']),
    row('delivery_9', deliveryColumns.map((item) => item.id), ['4', '山西省医疗保障局', '山西省医疗保障监管平台系统', '云主机', '政务外网', '8', '128', '416', '620', '5300', '1.05', '9.26', '已确认']),
    row('delivery_10', deliveryColumns.map((item) => item.id), ['4', '山西省医疗保障局', '山西省医疗保障核心业务系统', '云主机', '政务外网', '8', '56', '184', '440', '6200', '1.09', '4.28', '已确认']),
    row('delivery_11', deliveryColumns.map((item) => item.id), ['4', '山西省医疗保障局', '山西省医疗保障核心业务系统', '云主机', '政务生产', '0', '/', '/', '/', '12000', '1.59', '7.22', '已确认']),
    row('delivery_12', deliveryColumns.map((item) => item.id), ['5', '山西省司法厅', '公共法律服务平台-山西法律服务网（12348 山西法网）', '云主机', '政务外网', '0', '/', '64', '/', '/', '1.92', '61.60', '已确认']),
    row('delivery_13', deliveryColumns.map((item) => item.id), ['6', '山西省工商业联合会', '山西省“山西省网上工商联”信息化建设项目', '云主机', '互联网', '2', '8', '16', '200', '600', '1.62', '11.59', '已确认']),
    row('delivery_14', deliveryColumns.map((item) => item.id), ['6', '山西省工商业联合会', '山西省“山西省网上工商联”信息化建设项目', '云主机', '政务外网', '4', '80', '160', '400', '1600', '1.63', '13.41', '已确认']),
    row('delivery_15', deliveryColumns.map((item) => item.id), ['7', '山西省民营经济发展局', '山西省民营经济一站式综合服务平台', '云主机', '互联网', '0', '/', '/', '/', '400', '1.92', '34.44', '已确认']),
    row('delivery_16', deliveryColumns.map((item) => item.id), ['8', '山西省教育厅', '基础数据库信息系统', '云主机', '互联网', '1', '16', '32', '100', '500', '2.47', '22.31', '已确认']),
    row('delivery_total', deliveryColumns.map((item) => item.id), ['合计', '', '', '', '', '34', '420', '1240', '2740', '73348', '/', '/', '']),
  ],
  '附件2：省级政务云平台云资源开通交付周期': [
    row('cycle_1', ['cycle', 'type', 'quantity', 'cpu', 'memory', 'systemDisk', 'dataDisk'], ['1-3天', '云主机', '7', '88', '208', '580', '17548']),
    row('cycle_2', ['cycle', 'type', 'quantity', 'cpu', 'memory', 'systemDisk', 'dataDisk'], ['4-10天', '云主机', '27', '332', '968', '2160', '55800']),
    row('cycle_3', ['cycle', 'type', 'quantity', 'cpu', 'memory', 'systemDisk', 'dataDisk'], ['11-30天', '云主机', '0', '0', '0', '0', '0']),
    row('cycle_4', ['cycle', 'type', 'quantity', 'cpu', 'memory', 'systemDisk', 'dataDisk'], ['31-60天', '云主机', '0', '0', '0', '0', '0']),
    row('cycle_5', ['cycle', 'type', 'quantity', 'cpu', 'memory', 'systemDisk', 'dataDisk'], ['60天以上', '云主机', '0', '0', '0', '0', '0']),
  ],
  '附件3：vCPU资源使用率较高的应用系统统计表': [
    row('cpu_high_1', ['no', 'unit', 'system', 'usage'], ['1', '山西省交通运输厅', '山西省高速公路养护管理系统', '51.67']),
    row('cpu_high_2', ['no', 'unit', 'system', 'usage'], ['2', '山西省林业和草原局', '山西省森林和草原火灾风险普查系统', '51.38']),
    row('cpu_high_3', ['no', 'unit', 'system', 'usage'], ['3', '山西省民政厅', '舆情监测系统', '69.48']),
    row('cpu_high_4', ['no', 'unit', 'system', 'usage'], ['4', '山西省药品监督管理局', '山西省药品监督管理局传统中药制剂备案信息系统', '52.71']),
    row('cpu_high_5', ['no', 'unit', 'system', 'usage'], ['5', '山西省药品监督管理局', '食品药品审评（审批）数字化系统', '52.24']),
  ],
  '附件4：vCPU资源使用率较低的应用系统统计表': [
    row('cpu_low_1', ['no', 'unit', 'system', 'usage'], ['1', '共青团山西省委员会', '山西省青少年大数据平台', '4.89']),
    row('cpu_low_2', ['no', 'unit', 'system', 'usage'], ['2', '共青团山西省委员会', '网上共青团系统', '1.68']),
    row('cpu_low_3', ['no', 'unit', 'system', 'usage'], ['3', '九三学社山西省委员会', '九三学社山西省委员会网站', '4.05']),
    row('cpu_low_4', ['no', 'unit', 'system', 'usage'], ['4', '山西省财政厅', '地方政府性债务管理系统', '4.79']),
    row('cpu_low_5', ['no', 'unit', 'system', 'usage'], ['5', '山西省财政厅', '山西省本级非税收入收缴管理系统', '6.68']),
    row('cpu_low_6', ['no', 'unit', 'system', 'usage'], ['6', '山西省财政厅', '山西省财政票据电子化管理系统', '9.05']),
    row('cpu_low_7', ['no', 'unit', 'system', 'usage'], ['7', '山西省财政厅', '山西省公务差旅信息化管理平台', '3.19']),
    row('cpu_low_8', ['no', 'unit', 'system', 'usage'], ['8', '山西省财政厅', '山西省会计管理信息系统', '4.80']),
    row('cpu_low_9', ['no', 'unit', 'system', 'usage'], ['9', '山西省财政厅', '山西省惠民惠农财政补贴资金“一卡通”平台', '10.04']),
    row('cpu_low_10', ['no', 'unit', 'system', 'usage'], ['10', '山西省财政厅', '山西省金融企业监管信息系统', '2.12']),
    row('cpu_low_11', ['no', 'unit', 'system', 'usage'], ['11', '山西省财政厅', '山西省行政事业单位资产管理信息系统', '3.88']),
    row('cpu_low_12', ['no', 'unit', 'system', 'usage'], ['12', '山西省财政厅', '山西省预算管理一体化2.0系统', '11.50']),
    row('cpu_low_13', ['no', 'unit', 'system', 'usage'], ['13', '山西省财政厅', '山西省政务信息资源数据共享交换平台（外网）', '7.15']),
    row('cpu_low_14', ['no', 'unit', 'system', 'usage'], ['14', '山西省残疾人联合会', '全国残疾人按比例就业情况联网认证系统', '13.09']),
    row('cpu_low_15', ['no', 'unit', 'system', 'usage'], ['15', '山西省残疾人联合会', '山西省残疾儿童康复救助管理系统', '23.82']),
    row('cpu_low_16', ['no', 'unit', 'system', 'usage'], ['16', '山西省残疾人联合会', '山西省残疾人综合数据管理系统', '18.23']),
    row('cpu_low_17', ['no', 'unit', 'system', 'usage'], ['17', '山西省档案馆', '区域性数字档案馆应用平台', '7.16']),
    row('cpu_low_18', ['no', 'unit', 'system', 'usage'], ['18', '山西省地方金融监督管理局', '山西省地方金融组织监管监测信息系统', '14.58']),
    row('cpu_low_19', ['no', 'unit', 'system', 'usage'], ['19', '山西省地方金融监督管理局', '山西省非法集资监测预警大数据平台', '7.70']),
    row('cpu_low_20', ['no', 'unit', 'system', 'usage'], ['20', '山西省发展和改革委员会', '安全文件集中存储管理系统', '18.34']),
  ],
  '附件5：内存资源使用率较高的应用系统统计表': [
    row('mem_high_1', ['no', 'unit', 'system', 'usage'], ['1', '山西省残疾人联合会', '全国残疾人按比例就业情况联网认证系统', '77.57']),
    row('mem_high_2', ['no', 'unit', 'system', 'usage'], ['2', '山西省交通运输厅', '安全隐患排查治理循迹信息系统', '91.95']),
    row('mem_high_3', ['no', 'unit', 'system', 'usage'], ['3', '山西省交通运输厅', '山西省汽车维修电子健康档案系统', '79.92']),
    row('mem_high_4', ['no', 'unit', 'system', 'usage'], ['4', '山西省科学技术厅', '山西科技计划管理信息平台', '74.26']),
    row('mem_high_5', ['no', 'unit', 'system', 'usage'], ['5', '山西省科学技术协会', '山西省科协中国科普摄影大赛征稿系统', '73.61']),
    row('mem_high_6', ['no', 'unit', 'system', 'usage'], ['6', '山西省林业和草原局', '门户网站集约化平台', '73.23']),
    row('mem_high_7', ['no', 'unit', 'system', 'usage'], ['7', '山西省民营经济发展局', '门户网站集约化平台', '93.08']),
    row('mem_high_8', ['no', 'unit', 'system', 'usage'], ['8', '山西省民营经济发展局', '山西省中小企业公共服务平台', '78.02']),
    row('mem_high_9', ['no', 'unit', 'system', 'usage'], ['9', '山西省民政厅', '山西省金民工程大数据项目内部控制管理系统', '79.58']),
    row('mem_high_10', ['no', 'unit', 'system', 'usage'], ['10', '山西省民政厅', '舆情监测系统', '91.64']),
    row('mem_high_11', ['no', 'unit', 'system', 'usage'], ['11', '山西省农业农村厅', '山西省动物疫病预防控制中心兽医实验室信息管理系统', '92.92']),
    row('mem_high_12', ['no', 'unit', 'system', 'usage'], ['12', '山西省人力资源和社会保障厅', '社保基金财务报表系统', '70.63']),
  ],
  '附件6：内存资源使用率较低的应用系统统计表': [
    row('mem_low_1', ['no', 'unit', 'system', 'usage'], ['1', '共青团山西省委员会', '网上共青团系统', '35.01']),
    row('mem_low_2', ['no', 'unit', 'system', 'usage'], ['2', '山西省财政厅', '山西省财政票据电子化管理系统', '37.53']),
    row('mem_low_3', ['no', 'unit', 'system', 'usage'], ['3', '山西省财政厅', '山西省政务信息资源数据共享交换平台（外网）', '34.60']),
    row('mem_low_4', ['no', 'unit', 'system', 'usage'], ['4', '山西省地方金融监督管理局', '山西省地方金融组织监管监测信息系统', '39.24']),
    row('mem_low_5', ['no', 'unit', 'system', 'usage'], ['5', '山西省地方金融监督管理局', '山西省非法集资监测预警大数据平台', '21.48']),
    row('mem_low_6', ['no', 'unit', 'system', 'usage'], ['6', '山西省发展和改革委员会', '电子签章集约化平台', '32.31']),
    row('mem_low_7', ['no', 'unit', 'system', 'usage'], ['7', '山西省发展和改革委员会', '山西省价格综合信息化平台', '29.03']),
    row('mem_low_8', ['no', 'unit', 'system', 'usage'], ['8', '山西省发展和改革委员会', '山西省信用信息共享平台', '33.79']),
    row('mem_low_9', ['no', 'unit', 'system', 'usage'], ['9', '山西省发展和改革委员会', '项目库管理及大数据分析系统', '9.05']),
    row('mem_low_10', ['no', 'unit', 'system', 'usage'], ['10', '山西省发展和改革委员会', '协同办公集约化平台', '31.98']),
    row('mem_low_11', ['no', 'unit', 'system', 'usage'], ['11', '山西省妇女联合会', '半边天网系统', '28.21']),
    row('mem_low_12', ['no', 'unit', 'system', 'usage'], ['12', '山西省高级人民法院', '全省法院现代化诉讼服务信息化平台', '21.51']),
  ],
  '附件7：云主机风险预警工单': [
    row('warning_1', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['1', '山西省住房和城乡建设厅', '山西省房屋建筑和市政设施调查系统', '17.167.58.25', '重启', '/', '2026/1/20']),
    row('warning_2', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['2', '山西省人力资源和社会保障厅', '资格认证', '192.167.177.20', '重启', '/', '2026/1/20']),
    row('warning_3', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['3', '山西省人民政府办公厅', '领导驾驶舱', '192.168.105.75', '重启', '/', '2026/1/20']),
    row('warning_4', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['4', '山西省住房和城乡建设厅', '山西省房屋建筑和市政设施调查系统', '17.167.58.23', '重启', '/', '2026/1/20']),
    row('warning_5', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['5', '山西省卫生健康委员会', '免疫规划管理信息系统及产院规划管理信息系统', '192.168.153.40', '重启', '/', '2026/1/19']),
    row('warning_9', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['9', '山西转型综合改革示范区政务服务中心', '“数字综改”一体化建设项目（一期）综合执法平台', '22.167.86.48', '磁盘', '98.01', '2026/1/16']),
    row('warning_10', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['10', '山西省退役军人事务厅', '山西省退役军人信息化工程建设项目', '22.167.55.235', '磁盘', '97.8', '2026/1/16']),
    row('warning_11', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['11', '山西省药品监督管理局', '山西省药品监督管理局智慧监管项目', '22.168.100.43', '磁盘', '98.01', '2026/1/16']),
    row('warning_13', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['13', '山西省市场监督管理局', '山西省市场安全监管平台建设项目', '22.168.81.63', '磁盘', '98.9', '2026/1/16']),
    row('warning_17', ['no', 'unit', 'system', 'ip', 'type', 'usage', 'date'], ['17', '山西省自然资源厅', '山西省地理信息公共服务平台', '22.168.92.3', '磁盘', '98.62', '2026/1/16']),
  ],
  '附件8：运维工单实施情况': [
    row('wo_app_1', ['no', 'unit', 'system', 'type', 'status', 'date'], ['1', '山西省卫生健康委员会', '人事管理系统', '1-19 云平台事项服务', '已完成', '2025/12/22']),
    row('wo_app_2', ['no', 'unit', 'system', 'type', 'status', 'date'], ['2', '山西省人力资源和社会保障厅', '/', '1-19 云平台事项服务', '已完成', '2025/12/22']),
    row('wo_app_3', ['no', 'unit', 'system', 'type', 'status', 'date'], ['3', '山西省公安厅', '山西公安新一代移动警务网络平台', '1-06 业务系统安全扫描', '已完成', '2025/12/22']),
    row('wo_app_4', ['no', 'unit', 'system', 'type', 'status', 'date'], ['4', '山西省卫生健康委员会', '免疫规划预防接种信息系统', '1-08 虚拟机运维', '已完成', '2025/12/22']),
    row('wo_app_8', ['no', 'unit', 'system', 'type', 'status', 'date'], ['8', '山西省住房和城乡建设厅', '山西省房屋建筑和市政设施调查系统', '1-01 租户区域访问资源开通', '已完成', '2025/12/22']),
    row('wo_app_272', ['no', 'unit', 'system', 'type', 'status', 'date'], ['272', '山西省高级人民法院', '数字法院一体化-智慧法院', '1-02 公网政务外网访问权限', '已完成', '2025/12/29']),
    row('wo_app_285', ['no', 'unit', 'system', 'type', 'status', 'date'], ['285', '山西省自然资源厅', '天地图·山西', '1-07 VPN运维', '已完成', '2025/12/29']),
    row('wo_app_639', ['no', 'unit', 'system', 'type', 'status', 'date'], ['639', '山西省住房和城乡建设厅', '山西省智慧建筑管理服务信息平台', '1-08 虚拟机运维', '已完成', '2026/1/13']),
    row('wo_app_649', ['no', 'unit', 'system', 'type', 'status', 'date'], ['649', '中共山西省委机要局', '山西省13710工作制度平台', '1-02 公网政务外网访问权限', '已完成', '2026/1/13']),
    row('wo_app_653', ['no', 'unit', 'system', 'type', 'status', 'date'], ['653', '山西省市场监督管理局', '山西省食品监管信息化平台', '1-06 业务系统安全扫描', '已完成', '2026/1/14']),
    row('wo_app_825', ['no', 'unit', 'system', 'type', 'status', 'date'], ['825', '中共山西省委组织部', '党员管理信息系统', '1-07 VPN运维', '已完成', '2026/1/19']),
    row('wo_app_867', ['no', 'unit', 'system', 'type', 'status', 'date'], ['867', '山西省文化和旅游厅', '山西省文化和旅游相关系统', '1-07 VPN运维', '已完成', '2026/1/20']),
  ],
  '附件9：网络安全风险处置表': [
    row('risk_1', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['1', '2025/12/22', '山西省级城市运行管理服务平台信息化建设项目', '山西省住房和城乡建设厅', 'web漏洞', '修改配置项以修复未授权访问漏洞', '已完成整改']),
    row('risk_2', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['2', '2026/1/8', '云主机', '山西省教育厅', 'web漏洞', '对主机进行全面杀毒', '已完成整改']),
    row('risk_3', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['3', '2026/1/8', '新生儿一件事一次办系统', '山西省行政审批服务管理局', 'web漏洞', '建议对该系统开展全面审查，并进行暂时下架处理', '已完成整改']),
    row('risk_4', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['4', '2026/1/10', '山西政务服务网', '山西省行政审批服务管理局', '弱口令', '修改密码，修改为高强度密码以修复弱口令漏洞', '已完成整改']),
    row('risk_5', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['5', '2026/1/15', '山西省人社一体化公共服务平台', '山西省人力资源和社会保障厅', '弱口令', '修改配置项、修改密码以修复未授权访问及弱口令漏洞', '已完成整改']),
    row('risk_6', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['6', '2026/1/15', '投资项目在线审批监管平台', '山西省发展和改革委员会', 'web漏洞', '修改配置项以修复未授权访问漏洞', '已完成整改']),
    row('risk_7', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['7', '2026/1/15', '刑事执行平台-疑似存在MongoDB未授权访问', '山西省司法厅', 'web漏洞', '修改配置项以修复未授权访问漏洞', '已完成整改']),
    row('risk_8', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['8', '2026/1/18', '山西12316微信服务平台网站', '山西省农业农村厅', 'web漏洞', '建议对该网站开展全面审查，并进行暂时下架处理', '已完成整改']),
    row('risk_9', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['9', '2026/1/20', '山西省人事考试系统', '山西省人力资源和社会保障厅', 'web漏洞', '对主机进行全面杀毒', '已完成整改']),
    row('risk_10', ['no', 'date', 'system', 'unit', 'type', 'result', 'status'], ['10', '2026/1/20', '云主机', '山西省人力资源和社会保障厅', 'web漏洞', '对主机进行全面杀毒', '已完成整改']),
  ],
  '附录1：CPU低负载系统明细摘录': [
    row('cpu_app_132', ['no', 'unit', 'system', 'usage'], ['132', '山西省农业农村厅', '山西省精准扶贫数字化档案管理平台', '27.30']),
    row('cpu_app_133', ['no', 'unit', 'system', 'usage'], ['133', '山西省农业农村厅', '山西省农产品质量安全追溯信息平台', '8.67']),
    row('cpu_app_134', ['no', 'unit', 'system', 'usage'], ['134', '山西省农业农村厅', '山西省农村土地承包业务管理系统', '1.47']),
    row('cpu_app_149', ['no', 'unit', 'system', 'usage'], ['149', '山西省人力资源和社会保障厅', '安全文件集中存储管理系统', '8.45']),
    row('cpu_app_158', ['no', 'unit', 'system', 'usage'], ['158', '山西省人力资源和社会保障厅', '民生山西 app', '8.93']),
  ],
  '附录2：内存低负载系统明细摘录': [
    row('mem_app_226', ['no', 'unit', 'system', 'usage'], ['226', '山西省农业农村厅', '山西省农业信息资源数据共享交换平台', '37.15']),
    row('mem_app_228', ['no', 'unit', 'system', 'usage'], ['228', '山西省药品监督管理局', '山西省化妆品省级监管系统', '36.44']),
    row('mem_app_229', ['no', 'unit', 'system', 'usage'], ['229', '山西省医疗保障局', '山西省医疗保障基础平台系统', '36.16']),
    row('mem_app_240', ['no', 'unit', 'system', 'usage'], ['240', '山西省自然资源厅', '标准地图服务系统', '37.42']),
    row('mem_app_250', ['no', 'unit', 'system', 'usage'], ['250', '中共山西省委机要局', '山西省13710督办移动平台', '37.30']),
  ],
  '附录3：服务请求工单明细摘录': [
    row('wo_app_272', ['no', 'unit', 'system', 'type', 'status', 'date'], ['272', '山西省高级人民法院', '数字法院一体化相关系统', '1-02 网络策略及权限', '已完成', '2025/12/29']),
    row('wo_app_274', ['no', 'unit', 'system', 'type', 'status', 'date'], ['274', '山西省生态环境厅', '平台服务支持', '1-19 平台服务支持', '已完成', '2025/12/29']),
    row('wo_app_285', ['no', 'unit', 'system', 'type', 'status', 'date'], ['285', '山西省自然资源厅', '地图相关系统', '1-07 VPN运维', '已完成', '2025/12/29']),
    row('wo_app_639', ['no', 'unit', 'system', 'type', 'status', 'date'], ['639', '山西省住房和城乡建设厅', '山西省智慧建筑管理信息平台', '1-08 基础运维', '已完成', '2026/1/13']),
    row('wo_app_649', ['no', 'unit', 'system', 'type', 'status', 'date'], ['649', '中共山西省委机要局', '山西省13710督办移动平台', '1-02 网络策略及权限', '已完成', '2026/1/13']),
    row('wo_app_653', ['no', 'unit', 'system', 'type', 'status', 'date'], ['653', '山西省市场监督管理局', '山西省食品安全信息平台', '1-06 业务系统安全扫描', '已完成', '2026/1/14']),
  ],
}

export const provincialReportDoc = {
  id: 'doc_provincial_monthly_202601',
  title: '山西省政务云月度运行报告（2026年1月）',
  templateId: provincialReportTemplate.id,
  blocks: provincialReportTemplate.blockDefinitions.map((definition) => {
    if (definition.type === 'table') {
      return blockFromDef(definition, `blk_${definition.id.replace('def_', '')}`, {
        ...definition.defaultContent,
        rows: provincialRows[definition.label] || definition.defaultContent.rows,
      })
    }
    return blockFromDef(definition, `blk_${definition.id.replace('def_', '')}`)
  }),
  createdAt: '2026-03-04T15:30:06Z',
  updatedAt: ts,
  createdBy: '山西云时代技术有限公司',
  metadata: { source: 'PDF重新识别', sourceFile: '山西省政务云月度运行报告（2026年1月）.pdf', pageCount: 94 },
}

export const documentVersions = new Map([
  ['blk_pm_03', [{ id: 'ver_pm_overview_1', blockId: 'blk_pm_03', version: 1, timestamp: ts, editedBy: 'system', changeType: 'create', changes: [], snapshot: '{}' }]],
  ['blk_pm_15', [{ id: 'ver_pm_security_1', blockId: 'blk_pm_15', version: 1, timestamp: ts, editedBy: 'system', changeType: 'data_refresh', changes: [], snapshot: '{}' }]],
])

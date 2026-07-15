# 企知云全页面 Dify 式重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变真实接口、权限和工作区隔离逻辑的前提下，将登录入口、工作区选择、个人区、企业区和知识图谱统一重构为 Dify 式企业知识产品界面。

**Architecture:** 保留 `App.tsx` 和 `WorkspaceShell.tsx` 的会话、接口调用与工作区状态职责，将视觉外壳、公共控件和页面内容拆到 `ui/`、`layout/`、`personal/`、`enterprise/` 与 `graph/` 目录。个人和企业页面只共享无状态视觉组件，不共享业务数据；所有 API 继续从当前 `workspace.id` 发起。

**Tech Stack:** React、TypeScript、Vite、Lucide React、Three.js、现有 FastAPI 接口、临时 Playwright 视觉检查脚本。

## Global Constraints

- 页面背景固定为 `#F9FAFB`，一级内容面为 `#FFFFFF`，次级背景为 `#F2F4F7`。
- 主操作色为 `#155EEF`，主文字为 `#101828`，默认边框为 `#E4E7EC`。
- 普通控件圆角 `6px`，内容容器圆角 `8px`，大型独立区域不超过 `10px`。
- 顶部主导航高度 `64px`；按钮高度 `36px` 或 `40px`；图标按钮固定 `36 × 36px`。
- 登录、注册、工作区选择、文档、知识库、问答、设置、图谱、成员和审计功能必须继续调用真实接口。
- 所有工作区接口继续使用当前 `workspace.id`；不新增个人与企业之间的同步、复制、导入或共享入口。
- 个人工作区不显示成员与企业审计；企业工作区不读取个人工作区数据。
- 删除文档、工作区、问答、成员和审计日志必须二次确认。
- 测试脚本写入系统临时目录，不能加入 Git 暂存区或上传 GitHub。
- 不提交 `.env`、数据库、上传文件、日志、模型、账号、密码、API Key 或 Token。

---

## 文件结构

计划新增或重组以下前端文件：

```text
frontend/src/
  styles/
    tokens.css                 # Dify 式颜色、字号、间距、圆角和层级
    base.css                   # reset、排版、滚动条和响应式基础
    components.css             # 公共控件、表格、弹窗、抽屉和状态
    pages.css                  # 入口、工作台、知识库、问答、设置等布局
    graph.css                  # 2D/3D 图谱视口与控制面板
  components/
    ui/
      Button.tsx
      IconButton.tsx
      StatusBadge.tsx
      PageHeader.tsx
      ContextSidebar.tsx
      DataTable.tsx
      FormControls.tsx
      AsyncState.tsx
      Overlay.tsx
      Toast.tsx
      KnowledgeSelector.tsx
      ChatComposer.tsx
      CitationPanel.tsx
    layout/
      AppHeader.tsx
      WorkspaceLayout.tsx
    personal/
      PersonalHome.tsx
      PersonalDocuments.tsx
      PersonalKnowledge.tsx
      PersonalChat.tsx
      PersonalSettings.tsx
      PersonalAdvanced.tsx
    enterprise/
      EnterpriseHome.tsx
      EnterpriseDocuments.tsx
      EnterpriseKnowledge.tsx
      EnterpriseChat.tsx
      EnterpriseSettings.tsx
      EnterpriseAdvanced.tsx
      EnterpriseMembers.tsx
      EnterpriseAudit.tsx
    graph/
      GraphToolbar.tsx
      GraphFilterDrawer.tsx
      GraphInspectorDrawer.tsx
```

保留并修改：

```text
frontend/src/App.tsx
frontend/src/styles.css
frontend/src/components/AuthForms.tsx
frontend/src/components/WorkspaceSelection.tsx
frontend/src/components/WorkspaceShell.tsx
frontend/src/components/PersonalWorkspace.tsx
frontend/src/components/EnterpriseWorkspace.tsx
frontend/src/components/KnowledgeGraphExplorer.tsx
frontend/src/components/KnowledgeGraph3D.tsx
```

`styles.css` 只负责导入拆分后的样式文件，避免继续增长为单一超大文件。

---

### Task 1: 建立 Dify 式设计令牌和公共组件

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/base.css`
- Create: `frontend/src/styles/components.css`
- Create: `frontend/src/styles/pages.css`
- Create: `frontend/src/styles/graph.css`
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/IconButton.tsx`
- Create: `frontend/src/components/ui/StatusBadge.tsx`
- Create: `frontend/src/components/ui/PageHeader.tsx`
- Create: `frontend/src/components/ui/ContextSidebar.tsx`
- Create: `frontend/src/components/ui/DataTable.tsx`
- Create: `frontend/src/components/ui/FormControls.tsx`
- Create: `frontend/src/components/ui/AsyncState.tsx`
- Create: `frontend/src/components/ui/Overlay.tsx`
- Create: `frontend/src/components/ui/Toast.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces: `Button`, `IconButton`, `StatusBadge`, `PageHeader`, `ContextSidebar`, `DataTable`, `SegmentedControl`, `SearchInput`, `SelectField`, `EmptyState`, `ErrorState`, `LoadingState`, `PermissionDenied`, `ConfirmDialog`, `Drawer`, `Modal`, `ToastRegion`。
- Consumes: Lucide `LucideIcon` 类型和 React 标准 HTML 属性。

- [ ] **Step 1: 写入临时设计令牌契约测试**

在 PowerShell 中创建系统临时测试，不写入项目目录：

```powershell
$test = Join-Path $env:TEMP 'qizhiyun-ui-token-contract.ps1'
@'
$tokens = Get-Content 'frontend/src/styles/tokens.css' -Raw -ErrorAction SilentlyContinue
if ($tokens -notmatch '--page-bg:\s*#f9fafb') { throw '缺少 Dify 页面背景令牌' }
if ($tokens -notmatch '--primary:\s*#155eef') { throw '缺少 Dify 主操作色令牌' }
if ($tokens -notmatch '--radius-md:\s*8px') { throw '缺少 8px 内容圆角令牌' }
if (-not (Test-Path 'frontend/src/components/ui/Button.tsx')) { throw '缺少 Button 组件' }
if (-not (Test-Path 'frontend/src/components/ui/Overlay.tsx')) { throw '缺少 Overlay 组件' }
'@ | Set-Content $test -Encoding UTF8
& $test
```

Expected: FAIL，提示缺少 `tokens.css` 或公共组件。

- [ ] **Step 2: 创建完整设计令牌**

`frontend/src/styles/tokens.css` 至少包含以下固定令牌：

```css
:root {
  --page-bg: #f9fafb;
  --surface: #ffffff;
  --surface-subtle: #f2f4f7;
  --text-primary: #101828;
  --text-secondary: #344054;
  --text-muted: #667085;
  --text-subtle: #98a2b3;
  --border: #e4e7ec;
  --border-strong: #d0d5dd;
  --primary: #155eef;
  --primary-hover: #004eeb;
  --success: #12b76a;
  --warning: #f79009;
  --danger: #d92d20;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --header-height: 64px;
  --control-height: 40px;
  --shadow-popover: 0 12px 32px rgba(16, 24, 40, 0.14);
}
```

`base.css` 设置页面背景、字体、字距、滚动条、焦点轮廓和按钮 reset；`components.css` 使用这些令牌实现按钮、输入框、状态标签、表格、弹窗、抽屉和 Toast。

- [ ] **Step 3: 实现类型安全的公共控件**

`Button.tsx` 使用如下公开接口：

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading, children, ...props }: ButtonProps) {
  return (
    <button className={`ui-button ${variant} ${size}`} disabled={loading || props.disabled} {...props}>
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span>{loading ? '处理中' : children}</span>
    </button>
  );
}
```

`Overlay.tsx` 导出：

```ts
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}
```

`ContextSidebar` 和 `DataTable` 的公开接口固定为：

```ts
export interface ContextSidebarItem {
  key: string;
  label: string;
  count?: number;
}

export interface ContextSidebarProps {
  title: string;
  items: ContextSidebarItem[];
  activeKey: string;
  open: boolean;
  onSelect: (key: string) => void;
  onClose: () => void;
}

export interface DataTableColumn<Row> {
  key: string;
  label: string;
  width?: string;
  render: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  loading?: boolean;
  emptyText: string;
}
```

`FormControls.tsx` 导出 `SegmentedControl<Value extends string>`、`SearchInput` 和 `SelectField`。`SegmentedControl` 接收 `value`、`options: Array<{ value; label }>` 和 `onChange(value)`，认证方式、图谱 2D/3D 和设置页签必须复用它。

`StatusBadge` 将 `uploaded`、`parsing`、`parsed`、`indexing`、`indexed`、`failed`、`disabled` 映射为中文状态和语义色，不能由页面重复实现。

- [ ] **Step 4: 改造样式入口并运行契约测试**

`frontend/src/styles.css` 仅保留：

```css
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/components.css';
@import './styles/pages.css';
@import './styles/graph.css';
```

`pages.css` 和 `graph.css` 在本任务先写入页面根容器和图谱画布的基础令牌，后续任务只追加页面规则。再次运行：

```powershell
& (Join-Path $env:TEMP 'qizhiyun-ui-token-contract.ps1')
npm --prefix frontend run build
```

Expected: 契约测试退出码 0，`tsc && vite build` 成功。

- [ ] **Step 5: 提交公共设计系统**

```powershell
git add frontend/src/styles.css frontend/src/styles frontend/src/components/ui
git commit -m "feat: 建立 Dify 式前端设计系统"
```

---

### Task 2: 重构顶部导航、登录入口和工作区选择

**Files:**
- Create: `frontend/src/components/layout/AppHeader.tsx`
- Create: `frontend/src/components/layout/WorkspaceLayout.tsx`
- Modify: `frontend/src/components/AuthForms.tsx`
- Modify: `frontend/src/components/WorkspaceSelection.tsx`
- Modify: `frontend/src/components/WorkspaceShell.tsx`
- Modify: `frontend/src/styles/pages.css`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `User`、`Workspace`、现有登录/注册/验证码/重置密码回调。
- Produces: `AppHeaderProps`、`WorkspaceLayoutProps`，供个人与企业页面共用。

- [ ] **Step 1: 写入临时入口页浏览器检查**

将以下脚本写到 `$env:TEMP/qizhiyun-entry-smoke.mjs`：

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
await page.goto('http://127.0.0.1:9521', { waitUntil: 'networkidle' });
if (await page.locator('.sidebar').count()) throw new Error('登录页不应显示旧侧边栏');
if (!(await page.locator('[data-ui="auth-card"]').isVisible())) throw new Error('缺少 Dify 式登录表单');
const bg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
if (bg !== 'rgb(249, 250, 251)') throw new Error(`页面背景错误: ${bg}`);
await page.screenshot({ path: process.env.TEMP + '/qizhiyun-auth-1440.png' });
await browser.close();
```

Expected: 首次运行 FAIL，缺少 `data-ui="auth-card"` 或背景不正确。

- [ ] **Step 2: 实现统一顶部导航**

`AppHeader` 公开接口固定为：

```ts
export interface AppHeaderProps {
  user: User;
  workspace: Workspace;
  activePage: string;
  items: Array<{ key: string; label: string; icon: LucideIcon }>;
  onNavigate: (key: string) => void;
  onSwitchWorkspace: () => void;
  onLogout: () => void;
}

export interface WorkspaceLayoutProps {
  header: ReactNode;
  sidebar?: ReactNode;
  sidebarOpen?: boolean;
  children: ReactNode;
}
```

导航规则：个人区只含工作台、知识库、智能问答、知识图谱、个人设置；企业区额外显示成员与权限、审计。工作区名称放在 Logo 右侧，不再使用整页深色固定侧栏。

- [ ] **Step 3: 重构认证页面**

保留 `AuthForms` 原有 props 和所有提交回调，只替换 DOM 结构：

```tsx
<main className="auth-page-dify">
  <section className="auth-card" data-ui="auth-card">
    <header className="auth-brand">
      <div className="auth-brand-mark" aria-hidden="true">企</div>
      <h1>登录企知云</h1>
      <p>进入你的个人或企业知识工作区</p>
    </header>
    <SegmentedControl
      value={mode}
      options={[{ value: 'login', label: '登录' }, { value: 'register', label: '注册' }]}
      onChange={onModeChange}
    />
    <div className="auth-form-fields">
      {mode === 'login' ? loginPanel : registerPanel}
    </div>
  </section>
</main>
```

`loginPanel` 和 `registerPanel` 只把当前文件已经存在的登录字段组与注册字段组赋值给局部 JSX 常量，不改变原字段、校验、验证码计时器或提交函数。

密码/验证码方式使用分段控件；忘记密码在相同容器内切换；密码可见按钮继续使用 `Eye`/`EyeOff`；错误显示在字段下方或紧凑提示条。

- [ ] **Step 4: 重构工作区选择页**

保持 `WorkspaceSelection` 的真实创建、进入、删除回调。工作区条目公开展示名称、类型、角色、最近更新时间，删除入口放入更多菜单并调用公共 `ConfirmDialog`。个人工作区不存在时才显示“创建个人空间”。

- [ ] **Step 5: 接入 `WorkspaceShell` 并验证入口**

启动：

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1 --port 9521
```

另一个终端运行：

```powershell
$env:NODE_PATH='C:\Users\12587\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules;C:\Users\12587\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules'
node (Join-Path $env:TEMP 'qizhiyun-entry-smoke.mjs')
npm --prefix frontend run build
```

Expected: 登录页检查通过，前端构建通过。

- [ ] **Step 6: 提交入口和全局外壳**

```powershell
git add frontend/src/App.tsx frontend/src/components/AuthForms.tsx frontend/src/components/WorkspaceSelection.tsx frontend/src/components/WorkspaceShell.tsx frontend/src/components/layout frontend/src/styles/pages.css
git commit -m "feat: 重构 Dify 式入口与工作区外壳"
```

---

### Task 3: 拆分并重构个人工作区六个页面

**Files:**
- Create: `frontend/src/components/personal/PersonalHome.tsx`
- Create: `frontend/src/components/personal/PersonalDocuments.tsx`
- Create: `frontend/src/components/personal/PersonalKnowledge.tsx`
- Create: `frontend/src/components/personal/PersonalChat.tsx`
- Create: `frontend/src/components/personal/PersonalSettings.tsx`
- Create: `frontend/src/components/personal/PersonalAdvanced.tsx`
- Create: `frontend/src/components/ui/KnowledgeSelector.tsx`
- Create: `frontend/src/components/ui/ChatComposer.tsx`
- Create: `frontend/src/components/ui/CitationPanel.tsx`
- Modify: `frontend/src/components/PersonalWorkspace.tsx`
- Modify: `frontend/src/styles/pages.css`

**Interfaces:**
- Consumes: 当前 `PersonalWorkspacePanelProps` 的字段和回调，不新增 API。
- Produces: 六个页面组件和无状态 `KnowledgeSelector`、`ChatComposer`、`CitationPanel`；`PersonalWorkspace.tsx` 只负责按 `activePage` 分派 props。

- [ ] **Step 1: 写入个人区源代码边界测试**

```powershell
$test = Join-Path $env:TEMP 'qizhiyun-personal-page-contract.ps1'
@'
$files = 'PersonalHome','PersonalDocuments','PersonalKnowledge','PersonalChat','PersonalSettings','PersonalAdvanced'
foreach ($name in $files) {
  $path = "frontend/src/components/personal/$name.tsx"
  if (-not (Test-Path $path)) { throw "缺少 $path" }
}
$router = Get-Content 'frontend/src/components/PersonalWorkspace.tsx' -Raw
if ($router.Length -gt 22000) { throw 'PersonalWorkspace 仍承担过多页面实现' }
if ($router -match 'EnterpriseMembers|EnterpriseAudit') { throw '个人区出现企业功能' }
'@ | Set-Content $test -Encoding UTF8
& $test
```

Expected: FAIL，六个页面组件尚未创建。

- [ ] **Step 2: 实现个人首页和文档管理**

`PersonalHome` 使用 Dify 式工作台：隔离说明、问答主入口、知识库健康度、连续统计带、最近知识库和最近动态。所有数值从现有 `documents`、`knowledgeBase`、`chatMessages` 和 `notifications` 推导，无数据时显示 0 或空状态。

`PersonalDocuments` 保留多文件上传、重新解析、详情、批量选择和删除回调。表格列固定为：选择、文件、解析状态、入库状态、片段数、更新时间、操作。详情通过公共 `Drawer` 打开。

- [ ] **Step 3: 实现个人知识库和智能问答**

`PersonalKnowledge` 使用二级侧栏和表格，筛选状态维护在页面本地：

```ts
interface KnowledgeFilters {
  query: string;
  status: 'all' | 'ready' | 'processing' | 'failed';
  uploader: string;
}

const EMPTY_FILTERS: KnowledgeFilters = { query: '', status: 'all', uploader: '' };
```

“重置”必须执行 `setFilters(EMPTY_FILTERS)` 并调用现有 `onClearSearch()`。打开库后提供全文、片段、检索测试和索引设置页签。

`PersonalChat` 使用三栏结构；知识库标签调用 `onSelectedKnowledgeDocumentIdsChange`；普通对话通过 `onUseKnowledgeBaseForChatChange(false)`；RAG 引用只展示消息真实 `sources`。

三个共享问答组件接口固定为：

```ts
export interface KnowledgeSelectorProps {
  documents: DocumentRecord[];
  selectedIds: string[];
  disabled?: boolean;
  onChange: (documentIds: string[]) => void;
}

export interface ChatComposerProps {
  value: string;
  loading: boolean;
  disabled?: boolean;
  useKnowledgeBase: boolean;
  modelName: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export interface CitationPanelProps {
  sources: KnowledgeChunk[];
  emptyMessage: string;
  onOpenSource: (source: KnowledgeChunk) => void;
}
```

- [ ] **Step 4: 实现个人设置和高级驾驶舱**

`PersonalSettings` 二级导航固定为基础信息、模型配置、向量检索、存储配置、安全隔离。真实保存继续调用 `onSaveWorkspaceSetting`，真实连接测试继续调用 `onTestWorkspaceModelConnection`。

`PersonalAdvanced` 采用浅色统计带和列表，知识图谱入口复用现有 `KnowledgeGraphExplorer`，不得出现成员数量、企业权限或企业审计。

- [ ] **Step 5: 运行个人区契约、构建和真实隔离检查**

```powershell
& (Join-Path $env:TEMP 'qizhiyun-personal-page-contract.ps1')
npm --prefix frontend run build
$env:PYTHONPATH='backend'
& 'L:\anaconda\python.exe' -m pytest backend/tests/test_workspace_deletion_service.py backend/tests/test_document_upload_service.py backend/tests/test_rag_chat_service.py -q
```

Expected: 前端构建成功；指定后端测试全部通过；个人页面不包含企业菜单。

- [ ] **Step 6: 提交个人工作区重构**

```powershell
git add frontend/src/components/PersonalWorkspace.tsx frontend/src/components/personal frontend/src/styles/pages.css
git commit -m "feat: 重构 Dify 式个人知识工作台"
```

---

### Task 4: 拆分并重构企业工作区八个页面

**Files:**
- Create: `frontend/src/components/enterprise/EnterpriseHome.tsx`
- Create: `frontend/src/components/enterprise/EnterpriseDocuments.tsx`
- Create: `frontend/src/components/enterprise/EnterpriseKnowledge.tsx`
- Create: `frontend/src/components/enterprise/EnterpriseChat.tsx`
- Create: `frontend/src/components/enterprise/EnterpriseSettings.tsx`
- Create: `frontend/src/components/enterprise/EnterpriseAdvanced.tsx`
- Create: `frontend/src/components/enterprise/EnterpriseMembers.tsx`
- Create: `frontend/src/components/enterprise/EnterpriseAudit.tsx`
- Modify: `frontend/src/components/EnterpriseWorkspace.tsx`
- Modify: `frontend/src/styles/pages.css`

**Interfaces:**
- Consumes: 当前 `EnterpriseWorkspacePanelProps` 的真实数据、权限布尔值和回调。
- Produces: 八个企业页面组件；不修改成员、审计或设置 API 契约。

- [ ] **Step 1: 写入企业区页面和权限契约测试**

```powershell
$test = Join-Path $env:TEMP 'qizhiyun-enterprise-page-contract.ps1'
@'
$files = 'EnterpriseHome','EnterpriseDocuments','EnterpriseKnowledge','EnterpriseChat','EnterpriseSettings','EnterpriseAdvanced','EnterpriseMembers','EnterpriseAudit'
foreach ($name in $files) {
  $path = "frontend/src/components/enterprise/$name.tsx"
  if (-not (Test-Path $path)) { throw "缺少 $path" }
}
$members = Get-Content 'frontend/src/components/enterprise/EnterpriseMembers.tsx' -Raw
if ($members -notmatch 'canManageMembers') { throw '成员页未检查管理权限' }
$audit = Get-Content 'frontend/src/components/enterprise/EnterpriseAudit.tsx' -Raw
if ($audit -notmatch 'onDeleteAllAuditLogs') { throw '审计页缺少批量删除真实回调' }
'@ | Set-Content $test -Encoding UTF8
& $test
```

Expected: FAIL，企业页面组件尚未创建。

- [ ] **Step 2: 实现企业首页、文档和知识库**

企业首页与个人首页共享视觉结构，不共享数据。最近动态来自企业 `auditLogs` 或 `notifications`，首页只保留一个动态模块并链接审计页。

企业文档和知识库继续显示上传人、权限和企业隔离范围。批量删除使用 `onDeleteDocuments`；重新解析使用 `onReprocessDocument`；全文使用 `onLoadDocumentContent`；筛选和重置行为与个人区一致。

- [ ] **Step 3: 实现企业问答和设置**

企业问答使用会话历史、中间回答和右侧引用三栏。回答来源只来自当前消息 `sources`，没有来源时显示“本次回答未返回引用来源”。模型名称使用 `activeChatModelName`，不得显示未实际生效的模型。

企业设置二级导航为基础信息、模型 API、权限策略、存储配置、安全隔离。API Key 输入使用 `type="password"`，不把明文写入 `localStorage`、URL、Toast 或日志。

- [ ] **Step 4: 实现成员、审计和高级驾驶舱**

`EnterpriseMembers` 在 `canManageMembers === false` 时渲染 `PermissionDenied`；管理员界面使用真实 `onAddMember`、`onUpdateRole`、`onUpdateDepartment` 和 `onRemoveMember`。

`EnterpriseAudit` 使用北京时间 `formatBeijingDateTime`，并接入：

```ts
onDeleteAuditLog(log)
onDeleteAllAuditLogs()
onDeleteAuditLogsByRetention(retentionDays)
```

三类删除都调用公共 `ConfirmDialog`。高级驾驶舱只显示企业知识资产、问答、动态和图谱，不展示部署状态或工具中心。

- [ ] **Step 5: 运行企业契约、构建和权限测试**

```powershell
& (Join-Path $env:TEMP 'qizhiyun-enterprise-page-contract.ps1')
npm --prefix frontend run build
$env:PYTHONPATH='backend'
& 'L:\anaconda\python.exe' -m pytest backend/tests/test_enterprise_collaboration.py backend/tests/test_v5_advanced_modules.py backend/tests/test_workspace_model_settings.py -q
```

Expected: 前端构建成功；企业协作、V5 高级模块和模型设置测试全部通过。

- [ ] **Step 6: 提交企业工作区重构**

```powershell
git add frontend/src/components/EnterpriseWorkspace.tsx frontend/src/components/enterprise frontend/src/styles/pages.css
git commit -m "feat: 重构 Dify 式企业知识工作台"
```

---

### Task 5: 重构 2D/3D 知识图谱工作台

**Files:**
- Create: `frontend/src/components/graph/GraphToolbar.tsx`
- Create: `frontend/src/components/graph/GraphFilterDrawer.tsx`
- Create: `frontend/src/components/graph/GraphInspectorDrawer.tsx`
- Modify: `frontend/src/components/KnowledgeGraphExplorer.tsx`
- Modify: `frontend/src/components/KnowledgeGraph3D.tsx`
- Modify: `frontend/src/styles/graph.css`

**Interfaces:**
- Consumes: 现有 `KnowledgeGraphExplorerProps`、`KnowledgeGraph`、`KnowledgeGraphNode` 和图谱 API 回调。
- Produces: 默认浅色 2D 画布、限定视口的 3D 模式、可隐藏且可调宽度的筛选/详情抽屉。

- [ ] **Step 1: 写入图谱结构契约测试**

```powershell
$test = Join-Path $env:TEMP 'qizhiyun-graph-contract.ps1'
@'
$explorer = Get-Content 'frontend/src/components/KnowledgeGraphExplorer.tsx' -Raw
if ($explorer -notmatch 'GraphToolbar') { throw '图谱未使用统一工具栏' }
if ($explorer -notmatch 'GraphInspectorDrawer') { throw '图谱未使用详情抽屉' }
$css = Get-Content 'frontend/src/styles/graph.css' -Raw
if ($css -notmatch '--graph-canvas:\s*#f9fafb') { throw '2D 图谱未使用 Dify 浅色画布' }
if ($css -notmatch 'cursor:\s*grab') { throw '图谱缺少拖动反馈' }
'@ | Set-Content $test -Encoding UTF8
& $test
```

Expected: FAIL，图谱尚未拆分并使用浅色画布。

- [ ] **Step 2: 拆分图谱工具栏和抽屉**

`GraphToolbar` 固定提供 2D/3D、缩小、放大、适应画布、刷新和全屏。`GraphFilterDrawer` 管理库、实体类型和关系筛选。`GraphInspectorDrawer` 展示实体规范名、类型、权重、来源文档、片段、直接关系和邻居。

抽屉宽度状态限制为：

```ts
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 520;
const clampPanelWidth = (value: number) => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, value));
```

- [ ] **Step 3: 改造 2D 节点与关系视觉和命中区域**

默认 2D 画布令牌：

```css
:root {
  --graph-canvas: #f9fafb;
  --graph-grid: #eaecf0;
  --graph-edge: #98a2b3;
  --graph-edge-active: #155eef;
  --graph-label: #344054;
}
```

节点可见半径按权重映射到 18 至 42px，透明命中圆半径至少为 `max(visibleRadius + 10, 30)`。点击节点后只高亮真实邻居和关系；来源证据继续由 `onLoadGraphNodeDetail` 与 `onLoadGraphNeighbors` 获取。

- [ ] **Step 4: 约束 3D 模式背景和交互**

`KnowledgeGraph3D` 的深色背景只存在于 `.graph-3d-viewport`，页面外壳保持 `#F9FAFB`。调整相机初始距离、节点标签缩放和射线命中半径；面板隐藏或拖动结束后触发画布 resize。

- [ ] **Step 5: 运行契约、构建和 Neo4j 后端测试**

```powershell
& (Join-Path $env:TEMP 'qizhiyun-graph-contract.ps1')
npm --prefix frontend run build
$env:PYTHONPATH='backend'
& 'L:\anaconda\python.exe' -m pytest backend/tests/test_neo4j_knowledge_graph.py backend/tests/test_retrieval_service.py -q
```

Expected: 前端构建成功，Neo4j 与检索测试全部通过。

- [ ] **Step 6: 提交知识图谱重构**

```powershell
git add frontend/src/components/KnowledgeGraphExplorer.tsx frontend/src/components/KnowledgeGraph3D.tsx frontend/src/components/graph frontend/src/styles/graph.css
git commit -m "feat: 重构 Dify 式知识图谱工作台"
```

---

### Task 6: 完成响应式、视觉回归和全量验证

**Files:**
- Modify: `frontend/src/styles/base.css`
- Modify: `frontend/src/styles/components.css`
- Modify: `frontend/src/styles/pages.css`
- Modify: `frontend/src/styles/graph.css`
- Modify: `frontend/src/components/WorkspaceShell.tsx`
- Modify: `frontend/src/components/ui/AsyncState.tsx`

**Interfaces:**
- Consumes: 全部页面和公共组件。
- Produces: 三档桌面/窄屏适配、完整 loading/empty/error/disabled/permission denied 状态和视觉截图。

- [ ] **Step 1: 写入临时多视口浏览器检查**

在 `$env:TEMP/qizhiyun-responsive-smoke.mjs` 创建 Playwright 脚本，使用环境变量读取测试账号，不把账号写入文件：

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
for (const viewport of [{ width: 1440, height: 1024 }, { width: 1180, height: 820 }, { width: 820, height: 900 }]) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://127.0.0.1:9521', { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error(`视口 ${viewport.width} 存在页面级横向溢出`);
  await page.screenshot({ path: `${process.env.TEMP}/qizhiyun-${viewport.width}.png`, fullPage: true });
  await page.close();
}
await browser.close();
```

Expected: 未完成响应式规则时至少一个视口 FAIL。

- [ ] **Step 2: 实现响应式规则**

```css
@media (max-width: 1279px) {
  .app-header-nav-label.optional { display: none; }
  .data-table-scroll { overflow-x: auto; }
}

@media (max-width: 1023px) {
  .context-sidebar { position: fixed; inset: 64px auto 0 0; transform: translateX(-100%); }
  .context-sidebar.open { transform: translateX(0); }
  .dashboard-grid, .chat-layout { grid-template-columns: 1fr; }
}

@media (max-width: 767px) {
  .app-header-nav { display: none; }
  .citation-panel { position: fixed; inset: auto 0 0; max-height: 72vh; }
  .page-content { padding: 16px; }
}
```

表格自身允许横向滚动，但页面根节点不能横向溢出。

- [ ] **Step 3: 补齐所有异步和权限状态**

逐页使用 `LoadingState`、`EmptyState`、`ErrorState`、`PermissionDenied` 和禁用原因文本。所有异步按钮将真实布尔状态传入 `loading`，错误不再使用空白容器或静默失败。

- [ ] **Step 4: 运行本地全量验证**

```powershell
npm --prefix frontend run build
$env:PYTHONPATH='backend'
& 'L:\anaconda\python.exe' -m pytest backend/tests -q
node (Join-Path $env:TEMP 'qizhiyun-responsive-smoke.mjs')
git status --short
```

Expected: 前端构建成功；后端测试全通过；三个视口无页面级横向溢出；Git 状态不含测试脚本、构建产物和敏感文件。

- [ ] **Step 5: 本地真实流程检查**

使用环境变量 `E2E_EMAIL` 和 `E2E_PASSWORD` 驱动临时脚本完成：登录、选择个人区、六页切换、选择企业区、八页切换、上传测试文件、删除测试文件、普通问答、RAG 问答、查看引用、打开 2D/3D 图谱、节点详情、成员权限页和审计页。完成后删除测试数据，不提交测试文件。

- [ ] **Step 6: 提交响应式和状态收口**

```powershell
git add frontend/src/styles frontend/src/components/WorkspaceShell.tsx frontend/src/components/ui/AsyncState.tsx
git commit -m "fix: 完成 Dify 式响应式与页面状态收口"
```

---

### Task 7: 同步 GitHub 和服务器并执行服务器验收

**Files:**
- Modify: 仅本计划前六个任务已列出的项目文件。
- Preserve: 服务器 `.env`、数据库、上传目录、日志、模型和服务器专属依赖版本。

**Interfaces:**
- Consumes: 本地已通过验证的提交。
- Produces: `origin/main` 与服务器业务代码一致，服务器真实运行通过。

- [ ] **Step 1: 检查提交范围和敏感信息**

```powershell
git status --short
git diff origin/main...HEAD --name-only
git diff origin/main...HEAD | rg -n 'sk-[A-Za-z0-9]|password\s*=|SMTP_PASSWORD|API_KEY=' 
```

Expected: 仅出现计划内前端和中文文档；敏感信息扫描无命中；测试脚本不在变更列表。

- [ ] **Step 2: 推送 GitHub**

```powershell
git push origin main
```

Expected: `main -> main` 成功。

- [ ] **Step 3: 安全同步服务器代码**

先检查服务器 tracked 状态。若 tracked 工作区干净，执行 `git pull --ff-only origin main`；若存在服务器专属 tracked 改动，使用 SFTP 只传输本计划变更文件。两种方式都必须排除 `.env`、数据库、上传、日志、模型、`node_modules`、虚拟环境和构建产物。

- [ ] **Step 4: 运行服务器构建和后端测试**

```bash
cd /opt/enterprise-knowledge-platform/<服务器项目目录>
PYTHONPATH=backend backend/venv/bin/python -m pytest backend/tests -q
cd frontend && npm run build
```

Expected: 服务器后端测试全部通过，前端生产构建成功。

- [ ] **Step 5: 重启服务并检查健康状态**

按服务器当前真实管理方式重启后端、前端和 Celery，不改变 `.env`。检查：

```bash
curl -fsS http://127.0.0.1:9520/health
curl -I -fsS http://127.0.0.1:9521
```

Expected: 后端健康接口成功，前端返回 200。

- [ ] **Step 6: 执行服务器真实浏览器验收**

使用公网服务器完成登录、个人/企业工作区切换、全部菜单、知识库筛选与重置、RAG 引用、成员权限、审计删除确认和 2D/3D 图谱检查。截图至少覆盖 1440、1180、820 三个宽度；确认无白屏、无遮挡、节点可点击、抽屉可收起且工作区数据不串用。

- [ ] **Step 7: 输出交付报告**

报告必须包含：修改文件、新增组件、真实接口复用、兼容展示、未实现项、构建/测试结果、服务器 URL、Git 提交和剩余风险。若任何测试失败，不能宣称重构完成。

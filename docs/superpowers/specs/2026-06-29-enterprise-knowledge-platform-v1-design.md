# 企业知识平台 V1 设计方案

## 来源与决定

本设计基于 `C:/Users/12587/Desktop/企业知识平台最终方案总结.docx`。

项目按 5 个版本推进：

1. **V1：基础可运行版** - 账号入口、工作区选择、`workspace_id` 隔离、基础数据库模型、可运行的页面/API 骨架。
2. **V2：文档与知识库版** - 文档上传、解析状态、文档片段、知识库构建/重建流程、向量库接入。
3. **V3：RAG 问答版** - 普通对话、知识库问答、检索、重排序、来源片段、页码、相似度、聊天记录。
4. **V4：企业协作版** - 成员、角色、文档权限、工作区设置、审计日志、企业管理。
5. **V5：商业高级版** - Neo4j 知识图谱、数据分析报告、工具中心、企业通知、MinIO 文件存储、私有化部署加固。

V1 采用已确认的全栈本地 MVP 方案：

- 后端：FastAPI。
- 前端：React + Vite + TypeScript。
- 数据库：PostgreSQL，通过 Docker Compose 启动。
- ORM 与迁移：SQLAlchemy 2.x + Alembic。
- 认证：邮箱/密码、密码哈希、JWT 访问令牌。
- V1 文件存储：本地工作区存储目录，V5 再接 MinIO。
- V1 RAG/向量库/图数据库/模型集成：先保留配置字段和模块边界，真实能力从后续版本实现。

## 项目长期规则

- 项目文档默认使用中文；技术关键字、代码标识符、命令、API 路径可以保留英文。
- GitHub 远程仓库固定为 `https://github.com/ming7435/enterprise-knowledge-platform`。
- 每次本地完成项目改动后，都要提交并推送到 GitHub，除非用户明确要求暂不提交。
- 不上传隐私账号、密码、API Key、Token、证书、真实 `.env` 文件。
- 配置示例只放 `.env.example`，真实敏感配置只放本地 `.env`。
- 本地 Rerank 模型路径固定为 `L:\RAG_系统\models\bge-reranker-v2-m3`。
- `models/` 是本地大模型目录，不进入 Git 仓库。

## V1 目标

V1 要创建一个可运行的产品基础，而不是一次性原型。V1 完成后，用户可以注册、登录、选择或创建工作区，并进入个人或企业工作区页面。数据模型必须从一开始落实平台最重要的规则：个人工作区和企业工作区通过 `workspace_id` 严格隔离。

V1 包含：

- 注册、登录、退出、密码哈希、JWT 登录态。
- 登录作为第一入口。
- 每个用户自动创建个人工作区。
- 登录后进入工作区选择页。
- 当前用户可以创建企业工作区。
- 可在个人工作区和企业工作区之间切换。
- 创建后续版本可继续扩展的核心数据库表。
- 个人和企业工作区的基础页面框架。
- 文档、知识库、问答、设置、审计/日志的基础页面。
- 文档、知识库、问答、设置等 API 模块先建立稳定位置，供后续版本扩展。

V1 不包含：

- 真实邮箱验证码。
- 真实文档解析。
- 真实向量索引。
- 真实 RAG 回答生成。
- Rerank 实际执行。
- Neo4j。
- 企业通知。
- MinIO。
- 付费页、套餐限制、商业计费。

## 不可违背的产品规则

实现必须保留源文档中的这些原则：

- 注册登录页是第一入口。
- 登录成功后进入工作区选择页。
- 系统同时支持个人工作区和企业工作区。
- 个人工作区和企业工作区业务数据完全独立。
- 不做工作区同步。
- 不做工作区复制。
- 不做跨工作区导入。
- 所有属于工作区的业务记录都必须包含 `workspace_id`。
- 读写数据时必须根据场景校验 `user_id`、`workspace_id`、成员身份、角色和权限。
- 企业工作区是后期主要商业化方向，但 V1 不做付费能力。

## 架构设计

仓库采用单仓库结构，后端、前端、基础设施和文档彼此独立：

```text
backend/
  app/
    api/
    core/
    db/
    models/
    schemas/
    services/
    tests/
frontend/
  src/
    app/
    components/
    features/
    pages/
    services/
infra/
  docker-compose.yml
docs/
  superpowers/
```

后端负责所有鉴权、工作区隔离、持久化和审计记录。前端不判断用户是否有权访问某个工作区，只负责把选中的工作区 id 发送给后端并渲染后端返回结果。

前端是一个需要认证的单页应用：

- 公开路由：登录、注册。
- 受保护路由：工作区选择。
- 工作区路由：个人工作区布局、企业工作区布局。
- 共享功能路由：首页、文档、知识库、问答、设置。
- 企业专属路由外壳：成员、审计日志。

后端 API 统一挂在 `/api/v1` 下，每个功能域都有独立 router 和 service：

- `auth`：注册、登录、当前用户。
- `workspaces`：工作区列表、创建企业工作区、访问工作区。
- `documents`：V1 文档记录的基础创建与列表。
- `knowledge_bases`：V1 知识库状态与配置记录。
- `chat`：V1 会话与消息记录。
- `settings`：工作区设置。
- `audit_logs`：基础操作日志查询。

## 数据模型

V1 创建源方案中的核心表，并限定在 MVP 范围内：

- `users`：账号身份、邮箱、用户名、密码哈希、状态、登录时间。
- `workspaces`：个人或企业工作区、所有者、名称、描述、状态。
- `workspace_members`：工作区成员、角色、部门、状态。
- `documents`：按工作区隔离的文件记录和生命周期状态。
- `document_chunks`：按工作区隔离的来源片段，为后续 RAG 做准备。
- `knowledge_bases`：工作区知识库状态。
- `vector_indexes`：向量库配置和未来索引元数据。
- `chat_sessions`：工作区聊天会话。
- `chat_messages`：工作区聊天消息、来源、Agent trace、模型名称。
- `workspace_settings`：工作区级模型、向量库、存储和集成配置。
- `audit_logs`：按工作区隔离的用户行为和错误日志。

V1 角色值：

- `owner`：工作区完全控制权限。
- `admin`：为 V4 企业管理预留。
- `manager`：为 V4 企业团队管理预留。
- `user`：普通使用者。
- `viewer`：为 V4 只读权限预留。

V1 权限控制保持克制：

- 工作区所有者可以创建和访问自己的工作区。
- 用户只能访问 `workspace_members.status = active` 的工作区。
- 创建企业工作区时，当前用户成为 `owner`。
- 注册后自动创建个人工作区，并由该用户拥有。

完整的角色权限表等到 V4 企业协作版再引入。V1 不提前堆复杂权限规则。

## 工作区隔离

后端服务必须使用工作区感知的访问流程：

1. 认证请求并解析当前用户。
2. 解析目标 `workspace_id`。
3. 读写工作区数据前验证用户是 active 成员。
4. 对所有工作区业务表查询都带上 `workspace_id`。
5. 对重要动作写入审计日志，包括登录、创建工作区、创建文档记录、修改设置和错误。

这个规则也适用于 V1 的基础模块。目标是让代码结构天然避免不安全的跨工作区查询。

## 前端体验

V1 应该像一个实用的企业内部平台，不做营销落地页。

第一个屏幕是登录页。登录后用户看到工作区选择页，包含：

- 个人工作区卡片。
- 企业工作区列表。
- 创建企业工作区入口。
- 清晰的个人/企业上下文标识。

进入工作区后，使用左侧导航的工作台布局：

- 首页。
- 文档。
- 知识库。
- 问答。
- 设置。
- 企业工作区可见成员与审计日志页面外壳。

界面风格应偏安静、实用、易扫描，避免装饰性过强的首页设计。

## 错误处理

后端错误：

- 登录失败返回 `401`。
- 缺少 token 返回 `401`。
- 工作区不存在或用户不是 active 成员时返回 `403`。
- 输入不合法通过 FastAPI/Pydantic 返回 `422`。
- 意外服务端错误写入日志并返回通用 `500`。

前端错误：

- 登录和注册表单尽量展示字段级校验。
- API 鉴权失败后回到登录页。
- 工作区访问失败后回到工作区选择页，并显示清晰错误。
- 基础模块显示空状态，不填充伪造业务数据。

## 配置

V1 会提供 `.env.example`，包含源方案推荐配置，但只实际使用基础版需要的字段：

```text
APP_ENV=local
API_HOST=127.0.0.1
API_PORT=8000
FRONTEND_PORT=5173
DATABASE_URL=postgresql+psycopg://rag_user:rag_password@localhost:5432/rag_platform
JWT_SECRET_KEY=change-me-in-local-env
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=120
LOCAL_STORAGE_ROOT=storage/uploads

LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4-flash
VISION_MODEL=qwen3-vl:8b
EMBEDDING_MODEL=bge-m3:567m
RERANK_ENABLED=true
RERANK_MODEL_PATH=L:\RAG_系统\models\bge-reranker-v2-m3

RELATIONAL_DB=postgresql
VECTOR_STORE=faiss
GRAPH_DB=neo4j
FILE_STORAGE=local

WORKSPACE_ISOLATION=true
ALLOW_WORKSPACE_SYNC=false
ALLOW_WORKSPACE_COPY=false
ALLOW_CROSS_WORKSPACE_IMPORT=false
```

## 测试策略

后端 V1 测试：

- 注册会创建用户和个人工作区。
- 重复邮箱注册会被拒绝。
- 登录返回 JWT。
- 当前用户接口在有效 JWT 下可用。
- 工作区列表只返回当前用户的 active 成员关系。
- 创建企业工作区会同时创建 owner 成员关系。
- 工作区范围查询必须验证成员关系。
- 用户不能访问其他用户的个人工作区。

前端 V1 测试：

- 登录表单校验必填字段。
- 工作区选择页能渲染 API 返回的个人和企业工作区。
- 工作区路由需要认证。
- 应用框架能显示当前工作区上下文。

手工验证：

- 通过 Docker Compose 启动 PostgreSQL。
- 运行后端迁移。
- 启动后端。
- 启动前端。
- 注册一个用户。
- 确认个人工作区已创建。
- 创建一个企业工作区。
- 在个人和企业工作区之间切换。
- 确认两个工作区上下文下的基础页面都能打开。

## 版本路线图

V2 实现文档上传和知识库创建：

- 文件上传和本地存储。
- 带解析/入库状态的文档记录。
- PDF、Word、TXT、Markdown、Excel、CSV、JSON、图片的文本抽取流程基础模块。
- 文档切片。
- FAISS 或 Chroma 接入。

V3 实现 RAG 问答：

- 普通对话和 RAG 对话。
- 使用 `bge-m3:567m` 做 Embedding。
- Top-k 检索。
- 使用本地路径 `L:\RAG_系统\models\bge-reranker-v2-m3` 做 Rerank。
- 使用 DeepSeek 生成答案。
- 返回来源、片段、页码、相似度和 Agent trace。

V4 实现企业协作：

- 角色权限表。
- 成员邀请和移除。
- 文档权限。
- 扩展工作区审计日志。
- 企业设置。

V5 实现高级商业功能：

- Neo4j 知识图谱。
- 数据分析和报告生成。
- 工具中心。
- 企业微信、飞书、钉钉、Webhook 集成。
- MinIO 文件存储。
- 私有化部署加固。

## 验收标准

V1 完成标准：

- 项目可以通过文档命令在本地启动。
- 后端和前端运行在明确的本地端口。
- PostgreSQL schema 通过迁移创建。
- 用户注册、登录、获取当前用户可用。
- 每个新用户会自动创建个人工作区。
- 用户可以从工作区选择流程创建企业工作区。
- 用户不能访问自己不是 active 成员的工作区。
- 核心工作区业务模型包含 `workspace_id`。
- UI 暴露约定的 V1 页面，并清晰显示当前工作区。
- 测试覆盖认证、工作区创建和工作区隔离。

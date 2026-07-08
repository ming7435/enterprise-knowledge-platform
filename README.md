# 企业知识平台

企业知识平台是面向个人与企业工作区的 AI 知识管理系统。V1 版本先跑通账号入口、工作区选择、`workspace_id` 数据隔离和基础工作台页面，V2 版本开始接入文档上传、解析切片、知识库状态和本地检索预览，后续版本逐步接入向量库、RAG、权限审计、知识图谱和企业通知。

## V1 已包含

- 注册、登录、JWT 登录态。
- 邮箱验证码登录、邮箱验证码注册、忘记密码重置。
- 注册后自动创建个人工作区。
- 登录后进入工作区选择页。
- 创建企业工作区。
- 个人/企业工作区基础页面。
- 后端按成员关系校验工作区访问。
- 所有核心业务模型预留 `workspace_id`。
- 文档、知识库、问答、设置、成员、审计日志的 V1 页面与接口入口。

## V2 已包含

- V2.1：文档上传、MinIO 优先存储、本地存储兜底、文档列表和知识库数量联动。
- V2.2：文本、Markdown、CSV、DOCX、PDF 文档解析，上传后自动切分为知识片段。
- V2.3：知识库状态展示、最近知识片段展示、当前工作区关键词检索预览。
- V2.4：文档删除、知识片段同步清理、知识库计数回退、MinIO 不可用时快速回退本地存储。
- 所有文档、知识片段和检索接口继续按 `workspace_id` 隔离。

## V3 已包含

- RAG 智能问答接口：`POST /api/v1/workspaces/{workspace_id}/chat/ask`。
- 基于当前工作区知识片段检索上下文，返回回答和来源片段。
- 问答会话与用户/助手消息保存到 `chat_sessions`、`chat_messages`。
- DeepSeek 优先、Ollama 本地兜底、无模型时本地知识片段兜底回答。
- 前端“问答”页改为真实聊天界面，展示回答、模型名和来源引用。
- 中文自然问句检索增强，减少中文无空格问题无法命中文档片段的情况。

## V4 已包含

- 企业成员管理接口：成员列表、添加成员、修改角色、移除成员。
- 企业角色权限：`owner`、`admin`、`member`、`viewer`。
- 文档写权限控制：`owner/admin/member` 可以上传和删除文档，`viewer` 只读。
- 企业管理权限控制：成员管理、设置和审计日志仅 `owner/admin` 可访问。
- 企业审计日志页：展示成员、文档、工作区和问答等操作记录。
- 前端“成员”和“审计日志”页接入真实接口，个人工作区不显示企业协作入口。

## V5 已包含

- 接入“企知云”品牌 Logo，登录页和工作区侧边栏统一展示品牌入口。
- 新增 V5 高级驾驶舱：汇总文档数量、知识片段、成员数量、审计事件和最近活动。
- 新增知识图谱预览接口和界面：按工作区、文档、概念生成节点和关系，展示“包含文档”“包含概念”等关系。
- 新增通知中心：根据审计日志生成工作区动态，不需要额外消息队列即可先跑通 V5 效果。
- 工具中心和部署状态接口保留给程序调用，不在高级页展示给业务用户。

## 本地模型

Rerank 模型路径固定为：

```text
L:\RAG_系统\models
```

该目录是本地模型目录，已通过 `.gitignore` 排除，不会上传 GitHub。

## 环境准备

推荐使用 Python 3.12+、Node.js 20+、Docker Desktop。

当前机器如果 `python` 命令打开 Windows Store 或不可用，可以改用本机 Anaconda：

```powershell
L:\anaconda\python.exe --version
```

本次 Codex 验证使用的 Python 路径为：

```powershell
C:\Users\12587\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
```

## 安装依赖

后端：

```powershell
python -m pip install -r backend\requirements.txt
```

前端：

```powershell
npm --prefix frontend install
```

## 配置

复制示例配置到本地 `.env` 后再填写真实密钥：

```powershell
Copy-Item .env.example .env
```

`.env` 不会提交到 GitHub。当前推荐使用 PostgreSQL；先启动本地 PostgreSQL，再把 `DATABASE_URL` 设置为：

```text
postgresql+psycopg://rag_user:rag_password@localhost:5432/rag_platform
```

如果只是临时单机快速跑通，也可以改回 SQLite：

```text
sqlite:///./storage/dev.db
```

邮箱验证码需要在本地 `.env` 填写 SMTP 配置。QQ 邮箱使用授权码，不要填写 QQ 登录密码：

```text
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USERNAME=你的邮箱
SMTP_PASSWORD=你的本地 SMTP 授权码
SMTP_FROM_EMAIL=你的邮箱
SMTP_FROM_NAME=企业知识平台
SMTP_USE_SSL=true
SMTP_USE_TLS=false
EMAIL_CODE_EXPIRE_MINUTES=10
EMAIL_CODE_RESEND_SECONDS=60
```

如果发送验证码失败，先确认当前 conda 环境已安装后端依赖：

```powershell
python -m pip install --no-user -r backend\requirements.txt
```

如果启动时提示缺少 `python-multipart`，说明当前 Python 环境没有安装上传接口依赖，重新执行上面的安装命令即可。若接口提示邮件发送失败，检查 `.env` 中 `SMTP_USERNAME`、`SMTP_PASSWORD`、`SMTP_FROM_EMAIL` 是否填写的是同一个 QQ 邮箱和对应 SMTP 授权码。

n8n、MinIO、Neo4j、MySQL、Redis、Milvus、Attu、etcd 等本地知识库相关配置也统一放在 `.env`，仓库只提交 `.env.example` 占位模板。

V2 文档上传优先使用 MinIO。`FILE_STORAGE=minio` 时，系统会尝试写入 `MINIO_BUCKET`；如果 MinIO 不可用，会快速回退到 `LOCAL_STORAGE_ROOT`。上传成功后，系统会立即解析文档并写入本地知识片段表；V3 已把知识片段接入 RAG 问答和来源追溯。

```text
FILE_STORAGE=minio
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=你的本地 MinIO 用户名
MINIO_SECRET_KEY=你的本地 MinIO 密码
MINIO_BUCKET=enterprise-knowledge-platform
MINIO_SECURE=false
```

V3 问答默认使用 DeepSeek，也可以通过 Ollama 使用本地模型。真实 API Key 只写入本地 `.env`，不要提交到 GitHub：

```text
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4-flash
DEEPSEEK_API_KEY=你的本地 DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
RAG_TOP_K=5
RERANK_MODEL_PATH=L:\RAG_系统\models
```

要生成正常的大模型综合回答，本地 `.env` 必须配置 `DEEPSEEK_API_KEY`，或确保 Ollama 服务和 `OLLAMA_MODEL` 可用。系统会把检索到的知识片段作为上下文交给大模型生成自然语言答案，来源片段只在前端“来源”区域展示，不再直接拼进回答正文。如果 DeepSeek 和 Ollama 都不可用，接口会明确提示模型未连通。

## 启动 PostgreSQL

当前推荐使用 PostgreSQL：

```powershell
docker compose -f infra\docker-compose.yml up -d
```

启动后端前确认 `.env` 中的 `DATABASE_URL` 指向 PostgreSQL。系统启动时会自动建表；如果只是快速临时验证，也可以改用 SQLite。

## 启动后端

```powershell
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 9520
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:9520/health
```

期望返回：

```json
{"status":"ok"}
```

## 启动前端

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1 --port 9521
```

浏览器访问：

```text
http://127.0.0.1:9521
```

## V1 手工验证流程

1. 打开前端地址。
2. 注册一个用户。
3. 登录后进入工作区选择页。
4. 确认存在自动创建的个人工作区。
5. 创建一个企业工作区。
6. 进入个人工作区和企业工作区，确认左侧导航与当前工作区上下文正常显示。

## V2 手工验证流程

1. 登录并进入任意工作区。
2. 打开左侧“文档”。
3. 选择一个 `.txt`、`.md`、`.csv`、`.docx` 或 `.pdf` 文档。
4. 点击“上传”。
5. 确认文档列表出现文件名、类型、解析状态、入库状态、片段数和上传时间。
6. 打开左侧“知识库”，确认文档数量和知识片段数量同步增加。
7. 在知识库检索框输入文档中的关键词，确认能返回命中的片段。
8. 回到“文档”删除刚上传的文档，确认知识库数量和检索结果同步清空。

## V3 手工验证流程

1. 登录并进入任意工作区。
2. 打开“文档”，上传一个包含明确业务内容的 `.txt`、`.md`、`.csv`、`.docx` 或 `.pdf` 文件。
3. 打开“知识库”，确认文档已解析出知识片段。
4. 打开“问答”，输入与文档内容相关的问题。
5. 确认系统返回回答，并显示模型名和来源片段。
6. 如果没有配置 DeepSeek 或 Ollama，确认系统明确提示大模型未连通，且不会把来源片段直接拼进回答正文。

## V4 手工验证流程

1. 注册或登录两个账号，并用第一个账号创建企业工作区。
2. 进入企业工作区“成员”，用第二个账号邮箱添加成员。
3. 修改第二个账号角色为“只读”，确认成员列表角色同步变化。
4. 使用第二个账号登录，确认能进入企业工作区，但不能上传文档、添加成员或查看审计日志。
5. 回到企业所有者账号，打开“审计日志”，确认能看到添加成员和修改角色记录。
6. 移除第二个账号成员，确认该账号不再拥有该企业工作区访问权限。

## V5 手工验证流程

1. 启动后端和前端，登录任意已有账号。
2. 进入个人工作区或企业工作区，确认侧边栏显示“高级”入口和“企知云”Logo。
3. 打开“高级”，确认能看到 V5 高级驾驶舱的概览指标、知识图谱预览和通知中心。
4. 上传一份文档后回到“高级”，确认文档数量、知识片段、图谱节点和通知动态会刷新。
5. 确认页面不展示工具中心、部署状态、账号、密码、API Key、Token 等开发或运维信息。

## 版本路线

- V2：文档上传、解析、切片、知识库状态、本地检索预览。
- V3：RAG 问答、会话保存、DeepSeek/Ollama 模型调用、来源追溯。
- V4：企业成员、角色权限、文档权限、审计日志完善。
- V5：企知云 Logo、高级驾驶舱、知识图谱预览、通知中心；工具中心和部署状态仅保留为程序接口。

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

`.env` 不会提交到 GitHub。V1 默认使用 SQLite 即可跑通；需要 PostgreSQL 时，把 `DATABASE_URL` 改成：

```text
postgresql+psycopg://rag_user:rag_password@localhost:5432/rag_platform
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

如果不配置 `DEEPSEEK_API_KEY`，系统会尝试调用 Ollama；如果 Ollama 也不可用，会用本地知识片段生成兜底回答，保证 V3 问答流程仍可本地跑通。

## 启动 PostgreSQL

如需使用 PostgreSQL：

```powershell
docker compose -f infra\docker-compose.yml up -d
```

V1 也支持默认 SQLite，本地快速跑通时可以先不启动 PostgreSQL。

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
6. 如果没有配置 DeepSeek 或 Ollama，确认系统仍返回基于来源片段的本地兜底回答。

## 后续版本

- V2：文档上传、解析、切片、知识库状态、本地检索预览。
- V3：RAG 问答、会话保存、DeepSeek/Ollama 模型调用、来源追溯。
- V4：企业成员、角色权限、文档权限、审计日志完善。
- V5：Milvus 深度向量检索、Rerank 强化排序、Neo4j 知识图谱、数据分析、工具中心、企业通知、私有化部署。

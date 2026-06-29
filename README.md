# 企业知识平台

企业知识平台是面向个人与企业工作区的 AI 知识管理系统。V1 版本先跑通账号入口、工作区选择、`workspace_id` 数据隔离和基础工作台页面，后续版本逐步接入文档解析、向量库、RAG、权限审计、知识图谱和企业通知。

## V1 已包含

- 注册、登录、JWT 登录态。
- 注册后自动创建个人工作区。
- 登录后进入工作区选择页。
- 创建企业工作区。
- 个人/企业工作区基础页面。
- 后端按成员关系校验工作区访问。
- 所有核心业务模型预留 `workspace_id`。
- 文档、知识库、问答、设置、成员、审计日志的 V1 页面与接口入口。

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

n8n、MinIO、Neo4j、MySQL、Redis、Milvus、Attu、etcd 等本地知识库相关配置也统一放在 `.env`，仓库只提交 `.env.example` 占位模板。

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

## 后续版本

- V2：文档上传、解析、切片、知识库构建、FAISS/Chroma。
- V3：RAG 问答、Embedding、Rerank、来源追溯。
- V4：企业成员、角色权限、文档权限、审计日志完善。
- V5：Neo4j 知识图谱、数据分析、工具中心、企业通知、MinIO、私有化部署。

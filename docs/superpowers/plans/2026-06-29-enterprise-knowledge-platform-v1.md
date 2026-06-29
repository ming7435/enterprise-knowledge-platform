# 企业知识平台 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付企业知识平台 V1 基础可运行版，让用户能注册、登录、进入工作区选择页、创建企业工作区，并打开个人/企业工作区的基础页面。

**Architecture:** 使用 FastAPI 提供 `/api/v1` 后端接口，SQLAlchemy 管理用户、工作区、成员、文档、知识库、聊天、设置和审计日志表。使用 React + Vite + TypeScript 提供登录、注册、工作区选择和工作台页面；后端统一负责鉴权和 `workspace_id` 隔离。

**Tech Stack:** FastAPI, SQLAlchemy, Pytest, React, Vite, TypeScript, Vitest, Docker Compose, PostgreSQL, SQLite local fallback.

---

## 文件结构

- `backend/requirements.txt`：后端运行与测试依赖。
- `backend/app/main.py`：FastAPI 应用工厂和路由挂载。
- `backend/app/core/config.py`：环境变量配置，包含 Rerank 模型路径。
- `backend/app/core/security.py`：密码哈希和本地 HS256 JWT。
- `backend/app/db/session.py`：SQLAlchemy engine/session 创建。
- `backend/app/models/entities.py`：V1 核心 ORM 模型。
- `backend/app/schemas/*.py`：请求/响应模型。
- `backend/app/services/*.py`：认证、工作区隔离、基础模块服务。
- `backend/app/api/v1/*.py`：API 路由。
- `backend/tests/test_v1_api.py`：后端 V1 行为测试。
- `frontend/package.json`：前端依赖和脚本。
- `frontend/src/App.tsx`：前端应用状态、页面切换和 API 调用。
- `frontend/src/components/*.tsx`：登录、注册、工作区选择、工作台组件。
- `frontend/src/styles.css`：工作台样式。
- `frontend/src/*.test.tsx`：前端 V1 行为测试。
- `infra/docker-compose.yml`：PostgreSQL 本地服务。
- `.env.example`：不含真实密钥的示例配置。
- `README.md`：中文启动说明。

## Task 1: 后端测试先行

**Files:**
- Create: `backend/tests/test_v1_api.py`
- Create: `backend/pytest.ini`

- [ ] **Step 1: 写失败测试**

测试覆盖注册自动创建个人工作区、重复邮箱拒绝、登录返回 token、当前用户、企业工作区创建、工作区隔离和基础模块访问。

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m pytest backend/tests/test_v1_api.py -q`

Expected: FAIL，因为 `app.main` 尚不存在。

## Task 2: 后端实现

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/security.py`
- Create: `backend/app/db/session.py`
- Create: `backend/app/models/entities.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/schemas/workspaces.py`
- Create: `backend/app/schemas/modules.py`
- Create: `backend/app/services/auth_service.py`
- Create: `backend/app/services/workspace_service.py`
- Create: `backend/app/api/deps.py`
- Create: `backend/app/api/v1/auth.py`
- Create: `backend/app/api/v1/workspaces.py`
- Create: `backend/app/api/v1/modules.py`
- Create: `backend/app/__init__.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/v1/__init__.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/requirements.txt`

- [ ] **Step 1: 实现配置、数据库、模型和安全工具**

实现 `Settings`、SQLAlchemy session、PBKDF2 密码哈希、HS256 token、V1 ORM 表。

- [ ] **Step 2: 实现认证和工作区服务**

注册时创建用户、个人工作区和 owner 成员关系；登录写审计日志；访问工作区前验证 active 成员关系。

- [ ] **Step 3: 实现 API 路由**

提供 `/health`、`/api/v1/auth/register`、`/api/v1/auth/login`、`/api/v1/auth/me`、`/api/v1/workspaces`、`/api/v1/workspaces/enterprise`、`/api/v1/workspaces/{workspace_id}` 和基础模块路由。

- [ ] **Step 4: 运行测试确认通过**

Run: `python -m pytest backend/tests/test_v1_api.py -q`

Expected: PASS。

## Task 3: 前端测试先行

**Files:**
- Create: `frontend/src/components/AuthForms.test.tsx`
- Create: `frontend/src/components/WorkspaceSelection.test.tsx`
- Create: `frontend/src/components/WorkspaceShell.test.tsx`
- Create: `frontend/src/test/setup.ts`

- [ ] **Step 1: 写失败测试**

测试登录表单必填校验、工作区选择页渲染个人/企业工作区、工作台显示当前工作区上下文。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm --prefix frontend test -- --run`

Expected: FAIL，因为组件尚不存在。

## Task 4: 前端实现

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/components/AuthForms.tsx`
- Create: `frontend/src/components/WorkspaceSelection.tsx`
- Create: `frontend/src/components/WorkspaceShell.tsx`
- Create: `frontend/src/styles.css`

- [ ] **Step 1: 实现 React/Vite 基础**

创建 Vite 应用入口、API 客户端、类型定义和中文 UI 文案。

- [ ] **Step 2: 实现认证与工作区流程**

登录/注册成功后保存 token，进入工作区选择页；可创建企业工作区并进入工作台。

- [ ] **Step 3: 实现工作台页面**

提供首页、文档、知识库、问答、设置、企业成员、审计日志页面外壳，并显示当前工作区。

- [ ] **Step 4: 运行前端测试确认通过**

Run: `npm --prefix frontend test -- --run`

Expected: PASS。

## Task 5: 启动配置与中文说明

**Files:**
- Create: `.env.example`
- Create: `infra/docker-compose.yml`
- Create: `README.md`

- [ ] **Step 1: 写环境示例**

`.env.example` 使用示例密钥，不包含真实账号密码；包含 `RERANK_MODEL_PATH=L:\RAG_系统\models\bge-reranker-v2-m3`。

- [ ] **Step 2: 写 Docker Compose**

提供 PostgreSQL 本地服务，端口 `5432`，只使用开发示例密码。

- [ ] **Step 3: 写中文 README**

说明安装依赖、启动数据库、启动后端、启动前端、运行测试和访问地址。

## Task 6: 本地跑通与同步

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 安装依赖**

Run: `python -m pip install -r backend/requirements.txt`

Run: `npm --prefix frontend install`

- [ ] **Step 2: 运行自动化测试**

Run: `python -m pytest backend/tests/test_v1_api.py -q`

Run: `npm --prefix frontend test -- --run`

- [ ] **Step 3: 启动服务验证**

Run backend: `python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000`

Run frontend: `npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173`

Verify:

- `GET http://127.0.0.1:8000/health` 返回 `{"status":"ok"}`。
- `http://127.0.0.1:5173` 可以打开前端。

- [ ] **Step 4: 提交并推送**

Run:

```powershell
git status --short
git add -- .
git commit -m "feat: build v1 runnable platform"
git push origin main
```

提交前确认 `.env`、账号密码、API Key、Token、`models/` 没有进入暂存区。

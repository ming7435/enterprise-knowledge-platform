# Enterprise Knowledge Platform V1 Design

## Source And Decision

This design is based on `C:/Users/12587/Desktop/企业知识平台最终方案总结.docx`.

The project will be delivered in five versions:

1. **V1: Foundation MVP** - account entry, workspace selection, workspace isolation, base database models, and usable page/API skeleton.
2. **V2: Documents And Knowledge Base** - document upload, parsing status, chunk records, knowledge base build/rebuild flow, and vector store integration.
3. **V3: RAG Q&A** - normal chat, knowledge-base chat, retrieval, rerank, source snippets, page numbers, similarity scores, and chat history.
4. **V4: Enterprise Collaboration** - members, roles, document permissions, workspace settings, audit logs, and enterprise administration.
5. **V5: Commercial Advanced Features** - Neo4j knowledge graph, data analysis reports, tool center, enterprise notifications, MinIO storage, and private deployment hardening.

The approved V1 technical direction is a full-stack local MVP:

- Backend: FastAPI.
- Frontend: React + Vite + TypeScript.
- Database: PostgreSQL, started through Docker Compose.
- ORM and migrations: SQLAlchemy 2.x + Alembic.
- Authentication: email/password with password hashing and JWT access tokens.
- File storage in V1: local workspace storage directory, with a later MinIO adapter in V5.
- RAG/vector/graph/model integrations in V1: configuration fields and module boundaries only; real behavior starts in later versions.

## V1 Goals

V1 must create a runnable product foundation, not a throwaway prototype. After V1, a user can register, log in, choose or create a workspace, and open personal or enterprise workspace pages. The data model must already enforce the platform's most important rule: personal workspace data and enterprise workspace data are separate through `workspace_id`.

V1 includes:

- Register, login, logout, password hashing, and JWT authentication.
- Login as the first user entry point.
- Automatic personal workspace creation for every user.
- Workspace selection page after login.
- Enterprise workspace creation by the current user.
- Workspace switching between personal and enterprise workspaces.
- Core database tables that later versions can extend without replacement.
- Basic page shell for personal and enterprise dashboards.
- Basic pages for documents, knowledge base, chat, settings, and audit/log visibility.
- Stub API modules for documents, knowledge bases, chat, and settings so later versions have stable locations.

V1 does not include:

- Real email verification.
- Real document parsing.
- Real vector indexing.
- Real RAG answer generation.
- Rerank execution.
- Neo4j.
- Enterprise notifications.
- MinIO.
- Payment, subscription, or package limits.

## Non-Negotiable Product Rules

The implementation must preserve these rules from the source document:

- Registration and login are the first entry point.
- Login success sends the user to workspace selection.
- The system supports personal workspaces and enterprise workspaces.
- Personal and enterprise workspaces do not share business data.
- No workspace sync.
- No workspace copy.
- No cross-workspace import.
- Every business record that belongs to a workspace must include `workspace_id`.
- Reads and writes must check `user_id`, `workspace_id`, membership, role, and permission where relevant.
- Enterprise workspace is the main commercial direction, even though paid features are out of scope for V1.

## Architecture

The repository will be a monorepo with independent backend, frontend, infrastructure, and documentation areas:

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

The backend owns all authorization, workspace isolation, persistence, and audit records. The frontend never decides whether a user may access a workspace; it only sends the selected workspace id to backend endpoints and renders the response.

The frontend will be an authenticated single-page app:

- Public routes: login and register.
- Protected route: workspace selection.
- Workspace routes: personal workspace and enterprise workspace layouts.
- Shared feature routes: dashboard, documents, knowledge base, chat, settings.
- Enterprise-only route shell: members and audit logs.

The backend will expose a versioned API under `/api/v1`. Each feature area gets a focused router and service:

- `auth`: registration, login, current user.
- `workspaces`: list workspaces, create enterprise workspace, select/access workspace.
- `documents`: V1 list/create stub records.
- `knowledge_bases`: V1 status/config stub records.
- `chat`: V1 session/message stub records.
- `settings`: workspace settings.
- `audit_logs`: basic operation log query.

## Data Model

V1 creates the core tables from the final方案, scoped to the MVP:

- `users`: account identity, email, username, password hash, status, login timestamps.
- `workspaces`: personal or enterprise workspace, owner, name, description, status.
- `workspace_members`: user membership in each workspace, role, department, status.
- `documents`: workspace-scoped file record and lifecycle status fields.
- `document_chunks`: workspace-scoped source text chunks for future RAG.
- `knowledge_bases`: workspace knowledge base status.
- `vector_indexes`: vector store settings and future index metadata.
- `chat_sessions`: workspace chat sessions.
- `chat_messages`: workspace chat messages, sources, agent trace, model name.
- `workspace_settings`: workspace-level model, vector, storage, and integration settings.
- `audit_logs`: workspace-scoped user actions and errors.

V1 role values:

- `owner`: full workspace control.
- `admin`: enterprise administration role reserved for V4.
- `manager`: enterprise team management role reserved for V4.
- `user`: normal workspace use.
- `viewer`: read-only role reserved for V4.

V1 permission enforcement is intentionally small:

- The workspace owner can create and access their workspace.
- A member can access workspaces where `workspace_members.status = active`.
- Enterprise creation makes the current user the `owner`.
- Personal workspace is created automatically and owned by the user.

Full role-permission tables can be introduced in V4 once enterprise permissions are implemented. V1 should not overbuild permission rules before there are protected enterprise workflows.

## Workspace Isolation

Backend services must use a workspace-aware access pattern:

1. Authenticate the request and resolve the current user.
2. Resolve the target `workspace_id`.
3. Verify active membership before reading or writing workspace data.
4. Include `workspace_id` in every query for workspace-scoped tables.
5. Write an audit log for important actions, including login, workspace creation, document stub creation, setting changes, and errors.

This rule applies even to V1 stub modules. The goal is to make unsafe cross-workspace queries feel unnatural in the codebase.

## Frontend Experience

V1 should feel like a practical internal platform, not a marketing landing page.

The first screen is the login page. After login, the user sees a workspace selection page with:

- Personal workspace card.
- Enterprise workspace list.
- Create enterprise workspace action.
- Clear labels for personal vs enterprise context.

Inside a workspace, the layout uses a left navigation shell with compact, work-focused pages:

- Dashboard.
- Documents.
- Knowledge Base.
- Chat.
- Settings.
- Members and Audit Logs for enterprise workspace, visible as V1 shells.

The UI should avoid decorative landing-page sections. It should prioritize predictable navigation, dense but readable information, and clear workspace context.

## Error Handling

Backend errors:

- Invalid login returns `401`.
- Missing token returns `401`.
- Workspace not found or inactive membership returns `403` unless revealing existence would be useful for the current user.
- Invalid input returns `422` through FastAPI/Pydantic validation.
- Unexpected server errors are logged and return a generic `500`.

Frontend errors:

- Login and registration forms show field-level validation where possible.
- API authorization failures return the user to login.
- Workspace access failures return to workspace selection with a plain error message.
- Stub modules show empty states, not fake production data.

## Configuration

V1 will include `.env.example` values for the final方案's recommended configuration while only using the values needed for the foundation:

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

## Testing Strategy

Backend V1 tests:

- Register creates a user and personal workspace.
- Duplicate email registration is rejected.
- Login returns a JWT.
- Current user endpoint works with valid JWT.
- Workspace list only includes active memberships for the current user.
- Enterprise workspace creation creates workspace and owner membership.
- Workspace-scoped queries include membership checks.
- A user cannot access another user's personal workspace.

Frontend V1 tests:

- Login form validates required fields.
- Workspace selection renders personal and enterprise workspaces from API data.
- Workspace routes require authentication.
- Workspace context is displayed in the app shell.

Manual verification:

- Start PostgreSQL through Docker Compose.
- Run backend migrations.
- Start backend.
- Start frontend.
- Register a user.
- Confirm personal workspace exists.
- Create an enterprise workspace.
- Switch between personal and enterprise workspace.
- Confirm shell pages load under both workspace contexts.

## Version Roadmap

V2 will implement document upload and knowledge base creation:

- File upload and local storage.
- Document records with parse/index status.
- Text extraction pipeline stubs for PDF, Word, TXT, Markdown, Excel, CSV, JSON, and images.
- Chunk creation.
- FAISS or Chroma integration.

V3 will implement RAG Q&A:

- Normal chat and RAG chat.
- Embedding through `bge-m3:567m`.
- Top-k retrieval.
- Local rerank through `L:\RAG_系统\models\bge-reranker-v2-m3`.
- DeepSeek answer generation.
- Sources, snippets, page number, similarity score, and agent trace.

V4 will implement enterprise collaboration:

- Role-permission tables.
- Member invitation/removal.
- Document permissions.
- Workspace audit log expansion.
- Enterprise settings.

V5 will implement advanced commercial features:

- Neo4j knowledge graph.
- Data analysis and report generation.
- Tool center.
- Enterprise WeChat, Feishu, DingTalk, and Webhook integrations.
- MinIO storage.
- Private deployment hardening.

## Acceptance Criteria

V1 is complete when:

- The project starts locally with documented commands.
- Backend and frontend run at predictable local ports.
- PostgreSQL schema is created through migrations.
- User registration, login, and current-user retrieval work.
- A personal workspace is automatically created for every new user.
- An enterprise workspace can be created from the workspace selection flow.
- Users cannot access workspaces where they are not active members.
- Core workspace-scoped models include `workspace_id`.
- The UI exposes the agreed V1 pages and clearly shows the current workspace.
- Tests cover authentication, workspace creation, and workspace isolation.

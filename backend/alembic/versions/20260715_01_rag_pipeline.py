"""补齐异步文档处理与检索元数据字段。"""

from alembic import op
import sqlalchemy as sa

from app.models.entities import Base


revision = "20260715_01"
down_revision = None
branch_labels = None
depends_on = None


DOCUMENT_COLUMNS = {
    "processing_progress": sa.Column("processing_progress", sa.Integer(), nullable=False, server_default="0"),
    "processing_stage": sa.Column("processing_stage", sa.String(length=40), nullable=False, server_default="waiting"),
    "processing_error": sa.Column("processing_error", sa.Text(), nullable=True),
    "task_id": sa.Column("task_id", sa.String(length=80), nullable=True),
    "content_hash": sa.Column("content_hash", sa.String(length=64), nullable=True),
    "version": sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
}

CHUNK_COLUMNS = {
    "section": sa.Column("section", sa.String(length=255), nullable=True),
    "token_count": sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
    "content_hash": sa.Column("content_hash", sa.String(length=64), nullable=True),
}


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    inspector = sa.inspect(bind)
    document_columns = {column["name"] for column in inspector.get_columns("documents")}
    chunk_columns = {column["name"] for column in inspector.get_columns("document_chunks")}
    for name, column in DOCUMENT_COLUMNS.items():
        if name not in document_columns:
            op.add_column("documents", column)
    for name, column in CHUNK_COLUMNS.items():
        if name not in chunk_columns:
            op.add_column("document_chunks", column)
    op.create_index("ix_documents_task_id", "documents", ["task_id"], unique=False, if_not_exists=True)
    op.create_index("ix_documents_content_hash", "documents", ["content_hash"], unique=False, if_not_exists=True)
    op.create_index("ix_document_chunks_content_hash", "document_chunks", ["content_hash"], unique=False, if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_document_chunks_content_hash", table_name="document_chunks", if_exists=True)
    op.drop_index("ix_documents_content_hash", table_name="documents", if_exists=True)
    op.drop_index("ix_documents_task_id", table_name="documents", if_exists=True)
    for name in reversed(tuple(CHUNK_COLUMNS)):
        op.drop_column("document_chunks", name)
    for name in reversed(tuple(DOCUMENT_COLUMNS)):
        op.drop_column("documents", name)

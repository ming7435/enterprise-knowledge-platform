from app.core.config import get_settings
from app.services.document_task_service import process_document_by_id
from app.tasks.celery_app import celery_app


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def process_document_task(self, document_id: str) -> None:
    process_document_by_id(get_settings(), document_id=document_id, raise_on_error=True)

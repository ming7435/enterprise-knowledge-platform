from pydantic import BaseModel, ConfigDict, Field


class WorkspacePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: str
    description: str | None = None
    status: str
    role: str | None = None


class EnterpriseWorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)

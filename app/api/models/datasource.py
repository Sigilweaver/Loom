"""Data source request/response models"""

from pydantic import BaseModel

from app.api.models.common import DataSchema, DataPreview


class InspectRequest(BaseModel):
    """Request to inspect a data source"""

    source: str
    config: dict


class InspectResponse(BaseModel):
    """Response from data source inspection"""

    schema: DataSchema
    validation: dict


class PreviewOptions(BaseModel):
    """Options for data preview"""

    max_rows: int = 100
    offset: int = 0
    columns: list[str] | None = None


class PreviewRequest(BaseModel):
    """Request to preview data from a source"""

    source: str
    config: dict
    options: PreviewOptions | None = None


class PreviewResponse(DataPreview):
    """Response from data preview (extends DataPreview)"""

    pass

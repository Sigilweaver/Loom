"""Data source API routes (generic for all source types)"""

from fastapi import APIRouter, HTTPException

from app.api.models.datasource import (
    InspectRequest,
    InspectResponse,
    PreviewRequest,
    PreviewOptions,
)
from app.api.models.common import DataPreview
from app.domain.datasources.factory import DataSourceFactory
from app.utils.errors import DataSourceError

router = APIRouter(prefix="/datasource", tags=["datasource"])


@router.post("/inspect", response_model=InspectResponse)
async def inspect_datasource(request: InspectRequest) -> InspectResponse:
    """
    Inspect a data source and return schema information.
    
    Automatically detects source type from file extension if not provided.
    Supports: CSV, TSV, and more in the future.
    """
    try:
        # Determine source type
        source_type = request.source_type
        if not source_type:
            source_type = DataSourceFactory.detect_source_type(request.source)

        # Create appropriate data source handler
        datasource = DataSourceFactory.create(source_type)

        # Validate configuration
        validation_errors = await datasource.validate_config(request.config)

        # Inspect the data source
        schema = await datasource.inspect(request.source, request.config)

        return InspectResponse(
            data_schema=schema,
            validation={"errors": validation_errors, "warnings": []},
        )

    except DataSourceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inspection failed: {str(e)}")


@router.post("/preview", response_model=DataPreview)
async def preview_datasource(request: PreviewRequest) -> DataPreview:
    """
    Preview data from a source.
    
    Returns sample rows with schema information.
    Automatically detects source type from file extension if not provided.
    """
    try:
        # Determine source type
        source_type = request.source_type
        if not source_type:
            source_type = DataSourceFactory.detect_source_type(request.source)

        # Create appropriate data source handler
        datasource = DataSourceFactory.create(source_type)

        # Get preview options
        options = request.options or PreviewOptions()

        # Preview the data
        preview = await datasource.preview(
            source=request.source,
            config=request.config,
            max_rows=options.max_rows,
            offset=options.offset,
            columns=options.columns,
        )

        return preview

    except DataSourceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")


@router.get("/supported")
async def list_supported_sources():
    """
    List all supported data source types and file extensions.
    """
    return {
        "source_types": DataSourceFactory.list_supported_types(),
        "file_extensions": DataSourceFactory.list_supported_extensions(),
    }

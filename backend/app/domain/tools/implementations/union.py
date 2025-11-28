from typing import Any, cast
import polars as pl
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.api.models.common import DataSchema

@register_tool("Union")
class UnionTool(BaseTool):
    async def execute(
        self, config: dict[str, Any], inputs: dict[int, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[int, pl.LazyFrame]:
        # Get inputs from socket 0
        input_data = inputs.get(0)
        
        if input_data is None:
            # No input, return empty frame
            return {1: pl.LazyFrame([])}
            
        # Ensure we have a list of frames
        frames: list[pl.LazyFrame] = []
        if isinstance(input_data, list):
            frames = input_data
        else:
            frames = [input_data]
            
        if not frames:
             return {1: pl.LazyFrame([])}

        mode = config.get("mode", "ByName")
        
        if mode == "ByName":
            # Union by name (diagonal concat)
            # This aligns columns by name and fills missing with nulls
            result = pl.concat(frames, how="diagonal")
            
        elif mode == "ByPosition":
            # Union by position (rename columns to match first frame)
            first_frame = frames[0]
            target_cols = first_frame.collect_schema().names()
            
            processed_frames = [first_frame]
            for i in range(1, len(frames)):
                current_frame = frames[i]
                current_cols = current_frame.collect_schema().names()
                
                # Create rename mapping
                # If counts differ, zip will truncate to shortest, which might be what we want?
                # Or should we error? For now, let's try to map as many as possible.
                rename_map = {
                    old: new 
                    for old, new in zip(current_cols, target_cols)
                }
                processed_frames.append(current_frame.rename(rename_map))
                
            # Now vertical concat since names match (or should match)
            # Use vertical_relaxed to handle type mismatches if possible?
            # No, vertical is strict. Let's stick to vertical.
            result = pl.concat(processed_frames, how="vertical")
            
        else:
            # Default fallback
            result = pl.concat(frames, how="vertical")

        return {1: result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[int, DataSchema | list[DataSchema]]
    ) -> dict[int, DataSchema]:
        input_schema_data = input_schemas.get(0)
        
        if not input_schema_data:
            return {1: DataSchema(columns=[])}
            
        schemas: list[DataSchema] = []
        if isinstance(input_schema_data, list):
            schemas = input_schema_data
        else:
            schemas = [input_schema_data]
            
        if not schemas:
            return {1: DataSchema(columns=[])}
            
        mode = config.get("mode", "ByName")
        
        if mode == "ByName":
            # Union of all columns
            # Use a dict to track unique columns by name
            # If type conflict, what happens? Polars diagonal concat usually upcasts.
            # For schema prediction, we might just take the first one or try to merge.
            # Let's merge all unique columns.
            
            merged_columns = {}
            for schema in schemas:
                for col in schema.columns:
                    if col.name not in merged_columns:
                        merged_columns[col.name] = col
                    # TODO: Handle type merging if needed
            
            return {1: DataSchema(columns=list(merged_columns.values()))}
            
        elif mode == "ByPosition":
            # Output schema matches the first input
            return {1: schemas[0]}
            
        return {1: schemas[0]}

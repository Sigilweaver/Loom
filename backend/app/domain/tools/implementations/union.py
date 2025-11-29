from typing import Any, cast
import polars as pl
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.api.models.common import DataSchema


@register_tool("Union")
class UnionTool(BaseTool):
    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        # Get inputs from socket 'input'
        input_data = inputs.get("input")
        
        if input_data is None:
            # No input, return empty frame
            return {"output": pl.LazyFrame([])}
            
        # Ensure we have a list of frames
        frames: list[pl.LazyFrame] = []
        if isinstance(input_data, list):
            frames = input_data
        else:
            frames = [input_data]
            
        if not frames:
             return {"output": pl.LazyFrame([])}

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

        return {"output": result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        input_schema_data = input_schemas.get("input")
        
        if not input_schema_data:
            return {"output": DataSchema(columns=[])}
            
        schemas: list[DataSchema] = []
        if isinstance(input_schema_data, list):
            schemas = input_schema_data
        else:
            schemas = [input_schema_data]
            
        if not schemas:
            return {"output": DataSchema(columns=[])}
            
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
            
            return {"output": DataSchema(columns=list(merged_columns.values()))}
            
        elif mode == "ByPosition":
            # Output schema matches the first input
            return {"output": schemas[0]}
            
        return {"output": schemas[0]}

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Union tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines = []
        mode = config.get("mode", "ByName")

        # Get input variable(s) - can be a single var or list
        input_data = input_vars.get("input")
        
        # Generate output variable name
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        if input_data is None:
            lines.append(f"{var_name} = pl.LazyFrame([])")
            return (lines, {"output": var_name})

        # Normalize to list
        if isinstance(input_data, str):
            input_list = [input_data]
        else:
            input_list = input_data

        if len(input_list) == 0:
            lines.append(f"{var_name} = pl.LazyFrame([])")
        elif len(input_list) == 1:
            # Single input - just pass through
            lines.append(f"{var_name} = {input_list[0]}")
        else:
            # Multiple inputs - use pl.concat
            frames_str = ", ".join(input_list)
            
            if mode == "ByName":
                lines.append(f"{var_name} = pl.concat([{frames_str}], how=\"diagonal\")")
            elif mode == "ByPosition":
                # For ByPosition, we need to rename columns to match first frame
                # This is more complex - generate helper code
                lines.append(f"# Union by position - align columns to first frame")
                lines.append(f"_union_frames = [{frames_str}]")
                lines.append(f"_first_cols = _union_frames[0].collect_schema().names()")
                lines.append(f"_processed = [_union_frames[0]]")
                lines.append(f"for _frame in _union_frames[1:]:")
                lines.append(f"    _curr_cols = _frame.collect_schema().names()")
                lines.append(f"    _rename_map = {{old: new for old, new in zip(_curr_cols, _first_cols)}}")
                lines.append(f"    _processed.append(_frame.rename(_rename_map))")
                lines.append(f"{var_name} = pl.concat(_processed, how=\"vertical\")")
            else:
                # Default vertical concat
                lines.append(f"{var_name} = pl.concat([{frames_str}], how=\"vertical\")")

        return (lines, {"output": var_name})

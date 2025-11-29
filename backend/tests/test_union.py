import pytest
import polars as pl
from app.domain.tools.implementations.union import UnionTool
from app.api.models.common import DataSchema, ColumnSchema, PolarsDataType

@pytest.mark.asyncio
async def test_union_by_name():
    tool = UnionTool()
    
    # Create two frames with overlapping columns
    df1 = pl.LazyFrame({
        "id": [1, 2],
        "name": ["Alice", "Bob"],
        "age": [25, 30]
    })
    
    df2 = pl.LazyFrame({
        "id": [3, 4],
        "name": ["Charlie", "David"],
        "city": ["New York", "London"]
    })
    
    inputs = {0: [df1, df2]}
    config = {"mode": "ByName"}
    
    result = await tool.execute(config, inputs)
    output = result[1].collect()
    
    assert output.height == 4
    assert "id" in output.columns
    assert "name" in output.columns
    assert "age" in output.columns
    assert "city" in output.columns
    
    # Check nulls were filled
    assert output.filter(pl.col("id") == 3).select("age").item(0, 0) is None
    assert output.filter(pl.col("id") == 1).select("city").item(0, 0) is None

@pytest.mark.asyncio
async def test_union_by_position():
    tool = UnionTool()
    
    # Create two frames with different column names but same structure
    df1 = pl.LazyFrame({
        "col1": [1, 2],
        "col2": ["A", "B"]
    })
    
    df2 = pl.LazyFrame({
        "other1": [3, 4],
        "other2": ["C", "D"]
    })
    
    inputs = {0: [df1, df2]}
    config = {"mode": "ByPosition"}
    
    result = await tool.execute(config, inputs)
    output = result[1].collect()
    
    assert output.height == 4
    assert output.columns == ["col1", "col2"]
    
    # Check data was stacked
    assert output["col1"].to_list() == [1, 2, 3, 4]
    assert output["col2"].to_list() == ["A", "B", "C", "D"]

@pytest.mark.asyncio
async def test_union_single_input():
    tool = UnionTool()
    df1 = pl.LazyFrame({"a": [1]})
    
    inputs = {0: df1} # Single frame, not list (though executor should wrap it, tool handles both)
    config = {"mode": "ByName"}
    
    result = await tool.execute(config, inputs)
    output = result[1].collect()
    
    assert output.height == 1
    assert output.columns == ["a"]

@pytest.mark.asyncio
async def test_union_schema_by_name():
    tool = UnionTool()
    
    s1 = DataSchema(columns=[
        ColumnSchema(name="a", dtype=PolarsDataType.INT64, nullable=True),
        ColumnSchema(name="b", dtype=PolarsDataType.STRING, nullable=True)
    ])
    
    s2 = DataSchema(columns=[
        ColumnSchema(name="a", dtype=PolarsDataType.INT64, nullable=True),
        ColumnSchema(name="c", dtype=PolarsDataType.BOOLEAN, nullable=True)
    ])
    
    inputs = {0: [s1, s2]}
    config = {"mode": "ByName"}
    
    result = await tool.get_output_schema(config, inputs)
    schema = result[1]
    
    col_names = {c.name for c in schema.columns}
    assert "a" in col_names
    assert "b" in col_names
    assert "c" in col_names


class TestUnionCodeGeneration:
    """Tests for Union tool Python code generation"""
    
    def test_code_gen_single_input(self):
        tool = UnionTool()
        input_vars = {0: "df_input"}
        config = {"mode": "ByName"}
        
        lines, output_vars = tool.to_python_code("union_1", config, input_vars)
        
        assert output_vars[1] == "df_union_1"
        assert len(lines) == 1
        assert "df_union_1 = df_input" in lines[0]
    
    def test_code_gen_multiple_inputs_by_name(self):
        tool = UnionTool()
        input_vars = {0: ["df_filter_t", "df_filter_f"]}
        config = {"mode": "ByName"}
        
        lines, output_vars = tool.to_python_code("union_abc", config, input_vars)
        
        assert output_vars[1] == "df_union_abc"
        assert len(lines) == 1
        assert 'pl.concat([df_filter_t, df_filter_f], how="diagonal")' in lines[0]
    
    def test_code_gen_multiple_inputs_by_position(self):
        tool = UnionTool()
        input_vars = {0: ["df_a", "df_b", "df_c"]}
        config = {"mode": "ByPosition"}
        
        lines, output_vars = tool.to_python_code("union_xyz", config, input_vars)
        
        assert output_vars[1] == "df_union_xyz"
        # Should generate multi-line code for position-based union
        assert any("by position" in line.lower() for line in lines)
        assert any("_union_frames" in line for line in lines)
        assert any("collect_schema" in line for line in lines)
        assert any("rename" in line for line in lines)
    
    def test_code_gen_no_input(self):
        tool = UnionTool()
        input_vars = {}  # No inputs connected
        config = {"mode": "ByName"}
        
        lines, output_vars = tool.to_python_code("union_empty", config, input_vars)
        
        assert output_vars[1] == "df_union_empty"
        assert len(lines) == 1
        assert "LazyFrame([])" in lines[0]

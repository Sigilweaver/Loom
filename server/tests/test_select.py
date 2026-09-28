"""Tests for the Select tool implementation"""

import polars as pl
import pytest

from app.domain.models.common import ColumnSchema, DataSchema, PolarsDataType
from app.domain.tools.implementations.select import SelectTool


@pytest.fixture
def select_tool():
    """Create a SelectTool instance"""
    return SelectTool()


@pytest.fixture
def sample_lazyframe():
    """Create a sample LazyFrame for testing"""
    return pl.LazyFrame(
        {
            "name": ["Alice", "Bob", "Charlie"],
            "age": [30, 25, 35],
            "city": ["New York", "Los Angeles", "Chicago"],
            "salary": [50000.0, 60000.0, 55000.0],
        }
    )


@pytest.fixture
def sample_schema():
    """Create a sample schema matching the sample LazyFrame"""
    return DataSchema(
        columns=[
            ColumnSchema(name="name", dtype=PolarsDataType.STRING, nullable=True),
            ColumnSchema(name="age", dtype=PolarsDataType.INT64, nullable=True),
            ColumnSchema(name="city", dtype=PolarsDataType.STRING, nullable=True),
            ColumnSchema(name="salary", dtype=PolarsDataType.FLOAT64, nullable=True),
        ],
        row_count=3,
    )


class TestSelectToolExecute:
    """Test SelectTool.execute method"""

    @pytest.mark.asyncio
    async def test_pass_through_empty_config(self, select_tool, sample_lazyframe):
        """Empty config should pass through all columns unchanged"""
        result = await select_tool.execute({}, {"input": sample_lazyframe})

        assert "output" in result
        df = result["output"].collect()
        assert df.columns == ["name", "age", "city", "salary"]
        assert len(df) == 3

    @pytest.mark.asyncio
    async def test_pass_through_empty_column_configs(self, select_tool, sample_lazyframe):
        """Empty columnConfigs should pass through all columns unchanged"""
        result = await select_tool.execute({"columnConfigs": []}, {"input": sample_lazyframe})

        assert "output" in result
        df = result["output"].collect()
        assert df.columns == ["name", "age", "city", "salary"]

    @pytest.mark.asyncio
    async def test_select_columns(self, select_tool, sample_lazyframe):
        """Should select only specified columns"""
        config = {
            "columnConfigs": [
                {"name": "name", "selected": True},
                {"name": "age", "selected": True},
                {"name": "city", "selected": False},
                {"name": "salary", "selected": False},
            ]
        }
        result = await select_tool.execute(config, {"input": sample_lazyframe})

        df = result["output"].collect()
        assert df.columns == ["name", "age"]
        assert len(df) == 3

    @pytest.mark.asyncio
    async def test_rename_columns(self, select_tool, sample_lazyframe):
        """Should rename columns when rename is specified"""
        config = {
            "columnConfigs": [
                {"name": "name", "selected": True, "rename": "full_name"},
                {"name": "age", "selected": True, "rename": "years"},
            ]
        }
        result = await select_tool.execute(config, {"input": sample_lazyframe})

        df = result["output"].collect()
        assert df.columns == ["full_name", "years"]
        assert df["full_name"].to_list() == ["Alice", "Bob", "Charlie"]

    @pytest.mark.asyncio
    async def test_reorder_columns(self, select_tool, sample_lazyframe):
        """Should output columns in the order specified in config"""
        config = {
            "columnConfigs": [
                {"name": "salary", "selected": True},
                {"name": "name", "selected": True},
                {"name": "age", "selected": True},
            ]
        }
        result = await select_tool.execute(config, {"input": sample_lazyframe})

        df = result["output"].collect()
        assert df.columns == ["salary", "name", "age"]

    @pytest.mark.asyncio
    async def test_cast_type_int_to_float(self, select_tool, sample_lazyframe):
        """Should cast integer to float"""
        config = {
            "columnConfigs": [
                {"name": "age", "selected": True, "targetType": "Float64"},
            ]
        }
        result = await select_tool.execute(config, {"input": sample_lazyframe})

        df = result["output"].collect()
        assert df.schema["age"] == pl.Float64
        assert df["age"].to_list() == [30.0, 25.0, 35.0]

    @pytest.mark.asyncio
    async def test_cast_type_float_to_int(self, select_tool, sample_lazyframe):
        """Should cast float to integer (truncates decimals)"""
        config = {
            "columnConfigs": [
                {"name": "salary", "selected": True, "targetType": "Int32"},
            ]
        }
        result = await select_tool.execute(config, {"input": sample_lazyframe})

        df = result["output"].collect()
        assert df.schema["salary"] == pl.Int32
        assert df["salary"].to_list() == [50000, 60000, 55000]

    @pytest.mark.asyncio
    async def test_string_truncation(self, select_tool, sample_lazyframe):
        """Should truncate strings to specified size"""
        config = {
            "columnConfigs": [
                {"name": "name", "selected": True, "size": 3},
                {"name": "city", "selected": True, "size": 5},
            ]
        }
        result = await select_tool.execute(config, {"input": sample_lazyframe})

        df = result["output"].collect()
        assert df["name"].to_list() == ["Ali", "Bob", "Cha"]
        assert df["city"].to_list() == ["New Y", "Los A", "Chica"]

    @pytest.mark.asyncio
    async def test_combined_operations(self, select_tool, sample_lazyframe):
        """Should handle select, rename, reorder, and cast together"""
        config = {
            "columnConfigs": [
                {"name": "salary", "selected": True, "rename": "pay", "targetType": "Int64"},
                {"name": "name", "selected": True, "rename": "person", "size": 4},
                {"name": "age", "selected": False},
                {"name": "city", "selected": False},
            ]
        }
        result = await select_tool.execute(config, {"input": sample_lazyframe})

        df = result["output"].collect()
        assert df.columns == ["pay", "person"]
        assert df.schema["pay"] == pl.Int64
        assert df["person"].to_list() == ["Alic", "Bob", "Char"]


class TestSelectToolSchema:
    """Test SelectTool.get_output_schema method"""

    @pytest.mark.asyncio
    async def test_pass_through_schema(self, select_tool, sample_schema):
        """Empty config should return unchanged schema"""
        result = await select_tool.get_output_schema({}, {"input": sample_schema})

        assert "output" in result
        assert result["output"].columns == sample_schema.columns

    @pytest.mark.asyncio
    async def test_select_columns_schema(self, select_tool, sample_schema):
        """Should filter columns in schema"""
        config = {
            "columnConfigs": [
                {"name": "name", "selected": True},
                {"name": "age", "selected": False},
                {"name": "city", "selected": True},
                {"name": "salary", "selected": False},
            ]
        }
        result = await select_tool.get_output_schema(config, {"input": sample_schema})

        assert len(result["output"].columns) == 2
        assert result["output"].columns[0].name == "name"
        assert result["output"].columns[1].name == "city"

    @pytest.mark.asyncio
    async def test_rename_schema(self, select_tool, sample_schema):
        """Should rename columns in schema"""
        config = {
            "columnConfigs": [
                {"name": "name", "selected": True, "rename": "full_name"},
            ]
        }
        result = await select_tool.get_output_schema(config, {"input": sample_schema})

        assert result["output"].columns[0].name == "full_name"
        assert result["output"].columns[0].dtype == PolarsDataType.STRING

    @pytest.mark.asyncio
    async def test_cast_type_schema(self, select_tool, sample_schema):
        """Should update type in schema when casting"""
        config = {
            "columnConfigs": [
                {"name": "age", "selected": True, "targetType": "Float32"},
            ]
        }
        result = await select_tool.get_output_schema(config, {"input": sample_schema})

        assert result["output"].columns[0].dtype == PolarsDataType.FLOAT32

    @pytest.mark.asyncio
    async def test_reorder_schema(self, select_tool, sample_schema):
        """Should maintain order in schema"""
        config = {
            "columnConfigs": [
                {"name": "salary", "selected": True},
                {"name": "name", "selected": True},
            ]
        }
        result = await select_tool.get_output_schema(config, {"input": sample_schema})

        assert result["output"].columns[0].name == "salary"
        assert result["output"].columns[1].name == "name"


class TestSelectToolValidation:
    """Test SelectTool.validate_config method"""

    @pytest.mark.asyncio
    async def test_empty_config_valid(self, select_tool):
        """Empty config should be valid (pass-through mode)"""
        errors = await select_tool.validate_config({})
        assert errors == []

    @pytest.mark.asyncio
    async def test_empty_column_configs_valid(self, select_tool):
        """Empty columnConfigs should be valid"""
        errors = await select_tool.validate_config({"columnConfigs": []})
        assert errors == []

    @pytest.mark.asyncio
    async def test_all_deselected_invalid(self, select_tool):
        """Should error if all columns are deselected"""
        config = {
            "columnConfigs": [
                {"name": "a", "selected": False},
                {"name": "b", "selected": False},
            ]
        }
        errors = await select_tool.validate_config(config)
        assert any("at least one column" in e.lower() for e in errors)

    @pytest.mark.asyncio
    async def test_duplicate_output_names_invalid(self, select_tool):
        """Should error if output names are duplicated"""
        config = {
            "columnConfigs": [
                {"name": "a", "selected": True, "rename": "same"},
                {"name": "b", "selected": True, "rename": "same"},
            ]
        }
        errors = await select_tool.validate_config(config)
        assert any("duplicate" in e.lower() for e in errors)

    @pytest.mark.asyncio
    async def test_invalid_target_type(self, select_tool):
        """Should error for invalid target type"""
        config = {
            "columnConfigs": [
                {"name": "a", "selected": True, "targetType": "InvalidType"},
            ]
        }
        errors = await select_tool.validate_config(config)
        assert any("invalid target type" in e.lower() for e in errors)

    @pytest.mark.asyncio
    async def test_invalid_size(self, select_tool):
        """Should error for invalid size"""
        config = {
            "columnConfigs": [
                {"name": "a", "selected": True, "size": 0},
            ]
        }
        errors = await select_tool.validate_config(config)
        assert any("positive integer" in e.lower() for e in errors)

    @pytest.mark.asyncio
    async def test_missing_name_invalid(self, select_tool):
        """Should error if column config is missing name"""
        config = {
            "columnConfigs": [
                {"selected": True},
            ]
        }
        errors = await select_tool.validate_config(config)
        assert any("missing 'name'" in e.lower() for e in errors)


class TestSelectToolCodeGeneration:
    """Test SelectTool.to_python_code method"""

    def test_code_gen_pass_through(self):
        """Should generate pass-through code for empty config"""
        from app.domain.tools.implementations.select import SelectTool

        tool = SelectTool()
        config = {}
        input_vars = {"input": "df_input"}

        lines, output_vars = tool.to_python_code("sel1", config, input_vars)

        assert len(lines) == 1
        assert lines[0] == "df_sel1 = df_input"
        assert output_vars == {"output": "df_sel1"}

    def test_code_gen_select_columns(self):
        """Should generate select code for specific columns"""
        from app.domain.tools.implementations.select import SelectTool

        tool = SelectTool()
        config = {
            "columnConfigs": [
                {"name": "id", "selected": True},
                {"name": "name", "selected": True},
                {"name": "age", "selected": False},
            ]
        }
        input_vars = {"input": "df_source"}

        lines, output_vars = tool.to_python_code("select1", config, input_vars)

        # Should have select with 2 columns (age excluded)
        code = "\n".join(lines)
        assert 'pl.col("id")' in code
        assert 'pl.col("name")' in code
        assert 'pl.col("age")' not in code
        assert output_vars == {"output": "df_select1"}

    def test_code_gen_rename_column(self):
        """Should generate code with alias for renamed columns"""
        from app.domain.tools.implementations.select import SelectTool

        tool = SelectTool()
        config = {
            "columnConfigs": [
                {"name": "old_name", "selected": True, "rename": "new_name"},
            ]
        }
        input_vars = {"input": "df_data"}

        lines, output_vars = tool.to_python_code("ren", config, input_vars)

        code = "\n".join(lines)
        assert 'pl.col("old_name")' in code
        assert '.alias("new_name")' in code

    def test_code_gen_cast_type(self):
        """Should generate cast code for type changes"""
        from app.domain.tools.implementations.select import SelectTool

        tool = SelectTool()
        config = {
            "columnConfigs": [
                {"name": "value", "selected": True, "targetType": "Float64"},
            ]
        }
        input_vars = {"input": "df"}

        lines, output_vars = tool.to_python_code("cast", config, input_vars)

        code = "\n".join(lines)
        assert ".cast(pl.Float64)" in code

    def test_code_gen_string_truncation(self):
        """Should generate str.head code for size limit"""
        from app.domain.tools.implementations.select import SelectTool

        tool = SelectTool()
        config = {
            "columnConfigs": [
                {"name": "text", "selected": True, "targetType": "String", "size": 50},
            ]
        }
        input_vars = {"input": "df"}

        lines, output_vars = tool.to_python_code("trunc", config, input_vars)

        code = "\n".join(lines)
        assert ".str.head(50)" in code

    def test_code_gen_combined_operations(self):
        """Should generate code combining select, rename, cast, and truncate"""
        from app.domain.tools.implementations.select import SelectTool

        tool = SelectTool()
        config = {
            "columnConfigs": [
                {"name": "id", "selected": True, "targetType": "UInt16"},
                {
                    "name": "description",
                    "selected": True,
                    "rename": "desc",
                    "targetType": "String",
                    "size": 100,
                },
                {"name": "unused", "selected": False},
            ]
        }
        input_vars = {"input": "df_in"}

        lines, output_vars = tool.to_python_code("combined", config, input_vars)

        code = "\n".join(lines)
        # id with cast
        assert 'pl.col("id").cast(pl.UInt16)' in code
        # description with cast, truncate, and rename
        assert 'pl.col("description")' in code
        assert ".cast(pl.String)" in code
        assert ".str.head(100)" in code
        assert '.alias("desc")' in code
        # unused should not be present
        assert "unused" not in code

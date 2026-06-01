"""Tests for YXDB input/output functionality via SigilYX"""

from pathlib import Path

import polars as pl
import pytest
import sigilyx
from app.domain.datasources.factory import DataSourceFactory
from app.domain.datasources.yxdb import YxdbDataSource
from app.domain.tools.implementations.input import InputTool
from app.domain.tools.implementations.output import OutputTool
from app.domain.tools.loaders.factory import LoaderFactory

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def titanic_yxdb() -> Path:
    """Path to the titanic YXDB fixture"""
    path = FIXTURES_DIR / "titanic.yxdb"
    assert path.exists(), f"Fixture not found: {path}"
    return path


@pytest.fixture
def sample_yxdb(tmp_path: Path) -> Path:
    """Create a small sample YXDB file for testing"""
    yxdb_path = tmp_path / "sample.yxdb"

    df = pl.DataFrame(
        {
            "id": [1, 2, 3, 4, 5],
            "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
            "age": [25, 30, 35, 40, 45],
            "score": [85.5, 92.0, 78.3, 88.7, 95.2],
            "active": [True, True, False, True, False],
        }
    )

    sigilyx.write_yxdb(str(yxdb_path), df)
    return yxdb_path


# ---------------------------------------------------------------------------
# DataSource Tests
# ---------------------------------------------------------------------------


class TestYxdbDataSource:
    """Tests for YxdbDataSource (inspect + preview)"""

    @pytest.mark.asyncio
    async def test_inspect_returns_schema(self, sample_yxdb: Path):
        """Test inspect() returns correct column schema"""
        ds = YxdbDataSource()
        schema = await ds.inspect(str(sample_yxdb), {})

        assert len(schema.columns) == 5
        assert schema.columns[0].name == "id"
        assert schema.columns[1].name == "name"
        assert schema.columns[2].name == "age"
        assert schema.columns[3].name == "score"
        assert schema.columns[4].name == "active"

    @pytest.mark.asyncio
    async def test_inspect_reports_file_size(self, sample_yxdb: Path):
        """Test inspect() populates file_size_bytes"""
        ds = YxdbDataSource()
        schema = await ds.inspect(str(sample_yxdb), {})

        assert schema.file_size_bytes is not None
        assert schema.file_size_bytes > 0

    @pytest.mark.asyncio
    async def test_inspect_reports_row_count(self, sample_yxdb: Path):
        """Test inspect() gets exact row count from YXDB header"""
        ds = YxdbDataSource()
        schema = await ds.inspect(str(sample_yxdb), {})

        assert schema.row_count == 5

    @pytest.mark.asyncio
    async def test_inspect_titanic(self, titanic_yxdb: Path):
        """Test inspect() on the titanic dataset"""
        ds = YxdbDataSource()
        schema = await ds.inspect(str(titanic_yxdb), {})

        assert schema.row_count == 891
        assert len(schema.columns) == 12
        column_names = [c.name for c in schema.columns]
        assert "PassengerId" in column_names
        assert "Name" in column_names
        assert "Survived" in column_names

    @pytest.mark.asyncio
    async def test_preview_returns_data(self, sample_yxdb: Path):
        """Test preview() returns correct rows"""
        ds = YxdbDataSource()
        preview = await ds.preview(str(sample_yxdb), {}, max_rows=3)

        assert preview.returned_rows == 3
        assert len(preview.data) == 3
        assert preview.data[0]["name"] == "Alice"
        assert preview.data[1]["age"] == 30
        assert preview.data[2]["score"] == 78.3

    @pytest.mark.asyncio
    async def test_preview_with_offset(self, sample_yxdb: Path):
        """Test preview() with offset skips rows"""
        ds = YxdbDataSource()
        preview = await ds.preview(str(sample_yxdb), {}, max_rows=2, offset=2)

        assert preview.returned_rows == 2
        assert preview.data[0]["name"] == "Charlie"
        assert preview.data[1]["name"] == "David"

    @pytest.mark.asyncio
    async def test_preview_with_column_filter(self, sample_yxdb: Path):
        """Test preview() with column selection"""
        ds = YxdbDataSource()
        preview = await ds.preview(
            str(sample_yxdb), {}, max_rows=10, columns=["name", "score"]
        )

        assert preview.returned_rows == 5
        for row in preview.data:
            assert set(row.keys()) == {"name", "score"}

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="SigilYX reader panics on compressed titanic.yxdb records"
    )
    async def test_preview_titanic(self, titanic_yxdb: Path):
        """Test preview() on the titanic dataset"""
        ds = YxdbDataSource()
        preview = await ds.preview(str(titanic_yxdb), {}, max_rows=10)

        assert preview.total_rows == 891
        assert preview.returned_rows == 10
        assert "PassengerId" in preview.data[0]

    @pytest.mark.asyncio
    async def test_validate_config_valid(self):
        """Test validate_config() with valid config"""
        ds = YxdbDataSource()
        errors = await ds.validate_config({})
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_validate_config_invalid_n_rows(self):
        """Test validate_config() rejects invalid n_rows"""
        ds = YxdbDataSource()
        errors = await ds.validate_config({"n_rows": -1})
        assert len(errors) == 1
        assert "n_rows" in errors[0]

    @pytest.mark.asyncio
    async def test_validate_config_null_n_rows(self):
        """Test validate_config() allows null n_rows"""
        ds = YxdbDataSource()
        errors = await ds.validate_config({"n_rows": None})
        assert len(errors) == 0


# ---------------------------------------------------------------------------
# Factory Registration Tests
# ---------------------------------------------------------------------------


class TestYxdbFactoryRegistration:
    """Tests for YXDB registration in factories"""

    def test_datasource_factory_creates_yxdb(self):
        """Test DataSourceFactory recognises 'yxdb'"""
        ds = DataSourceFactory.create("yxdb")
        assert isinstance(ds, YxdbDataSource)

    def test_datasource_factory_extension_detection(self):
        """Test .yxdb extension maps to 'yxdb' source type"""
        source_type = DataSourceFactory.detect_source_type("file.yxdb")
        assert source_type == "yxdb"

    def test_datasource_factory_lists_yxdb(self):
        """Test 'yxdb' appears in supported types"""
        assert "yxdb" in DataSourceFactory.list_supported_types()

    def test_loader_factory_creates_yxdb(self):
        """Test LoaderFactory creates a YxdbLoader"""
        from app.domain.tools.loaders.yxdb import YxdbLoader

        loader = LoaderFactory.create("yxdb")
        assert isinstance(loader, YxdbLoader)

    def test_loader_factory_lists_yxdb(self):
        """Test 'yxdb' appears in loader supported types"""
        assert "yxdb" in LoaderFactory.list_supported_types()


# ---------------------------------------------------------------------------
# Input Tool Tests
# ---------------------------------------------------------------------------


class TestYxdbInputTool:
    """Tests for InputTool with YXDB source"""

    @pytest.mark.asyncio
    async def test_basic_read(self, sample_yxdb: Path):
        """Test InputTool reads YXDB and returns a LazyFrame"""
        tool = InputTool()

        config = {"type": "yxdb", "source": str(sample_yxdb)}
        outputs = await tool.execute(config, {})

        assert "output" in outputs
        lf = outputs["output"]
        assert isinstance(lf, pl.LazyFrame)

        df = lf.collect()
        assert len(df) == 5
        assert df["name"][0] == "Alice"

    @pytest.mark.asyncio
    async def test_read_with_n_rows(self, sample_yxdb: Path):
        """Test InputTool respects n_rows limit"""
        tool = InputTool()

        config = {"type": "yxdb", "source": str(sample_yxdb), "n_rows": 2}
        outputs = await tool.execute(config, {})

        df = outputs["output"].collect()
        assert len(df) == 2
        assert df["name"][0] == "Alice"
        assert df["name"][1] == "Bob"

    @pytest.mark.asyncio
    async def test_read_with_column_selection(self, sample_yxdb: Path):
        """Test InputTool respects column selection"""
        tool = InputTool()

        config = {
            "type": "yxdb",
            "source": str(sample_yxdb),
            "columns": ["name", "age"],
        }
        outputs = await tool.execute(config, {})

        df = outputs["output"].collect()
        assert df.columns == ["name", "age"]
        assert len(df) == 5

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="SigilYX reader panics on compressed titanic.yxdb records"
    )
    async def test_read_titanic(self, titanic_yxdb: Path):
        """Test InputTool reads the full titanic YXDB"""
        tool = InputTool()

        config = {"type": "yxdb", "source": str(titanic_yxdb)}
        outputs = await tool.execute(config, {})

        df = outputs["output"].collect()
        assert len(df) == 891
        assert len(df.columns) == 12

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="SigilYX reader panics on compressed titanic.yxdb records"
    )
    async def test_read_titanic_subset(self, titanic_yxdb: Path):
        """Test InputTool with n_rows and columns on titanic"""
        tool = InputTool()

        config = {
            "type": "yxdb",
            "source": str(titanic_yxdb),
            "n_rows": 50,
            "columns": ["Name", "Survived", "Fare"],
        }
        outputs = await tool.execute(config, {})

        df = outputs["output"].collect()
        assert len(df) == 50
        assert df.columns == ["Name", "Survived", "Fare"]

    @pytest.mark.asyncio
    async def test_missing_source_raises(self):
        """Test InputTool raises on missing source"""
        tool = InputTool()
        config = {"type": "yxdb"}

        with pytest.raises(Exception):
            await tool.execute(config, {})

    @pytest.mark.asyncio
    async def test_nonexistent_file_raises(self, tmp_path: Path):
        """Test InputTool raises when file doesn't exist"""
        tool = InputTool()
        config = {"type": "yxdb", "source": str(tmp_path / "nope.yxdb")}

        with pytest.raises(Exception):
            await tool.execute(config, {})


# ---------------------------------------------------------------------------
# Output Tool Tests
# ---------------------------------------------------------------------------


class TestYxdbOutputTool:
    """Tests for OutputTool with YXDB destination"""

    @pytest.mark.asyncio
    async def test_basic_write(self, tmp_path: Path, sample_yxdb: Path):
        """Test OutputTool writes a valid YXDB file"""
        input_tool = InputTool()
        output_tool = OutputTool()

        # Read source
        inputs = await input_tool.execute(
            {"type": "yxdb", "source": str(sample_yxdb)}, {}
        )

        # Write to new file
        output_path = tmp_path / "output.yxdb"
        await output_tool.execute(
            {"type": "yxdb", "destination": str(output_path)},
            {"input": inputs["output"]},
        )

        # Verify output
        assert output_path.exists()
        result = sigilyx.read_yxdb(str(output_path))
        assert len(result) == 5
        assert result["name"][0] == "Alice"

    @pytest.mark.asyncio
    async def test_write_creates_parent_dirs(self, tmp_path: Path, sample_yxdb: Path):
        """Test OutputTool creates nested directories"""
        input_tool = InputTool()
        output_tool = OutputTool()

        inputs = await input_tool.execute(
            {"type": "yxdb", "source": str(sample_yxdb)}, {}
        )

        output_path = tmp_path / "nested" / "deep" / "output.yxdb"
        await output_tool.execute(
            {"type": "yxdb", "destination": str(output_path)},
            {"input": inputs["output"]},
        )

        assert output_path.exists()
        result = sigilyx.read_yxdb(str(output_path))
        assert len(result) == 5

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="SigilYX reader panics on compressed titanic.yxdb records"
    )
    async def test_write_titanic_roundtrip(self, tmp_path: Path, titanic_yxdb: Path):
        """Test full roundtrip: YXDB → InputTool → OutputTool → YXDB → verify"""
        input_tool = InputTool()
        output_tool = OutputTool()

        # Read original
        inputs = await input_tool.execute(
            {"type": "yxdb", "source": str(titanic_yxdb)}, {}
        )

        # Write to new file
        output_path = tmp_path / "titanic_copy.yxdb"
        await output_tool.execute(
            {"type": "yxdb", "destination": str(output_path)},
            {"input": inputs["output"]},
        )

        # Read back and compare
        original = sigilyx.read_yxdb(str(titanic_yxdb))
        copy = sigilyx.read_yxdb(str(output_path))

        assert original.shape == copy.shape
        assert original.columns == copy.columns
        # Compare values (allow float tolerance)
        for col in original.columns:
            if original[col].dtype.is_float():
                assert original[col].to_list() == pytest.approx(
                    copy[col].to_list(), nan_ok=True
                )
            else:
                assert original[col].to_list() == copy[col].to_list()

    @pytest.mark.asyncio
    async def test_write_missing_destination_raises(self, sample_yxdb: Path):
        """Test OutputTool raises on missing destination"""
        input_tool = InputTool()
        output_tool = OutputTool()

        inputs = await input_tool.execute(
            {"type": "yxdb", "source": str(sample_yxdb)}, {}
        )

        with pytest.raises(Exception):
            await output_tool.execute(
                {"type": "yxdb"},
                {"input": inputs["output"]},
            )

    @pytest.mark.asyncio
    async def test_validate_config_includes_yxdb(self):
        """Test OutputTool.validate_config accepts yxdb type"""
        tool = OutputTool()

        errors = await tool.validate_config(
            {"type": "yxdb", "destination": "/tmp/out.yxdb"}
        )
        type_errors = [e for e in errors if "Unsupported output type" in e]
        assert len(type_errors) == 0


# ---------------------------------------------------------------------------
# Cross-format Roundtrip Tests
# ---------------------------------------------------------------------------


class TestYxdbCrossFormat:
    """Test converting between YXDB and other formats"""

    @pytest.mark.asyncio
    async def test_csv_to_yxdb(self, tmp_path: Path):
        """Test reading CSV and writing as YXDB"""
        input_tool = InputTool()
        output_tool = OutputTool()

        csv_path = FIXTURES_DIR / "titanic.csv"
        yxdb_path = tmp_path / "from_csv.yxdb"

        # Read CSV
        inputs = await input_tool.execute(
            {"type": "csv", "source": str(csv_path), "csvMode": "read"}, {}
        )

        # Write as YXDB
        await output_tool.execute(
            {"type": "yxdb", "destination": str(yxdb_path)},
            {"input": inputs["output"]},
        )

        # Verify
        result = sigilyx.read_yxdb(str(yxdb_path))
        assert result.shape == (891, 12)
        assert "PassengerId" in result.columns

    @pytest.mark.asyncio
    @pytest.mark.xfail(
        reason="SigilYX reader panics on compressed titanic.yxdb records"
    )
    async def test_yxdb_to_parquet(self, tmp_path: Path, titanic_yxdb: Path):
        """Test reading YXDB and writing as Parquet"""
        input_tool = InputTool()
        output_tool = OutputTool()

        parquet_path = tmp_path / "from_yxdb.parquet"

        # Read YXDB
        inputs = await input_tool.execute(
            {"type": "yxdb", "source": str(titanic_yxdb)}, {}
        )

        # Write as Parquet
        await output_tool.execute(
            {
                "type": "parquet",
                "destination": str(parquet_path),
                "parquetMode": "write",
            },
            {"input": inputs["output"]},
        )

        # Verify
        result = pl.read_parquet(parquet_path)
        assert result.shape == (891, 12)


# ---------------------------------------------------------------------------
# Code Generation Tests
# ---------------------------------------------------------------------------


class TestYxdbCodeGeneration:
    """Tests for YXDB Python code generation"""

    def test_input_code_generation(self):
        """Test code generation for YXDB input"""
        tool = InputTool()

        config = {"type": "yxdb", "source": "/data/input.yxdb"}
        lines, output_vars = tool.to_python_code("input_1", config, {})

        code = "\n".join(lines)
        assert "import sigilyx" in code
        assert "scan_yxdb" in code
        assert "/data/input.yxdb" in code
        assert "output" in output_vars

    def test_input_code_generation_with_n_rows(self):
        """Test code generation for YXDB input with n_rows"""
        tool = InputTool()

        config = {"type": "yxdb", "source": "/data/input.yxdb", "n_rows": 100}
        lines, output_vars = tool.to_python_code("input_1", config, {})

        code = "\n".join(lines)
        assert "import sigilyx" in code
        assert "scan_yxdb" in code
        assert ".head(100)" in code

    def test_input_code_generation_with_columns(self):
        """Test code generation for YXDB input with column selection"""
        tool = InputTool()

        config = {
            "type": "yxdb",
            "source": "/data/input.yxdb",
            "columns": ["name", "age"],
        }
        lines, output_vars = tool.to_python_code("input_1", config, {})

        code = "\n".join(lines)
        assert "import sigilyx" in code
        assert ".select(" in code
        assert '"name"' in code
        assert '"age"' in code

    def test_output_code_generation(self):
        """Test code generation for YXDB output"""
        tool = OutputTool()

        config = {"type": "yxdb", "destination": "/data/output.yxdb"}
        lines, output_vars = tool.to_python_code("output_1", config, {"input": "df"})

        code = "\n".join(lines)
        assert "import sigilyx" in code
        assert "sink_yxdb" in code
        assert "/data/output.yxdb" in code

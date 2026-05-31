"""Tests for QVD (QlikView Data) input functionality via OpenQVD"""

from pathlib import Path

import openqvd
import polars as pl
import pytest
from app.domain.datasources.factory import DataSourceFactory
from app.domain.datasources.qvd import QvdDataSource
from app.domain.tools.implementations.input import InputTool
from app.domain.tools.loaders.factory import LoaderFactory

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_qvd(tmp_path: Path) -> Path:
    """Create a small sample QVD file for testing"""
    qvd_path = tmp_path / "sample.qvd"

    df = pl.DataFrame(
        {
            "id": [1, 2, 3, 4, 5],
            "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
            "age": [25, 30, 35, 40, 45],
            "score": [85.5, 92.0, 78.3, 88.7, 95.2],
            "city": ["NY", "LA", "SF", "SEA", "BOS"],
        }
    )

    openqvd.write(df.to_arrow(), str(qvd_path))
    return qvd_path


# ---------------------------------------------------------------------------
# DataSource Tests
# ---------------------------------------------------------------------------


class TestQvdDataSource:
    """Tests for QvdDataSource (inspect + preview)"""

    @pytest.mark.asyncio
    async def test_inspect_returns_schema(self, sample_qvd: Path):
        """Test inspect() returns correct column schema"""
        ds = QvdDataSource()
        schema = await ds.inspect(str(sample_qvd), {})

        assert len(schema.columns) == 5
        assert schema.columns[0].name == "id"
        assert schema.columns[1].name == "name"
        assert schema.columns[2].name == "age"
        assert schema.columns[3].name == "score"
        assert schema.columns[4].name == "city"

    @pytest.mark.asyncio
    async def test_inspect_reports_file_size(self, sample_qvd: Path):
        """Test inspect() populates file_size_bytes"""
        ds = QvdDataSource()
        schema = await ds.inspect(str(sample_qvd), {})

        assert schema.file_size_bytes is not None
        assert schema.file_size_bytes > 0

    @pytest.mark.asyncio
    async def test_inspect_reports_row_count(self, sample_qvd: Path):
        """Test inspect() gets exact row count"""
        ds = QvdDataSource()
        schema = await ds.inspect(str(sample_qvd), {})

        assert schema.row_count == 5

    @pytest.mark.asyncio
    async def test_preview_returns_data(self, sample_qvd: Path):
        """Test preview() returns correct rows"""
        ds = QvdDataSource()
        preview = await ds.preview(str(sample_qvd), {}, max_rows=3)

        assert preview.returned_rows == 3
        assert len(preview.data) == 3
        assert preview.data[0]["name"] == "Alice"
        assert preview.data[1]["age"] == 30
        assert preview.data[2]["score"] == 78.3

    @pytest.mark.asyncio
    async def test_preview_with_offset(self, sample_qvd: Path):
        """Test preview() with offset skips rows"""
        ds = QvdDataSource()
        preview = await ds.preview(str(sample_qvd), {}, max_rows=2, offset=2)

        assert preview.returned_rows == 2
        assert preview.data[0]["name"] == "Charlie"
        assert preview.data[1]["name"] == "David"

    @pytest.mark.asyncio
    async def test_preview_with_column_filter(self, sample_qvd: Path):
        """Test preview() with column selection"""
        ds = QvdDataSource()
        preview = await ds.preview(
            str(sample_qvd), {}, max_rows=10, columns=["name", "score"]
        )

        assert preview.returned_rows == 5
        for row in preview.data:
            assert set(row.keys()) == {"name", "score"}

    @pytest.mark.asyncio
    async def test_validate_config_valid(self):
        """Test validate_config() with valid config"""
        ds = QvdDataSource()
        errors = await ds.validate_config({})
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_validate_config_invalid_n_rows(self):
        """Test validate_config() rejects invalid n_rows"""
        ds = QvdDataSource()
        errors = await ds.validate_config({"n_rows": -1})
        assert len(errors) == 1
        assert "n_rows" in errors[0]

    @pytest.mark.asyncio
    async def test_validate_config_null_n_rows(self):
        """Test validate_config() allows null n_rows"""
        ds = QvdDataSource()
        errors = await ds.validate_config({"n_rows": None})
        assert len(errors) == 0


# ---------------------------------------------------------------------------
# Factory Registration Tests
# ---------------------------------------------------------------------------


class TestQvdFactoryRegistration:
    """Tests for QVD registration in factories"""

    def test_datasource_factory_creates_qvd(self):
        """Test DataSourceFactory recognises 'qvd'"""
        ds = DataSourceFactory.create("qvd")
        assert isinstance(ds, QvdDataSource)

    def test_datasource_factory_extension_detection(self):
        """Test .qvd extension maps to 'qvd' source type"""
        source_type = DataSourceFactory.detect_source_type("file.qvd")
        assert source_type == "qvd"

    def test_datasource_factory_lists_qvd(self):
        """Test 'qvd' appears in supported types"""
        assert "qvd" in DataSourceFactory.list_supported_types()

    def test_loader_factory_creates_qvd(self):
        """Test LoaderFactory creates a QvdLoader"""
        from app.domain.tools.loaders.qvd import QvdLoader

        loader = LoaderFactory.create("qvd")
        assert isinstance(loader, QvdLoader)

    def test_loader_factory_lists_qvd(self):
        """Test 'qvd' appears in loader supported types"""
        assert "qvd" in LoaderFactory.list_supported_types()


# ---------------------------------------------------------------------------
# Input Tool Tests
# ---------------------------------------------------------------------------


class TestQvdInputTool:
    """Tests for InputTool with QVD source"""

    @pytest.mark.asyncio
    async def test_basic_read(self, sample_qvd: Path):
        """Test InputTool reads QVD and returns a LazyFrame"""
        tool = InputTool()

        config = {"type": "qvd", "source": str(sample_qvd)}
        outputs = await tool.execute(config, {})

        assert "output" in outputs
        lf = outputs["output"]
        assert isinstance(lf, pl.LazyFrame)

        df = lf.collect()
        assert len(df) == 5
        assert df["name"][0] == "Alice"

    @pytest.mark.asyncio
    async def test_read_with_n_rows(self, sample_qvd: Path):
        """Test InputTool respects n_rows limit"""
        tool = InputTool()

        config = {"type": "qvd", "source": str(sample_qvd), "n_rows": 2}
        outputs = await tool.execute(config, {})

        df = outputs["output"].collect()
        assert len(df) == 2
        assert df["name"][0] == "Alice"
        assert df["name"][1] == "Bob"

    @pytest.mark.asyncio
    async def test_read_with_column_selection(self, sample_qvd: Path):
        """Test InputTool respects column selection"""
        tool = InputTool()

        config = {
            "type": "qvd",
            "source": str(sample_qvd),
            "columns": ["name", "age"],
        }
        outputs = await tool.execute(config, {})

        df = outputs["output"].collect()
        assert df.columns == ["name", "age"]
        assert len(df) == 5

    @pytest.mark.asyncio
    async def test_missing_source_raises(self):
        """Test InputTool raises on missing source"""
        tool = InputTool()
        config = {"type": "qvd"}

        with pytest.raises(Exception):
            await tool.execute(config, {})

    @pytest.mark.asyncio
    async def test_nonexistent_file_raises(self, tmp_path: Path):
        """Test InputTool raises when file doesn't exist"""
        tool = InputTool()
        config = {"type": "qvd", "source": str(tmp_path / "nope.qvd")}

        with pytest.raises(Exception):
            await tool.execute(config, {})

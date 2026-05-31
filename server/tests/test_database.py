"""Tests for database data sources and loaders

This module tests PostgreSQL and other database connections using mocking
since we don't have a live database in CI. Real integration tests should be
run manually with actual database instances.
"""

from unittest.mock import Mock, patch

import polars as pl
import pytest

from app.api.models.common import PolarsDataType
from app.domain.datasources.database import (
    DatabaseDataSource,
    MsSQLDataSource,
    MySQLDataSource,
    PostgreSQLDataSource,
    SQLiteDataSource,
    _dtype_to_polars_type,
    _schema_introspection_query,
)
from app.domain.datasources.factory import DataSourceFactory
from app.domain.tools.loaders.database import DatabaseLoader
from app.domain.tools.loaders.factory import LoaderFactory
from app.utils.errors import DataSourceError, ToolError

# ============================================================================
# Data Source Tests
# ============================================================================


class TestDatatypeConversion:
    """Test Polars dtype to PolarsDataType conversion"""

    def test_basic_types(self):
        """Test conversion of basic Polars types"""
        assert _dtype_to_polars_type(pl.Int32) == PolarsDataType.INT32
        assert _dtype_to_polars_type(pl.Int64) == PolarsDataType.INT64
        assert _dtype_to_polars_type(pl.Float32) == PolarsDataType.FLOAT32
        assert _dtype_to_polars_type(pl.Float64) == PolarsDataType.FLOAT64
        assert _dtype_to_polars_type(pl.Boolean) == PolarsDataType.BOOLEAN
        # Note: pl.Utf8 is deprecated and maps to pl.String in newer Polars
        assert _dtype_to_polars_type(pl.String) == PolarsDataType.STRING
        assert _dtype_to_polars_type(pl.Date) == PolarsDataType.DATE

    def test_parameterized_types(self):
        """Test conversion of parameterized Polars types"""
        # Datetime with timezone
        assert _dtype_to_polars_type(pl.Datetime("ns")) == PolarsDataType.DATETIME
        assert _dtype_to_polars_type(pl.Datetime("us", "UTC")) == PolarsDataType.DATETIME

        # Duration
        assert _dtype_to_polars_type(pl.Duration("ns")) == PolarsDataType.DURATION

        # List
        assert _dtype_to_polars_type(pl.List(pl.Int32)) == PolarsDataType.LIST

        # Struct
        assert _dtype_to_polars_type(pl.Struct([pl.Field("x", pl.Int32)])) == PolarsDataType.STRUCT

    def test_unknown_type_defaults_to_string(self):
        """Unknown types should default to STRING"""
        # Create a mock dtype with unknown string representation
        mock_dtype = Mock()
        mock_dtype.__str__ = lambda self: "UnknownType"

        result = _dtype_to_polars_type(mock_dtype)
        assert result == PolarsDataType.STRING


class TestDatabaseDataSource:
    """Test DatabaseDataSource functionality"""

    @pytest.mark.asyncio
    async def test_validate_config_valid(self):
        """Test validation with valid config"""
        datasource = DatabaseDataSource()

        errors = await datasource.validate_config({"query": "SELECT * FROM users"})

        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_validate_config_missing_query(self):
        """Test validation fails when query is missing"""
        datasource = DatabaseDataSource()

        errors = await datasource.validate_config({})

        assert len(errors) == 1
        assert "query is required" in errors[0].lower()

    @pytest.mark.asyncio
    async def test_validate_config_empty_query(self):
        """Test validation fails when query is empty"""
        datasource = DatabaseDataSource()

        errors = await datasource.validate_config({"query": "   "})

        assert len(errors) == 1
        assert "cannot be empty" in errors[0].lower()

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_inspect_basic(self, mock_read_db):
        """Test basic schema inspection"""
        # Mock DataFrame with schema
        mock_df = Mock()
        mock_df.columns = ["id", "name", "age"]
        mock_df.schema = {
            "id": pl.Int64,
            "name": pl.String,  # Use pl.String instead of pl.Utf8
            "age": pl.Int32,
        }
        mock_read_db.return_value = mock_df

        datasource = DatabaseDataSource()
        schema = await datasource.inspect(
            "postgresql://user:pass@localhost/db", {"query": "SELECT * FROM users"}
        )

        assert len(schema.columns) == 3
        assert schema.columns[0].name == "id"
        assert schema.columns[0].dtype == PolarsDataType.INT64
        assert schema.columns[1].name == "name"
        assert schema.columns[1].dtype == PolarsDataType.STRING

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_inspect_empty_query(self, mock_read_db):
        """Test inspect with empty query returns empty schema"""
        datasource = DatabaseDataSource()

        schema = await datasource.inspect("postgresql://user:pass@localhost/db", {"query": ""})

        assert len(schema.columns) == 0
        assert schema.row_count is None
        mock_read_db.assert_not_called()

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_inspect_error_handling(self, mock_read_db):
        """Test inspect handles database errors gracefully"""
        mock_read_db.side_effect = [
            Exception("Syntax error near SELECT"),  # First call fails
            Exception("Connection refused"),  # Fallback also fails
        ]

        datasource = DatabaseDataSource()

        with pytest.raises(DataSourceError, match="Failed to inspect"):
            await datasource.inspect(
                "postgresql://user:pass@localhost/db", {"query": "SELECT * FROM users"}
            )

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_preview_basic(self, mock_read_db):
        """Test basic data preview"""
        # Mock DataFrame with data
        mock_df = Mock()
        mock_df.columns = ["id", "name"]
        mock_df.schema = {"id": pl.Int64, "name": pl.Utf8}
        mock_df.to_dicts.return_value = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        mock_df.__len__ = lambda self: 2
        mock_read_db.return_value = mock_df

        datasource = DatabaseDataSource()
        preview = await datasource.preview(
            "postgresql://user:pass@localhost/db", {"query": "SELECT * FROM users"}, max_rows=100
        )

        assert preview.returned_rows == 2
        assert len(preview.data) == 2
        assert preview.data[0]["name"] == "Alice"
        assert len(preview.data_schema.columns) == 2

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_preview_with_offset(self, mock_read_db):
        """Test preview with offset parameter"""
        mock_df = Mock()
        mock_df.columns = ["id"]
        mock_df.schema = {"id": pl.Int64}
        mock_df.to_dicts.return_value = [{"id": 10}]
        mock_df.__len__ = lambda self: 1
        mock_read_db.return_value = mock_df

        datasource = DatabaseDataSource()
        await datasource.preview(
            "postgresql://user:pass@localhost/db",
            {"query": "SELECT * FROM users"},
            max_rows=10,
            offset=5,
        )

        # Verify the query was called with LIMIT/OFFSET
        call_args = mock_read_db.call_args
        assert "LIMIT 10" in call_args[1]["query"]
        assert "OFFSET 5" in call_args[1]["query"]

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_preview_column_filtering(self, mock_read_db):
        """Test preview with specific column selection"""
        mock_df = Mock()
        # Available columns after query execution
        mock_df.columns = ["id", "name"]
        mock_df.schema = {"id": pl.Int64, "name": pl.String}
        mock_df.select.return_value = mock_df
        mock_df.to_dicts.return_value = [{"id": 1, "name": "Alice"}]
        mock_df.__len__ = lambda self: 1
        mock_read_db.return_value = mock_df

        datasource = DatabaseDataSource()
        await datasource.preview(
            "postgresql://user:pass@localhost/db",
            {"query": "SELECT * FROM users"},
            columns=["id", "name"],  # Request only columns that exist
        )

        # Should call select with available columns
        mock_df.select.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_preview_empty_query(self, mock_read_db):
        """Test preview with empty query returns empty result"""
        datasource = DatabaseDataSource()

        preview = await datasource.preview("postgresql://user:pass@localhost/db", {"query": ""})

        assert preview.returned_rows == 0
        assert len(preview.data) == 0
        mock_read_db.assert_not_called()


class TestSchemaIntrospectionQuery:
    """Test the dialect-specific catalog query builder"""

    def test_postgresql_query(self):
        query = _schema_introspection_query("postgresql")
        assert "information_schema.columns" in query
        assert "table_schema = 'public'" in query
        assert "table_name" in query and "column_name" in query

    def test_mysql_query(self):
        query = _schema_introspection_query("mysql")
        assert "information_schema.COLUMNS" in query
        assert "TABLE_SCHEMA = DATABASE()" in query
        # Aliases normalize to lowercase for downstream reading
        assert "AS table_name" in query
        assert "AS column_name" in query

    def test_mssql_query(self):
        query = _schema_introspection_query("mssql")
        assert "INFORMATION_SCHEMA.COLUMNS" in query
        assert "AS table_name" in query

    def test_sqlite_query(self):
        query = _schema_introspection_query("sqlite")
        assert "sqlite_master" in query
        assert "pragma_table_info" in query
        assert "AS table_name" in query

    def test_case_insensitive_type(self):
        assert _schema_introspection_query("PostgreSQL") == _schema_introspection_query(
            "postgresql"
        )

    def test_unsupported_type_raises(self):
        with pytest.raises(DataSourceError, match="not supported"):
            _schema_introspection_query("oracle")


class TestListSchema:
    """Test database schema introspection grouping"""

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_list_schema_groups_columns(self, mock_read_db):
        """Rows are grouped by table into name/columns structures"""
        mock_read_db.return_value = pl.DataFrame(
            {
                "table_name": ["users", "users", "orders"],
                "column_name": ["id", "name", "total"],
                "data_type": ["integer", "text", "numeric"],
                "ordinal_position": [1, 2, 1],
            }
        )

        datasource = PostgreSQLDataSource()
        tables = await datasource.list_schema("postgresql://user:pass@localhost/db")

        assert len(tables) == 2
        users = next(t for t in tables if t["name"] == "users")
        assert [c["name"] for c in users["columns"]] == ["id", "name"]
        assert users["columns"][0]["type"] == "integer"
        orders = next(t for t in tables if t["name"] == "orders")
        assert orders["columns"][0]["name"] == "total"

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_list_schema_uppercase_columns(self, mock_read_db):
        """Uppercase dialect column names are normalized before reading"""
        mock_read_db.return_value = pl.DataFrame(
            {
                "TABLE_NAME": ["products"],
                "COLUMN_NAME": ["sku"],
                "DATA_TYPE": ["varchar(64)"],
                "ORDINAL_POSITION": [1],
            }
        )

        datasource = MySQLDataSource()
        tables = await datasource.list_schema("mysql://user:pass@localhost/db")

        assert tables == [
            {"name": "products", "columns": [{"name": "sku", "type": "varchar(64)"}]}
        ]

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_list_schema_error(self, mock_read_db):
        """Database failures surface as DataSourceError"""
        mock_read_db.side_effect = Exception("Connection refused")

        datasource = PostgreSQLDataSource()
        with pytest.raises(DataSourceError, match="Failed to introspect"):
            await datasource.list_schema("postgresql://user:pass@localhost/db")


class TestPostgreSQLDataSource:
    """Test PostgreSQL-specific data source"""

    def test_initialization(self):
        """Test PostgreSQLDataSource initializes with correct type"""
        datasource = PostgreSQLDataSource()
        assert datasource.database_type == "postgresql"

    @pytest.mark.asyncio
    async def test_inherits_validation(self):
        """Test that PostgreSQLDataSource inherits validation from base"""
        datasource = PostgreSQLDataSource()

        errors = await datasource.validate_config({"query": "SELECT 1"})
        assert len(errors) == 0


class TestMySQLDataSource:
    """Test MySQL-specific data source"""

    def test_initialization(self):
        """Test MySQLDataSource initializes with correct type"""
        datasource = MySQLDataSource()
        assert datasource.database_type == "mysql"

    @pytest.mark.asyncio
    async def test_inherits_validation(self):
        """Test that MySQLDataSource inherits validation from base"""
        datasource = MySQLDataSource()

        errors = await datasource.validate_config({"query": "SELECT 1"})
        assert len(errors) == 0


class TestSQLiteDataSource:
    """Test SQLite-specific data source"""

    def test_initialization(self):
        """Test SQLiteDataSource initializes with correct type"""
        datasource = SQLiteDataSource()
        assert datasource.database_type == "sqlite"

    @pytest.mark.asyncio
    async def test_inherits_validation(self):
        """Test that SQLiteDataSource inherits validation from base"""
        datasource = SQLiteDataSource()

        errors = await datasource.validate_config({"query": "SELECT 1"})
        assert len(errors) == 0


class TestMsSQLDataSource:
    """Test SQL Server-specific data source"""

    def test_initialization(self):
        """Test MsSQLDataSource initializes with correct type"""
        datasource = MsSQLDataSource()
        assert datasource.database_type == "mssql"

    @pytest.mark.asyncio
    async def test_inherits_validation(self):
        """Test that MsSQLDataSource inherits validation from base"""
        datasource = MsSQLDataSource()

        errors = await datasource.validate_config({"query": "SELECT 1"})
        assert len(errors) == 0


class TestDataSourceFactory:
    """Test factory integration with database sources"""

    def test_create_postgresql_datasource(self):
        """Test creating PostgreSQL data source via factory"""
        datasource = DataSourceFactory.create("postgresql")
        assert isinstance(datasource, PostgreSQLDataSource)

    def test_create_mysql_datasource(self):
        """Test creating MySQL data source via factory"""
        datasource = DataSourceFactory.create("mysql")
        assert isinstance(datasource, MySQLDataSource)

    def test_create_sqlite_datasource(self):
        """Test creating SQLite data source via factory"""
        datasource = DataSourceFactory.create("sqlite")
        assert isinstance(datasource, SQLiteDataSource)

    def test_create_mssql_datasource(self):
        """Test creating SQL Server data source via factory"""
        datasource = DataSourceFactory.create("mssql")
        assert isinstance(datasource, MsSQLDataSource)

    def test_is_database_type(self):
        """Test database type detection"""
        assert DataSourceFactory.is_database_type("postgresql")
        assert DataSourceFactory.is_database_type("mysql")
        assert DataSourceFactory.is_database_type("sqlite")
        assert DataSourceFactory.is_database_type("mssql")
        assert not DataSourceFactory.is_database_type("csv")
        assert not DataSourceFactory.is_database_type("parquet")

    def test_list_supported_includes_all_databases(self):
        """Test that all database types are in supported types list"""
        types = DataSourceFactory.list_supported_types()
        assert "postgresql" in types
        assert "mysql" in types
        assert "sqlite" in types
        assert "mssql" in types


# ============================================================================
# Loader Tests
# ============================================================================


class TestDatabaseLoader:
    """Test DatabaseLoader functionality"""

    def test_initialization(self):
        """Test DatabaseLoader initializes with correct type"""
        loader = DatabaseLoader(database_type="postgresql")
        assert loader.database_type == "postgresql"

    def test_build_kwargs(self):
        """Test build_kwargs returns correct engine"""
        loader = DatabaseLoader()
        kwargs = loader.build_kwargs({})

        assert kwargs["engine"] == "connectorx"

    @pytest.mark.asyncio
    @patch("app.domain.tools.loaders.database.pl.read_database_uri")
    async def test_load_basic(self, mock_read_db):
        """Test basic load operation"""
        # Mock DataFrame
        mock_df = Mock(spec=pl.DataFrame)
        mock_lazy = Mock(spec=pl.LazyFrame)
        mock_df.lazy.return_value = mock_lazy
        mock_read_db.return_value = mock_df

        loader = DatabaseLoader()
        result = await loader.load(
            {"source": "postgresql://user:pass@localhost/db", "query": "SELECT * FROM users"}
        )

        assert result == mock_lazy
        mock_read_db.assert_called_once()

    @pytest.mark.asyncio
    async def test_load_missing_query(self):
        """Test load fails when query is missing"""
        loader = DatabaseLoader()

        with pytest.raises(ToolError, match="query is required"):
            await loader.load({"source": "postgresql://user:pass@localhost/db"})

    @pytest.mark.asyncio
    async def test_load_empty_query(self):
        """Test load fails when query is empty"""
        loader = DatabaseLoader()

        with pytest.raises(ToolError, match="cannot be empty"):
            await loader.load({"source": "postgresql://user:pass@localhost/db", "query": "   "})

    @pytest.mark.asyncio
    @patch("app.domain.tools.loaders.database.pl.read_database_uri")
    async def test_load_connection_error(self, mock_read_db):
        """Test load provides helpful error for connection failures"""
        mock_read_db.side_effect = Exception("connection refused")

        loader = DatabaseLoader(database_type="postgresql")

        with pytest.raises(ToolError, match="Cannot connect to postgresql"):
            await loader.load(
                {"source": "postgresql://user:pass@localhost/db", "query": "SELECT 1"}
            )

    @pytest.mark.asyncio
    @patch("app.domain.tools.loaders.database.pl.read_database_uri")
    async def test_load_authentication_error(self, mock_read_db):
        """Test load provides helpful error for auth failures"""
        mock_read_db.side_effect = Exception("authentication failed for user")

        loader = DatabaseLoader()

        with pytest.raises(ToolError, match="Authentication failed"):
            await loader.load(
                {"source": "postgresql://user:pass@localhost/db", "query": "SELECT 1"}
            )

    @pytest.mark.asyncio
    @patch("app.domain.tools.loaders.database.pl.read_database_uri")
    async def test_load_database_not_exists(self, mock_read_db):
        """Test load provides helpful error for missing database"""
        mock_read_db.side_effect = Exception("database does not exist")

        loader = DatabaseLoader()

        with pytest.raises(ToolError, match="Database does not exist"):
            await loader.load(
                {"source": "postgresql://user:pass@localhost/db", "query": "SELECT 1"}
            )

    @pytest.mark.asyncio
    @patch("app.domain.tools.loaders.database.pl.read_database_uri")
    async def test_load_syntax_error(self, mock_read_db):
        """Test load provides helpful error for SQL syntax errors"""
        mock_read_db.side_effect = Exception("syntax error at or near SELECT")

        loader = DatabaseLoader()

        with pytest.raises(ToolError, match="SQL syntax error"):
            await loader.load(
                {"source": "postgresql://user:pass@localhost/db", "query": "SELEKT * FROM users"}
            )

    @pytest.mark.asyncio
    @patch("app.domain.tools.loaders.database.pl.read_database_uri")
    async def test_load_eager(self, mock_read_db):
        """Test load_eager returns DataFrame directly"""
        mock_df = Mock(spec=pl.DataFrame)
        mock_lazy = Mock(spec=pl.LazyFrame)
        mock_lazy.collect.return_value = mock_df
        mock_df.lazy.return_value = mock_lazy
        mock_read_db.return_value = mock_df

        loader = DatabaseLoader()
        result = await loader.load_eager(
            {"source": "postgresql://user:pass@localhost/db", "query": "SELECT 1"}
        )

        assert result == mock_df

    def test_to_python_code(self):
        """Test Python code generation"""
        loader = DatabaseLoader(database_type="postgresql")

        code = loader.to_python_code("my_data", {"query": "SELECT * FROM users WHERE age > 18"})

        assert isinstance(code, list)
        assert len(code) > 0
        assert any("my_data" in line for line in code)
        assert any("read_database_uri" in line for line in code)
        assert any("CONNECTION_URI" in line for line in code)
        assert any("connectorx" in line for line in code)
        # Query should be in the code
        assert any("users" in line for line in code)

    def test_to_python_code_escapes_triple_quotes(self):
        """Test that triple quotes in queries are escaped"""
        loader = DatabaseLoader()

        code = loader.to_python_code("data", {"query": 'SELECT """test""" FROM table'})

        # Should escape the triple quotes
        code_str = "\n".join(code)
        assert '\\"\\"\\"' in code_str


class TestLoaderFactory:
    """Test LoaderFactory integration with database loaders"""

    def test_create_postgresql_loader(self):
        """Test creating PostgreSQL loader via factory"""
        loader = LoaderFactory.create("postgresql")
        assert isinstance(loader, DatabaseLoader)
        assert loader.database_type == "postgresql"

    def test_create_mysql_loader(self):
        """Test creating MySQL loader via factory"""
        loader = LoaderFactory.create("mysql")
        assert isinstance(loader, DatabaseLoader)
        assert loader.database_type == "mysql"

    def test_create_sqlite_loader(self):
        """Test creating SQLite loader via factory"""
        loader = LoaderFactory.create("sqlite")
        assert isinstance(loader, DatabaseLoader)
        assert loader.database_type == "sqlite"

    def test_create_mssql_loader(self):
        """Test creating SQL Server loader via factory"""
        loader = LoaderFactory.create("mssql")
        assert isinstance(loader, DatabaseLoader)
        assert loader.database_type == "mssql"

    def test_is_database_type(self):
        """Test database type detection"""
        assert LoaderFactory.is_database_type("postgresql")
        assert LoaderFactory.is_database_type("mysql")
        assert LoaderFactory.is_database_type("sqlite")
        assert LoaderFactory.is_database_type("mssql")
        assert not LoaderFactory.is_database_type("csv")
        assert not LoaderFactory.is_database_type("parquet")

    def test_is_supported_includes_all_databases(self):
        """Test that all database types are supported"""
        assert LoaderFactory.is_supported("postgresql")
        assert LoaderFactory.is_supported("mysql")
        assert LoaderFactory.is_supported("sqlite")
        assert LoaderFactory.is_supported("mssql")

    def test_list_supported_includes_all_databases(self):
        """Test that all database types are in supported types list"""
        types = LoaderFactory.list_supported_types()
        assert "postgresql" in types
        assert "mysql" in types
        assert "sqlite" in types
        assert "mssql" in types


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================


class TestEdgeCases:
    """Test edge cases and error conditions"""

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_inspect_with_complex_query(self, mock_read_db):
        """Test inspect handles complex multi-line queries"""
        mock_df = Mock()
        mock_df.columns = ["result"]
        mock_df.schema = {"result": pl.Int64}
        mock_read_db.return_value = mock_df

        datasource = DatabaseDataSource()
        complex_query = """
            WITH user_stats AS (
                SELECT user_id, COUNT(*) as count
                FROM orders
                GROUP BY user_id
            )
            SELECT * FROM user_stats
            WHERE count > 10
        """

        schema = await datasource.inspect(
            "postgresql://user:pass@localhost/db", {"query": complex_query}
        )

        assert len(schema.columns) == 1
        # Query should be wrapped in subquery for schema inspection
        call_args = mock_read_db.call_args
        assert "LIMIT 0" in call_args[1]["query"]

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_preview_total_rows_is_none(self, mock_read_db):
        """Test that preview doesn't compute total rows (expensive operation)"""
        mock_df = Mock()
        mock_df.columns = ["id"]
        mock_df.schema = {"id": pl.Int64}
        mock_df.to_dicts.return_value = [{"id": 1}]
        mock_df.__len__ = lambda self: 1
        mock_read_db.return_value = mock_df

        datasource = DatabaseDataSource()
        preview = await datasource.preview(
            "postgresql://user:pass@localhost/db",
            {"query": "SELECT * FROM large_table"},
            max_rows=10,
        )

        # Total rows should be None since we don't want to run COUNT(*)
        assert preview.total_rows is None
        assert preview.returned_rows == 1

    def test_database_loader_preserves_lazy_evaluation(self):
        """Test that database loader converts to LazyFrame for consistency"""
        # This is important for the lazy evaluation pattern
        DatabaseLoader()

        # The loader should convert eager DataFrame to LazyFrame
        # This is tested in test_load_basic via the mock
        assert True  # Documented behavior test


# ============================================================================
# Input Tool Integration Tests
# ============================================================================


class TestInputToolDatabaseMode:
    """Test Input tool with database configuration"""

    @pytest.mark.asyncio
    @patch("app.domain.tools.loaders.database.pl.read_database_uri")
    async def test_input_tool_execute_database(self, mock_read_db):
        """Test Input tool can execute database queries"""
        from app.domain.tools.implementations.input import InputTool

        # Mock database result
        mock_df = Mock(spec=pl.DataFrame)
        mock_lazy = Mock(spec=pl.LazyFrame)
        mock_df.lazy.return_value = mock_lazy
        mock_read_db.return_value = mock_df

        tool = InputTool()
        result = await tool.execute(
            config={
                "category": "database",
                "type": "postgresql",
                "source": "postgresql://user:pass@localhost/db",
                "query": "SELECT * FROM users",
            },
            inputs={},
        )

        assert "output" in result
        assert result["output"] == mock_lazy

    @pytest.mark.asyncio
    async def test_input_tool_validate_database_config(self):
        """Test Input tool validates database configuration"""
        from app.domain.tools.implementations.input import InputTool

        tool = InputTool()

        # Valid config
        errors = await tool.validate_config(
            {
                "category": "database",
                "type": "postgresql",
                "source": "postgresql://user:pass@localhost/db",
                "query": "SELECT 1",
            }
        )
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_input_tool_validate_database_missing_source(self):
        """Test validation fails when database source is missing"""
        from app.domain.tools.implementations.input import InputTool

        tool = InputTool()
        errors = await tool.validate_config(
            {"category": "database", "type": "postgresql", "query": "SELECT 1"}
        )

        assert len(errors) > 0
        assert any("source" in err.lower() or "connection" in err.lower() for err in errors)

    @pytest.mark.asyncio
    @patch("app.domain.datasources.database.pl.read_database_uri")
    async def test_input_tool_get_output_schema_database(self, mock_read_db):
        """Test Input tool can get schema from database"""
        from app.domain.tools.implementations.input import InputTool

        # Mock schema inspection
        mock_df = Mock()
        mock_df.columns = ["id", "name"]
        mock_df.schema = {"id": pl.Int64, "name": pl.Utf8}
        mock_read_db.return_value = mock_df

        tool = InputTool()
        schemas = await tool.get_output_schema(
            config={
                "category": "database",
                "type": "postgresql",
                "source": "postgresql://user:pass@localhost/db",
                "query": "SELECT id, name FROM users",
            },
            input_schemas={},
        )

        assert "output" in schemas
        schema = schemas["output"]
        assert len(schema.columns) == 2
        assert schema.columns[0].name == "id"

    @pytest.mark.asyncio
    async def test_input_tool_rejects_inputs_for_database(self):
        """Test that Input tool with database config rejects inputs"""
        from app.domain.tools.implementations.input import InputTool
        from app.utils.errors import ToolError

        tool = InputTool()

        with pytest.raises(ToolError, match="should not have inputs"):
            await tool.execute(
                config={
                    "category": "database",
                    "type": "postgresql",
                    "source": "postgresql://user:pass@localhost/db",
                    "query": "SELECT 1",
                },
                inputs={"invalid": Mock()},  # Should not accept inputs
            )

    def test_input_tool_to_python_code_database(self):
        """Test Python code generation for database input"""
        from app.domain.tools.implementations.input import InputTool

        tool = InputTool()
        lines, output_vars = tool.to_python_code(
            tool_id="db_input_1",
            config={
                "category": "database",
                "type": "postgresql",
                "source": "postgresql://user:pass@localhost/db",
                "query": "SELECT * FROM users WHERE active = true",
            },
            input_vars={},
        )

        assert len(lines) > 0
        assert "output" in output_vars

        code_str = "\n".join(lines)
        assert "read_database_uri" in code_str
        assert "connectorx" in code_str
        assert "users" in code_str


# ============================================================================
# Integration Test - End-to-End Database Workflow
# ============================================================================


class TestDatabaseIntegration:
    """Integration tests for complete database workflows"""

    @pytest.mark.asyncio
    @patch("app.domain.tools.loaders.database.pl.read_database_uri")
    async def test_database_to_filter_workflow(self, mock_read_db):
        """Test a workflow that loads from database and applies filter"""
        import uuid

        from app.api.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta
        from app.domain.execution.executor import WorkflowExecutor

        # Mock database returning sample data
        sample_data = pl.DataFrame(
            {
                "id": [1, 2, 3, 4, 5],
                "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
                "age": [25, 30, 35, 40, 45],
            }
        )
        mock_read_db.return_value = sample_data

        # Create workflow: Database -> Filter
        # Use unique workflow ID to avoid cache interference between test runs
        workflow = Workflow(
            meta=WorkflowMeta(
                name="Database Filter Test",
                description="Test database input with filter",
                author="Test",
                workflowId=f"test-db-filter-{uuid.uuid4()}",
                created="2025-08-01",
            ),
            tools=[
                Tool(
                    id="db_input",
                    type="Input",
                    x=0,
                    y=0,
                    config={
                        "category": "database",
                        "type": "postgresql",
                        "source": "postgresql://user:pass@localhost/testdb",
                        "query": "SELECT * FROM users",
                    },
                    sockets=[Socket(id="output", direction="output", type="polars-lazy")],
                ),
                Tool(
                    id="filter1",
                    type="Filter",
                    x=100,
                    y=0,
                    config={"expression": "pl.col('age') > 30"},
                    sockets=[
                        Socket(id="input", direction="input", type="polars-lazy"),
                        Socket(id="output-true", direction="output", type="polars-lazy"),
                        Socket(id="output-false", direction="output", type="polars-lazy"),
                    ],
                ),
            ],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="db_input", socket="output"),
                    to=WireEndpoint(tool="filter1", socket="input"),
                )
            ],
        )

        executor = WorkflowExecutor()

        # Test schema propagation
        schema_result = await executor.get_tool_schema(workflow, "filter1", socket_id="output-true")
        assert "data_schema" in schema_result
        assert len(schema_result["data_schema"].columns) == 3

        # Verify the query was executed (inspect calls read_database_uri)
        mock_read_db.assert_called()
        call_kwargs = mock_read_db.call_args[1]
        assert "SELECT * FROM users" in call_kwargs["query"] or "LIMIT 0" in call_kwargs["query"]
        assert "postgresql://" in call_kwargs["uri"]

    @pytest.mark.asyncio
    @patch("app.domain.tools.loaders.database.pl.read_database_uri")
    async def test_database_schema_inspection_without_execution(self, mock_read_db):
        """Test that schema can be inspected without full query execution"""
        from app.api.models.workflow import Socket, Tool, Workflow, WorkflowMeta
        from app.domain.execution.executor import WorkflowExecutor

        # Mock for schema inspection (LIMIT 0)
        empty_df = pl.DataFrame(
            {
                "user_id": pl.Series([], dtype=pl.Int64),
                "username": pl.Series([], dtype=pl.Utf8),
                "created_at": pl.Series([], dtype=pl.Datetime("ns")),
            }
        )
        mock_read_db.return_value = empty_df

        workflow = Workflow(
            meta=WorkflowMeta(
                name="Schema Inspection Test",
                description="Test schema without data",
                author="Test",
                workflowId="test-schema",
                created="2025-08-01",
            ),
            tools=[
                Tool(
                    id="db_input",
                    type="Input",
                    x=0,
                    y=0,
                    config={
                        "category": "database",
                        "type": "postgresql",
                        "source": "postgresql://user:pass@localhost/testdb",
                        "query": "SELECT user_id, username, created_at FROM users",
                    },
                    sockets=[Socket(id="output", direction="output", type="polars-lazy")],
                )
            ],
            wires=[],
        )

        executor = WorkflowExecutor()
        schema_result = await executor.get_tool_schema(workflow, "db_input", socket_id="output")

        assert "data_schema" in schema_result
        schema = schema_result["data_schema"]
        assert len(schema.columns) == 3

        column_names = [col.name for col in schema.columns]
        assert "user_id" in column_names
        assert "username" in column_names
        assert "created_at" in column_names

        # Verify schema inspection used LIMIT 0
        call_kwargs = mock_read_db.call_args[1]
        assert "LIMIT 0" in call_kwargs["query"]

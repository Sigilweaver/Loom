"""Custom exception classes"""


class LoomError(Exception):
    """Base exception for Sigilweaver Loom backend"""

    pass


class DataSourceError(LoomError):
    """Error related to data source operations"""

    pass


class ValidationError(LoomError):
    """Error during workflow validation"""

    pass


class ExecutionError(LoomError):
    """Error during workflow execution"""

    pass


class ToolError(LoomError):
    """Error related to tool operations"""

    pass


class ConfigurationError(LoomError):
    """Error in configuration"""

    pass

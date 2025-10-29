"""Custom exception classes"""


class SigilWeaverError(Exception):
    """Base exception for SigilWeaver backend"""

    pass


class DataSourceError(SigilWeaverError):
    """Error related to data source operations"""

    pass


class ValidationError(SigilWeaverError):
    """Error during workflow validation"""

    pass


class ExecutionError(SigilWeaverError):
    """Error during workflow execution"""

    pass


class ToolError(SigilWeaverError):
    """Error related to tool operations"""

    pass


class ConfigurationError(SigilWeaverError):
    """Error in configuration"""

    pass

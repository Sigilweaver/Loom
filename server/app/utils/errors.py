"""Custom exception classes"""


class SigilweaverError(Exception):
    """Base exception for Sigilweaver backend"""

    pass


class DataSourceError(SigilweaverError):
    """Error related to data source operations"""

    pass


class ValidationError(SigilweaverError):
    """Error during workflow validation"""

    pass


class ExecutionError(SigilweaverError):
    """Error during workflow execution"""

    pass


class ToolError(SigilweaverError):
    """Error related to tool operations"""

    pass


class ConfigurationError(SigilweaverError):
    """Error in configuration"""

    pass

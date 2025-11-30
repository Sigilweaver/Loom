"""Tests for audit logging middleware"""

import json
import pytest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.middleware.audit import (
    AuditMiddleware,
    setup_audit_logger,
    cleanup_old_audit_logs,
)


class TestCleanupOldAuditLogs:
    """Tests for audit log cleanup functionality"""
    
    def test_cleanup_removes_old_logs(self, tmp_path):
        """Should remove logs older than retention period"""
        with patch("app.middleware.audit.settings") as mock_settings:
            mock_settings.audit_enabled = True
            mock_settings.audit_path = str(tmp_path)
            mock_settings.audit_retention_days = 7
            
            # Create old log file (10 days ago)
            old_date = datetime.now() - timedelta(days=10)
            old_file = tmp_path / f"audit_{old_date.strftime('%Y-%m-%d')}.log"
            old_file.write_text("old log")
            
            # Create recent log file (2 days ago)
            recent_date = datetime.now() - timedelta(days=2)
            recent_file = tmp_path / f"audit_{recent_date.strftime('%Y-%m-%d')}.log"
            recent_file.write_text("recent log")
            
            # Run cleanup
            deleted = cleanup_old_audit_logs()
            
            assert deleted == 1
            assert not old_file.exists()
            assert recent_file.exists()
    
    def test_cleanup_keeps_all_when_retention_zero(self, tmp_path):
        """Should keep all logs when retention is 0"""
        with patch("app.middleware.audit.settings") as mock_settings:
            mock_settings.audit_enabled = True
            mock_settings.audit_path = str(tmp_path)
            mock_settings.audit_retention_days = 0
            
            # Create old log file
            old_date = datetime.now() - timedelta(days=100)
            old_file = tmp_path / f"audit_{old_date.strftime('%Y-%m-%d')}.log"
            old_file.write_text("old log")
            
            deleted = cleanup_old_audit_logs()
            
            assert deleted == 0
            assert old_file.exists()
    
    def test_cleanup_disabled_when_audit_disabled(self, tmp_path):
        """Should not cleanup when audit is disabled"""
        with patch("app.middleware.audit.settings") as mock_settings:
            mock_settings.audit_enabled = False
            mock_settings.audit_path = str(tmp_path)
            mock_settings.audit_retention_days = 7
            
            deleted = cleanup_old_audit_logs()
            
            assert deleted == 0


class TestAuditMiddleware:
    """Tests for AuditMiddleware class"""
    
    @pytest.mark.asyncio
    async def test_logs_request_response(self, tmp_path):
        """Should log request and response details"""
        with patch("app.middleware.audit.settings") as mock_settings:
            mock_settings.audit_enabled = True
            mock_settings.audit_path = str(tmp_path)
            mock_settings.audit_retention_days = 30
            
            # Create mock logger
            mock_logger = MagicMock()
            
            # Create middleware with mock app
            async def mock_call_next(request):
                response = MagicMock()
                response.status_code = 200
                return response
            
            middleware = AuditMiddleware(app=MagicMock(), logger=mock_logger)
            
            # Create mock request
            mock_request = MagicMock()
            mock_request.url.path = "/api/workflow/execute"
            mock_request.method = "POST"
            mock_request.query_params = {}
            mock_request.headers = {"user-agent": "test-agent"}
            mock_request.client.host = "127.0.0.1"
            mock_request.body = MagicMock(return_value=b'{"tools": [], "wires": []}')
            
            # Process request
            response = await middleware.dispatch(mock_request, mock_call_next)
            
            # Verify logging was called
            assert mock_logger.info.called
            log_call = mock_logger.info.call_args[0][0]
            log_data = json.loads(log_call)
            
            assert log_data["method"] == "POST"
            assert log_data["path"] == "/api/workflow/execute"
            assert log_data["status_code"] == 200
            assert "duration_ms" in log_data
            assert "request_id" in log_data
    
    @pytest.mark.asyncio
    async def test_skips_health_endpoint(self, tmp_path):
        """Should not log health check requests"""
        with patch("app.middleware.audit.settings") as mock_settings:
            mock_settings.audit_enabled = True
            mock_settings.audit_path = str(tmp_path)
            mock_settings.audit_retention_days = 30
            
            mock_logger = MagicMock()
            
            async def mock_call_next(request):
                response = MagicMock()
                response.status_code = 200
                return response
            
            middleware = AuditMiddleware(app=MagicMock(), logger=mock_logger)
            
            mock_request = MagicMock()
            mock_request.url.path = "/api/health/"
            
            await middleware.dispatch(mock_request, mock_call_next)
            
            # Should not log health checks
            assert not mock_logger.info.called
    
    @pytest.mark.asyncio
    async def test_disabled_when_audit_disabled(self, tmp_path):
        """Should not log when audit is disabled"""
        with patch("app.middleware.audit.settings") as mock_settings:
            mock_settings.audit_enabled = False
            mock_settings.audit_path = str(tmp_path)
            
            mock_logger = MagicMock()
            
            async def mock_call_next(request):
                response = MagicMock()
                response.status_code = 200
                return response
            
            middleware = AuditMiddleware(app=MagicMock(), logger=mock_logger)
            
            mock_request = MagicMock()
            mock_request.url.path = "/api/workflow/execute"
            mock_request.method = "POST"
            
            await middleware.dispatch(mock_request, mock_call_next)
            
            # Should not log when disabled
            assert not mock_logger.info.called


class TestSetupAuditLogger:
    """Tests for audit logger setup"""
    
    def test_creates_audit_directory(self, tmp_path):
        """Should create audit directory if it doesn't exist"""
        audit_dir = tmp_path / "audit_logs"
        
        with patch("app.middleware.audit.settings") as mock_settings:
            mock_settings.audit_enabled = True
            mock_settings.audit_path = str(audit_dir)
            
            logger = setup_audit_logger()
            
            assert audit_dir.exists()
            assert len(logger.handlers) == 1
    
    def test_no_handlers_when_disabled(self, tmp_path):
        """Should not add handlers when audit is disabled"""
        with patch("app.middleware.audit.settings") as mock_settings:
            mock_settings.audit_enabled = False
            
            logger = setup_audit_logger()
            
            assert len(logger.handlers) == 0

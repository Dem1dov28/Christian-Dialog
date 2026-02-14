"""
Юнит-тесты для core.validators.
"""
import pytest
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException
from core.validators import (
    validate_message_content,
    validate_agent_id,
    validate_pagination_params,
)

pytestmark = pytest.mark.unit


class TestValidateMessageContent:
    def test_empty_raises(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_message_content("")
        assert exc_info.value.status_code == 400
        assert "empty" in exc_info.value.detail.lower() or "empty" in str(exc_info.value.detail)

    def test_whitespace_only_raises(self):
        with pytest.raises(HTTPException):
            validate_message_content("   \n\t  ")

    def test_valid_message_returns_stripped(self):
        result = validate_message_content("  Hello world  ")
        assert result == "Hello world"

    def test_max_length_raises(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_message_content("a" * 20001, max_length=20000)
        assert exc_info.value.status_code == 400
        assert "long" in exc_info.value.detail.lower() or "20000" in exc_info.value.detail

    def test_within_max_length_ok(self):
        result = validate_message_content("a" * 100, max_length=20000)
        assert len(result) == 100


class TestValidateAgentId:
    def test_none_raises(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_agent_id(None)
        assert exc_info.value.status_code == 400

    def test_zero_raises(self):
        with pytest.raises(HTTPException):
            validate_agent_id(0)

    def test_negative_raises(self):
        with pytest.raises(HTTPException):
            validate_agent_id(-1)

    def test_positive_returns_id(self):
        assert validate_agent_id(1) == 1
        assert validate_agent_id(100) == 100


class TestValidatePaginationParams:
    def test_offset_clamped_to_zero(self):
        off, lim = validate_pagination_params(-5, 10)
        assert off == 0
        assert lim == 10

    def test_limit_clamped_max(self):
        off, lim = validate_pagination_params(0, 5000)
        assert lim <= 1000

    def test_limit_min_one(self):
        off, lim = validate_pagination_params(0, 0)
        assert lim >= 1

    def test_normal_values_unchanged(self):
        off, lim = validate_pagination_params(20, 50)
        assert off == 20
        assert lim == 50

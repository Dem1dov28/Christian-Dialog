"""
Юнит-тесты для модуля безопасности (core.security).
Не требуют БД и запущенного приложения.
"""
import pytest
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from core.security import (
    validate_password_strength,
    sanitize_input,
    sanitize_filename,
    validate_path_traversal,
)


pytestmark = pytest.mark.unit


class TestValidatePasswordStrength:
    """Тесты валидации силы пароля."""

    def test_valid_password(self):
        valid, msg = validate_password_strength("SecurePass1")
        assert valid is True
        assert msg is None

    def test_too_short(self):
        valid, msg = validate_password_strength("Short1")
        assert valid is False
        assert "8" in msg or "минимум" in msg.lower()

    def test_no_uppercase(self):
        valid, msg = validate_password_strength("alllowercase1")
        assert valid is False

    def test_no_lowercase(self):
        valid, msg = validate_password_strength("ALLUPPERCASE1")
        assert valid is False

    def test_no_digit(self):
        valid, msg = validate_password_strength("NoDigitsHere")
        assert valid is False

    def test_common_password(self):
        valid, msg = validate_password_strength("Password1")
        assert valid is False


class TestSanitizeInput:
    """Тесты санитизации ввода."""

    def test_empty(self):
        assert sanitize_input("") == ""

    def test_strips_whitespace(self):
        assert sanitize_input("  hello  ") == "hello"

    def test_removes_null_bytes(self):
        assert "\x00" not in sanitize_input("hello\x00world")

    def test_max_length(self):
        assert len(sanitize_input("hello world", max_length=5)) == 5
        assert sanitize_input("hello world", max_length=5) == "hello"


class TestSanitizeFilename:
    """Тесты санитизации имени файла."""

    def test_normal_filename(self):
        assert sanitize_filename("document.pdf") == "document.pdf"

    def test_removes_path_separators(self):
        assert "/" not in sanitize_filename("path/to/file.pdf")
        assert "\\" not in sanitize_filename("path\\to\\file.pdf")

    def test_removes_path_traversal(self):
        result = sanitize_filename("../../../etc/passwd")
        assert ".." not in result

    def test_removes_dangerous_chars(self):
        result = sanitize_filename('file<name>: "test".pdf')
        for c in ['<', '>', ':', '"', '|', '?', '*']:
            assert c not in result

    def test_max_length_255(self):
        long_name = "a" * 300 + ".txt"
        result = sanitize_filename(long_name)
        assert len(result) <= 255


class TestValidatePathTraversal:
    """Тесты проверки path traversal."""

    def test_safe_path_inside_base(self):
        base = os.path.abspath("/var/app/uploads")
        file_path = os.path.abspath("/var/app/uploads/file.txt")
        assert validate_path_traversal(file_path, base) is True

    def test_unsafe_path_outside_base(self):
        base = os.path.abspath("/var/app/uploads")
        file_path = os.path.abspath("/etc/passwd")
        assert validate_path_traversal(file_path, base) is False

    def test_same_dir_is_safe(self):
        base = "/var/app"
        file_path = "/var/app/file.txt"
        assert validate_path_traversal(file_path, base) is True

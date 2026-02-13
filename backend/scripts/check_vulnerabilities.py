#!/usr/bin/env python3
"""Проверка зависимостей backend на известные уязвимости (pip-audit). Запуск: python backend/scripts/check_vulnerabilities.py"""
import subprocess
import sys
from pathlib import Path

req = Path(__file__).resolve().parent.parent / "requirements.txt"
if not req.exists():
    print(f"Не найден {req}")
    sys.exit(1)

r = subprocess.run(
    [sys.executable, "-m", "pip_audit", "-r", str(req)],
    cwd=req.parent,
)
sys.exit(r.returncode)

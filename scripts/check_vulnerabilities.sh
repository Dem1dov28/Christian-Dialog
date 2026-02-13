#!/bin/bash
# Проверка зависимостей backend на известные уязвимости (CVE).
# Требует: pip install pip-audit
# Опционально: pip install safety && safety check
#
# Запуск из корня репозитория: ./scripts/check_vulnerabilities.sh

set -e
cd "$(dirname "$0")/.."
REQ="backend/requirements.txt"

if [ ! -f "$REQ" ]; then
  echo "Не найден $REQ"
  exit 1
fi

echo "=== pip-audit (backend/requirements.txt) ==="
pip-audit -r "$REQ" || true

if command -v safety >/dev/null 2>&1; then
  echo ""
  echo "=== safety check ==="
  safety check -r "$REQ" || true
else
  echo ""
  echo "Для дополнительной проверки установите safety: pip install safety"
fi

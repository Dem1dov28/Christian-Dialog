#!/usr/bin/env python3
"""
Взять описания (description) для всех агентов из указанного agents.yaml
и подставить их в config/agents.yaml текущего проекта.
Совпадение по полю name. Остальная разметка файла не меняется.
"""

import os
import re
import sys
import yaml

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        import codecs
        sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer, "strict")
        sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer, "strict")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
SOURCE_YAML = r"d:\Proga\Startups\1\EpochalDialog-68eda1df3fb4476d29a63a40244bec1a04a0f4ee\backend\config\agents.yaml"
TARGET_YAML = os.path.join(PROJECT_ROOT, "backend", "config", "agents.yaml")

# Паттерн: строка с именем агента "  - name: "Имя""
RE_NAME = re.compile(r'^\s+-\s+name:\s+"([^"]+)"\s*$')
# Паттерн: строка description (одна строка в кавычках)
RE_DESCRIPTION_LINE = re.compile(r'^(\s+description:\s)"(.*)"\s*$', re.DOTALL)


def load_descriptions_from_source(path):
    """Загрузить из source YAML словарь name -> description."""
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    agents = data.get("agents") or []
    return {a["name"]: (a.get("description") or "") for a in agents if a.get("name")}


def main():
    if not os.path.exists(SOURCE_YAML):
        print(f"Источник не найден: {SOURCE_YAML}")
        return 1
    if not os.path.exists(TARGET_YAML):
        print(f"Целевой файл не найден: {TARGET_YAML}")
        return 1

    descriptions_by_name = load_descriptions_from_source(SOURCE_YAML)
    print(f"Загружено описаний из источника: {len(descriptions_by_name)}")

    with open(TARGET_YAML, "r", encoding="utf-8") as f:
        lines = f.readlines()

    current_name = None
    updated = 0
    result = []

    for line in lines:
        m_name = RE_NAME.match(line)
        if m_name:
            current_name = m_name.group(1)
            result.append(line)
            continue

        m_desc = RE_DESCRIPTION_LINE.match(line)
        if m_desc and current_name is not None and current_name in descriptions_by_name:
            indent = m_desc.group(1)
            new_desc = descriptions_by_name[current_name]
            # Экранируем кавычки и обратные слэши в значении для YAML
            escaped = new_desc.replace("\\", "\\\\").replace('"', '\\"')
            result.append(f'{indent}"{escaped}"\n')
            updated += 1
            print(f"  Обновлено: {current_name}")
            current_name = None
            continue

        result.append(line)

    with open(TARGET_YAML, "w", encoding="utf-8") as f:
        f.writelines(result)

    print(f"\nГотово. Обновлено описаний: {updated}. Файл: {TARGET_YAML}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

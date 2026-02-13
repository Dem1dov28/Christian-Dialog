#!/usr/bin/env python3
"""
Скрипт для автоматической проверки безопасности приложения
Запуск: python check_security.py
"""

import os
import sys
import re
import subprocess
from pathlib import Path
from typing import List, Tuple

# ANSI цвета для вывода
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text: str):
    """Красивый заголовок"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text.center(70)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}\n")

def print_success(text: str):
    """Сообщение об успехе"""
    print(f"{Colors.GREEN}✓ {text}{Colors.END}")

def print_warning(text: str):
    """Предупреждение"""
    print(f"{Colors.YELLOW}⚠ {text}{Colors.END}")

def print_error(text: str):
    """Ошибка"""
    print(f"{Colors.RED}✗ {text}{Colors.END}")

def print_info(text: str):
    """Информация"""
    print(f"{Colors.BLUE}ℹ {text}{Colors.END}")


class SecurityChecker:
    def __init__(self):
        self.issues = []
        self.warnings = []
        self.success_count = 0
        self.project_root = Path(__file__).parent
        
    def add_issue(self, category: str, message: str):
        """Добавить критическую проблему"""
        self.issues.append((category, message))
        
    def add_warning(self, category: str, message: str):
        """Добавить предупреждение"""
        self.warnings.append((category, message))
        
    def add_success(self):
        """Увеличить счетчик успешных проверок"""
        self.success_count += 1
    
    def check_env_files(self) -> bool:
        """Проверка .env файлов"""
        print_header("ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ")
        
        # Проверка что .env файлы не в Git
        gitignore = self.project_root / ".gitignore"
        if gitignore.exists():
            content = gitignore.read_text()
            if ".env" in content:
                print_success(".env файлы в .gitignore")
                self.add_success()
            else:
                print_error(".env файлы НЕ в .gitignore!")
                self.add_issue("ENV", ".env файлы должны быть в .gitignore")
        else:
            print_warning(".gitignore не найден")
            self.add_warning("ENV", ".gitignore отсутствует")
        
        # Проверка docker-compose.yml на секреты
        docker_compose = self.project_root / "docker-compose.yml"
        if docker_compose.exists():
            content = docker_compose.read_text()
            
            # Проверяем на захардкоженные пароли
            if re.search(r'PASSWORD.*=.*[^$\{]', content):
                print_error("Захардкоженные пароли в docker-compose.yml!")
                self.add_issue("ENV", "Пароли в docker-compose.yml должны быть в переменных ${}")
            else:
                print_success("Нет захардкоженных паролей в docker-compose.yml")
                self.add_success()
        
        # Проверка backend/.env
        backend_env = self.project_root / "backend" / ".env"
        if backend_env.exists():
            print_warning("backend/.env существует (проверьте что не в Git)")
            self.check_env_file_content(backend_env)
        else:
            print_info("backend/.env не найден (это нормально если используются переменные окружения)")
        
        return len(self.issues) == 0
    
    def check_env_file_content(self, env_file: Path):
        """Проверка содержимого .env файла"""
        content = env_file.read_text()
        
        # Проверка SECRET_KEY
        secret_key_match = re.search(r'SECRET_KEY=(.+)', content)
        if secret_key_match:
            secret_key = secret_key_match.group(1).strip()
            
            # Список небезопасных значений
            unsafe_values = [
                "your-secret-key-change-in-production",
                "your-super-secret-key-change-in-production-12345",
                "secret",
                "password",
                "12345"
            ]
            
            if secret_key in unsafe_values:
                print_error(f"SECRET_KEY использует небезопасное значение: {secret_key[:20]}...")
                self.add_issue("ENV", "SECRET_KEY должен быть изменен на уникальное значение")
            elif len(secret_key) < 32:
                print_warning(f"SECRET_KEY слишком короткий ({len(secret_key)} символов)")
                self.add_warning("ENV", "SECRET_KEY должен быть минимум 32 символа")
            else:
                print_success(f"SECRET_KEY выглядит безопасно (длина: {len(secret_key)})")
                self.add_success()
        
        # Проверка DATABASE_URL
        if "DATABASE_URL=" in content:
            if re.search(r'DATABASE_URL=.*password.*@', content, re.IGNORECASE):
                print_info("DATABASE_URL содержит пароль (убедитесь что файл защищен)")
    
    def check_dependencies(self) -> bool:
        """Проверка зависимостей на уязвимости"""
        print_header("ПРОВЕРКА ЗАВИСИМОСТЕЙ")
        
        # Python dependencies
        requirements = self.project_root / "backend" / "requirements.txt"
        if requirements.exists():
            print_info("Проверка Python зависимостей...")
            try:
                # Проверка через safety
                result = subprocess.run(
                    ["safety", "check", "--file", str(requirements)],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    print_success("Python зависимости безопасны")
                    self.add_success()
                else:
                    print_error("Найдены уязвимости в Python зависимостях!")
                    print(result.stdout)
                    self.add_issue("DEPS", "Обновите уязвимые Python пакеты")
            except FileNotFoundError:
                print_warning("safety не установлен (pip install safety)")
                self.add_warning("DEPS", "Установите safety для проверки зависимостей")
        
        # npm dependencies
        frontend_package = self.project_root / "frontend" / "package.json"
        if frontend_package.exists():
            print_info("Проверка npm зависимостей...")
            try:
                result = subprocess.run(
                    ["npm", "audit", "--json"],
                    cwd=self.project_root / "frontend",
                    capture_output=True,
                    text=True
                )
                
                import json
                audit_data = json.loads(result.stdout)
                
                vulnerabilities = audit_data.get("metadata", {}).get("vulnerabilities", {})
                total = sum(vulnerabilities.values())
                
                if total == 0:
                    print_success("npm зависимости безопасны")
                    self.add_success()
                else:
                    print_warning(f"Найдено {total} уязвимостей в npm пакетах")
                    self.add_warning("DEPS", f"Исправьте {total} уязвимостей npm: npm audit fix")
            except Exception as e:
                print_warning(f"Не удалось проверить npm зависимости: {e}")
        
        return True
    
    def check_code_patterns(self) -> bool:
        """Проверка кода на опасные паттерны"""
        print_header("ПРОВЕРКА КОДА НА УЯЗВИМОСТИ")
        
        # Проверка Python кода
        backend_dir = self.project_root / "backend"
        if backend_dir.exists():
            # SQL injection patterns
            dangerous_patterns = [
                (r'\.execute\(f"', "SQL injection: f-string в .execute()"),
                (r'\.execute\(f\'', "SQL injection: f-string в .execute()"),
                (r'eval\(', "Небезопасное использование eval()"),
                (r'exec\(', "Небезопасное использование exec()"),
                (r'pickle\.loads?\(', "Небезопасное использование pickle"),
            ]
            
            for pattern, message in dangerous_patterns:
                matches = self.search_pattern_in_files(
                    backend_dir,
                    pattern,
                    ["*.py"]
                )
                if matches:
                    print_error(f"{message}: {len(matches)} найдено")
                    for file, line in matches[:3]:  # Показываем первые 3
                        print(f"  - {file}:{line}")
                    self.add_issue("CODE", message)
                else:
                    print_success(f"Нет паттерна: {message}")
                    self.add_success()
        
        # Проверка Frontend кода
        frontend_dir = self.project_root / "frontend" / "src"
        if frontend_dir.exists():
            # XSS patterns
            dangerous_js_patterns = [
                (r'dangerouslySetInnerHTML', "Потенциальная XSS уязвимость"),
                (r'\.innerHTML\s*=', "Небезопасное использование innerHTML"),
                (r'eval\(', "Небезопасное использование eval()"),
            ]
            
            for pattern, message in dangerous_js_patterns:
                matches = self.search_pattern_in_files(
                    frontend_dir,
                    pattern,
                    ["*.js", "*.jsx", "*.ts", "*.tsx"]
                )
                if matches:
                    print_warning(f"{message}: {len(matches)} найдено")
                    for file, line in matches[:3]:
                        print(f"  - {file}:{line}")
                    self.add_warning("CODE", f"{message} в {len(matches)} местах")
        
        return True
    
    def search_pattern_in_files(
        self,
        directory: Path,
        pattern: str,
        extensions: List[str]
    ) -> List[Tuple[str, int]]:
        """Поиск паттерна в файлах"""
        matches = []
        
        for ext in extensions:
            for file in directory.rglob(ext):
                try:
                    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
                        for i, line in enumerate(f, 1):
                            if re.search(pattern, line):
                                matches.append((str(file.relative_to(self.project_root)), i))
                except Exception:
                    pass
        
        return matches
    
    def check_configuration(self) -> bool:
        """Проверка конфигурационных файлов"""
        print_header("ПРОВЕРКА КОНФИГУРАЦИИ")
        
        # Проверка CORS в config.py
        config_file = self.project_root / "backend" / "config" / "config.py"
        if config_file.exists():
            content = config_file.read_text()
            
            # Проверка на localhost в ALLOWED_ORIGINS
            if re.search(r'ALLOWED_ORIGINS.*localhost', content):
                print_warning("ALLOWED_ORIGINS содержит localhost (отключить для production)")
                self.add_warning("CONFIG", "Убрать localhost из ALLOWED_ORIGINS в production")
            else:
                print_success("ALLOWED_ORIGINS не содержит localhost")
                self.add_success()
            
            # Проверка DEBUG режима
            if re.search(r'DEBUG\s*=\s*True', content):
                print_warning("DEBUG=True (отключить для production)")
                self.add_warning("CONFIG", "Установить DEBUG=False в production")
        
        # Проверка frontend API URL
        api_client = self.project_root / "frontend" / "src" / "services" / "api" / "client.js"
        if api_client.exists():
            content = api_client.read_text()
            
            if "localhost" in content:
                print_warning("Frontend API_BASE_URL захардкожен на localhost")
                self.add_warning("CONFIG", "Вынести API_BASE_URL в .env переменные")
            else:
                print_success("Frontend API_BASE_URL использует переменные окружения")
                self.add_success()
        
        return True
    
    def check_security_features(self) -> bool:
        """Проверка наличия security features"""
        print_header("ПРОВЕРКА SECURITY FEATURES")
        
        # Rate limiting
        rate_limiter = self.project_root / "backend" / "core" / "rate_limiter.py"
        if rate_limiter.exists():
            content = rate_limiter.read_text()
            if "redis" in content.lower():
                print_success("Rate limiting использует Redis")
                self.add_success()
            else:
                print_warning("Rate limiting использует in-memory storage (не для production)")
                self.add_warning("SECURITY", "Переключить rate limiting на Redis")
        
        # Security headers
        security_file = self.project_root / "backend" / "core" / "security.py"
        if security_file.exists():
            content = security_file.read_text()
            
            security_headers = [
                ("X-Content-Type-Options", "nosniff header"),
                ("X-Frame-Options", "clickjacking protection"),
                ("Content-Security-Policy", "CSP header"),
                ("Strict-Transport-Security", "HSTS header"),
            ]
            
            for header, description in security_headers:
                if header in content:
                    print_success(f"{description} присутствует")
                    self.add_success()
                else:
                    print_warning(f"{description} отсутствует")
                    self.add_warning("SECURITY", f"Добавить {description}")
        
        return True
    
    def generate_report(self):
        """Генерация финального отчета"""
        print_header("ИТОГОВЫЙ ОТЧЕТ")
        
        total_checks = self.success_count + len(self.issues) + len(self.warnings)
        
        print(f"\n{Colors.BOLD}Статистика:{Colors.END}")
        print(f"  Всего проверок: {total_checks}")
        print(f"  {Colors.GREEN}Успешно: {self.success_count}{Colors.END}")
        print(f"  {Colors.YELLOW}Предупреждений: {len(self.warnings)}{Colors.END}")
        print(f"  {Colors.RED}Критических проблем: {len(self.issues)}{Colors.END}")
        
        if self.issues:
            print(f"\n{Colors.BOLD}{Colors.RED}❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ:{Colors.END}")
            for i, (category, message) in enumerate(self.issues, 1):
                print(f"  {i}. [{category}] {message}")
        
        if self.warnings:
            print(f"\n{Colors.BOLD}{Colors.YELLOW}⚠ ПРЕДУПРЕЖДЕНИЯ:{Colors.END}")
            for i, (category, message) in enumerate(self.warnings, 1):
                print(f"  {i}. [{category}] {message}")
        
        print("\n" + "="*70)
        
        if len(self.issues) == 0:
            if len(self.warnings) == 0:
                print(f"\n{Colors.GREEN}{Colors.BOLD}✓ ВСЁ ОТЛИЧНО! Приложение готово к deploy.{Colors.END}\n")
                return 0
            else:
                print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠ ВНИМАНИЕ: Есть предупреждения.{Colors.END}")
                print(f"{Colors.YELLOW}Рекомендуется исправить перед production deploy.{Colors.END}\n")
                return 0
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}✗ КРИТИЧЕСКИЕ ПРОБЛЕМЫ ОБНАРУЖЕНЫ!{Colors.END}")
            print(f"{Colors.RED}Необходимо исправить перед deploy.{Colors.END}\n")
            return 1


def main():
    """Главная функция"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║        SECURITY CHECKER - Epochal Dialog                        ║")
    print("║          Автоматическая проверка безопасности                   ║")
    print("╚══════════════════════════════════════════════════════════════════╝")
    print(f"{Colors.END}")
    
    checker = SecurityChecker()
    
    try:
        checker.check_env_files()
        checker.check_dependencies()
        checker.check_code_patterns()
        checker.check_configuration()
        checker.check_security_features()
        
        exit_code = checker.generate_report()
        sys.exit(exit_code)
        
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Проверка прервана пользователем.{Colors.END}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Ошибка при проверке: {e}{Colors.END}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()

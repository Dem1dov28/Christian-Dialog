import socket
import ssl
import smtplib
import os
from dotenv import load_dotenv

load_dotenv()

def diagnostic():
    server = "smtp.gmail.com"
    ports = [465, 587]
    
    print(f"--- Диагностика подключения к {server} ---")
    
    for port in ports:
        print(f"\nПроверка порта {port}:")
        
        # 1. Проверка доступности сокета
        try:
            sock = socket.create_connection((server, port), timeout=10)
            print(f"  [+] Сокет: Порт {port} открыт и доступен.")
            sock.close()
        except Exception as e:
            print(f"  [-] Сокет: Не удается подключиться к порту {port}. Ошибка: {e}")
            continue

        # 2. Проверка SSL/TLS
        try:
            print(f"  [*] Попытка SSL-рукопожатия на порту {port}...")
            context = ssl.create_default_context()
            with socket.create_connection((server, port), timeout=10) as sock:
                with context.wrap_socket(sock, server_hostname=server) as ssock:
                    print(f"  [+] SSL: Рукопожатие успешно. Версия протокола: {ssock.version()}")
        except Exception as e:
            print(f"  [-] SSL: Ошибка рукопожатия: {e}")

        # 3. Проверка SMTP авторизации
        try:
            email = os.getenv("REPORT_SENDER_EMAIL")
            pwd = os.getenv("REPORT_SENDER_PASSWORD")
            print(f"  [*] Попытка SMTP-авторизации для {email}...")
            
            if port == 465:
                s = smtplib.SMTP_SSL(server, port, timeout=10)
            else:
                s = smtplib.SMTP(server, port, timeout=10)
                s.starttls()
            
            s.login(email, pwd)
            print(f"  [+] SMTP: Авторизация успешна!")
            s.quit()
        except Exception as e:
            print(f"  [-] SMTP: Ошибка авторизации: {e}")

if __name__ == "__main__":
    diagnostic()

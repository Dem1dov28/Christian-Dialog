# Backend Epochal Dialog — production image
FROM python:3.11-slim

WORKDIR /app

# Системные зависимости для psycopg2 и др.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Переменные окружения задаются при запуске (docker run / compose)
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "asyncio"]

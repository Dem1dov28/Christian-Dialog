/**
 * Базовый API клиент для связи с бэкендом
 * Содержит общую логику для всех API запросов
 */

const API_BASE_URL = "http://localhost:8002";

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem("auth_token");
    // Обновляем токен при инициализации
    if (this.token) {
      this.setToken(this.token);
    }
  }

  // Установить токен авторизации
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  // Получить заголовки для запросов
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Скачать файл attachment
  async downloadFile(filename) {
    const url = `${this.baseURL}/api/files/${encodeURIComponent(filename)}`;
    const headers = {
      ...this.getHeaders(),
      // Убираем Content-Type для blob ответов
      "Content-Type": undefined,
    };
    delete headers["Content-Type"];

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": headers["Authorization"],
        },
      });

      if (response.status === 401) {
        this.setToken(null);
        throw new Error("Not authenticated");
      }

      if (!response.ok) {
        let errorData = {};
        try {
          const text = await response.text();
          if (text.trim()) {
            errorData = JSON.parse(text);
          }
        } catch (e) {
          errorData = {};
        }
        
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      // Создаем blob из ответа
      const blob = await response.blob();
      
      // Получаем имя файла из заголовка Content-Disposition или используем filename
      let downloadFilename = filename;
      const contentDisposition = response.headers.get("Content-Disposition");
      if (contentDisposition) {
        // Сначала пробуем извлечь из RFC 5987 encoding (filename*=UTF-8''encoded)
        // Это приоритетный формат для не-ASCII символов
        const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/);
        if (rfc5987Match) {
          try {
            downloadFilename = decodeURIComponent(rfc5987Match[1]);
          } catch (e) {
            console.warn("Failed to decode RFC 5987 filename:", e);
            // Если не получилось декодировать, пробуем обычный формат
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch) {
              downloadFilename = filenameMatch[1];
            }
          }
        } else {
          // Если нет RFC 5987 формата, пробуем обычный формат
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch) {
            downloadFilename = filenameMatch[1];
          }
        }
      }
      
      // Создаем временную ссылку и триггерим скачивание
      const url_blob = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url_blob;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url_blob);
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  }

  // Базовый метод для HTTP запросов
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);

      // Если токен истек, очищаем его
      if (response.status === 401) {
        this.setToken(null);
        throw new Error("Not authenticated");
      }

      // Обрабатываем пустые ответы (204 No Content) ПЕРЕД проверкой response.ok
      // 204 - это успешный статус, но без тела ответа
      if (response.status === 204) {
        // Для 204 No Content возвращаем пустой объект
        return {};
      }

      if (!response.ok) {
        // Пытаемся получить JSON из ответа об ошибке
        let errorData = {};
        try {
          const text = await response.text();
          if (text.trim()) {
            errorData = JSON.parse(text);
          }
        } catch (e) {
          // Если не удалось распарсить, оставляем пустой объект
          errorData = {};
        }
        
        // Извлекаем сообщение об ошибке из различных форматов ответа
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        if (errorData.detail) {
          // Обрабатываем разные форматы detail
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            // FastAPI validation errors - формат: [{loc: [...], msg: "...", type: "..."}]
            const validationErrors = errorData.detail
              .map(err => {
                const field = err.loc && err.loc.length > 1 ? err.loc[err.loc.length - 1] : err.loc?.[0] || "field";
                return `${field}: ${err.msg}`;
              })
              .join("; ");
            errorMessage = validationErrors || "Ошибка валидации данных";
          } else if (typeof errorData.detail === "object") {
            errorMessage = errorData.detail.message || JSON.stringify(errorData.detail);
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = typeof errorData.error === "string" ? errorData.error : errorData.error.message || JSON.stringify(errorData.error);
        }
        
        // Для 429 ошибок добавляем информацию о retry_after
        if (response.status === 429) {
          const retryAfter = errorData.retry_after || response.headers.get("Retry-After") || 60;
          errorMessage = errorMessage || `Превышен лимит запросов. Пожалуйста, подождите ${retryAfter} секунд перед повторной попыткой.`;
        }
        
        // Создаем ошибку с дополнительной информацией
        const error = new Error(errorMessage);
        error.status = response.status;
        error.statusText = response.statusText;
        error.response = errorData;
        error.data = errorData;
        error.url = url;
        if (response.status === 429) {
          error.retryAfter = errorData.retry_after || response.headers.get("Retry-After") || 60;
        }
        
        // Для ошибок 429 (лимит сообщений) не логируем в консоль - они обрабатываются специально
        if (response.status !== 429) {
          console.error(`API error: ${response.status} ${response.statusText}`, {
            endpoint: url,
            method: config.method || 'GET',
            status: response.status,
            statusText: response.statusText,
            errorData,
            message: errorMessage
          });
        }
        
        throw error;
      }

      // Проверяем, есть ли тело ответа для успешных ответов
      const contentType = response.headers.get("content-type");
      const contentLength = response.headers.get("content-length");
      
      // Если content-length = 0 или не указан, возможно тело пустое
      if (contentLength === "0" || !contentType) {
        return {};
      }

      // Если это JSON, пытаемся распарсить
      if (contentType && contentType.includes("application/json")) {
        try {
          const text = await response.text();
          if (text.trim() === "") {
            // Пустое тело, возвращаем пустой объект
            return {};
          }
          // Парсим JSON только если есть содержимое
          return JSON.parse(text);
        } catch (e) {
          // Если не удалось распарсить JSON, возвращаем пустой объект
          console.warn(`Failed to parse JSON response: ${e.message}`);
          return {};
        }
      }

      // Если не JSON, возвращаем текст или пустой объект
      const text = await response.text();
      return text ? text : {};
    } catch (error) {
      // Более детальное логирование ошибок
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        console.error("Network error details:", {
          url,
          method: config.method || 'GET',
          error: error.message,
          errorName: error.name,
          stack: error.stack
        });
        throw new Error("Network error - please check your connection");
      } else if (error.message === "Not authenticated") {
        console.error("Authentication error:", error);
        throw error; // Перебрасываем без дополнительного логирования
      } else {
        console.error("API request failed:", {
          url,
          method: config.method || 'GET',
          error: error.message,
          errorName: error.name,
          stack: error.stack
        });
        throw error;
      }
    }
  }

  // GET запрос
  async get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  // POST запрос
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // PUT запрос
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // DELETE запрос
  async delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }
}

export default ApiClient;


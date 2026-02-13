# FRONTEND SECURITY ANALYSIS - Epochal Dialog

## 📊 ОБЩАЯ ОЦЕНКА: 7/10 ✅

Frontend имеет хорошую базовую защиту, но есть несколько областей для улучшения.

---

## ✅ ПОЛОЖИТЕЛЬНЫЕ АСПЕКТЫ

### 1. Безопасное хранение токенов ✅
**Файл:** `frontend/src/services/api/client.js`

```javascript
// ✅ Токен в localStorage (приемлемо для простых приложений)
this.token = localStorage.getItem("auth_token");
```

**Статус:** Хорошо, но можно улучшить

### 2. Правильная очистка токена при 401 ✅
```javascript
if (response.status === 401) {
  this.setToken(null);
  throw new Error("Not authenticated");
}
```

### 3. URL Encoding для файлов ✅
```javascript
// ✅ Правильное экранирование filename
const url = `${this.baseURL}/api/files/${encodeURIComponent(filename)}`;
```

### 4. Content-Disposition парсинг ✅
```javascript
// ✅ Безопасный парсинг с fallback
const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/);
if (rfc5987Match) {
  downloadFilename = decodeURIComponent(rfc5987Match[1]);
}
```

### 5. API_BASE_URL конфигурация ✅
```javascript
const API_BASE_URL = "http://localhost:8000";
```

**Рекомендация:** Вынести в переменные окружения

---

## ⚠️ КРИТИЧЕСКИЕ УЯЗВИМОСТИ

### 🔴 1. ИСПОЛЬЗОВАНИЕ `dangerouslySetInnerHTML`

**Файлы:**
- `frontend/src/components/chat/RightMessage.jsx`
- `frontend/src/components/chat/LeftMessage.jsx`

**Проблема:** XSS уязвимость если санитизация недостаточна

```javascript
// ПОТЕНЦИАЛЬНО ОПАСНО
dangerouslySetInnerHTML={{ __html: displayText }}
```

**Текущая защита:**
```javascript
const escapeHtmlInText = (text) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};
```

**Рекомендация:** Использовать DOMPurify для надежной санитизации

```bash
npm install dompurify
npm install @types/dompurify --save-dev
```

```javascript
// frontend/src/utils/sanitize.js
import DOMPurify from 'dompurify';

/**
 * Безопасная санитизация HTML контента
 * 
 * @param {string} dirty - Необработанный HTML
 * @returns {string} - Санитизированный HTML
 */
export const sanitizeHtml = (dirty) => {
  if (!dirty || typeof dirty !== 'string') return '';
  
  return DOMPurify.sanitize(dirty, {
    // Разрешенные теги
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'strike', 'del',
      'p', 'br', 'span', 'div',
      'a', 'img',
      'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    
    // Разрешенные атрибуты
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel',
      'src', 'alt', 'width', 'height',
      'class', 'id', 'style'
    ],
    
    // Запретить JavaScript ссылки
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    
    // Открывать ссылки в новой вкладке
    ADD_ATTR: ['target'],
    
    // Hooks для дополнительной обработки
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
};

/**
 * Санитизация для отображения только текста (без HTML)
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],  // Нет разрешенных тегов = только текст
    KEEP_CONTENT: true  // Сохраняем текст внутри тегов
  });
};
```

**Использование:**

```javascript
// frontend/src/components/chat/RightMessage.jsx
import { sanitizeHtml } from '../../utils/sanitize';

// В компоненте
const cleanText = useMemo(() => {
  return sanitizeHtml(message.content);
}, [message.content]);

return (
  <div dangerouslySetInnerHTML={{ __html: cleanText }} />
);
```

---

### 🔴 2. API_BASE_URL HARDCODED

**Файл:** `frontend/src/services/api/client.js`

**Проблема:** URL захардкожен для localhost

```javascript
// ПЛОХО
const API_BASE_URL = "http://localhost:8000";
```

**РЕШЕНИЕ:**

```javascript
// frontend/src/config/api.js
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 30000;
```

**.env файлы:**

```env
# .env.development
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-dev-client-id

# .env.production
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=your-prod-client-id
```

**В client.js:**

```javascript
import { API_BASE_URL } from '../config/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    // ...
  }
}
```

---

### 🟠 3. ТОКЕНЫ В LOCALSTORAGE

**Текущая реализация:**
```javascript
this.token = localStorage.getItem("auth_token");
```

**Проблемы:**
- ❌ Доступен для XSS атак
- ❌ Не очищается при закрытии браузера

**Альтернатива 1: HttpOnly Cookies (ЛУЧШИЙ ВАРИАНТ)**

Backend изменения:

```python
# backend/api/auth.py
from fastapi import Response

@router.post("/login")
def login_user(response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    # ... аутентификация ...
    
    access_token = create_access_token(...)
    
    # Устанавливаем cookie вместо возврата токена в теле
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,      # ✅ Не доступен для JavaScript
        secure=True,        # ✅ Только HTTPS
        samesite="strict",  # ✅ Защита от CSRF
        max_age=3600,       # 1 час
    )
    
    return {
        "message": "Login successful",
        "user": create_user_response(user)
    }
```

Frontend изменения:

```javascript
// frontend/src/services/api/client.js
class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    // Токен в HttpOnly cookie, не нужно хранить в JS
  }

  getHeaders() {
    return {
      "Content-Type": "application/json",
      // НЕ нужен Authorization header - cookie отправляется автоматически
    };
  }

  async request(endpoint, options = {}) {
    const config = {
      ...options,
      headers: this.getHeaders(),
      credentials: 'include',  // ✅ Отправлять cookies
    };
    
    // ... остальная логика ...
  }
}
```

**Альтернатива 2: Короткоживущие токены в memory + Refresh tokens**

```javascript
// frontend/src/services/tokenManager.js
class TokenManager {
  constructor() {
    // Access token в памяти (пропадает при перезагрузке)
    this._accessToken = null;
    // Refresh token в localStorage (защищен от XSS если короткоживущий)
    this._refreshToken = localStorage.getItem('refresh_token');
  }

  setAccessToken(token) {
    this._accessToken = token;
    // НЕ сохраняем в localStorage!
  }

  getAccessToken() {
    return this._accessToken;
  }

  setRefreshToken(token) {
    this._refreshToken = token;
    localStorage.setItem('refresh_token', token);
  }

  async refreshAccessToken() {
    if (!this._refreshToken) return null;
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this._refreshToken })
      });
      
      if (!response.ok) {
        this.clear();
        return null;
      }
      
      const data = await response.json();
      this.setAccessToken(data.access_token);
      return data.access_token;
    } catch (error) {
      this.clear();
      return null;
    }
  }

  clear() {
    this._accessToken = null;
    this._refreshToken = null;
    localStorage.removeItem('refresh_token');
  }
}

export const tokenManager = new TokenManager();
```

---

### 🟠 4. ОТСУТСТВИЕ CSRF PROTECTION

**Проблема:** Нет CSRF токенов для state-changing операций

**РЕШЕНИЕ:**

```javascript
// frontend/src/utils/csrf.js
/**
 * Получить CSRF токен из cookie
 */
export const getCsrfToken = () => {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return value;
    }
  }
  return null;
};

// frontend/src/services/api/client.js
import { getCsrfToken } from '../utils/csrf';

class ApiClient {
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    // Добавляем CSRF токен для state-changing операций
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }
}
```

---

### 🟠 5. ОТСУТСТВИЕ REQUEST TIMEOUT

**Проблема:** Запросы могут висеть бесконечно

**РЕШЕНИЕ:**

```javascript
// frontend/src/services/api/client.js
import { API_TIMEOUT } from '../config/api';

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    // Создаем AbortController для таймаута
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const config = {
      ...options,
      headers: this.getHeaders(),
      signal: controller.signal,  // Добавляем signal
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);  // Очищаем таймаут если успешно
      
      // ... остальная логика ...
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - server not responding');
      }
      
      throw error;
    }
  }
}
```

---

### 🟠 6. ОТСУТСТВИЕ RATE LIMITING НА КЛИЕНТЕ

**Решение:** Debounce для частых операций

```javascript
// frontend/src/utils/debounce.js
/**
 * Debounce функция - предотвращает частые вызовы
 */
export const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Использование в компонентах
import { debounce } from '../../utils/debounce';

const debouncedSearch = useMemo(
  () => debounce((query) => {
    api.search(query);
  }, 300),
  []
);
```

---

## 📋 РЕКОМЕНДАЦИИ ПО ПРИОРИТЕТАМ

### НЕМЕДЛЕННО (перед production):

1. ✅ **Установить DOMPurify** и заменить `dangerouslySetInnerHTML`
2. ✅ **Вынести API_BASE_URL в .env**
3. ✅ **Добавить request timeouts**
4. ✅ **Переместить токены в HttpOnly cookies** (требует изменений backend)

### Первая неделя:

5. ✅ **Добавить CSRF protection**
6. ✅ **Реализовать proper error boundaries**
7. ✅ **Добавить Content Security Policy meta tags**

### Первый месяц:

8. ✅ **Аудит всех зависимостей на уязвимости**
9. ✅ **Добавить Subresource Integrity для CDN**
10. ✅ **Настроить automated security scanning**

---

## 🔧 ГОТОВЫЕ ФАЙЛЫ ДЛЯ ВНЕДРЕНИЯ

### 1. DOMPurify Wrapper

```javascript
// frontend/src/utils/sanitize.js
import DOMPurify from 'dompurify';

// Конфигурация для сообщений чата
const CHAT_MESSAGE_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'u', 'strike', 'del',
    'p', 'br', 'span', 'div',
    'a', 'img',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel',
    'src', 'alt', 'width', 'height',
    'class', 'id'
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ADD_ATTR: ['target'],
  RETURN_DOM: false,
};

// Конфигурация для профилей пользователей
const USER_PROFILE_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'a', 'br'],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

// Конфигурация для plain text (убирает все HTML)
const TEXT_ONLY_CONFIG = {
  ALLOWED_TAGS: [],
  KEEP_CONTENT: true,
};

/**
 * Санитизация HTML для сообщений чата
 */
export const sanitizeChatMessage = (dirty) => {
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, CHAT_MESSAGE_CONFIG);
};

/**
 * Санитизация HTML для профиля пользователя
 */
export const sanitizeUserProfile = (dirty) => {
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, USER_PROFILE_CONFIG);
};

/**
 * Санитизация - только текст (убирает все HTML)
 */
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return DOMPurify.sanitize(text, TEXT_ONLY_CONFIG);
};

/**
 * Санитизация URL
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  
  // Разрешаем только http(s) и mailto протоколы
  const allowedProtocols = ['http:', 'https:', 'mailto:'];
  
  try {
    const parsed = new URL(url);
    if (allowedProtocols.includes(parsed.protocol)) {
      return url;
    }
  } catch (e) {
    // Невалидный URL
  }
  
  return '#';
};
```

### 2. Environment Configuration

```javascript
// frontend/src/config/index.js
export const config = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  
  // Google OAuth
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  
  // Feature Flags
  enableDebugMode: import.meta.env.VITE_DEBUG === 'true',
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  
  // Environment
  isDevelopment: import.meta.env.MODE === 'development',
  isProduction: import.meta.env.MODE === 'production',
};

// Валидация обязательных конфигураций в production
if (config.isProduction) {
  const requiredVars = {
    'VITE_API_BASE_URL': config.apiBaseUrl,
    'VITE_GOOGLE_CLIENT_ID': config.googleClientId,
  };
  
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value || value === '' || value.includes('localhost')) {
      console.error(`❌ ${key} must be set in production!`);
      throw new Error(`Missing or invalid ${key} in production`);
    }
  }
}
```

### 3. Security Headers Component

```javascript
// frontend/src/components/common/SecurityHeaders.jsx
import { useEffect } from 'react';
import { config } from '../../config';

/**
 * Компонент для установки security meta tags
 */
export const SecurityHeaders = () => {
  useEffect(() => {
    // Content Security Policy (fallback если не установлен на сервере)
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      const cspMeta = document.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      
      const csp = config.isProduction 
        ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.openrouter.ai; frame-ancestors 'none';"
        : "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https://api.openrouter.ai; frame-ancestors 'none';";
      
      cspMeta.content = csp;
      document.head.appendChild(cspMeta);
    }
    
    // X-Content-Type-Options
    if (!document.querySelector('meta[http-equiv="X-Content-Type-Options"]')) {
      const nosniffMeta = document.createElement('meta');
      nosniffMeta.httpEquiv = 'X-Content-Type-Options';
      nosniffMeta.content = 'nosniff';
      document.head.appendChild(nosniffMeta);
    }
    
    // Referrer-Policy
    if (!document.querySelector('meta[name="referrer"]')) {
      const referrerMeta = document.createElement('meta');
      referrerMeta.name = 'referrer';
      referrerMeta.content = 'strict-origin-when-cross-origin';
      document.head.appendChild(referrerMeta);
    }
  }, []);
  
  return null;
};
```

---

## 🔍 SECURITY CHECKLIST

### Перед Production Deploy:

- [ ] Установлен и настроен DOMPurify
- [ ] Все `dangerouslySetInnerHTML` используют санитизацию
- [ ] API_BASE_URL в .env переменных
- [ ] Request timeouts настроены
- [ ] Токены в HttpOnly cookies (или защищенная альтернатива)
- [ ] CSRF protection реализован
- [ ] Все .env файлы НЕ в Git
- [ ] Content Security Policy настроен
- [ ] Зависимости проверены на уязвимости (`npm audit`)
- [ ] Error boundaries реализованы
- [ ] Security headers component добавлен
- [ ] Google OAuth Client ID для production
- [ ] Нет console.log с чувствительными данными
- [ ] Source maps отключены для production

### Команды для проверки:

```bash
# Аудит зависимостей
npm audit

# Поиск чувствительных данных в коде
grep -r "password" src/
grep -r "api_key" src/
grep -r "secret" src/

# Проверка что .env не в Git
git ls-files | grep ".env"  # Должно быть пусто

# Build для production
npm run build

# Проверка размера bundle
npm run build -- --analyze
```

---

## 📚 ПОЛЕЗНЫЕ РЕСУРСЫ

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://snyk.io/blog/10-react-security-best-practices/)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Статус:** Готово к внедрению рекомендаций 🚀

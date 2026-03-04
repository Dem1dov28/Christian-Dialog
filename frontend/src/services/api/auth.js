/**
 * API методы для аутентификации и управления пользователями
 */
import { getCsrfToken } from "../../utils/csrf";

export class AuthAPI {
  constructor(client) {
    this.client = client;
  }

  // Регистрация пользователя
  async register(userData) {
    return this.client.post("/auth/register", userData);
  }

  // Вход пользователя
  // OAuth2PasswordRequestForm требует form-urlencoded формат (не JSON)
  // Используем поле username для передачи email
  async login(credentials) {
    const formData = new URLSearchParams();
    formData.append('username', credentials.email || credentials.username); // Поддержка обоих вариантов для обратной совместимости
    formData.append('password', credentials.password);

    const url = `${this.client.baseURL}/auth/login`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const config = {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include', // важно для получения HttpOnly cookie от сервера
    };

    try {
      const response = await fetch(url, config);

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

        // Извлекаем сообщение об ошибке из различных форматов ответа
        let errorMessage = `HTTP error! status: ${response.status}`;

        if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            // FastAPI validation errors
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
        }

        // Если токен истек, очищаем его
        if (response.status === 401) {
          this.client.setToken(null);
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = errorData;
        throw error;
      }

      // Токен теперь хранится в HttpOnly cookie, поэтому access_token из тела можно игнорировать
      const data = await response.json();
      return data;
    } catch (error) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error("Network error - please check your connection");
      } else if (error.status === 401) {
        // Для 401 ошибок не логируем дополнительно - уже обработано выше
        throw error;
      } else {
        console.error("Login failed:", error);
        throw error;
      }
    }
  }

  // Вход через Telegram initData
  async loginWithTelegram(initData) {
    const response = await this.client.post("/auth/telegram", { init_data: initData });
    return response;
  }

  // Отправить код на email для привязки Telegram
  async sendTelegramLinkCode(email) {
    return this.client.post("/auth/send-telegram-link-code", { email });
  }

  // Log In With Telegram (OIDC) — получить конфиг
  async getTelegramOIDCConfig() {
    return this.client.get("/auth/telegram-oidc/config");
  }

  // Log In With Telegram (OIDC) — обмен code на токен
  async loginWithTelegramOIDC(payload) {
    return this.client.post("/auth/telegram-oidc", payload);
  }

  // Telegram Login Widget (классический виджет) — конфиг
  async getTelegramWidgetConfig() {
    return this.client.get("/auth/telegram-widget/config");
  }

  // Telegram Login Widget — отправка данных из callback onTelegramAuth
  async loginWithTelegramWidget(widgetData) {
    return this.client.post("/auth/telegram-widget", widgetData);
  }

  // Проверить код и привязать Telegram к аккаунту
  async verifyAndLinkTelegram(email, code, initData) {
    return this.client.post("/auth/verify-and-link-telegram", {
      email,
      code,
      init_data: initData,
    });
  }

  // Привязать Telegram к уже авторизованному пользователю (после входа через Google)
  async linkTelegram(initData) {
    return this.client.post("/auth/link-telegram", { init_data: initData });
  }

  // Отвязать Telegram от аккаунта
  async unlinkTelegram() {
    return this.client.post("/auth/unlink-telegram");
  }

  // Привязать Google к аккаунту (при уже авторизованном пользователе)
  async linkGoogle(credential, clientId = null) {
    const payload = { credential };
    if (clientId) payload.client_id = clientId;
    return this.client.post("/auth/link-google", payload);
  }

  // Отвязать Google от аккаунта
  async unlinkGoogle() {
    return this.client.post("/auth/unlink-google");
  }

  // Вход через Google OAuth
  async loginWithGoogle(credential, clientId = null) {
    const payload = {
      credential,
    };

    if (clientId) {
      payload.client_id = clientId;
    }

    const response = await this.client.post("/auth/google", payload);
    // access_token устанавливается сервером в HttpOnly cookie
    return response;
  }

  // Выход пользователя
  async logout() {
    try {
      await this.client.post("/auth/logout");
    } finally {
      this.client.setToken(null);
    }
  }

  // Получить информацию о текущем пользователе
  async getCurrentUser() {
    // Добавляем уникальный параметр для предотвращения кэширования
    const timestamp = Date.now();
    return this.client.get(`/auth/me?t=${timestamp}`);
  }

  // Проверить лимит сообщений перед отправкой
  async checkMessageLimit() {
    return this.client.get("/auth/check-message-limit");
  }

  // Обновить информацию о пользователе
  async updateUser(userData) {
    return this.client.put("/auth/me", userData);
  }

  // Загрузить аватар пользователя
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${this.client.baseURL}/auth/me/avatar`;
    const config = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.client.token}`,
        // НЕ устанавливаем Content-Type - браузер сделает это автоматически с boundary для multipart/form-data
      },
      body: formData,
    };

    try {
      const response = await fetch(url, config);

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

        // Извлекаем сообщение об ошибке из различных форматов ответа
        let errorMessage = `HTTP error! status: ${response.status}`;

        if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            // FastAPI validation errors
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
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = errorData;
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        throw new Error("Network error - please check your connection");
      }
      throw error;
    }
  }

  // Проверить валидность токена
  async verifyToken() {
    try {
      return await this.client.get("/auth/verify-token");
    } catch (error) {
      // Для 401 ошибок не логируем в консоль - это нормальное поведение
      // для неавторизованных или пользователей с истекшим токеном
      if (error.status === 401 || error.message?.includes('401') || error.message === 'Not authenticated') {
        // Создаем чистую ошибку без логирования
        const cleanError = new Error('Not authenticated');
        cleanError.status = 401;
        throw cleanError;
      }
      throw error;
    }
  }

  // Проверить соединение с сервером
  async checkServerConnection() {
    try {
      const response = await fetch(`${this.client.baseURL}/auth/test`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      return response.ok;
    } catch (error) {
      console.error("Server connection check failed:", error);
      return false;
    }
  }

  // Получить статистику использования пользователя
  async getUsageStats() {
    return this.client.get("/auth/usage-stats");
  }

  // Экспортировать данные чата
  async exportChatData(conversationId, format = "txt") {
    return this.client.post("/auth/export-chat-data", {
      conversation_id: conversationId,
      format: format,
    });
  }

  // Обновить до API доступа
  async upgradeToAPI(apiKey) {
    return this.client.post("/auth/upgrade-to-api", {
      api_key: apiKey,
    });
  }

  // Обновить подписку на любой тариф
  async upgradeSubscription(subscriptionTier, apiKey = null) {

    const requestData = {
      subscription_tier: subscriptionTier,
    };

    if (apiKey) {
      requestData.api_key = apiKey;
    }

    try {
      const response = await this.client.post(
        "/auth/upgrade-subscription-real",
        requestData
      );
      return response;
    } catch (error) {
      console.error("Failed to upgrade subscription:", error);
      throw error;
    }
  }

  // Вспомогательная функция для получения лимита сообщений
  getMessagesLimit(tier) {
    const limits = {
      free: 50,
      plus: 500,
      pro: 2000,
      api: 10000,
    };
    return limits[tier] || limits.free;
  }

  // Получить статус подписки
  async getSubscriptionStatus() {
    const t = Date.now();
    // Используем /auth/me вместо /auth/subscription-status так как он работает
    const userData = await this.client.get(`/auth/me?t=${t}`);

    // Преобразуем данные пользователя в формат статуса подписки
    return {
      subscription_tier: userData.subscription_tier || "free",
      is_expired: false,
      expires_at: userData.expires_at || null, // Используем реальную дату истечения
      days_remaining: null,
      messages_used: userData.messages_used || 0,
      messages_limit: userData.messages_limit || 50,
      api_access: userData.api_access || false,
      can_upgrade: (userData.subscription_tier || "free") !== "premium",
      can_downgrade: (userData.subscription_tier || "free") !== "free",
    };
  }

  // Проверить существование email
  async checkEmailExists(email) {
    return this.client.post("/auth/check-email", { email });
  }

  // Отправить код для сброса пароля
  async sendPasswordResetCode(email) {
    return this.client.post("/auth/forgot-password", { email });
  }

  // Отправить код верификации
  async sendResetCode(email) {
    return this.client.post("/auth/send-reset-code", { email });
  }

  // Отправить код для регистрации
  async sendRegistrationCode(email) {
    return this.client.post("/auth/send-registration-code", { email });
  }

  // Проверить код верификации
  async verifyResetCode(email, code) {
    return this.client.post("/auth/verify-reset-code", { email, code });
  }

  // Сбросить пароль
  async resetPassword(email, token, newPassword) {
    return this.client.post("/auth/reset-password", { email, token, new_password: newPassword });
  }

  // Удалить аккаунт пользователя
  async deleteAccount(password) {
    return this.client.post("/auth/delete-account", { password });
  }

  // Выйти со всех устройств
  async logoutAllDevices() {
    return this.client.post("/auth/logout-all");
  }

  // Удалить все данные пользователя
  async clearAllData() {
    return this.client.post("/auth/clear-all-data");
  }

  // --- Платежи ---

  // Узнать, какие провайдеры включены: { cryptocloud_enabled, bepaid_enabled, telegram_stars_enabled }
  async getPaymentsConfig() {
    return this.client.get("/payments/config");
  }

  // Создать инвойс Telegram Stars (для Mini App)
  async createTelegramStarsInvoice(tier) {
    return this.client.post("/payments/telegram-stars/create-invoice", { tier });
  }

  // CryptoCloud: создать крипто-инвойс → получить link на страницу оплаты
  async createCryptoInvoice(tier) {
    return this.client.post("/payments/cryptocloud/create-invoice", { tier });
  }

  // BePaid: создать подписку → получить redirect_url на страницу оплаты картой
  async createCheckout(tier, returnUrl) {
    return this.client.post("/payments/bepaid/create-checkout", {
      tier,
      return_url: returnUrl,
    });
  }
}


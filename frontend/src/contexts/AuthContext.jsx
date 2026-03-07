import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient from "../services/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [usageStats, setUsageStats] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Проверяем токен при загрузке приложения
  useEffect(() => {
    console.log("[AuthContext] useEffect triggered, isInitialized:", isInitialized);

    // Защита от повторных вызовов в React StrictMode
    if (isInitialized) return;

    const initAuth = async () => {
      try {
        // Google OAuth redirect flow: возврат из внешнего браузера с return_token
        const startParam = typeof window !== "undefined" && window.Telegram?.WebApp?.startParam;
        if (startParam && typeof startParam === "string" && startParam.startsWith("google_")) {
          const token = startParam.slice(7);
          if (token) {
            try {
              const tgResponse = await apiClient.googleTelegramReturn(token);
              const fullUser = tgResponse?.user || await apiClient.getCurrentUser();
              setUser(fullUser);
              localStorage.setItem("user_data", JSON.stringify(fullUser));
              setIsAuthenticated(true);
              const tgInitData = window.Telegram?.WebApp?.initData;
              if (tgInitData) {
                try {
                  await apiClient.linkTelegram(tgInitData);
                  const updated = await apiClient.getCurrentUser();
                  setUser(updated);
                  localStorage.setItem("user_data", JSON.stringify(updated));
                } catch (_) {}
              }
              try {
                const stats = await apiClient.getUsageStats();
                setUsageStats(stats);
              } catch (e) {
                console.error("Failed to load usage stats:", e);
              }
              setIsInitializing(false);
              setIsInitialized(true);
              return;
            } catch (err) {
              console.warn("[AuthContext] Google telegram-return failed:", err?.message);
            }
          }
        }

        // В Telegram Mini App: пробуем войти по initData (если пользователь не вышел явно)
        const tgInitData = typeof window !== "undefined" && window.Telegram?.WebApp?.initData;
        if (tgInitData && !localStorage.getItem("telegram_skip_auto_login")) {
          try {
            const tgResponse = await apiClient.loginWithTelegram(tgInitData);
            if (tgResponse?.user) {
              const fullUser = await apiClient.getCurrentUser();
              setUser(fullUser);
              localStorage.setItem("user_data", JSON.stringify(fullUser));
              setIsAuthenticated(true);
              try {
                const stats = await apiClient.getUsageStats();
                setUsageStats(stats);
              } catch (e) {
                console.error("Failed to load usage stats:", e);
              }
              setIsInitializing(false);
              setIsInitialized(true);
              return;
            }
            // needs_link — пользователь не привязан, продолжаем обычную инициализацию
          } catch (tgErr) {
            // 503, 400 и т.д. — Telegram auth не настроен или initData невалиден
            if (tgErr.status !== 429 && tgErr.message?.includes?.("Network") === false) {
              console.warn("[AuthContext] Telegram login skipped:", tgErr.message);
            }
          }
        }

        // Проверяем наличие признака аутентификации перед вызовом verifyToken
        // чтобы избежать 401 ошибки в консоли для неавторизованных пользователей
        const hasAuthIndicator = document.cookie.includes('access_token') || 
                                 localStorage.getItem('user_data');
        if (!hasAuthIndicator) {
          // Нет признаков аутентификации, сразу завершаем инициализацию
          setIsInitializing(false);
          setIsInitialized(true);
          return;
        }
        
        // Проверяем токен через cookie (HttpOnly), без localStorage
        const userData = await apiClient.verifyToken();
        // Сразу после верификации подтягиваем /auth/me для полного набора полей (messages_cycle_started_at)
        try {
          const fullUser = await apiClient.getCurrentUser();
          setUser(fullUser);
          // Сохраняем данные пользователя для офлайн режима
          localStorage.setItem("user_data", JSON.stringify(fullUser));
        } catch (e) {
          setUser(userData.user);
          // Сохраняем данные пользователя для офлайн режима
          localStorage.setItem("user_data", JSON.stringify(userData.user));
        }
        setIsAuthenticated(true);
        // Загружаем статистику использования
        try {
          const stats = await apiClient.getUsageStats();
          setUsageStats(stats);
        } catch (error) {
          console.error("Failed to load usage stats:", error);
        }
      } catch (error) {
        // Не логируем 401 ошибки - это нормальное поведение для неавторизованных пользователей
        if (error.status !== 401 && !error.message?.includes('401') && error.message !== 'Not authenticated') {
          console.error("Token verification failed:", error);
        }

        // Проверяем тип ошибки
        if (
          error.message.includes("Network error") ||
          error.message.includes("Failed to fetch")
        ) {
          console.warn(
            "Network error detected, keeping auth state for offline mode"
          );
          // При сетевых ошибках сохраняем состояние аутентификации
          // Пользователь может работать в офлайн режиме
          setIsAuthenticated(true); // Оставляем как авторизованного
          // Не очищаем user и usageStats - они остаются в состоянии
        } else if (
          error.message === "Not authenticated" ||
          error.message.includes("401")
        ) {
          // Ожидаемое поведение для неавторизованных пользователей - не логируем
          localStorage.removeItem("user_data"); // Очищаем сохраненные данные пользователя
          apiClient.setToken(null);
          setUser(null);
          setIsAuthenticated(false);
          setUsageStats(null);
        } else {
          // Для других ошибок также сохраняем состояние
          console.warn("Authentication error (non-auth):", error.message);
          setIsAuthenticated(true); // Оставляем как авторизованного
        }
      }
      setIsInitializing(false);
      setIsInitialized(true);
    };

    initAuth();
  }, [isInitialized]);

  // Проверка валидности токена (токен живёт 7 дней)
  useEffect(() => {
    if (isAuthenticated && user) {
      const checkInterval = 6 * 60 * 60 * 1000; // каждые 6 часов
      const tokenCheck = setInterval(async () => {
        try {
          await apiClient.verifyToken();
        } catch (error) {
          console.log("Token check failed, logging out:", error.message);
          forceLogout();
        }
      }, checkInterval);

      return () => clearInterval(tokenCheck);
    }
  }, [isAuthenticated, user]);

  // Вход пользователя
  const login = async (credentials) => {
    try {
      setIsLoading(true);
      const response = await apiClient.login(credentials);
      // После логина подтягиваем /auth/me для полного набора полей
      try {
        const fullUser = await apiClient.getCurrentUser();
        setUser(fullUser);
        // Сохраняем данные пользователя для офлайн режима
        localStorage.setItem("user_data", JSON.stringify(fullUser));
      } catch (e) {
        setUser(response.user);
        // Сохраняем данные пользователя для офлайн режима
        localStorage.setItem("user_data", JSON.stringify(response.user));
      }
      setIsAuthenticated(true);
      try { localStorage.removeItem('telegram_skip_auto_login'); } catch (_) {}
      // Загружаем статистику использования
      try {
        const stats = await apiClient.getUsageStats();
        setUsageStats(stats);
      } catch (error) {
        console.error("Failed to load usage stats:", error);
      }
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithTelegram = useCallback(async (initData) => {
    try {
      setIsLoading(true);
      const response = await apiClient.loginWithTelegram(initData);
      if (response?.needs_link) {
        return { needs_link: true };
      }
      if (response?.user) {
        try {
          const fullUser = await apiClient.getCurrentUser();
          setUser(fullUser);
          localStorage.setItem("user_data", JSON.stringify(fullUser));
        } catch (e) {
          setUser(response.user);
          localStorage.setItem("user_data", JSON.stringify(response.user));
        }
        setIsAuthenticated(true);
        try { localStorage.removeItem('telegram_skip_auto_login'); } catch (_) {}
        try {
          const stats = await apiClient.getUsageStats();
          setUsageStats(stats);
        } catch (error) {
          console.error("Failed to load usage stats:", error);
        }
        return response;
      }
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendTelegramLinkCode = async (email) => {
    return apiClient.sendTelegramLinkCode(email);
  };

  const verifyAndLinkTelegram = async (email, code, initData) => {
    try {
      setIsLoading(true);
      const response = await apiClient.verifyAndLinkTelegram(email, code, initData);
      if (response?.user) {
        try {
          const fullUser = await apiClient.getCurrentUser();
          setUser(fullUser);
          localStorage.setItem("user_data", JSON.stringify(fullUser));
        } catch (e) {
          setUser(response.user);
          localStorage.setItem("user_data", JSON.stringify(response.user));
        }
        setIsAuthenticated(true);
        try { localStorage.removeItem('telegram_skip_auto_login'); } catch (_) {}
        try {
          const stats = await apiClient.getUsageStats();
          setUsageStats(stats);
        } catch (error) {
          console.error("Failed to load usage stats:", error);
        }
        return response;
      }
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithTelegramWidget = async (widgetData) => {
    try {
      setIsLoading(true);
      const response = await apiClient.loginWithTelegramWidget(widgetData);
      const userFromLogin = response?.user;
      try {
        const fullUser = await apiClient.getCurrentUser();
        setUser(fullUser);
        localStorage.setItem("user_data", JSON.stringify(fullUser));
      } catch (e) {
        setUser(userFromLogin || response?.user);
        localStorage.setItem("user_data", JSON.stringify(userFromLogin || response?.user));
      }
      setIsAuthenticated(true);
      try { localStorage.removeItem('telegram_skip_auto_login'); } catch (_) {}
      try {
        const stats = await apiClient.getUsageStats();
        setUsageStats(stats);
      } catch (error) {
        console.error("Failed to load usage stats:", error);
      }
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async ({ credential, clientId }) => {
    console.log("[AuthContext] loginWithGoogle called:", {
      hasCredential: !!credential,
      credentialLength: credential?.length,
      clientId,
      origin: window.location.origin,
    });

    if (!credential) {
      throw new Error("Missing Google credential");
    }

    try {
      setIsLoading(true);
      const response = await apiClient.loginWithGoogle(credential, clientId);
      // В ответе бэкенда уже есть актуальный user с avatar_url из Google
      const userFromLogin = response?.user;

      try {
        const fullUser = await apiClient.getCurrentUser();
        // Подтягиваем avatar_url из ответа логина, если в /me его ещё нет (гонка с cookie)
        const mergedUser = userFromLogin?.avatar_url && !fullUser?.avatar_url
          ? { ...fullUser, avatar_url: userFromLogin.avatar_url }
          : fullUser;
        setUser(mergedUser);
        localStorage.setItem("user_data", JSON.stringify(mergedUser));
      } catch (e) {
        setUser(userFromLogin || response?.user);
        localStorage.setItem("user_data", JSON.stringify(userFromLogin || response?.user));
      }

      setIsAuthenticated(true);
      try {
        const stats = await apiClient.getUsageStats();
        setUsageStats(stats);
      } catch (error) {
        console.error("Failed to load usage stats:", error);
      }
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Регистрация пользователя
  const register = async (userData) => {
    try {
      setIsLoading(true);
      const response = await apiClient.register(userData);
      // После регистрации автоматически входим
      // Используем email для логина, так как логин работает по email
      await login({
        email: userData.email,
        password: userData.password,
      });
      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Выход пользователя
  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      apiClient.setToken(null);
      localStorage.removeItem("user_data");
      sessionStorage.removeItem('app_initial_redirect_done');
      try { localStorage.setItem('telegram_skip_auto_login', '1'); } catch (_) {}
    }
  };

  // Обновление информации о пользователе
  const updateUser = async (userData) => {
    try {
      const updatedUser = await apiClient.updateUser(userData);
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      throw error;
    }
  };

  // Принудительный выход при ошибке авторизации
  const forceLogout = () => {
    localStorage.removeItem("user_data");
    try { localStorage.setItem('telegram_skip_auto_login', '1'); } catch (_) {}
    sessionStorage.removeItem('app_initial_redirect_done');
    apiClient.setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setUsageStats(null);
  };

  // Принудительная переинициализация аутентификации
  const reinitializeAuth = async () => {
    setIsInitializing(true);
    setIsInitialized(false);

    try {
      const userData = await apiClient.verifyToken();
      const fullUser = await apiClient.getCurrentUser();
      setUser(fullUser);
      setIsAuthenticated(true);

      try {
        const stats = await apiClient.getUsageStats();
        setUsageStats(stats);
      } catch (error) {
        console.error("Failed to load usage stats:", error);
      }
    } catch (error) {
      console.error("Reinitialization failed:", error);
      forceLogout();
    }

    setIsInitializing(false);
    setIsInitialized(true);
  };

  // Получить статистику использования
  const fetchUsageStats = async () => {
    try {
      const stats = await apiClient.getUsageStats();
      setUsageStats(stats);
      return stats;
    } catch (error) {
      console.error("Failed to fetch usage stats:", error);
      throw error;
    }
  };

  // Экспортировать данные чата
  const exportChatData = async (conversationId, format = "txt") => {
    try {
      const response = await apiClient.exportChatData(conversationId, format);
      return response;
    } catch (error) {
      console.error("Failed to export chat data:", error);
      throw error;
    }
  };

  // Обновить до API доступа
  const upgradeToAPI = async (apiKey) => {
    try {
      const response = await apiClient.upgradeToAPI(apiKey);
      // Обновляем данные пользователя после успешного обновления
      if (response.success) {
        const updatedUser = await apiClient.getCurrentUser();
        // Принудительно обновляем состояние, создавая новый объект
        setUser({ ...updatedUser });
        // Обновляем статистику использования
        await fetchUsageStats();
      }
      return response;
    } catch (error) {
      console.error("Failed to upgrade to API:", error);
      throw error;
    }
  };

  // Обновить подписку на любой тариф
  const upgradeSubscription = async (subscriptionTier, apiKey = null) => {
    try {
      console.log(
        "AuthContext: Starting subscription upgrade to",
        subscriptionTier
      );
      const response = await apiClient.upgradeSubscription(
        subscriptionTier,
        apiKey
      );
      console.log("AuthContext: Upgrade response:", response);
      console.log("AuthContext: Response expires_at:", response.expires_at);

      // Обновляем данные пользователя после успешного обновления
      if (response.success) {
        // 1) Немедленно отражаем ключевые поля из ответа, чтобы UI обновился без задержек
        setUser((prev) =>
          prev
            ? {
              ...prev,
              subscription_tier:
                response.subscription_tier ?? prev.subscription_tier,
              messages_limit:
                typeof response.messages_limit === "number"
                  ? response.messages_limit
                  : prev.messages_limit,
              expires_at: response.expires_at ?? prev.expires_at,
            }
            : prev
        );

        // 2) Затем подтягиваем актуальные данные пользователя с бэка для консистентности
        console.log("AuthContext: Getting updated user data...");
        const updatedUser = await apiClient.getCurrentUser();
        console.log("AuthContext: Updated user data:", updatedUser);
        console.log("AuthContext: Current user state before update:", user);

        setUser({ ...updatedUser });

        // Дополнительно обновляем состояние через setTimeout для принудительного ре-рендера
        setTimeout(() => {
          console.log("AuthContext: Force updating user state...");
          setUser((prevUser) => ({ ...prevUser, ...updatedUser }));
        }, 100);

        console.log("AuthContext: User state updated");
        // Обновляем статистику использования
        await fetchUsageStats();

        // Принудительно обновляем статус подписки для UI
        try {
          const subscriptionStatus = await getSubscriptionStatus();
          console.log(
            "AuthContext: Updated subscription status:",
            subscriptionStatus
          );
        } catch (error) {
          console.error(
            "AuthContext: Failed to refresh subscription status:",
            error
          );
        }
      }
      return response;
    } catch (error) {
      console.error("AuthContext: Failed to upgrade subscription:", error);
      console.error("AuthContext: Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw error;
    }
  };

  // Получить статус подписки
  const getSubscriptionStatus = async () => {
    try {
      const status = await apiClient.getSubscriptionStatus();
      return status;
    } catch (error) {
      console.error("Failed to get subscription status:", error);
      throw error;
    }
  };

  // Обновить данные пользователя (для обновления счетчика сообщений)
  const refreshUserData = async () => {
    try {
      console.log("AuthContext: Refreshing user data...");
      const updatedUser = await apiClient.getCurrentUser();
      console.log("AuthContext: Updated user data:", updatedUser);
      setUser({ ...updatedUser });

      // Также обновляем статистику использования
      try {
        const stats = await apiClient.getUsageStats();
        setUsageStats(stats);
      } catch (error) {
        console.error("Failed to refresh usage stats:", error);
      }

      return updatedUser;
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      throw error;
    }
  };

  // Удалить аккаунт пользователя
  const deleteUserAccount = async (password) => {
    try {
      console.log("AuthContext: Deleting user account...");
      const response = await apiClient.deleteAccount(password);
      console.log("AuthContext: Account deleted:", response);
      return response;
    } catch (error) {
      console.error("AuthContext: Failed to delete account:", error);
      throw error;
    }
  };

  // Отвязать Google от аккаунта
  const unlinkGoogle = async () => {
    try {
      await apiClient.unlinkGoogle();
      await refreshUserData();
    } catch (error) {
      console.error("AuthContext: Failed to unlink Google:", error);
      throw error;
    }
  };

  const unlinkTelegram = async () => {
    try {
      await apiClient.unlinkTelegram();
      await refreshUserData();
    } catch (error) {
      console.error("AuthContext: Failed to unlink Telegram:", error);
      throw error;
    }
  };

  const linkGoogle = async (credential, clientId) => {
    try {
      await apiClient.linkGoogle(credential, clientId);
      await refreshUserData();
    } catch (error) {
      console.error("AuthContext: Failed to link Google:", error);
      throw error;
    }
  };

  // Выйти со всех устройств
  const logoutAllDevices = async () => {
    try {
      console.log("AuthContext: Logging out from all devices...");
      const response = await apiClient.logoutAllDevices();
      console.log("AuthContext: Logged out from all devices:", response);
      return response;
    } catch (error) {
      console.error("AuthContext: Failed to logout from all devices:", error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    isInitializing,
    usageStats,
    login,
    loginWithTelegram,
    loginWithTelegramWidget,
    sendTelegramLinkCode,
    verifyAndLinkTelegram,
    loginWithGoogle,
    register,
    logout,
    updateUser,
    forceLogout,
    reinitializeAuth,
    fetchUsageStats,
    exportChatData,
    upgradeToAPI,
    upgradeSubscription,
    getSubscriptionStatus,
    refreshUserData,
    deleteUserAccount,
    logoutAllDevices,
    linkGoogle,
    unlinkGoogle,
    unlinkTelegram,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import React, { createContext, useContext, useState, useEffect } from "react";
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

  // Автоматическое обновление токена перед истечением
  useEffect(() => {
    if (isAuthenticated && user) {
      const tokenRefreshInterval = setInterval(async () => {
        try {
          // Проверяем токен каждые 20 минут (токен живет 24 часа)
          await apiClient.verifyToken();
          console.log("Token refresh check passed");
        } catch (error) {
          console.log("Token refresh failed, logging out:", error.message);
          forceLogout();
        }
      }, 20 * 60 * 1000); // Проверяем каждые 20 минут

      return () => clearInterval(tokenRefreshInterval);
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
      localStorage.removeItem("user_data"); // Очищаем сохраненные данные пользователя
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
    localStorage.removeItem("user_data"); // Очищаем сохраненные данные пользователя
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

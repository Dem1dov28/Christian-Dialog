import React, { useState, useEffect } from "react";
import {
  FiUser,
  FiBookmark,
  FiSettings,
  FiLogOut,
  FiEdit3,
  FiX,
  FiCamera,
  FiShield,
  FiGlobe,
  FiShare2,
  FiStar,
  FiChevronRight,
  FiLock,
  FiTrash2,
  FiAlertTriangle,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useChats } from "../../contexts/ChatsContext";
import { useFolders } from "../../contexts/FoldersContext";
import { useNotification } from "../../contexts/NotificationContext";
import apiClient from "../../services/api";
import SubscriptionStatus from "./SubscriptionStatus";
import UsageStatistics from "./UsageStatistics";
import { useMaxWidth } from "../../hooks/common/use-mobile";
import { useNavigate } from "react-router-dom";
import { useTelegramWebApp } from "../../hooks/useTelegramWebApp";

// i18n function stub for localization - теперь используем LanguageContext

const ProfileScreen = ({ isOpen = false, onClose, onOpenPricing, onChatSelect }) => {
  const { user, logout, usageStats, upgradeToAPI, fetchUsageStats, updateUser, refreshUserData, deleteUserAccount, logoutAllDevices, unlinkGoogle, unlinkTelegram } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isTelegram } = useTelegramWebApp();
  const { showSuccess, showError } = useNotification();
  const { clearAllConversations } = useChats();
  const { loadFolders } = useFolders();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isPrivacyMenuOpen, setIsPrivacyMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isShown, setIsShown] = useState(false);
  const [hasFetchedStats, setHasFetchedStats] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const isNarrowViewport = useMaxWidth(549);

  // Управление рендерингом и анимацией
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Запускаем анимацию открытия в следующем кадре
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsShown(true);
        });
      });
    } else {
      // Запускаем анимацию закрытия
      setIsShown(false);
      // Убираем из DOM после завершения анимации
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Сбрасываем флаг загрузки при смене пользователя
  useEffect(() => {
    setHasFetchedStats(false);
  }, [user?.id]);

  // Загружаем статистику при открытии профиля и обновляем при изменении пользователя
  useEffect(() => {
    if (!isOpen) {
      // Разрешаем повторную загрузку при следующем открытии
      if (hasFetchedStats) {
        setHasFetchedStats(false);
      }
      return;
    }

    let isMounted = true;

    const loadStats = async () => {
      if (!user?.id || hasFetchedStats) {
        return;
      }

      try {
        await fetchUsageStats();
        if (isMounted) {
          setHasFetchedStats(true);
        }
      } catch (error) {
        if (isMounted) {
          console.error("ProfileScreen: Failed to load usage stats:", error);
        }
      }
    };

    loadStats();

    return () => {
      isMounted = false;
    };
    // Убираем fetchUsageStats из зависимостей, чтобы избежать бесконечного цикла
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id, hasFetchedStats]);

  const handleLogout = async () => {
    try {
      if (isTelegram || window.confirm(t("profile.confirm.logout"))) {
        await logout();
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Privacy panel handlers
  const handleUpdateUsername = async () => {
    if (!newUsername.trim() || newUsername.trim() === user?.username) {
      return;
    }
    try {
      setIsLoading(true);
      await updateUser({ username: newUsername.trim() });
      showSuccess(t("profile.privacy.usernameUpdated"));
      setNewUsername("");
    } catch (error) {
      console.error("Failed to update username:", error);
      showError(error.message || "Failed to update username");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = () => {
    // Navigate to forgot password page with user's email pre-filled
    navigate("/forgot-password", {
      state: {
        email: user?.email || "",
        fromProfile: true
      }
    });
    onClose();
  };

  const handleDeleteData = async () => {
    try {
      setIsLoading(true);
      await clearAllConversations();
      // Перезагружаем папки, чтобы очистить их в интерфейсе
      if (typeof loadFolders === 'function') {
        await loadFolders();
      }
      showSuccess(t("profile.privacy.dataDeleted"));
      setShowDeleteDataModal(false);
    } catch (error) {
      console.error("Failed to delete data:", error);
      showError(error.message || "Failed to delete data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (user?.auth_provider !== "google" && !deleteAccountPassword.trim()) {
      showError(t("profile.privacy.passwordRequired"));
      return;
    }
    try {
      setIsLoading(true);
      if (deleteUserAccount) {
        await deleteUserAccount(deleteAccountPassword);
      }
      showSuccess(t("profile.privacy.accountDeleted"));
      setShowDeleteAccountModal(false);
      await logout();
    } catch (error) {
      console.error("Failed to delete account:", error);
      showError(error.message || "Failed to delete account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    try {
      setIsLoading(true);
      await logoutAllDevices();
      showSuccess(t("profile.privacy.loggedOutAllDevices"));
      // После выхода со всех устройств выполняем локальный выход
      await logout();
    } catch (error) {
      console.error("Failed to logout from all devices:", error);
      showError(error.message || "Failed to logout from all devices");
    } finally {
      setIsLoading(false);
    }
  };

  const languages = [
    { code: 'ru', name: t("profile.language_ru"), flag: '🇷🇺' },
    { code: 'en', name: t("profile.language_en"), flag: '🇺🇸' },
  ];

  const currentLanguageName = language === 'ru' ? t("profile.language_ru") : t("profile.language_en");

  const handleAvatarEdit = () => {
    // Создаем скрытый input для выбора файла
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Проверяем размер файла (максимум 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showError(t("profile.avatar.sizeError") || "Размер файла не должен превышать 5MB");
        return;
      }

      // Проверяем тип файла
      if (!file.type.startsWith("image/")) {
        showError(t("profile.avatar.typeError") || "Файл должен быть изображением");
        return;
      }

      try {
        setIsLoading(true);
        const updatedUser = await apiClient.uploadAvatar(file);
        console.log("Avatar uploaded, updated user:", updatedUser);
        // Обновляем данные пользователя в контексте
        if (refreshUserData) {
          await refreshUserData();
        } else if (updateUser) {
          // Если refreshUserData недоступен, используем updateUser
          // Но uploadAvatar уже возвращает обновленного пользователя, так что просто обновляем локально
          localStorage.setItem("user_data", JSON.stringify(updatedUser));
        }
        showSuccess(t("profile.avatar.uploadSuccess") || "Аватар успешно загружен");
      } catch (error) {
        console.error("Failed to upload avatar:", error);
        showError(error.message || t("profile.avatar.uploadError") || "Ошибка при загрузке аватара");
      } finally {
        setIsLoading(false);
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const handleUpgradeClick = () => {
    onOpenPricing();
  };


  const handleUpgradeToAPI = async (apiKey) => {
    try {
      await upgradeToAPI(apiKey);
      setShowUpgradeModal(false);
      showSuccess(t("chat.apiAccessActivated"));
    } catch (error) {
      console.error("Upgrade failed:", error);
      showError(t("chat.apiAccessError"));
    }
  };

  // Menu sections data
  const menuSections = [
    {
      title: t("profile.sections.account"),
      data: [
        {
          id: "subscription-status",
          label: t("profile.menu.subscription_status"),
          icon: FiUser,
          onPress: handleUpgradeClick,
          rightElement: (
            <span className="text-[var(--text-dim)] text-sm">
              {user?.subscription_tier === "free"
                ? t("profile.subscription.free")
                : user?.subscription_tier === "plus"
                  ? "Plus"
                  : user?.subscription_tier === "pro"
                    ? "Pro"
                    : user?.subscription_tier === "api"
                      ? "API"
                      : t("profile.subscription.free")}
            </span>
          ),
        },
      ],
    },
    {
      title: t("profile.sections.settings"),
      data: [
        {
          id: "privacy",
          label: t("profile.menu.privacy"),
          icon: FiShield,
          onPress: () => {
            setIsPrivacyMenuOpen(!isPrivacyMenuOpen);
          },
          rightElement: (
            <div className="flex items-center gap-2">
              {isPrivacyMenuOpen ? (
                <FiChevronRight className="w-4 h-4 text-[var(--text-dim)] transform rotate-90" />
              ) : (
                <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
              )}
            </div>
          ),
        },
        {
          id: "language",
          label: t("profile.menu.language"),
          icon: FiGlobe,
          onPress: () => {
            setIsLanguageMenuOpen(!isLanguageMenuOpen);
          },
          rightElement: (
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-dim)] text-sm">
                {currentLanguageName}
              </span>
              {isLanguageMenuOpen ? (
                <FiChevronRight className="w-4 h-4 text-[var(--text-dim)] transform rotate-90" />
              ) : (
                <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
              )}
            </div>
          ),
        },

      ],
    },
    {
      title: t("profile.sections.support"),
      data: [

      ],
    },
    {
      title: t("profile.sections.danger"),
      data: [
        {
          id: "logout",
          label: t("profile.menu.logout"),
          icon: FiLogOut,
          onPress: handleLogout,
          isDanger: true,
        },
      ],
    },
  ];

  // Flatten all menu items into a single list (no section headers)
  const flatMenuItems = menuSections.flatMap((section) => section.data);

  // Не рендерим компонент, если он еще не был открыт
  if (!isRendered) {
    return null;
  }

  const containerStyle = isNarrowViewport
    ? { width: "100%", maxWidth: "100%" }
    : { width: "var(--left-panel-width, 350px)" };

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col h-full profile-screen transform transition-transform duration-300 ease-in-out ${isShown ? "translate-x-0" : "-translate-x-full"
        }${isNarrowViewport ? " w-full max-w-full" : ""}`}
      style={containerStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <h1 className="text-xl font-semibold text-[var(--text-white)]">
          {t("profile.title")}
        </h1>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-[var(--text-dim)] hover:bg-[var(--hover-bg)] transition-colors"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Section A: Header Profile Card */}
        <div className="p-6 text-center border-b border-[var(--border-color)]">
          {/* Avatar with Edit Button */}
          <div className="relative inline-block mb-4">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url.startsWith("http") ? user.avatar_url : `${apiClient.baseURL}${user.avatar_url}`}
                alt={user?.full_name || user?.username || "User"}
                className="w-24 h-24 rounded-full object-cover profile-avatar mx-auto shadow-lg"
                style={{ display: "block" }}
                referrerPolicy={user.avatar_url.startsWith("http") ? "no-referrer" : undefined}
                onError={(e) => {
                  // Если изображение не загрузилось, показываем инициал
                  console.error("Failed to load avatar image:", user.avatar_url);
                  e.target.style.display = "none";
                  const fallback = e.target.nextElementSibling;
                  if (fallback) {
                    fallback.style.display = "flex";
                  }
                }}
                onLoad={(e) => {
                  console.log("Avatar image loaded successfully:", user.avatar_url);
                  const fallback = e.target.nextElementSibling;
                  if (fallback) {
                    fallback.style.display = "none";
                  }
                }}
              />
            ) : null}
            <div
              className={`w-24 h-24 rounded-full profile-avatar profile-avatar-fallback flex items-center justify-center text-white font-bold text-2xl mx-auto`}
              style={{ display: user?.avatar_url ? "none" : "flex" }}
            >
              {user?.username?.charAt(0)?.toUpperCase() || user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <button
              onClick={handleAvatarEdit}
              className="absolute bottom-0 right-0 w-8 h-8 profile-edit-button rounded-full flex items-center justify-center"
              title={t("profile.avatar.edit")}
            >
              <FiCamera className="w-4 h-4 text-[var(--text-dim)]" />
            </button>
          </div>

          {/* User Name */}
          <h2 className="text-2xl font-bold text-[var(--text-white)] mb-2">
            {user?.full_name || user?.username || "User"}
          </h2>

          {/* Email */}
          <p className="text-[var(--text-dim)] text-sm mb-4">
            {user?.email || "user@epochaldialog.com"}
          </p>

          {/* Subscription Status */}
          <div className="mb-4">
            <SubscriptionStatus
              key={`${user?.subscription_tier}-${user?.expires_at ?? ""}-${user?.messages_used ?? 0
                }`}
              user={user}
              onUpgrade={handleUpgradeClick}
            />
          </div>

          {/* Usage Statistics */}
          <div className="mb-4">
            <UsageStatistics
              key={`${user?.subscription_tier}-${user?.messages_limit}-${user?.messages_used ?? 0
                }`}
              usageStats={usageStats}
              user={user}
            />
          </div>
        </div>

        {/* Section B: Single continuous menu (no headers) */}
        <div className="flex-1">
          <div className="space-y-1">
            {flatMenuItems.map((item, itemIndex) => {
              const IconComponent = item.icon;
              const isLanguageItem = item.id === "language";
              const isPrivacyItem = item.id === "privacy";
              return (
                <div key={item.id}>
                  <button
                    onClick={item.onPress}
                    className="w-full flex items-center justify-between p-4 profile-menu-item group"
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent
                        className={`w-5 h-5 transition-colors ${item.isDanger
                          ? "text-red-500 group-hover:text-red-400"
                          : "text-[var(--text-dim)] group-hover:text-[var(--text-white)]"
                          }`}
                      />
                      <span
                        className={`font-medium transition-colors ${item.isDanger
                          ? "text-red-500 group-hover:text-red-400"
                          : "text-[var(--text-white)]"
                          }`}
                      >
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.rightElement}
                      {!item.rightElement && !item.isDanger && (
                        <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
                      )}
                    </div>
                  </button>
                  {/* Language menu dropdown */}
                  {isLanguageItem && (
                    <div
                      className={`overflow-hidden bg-[var(--bg-secondary)] border-t transition-all duration-300 ease-out ${isLanguageMenuOpen
                        ? "max-h-64 opacity-100 translate-y-0 border-[var(--border-color)]"
                        : "max-h-0 opacity-0 -translate-y-2 border-transparent pointer-events-none"
                        }`}
                      style={{
                        transitionProperty: "max-height, opacity, transform, border-color",
                      }}
                    >
                      <div className="divide-y divide-[var(--border-color)]">
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLanguage(lang.code);
                              setIsLanguageMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors ${language === lang.code ? "bg-[var(--accent)]/20" : ""
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{lang.flag}</span>
                              <span className="text-[var(--text-white)] font-medium">
                                {lang.name}
                              </span>
                            </div>
                            {language === lang.code && (
                              <span className="text-[var(--accent)]">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Privacy menu dropdown */}
                  {isPrivacyItem && (
                    <div
                      className={`overflow-hidden bg-[var(--bg-secondary)] border-t transition-all duration-300 ease-out ${isPrivacyMenuOpen
                        ? "max-h-[500px] opacity-100 translate-y-0 border-[var(--border-color)]"
                        : "max-h-0 opacity-0 -translate-y-2 border-transparent pointer-events-none"
                        }`}
                      style={{
                        transitionProperty: "max-height, opacity, transform, border-color",
                      }}
                    >
                      <div className="divide-y divide-[var(--border-color)]">
                        {/* Update Username */}
                        <div className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <FiUser className="w-5 h-5 text-[var(--text-dim)]" />
                            <span className="text-[var(--text-white)] font-medium">
                              {t("profile.privacy.updateUsername")}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                              placeholder={t("profile.privacy.usernamePlaceholder")}
                              className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-white)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateUsername();
                              }}
                              disabled={isLoading || !newUsername.trim()}
                              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isLoading ? t("profile.privacy.saving") : t("profile.privacy.save")}
                            </button>
                          </div>
                        </div>

                        {/* Linked accounts или приглашение привязать Telegram */}
                        {(user?.google_id || user?.telegram_id || (!user?.telegram_id && !isTelegram)) && (
                          <div className="p-4 border-t border-[var(--border-color)] space-y-3">
                            <span className="text-sm font-medium text-[var(--text-dim)] block">
                              {language === "ru" ? "Привязанные аккаунты" : "Linked accounts"}
                            </span>
                        {user?.google_id && (
                          <div className="p-4 border-t border-[var(--border-color)]">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <svg className="w-5 h-5 text-[var(--text-dim)] flex-shrink-0" viewBox="0 0 24 24">
                                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                <div className="min-w-0">
                                  <span className="text-[var(--text-white)] font-medium block">
                                    {language === "ru" ? "Google привязан" : "Google linked"}
                                  </span>
                                  <span className="text-sm text-[var(--text-dim)] truncate block">{user?.email}</span>
                                </div>
                              </div>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    setIsLoading(true);
                                    await unlinkGoogle();
                                    showSuccess(language === "ru" ? "Google отвязан" : "Google unlinked");
                                  } catch (err) {
                                    showError(err?.message || (language === "ru" ? "Не удалось отвязать" : "Failed to unlink"));
                                  } finally {
                                    setIsLoading(false);
                                  }
                                }}
                                disabled={isLoading}
                                className="px-3 py-1.5 text-sm text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {language === "ru" ? "Отвязать" : "Unlink"}
                              </button>
                            </div>
                          </div>
                        )}
                        {user?.telegram_id && (
                          <div className="p-4 border-t border-[var(--border-color)]">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <svg className="w-5 h-5 text-[#0088cc] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                </svg>
                                <div className="min-w-0">
                                  <span className="text-[var(--text-white)] font-medium block">
                                    {language === "ru" ? "Telegram привязан" : "Telegram linked"}
                                  </span>
                                  <span className="text-sm text-[var(--text-dim)] truncate block">
                                    {user?.telegram_username ? `@${user.telegram_username}` : (language === "ru" ? "ID привязан" : "ID linked")}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    setIsLoading(true);
                                    await unlinkTelegram();
                                    showSuccess(language === "ru" ? "Telegram отвязан" : "Telegram unlinked");
                                  } catch (err) {
                                    showError(err?.message || (language === "ru" ? "Не удалось отвязать" : "Failed to unlink"));
                                  } finally {
                                    setIsLoading(false);
                                  }
                                }}
                                disabled={isLoading}
                                className="px-3 py-1.5 text-sm text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {language === "ru" ? "Отвязать" : "Unlink"}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Приглашение привязать Telegram (только на вебе, если ещё не привязан) */}
                        {!user?.telegram_id && !isTelegram && (
                          <div className="p-4 border-t border-[var(--border-color)] rounded-lg bg-[#0088cc]/10 border-[#0088cc]/20">
                            <div className="flex items-start gap-3">
                              <svg className="w-5 h-5 text-[#0088cc] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                              </svg>
                              <div className="min-w-0 flex-1">
                                <span className="text-[var(--text-white)] font-medium block mb-1">
                                  {t("profile.privacy.linkTelegram.title")}
                                </span>
                                <p className="text-sm text-[var(--text-dim)] mb-3">
                                  {t("profile.privacy.linkTelegram.description")}
                                </p>
                                {(() => {
                                  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
                                  return botUsername ? (
                                    <a
                                      href={`https://t.me/${botUsername.replace(/^@/, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#0088cc] hover:text-[#54a9eb] rounded-lg bg-[#0088cc]/20 hover:bg-[#0088cc]/30 transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {t("profile.privacy.linkTelegram.cta")}
                                    </a>
                                  ) : (
                                    <span className="text-sm text-[var(--text-dim)]">
                                      {t("profile.privacy.linkTelegram.cta")}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                          </div>
                        )}

                        {/* Reset Password */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetPassword();
                          }}
                          className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FiLock className="w-5 h-5 text-[var(--text-dim)]" />
                            <span className="text-[var(--text-white)] font-medium">
                              {t("profile.privacy.resetPassword")}
                            </span>
                          </div>
                          <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
                        </button>

                        {/* Delete Data */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteDataModal(true);
                          }}
                          className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FiTrash2 className="w-5 h-5 text-orange-500" />
                            <span className="text-[var(--text-white)] font-medium block">
                              {t("profile.privacy.deleteData")}
                            </span>
                          </div>
                          <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
                        </button>

                        {/* Delete Account */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteAccountModal(true);
                          }}
                          className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FiAlertTriangle className="w-5 h-5 text-red-500" />
                            <span className="text-red-500 font-medium block">
                              {t("profile.privacy.deleteAccount")}
                            </span>
                          </div>
                          <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
                        </button>

                        {/* Logout All Devices */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogoutAllDevices();
                          }}
                          disabled={isLoading}
                          className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <FiLogOut className="w-5 h-5 text-[var(--text-dim)]" />
                            <span className="text-[var(--text-white)] font-medium">
                              {t("profile.privacy.logoutAllDevices")}
                            </span>
                          </div>
                          <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-primary)] rounded-lg p-6 w-96 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-white)]">
                Обновление до API
              </h3>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text-white)]"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-[var(--text-dim)]">
                Обновитесь до API доступа за $5 в месяц и получите:
              </p>
              <ul className="text-sm text-[var(--text-white)] space-y-1">
                <li>• До 10,000 сообщений в месяц</li>
                <li>• API доступ для интеграций</li>
                <li>• Приоритетная поддержка</li>
              </ul>

              <div>
                <label className="block text-sm text-[var(--text-dim)] mb-1">
                  Ваш API ключ
                </label>
                <input
                  type="text"
                  placeholder="sk-..."
                  className="w-full p-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-white)] rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => handleUpgradeToAPI("demo-api-key")}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Обновить ($5/мес)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Data Confirmation Modal */}
      {showDeleteDataModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-primary)] rounded-lg p-6 w-96 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-white)]">
                {t("profile.privacy.deleteData")}
              </h3>
              <button
                onClick={() => setShowDeleteDataModal(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text-white)]"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-orange-500">
                <FiAlertTriangle className="w-6 h-6" />
                <p className="text-sm text-[var(--text-white)]">
                  {t("profile.privacy.confirmDeleteData")}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteDataModal(false)}
                  className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-white)] rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleDeleteData}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? t("common.loading") : t("profile.privacy.deleteData")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-primary)] rounded-lg p-6 w-96 max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-500">
                {t("profile.privacy.deleteAccount")}
              </h3>
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text-white)]"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-red-500">
                <FiAlertTriangle className="w-6 h-6" />
                <p className="text-sm text-[var(--text-white)]">
                  {t("profile.privacy.confirmDeleteAccount")}
                </p>
              </div>

              {user?.auth_provider !== "google" && (
                <div>
                  <label className="block text-sm text-[var(--text-dim)] mb-1">
                    {t("profile.privacy.enterPassword")}
                  </label>
                  <input
                    type="password"
                    value={deleteAccountPassword}
                    onChange={(e) => setDeleteAccountPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full p-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}



              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteAccountModal(false)}
                  className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-white)] rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isLoading || (user?.auth_provider !== "google" && !deleteAccountPassword.trim())}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? t("common.loading") : t("profile.privacy.deleteAccount")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileScreen;

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
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useChats } from "../../contexts/ChatsContext";
import { useNotification } from "../../contexts/NotificationContext";
import apiClient from "../../services/api";
import SubscriptionStatus from "./SubscriptionStatus";
import UsageStatistics from "./UsageStatistics";
import { useMaxWidth } from "../../hooks/common/use-mobile";

// i18n function stub for localization - теперь используем LanguageContext

const ProfileScreen = ({ isOpen = false, onClose, onOpenPricing, onChatSelect }) => {
  const { user, logout, usageStats, upgradeToAPI, fetchUsageStats, updateUser, refreshUserData } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { systemChat, selectConversation } = useChats();
  const { showSuccess, showError } = useNotification();
  const [notifications, setNotifications] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isShown, setIsShown] = useState(false);
  const [hasFetchedStats, setHasFetchedStats] = useState(false);
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
      if (window.confirm(t("profile.confirm.logout"))) {
        await logout();
      }
    } catch (error) {
      console.error("Logout error:", error);
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

  const handleSavedMessagesClick = async () => {
    if (systemChat && onChatSelect) {
      console.log("Opening Saved Messages chat:", systemChat);
      await selectConversation(systemChat.id);
      onChatSelect(systemChat.id);
      onClose(); // Закрываем профиль после выбора чата
    } else {
      console.log("System chat not available or onChatSelect not provided");
    }
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
          id: "saved-messages",
          label: t("profile.menu.saved_messages"),
          icon: FiBookmark,
          onPress: handleSavedMessagesClick,
        },
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
            // TODO: Navigate to PrivacySettingsScreen
            console.log("Navigate to Privacy Settings");
          },
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
        {
          id: "api-settings",
          label: t("profile.menu.api_settings"),
          icon: FiSettings,
          onPress: handleUpgradeClick,
        },
      ],
    },
    {
      title: t("profile.sections.support"),
      data: [
        {
          id: "tell-friend",
          label: t("profile.menu.tell_friend"),
          icon: FiShare2,
          onPress: () => {
            // TODO: Implement share functionality
            console.log("Share app");
          },
        },
        {
          id: "rate-app",
          label: t("profile.menu.rate_app"),
          icon: FiStar,
          onPress: () => {
            // TODO: Navigate to app store rating
            console.log("Rate app");
          },
        },
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
      className={`absolute inset-0 z-20 flex flex-col h-full profile-screen transform transition-transform duration-300 ease-in-out ${
        isShown ? "translate-x-0" : "-translate-x-full"
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
            {user?.email || "user@example.com"}
          </p>

          {/* Subscription Status */}
          <div className="mb-4">
            <SubscriptionStatus
              key={`${user?.subscription_tier}-${user?.expires_at ?? ""}-${
                user?.messages_used ?? 0
              }`}
              user={user}
              onUpgrade={handleUpgradeClick}
            />
          </div>

          {/* Usage Statistics */}
          <div className="mb-4">
            <UsageStatistics
              key={`${user?.subscription_tier}-${user?.messages_limit}-${
                user?.messages_used ?? 0
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
              return (
                <div key={item.id}>
                  <button
                    onClick={item.onPress}
                    className="w-full flex items-center justify-between p-4 profile-menu-item group"
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent
                        className={`w-5 h-5 transition-colors ${
                          item.isDanger
                            ? "text-red-500 group-hover:text-red-400"
                            : "text-[var(--text-dim)] group-hover:text-[var(--text-white)]"
                        }`}
                      />
                      <span
                        className={`font-medium transition-colors ${
                          item.isDanger
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
                      className={`overflow-hidden bg-[var(--bg-secondary)] border-t transition-all duration-300 ease-out ${
                        isLanguageMenuOpen
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
                            className={`w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors ${
                              language === lang.code ? "bg-[var(--accent)]/20" : ""
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
    </div>
  );
};

export default ProfileScreen;

import React, { useCallback, useState } from "react";
import {
  FiUser,
  FiSettings,
  FiMoon,
  FiSun,
  FiAlertTriangle,
  FiMenu,
  FiX,
  FiInfo,
  FiCpu,
  FiLogOut,
  FiDroplet,
  FiLayers,
  FiGlobe,
  FiChevronDown,
  FiChevronUp,
  FiCheck,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useModal } from "../../contexts/ModalContext.jsx";
import apiClient from "../../services/api";
import logo from "../../assets/images/logo.png";

// Утилитарная функция для объединения классов (аналог cn)
const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};



// Overlay компонент
const Overlay = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black bg-opacity-50 transition-opacity"
      onClick={onClose}
    />
  );
};

// Sheet Content компонент
const SheetContent = ({ isOpen, onClose, children }) => {
  return (
    <>
      <Overlay isOpen={isOpen} onClose={onClose} />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-[110] h-full w-full max-w-[340px] transform bg-[var(--bg-secondary)] shadow-xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ width: "min(340px, 90vw)" }}
      >
        {children}
        <button
          className="absolute right-4 top-4 rounded-sm opacity-90"
          onClick={onClose}
        >
          <FiX className="h-4 w-4 text-gray-400" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </>
  );
};

export function DrawerMenu({
  isOpen = false,
  onClose = () => { },
  onProfileClick = () => { },
  logoScale = 2,
}) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { openSupportModal, openReportModal } = useModal(); // Добавлено
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);



  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Функция для создания ripple эффекта
  const handleRipple = useCallback((event) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = `${size * 2}px`;
    ripple.style.height = `${size * 2}px`;
    const x = event.clientX - rect.left - size;
    const y = event.clientY - rect.top - size;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    element.appendChild(ripple);

    const remove = () => {
      ripple.removeEventListener("animationend", remove);
      if (ripple.parentNode === element) {
        element.removeChild(ripple);
      }
    };
    ripple.addEventListener("animationend", remove);
  }, []);

  const menuItems = [
    { id: "profile", label: t("profile.title"), icon: FiUser },
  ];



  const bottomItems = [
    { id: "support", label: t("profile.menu.help"), icon: FiAlertTriangle, onClick: openSupportModal }, // Изменено
    { id: "logout", label: t("profile.menu.logout"), icon: FiLogOut, onClick: handleLogout },
  ];

  const handleMenuItemClick = useCallback(
    (item, event) => {
      handleRipple(event);
      console.log(`Clicked: ${item.label}`);

      // Специальная обработка для профиля
      if (item.id === "profile") {
        onProfileClick();
        onClose();
        return;
      }

      // Если у элемента есть onClick функция, вызываем её
      if (item.onClick) {
        item.onClick();
        onClose(); // Закрываем меню после действия
      }
      // Здесь можно добавить логику навигации или другие действия
    },
    [
      handleRipple,
      onProfileClick,
      onClose,
    ]
  );

  return (
    <>
      {/* Sheet Content */}
      <SheetContent isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-4 bg-[var(--header-bg)] border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url.startsWith("http") ? user.avatar_url : `${apiClient.baseURL}${user.avatar_url}`}
                  alt={user?.full_name || user?.username || "User"}
                  className="w-12 h-12 rounded-full object-cover shadow-lg select-none"
                  referrerPolicy={user.avatar_url.startsWith("http") ? "no-referrer" : undefined}
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg shadow-lg select-none ${user?.avatar_url ? "hidden" : ""}`}>
                {user?.username?.charAt(0)?.toUpperCase() || user?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="flex flex-col">
                <span className="text-[var(--text-white)] font-semibold text-[17px]">
                  {user?.full_name || user?.username || "User"}
                </span>
                <span className="text-[var(--text-gray)] text-[14px] font-normal">
                  {user?.email || "user@example.com"}
                </span>
              </div>
            </div>
          </div>

          {/* Main Menu */}
          <div className="flex-1 overflow-y-auto">
            <nav className="py-1">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    role="menuitem"
                    tabIndex={0}
                    className={cn(
                      "has-ripple relative w-full flex items-center gap-3 px-5 h-[48px]",
                      "text-[var(--text-white)] text-[15px] font-normal select-none",
                      "transition-colors hover:bg-[var(--hover-bg)] active:bg-[var(--active-bg)]"
                    )}
                    onClick={(event) => handleMenuItemClick(item, event)}
                  >
                    <IconComponent className="w-5 h-5 flex-shrink-0 text-[var(--text-gray)]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Theme Selection */}
              <div className="mt-0">
                <div
                  role="menuitem"
                  className={cn(
                    "w-full flex flex-col justify-center px-0 min-h-[48px]",
                    "text-[var(--text-white)] text-[15px] font-normal select-none",
                    "transition-colors"
                  )}
                >
                  <button
                    onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-5 h-[48px]",
                      "text-[var(--text-white)] text-[15px] font-normal select-none",
                      "transition-colors hover:bg-[var(--hover-bg)] cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'light' ? <FiSun className="w-5 h-5 flex-shrink-0 text-[var(--text-gray)]" /> :
                        theme === 'dark' ? <FiMoon className="w-5 h-5 flex-shrink-0 text-[var(--text-gray)]" /> :
                          theme === 'blue' ? <FiDroplet className="w-5 h-5 flex-shrink-0 text-[var(--text-gray)]" /> :
                            <FiLayers className="w-5 h-5 flex-shrink-0 text-[var(--text-gray)]" />
                      }
                      <span>{t("settings.theme")}</span>
                    </div>
                    {isThemeExpanded ? (
                      <FiChevronUp className="w-4 h-4 text-[var(--text-gray)]" />
                    ) : (
                      <FiChevronDown className="w-4 h-4 text-[var(--text-gray)]" />
                    )}
                  </button>
              
                  <div className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out flex flex-col",
                    isThemeExpanded ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0 bg-transparent"
                  )}>
                    {[{
                      id: 'dark', label: t('settings.themes.dark'), icon: FiMoon },
                      { id: 'light', label: t('settings.themes.light'), icon: FiSun },
                      { id: 'blue', label: t('settings.themes.blue'), icon: FiDroplet },
                      { id: 'pastel', label: t('settings.themes.pastel'), icon: FiLayers }
                    ].map((item) => (
                      <button
                        key={item.id}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-5 pl-12 h-[40px]",
                          "text-[var(--text-white)] text-[14px] font-normal select-none",
                          "transition-colors hover:bg-[var(--hover-bg)] cursor-pointer",
                          theme === item.id && "bg-[var(--active-bg)] text-[var(--accent)]"
                        )}
                        onClick={(e) => {
                          const x = e.clientX;
                          const y = e.clientY;
                          setTheme(item.id, { x, y });
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className={cn("w-4 h-4", theme === item.id ? "text-[var(--accent)]" : "text-[var(--text-gray)]")} />
                          <span>{item.label}</span>
                        </div>
                        {theme === item.id && <FiCheck className="w-4 h-4 text-[var(--accent)]" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Language Selection */}
              <div className="mt-0">
                <div
                  role="menuitem"
                  className={cn(
                    "w-full flex flex-col justify-center px-0 min-h-[48px]",
                    "text-[var(--text-white)] text-[15px] font-normal select-none",
                    "transition-colors"
                  )}
                >
                  <button
                    onClick={() => setIsLanguageExpanded(!isLanguageExpanded)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-5 h-[48px]",
                      "text-[var(--text-white)] text-[15px] font-normal select-none",
                      "transition-colors hover:bg-[var(--hover-bg)] cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <FiGlobe className="w-5 h-5 flex-shrink-0 text-[var(--text-gray)]" />
                      <span>{t("settings.language")}</span>
                    </div>
                    {isLanguageExpanded ? (
                      <FiChevronUp className="w-4 h-4 text-[var(--text-gray)]" />
                    ) : (
                      <FiChevronDown className="w-4 h-4 text-[var(--text-gray)]" />
                    )}
                  </button>
              
                  <div className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out flex flex-col",
                    isLanguageExpanded ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0 bg-transparent"
                  )}>
                    {[{
                      code: 'ru', name: t("profile.language_ru"), flag: '🇷🇺' },
                      { code: 'en', name: t("profile.language_en"), flag: '🇺🇸' }
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-5 pl-12 h-[40px]",
                          "text-[var(--text-white)] text-[14px] font-normal select-none",
                          "transition-colors hover:bg-[var(--hover-bg)] cursor-pointer",
                          language === lang.code && "bg-[var(--accent)]/20 text-[var(--accent)]"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLanguage(lang.code);
                          setIsLanguageExpanded(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{lang.flag}</span>
                          <span className="text-[var(--text-white)] font-medium">
                            {lang.name}
                          </span>
                        </div>
                        {language === lang.code && (
                          <FiCheck className="w-4 h-4 text-[var(--accent)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Items */}
              <div className="mt-0">
                {bottomItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <button
                      key={item.id}
                      role="menuitem"
                      tabIndex={0}
                      className={cn(
                        "has-ripple relative w-full flex items-center gap-3 px-5 h-[48px]",
                        "text-[var(--text-white)] text-[15px] font-normal select-none",
                        "transition-colors hover:bg-[var(--hover-bg)] active:bg-[var(--active-bg)]"
                      )}
                      onClick={(event) => handleMenuItemClick(item, event)}
                    >
                      <IconComponent className="w-5 h-5 flex-shrink-0 text-[var(--text-gray)]" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[var(--border-color)] select-none">
            <p className="text-[var(--text-gray)] text-[13px] text-center font-normal flex items-center justify-center gap-2">
              <img
                src={logo}
                alt="Epochal Dialoge"
                className="h-[1em] w-auto object-contain origin-center"
                style={{ transform: `scale(${logoScale})` }}
              />
              <span>Epochal Dialoge 1.0.0</span>
            </p>
          </div>
        </div>
      </SheetContent>
    </>
  );
}

export default DrawerMenu;

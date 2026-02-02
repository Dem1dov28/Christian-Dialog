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

// Улучшенная реализация Switch компонента с эластичным баунсом
const Switch = ({ checked, onChange, className, ...props }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = (e) => {
    // Останавливаем всплытие события, чтобы не вызвать onClick на родителе
    e.stopPropagation();
    
    // Передаем координаты клика для circular reveal
    const x = e.clientX;
    const y = e.clientY;
    
    onChange(!checked, { x, y });
  };

  return (
    <button
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent transition-all duration-300 ease-out",
        "focus:outline-none",
        "hover:scale-105 active:scale-95",
        checked 
          ? "bg-[var(--accent)] shadow-lg" 
          : "bg-gray-600 shadow-md shadow-gray-900/20",
        isPressed && "scale-95",
        className
      )}
      onClick={handleClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      {...props}
    >
      {/* Основной переключатель с эластичным баунсом */}
      <span
        className={cn(
          "pointer-events-none relative z-10 block h-5 w-5 rounded-full bg-white",
          "shadow-xl ring-0 transition-all duration-500",
          checked 
            ? "translate-x-[20px] scale-100" 
            : "translate-x-[2px] scale-100",
          isPressed && "scale-90"
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.68, -0.55, 0.265, 1.55)"
        }}
      />
      
      {/* Градиентный эффект на фоне */}
      <span
        className={cn(
          "absolute inset-0 rounded-full opacity-0 transition-opacity duration-300",
          checked && "opacity-100"
        )}
        style={{
          background: 'linear-gradient(135deg, rgba(64, 224, 208, 0.2) 0%, rgba(0, 206, 209, 0.1) 100%)',
        }}
      />
      
      {/* Градиентный эффект на фоне */}
      <span
        className={cn(
          "absolute inset-0 rounded-full opacity-0 transition-opacity duration-300",
          checked && "opacity-100"
        )}
        style={{
          background: 'linear-gradient(135deg, rgba(64, 224, 208, 0.2) 0%, rgba(0, 206, 209, 0.1) 100%)',
        }}
      />
    </button>
  );
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
  onClose = () => {},
  onProfileClick = () => {},
  logoScale = 2,
}) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, language } = useLanguage();
  const { openSupportModal, openReportModal } = useModal(); // Добавлено

  const getThemeDisplayName = () => {
    if (language === "ru") {
      if (theme === "light") return "Светлая";
      if (theme === "dark") return "Тёмная";
      if (theme === "blue") return "Синяя";
      if (theme === "pastel") return "Пастельная";
      return theme;
    }
    // en / default
    if (theme === "light") return "Light";
    if (theme === "dark") return "Dark";
    if (theme === "blue") return "Blue";
    if (theme === "pastel") return "Pastel";
    return theme;
  };

  const getNextTheme = () => {
    if (theme === "light") return "dark";
    if (theme === "dark") return "blue";
    if (theme === "blue") return "pastel";
    return "light";
  };

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

  const toggleItems = [
    {
      id: "theme",
      label: `${t("settings.theme")} · ${getThemeDisplayName()}`,
      icon:
        theme === "light"
          ? FiSun
          : theme === "dark"
          ? FiMoon
          : theme === "blue"
          ? FiDroplet
          : FiSun,
      // Визуально считаем "включён" любую не-светлую тему
      checked: theme !== "light",
      onChange: (newValue, coords) => {
        const next = getNextTheme();
        if (coords) {
          setTheme(next, coords);
        } else {
          setTheme(next);
        }
      },
    },
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

              {/* Toggles */}
              <div className="mt-0">
                {toggleItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <div
                      key={item.id}
                      role="menuitem"
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-5 h-[48px]",
                        "text-[var(--text-white)] text-[15px] font-normal select-none",
                        "transition-colors hover:bg-[var(--hover-bg)] cursor-pointer"
                      )}
                      onClick={(e) => {
                        // Получаем координаты клика для circular reveal
                        const x = e.clientX;
                        const y = e.clientY;
                        item.onChange(!item.checked, { x, y });
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent className="w-5 h-5 flex-shrink-0 text-[var(--text-gray)]" />
                        <span>{item.label}</span>
                      </div>
                      <Switch
                        checked={item.checked}
                        onChange={item.onChange}
                        aria-label={item.label}
                      />
                    </div>
                  );
                })}
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
                alt="AIgram"
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

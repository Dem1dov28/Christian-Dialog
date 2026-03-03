import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTelegramWebApp } from "@/hooks/useTelegramWebApp";
import { GoogleLogin } from "@react-oauth/google";
import { SEO } from "@/components/common/SEO";
import apiClient from "@/services/api";
import { buildTelegramAuthUrl } from "@/utils/telegramOIDC";

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle, loginWithTelegram, loginWithTelegramWidget, sendTelegramLinkCode, verifyAndLinkTelegram, refreshUserData, isLoading } = useAuth();
  const { isTelegram, initData } = useTelegramWebApp();
  const { t, language } = useLanguage();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showTelegramLinkForm, setShowTelegramLinkForm] = useState(false);
  const [linkStep, setLinkStep] = useState("email"); // "email" | "code"
  const [linkEmail, setLinkEmail] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [telegramOIDCConfig, setTelegramOIDCConfig] = useState(null);
  const [telegramWidgetConfig, setTelegramWidgetConfig] = useState(null);
  const telegramLoginTried = useRef(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleLocale = language === "ru" ? "ru" : "en";

  useEffect(() => {
    if (!isTelegram) {
      apiClient.getTelegramWidgetConfig().then(setTelegramWidgetConfig).catch(() => setTelegramWidgetConfig({ enabled: false }));
      apiClient.getTelegramOIDCConfig().then(setTelegramOIDCConfig).catch(() => setTelegramOIDCConfig({ enabled: false }));
    }
  }, [isTelegram]);

  // Callback для Telegram Login Widget — вызывается скриптом виджета
  const widgetCallbackRef = useRef(null);
  widgetCallbackRef.current = async (user) => {
    try {
      setError("");
      await loginWithTelegramWidget(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || (language === "ru" ? "Ошибка входа через Telegram" : "Telegram login error"));
    }
  };

  useEffect(() => {
    if (!telegramWidgetConfig?.enabled || !telegramWidgetConfig?.bot_username) return;
    window.onTelegramAuth = (user) => {
      if (widgetCallbackRef.current) widgetCallbackRef.current(user);
    };
    const container = document.getElementById("telegram-login-widget-container");
    if (!container) return;
    // Удаляем старый скрипт, если есть
    const existing = container.querySelector('script[data-telegram-login]');
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?23";
    script.setAttribute("data-telegram-login", telegramWidgetConfig.bot_username);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);
    return () => {
      delete window.onTelegramAuth;
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [telegramWidgetConfig?.enabled, telegramWidgetConfig?.bot_username]);

  const handleTelegramOIDCLogin = async () => {
    if (!telegramOIDCConfig?.enabled) return;
    try {
      const url = await buildTelegramAuthUrl(telegramOIDCConfig.client_id, telegramOIDCConfig.redirect_uri);
      window.location.href = url;
    } catch (err) {
      setError(err?.message || "Ошибка входа через Telegram");
    }
  };

  // В Telegram: при монтировании пробуем войти; если needs_link — показываем форму привязки
  // Не вызывать автоматически после явного выхода (telegram_skip_auto_login)
  const [skipAutoTelegram, setSkipAutoTelegram] = useState(() => !!localStorage.getItem('telegram_skip_auto_login'));
  useEffect(() => {
    if (!isTelegram || !initData || telegramLoginTried.current) return;
    if (localStorage.getItem('telegram_skip_auto_login')) {
      setSkipAutoTelegram(true);
      return;
    }
    telegramLoginTried.current = true;
    let cancelled = false;
    const tryTg = async () => {
      try {
        const res = await loginWithTelegram(initData);
        if (!cancelled && res?.needs_link) setShowTelegramLinkForm(true);
      } catch {
        if (!cancelled) setShowTelegramLinkForm(true);
      }
    };
    tryTg();
    return () => { cancelled = true; };
  }, [isTelegram, initData, loginWithTelegram]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(""); // Очищаем ошибку при изменении полей
    setEmailError("");
    setPasswordError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Предотвращаем стандартное поведение формы
    e.stopPropagation();

    // Очищаем предыдущие ошибки
    setError("");
    setEmailError("");
    setPasswordError("");

    // Локальная валидация перед попыткой входа
    if (!formData.email || !formData.email.trim()) {
      if (language === "ru") {
        setEmailError("Пожалуйста, введите email");
      } else {
        setEmailError("Please enter your email");
      }
      return; // Останавливаем выполнение, не пытаемся войти
    }

    if (!formData.password || !formData.password.trim()) {
      if (language === "ru") {
        setPasswordError("Пожалуйста, введите пароль");
      } else {
        setPasswordError("Please enter your password");
      }
      return; // Останавливаем выполнение, не пытаемся войти
    }

    try {
      // Попытка входа - если успешна, AuthContext изменит isAuthenticated и произойдет редирект
      await login(formData);
      // После успешного логина пользователь автоматически перенаправится через PublicRoute
    } catch (error) {
      // При ошибке НЕ меняется isAuthenticated, поэтому компонент остается на месте
      // Извлекаем понятное сообщение об ошибке
      let errorMessage = error.message || t("auth.login.error");

      // Для ошибок лимита запросов показываем пользователю понятное сообщение
      if (error.status === 429 || errorMessage.includes("лимит") || errorMessage.includes("429")) {
        const retryAfter = error.retryAfter || 60;
        errorMessage = errorMessage || `Превышен лимит запросов. Пожалуйста, подождите ${retryAfter} секунд перед повторной попыткой.`;
        setError(errorMessage);
      } else if (error.status === 401 || errorMessage.includes("Неверный") || errorMessage.includes("пароль")) {
        // Для 401 или ошибок "Неверный email или пароль"
        // Показываем ошибки для каждого поля
        if (language === "ru") {
          setEmailError("Email не зарегистрирован");
          setPasswordError("Пароль неверный");
        } else {
          setEmailError("Email is not registered");
          setPasswordError("Incorrect password");
        }
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleSendLinkCode = async (e) => {
    e?.preventDefault();
    setError("");
    setEmailError("");
    if (!linkEmail?.trim()) {
      setEmailError(language === "ru" ? "Введите email" : "Enter email");
      return;
    }
    try {
      await sendTelegramLinkCode(linkEmail.trim());
      setLinkStep("code");
    } catch (err) {
      setError(err.message || (language === "ru" ? "Не удалось отправить код" : "Failed to send code"));
    }
  };

  const handleVerifyAndLink = async (e) => {
    e?.preventDefault();
    setError("");
    if (!linkCode?.trim() || linkCode.length !== 6) {
      setError(language === "ru" ? "Введите 6-значный код" : "Enter 6-digit code");
      return;
    }
    try {
      await verifyAndLinkTelegram(linkEmail.trim(), linkCode.trim(), initData);
      // Успех — AuthContext обновит isAuthenticated, произойдёт редирект
    } catch (err) {
      setError(err.message || (language === "ru" ? "Неверный код" : "Invalid code"));
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError(t("auth.login.googleError") || "Google authentication failed");
      return;
    }

    try {
      await loginWithGoogle({
        credential: credentialResponse.credential,
        clientId: credentialResponse.clientId || googleClientId,
      });
    } catch (error) {
      // Извлекаем понятное сообщение об ошибке
      let errorMessage = error.message || t("auth.login.googleError") || "Google authentication failed";

      // Специальная обработка для ошибок Google OAuth
      if (errorMessage.includes("Invalid Google token") || errorMessage.includes("origin is not allowed")) {
        errorMessage = "Ошибка конфигурации Google OAuth. Пожалуйста, обратитесь к администратору.";
      } else if (errorMessage.includes("Google authentication is not configured")) {
        errorMessage = "Google аутентификация не настроена. Используйте обычный вход.";
      }

      setError(errorMessage);
    }
  };

  return (
    <>
      <SEO
        title="Вход"
        description="Войдите в Epochal Dialog - платформу для общения с AI-агентами. Общайтесь с историческими личностями и персонажами."
        keywords="вход, авторизация, AI чат, искусственный интеллект, исторические личности"
        canonical="/login"
      />
      <div
        className="dark-theme-locked"
        style={{
          position: 'fixed',
          inset: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
      <AuthBackground />

      {/* Glass Panel */}
      <div className="relative z-10 w-full max-w-[480px] flex items-center justify-center perspective-1000">
        <div className="relative backdrop-blur-2xl bg-card/30 border border-white/10 rounded-[2rem] p-6 sm:p-8 [@media(max-height:629px)]:p-3 [@media(max-height:629px)]:sm:p-4 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_-4px_24px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] w-full animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 ease-out ring-1 ring-white/5 before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-transparent before:pointer-events-none">
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8 [@media(max-height:629px)]:mb-3 [@media(max-height:629px)]:sm:mb-4">
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 backdrop-blur-xl border border-primary/30 mb-4 [@media(max-height:629px)]:mb-2 [@media(max-height:629px)]:hidden shadow-[0_8px_24px_-4px_rgba(var(--primary),0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-500 hover:scale-110 hover:rotate-3 hover:shadow-[0_12px_32px_-6px_rgba(var(--primary),0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset] group before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
              <img
                src="/logo.webp"
                alt="Epochal Dialog"
                className="w-20 h-20 object-contain transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground bg-gradient-to-b from-foreground via-foreground to-foreground/80 bg-clip-text tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              {t("auth.login.title")}
            </h1>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 [@media(max-height:629px)]:mb-2 p-4 [@media(max-height:629px)]:p-2 bg-destructive/10 backdrop-blur-sm border border-destructive/30 rounded-xl shadow-[0_4px_12px_-2px_rgba(239,68,68,0.2)] animate-in slide-in-from-top-2 duration-300 ring-1 ring-destructive/20">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                <p className="text-sm font-medium text-destructive flex-1">{error}</p>
              </div>
            </div>
          )}

          {/* Telegram: форма привязки аккаунта */}
          {showTelegramLinkForm && isTelegram && initData && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground text-center">
                {language === "ru"
                  ? "У вас уже есть аккаунт? Введите email, чтобы привязать Telegram."
                  : "Already have an account? Enter your email to link Telegram."}
              </p>
              {linkStep === "email" ? (
                <form onSubmit={handleSendLinkCode} className="space-y-4">
                  <Input
                    type="email"
                    placeholder={language === "ru" ? "Email аккаунта" : "Account email"}
                    value={linkEmail}
                    onChange={(e) => { setLinkEmail(e.target.value); setError(""); }}
                    disabled={isLoading}
                    className="w-full"
                    autoComplete="email"
                    style={{ WebkitUserSelect: "text", userSelect: "text" }}
                  />
                  <Button type="submit" variant="neomorphic" size="lg" className="w-full" disabled={isLoading}>
                    {isLoading ? "..." : (language === "ru" ? "Отправить код" : "Send code")}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyAndLink} className="space-y-4">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={language === "ru" ? "Код из письма" : "Code from email"}
                    value={linkCode}
                    onChange={(e) => { setLinkCode(e.target.value.replace(/\D/g, "")); setError(""); }}
                    disabled={isLoading}
                    className="w-full"
                    autoComplete="one-time-code"
                    style={{ WebkitUserSelect: "text", userSelect: "text" }}
                  />
                  <Button type="submit" variant="neomorphic" size="lg" className="w-full" disabled={isLoading}>
                    {isLoading ? "..." : (language === "ru" ? "Привязать аккаунт" : "Link account")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => { setLinkStep("email"); setLinkCode(""); setError(""); }}
                  >
                    {language === "ru" ? "← Другой email" : "← Different email"}
                  </Button>
                </form>
              )}
              <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  {language === "ru"
                    ? "Аккаунт с таким email должен существовать на сайте."
                    : "Account with this email must exist on the website."}
                </p>
                {googleClientId && (
                  <div className="w-full flex justify-center">
                    <div className="google-login-override w-full max-w-[320px] rounded-full">
                      <GoogleLogin
                        onSuccess={async (credentialResponse) => {
                          try {
                            setError("");
                            await loginWithGoogle({
                              credential: credentialResponse.credential,
                              clientId: credentialResponse.clientId || googleClientId,
                            });
                            if (initData) {
                              await apiClient.linkTelegram(initData);
                              await refreshUserData();
                            }
                          } catch (err) {
                            setError(err?.message || (language === "ru" ? "Ошибка привязки" : "Link failed"));
                          }
                        }}
                        onError={() => setError(language === "ru" ? "Ошибка входа через Google" : "Google sign-in failed")}
                        useOneTap={false}
                        size="medium"
                        text="signin_with"
                        shape="pill"
                        theme="outline"
                        locale={googleLocale}
                        width="280"
                      />
                    </div>
                  </div>
                )}
                <p className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    {language === "ru" ? "Нет аккаунта? Зарегистрироваться" : "No account? Register"}
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* После выхода в Mini App: кнопка "Войти через Telegram" */}
          {!showTelegramLinkForm && isTelegram && skipAutoTelegram && initData && (
            <div className="mb-5 space-y-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full rounded-full border-[#0088cc]/40 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc]"
                onClick={async () => {
                  setSkipAutoTelegram(false);
                  try {
                    const res = await loginWithTelegram(initData);
                    if (res?.needs_link) setShowTelegramLinkForm(true);
                    else { try { localStorage.removeItem('telegram_skip_auto_login'); } catch (_) {} }
                  } catch {
                    setShowTelegramLinkForm(true);
                  }
                }}
                disabled={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                {language === "ru" ? "Войти через Telegram" : "Log in with Telegram"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {language === "ru" ? "или войдите по email и паролю ниже" : "or log in with email below"}
              </p>
            </div>
          )}

          {/* Form (скрыт при привязке Telegram) */}
          {!showTelegramLinkForm && (
          <form onSubmit={handleSubmit} className="space-y-5 [@media(max-height:629px)]:space-y-2.5">
            <div className="space-y-4 [@media(max-height:629px)]:space-y-2">
              <div className="group relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t("auth.login.emailPlaceholder") || "Введите почту/логин"}
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className="transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                />
                {emailError && (
                  <p className="text-red-500 text-sm mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    {emailError}
                  </p>
                )}
              </div>

              <div className="group relative">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t("auth.login.passwordPlaceholder") || "••••••••"}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                />
                {passwordError && (
                  <p className="text-red-500 text-sm mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    {passwordError}
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground/80 leading-relaxed text-balance tracking-wide">
              {t("auth.login.legalDisclaimerPrefix")}{" "}
              <a
                href="https://sentiensapps.online/legal#terms"
                className="text-primary hover:text-primary/90 underline-offset-4 hover:underline decoration-primary/60 transition-all duration-300 hover:drop-shadow-[0_1px_4px_rgba(var(--primary),0.3)]"
              >
                {t("auth.login.termsLink")}
              </a>{" "}
              {t("auth.login.legalDisclaimerConnector")}{" "}
              <a
                href="https://sentiensapps.online/legal#privacy"
                className="text-primary hover:text-primary/90 underline-offset-4 hover:underline decoration-primary/60 transition-all duration-300 hover:drop-shadow-[0_1px_4px_rgba(var(--primary),0.3)]"
              >
                {t("auth.login.privacyLink")}
              </a>{" "}
              {t("auth.login.legalDisclaimerSuffix")}
            </p>

            <Button
              type="submit"
              variant="neomorphic"
              size="lg"
              className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_-3px_20px_rgba(255,255,255,0.08),0_0_20px_rgba(var(--primary),0.3)] active:scale-[0.98] hover:before:opacity-100"
              disabled={isLoading}
            >
              {isLoading ? t("auth.login.signingIn") : t("auth.login.signIn")}
            </Button>

            <div className="flex items-center justify-between text-sm text-primary font-medium">
              <a
                href="/forgot-password"
                className="hover:text-primary transition-all duration-300 hover:underline decoration-primary/60 underline-offset-4 hover:-translate-y-0.5 inline-block hover:drop-shadow-[0_2px_8px_rgba(var(--primary),0.3)]"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/forgot-password");
                }}
              >
                {t("auth.login.forgotPassword")}
              </a>
              <a
                href="/register"
                className="text-primary hover:text-primary/90 transition-all duration-300 hover:underline decoration-primary/60 underline-offset-4 hover:-translate-y-0.5 inline-block hover:drop-shadow-[0_2px_8px_rgba(var(--primary),0.3)]"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/register");
                }}
              >
                {t("auth.login.registerCTA")}
              </a>
            </div>
          </form>
          )}

          {/* Divider (скрыт при привязке Telegram) */}
          {!showTelegramLinkForm && (
          <>
          <div className="relative my-6 [@media(max-height:629px)]:my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10 bg-gradient-to-r from-transparent via-white/20 to-transparent h-px"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">
              <span className="px-4 [@media(max-height:629px)]:px-2 bg-card/50 backdrop-blur-md rounded-full border border-white/5 shadow-sm">{t("auth.login.orSeparator")}</span>
            </div>
          </div>

          {/* Telegram Login — виджет (приоритет) или OIDC */}
          {telegramWidgetConfig?.enabled && telegramWidgetConfig?.bot_username && (
            <div className="w-full flex justify-center mb-3 [@media(max-height:629px)]:mb-2" id="telegram-login-widget-container" />
          )}
          {!telegramWidgetConfig?.enabled && telegramOIDCConfig?.enabled && (
            <div className="w-full flex justify-center mb-3 [@media(max-height:629px)]:mb-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full max-w-[360px] rounded-full border-white/10 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] dark:text-[#54a9eb] hover:text-[#0088cc] dark:hover:text-[#54a9eb] border hover:border-[#0088cc]/40 transition-all duration-300"
                onClick={handleTelegramOIDCLogin}
                disabled={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                {language === "ru" ? "Войти через Telegram" : "Log in with Telegram"}
              </Button>
            </div>
          )}

          {/* Google Login Button */}
          {googleClientId && (
            <div className="w-full flex justify-center mb-4 [@media(max-height:629px)]:mb-2">
              <div className="google-login-override w-full max-w-[360px] rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.25)] border border-white/10 bg-white/90 backdrop-blur-sm hover:bg-white hover:border-primary/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(0,0,0,0.35),0_0_0_1px_rgba(var(--primary),0.1)] active:scale-[0.98] px-2 py-1 before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-r before:from-white/20 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 relative">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => {
                    const errorMsg = "Ошибка входа через Google. Убедитесь, что ваш домен добавлен в Google Cloud Console.";
                    setError(errorMsg);
                  }}
                  useOneTap={false}
                  size="large"
                  text="signin_with"
                  shape="pill"
                  theme="outline"
                  locale={googleLocale}
                  logo_alignment="left"
                  width="320"
                />
              </div>
            </div>
          )}
          </>
          )}

          {/* Removed bottom register prompt */}
        </div>
      </div>
    </div>
    </>
  );
};

export default Login;

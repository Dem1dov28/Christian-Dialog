import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { GoogleLogin } from "@react-oauth/google";

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isLoading } = useAuth();
  const { t, language } = useLanguage();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleLocale = language === "ru" ? "ru" : "en";

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
    <div className="min-h-screen relative flex items-center justify-center p-4 dark-theme-locked">
      <AuthBackground />

      {/* Glass Panel */}
      <div className="relative z-10 w-full max-w-[480px] flex items-center justify-center perspective-1000">
        <div className="relative backdrop-blur-2xl bg-card/30 border border-white/10 rounded-[2rem] p-6 sm:p-8 [@media(max-height:629px)]:p-3 [@media(max-height:629px)]:sm:p-4 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_-4px_24px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] w-full animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 ease-out ring-1 ring-white/5 before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-transparent before:pointer-events-none">
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8 [@media(max-height:629px)]:mb-3 [@media(max-height:629px)]:sm:mb-4">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 backdrop-blur-xl border border-primary/30 mb-4 [@media(max-height:629px)]:mb-2 [@media(max-height:629px)]:hidden shadow-[0_8px_24px_-4px_rgba(var(--primary),0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-500 hover:scale-110 hover:rotate-3 hover:shadow-[0_12px_32px_-6px_rgba(var(--primary),0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset] group before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
              <img 
                src="/AI-gram-icon.png" 
                alt="Epochal Dialoge"
                className="w-10 h-10 object-contain transition-transform duration-500 group-hover:scale-110"
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

          {/* Form */}
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

          {/* Divider */}
          <div className="relative my-6 [@media(max-height:629px)]:my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10 bg-gradient-to-r from-transparent via-white/20 to-transparent h-px"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">
              <span className="px-4 [@media(max-height:629px)]:px-2 bg-card/50 backdrop-blur-md rounded-full border border-white/5 shadow-sm">{t("auth.login.orSeparator")}</span>
            </div>
          </div>

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

          {/* Removed bottom register prompt */}
        </div>
      </div>
    </div>
  );
};

export default Login;

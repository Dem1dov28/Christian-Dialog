import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import api from "@/services/api";
import { SEO } from "@/components/common/SEO";

const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    code: "",
  });
  const [error, setError] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(""); // Очищаем ошибку при изменении полей
  };

  const handleSendCode = async () => {
    setError("");

    // Валидация email
    if (!formData.email) {
      setError("Введите email для получения кода");
      return;
    }

    setIsSendingCode(true);

    try {
      await api.sendRegistrationCode(formData.email);
      setIsCodeSent(true);
      setError("");
    } catch (error) {
      console.error("Error sending code:", error);
      let errorMessage = error.message || "Не удалось отправить код";

      if (error.status === 400) {
        errorMessage = error.message || "Пользователь с таким email уже зарегистрирован";
      }

      setError(errorMessage);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(t("auth.register.passwordsNotMatch"));
      return;
    }

    // Проверяем, что код был введен
    if (!formData.code) {
      setError("Введите код подтверждения, отправленный на вашу почту");
      return;
    }

    try {
      await register({
        email: formData.email,
        username: formData.username || undefined,
        password: formData.password,
        code: formData.code,
      });
      // После успешной регистрации пользователь автоматически войдет в систему
    } catch (error) {
      // Извлекаем понятное сообщение об ошибке
      let errorMessage = error.message || t("auth.register.error");

      // Для ошибок лимита запросов показываем пользователю понятное сообщение
      if (error.status === 429 || errorMessage.includes("лимит") || errorMessage.includes("429")) {
        const retryAfter = error.retryAfter || 60;
        errorMessage = errorMessage || `Превышен лимит запросов. Пожалуйста, подождите ${retryAfter} секунд перед повторной попыткой.`;
      }

      setError(errorMessage);
    }
  };

  return (
    <>
      <SEO
        title="Регистрация"
        description="Зарегистрируйтесь в Epochal Dialog - платформе для общения с AI-агентами. Начните диалог с историческими личностями."
        keywords="регистрация, создать аккаунт, AI чат, искусственный интеллект"
        canonical="/register"
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
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 backdrop-blur-xl border border-primary/30 mb-4 [@media(max-height:700px)]:mb-2 [@media(max-height:700px)]:hidden shadow-[0_8px_24px_-4px_rgba(var(--primary),0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-500 hover:scale-110 hover:rotate-3 hover:shadow-[0_12px_32px_-6px_rgba(var(--primary),0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset] group before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
              <img
                src="/logo.webp"
                alt="Epochal Dialog"
                className="w-20 h-20 object-contain transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground bg-gradient-to-b from-foreground via-foreground to-foreground/80 bg-clip-text tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              {t("auth.register.title")}
            </h1>
            <p className="text-sm text-muted-foreground/90 mt-2 [@media(max-height:629px)]:mt-1 font-medium leading-relaxed">
              {t("auth.register.subtitle")}
            </p>
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
                  placeholder={t("auth.register.emailPlaceholder") || "Введите почту"}
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className="transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                />
              </div>

              <div className="group relative">
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder={t("auth.register.usernamePlaceholder") || "Введите имя пользователя"}
                  value={formData.username}
                  onChange={handleChange}
                  minLength={3}
                  maxLength={50}
                  disabled={isLoading}
                  autoComplete="username"
                  className="transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                />
              </div>

              <div className="group relative">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t("auth.register.passwordPlaceholder") || "••••••••"}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                />
              </div>

              <div className="group relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder={t("auth.register.confirmPasswordPlaceholder") || "••••••••"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                />
              </div>

              <div className="flex gap-3 [@media(max-height:629px)]:gap-1.5">
                <div className="group relative flex-1">
                  <Input
                    id="code"
                    name="code"
                    type="text"
                    placeholder={t("auth.register.codePlaceholder") || "# Код"}
                    value={formData.code}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                  />
                </div>
                <Button
                  type="button"
                  variant="glass"
                  size="default"
                  className="whitespace-nowrap border-white/10 hover:bg-card/60 h-12 px-6 transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95"
                  onClick={handleSendCode}
                  disabled={isLoading || isSendingCode || !formData.email}
                >
                  {isSendingCode ? "Отправка..." : isCodeSent ? "Отправлено ✓" : t("auth.register.sendCode")}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground/80 leading-relaxed text-balance tracking-wide">
              {t("auth.register.legalDisclaimerPrefix")}{" "}
              <a
                href="https://sentiensapps.online/legal#terms"
                className="text-primary hover:text-primary/90 underline-offset-4 hover:underline decoration-primary/60 transition-all duration-300 hover:drop-shadow-[0_1px_4px_rgba(var(--primary),0.3)]"
              >
                {t("auth.register.termsLink")}
              </a>{" "}
              {t("auth.register.legalDisclaimerConnector")}{" "}
              <a
                href="https://sentiensapps.online/legal#privacy"
                className="text-primary hover:text-primary/90 underline-offset-4 hover:underline decoration-primary/60 transition-all duration-300 hover:drop-shadow-[0_1px_4px_rgba(var(--primary),0.3)]"
              >
                {t("auth.register.privacyLink")}
              </a>{" "}
              {t("auth.register.legalDisclaimerSuffix")}
            </p>

            <Button
              type="submit"
              variant="neomorphic"
              size="lg"
              className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_-3px_20px_rgba(255,255,255,0.08),0_0_20px_rgba(var(--primary),0.3)] active:scale-[0.98] hover:before:opacity-100"
              disabled={isLoading}
            >
              {isLoading ? t("auth.register.creatingAccount") : t("auth.register.createAccount")}
            </Button>
          </form>


          {/* Login Link */}
          <p className="text-center text-sm text-muted-foreground mt-6 [@media(max-height:629px)]:mt-3">
            {t("auth.register.alreadyHaveAccount")}{" "}
            <a
              href="/login"
              className="text-primary hover:text-primary/90 font-bold transition-all duration-300 hover:underline decoration-primary/60 underline-offset-4 hover:-translate-y-0.5 inline-block hover:drop-shadow-[0_2px_8px_rgba(var(--primary),0.3)]"
              onClick={(e) => {
                e.preventDefault();
                navigate("/login");
              }}
            >
              {t("auth.register.loginCTA")}
            </a>
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default Register;

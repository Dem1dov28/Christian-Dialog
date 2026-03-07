import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { ArrowLeft, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import api from "@/services/api";
import { useNotification } from "@/contexts/NotificationContext";
import { SEO } from "@/components/common/SEO";
const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  useEffect(() => {
    const stateToken = location.state?.token;
    const stateEmail = location.state?.email;

    if (!stateToken || !stateEmail) {
      showNotification(t("errors.invalidToken") || "Неверный токен", "error");
      navigate("/forgot-password", { replace: true });
      return;
    }

    setToken(stateToken);
    setEmail(stateEmail);
  }, [location.state, navigate, showNotification, t]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(t("auth.register.passwordMismatch") || "Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      setError(t("auth.register.passwordLength") || "Пароль слишком короткий");
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.resetPassword({ email, password, token });

      if (response.success || response) {
        showNotification(t("auth.resetPassword.success") || "Пароль успешно изменен", "success");
        navigate("/login", { replace: true });
      } else {
        setError(response.message || t("errors.generic"));
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setError(err.message || t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };
  if (!token || !email) {
    return null;
  }
  return (
    <>
      <SEO
        title={t("auth.resetPassword.title") || "Сброс пароля"}
        description="Создайте новый пароль для вашей учетной записи Epochal Dialog."
        noindex={true}
      />
      <main
        className="dark-theme-locked w-full"
        style={{
          position: 'fixed',
          inset: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          paddingTop: 'max(1rem, var(--safe-area-inset-top))',
          paddingBottom: 'max(1rem, var(--safe-area-inset-bottom))',
        }}
      >
        <AuthBackground />
        {/* Glass Panel */}
        <section className="relative z-10 w-full max-w-[480px] flex items-center justify-center perspective-1000">
          <div className="relative backdrop-blur-2xl bg-card/30 border border-white/10 rounded-[2rem] p-6 sm:p-8 [@media(max-height:629px)]:p-3 [@media(max-height:629px)]:sm:p-4 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_-4px_24px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] w-full animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 ease-out ring-1 ring-white/5 before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-transparent before:pointer-events-none">
            {/* Header */}
            <header className="text-center mb-6 sm:mb-8 [@media(max-height:629px)]:mb-3 [@media(max-height:629px)]:sm:mb-4">
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 backdrop-blur-xl border border-primary/30 mb-4 shadow-[0_8px_24px_-4px_rgba(var(--primary),0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-500 hover:scale-110 hover:rotate-3 hover:shadow-[0_12px_32px_-6px_rgba(var(--primary),0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset] group">
                <Lock className="w-8 h-8 text-primary transition-transform duration-500 group-hover:scale-110" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground bg-gradient-to-b from-foreground via-foreground to-foreground/80 bg-clip-text tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                {t("auth.resetPassword.title") || "Новый пароль"}
              </h1>
              <p className="text-sm text-muted-foreground/90 mt-2 font-medium leading-relaxed">
                {t("auth.resetPassword.subtitle") || "Придумайте надежный пароль"}
              </p>
            </header>
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5 [@media(max-height:629px)]:space-y-2.5">
              <div className="space-y-4 [@media(max-height:629px)]:space-y-2">
                <div className="group relative">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground/90 mb-2 transition-colors duration-300 group-hover:text-primary/80"
                  >
                    {t("auth.resetPassword.newPassword") || "Новый пароль"}
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    required
                    className={`transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${error ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20" : ""
                      }`}
                  />
                </div>
                <div className="group relative">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-foreground/90 mb-2 transition-colors duration-300 group-hover:text-primary/80"
                  >
                    {t("auth.resetPassword.confirmPassword") || "Повторите пароль"}
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                    required
                    className={`transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${error ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20" : ""
                      }`}
                  />
                  {error && (
                    <p className="text-red-500 text-sm mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                      {error}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                variant="neomorphic"
                size="lg"
                disabled={isLoading}
                className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_-3px_20px_rgba(255,255,255,0.08),0_0_20px_rgba(var(--primary),0.3)] active:scale-[0.98] hover:before:opacity-100 mt-6"
              >
                {isLoading ? (t("common.loading") || "Загрузка...") : (t("auth.resetPassword.submit") || "Сохранить пароль")}
              </Button>
            </form>
            <footer className="text-center mt-6 [@media(max-height:629px)]:mt-3">
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hover:underline decoration-primary/60 underline-offset-4 hover:-translate-x-1 group hover:drop-shadow-[0_1px_4px_rgba(0,0,0,0.2)]"
              >
                <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1 group-hover:scale-110" />
                {t("auth.forgotPassword.backToLogin") || "Вернуться ко входу"}
              </button>
            </footer>
          </div>
        </section>
      </main>
    </>
  );
};
export default ResetPassword;
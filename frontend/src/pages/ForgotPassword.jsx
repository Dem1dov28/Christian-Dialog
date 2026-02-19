import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { ArrowLeft, Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import api from "@/services/api";
import { useNotification } from "@/contexts/NotificationContext";
import { SEO } from "@/components/common/SEO";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const { t } = useLanguage();
  const { showNotification } = useNotification();

  // Pre-fill email if coming from profile
  useEffect(() => {
    const passedEmail = location.state?.email;
    const fromProfile = location.state?.fromProfile;
    
    if (passedEmail && fromProfile) {
      setEmail(passedEmail);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setEmailError(""); // Очищаем предыдущие ошибки

    try {
      // Отправляем код для сброса - бэкенд сам проверит существование email
      await api.sendResetCode(email);
      
      setIsEmailSent(true);
    } catch (error) {
      console.error("Password reset error:", error);
      
      // Показываем сообщение об ошибке
      if (error.status === 404 || error.message.includes("not found")) {
        setEmailError(t("auth.forgotPassword.emailNotFound"));
        showNotification(t("auth.forgotPassword.emailNotFound"), "error");
      } else {
        showNotification(t("auth.forgotPassword.errorSending"), "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setCodeError("");

    try {
      const response = await api.verifyResetCode(email, verificationCode);
      
      if (response.success) {
        // Проверяем, что showNotification является функцией
        if (typeof showNotification === 'function') {
          showNotification(t("auth.forgotPassword.success") || "Code verified successfully!", "success");
        }
        
        // Navigate to password reset page with token
        navigate("/reset-password", { 
          state: { 
            email: email, 
            token: response.token || "default_token" 
          } 
        });
      } else {
        setCodeError(response.message || t("auth.forgotPassword.codeInvalid"));
      }
    } catch (error) {
      console.error("Verification error:", error);
      if (error.status === 400) {
        setCodeError(t("auth.forgotPassword.codeInvalid"));
      } else if (error.status === 404) {
        setCodeError(t("auth.forgotPassword.codeExpired"));
      } else {
        // Защита от ошибки "errors.generic"
        try {
          setCodeError(t("errors.generic") || "An error occurred");
        } catch (translationError) {
          setCodeError("An error occurred");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate("/login");
  };

  if (isEmailSent) {
    return (
      <>
        <SEO
          title="Восстановление пароля"
          description="Восстановление пароля Epochal Dialog. Введите код подтверждения для сброса пароля."
          canonical="/forgot-password"
        />
        <div className="relative flex items-center justify-center p-4 dark-theme-locked" style={{ minHeight: '100%' }}>
        <AuthBackground />

        {/* Glass Panel */}
        <div className="relative z-10 w-full max-w-[480px] flex items-center justify-center perspective-1000">
          <div className="relative backdrop-blur-2xl bg-card/30 border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_-4px_24px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] w-full animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 ease-out ring-1 ring-white/5 before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-transparent before:pointer-events-none">
            {/* Success Icon */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 backdrop-blur-xl border border-primary/30 mb-4 shadow-[0_8px_24px_-4px_rgba(var(--primary),0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-500 hover:scale-110 hover:rotate-3 hover:shadow-[0_12px_32px_-6px_rgba(var(--primary),0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset] group before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
                <Mail className="w-8 h-8 text-primary transition-transform duration-500 group-hover:scale-110" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground bg-gradient-to-b from-foreground via-foreground to-foreground/80 bg-clip-text tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                {t("auth.forgotPassword.codeTitle")}
              </h1>
              <p className="text-sm text-muted-foreground/90 mt-2 font-medium leading-relaxed">
                {t("auth.forgotPassword.codeDescription", { email })}
              </p>
            </div>

            {/* Code Input Form */}
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div className="group relative">
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-foreground/90 mb-2 transition-colors duration-300 group-hover:text-primary/80"
                >
                  {t("auth.forgotPassword.codeLabel")}
                </label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  placeholder={t("auth.forgotPassword.codePlaceholder")}
                  value={verificationCode}
                  onChange={(e) => {
                    // Only allow digits and limit to 6 characters
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerificationCode(value);
                    setCodeError("");
                  }}
                  required
                  maxLength={6}
                  className={`transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] text-center text-2xl tracking-widest font-mono ${
                    codeError ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20" : ""
                  }`}
                />
                {codeError && (
                  <p className="text-red-500 text-sm mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    {codeError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="neomorphic"
                size="lg"
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_-3px_20px_rgba(255,255,255,0.08),0_0_20px_rgba(var(--primary),0.3)] active:scale-[0.98] hover:before:opacity-100"
              >
                {isLoading ? t("auth.forgotPassword.verifying") : t("auth.forgotPassword.verifyCode")}
              </Button>
            </form>

            {/* Resend Code Link */}
            <p className="text-center text-sm text-muted-foreground mt-4">
              {t("auth.forgotPassword.successResendQuestion")}{" "}
              <button
                type="button"
                className="text-primary hover:text-primary/90 font-bold transition-all duration-300 hover:underline decoration-primary/60 underline-offset-4 hover:-translate-y-0.5 inline-block hover:drop-shadow-[0_2px_8px_rgba(var(--primary),0.3)]"
                onClick={() => {
                  setIsEmailSent(false);
                  setVerificationCode("");
                  setCodeError("");
                }}
              >
                {t("auth.forgotPassword.successResendCta")}
              </button>
            </p>
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Восстановление пароля"
        description="Забыли пароль? Восстановите доступ к Epochal Dialog - платформе для общения с AI-агентами."
        keywords="восстановление пароля, сброс пароля, forgot password"
        canonical="/forgot-password"
      />
      <div className="relative flex items-center justify-center p-4 dark-theme-locked" style={{ minHeight: '100%' }}>
      <AuthBackground />

      {/* Glass Panel */}
      <div className="relative z-10 w-full max-w-[480px] flex items-center justify-center perspective-1000">
        <div className="relative backdrop-blur-2xl bg-card/30 border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_-4px_24px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] w-full animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 ease-out ring-1 ring-white/5 before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-transparent before:pointer-events-none">
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 backdrop-blur-xl border border-primary/30 mb-4 shadow-[0_8px_24px_-4px_rgba(var(--primary),0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-500 hover:scale-110 hover:rotate-3 hover:shadow-[0_12px_32px_-6px_rgba(var(--primary),0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset] group before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
              <img 
                src="/logo.webp"
                alt="Epochal Dialog"
                className="w-10 h-10 object-contain transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground bg-gradient-to-b from-foreground via-foreground to-foreground/80 bg-clip-text tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              {t("auth.forgotPassword.title")}
            </h1>
            <p className="text-sm text-muted-foreground/90 mt-2 font-medium leading-relaxed">
              {t("auth.forgotPassword.subtitle")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="group relative">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground/90 mb-2 transition-colors duration-300 group-hover:text-primary/80"
              >
                {t("auth.forgotPassword.email")}
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("auth.forgotPassword.emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(""); // Очищаем ошибку при вводе
                }}
                required
                autoComplete="email"
                className={`transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${
                  emailError ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20" : ""
                }`}
              />
              {emailError && (
                <p className="text-red-500 text-sm mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                  {emailError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="neomorphic"
              size="lg"
              disabled={isLoading}
              className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_-3px_20px_rgba(255,255,255,0.08),0_0_20px_rgba(var(--primary),0.3)] active:scale-[0.98] hover:before:opacity-100"
            >
              {isLoading ? t("common.loading") || "Загрузка..." : t("auth.forgotPassword.sendLink")}
            </Button>
          </form>

          {/* Back to Login Link */}
          <div className="text-center mt-6">
            <button
              onClick={handleBackToLogin}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-all duration-300 hover:underline decoration-primary/60 underline-offset-4 hover:-translate-x-1 group hover:drop-shadow-[0_1px_4px_rgba(0,0,0,0.2)]"
            >
              <ArrowLeft className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:-translate-x-1 group-hover:scale-110" />
              {t("auth.forgotPassword.backToLogin")}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default ForgotPassword;

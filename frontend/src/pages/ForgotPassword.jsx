import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { ArrowLeft, Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle password reset logic here
    console.log("Password reset request:", { email });
    setIsEmailSent(true);
  };

  const handleBackToLogin = () => {
    navigate("/login");
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 dark-theme-locked">
        <AuthBackground />

        {/* Glass Panel */}
        <div className="relative z-10 w-full max-w-[480px] flex items-center justify-center perspective-1000">
          <div className="relative backdrop-blur-2xl bg-card/30 border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_-4px_24px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] w-full animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 ease-out ring-1 ring-white/5 before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-transparent before:pointer-events-none">
            {/* Success Icon */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 via-green-500/15 to-green-500/10 backdrop-blur-xl border border-green-500/30 mb-4 shadow-[0_8px_24px_-4px_rgba(34,197,94,0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-500 hover:scale-110 hover:rotate-3 hover:shadow-[0_12px_32px_-6px_rgba(34,197,94,0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset] animate-in zoom-in duration-500 group before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
                <Mail className="w-8 h-8 text-green-500 transition-transform duration-500 group-hover:scale-110" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground bg-gradient-to-b from-foreground via-foreground to-foreground/80 bg-clip-text tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                {t("auth.forgotPassword.successTitle")}
              </h1>
              <p className="text-sm text-muted-foreground/90 mt-2 font-medium leading-relaxed">
                {t("auth.forgotPassword.successDescription", { email })}
              </p>
            </div>

            {/* Instructions */}
            <div className="space-y-4 mb-6">
              <div className="text-center text-sm text-muted-foreground">
                <p>{t("auth.forgotPassword.successInstructions")}</p>
                <p className="mt-2">
                  {t("auth.forgotPassword.successSpamHint")}
                </p>
              </div>
            </div>

            {/* Back to Login Button */}
            <Button
              onClick={handleBackToLogin}
              variant="neomorphic"
              size="lg"
              className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_-3px_20px_rgba(255,255,255,0.08),0_0_20px_rgba(var(--primary),0.3)] active:scale-[0.98] hover:before:opacity-100"
            >
              {t("auth.forgotPassword.backToLogin")}
            </Button>

            {/* Resend Link */}
            <p className="text-center text-sm text-muted-foreground mt-4">
              {t("auth.forgotPassword.successResendQuestion")}{" "}
              <button
                className="text-primary hover:text-primary/90 font-bold transition-all duration-300 hover:underline decoration-primary/60 underline-offset-4 hover:-translate-y-0.5 inline-block hover:drop-shadow-[0_2px_8px_rgba(var(--primary),0.3)]"
                onClick={() => setIsEmailSent(false)}
              >
                {t("auth.forgotPassword.successResendCta")}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 dark-theme-locked">
      <AuthBackground />

      {/* Glass Panel */}
      <div className="relative z-10 w-full max-w-[480px] flex items-center justify-center perspective-1000">
        <div className="relative backdrop-blur-2xl bg-card/30 border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_-4px_24px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.1)] w-full animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-700 ease-out ring-1 ring-white/5 before:absolute before:inset-0 before:rounded-[2rem] before:bg-gradient-to-br before:from-white/5 before:via-transparent before:to-transparent before:pointer-events-none">
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 backdrop-blur-xl border border-primary/30 mb-4 shadow-[0_8px_24px_-4px_rgba(var(--primary),0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset] transition-all duration-500 hover:scale-110 hover:rotate-3 hover:shadow-[0_12px_32px_-6px_rgba(var(--primary),0.6),0_0_0_1px_rgba(255,255,255,0.1)_inset] group before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500">
              <img 
                src="/AI-gram-icon.png" 
                alt="Epochal Dialoge"
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
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                  className="transition-all duration-300 hover:bg-input/70 hover:border-primary/30 focus:bg-input/80 focus:scale-[1.01] focus:shadow-[0_0_0_4px_rgba(var(--primary),0.15),0_2px_12px_rgba(var(--primary),0.2)] focus:border-primary/50 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
              />
            </div>

            <Button
              type="submit"
              variant="neomorphic"
              size="lg"
              className="w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_-3px_20px_rgba(255,255,255,0.08),0_0_20px_rgba(var(--primary),0.3)] active:scale-[0.98] hover:before:opacity-100"
            >
              {t("auth.forgotPassword.sendLink")}
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
  );
};

export default ForgotPassword;

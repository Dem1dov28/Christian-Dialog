import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import apiClient from "@/services/api";
import { SEO } from "@/components/common/SEO";

const STORAGE_KEY_VERIFIER = "telegram_oidc_code_verifier";
const STORAGE_KEY_STATE = "telegram_oidc_state";

/**
 * Страница-колбэк для Log In With Telegram (OIDC redirect flow).
 * Получает code от Telegram, обменивает на токен через бэкенд, выполняет вход.
 */
export default function TelegramCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { reinitializeAuth } = useAuth();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setErrorMessage(searchParams.get("error_description") || error);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Отсутствуют параметры авторизации");
      return;
    }

    const codeVerifier = sessionStorage.getItem(STORAGE_KEY_VERIFIER);
    const savedState = sessionStorage.getItem(STORAGE_KEY_STATE);

    sessionStorage.removeItem(STORAGE_KEY_VERIFIER);
    sessionStorage.removeItem(STORAGE_KEY_STATE);

    if (!codeVerifier || savedState !== state) {
      setStatus("error");
      setErrorMessage("Сессия истекла. Попробуйте войти снова.");
      return;
    }

    const run = async () => {
      try {
        const config = await apiClient.get("/auth/telegram-oidc/config");
        const redirectUri = config?.redirect_uri || `${window.location.origin}/auth/telegram-callback`;

        const response = await apiClient.post("/auth/telegram-oidc", {
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
        });

        if (response?.user) {
          setStatus("success");
          await reinitializeAuth();
          navigate("/", { replace: true });
        } else {
          setStatus("error");
          setErrorMessage("Не удалось войти");
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage(err?.message || "Ошибка авторизации");
      }
    };

    run();
  }, [searchParams, navigate, reinitializeAuth]);

  if (status === "loading") {
    return (
      <>
        <SEO title="Вход через Telegram..." noindex={true} />
        <main className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Вход через Telegram...</p>
          </div>
        </main>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <SEO title="Ошибка входа" noindex={true} />
        <main className="fixed inset-0 flex items-center justify-center bg-background p-4">
          <div className="text-center max-w-md">
            <p className="text-destructive mb-4">{errorMessage}</p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              Вернуться к входу
            </button>
          </div>
        </main>
      </>
    );
  }

  return null;
}

export { STORAGE_KEY_VERIFIER, STORAGE_KEY_STATE };

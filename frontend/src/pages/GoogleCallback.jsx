import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "@/services/api";
import { SEO } from "@/components/common/SEO";

/**
 * Страница-колбэк для Google OAuth redirect flow (Telegram iOS).
 * Получает code от Google, обменивает на return_token, редиректит в Telegram Mini App.
 */
export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setErrorMessage(searchParams.get("error_description") || error);
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage("Отсутствует код авторизации");
      return;
    }

    const redirectUri = `${window.location.origin}${window.location.pathname}`;

    const run = async () => {
      try {
        const { return_token } = await apiClient.exchangeGoogleCode(code, redirectUri);
        const config = await apiClient.getGoogleOAuthConfig();
        const botUsername = config?.bot_username?.trim();

        if (!botUsername) {
          setStatus("error");
          setErrorMessage("Telegram бот не настроен");
          return;
        }

        const deepLink = `https://t.me/${botUsername.replace(/^@/, "")}/app?startapp=google_${return_token}`;
        window.location.href = deepLink;
      } catch (err) {
        setStatus("error");
        setErrorMessage(err?.message || "Ошибка авторизации");
      }
    };

    run();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <>
        <SEO title="Вход через Google..." noindex={true} />
        <main className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Возвращаемся в Telegram...</p>
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

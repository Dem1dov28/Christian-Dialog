import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "@/services/api";
import { SEO } from "@/components/common/SEO";

/**
 * Страница-колбэк для Google OAuth redirect flow (Telegram iOS).
 * Получает code от Google, обменивает на return_token, редиректит в Telegram Mini App.
 * На iOS Safari автопереход может блокироваться — показываем кнопку «Открыть в Telegram».
 */
export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | error | need_tap
  const [errorMessage, setErrorMessage] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const redirectedRef = useRef(false);

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

        const link = `https://t.me/${botUsername.replace(/^@/, "")}/app?startapp=google_${return_token}`;
        setDeepLink(link);

        // iOS Safari: программный редирект может не открыть приложение. Показываем кнопку.
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const isInAppBrowser = /FBAN|FBAV|Instagram|Line|Twitter/.test(navigator.userAgent);

        if (isIOS || isInAppBrowser) {
          setStatus("need_tap");
          return;
        }

        if (!redirectedRef.current) {
          redirectedRef.current = true;
          window.location.replace(link);
        }
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
        <main className="fixed inset-0 flex items-center justify-center bg-[#2d283e]">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-[#54a9eb] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-white/80">Возвращаемся в Telegram...</p>
          </div>
        </main>
      </>
    );
  }

  if (status === "need_tap") {
    return (
      <>
        <SEO title="Открыть в Telegram" noindex={true} />
        <main className="fixed inset-0 flex items-center justify-center bg-[#2d283e] p-6">
          <div className="text-center max-w-sm">
            <p className="text-white/90 mb-6 text-lg">Вход выполнен. Нажмите кнопку, чтобы вернуться в приложение.</p>
            <a
              href={deepLink}
              className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-[#0088cc] text-white font-semibold text-lg hover:bg-[#0077b5] active:scale-95 transition-all shadow-lg no-underline"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Открыть в Telegram
            </a>
            <p className="text-white/50 text-sm mt-6">Откроется приложение Telegram</p>
          </div>
        </main>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <SEO title="Ошибка входа" noindex={true} />
        <main className="fixed inset-0 flex items-center justify-center bg-[#2d283e] p-4">
          <div className="text-center max-w-md">
            <p className="text-red-400 mb-4">{errorMessage}</p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="px-4 py-2 bg-[#54a9eb] text-white rounded-lg"
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

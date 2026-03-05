import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { SEO } from "@/components/common/SEO";

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUserData } = useAuth();
  const { t } = useLanguage();
  const id = searchParams.get("id");

  useEffect(() => {
    refreshUserData?.();
    const timer = setTimeout(() => navigate("/", { replace: true }), 4000);
    return () => clearTimeout(timer);
  }, [navigate, refreshUserData]);

  return (
    <>
      <SEO title="Оплата успешна" noindex={true} />
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h1 style={{ marginBottom: 8 }}>{t("pricing.subscriptionSuccess")}</h1>
        {id && (
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            ID: {id}
          </p>
        )}
        <p style={{ color: "var(--text-dim)", marginTop: 16 }}>
          {t("pricing.redirecting") || "Перенаправление..."}
        </p>
      </main>
    </>
  );
}

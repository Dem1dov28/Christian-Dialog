import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUserData } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    refreshUserData?.();
    const timer = setTimeout(() => navigate("/", { replace: true }), 5000);
    return () => clearTimeout(timer);
  }, [navigate, refreshUserData]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        background: "var(--bg-primary, #0f0f0f)",
        color: "var(--text-white, #fff)",
      }}
    >
      <div style={{ fontSize: 64, marginBottom: 20 }}>✓</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        {t("pricing.subscriptionSuccess")}
      </h1>
      <p style={{ color: "var(--text-dim, #888)", fontSize: 15, maxWidth: 360 }}>
        {t("pricing.paymentSuccessHint")}
      </p>
      <p style={{ color: "var(--text-dim, #888)", marginTop: 24, fontSize: 13 }}>
        {t("pricing.redirecting")}
      </p>
    </div>
  );
}

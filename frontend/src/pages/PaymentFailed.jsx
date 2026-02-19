import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

export default function PaymentFailed() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => navigate("/", { replace: true }), 6000);
    return () => clearTimeout(timer);
  }, [navigate]);

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
      <div style={{ fontSize: 64, marginBottom: 20 }}>✕</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
        {t("pricing.paymentFailed")}
      </h1>
      <p style={{ color: "var(--text-dim, #888)", fontSize: 15, maxWidth: 360 }}>
        {t("pricing.paymentFailedHint")}
      </p>
      <button
        onClick={() => navigate("/")}
        style={{
          marginTop: 28,
          padding: "10px 28px",
          borderRadius: 8,
          border: "none",
          background: "var(--accent, #7c3aed)",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {t("pricing.backToApp")}
      </button>
      <p style={{ color: "var(--text-dim, #888)", marginTop: 24, fontSize: 13 }}>
        {t("pricing.redirecting")}
      </p>
    </div>
  );
}

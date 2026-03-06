import React, { useEffect, useState } from "react";
import { FiStar, FiZap, FiTrendingUp } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";

const SubscriptionStatus = ({ user, onUpgrade }) => {
  const { getSubscriptionStatus } = useAuth();
  const { t, language } = useLanguage();
  const [status, setStatus] = useState(null);
  const getSubscriptionInfo = (tier) => {
    switch (tier) {
      case "free":
        return {
          label: t("pricing.free"),
          icon: FiZap,
          color: "text-gray-500",
          bgColor: "bg-gray-100",
          description: t("pricing.messagesPerDay", { count: 50 }),
        };
      case "plus":
        return {
          label: t("pricing.plus"),
          icon: FiTrendingUp,
          color: "text-purple-600",
          bgColor: "bg-purple-100",
          description: t("pricing.messagesPerDay", { count: 250 }),
        };
      case "pro":
        return {
          label: t("pricing.pro"),
          icon: FiStar,
          color: "text-purple-600",
          bgColor: "bg-purple-100",
          description: t("pricing.messagesPerDay", { count: 500 }),
        };
      case "api":
        return {
          label: t("pricing.api"),
          icon: FiZap,
          color: "text-green-600",
          bgColor: "bg-green-100",
          description: t("pricing.apiAccess"),
        };
      default:
        return {
          label: t("pricing.free"),
          icon: FiZap,
          color: "text-gray-500",
          bgColor: "bg-gray-100",
          description: t("chat.basicAccess"),
        };
    }
  };

  const subscriptionInfo = getSubscriptionInfo(
    user?.subscription_tier || "free"
  );
  const IconComponent = subscriptionInfo.icon;

  // Предпочитаем expires_at из статуса; фолбек на user.expires_at
  const effectiveExpiresAt = status?.expires_at ?? user?.expires_at;
  const isExpired =
    effectiveExpiresAt && new Date(effectiveExpiresAt) < new Date();

  // Логирование для отладки
  console.log("SubscriptionStatus: user.expires_at:", user?.expires_at);
  console.log("SubscriptionStatus: status.expires_at:", status?.expires_at);
  console.log("SubscriptionStatus: effectiveExpiresAt:", effectiveExpiresAt);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const s = await getSubscriptionStatus();
        if (isMounted) setStatus(s);
      } catch (e) {
        // игнорируем, используем user.expires_at
      }
    })();
    return () => {
      isMounted = false;
    };
    // Убираем getSubscriptionStatus из зависимостей, чтобы избежать бесконечного цикла
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.subscription_tier, user?.expires_at]);

  return (
    <div
      className="subscription-status-card"
      role="button"
      tabIndex={0}
      onClick={onUpgrade}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onUpgrade?.()}
      style={{ cursor: "pointer" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`subscription-icon subscription-tier-${
              user?.subscription_tier || "free"
            }`}
          >
            <IconComponent className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-white)]">
                {subscriptionInfo.label}
              </span>
              {isExpired && (
                <span className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded">
                  {t("pricing.expired")}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-dim)]">
              {subscriptionInfo.description}
            </p>
          </div>
        </div>

        {user?.subscription_tier === "free" && (
          <button onClick={(e) => { e.stopPropagation(); onUpgrade?.(); }} className="upgrade-button">
            {t("pricing.upgrade")}
          </button>
        )}

        {effectiveExpiresAt &&
          !isExpired &&
          user?.subscription_tier !== "free" && (
            <div className="text-right">
              <p className="text-xs text-[var(--text-dim)]">
                {t("pricing.until")}{" "}
                {(() => {
                  const date = new Date(effectiveExpiresAt);
                  console.log(
                    "SubscriptionStatus: Formatting date:",
                    effectiveExpiresAt,
                    "->",
                    date.toLocaleDateString()
                  );
                  return date.toLocaleDateString(language === "ru" ? "ru-RU" : "en-US");
                })()}
              </p>
            </div>
          )}
      </div>
    </div>
  );
};

export default SubscriptionStatus;

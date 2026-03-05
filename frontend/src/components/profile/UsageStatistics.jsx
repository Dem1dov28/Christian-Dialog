import React, { useState, useEffect } from "react";
import { FiMessageSquare, FiFolder } from "react-icons/fi";
import { useLanguage } from "../../contexts/LanguageContext";

const UsageStatistics = ({ usageStats, user }) => {
  const { t } = useLanguage();
  if (!usageStats) {
    return (
      <div className="subscription-status-card">
        <div className="animate-pulse">
          <div className="h-4 bg-[var(--bg-tertiary)] rounded mb-2"></div>
          <div className="h-3 bg-[var(--bg-tertiary)] rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  // Определяем лимит и использованные сообщения на основе тарифа
  // Все тарифы используют ежедневный сброс
  const tier = user?.subscription_tier || "free";
  
  // Лимиты для каждого тарифа (все - ежедневные)
  const tierLimits = {
    free: 50,
    plus: 250,
    pro: 500,
    api: 500
  };
  
  const limit = tierLimits[tier] || 50;
  
  // Используем messages_this_month из usageStats (сообщения за текущий день, включая сообщения агентов)
  const used = usageStats?.messages_this_month ?? 0;
  
  const usagePercentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return "usage-progress-high";
    if (percentage >= 75) return "usage-progress-medium";
    return "usage-progress-low";
  };

  // Таймер обратного отсчета до сброса
  const [timeUntilReset, setTimeUntilReset] = useState("");
  
  useEffect(() => {
    const updateTimer = () => {
      // Для всех тарифов: ежедневный сброс в 00:00 UTC следующего дня
      const now = new Date();
      
      // Вычисляем следующий сброс в 00:00 UTC
      const nextReset = new Date(now);
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
      nextReset.setUTCHours(0, 0, 0, 0);
      
      // Вычисляем разницу во времени
      const diff = nextReset - now;
      
      if (diff <= 0) {
        // Если сброс уже произошел, показываем следующую дату
        setTimeUntilReset(t("profile.usage.reset"));
        return;
      }
      
      // Конвертируем миллисекунды в часы, минуты и секунды
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      // Форматируем время
      const hh = String(hours).padStart(2, "0");
      const mm = String(minutes).padStart(2, "0");
      const ss = String(seconds).padStart(2, "0");
      
      setTimeUntilReset(`${hh}:${mm}:${ss}`);
    };
    
    // Обновляем таймер сразу
    updateTimer();
    
    // Обновляем таймер каждую секунду
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      {/* Прогресс-бар сообщений */}
      <div className="subscription-status-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FiMessageSquare className="usage-stat-icon" />
            <span className="text-sm font-medium text-[var(--text-white)]">
              {t("profile.usage.messages")}
            </span>
          </div>
          <span className="text-sm text-[var(--text-dim)]">
            {used} / {limit}
          </span>
        </div>

        <div className="usage-stats-bar">
          <div
            className={`usage-progress-fill ${getUsageColor(usagePercentage)}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          ></div>
        </div>

        <div className="flex justify-between mt-1">
          <span className="text-xs text-[var(--text-dim)]">
            {usagePercentage}% {t("profile.usage.used")}
          </span>
          <span className="text-xs text-[var(--text-dim)]">
            {timeUntilReset || t("common.loading")}
          </span>
        </div>
      </div>

      {/* Количество чатов (включая групповые) */}
      <div className="usage-stat-card">
        <div className="flex items-center gap-2 mb-1">
          <FiFolder className="usage-stat-icon" />
          <span className="usage-stat-label">{t("profile.usage.chats")}</span>
        </div>
        <span className="usage-stat-number">
          {usageStats?.conversations_count ?? 0} / {usageStats?.max_chats ?? 10}
        </span>
      </div>
    </div>
  );
};

export default UsageStatistics;

// pricingData.js

export const getPricingData = (t) => ({
  free: {
    title: t("pricing.free"),
    price: 0,
    description: t("pricing.freeDescription"),
    features: [
      t("pricing.freeFeature1"),
      t("pricing.freeFeature2"),
      t("pricing.freeFeature3"),
      t("pricing.freeFeature4"),
      t("pricing.freeFeature5"),
      t("pricing.freeFeature6"),
    ],
  },
  plus: {
    title: t("pricing.plus"),
    price: 2,
    description: t("pricing.plusDescription"),
    features: [
      t("pricing.plusFeature1"),
      t("pricing.plusFeature2"),
      t("pricing.plusFeature3"),
      t("pricing.plusFeature4"),
      t("pricing.plusFeature5"),
      t("pricing.plusFeature6"),
      t("pricing.plusFeature7"),
    ],
  },
  pro: {
    title: t("pricing.pro"),
    price: 5,
    description: t("pricing.proDescription"),
    features: [
      t("pricing.proFeature1"),
      t("pricing.proFeature2"),
      t("pricing.proFeature3"),
      t("pricing.proFeature4"),
      t("pricing.proFeature5"),
      t("pricing.proFeature6"),
      t("pricing.proFeature7"),
      t("pricing.proFeature8"),
    ],
  },
  apiKey: {
    title: t("pricing.apiKey"),
    price: 5,
    description: t("pricing.apiKeyDescription"),
    features: [
      t("pricing.apiKeyFeature1"),
      t("pricing.apiKeyFeature2"),
      t("pricing.apiKeyFeature3"),
      t("pricing.apiKeyFeature4"),
      t("pricing.apiKeyFeature5"),
    ],
  },
});

// Для обратной совместимости
export const pricingData = {
  free: {
    title: "Free",
    price: 0,
    description: "Базовый доступ к популярным агентам и функциям",
    features: [
      "До 10 популярных агентов",
      "GPT-3.5, Claude Haiku, DeepSeek Coder",
      "До 50 сообщений в месяц",
      "История сообщений на 30 дней",
      "Базовое общение с агентами",
      "Поиск и создание чатов",
    ],
  },
  plus: {
    title: "Plus",
    price: 2,
    description:
      "Для пользователей, которым нужен расширенный доступ к агентам и функциям",
    features: [
      "До 50 агентов всех категорий",
      "GPT-4, Claude Sonnet, DeepSeek Coder Pro",
      "До 500 сообщений в месяц",
      "История сообщений на 6 месяцев",
      "Расширенная память и контекст",
      "Групповые чаты с агентами",
      "Файловые вложения (изображения, документы)",
    ],
  },
  pro: {
    title: "Pro",
    price: 5,
    description:
      "Для профессионалов и команд, которым нужны все возможности платформы",
    features: [
      "Все 200+ агентов платформы",
      "GPT-5, Claude Opus, DeepSeek Coder Pro, Grok",
      "Неограниченное количество сообщений и загрузок",
      "Неограниченное хранение истории",
      "Создание своих персонажей",
      "Максимальная память и контекст",
      "API доступ для интеграции",
      "Продвинутые настройки агентов (температура, токены, контекст)",
    ],
  },
  apiKey: {
    title: "API Key",
    price: 5,
    description: "Для разработчиков с собственными API ключами",
    features: [
      "Использование собственного API ключа",
      "Интеграция с вашими LLM провайдерами на котором будут работать ваши агенты",
      "Базовый функционал платформы (как при подписке Plus)",
      "До 500 сообщений в день",
      "Возможность интеграции с собственными системами",
    ],
  },
};

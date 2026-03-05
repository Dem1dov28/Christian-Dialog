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
      "До 50 сообщений в день",
      "Группы до 2 персонажей",
      "До 10 чатов в списке",
    ],
  },
  plus: {
    title: "Plus",
    price: 2,
    description: "Расширенный доступ: всё из Free и больше",
    features: [
      "Всё из Free",
      "До 150 сообщений в день",
      "Группы до 5 персонажей",
      "1 файл к сообщению, до 5 фото/файлов в день",
      "До 25 чатов в списке",
    ],
  },
  pro: {
    title: "Pro",
    price: 5,
    description: "Максимальные возможности: всё из Plus и больше",
    features: [
      "Всё из Plus",
      "До 250 сообщений в день",
      "До 3 файлов к сообщению, до 10 фото/файлов в день",
      "До 50 чатов в списке",
      "Создание собственных персонажей",
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

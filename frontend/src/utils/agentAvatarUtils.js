import apiClient from "../services/api";

/**
 * Формирует полный URL для аватара агента
 * @param {string|null|undefined} imageUrl - URL изображения из image_url
 * @param {string|null|undefined} avatarUrl - URL изображения из avatar_url
 * @param {string} quality - Качество изображения ('low', 'medium', 'high')
 * @returns {string|null} - Полный URL или null если изображения нет
 */
export function getAgentAvatarUrl(imageUrl, avatarUrl, quality = "high") {
  let url = imageUrl || avatarUrl;

  // Фильтруем пустые значения
  if (!url || url === "null" || url === "undefined" || (typeof url === "string" && url.trim() === "")) {
    return null;
  }

  // Для /images/agents/ подставляем уменьшенные версии в зависимости от quality
  if (url.startsWith("/images/agents/") && !url.includes("/_low/") && !url.includes("/_medium/")) {
    if (quality === "low") {
      // _low использует WebP (максимальное сжатие)
      url = url.replace("/images/agents/", "/images/agents/_low/");
      url = url.replace(/\.(png|jpg|jpeg|webp)$/i, ".webp");
    } else if (quality === "medium") {
      // _medium использует JPG (среднее сжатие)
      url = url.replace("/images/agents/", "/images/agents/_medium/");
      url = url.replace(/\.(png|jpg|jpeg|webp)$/i, ".jpg");
    }
  }

  // Если URL уже абсолютный (http/https), возвращаем как есть
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Если это путь к статическим файлам приложения (начинается с /images/), возвращаем как есть
  if (url.startsWith("/images/")) {
    return url;
  }

  // Для относительных путей (например, /static/user_agents/...) добавляем базовый URL API
  const baseURL = apiClient?.baseURL || apiClient?.client?.baseURL || "http://localhost:8000";
  return `${baseURL}${url.startsWith("/") ? url : `/${url}`}`;
}

/**
 * Получить URL аватара из объекта агента
 * @param {Object} agent - Объект агента
 * @param {string} quality - Качество изображения ('low', 'medium', 'high')
 * @returns {string|null} - Полный URL или null
 */
export function getAgentAvatarUrlFromAgent(agent, quality = "high") {
  if (!agent) return null;
  return getAgentAvatarUrl(agent.image_url, agent.avatar_url, quality);
}

/**
 * Формирует полный URL для аватара группового чата
 * @param {string|null|undefined} groupAvatarUrl - URL загруженного аватара
 * @returns {string|null} - Полный URL или null
 */
export function getGroupChatAvatarUrl(groupAvatarUrl) {
  if (!groupAvatarUrl || groupAvatarUrl === "null" || groupAvatarUrl === "undefined" || (typeof groupAvatarUrl === "string" && groupAvatarUrl.trim() === "")) {
    return null;
  }

  // Если URL уже абсолютный (http/https), возвращаем как есть
  if (groupAvatarUrl.startsWith("http://") || groupAvatarUrl.startsWith("https://")) {
    return groupAvatarUrl;
  }

  // Если это путь к статическим файлам приложения (начинается с /images/), возвращаем как есть
  if (groupAvatarUrl.startsWith("/images/")) {
    return groupAvatarUrl;
  }

  // Для относительных путей (например, /static/group_chats/...) добавляем базовый URL API
  const baseURL = apiClient?.baseURL || apiClient?.client?.baseURL || "http://localhost:8000";
  return `${baseURL}${groupAvatarUrl.startsWith("/") ? groupAvatarUrl : `/${groupAvatarUrl}`}`;
}


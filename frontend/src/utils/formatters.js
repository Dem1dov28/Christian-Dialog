/**
 * Утилиты для форматирования данных
 */

/**
 * Форматирует время из строки даты в формат HH:MM
 * Универсальная функция, которая правильно обрабатывает UTC и локальное время
 * @param {string} dateString - Строка с датой
 * @returns {string} - Отформатированное время (HH:MM) или "Сейчас" если дата невалидна
 */
export const formatTime = (dateString) => {
  if (!dateString) return "Сейчас";

  // Создаем Date объект из строки
  const date = new Date(dateString);

  // Проверяем, что дата валидна
  if (isNaN(date.getTime())) return "Сейчас";

  // Если строка не содержит 'Z' или '+', добавляем UTC суффикс
  // Это гарантирует, что время интерпретируется как UTC
  let processedDateString = dateString;
  if (
    !processedDateString.includes("Z") &&
    !processedDateString.includes("+") &&
    !processedDateString.includes("-", 10)
  ) {
    // Если это ISO строка без часового пояса, добавляем Z
    if (processedDateString.includes("T")) {
      processedDateString = processedDateString + "Z";
    }
  }

  // Создаем новый Date объект с обработанной строкой
  const processedDate = new Date(processedDateString);

  // Проверяем, что обработанная дата валидна
  if (isNaN(processedDate.getTime())) {
    // Если обработка не удалась, используем оригинальную дату
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Форматируем в локальном времени пользователя
  return processedDate.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Форматирует дату в заголовок (Сегодня, Вчера, день недели, полная дата)
 * @param {string} dateString - Строка с датой
 * @param {string} language - Язык интерфейса ('ru' или 'en')
 * @returns {string} - Отформатированная дата
 */
export const formatDateHeader = (dateString, language = "ru") => {
  if (!dateString) return "";
  
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Проверяем, сегодня ли это
  if (messageDate.getTime() === today.getTime()) {
    return language === "ru" ? "Сегодня" : "Today";
  }

  // Проверяем, вчера ли это
  if (messageDate.getTime() === yesterday.getTime()) {
    return language === "ru" ? "Вчера" : "Yesterday";
  }

  // Проверяем, в пределах последних 7 дней (показываем день недели)
  const daysDiff = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff >= 0 && daysDiff < 7) {
    const daysOfWeek = language === "ru" 
      ? ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return daysOfWeek[date.getDay()];
  }

  // Для более старых дат показываем полную дату
  const months = language === "ru"
    ? ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

/**
 * Декодирует HTML entities и удаляет reply-блоки, сохраняя HTML-теги как текст
 * Это позволяет показывать текст с тегами (например, &lt;div&gt;test&lt;/div&gt; → <div>test</div>) как обычный текст
 * 
 * ВАЖНО: Работаем ТОЛЬКО со строкой через regex, НЕ используем DOM для удаления тегов.
 * @param {string} content - Строка с контентом
 * @returns {string} - Очищенный текст
 */
export const getCleanText = (content) => {
  if (!content || typeof content !== "string") return "";

  // Шаг 1: Удаляем reply-блоки через regex (работаем со строкой, не интерпретируем HTML)
  let cleaned = content
    .replace(
      /<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
      ""
    )
    .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
    .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  
  // Удаляем оставшиеся закрывающие теги в начале
  cleaned = cleaned.trim().replace(/^<\/div>\s*/i, "");
  cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*/i, "");
  cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*<\/div>\s*/i, "");
  
  // Шаг 2: Декодируем HTML entities ТОЛЬКО через regex (НЕ используем DOM для удаления тегов)
  // Важно: порядок имеет значение - сначала &amp;, чтобы не конфликтовало
  const decoded = cleaned
    .replace(/&amp;/g, "&")    // Декодируем &amp; в & (сначала!)
    .replace(/&lt;/g, "<")      // Декодируем &lt; в <
    .replace(/&gt;/g, ">")      // Декодируем &gt; в >
    .replace(/&quot;/g, '"')    // Декодируем &quot; в "
    .replace(/&#039;/g, "'")    // Декодируем &#039; в '
    .replace(/&#x27;/g, "'");   // Декодируем &#x27; в '
  
  return decoded.trim();
};



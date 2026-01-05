import { useCallback } from "react";

/**
 * Хук для обработки вставки изображений из буфера обмена
 */
export function useClipboardPaste({
  attachedFiles,
  setAttachedFiles,
  validateFile,
  showError,
  t,
}) {
  const handlePasteLegacy = useCallback(
    async (e) => {
      // Получаем данные из буфера обмена
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      // Проверяем, есть ли файлы в буфере обмена
      const items = Array.from(clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));

      if (imageItems.length === 0) {
        // Если нет изображений, позволяем стандартную вставку текста
        return;
      }

      // Предотвращаем стандартную вставку текста, если есть изображения
      e.preventDefault();

      const currentCount = attachedFiles.length;
      const maxFiles = 3;
      const remainingSlots = maxFiles - currentCount;

      // Если нет свободных слотов, показываем ошибку и выходим
      if (remainingSlots <= 0) {
        showError(t("chat.maxFilesError"));
        return;
      }

      // Ограничиваем количество файлов до доступных слотов
      const itemsToProcess = imageItems.slice(0, remainingSlots);
      const skippedCount = imageItems.length - itemsToProcess.length;

      // Показываем предупреждение, если некоторые файлы пропущены
      if (skippedCount > 0) {
        showError(
          t("chat.filesLimitMessage", {
            count: remainingSlots,
            skipped: skippedCount,
          })
        );
      }

      // Преобразуем изображения из буфера обмена в File объекты
      const validFiles = [];
      const errors = [];

      for (const item of itemsToProcess) {
        try {
          const file = item.getAsFile();
          if (!file) continue;

          // Валидация файла
          const validation = validateFile(file);
          if (validation.valid) {
            // Генерируем имя файла, если его нет
            let fileName = file.name;
            if (!fileName) {
              // Определяем расширение из MIME типа
              const mimeType = file.type;
              let extension = "png"; // По умолчанию PNG
              if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
                extension = "jpg";
              } else if (mimeType.includes("gif")) {
                extension = "gif";
              } else if (mimeType.includes("webp")) {
                extension = "webp";
              } else if (mimeType.includes("bmp")) {
                extension = "bmp";
              } else if (mimeType.includes("svg")) {
                extension = "svg";
              }
              fileName = `image-${Date.now()}.${extension}`;
            }

            validFiles.push({
              id: Date.now() + Math.random(), // Простой ID
              file: file,
              name: fileName,
              size: file.size,
              type: file.type,
            });
          } else {
            errors.push(`Изображение: ${validation.error}`);
          }
        } catch (error) {
          console.error("Ошибка при обработке изображения из буфера обмена:", error);
          errors.push(t("chat.clipboardImageError"));
        }
      }

      // Показываем ошибки, если есть
      if (errors.length > 0) {
        errors.forEach((error) => showError(error));
      }

      // Добавляем валидные файлы
      if (validFiles.length > 0) {
        setAttachedFiles((prev) => [...prev, ...validFiles]);
      }
    },
    [attachedFiles, setAttachedFiles, validateFile, showError, t]
  );

  return { handlePasteLegacy };
}


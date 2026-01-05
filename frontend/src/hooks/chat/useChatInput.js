import { useState, useCallback, useEffect, useRef } from "react";
import apiClient from "../../services/api";

/**
 * Хук для управления полем ввода чата
 * Включает управление текстом, файлами, draft сообщениями и отправкой
 */
export function useChatInput({
  activeConversation,
  activeChatId,
  textareaRef,
  isChannelChat,
  canWriteChannel,
  isGroupChat,
  currentAgentId,
  isPurchaseTrackerChat,
  isNotesChat,
  isTodoJournalChat,
  isProgressJournalChat,
  isTravelJournalChat,
  isDietitianJournalChat,
  currentPurchaseMode,
  currentNoteMode,
  currentTravelMode,
  currentDietitianMode,
  isDialogueLoading,
  sendMessage,
  sendGroupMessage,
  publishChannelMessage,
  loadMessages,
  loadGroupMessages,
  onMessageSent,
  showError,
  showSuccess,
  t,
  forceScrollToBottom,
  needInitialScrollRef,
}) {
  // Состояние поля ввода
  const [inputValue, setInputValue] = useState("");
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Функции для работы с draft сообщениями через sessionStorage
  const saveDraftMessage = useCallback((chatId, message) => {
    try {
      sessionStorage.setItem("session_active", "true");
      sessionStorage.setItem(`draft_${chatId}`, message);
    } catch (error) {
      console.error("Failed to save draft:", error);
    }
  }, []);

  const loadDraftMessage = useCallback((chatId) => {
    try {
      const sessionActive = sessionStorage.getItem("session_active");
      if (sessionActive !== "true") {
        return "";
      }
      return sessionStorage.getItem(`draft_${chatId}`) || "";
    } catch (error) {
      console.error("Failed to load draft:", error);
      return "";
    }
  }, []);

  const clearDraftMessage = useCallback((chatId) => {
    try {
      sessionStorage.removeItem(`draft_${chatId}`);
    } catch (error) {
      console.error("Failed to clear draft:", error);
    }
  }, []);

  // Сброс высоты textarea
  const resetTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      const minHeight = window.innerWidth < 640 ? 20 : 24;
      textareaRef.current.style.height = `${minHeight}px`;
    }
  }, [textareaRef]);

  // Восстановление draft при смене чата
  useEffect(() => {
    if (activeConversation?.id) {
      const draft = loadDraftMessage(activeConversation.id);
      setInputValue(draft);

      if (draft && textareaRef.current) {
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const minHeight = window.innerWidth < 640 ? 20 : 24;
            textareaRef.current.style.height =
              Math.min(textareaRef.current.scrollHeight, 200) + "px";
          }
        }, 0);
      } else {
        resetTextareaHeight();
      }
    } else {
      setInputValue("");
      resetTextareaHeight();
    }

    setReplyToMessage(null);
  }, [activeChatId, activeConversation?.id, loadDraftMessage, resetTextareaHeight, textareaRef]);

  // Очистка прикрепленных файлов при смене чата
  useEffect(() => {
    setAttachedFiles([]);
    setUploadProgress(null);
  }, [activeChatId]);

  // Автосохранение draft при изменении текста
  useEffect(() => {
    if (activeConversation?.id && inputValue.trim()) {
      const timeoutId = setTimeout(() => {
        saveDraftMessage(activeConversation.id, inputValue);
      }, 500); // Debounce 500ms

      return () => clearTimeout(timeoutId);
    }
  }, [inputValue, activeConversation?.id, saveDraftMessage]);

  // Валидация файла
  const validateFile = useCallback((file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedExtensions = [
      ".pdf", ".docx", ".doc", ".odt", ".rtf", ".txt", ".md",
      ".xlsx", ".csv", ".ods",
      ".py", ".js", ".ts", ".java", ".cpp", ".cs", ".html", ".css",
      ".json", ".xml", ".yaml", ".yml", ".toml", ".go", ".rs", ".rb",
      ".php", ".swift", ".kt", ".dart", ".sh", ".bash", ".zsh",
      ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"
    ];

    if (file.size > maxSize) {
      return {
        valid: false,
        error: t("chat.fileSizeError", { defaultValue: "File size exceeds 5MB limit. Please select a smaller file." })
      };
    }

    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
      return {
        valid: false,
        error: t("chat.fileTypeError", { defaultValue: "File type not supported. Supported types: PDF, DOCX, XLSX, images, and code files." })
      };
    }

    return { valid: true };
  }, [t]);

  // Обработка выбора файлов
  const handleFileSelect = useCallback((e) => {
    if (isChannelChat) {
      showError(t("chat.channelAttachmentsNotSupported", {
        defaultValue: "В каналах пока нельзя отправлять файлы",
      }));
      e.target.value = "";
      return;
    }

    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentCount = attachedFiles.length;
    const maxFiles = 3;
    const remainingSlots = maxFiles - currentCount;

    if (remainingSlots <= 0) {
      showError(t("chat.maxFilesError", { defaultValue: "Максимум 3 файла" }));
      e.target.value = "";
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const skippedCount = files.length - filesToProcess.length;

    if (skippedCount > 0) {
      showError(t("chat.filesLimitMessage", { 
        count: remainingSlots, 
        skipped: skippedCount,
        defaultValue: `Можно добавить только ${remainingSlots} файл(ов). Пропущено: ${skippedCount}`
      }));
    }

    const validFiles = [];
    const errors = [];

    filesToProcess.forEach((file) => {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push({
          id: Date.now() + Math.random(),
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (errors.length > 0) {
      errors.forEach(error => showError(error));
    }

    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }

    e.target.value = "";
  }, [isChannelChat, attachedFiles.length, validateFile, showError, t]);

  // Удаление файла
  const handleRemoveFile = useCallback((fileId) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Обработчики drag-and-drop
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files') && !isChannelChat) {
      setIsDragging(true);
    }
  }, [isChannelChat]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isChannelChat) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, [isChannelChat]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isChannelChat) {
      showError(t("chat.channelAttachmentsNotSupported", {
        defaultValue: "В каналах пока нельзя отправлять файлы",
      }));
      return;
    }

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const currentCount = attachedFiles.length;
    const maxFiles = 3;
    const remainingSlots = maxFiles - currentCount;

    if (remainingSlots <= 0) {
      showError(t("chat.maxFilesError", { defaultValue: "Максимум 3 файла" }));
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const skippedCount = files.length - filesToProcess.length;

    if (skippedCount > 0) {
      showError(t("chat.filesLimitMessage", { 
        count: remainingSlots, 
        skipped: skippedCount,
        defaultValue: `Можно добавить только ${remainingSlots} файл(ов). Пропущено: ${skippedCount}`
      }));
    }

    const validFiles = [];
    const errors = [];

    filesToProcess.forEach((file) => {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push({
          id: Date.now() + Math.random(),
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (errors.length > 0) {
      errors.forEach(error => showError(error));
    }

    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }
  }, [isChannelChat, attachedFiles.length, validateFile, showError, t]);

  // Обработка вставки изображений из буфера обмена
  const handlePaste = useCallback(async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = Array.from(clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length === 0) {
      return;
    }

    e.preventDefault();

    const currentCount = attachedFiles.length;
    const maxFiles = 3;
    const remainingSlots = maxFiles - currentCount;

    if (remainingSlots <= 0) {
      showError(t("chat.maxFilesError", { defaultValue: "Максимум 3 файла" }));
      return;
    }

    const itemsToProcess = imageItems.slice(0, remainingSlots);
    const skippedCount = imageItems.length - itemsToProcess.length;

    if (skippedCount > 0) {
      showError(t("chat.filesLimitMessage", { 
        count: remainingSlots, 
        skipped: skippedCount,
        defaultValue: `Можно добавить только ${remainingSlots} файл(ов). Пропущено: ${skippedCount}`
      }));
    }

    const validFiles = [];
    const errors = [];

    for (const item of itemsToProcess) {
      try {
        const file = item.getAsFile();
        if (!file) continue;

        const validation = validateFile(file);
        if (validation.valid) {
          let fileName = file.name;
          if (!fileName) {
            const mimeType = file.type;
            let extension = 'png';
            if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
              extension = 'jpg';
            } else if (mimeType.includes('gif')) {
              extension = 'gif';
            } else if (mimeType.includes('webp')) {
              extension = 'webp';
            } else if (mimeType.includes('bmp')) {
              extension = 'bmp';
            } else if (mimeType.includes('svg')) {
              extension = 'svg';
            }
            fileName = `image-${Date.now()}.${extension}`;
          }

          validFiles.push({
            id: Date.now() + Math.random(),
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
        errors.push(t("chat.clipboardImageError", { defaultValue: "Ошибка при обработке изображения" }));
      }
    }

    if (errors.length > 0) {
      errors.forEach(error => showError(error));
    }

    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }
  }, [attachedFiles.length, validateFile, showError, t]);

  // Очистка поля ввода
  const clearInput = useCallback((restoreText = null) => {
    if (restoreText) {
      setInputValue(restoreText);
    } else {
      setInputValue("");
      resetTextareaHeight();
      if (activeConversation?.id) {
        clearDraftMessage(activeConversation.id);
      }
    }
    setReplyToMessage(null);
  }, [resetTextareaHeight, activeConversation?.id, clearDraftMessage]);

  // Обработка изменения поля ввода
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    const limitedValue = value.length > 7500 ? value.slice(0, 7500) : value;
    setInputValue(limitedValue);

    // Автоматическое изменение высоты textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    const minHeight = window.innerWidth < 640 ? 20 : 24;
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  }, []);

  // Отправка сообщения
  const handleSendMessage = useCallback(async () => {
    if (inputValue.trim() === "" || !activeConversation?.id) {
      return;
    }

    if (inputValue.length > 7500) {
      showError(t("chat.messageTooLong", { defaultValue: "Сообщение слишком длинное" }));
      return;
    }

    if (isDialogueLoading) {
      showError(t("chat.waitForGeneration", { defaultValue: "Дождитесь завершения генерации" }));
      return;
    }

    let finalMessage = inputValue.trim();
    
    // Очищаем поле ввода СРАЗУ после нажатия кнопки отправки
    clearInput();

    // Обработка reply сообщений
    if (replyToMessage) {
      let cleanReplyContent = replyToMessage.content || "";

      try {
        let cleaned = cleanReplyContent
          .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
          .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
          .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
          .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

        cleaned = cleaned.trim().replace(/^<\/div>\s*/i, "");
        cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*/i, "");
        cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*<\/div>\s*/i, "");

        const decoded = cleaned
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&#x27;/g, "'");

        cleanReplyContent = decoded.trim();
      } catch (_) {
        // Fallback
        cleanReplyContent = cleanReplyContent
          .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
          .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
          .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
          .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
          .trim();
      }

      if (!cleanReplyContent) {
        cleanReplyContent = "...";
      }

      const authorName = replyToMessage.author_name || replyToMessage.agent_name || t("chat.replyToMessage", { defaultValue: "Сообщение" });
      const replyToMessageId = replyToMessage.original_message_id || replyToMessage.id;

      const escapeHtml = (text) => {
        return String(text)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      const safeContent = escapeHtml(cleanReplyContent);
      const safeAuthorName = escapeHtml(authorName);

      const replyBlockHTML = `<div class="reply-block mb-1.5 rounded overflow-hidden select-none" data-reply-to-id="${replyToMessageId}" style="background-color: var(--msg-reply-bg); border: 1px solid var(--msg-reply-border); padding: 6px 8px; cursor: pointer;"><div class="flex gap-2"><div class="flex-shrink-0" style="width: 3px; background-color: var(--msg-reply-author-color); border-radius: 2px;"></div><div class="flex-1 min-w-0 overflow-hidden"><div class="font-semibold mb-0.5" style="color: var(--msg-reply-author-color); font-size: 12px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeAuthorName}</div><div style="color: var(--msg-reply-text-color); font-size: 12px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeContent}</div></div></div></div>`;

      finalMessage = replyBlockHTML + finalMessage;
    }

    // Прокрутка вниз перед отправкой
    try {
      if (forceScrollToBottom) {
        forceScrollToBottom("auto");
      }
      if (needInitialScrollRef?.current !== undefined) {
        needInitialScrollRef.current = true;
      }
    } catch (_) {}

    // Обработка каналов
    if (isChannelChat) {
      if (attachedFiles.length > 0) {
        showError(t("chat.channelAttachmentsNotSupported", {
          defaultValue: "В каналах пока нельзя отправлять файлы",
        }));
        return;
      }

      if (!canWriteChannel) {
        showError(t("chat.channelReadOnlyError", {
          defaultValue: "У вас нет прав для публикации в этом канале",
        }));
        return;
      }

      try {
        await publishChannelMessage(activeConversation.id, finalMessage);
        setAttachedFiles([]);
        setUploadProgress(null);
      } catch (error) {
        console.error("Failed to publish channel message:", error);
        showError(
          error?.message ||
            t("chat.channelPublishError", {
              defaultValue: "Не удалось отправить сообщение в канале",
            })
        );
        clearInput(finalMessage);
      }
      return;
    }

    // Обработка режима истории покупок
    if (isPurchaseTrackerChat && currentPurchaseMode === "history") {
      return; // Не отправляем сообщения в режиме истории покупок
    }

    // Обработка режима истории заметок
    if (isNotesChat && currentNoteMode === "history") {
      return; // Не отправляем сообщения в режиме истории заметок
    }

    // Обработка режима истории для todo и progress журналов
    // Они используют currentPurchaseMode для переключения режимов
    if ((isTodoJournalChat || isProgressJournalChat) && currentPurchaseMode === "history") {
      return; // Не отправляем сообщения в режиме истории для todo/progress журналов
    }

    // Обработка режима истории для travel journal
    if (isTravelJournalChat && currentTravelMode === "history") {
      return; // Не отправляем сообщения в режиме истории для travel journal
    }

    // Обработка режима истории для dietitian journal
    if (isDietitianJournalChat && currentDietitianMode === "history") {
      return; // Не отправляем сообщения в режиме истории для dietitian journal
    }

    setIsLoading(true);

    // Отправка с файлами
    if (attachedFiles.length > 0) {
      try {
        const formData = new FormData();
        formData.append('message', finalMessage);
        formData.append('agent_id', isGroupChat ? '' : (activeConversation.is_system_chat ? 1 : currentAgentId));
        formData.append('conversation_id', activeConversation.id);

        attachedFiles.forEach((fileObj) => {
          formData.append('files', fileObj.file);
        });

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && attachedFiles.length > 0) {
            const totalFiles = attachedFiles.length;
            const totalFileSize = attachedFiles.reduce((sum, f) => sum + f.size, 0);
            const uploaded = event.loaded;
            const totalSize = totalFileSize + finalMessage.length;
            const percentage = Math.round((uploaded / totalSize) * 100);

            if (attachedFiles[0]) {
              const fileName = totalFiles > 1
                ? `${attachedFiles[0].name} (${totalFiles} files)`
                : attachedFiles[0].name;
              setUploadProgress({
                percentage: Math.min(percentage, 95),
                fileName: fileName
              });
            }
          }
        };

        xhr.onload = async () => {
          setUploadProgress(null);

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              setAttachedFiles([]);
              onMessageSent?.(currentAgentId, { text: finalMessage });

              if (isGroupChat) {
                await loadGroupMessages(activeConversation.id);
              } else {
                await loadMessages(activeConversation.id);
              }
            } catch (e) {
              console.error("Failed to parse response:", e);
              showError(t("chat.sendFailed", { defaultValue: "Не удалось отправить сообщение" }));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              showError(errorData.detail || t("chat.uploadFailed", { defaultValue: "Ошибка загрузки" }));
            } catch (e) {
              showError(t("chat.uploadFailed", { defaultValue: "Ошибка загрузки" }));
            }
          }
          setIsLoading(false);
        };

        xhr.onerror = () => {
          setUploadProgress(null);
          showError("Upload failed. Please try again.");
          setIsLoading(false);
        };

        xhr.ontimeout = () => {
          setUploadProgress(null);
          showError("Upload failed. Please try again.");
          setIsLoading(false);
        };

        xhr.open('POST', `${apiClient.baseURL}/chat/send`);
        const token = apiClient.token;
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.timeout = 120000;
        xhr.send(formData);
      } catch (error) {
        setUploadProgress(null);
        console.error("Failed to send message with files:", error);
        showError("Failed to send message with files");
        setIsLoading(false);
      }
    } else {
      // Отправка без файлов
      try {
        // Создаем функцию-заглушку для восстановления текста только при ошибках
        // НЕ восстанавливаем текст при успешной отправке
        const handleInputRestore = (restoreText = null) => {
          // Восстанавливаем текст ТОЛЬКО если передан restoreText (это означает ошибку)
          // При успешной отправке restoreText будет null или undefined
          if (restoreText && restoreText.trim().length > 0) {
            clearInput(restoreText);
          }
          // Если restoreText пустой или null, ничего не делаем (успешная отправка)
        };

        if (isGroupChat) {
          await sendGroupMessage(activeConversation.id, finalMessage, handleInputRestore);
        } else {
          if (!currentAgentId && !activeConversation.is_system_chat) {
            setIsLoading(false);
            // Восстанавливаем текст в поле ввода, так как сообщение не было отправлено
            clearInput(finalMessage);
            return;
          }

          const agentId = activeConversation.is_system_chat ? 1 : currentAgentId;
          await sendMessage(activeConversation.id, agentId, finalMessage, handleInputRestore);
        }

        onMessageSent?.(currentAgentId, { text: finalMessage });
      } catch (error) {
        if (error.status !== 429 && !error.message?.includes("Message limit exceeded")) {
          console.error("Failed to send message:", error);
        }
      } finally {
        setIsLoading(false);
      }
    }
  }, [
    inputValue,
    activeConversation,
    replyToMessage,
    attachedFiles,
    isChannelChat,
    canWriteChannel,
    isPurchaseTrackerChat,
    isNotesChat,
    isTodoJournalChat,
    isProgressJournalChat,
    isTravelJournalChat,
    isDietitianJournalChat,
    currentPurchaseMode,
    currentNoteMode,
    currentTravelMode,
    currentDietitianMode,
    isDialogueLoading,
    isGroupChat,
    currentAgentId,
    sendMessage,
    sendGroupMessage,
    publishChannelMessage,
    loadMessages,
    loadGroupMessages,
    onMessageSent,
    showError,
    showSuccess,
    t,
    clearInput,
    forceScrollToBottom,
    needInitialScrollRef,
  ]);

  // Обработка нажатия клавиш
  const handleKeyPress = useCallback((e) => {
    if (isChannelChat && !canWriteChannel) {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [isChannelChat, canWriteChannel, handleSendMessage]);

  return {
    // State
    inputValue,
    setInputValue,
    replyToMessage,
    setReplyToMessage,
    attachedFiles,
    setAttachedFiles,
    uploadProgress,
    isDragging,
    isLoading,
    setIsLoading,

    // Handlers
    handleSendMessage,
    handleInputChange,
    handleKeyPress,
    handleFileSelect,
    handleRemoveFile,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
    clearInput,
    resetTextareaHeight,

    // Draft functions
    saveDraftMessage,
    loadDraftMessage,
    clearDraftMessage,
  };
}


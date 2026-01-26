import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSpring, animated } from "@react-spring/web";
import { useOptimizedMessageAnimations } from "../../hooks/message/useOptimizedMessageAnimations";
import { useChats } from "../../contexts/ChatsContext";
import { MessageState, AnimationType } from "../../hooks/message/useMessageState";
import { MdPictureAsPdf, MdDescription, MdTableChart, MdImage, MdCode, MdInsertDriveFile, MdDownload } from "react-icons/md";
import apiClient from "../../services/api";
import { useNotification } from "../../contexts/NotificationContext";
import { useImageModal } from "../../contexts/ImageModalContext";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * Утилита для безопасного отображения текста с HTML тегами как текста
 * Экранирует HTML теги, чтобы они отображались как текст, а не рендерились
 */
const escapeHtmlTagsForDisplay = (html) => {
  if (!html || typeof html !== "string") return "";
  
  // Декодируем HTML entities (например &amp; -> &)
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  let decoded = txt.value;
  
  // ВАЖНО: Экранируем все < и > символы, чтобы они отображались как текст
  // Это позволяет показывать HTML код (например <div>test</div>) как текст
  // React автоматически отобразит &lt; как < и &gt; как >
  return decoded
    .replace(/&lt;/g, "___LT___") // Временно заменяем уже экранированные
    .replace(/&gt;/g, "___GT___") // Временно заменяем уже экранированные
    .replace(/</g, "&lt;")         // Экранируем все <
    .replace(/>/g, "&gt;")         // Экранируем все >
    .replace(/___LT___/g, "&lt;") // Возвращаем двойное экранирование обратно
    .replace(/___GT___/g, "&gt;"); // Возвращаем двойное экранирование обратно
};

/**
 * Экранирует HTML символы в уже декодированном тексте
 * Используется когда текст уже декодирован через extractPlainText
 * и нужно экранировать теги для безопасного отображения через dangerouslySetInnerHTML
 */
const escapeHtmlInText = (text) => {
  if (!text || typeof text !== "string") return "";
  
  // Просто экранируем HTML символы в уже декодированном тексте
  // Порядок важен: сначала &, потом < и >
  return text
    .replace(/&/g, "&amp;")       // Экранируем все & (первым, чтобы не конфликтовать с другими entities)
    .replace(/</g, "&lt;")        // Экранируем все <
    .replace(/>/g, "&gt;")         // Экранируем все >
    .replace(/"/g, "&quot;")      // Экранируем все "
    .replace(/'/g, "&#039;");     // Экранируем все '
};

/**
 * Декодирует HTML entities в тексте
 * Преобразует экранированный текст (например, &lt;div&gt;test&lt;/div&gt;)
 * в обычный текст с тегами (например, <div>test</div>)
 * 
 * React автоматически экранирует HTML-теги при выводе через {text},
 * поэтому декодированные теги будут показаны как обычный текст, а не рендерятся как HTML
 */
const extractPlainText = (text) => {
  if (!text || typeof text !== "string") return "";
  
  // Декодируем HTML entities в правильном порядке
  // Важно: сначала декодируем &amp;, чтобы не конфликтовало с другими entities
  return text
    .replace(/&amp;/g, "&")    // Декодируем &amp; в &
    .replace(/&lt;/g, "<")      // Декодируем &lt; в <
    .replace(/&gt;/g, ">")      // Декодируем &gt; в >
    .replace(/&quot;/g, '"')    // Декодируем &quot; в "
    .replace(/&#039;/g, "'")    // Декодируем &#039; в '
    .replace(/&#x27;/g, "'")    // Декодируем &#x27; в '
    .trim();
};

/**
 * Компонент Reply-блока для отображения цитируемого сообщения
 */
const ReplyBlock = ({ reply, onReplyClick }) => {
  if (!reply) return null;

  // Извлекаем чистый текст из reply.text и экранируем HTML теги для отображения
  // Это нужно, потому что reply.text может содержать экранированный HTML
  // (например, &lt;div&gt;test&lt;/div&gt;), который нужно показать как обычный текст
  const decodedText = extractPlainText(reply.text || "");
  // Экранируем HTML теги, чтобы они отображались как текст, а не интерпретировались React
  // Используем escapeHtmlInText, так как текст уже декодирован через extractPlainText
  const cleanReplyText = escapeHtmlInText(decodedText);

  return (
    <div
      className="mb-1.5 rounded overflow-hidden select-none reply-block"
      data-reply-to-id={reply.messageId}
      style={{
        backgroundColor: "var(--msg-reply-bg)",
        border: "1px solid var(--msg-reply-border)",
        padding: "6px 8px",
        cursor: onReplyClick ? "pointer" : "default",
        transition: "all 0.2s ease",
      }}
      onClick={onReplyClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--msg-reply-hover-bg)";
        e.currentTarget.style.borderColor = "var(--msg-reply-hover-border)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--msg-reply-bg)";
        e.currentTarget.style.borderColor = "var(--msg-reply-border)";
      }}
    >
      <div className="flex gap-2">
        {/* Вертикальная полоса-индикатор слева */}
        <div
          className="flex-shrink-0"
          style={{
            width: "3px",
            backgroundColor: "var(--msg-reply-author-color)",
            borderRadius: "2px",
          }}
        />
        {/* Содержимое цитаты */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Имя автора - сверху, более заметное */}
          <div
            className="font-semibold mb-0.5"
            style={{
              color: "var(--msg-reply-author-color)",
              fontSize: "12px",
              lineHeight: "1.2",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {reply.authorName}
          </div>
          {/* Текст превью - снизу, менее заметное, строго одна строка */}
          <div
            style={{
              color: "var(--msg-reply-text-color)",
              fontSize: "12px",
              lineHeight: "1.3",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            dangerouslySetInnerHTML={{ __html: cleanReplyText }}
          />
        </div>
      </div>
    </div>
  );
};

export default function RightMessage({
  text,
  time,
  className = "",
  onContextMenu,
  originalChatName = null,
  originalAgentName = null,
  onOriginalChatClick = null,
  messageId = null, // ID сообщения для отслеживания состояния
  messageState = null, // Состояние сообщения
  reply = null, // Данные о цитируемом сообщении: { authorName, text, messageId }
  fileAttachments = [], // Файловые вложения
  // Новые пропсы для правого drag-выделения
  isSelected = false,
  onSelectMouseDown,
  onSelectMouseEnter,
  onSelectMouseUp,
  selectionActive = false,
  onSelectContentMouseDown,
  onReplyClick = null, // Обработчик клика по reply-блоку
}) {
  const { messageStateManager } = useChats();
  const { showError } = useNotification();
  const { openImageModal } = useImageModal();
  const [showRetryButton, setShowRetryButton] = useState(false);
  
  // Форматирование размера файла
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  // Получение иконки для типа файла
  const getFileIcon = (fileType, fileName) => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (['pdf'].includes(ext)) return <MdPictureAsPdf className="text-lg" />;
    if (['docx', 'doc', 'odt', 'rtf'].includes(ext)) return <MdDescription className="text-lg" />;
    if (['xlsx', 'csv', 'ods'].includes(ext)) return <MdTableChart className="text-lg" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return <MdImage className="text-lg" />;
    if (['py', 'js', 'ts', 'java', 'cpp', 'cs', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'toml', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'dart', 'sh', 'bash', 'zsh'].includes(ext)) return <MdCode className="text-lg" />;
    return <MdInsertDriveFile className="text-lg" />;
  };

  // Проверка, является ли файл изображением
  const isImageFile = (fileType, fileName) => {
    if (fileType && fileType.startsWith("image/")) return true;
    const ext = fileName.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext);
  };

  // Обработчик открытия изображения в модальном окне
  const handleOpenImage = (attachment) => {
    openImageModal({
      filename: attachment.filename,
      original_filename: attachment.original_filename
    });
  };

  const { t } = useLanguage();
  
  // Обработчик скачивания файла
  const handleDownloadFile = async (filename, originalFilename, e) => {
    e?.stopPropagation(); // Предотвращаем всплытие события
    try {
      await apiClient.downloadFile(filename);
    } catch (error) {
      showError(t("chat.downloadError", { error: error.message || t("chat.unknownError") }));
    }
  };

  // Функция для извлечения reply-данных из HTML текста (fallback для старых сообщений)
  const parseReplyFromText = useMemo(() => {
    if (!text || typeof text !== "string") return null;

    // Ищем блок reply - более гибкий паттерн для разных вариантов классов
    // Формат из Chat.jsx: class="reply-block mb-1.5 rounded overflow-hidden select-none"
    // Пробуем разные варианты с необязательными классами
    const replyBlockRegex1 = /<div[^>]*class="[^"]*reply-block[^"]*mb-1\.5[^"]*rounded[^"]*"[^>]*data-reply-to-id="([^"]+)"[^>]*>([\s\S]*?)<\/div><\/div><\/div>/;
    const replyBlockRegex2 = /<div[^>]*class="reply-block[^"]*"[^>]*data-reply-to-id="([^"]+)"[^>]*>([\s\S]*?)<\/div><\/div><\/div>/;
    const replyBlockRegex3 = /<div[^>]*class="mb-1\.5 rounded[^"]*"[^>]*>([\s\S]*?)<\/div><\/div><\/div>/;
    const replyBlockRegex4 = /<div[^>]*data-reply-to-id="([^"]+)"[^>]*>([\s\S]*?)<\/div><\/div><\/div>/;
    
    let match = text.match(replyBlockRegex1) || text.match(replyBlockRegex2) || 
                text.match(replyBlockRegex3) || text.match(replyBlockRegex4);

    if (!match) {
      return null;
    }

    // match[0] всегда содержит полное совпадение
    const replyContent = match[0];

    // Извлекаем ID исходного сообщения из data-атрибута (из match[1] или из самого replyContent)
    const replyToIdMatch = replyContent.match(/data-reply-to-id="([^"]+)"/);
    const replyToId = (match.length > 1 && match[1]) || (replyToIdMatch ? replyToIdMatch[1] : null);

    // Извлекаем имя автора - более гибкий паттерн
    const authorMatch = replyContent.match(
      /<div[^>]*class="[^"]*font-semibold[^"]*mb-0\.5[^"]*"[^>]*>([^<]+)<\/div>/
    ) || replyContent.match(
      /<div[^>]*class="font-semibold mb-0\.5"[^>]*>([^<]+)<\/div>/
    ) || replyContent.match(
      /font-semibold[^>]*>([^<]+)</
    );
    const authorName = authorMatch ? authorMatch[1].trim() : t("common.user");

    // Извлекаем текст - пробуем разные стили
    // В Chat.jsx используется inline style с var(--msg-reply-text-color)
    const textMatch = replyContent.match(
      /<div[^>]*style="[^"]*color:[^"]*var\(--msg-reply-text-color\)[^"]*"[^>]*>([^<]+)<\/div>/
    ) || replyContent.match(
      /<div[^>]*style="[^"]*color: rgba\(255, 255, 255, 0\.55\)[^"]*"[^>]*>([^<]+)<\/div>/
    ) || replyContent.match(
      /color: var\(--msg-reply-text-color\)[^"]*"[^>]*>([^<]+)</
    ) || replyContent.match(
      /color: rgba\(255, 255, 255, 0\.55\)[^"]*"[^>]*>([^<]+)</
    );
    let replyText = textMatch ? textMatch[1].trim() : "";
    
    // Извлекаем чистый текст из извлечённого текста (может содержать HTML entities)
    replyText = extractPlainText(replyText);

    return replyText
      ? { authorName, text: replyText, messageId: replyToId }
      : null;
  }, [text]);

  // Используем reply из пропсов или извлекаем из текста (для обратной совместимости)
  const actualReply = reply || parseReplyFromText;

  // Очищаем текст от HTML тегов и reply-блоков
  const cleanText = useMemo(() => {
    if (!text || typeof text !== "string") return "";
    
    let processedText = text;
    
    // Убираем reply-блок, если он есть в тексте
    if (actualReply) {
      // Используем DOM-парсер для более надежного удаления reply-блока
      try {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = processedText;
        
        // Находим reply-блок по data-reply-to-id или классу
        const replyBlock = tempDiv.querySelector('[data-reply-to-id], .reply-block, [class*="reply-block"]');
        if (replyBlock) {
          replyBlock.remove();
          processedText = tempDiv.innerHTML;
        }
      } catch (e) {
        // Fallback: используем regex, если DOM-парсинг не сработал
        // Удаляем reply-блок с разными вариантами структуры
        const patterns = [
          // Полная структура с data-reply-to-id
          /<div[^>]*data-reply-to-id="[^"]*"[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
          // С reply-block классом и mb-1.5 rounded
          /<div[^>]*class="[^"]*reply-block[^"]*mb-1\.5[^"]*rounded[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
          // Просто reply-block
          /<div[^>]*class="reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
          // Старый формат
          /<div[^>]*class="mb-1\.5 rounded[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
        ];
        
        patterns.forEach(pattern => {
          processedText = processedText.replace(pattern, "");
        });
      }
      
      // Дополнительная очистка: удаляем любые оставшиеся закрывающие теги в начале
      processedText = processedText.trim().replace(/^<\/div>\s*/i, "");
      processedText = processedText.trim().replace(/^<\/div>\s*<\/div>\s*/i, "");
      processedText = processedText.trim().replace(/^<\/div>\s*<\/div>\s*<\/div>\s*/i, "");
    }
    
    // Экранируем HTML теги, чтобы они отображались как текст
    return escapeHtmlTagsForDisplay(processedText);
  }, [text, actualReply]);

  // Получаем оптимизированные анимации
  const {
    slideInAnimation,
    hoverAnimation,
    errorAnimation,
    triggerSlideIn,
    triggerHover,
    triggerError,
    stopError,
    isReducedMotion,
    shouldDisableAnimation,
  } = useOptimizedMessageAnimations();

  // Мемоизируем состояние сообщения для предотвращения ненужных перерендеров
  const currentMessageState = useMemo(() => {
    // Для системного чата используем только переданное состояние
    if (messageState) {
      return messageState;
    }

    // Для обычных чатов получаем состояние из менеджера
    if (messageId && messageStateManager) {
      return messageStateManager.getMessageState(messageId);
    }

    return null;
  }, [messageState, messageId, messageStateManager]);

  // Мемоизируем стили состояния
  const stateStyles = useMemo(() => {
    if (!currentMessageState) return {};

    switch (currentMessageState.state) {
      case MessageState.SENDING:
        return {
          opacity: 0.7,
          transform: "scale(0.95)",
        };
      case MessageState.ERROR:
        return {
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
        };
      case MessageState.RETRYING:
        return {
          opacity: 0.8,
          backgroundColor: "hsla(var(--accent-hsl) / 0.12)",
        };
      default:
        return {};
    }
  }, [currentMessageState?.state]);

  // Используем оптимизированные анимации из хука
  const slideInProps = slideInAnimation;
  const errorProps = errorAnimation;

  // Обработка ретрая
  // Мемоизируем обработчики событий
  const handleRetry = useCallback(() => {
    if (messageId && messageStateManager.retryMessage(messageId)) {
      setShowRetryButton(false);
    }
  }, [messageId, messageStateManager]);

  // Обработка очистки ошибки
  const handleClearError = useCallback(() => {
    if (messageId) {
      messageStateManager.clearError(messageId);
      setShowRetryButton(false);
    }
  }, [messageId, messageStateManager]);

  // Показываем кнопку ретрая при ошибке
  useEffect(() => {
    if (currentMessageState?.state === MessageState.ERROR) {
      setShowRetryButton(true);
    } else {
      setShowRetryButton(false);
    }
  }, [currentMessageState?.state]);

  // Мемоизируем текст состояния
  const stateText = useMemo(() => {
    if (!currentMessageState) return null;

    switch (currentMessageState.state) {
      case MessageState.SENDING:
        return t("chat.sending");
      case MessageState.ERROR:
        return t("chat.sendError");
      case MessageState.RETRYING:
        return t("chat.retrying");
      default:
        return null;
    }
  }, [currentMessageState?.state, t]);

  return (
    <animated.div
      className={`w-full flex justify-end my-2 message-container ${className}`}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "flex-end",
        margin: "8px 0",
        ...slideInProps,
      }}
      data-message-id={messageId}
      onMouseDown={onSelectMouseDown}
      onMouseEnter={onSelectMouseEnter}
      onMouseUp={onSelectMouseUp}
    >
      <animated.div
        className="text-white rounded-lg rounded-br-none p-2 relative message-content message-hover"
        style={{
          backgroundColor: "var(--msg-out-bg)",
          maxWidth: "70%",
          width: "max-content",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)",
          ...stateStyles,
          ...(currentMessageState?.state === MessageState.ERROR
            ? errorProps
            : {}),
          // Блокируем выделение текста, когда активен режим выделения
          userSelect: selectionActive ? 'none' : 'auto',
          WebkitUserSelect: selectionActive ? 'none' : 'auto',
        }}
        onMouseDown={(e) => {
          if (selectionActive && onSelectContentMouseDown) {
            onSelectContentMouseDown(e);
          } else {
            // разрешаем выделение текста
          }
        }}
        onContextMenu={onContextMenu}
      >
        {/* Название оригинального чата для сохраненных сообщений */}
        {originalChatName && (
          <div
            className="text-xs mb-1 select-none"
            style={{
              color: "var(--msg-forwarded-chat-color)",
              fontStyle: "italic",
              cursor: onOriginalChatClick ? "pointer" : "default",
              display: "inline-block",
              width: "fit-content",
            }}
            onClick={() => {
              if (onOriginalChatClick) {
                onOriginalChatClick(originalChatName, originalAgentName);
              }
            }}
          >
            {originalChatName}
          </div>
        )}

        {/* Блок цитаты (reply) - теперь отдельный React-компонент */}
        <ReplyBlock reply={actualReply} onReplyClick={onReplyClick} />

        {/* Файловые вложения */}
        {fileAttachments && fileAttachments.length > 0 && (
          <div className="mt-2 mb-2 flex flex-col gap-2">
            {fileAttachments.map((attachment) => {
              const isImage = isImageFile(attachment.file_type, attachment.original_filename);
              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                  onClick={() => {
                    if (isImage) {
                      handleOpenImage(attachment);
                    } else {
                      handleDownloadFile(attachment.filename, attachment.original_filename);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isImage) {
                        handleOpenImage(attachment);
                      } else {
                        handleDownloadFile(attachment.filename, attachment.original_filename);
                      }
                    }
                  }}
                  aria-label={isImage ? `View ${attachment.original_filename}` : `Download ${attachment.original_filename}`}
                >
                  <span className="flex-shrink-0 text-[var(--text-white)]">
                    {getFileIcon(attachment.file_type, attachment.original_filename)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[var(--text-white)] truncate" title={attachment.original_filename}>
                      {attachment.original_filename}
                    </div>
                    <div className="text-[10px] text-[var(--text-gray)]">
                      {formatFileSize(attachment.file_size)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDownloadFile(attachment.filename, attachment.original_filename, e)}
                    className="flex items-center justify-center p-2 text-[var(--text-gray)] hover:text-[var(--text-white)] hover:bg-[var(--bg-tertiary)] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
                    aria-label={`Download ${attachment.original_filename}`}
                    title={t("chat.downloadFile")}
                  >
                    <MdDownload className="text-lg" />
                  </button>
                </div>
              );
            })}
          </div>
        )}


        {/* Основной текст сообщения - рендерится как обычный текст без HTML */}
        <div className="block message-text-wrapper">
          <span
            style={{
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
            }}
            dangerouslySetInnerHTML={{ __html: cleanText }}
          />
          <span
            className="message-time"
            style={{
              fontSize: "0.75rem",
              color: "var(--msg-right-time-color)",
              fontWeight: "500",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
            }}
          >
            {time}
          </span>
        </div>

        {/* Индикатор состояния */}
        {stateText && (
          <div
            className="text-xs mt-1 flex items-center justify-between"
            style={{
              color:
                currentMessageState?.state === MessageState.ERROR
                  ? "hsl(var(--destructive))"
                  : "var(--text-dim)",
              fontStyle: "italic",
            }}
          >
            <span>{stateText}</span>
            {showRetryButton && (
              <button
                onClick={handleRetry}
                className="ml-2 px-2 py-1 text-xs bg-[var(--destructive)] hover:bg-[var(--destructive)]/90 text-white rounded transition-colors"
                style={{ fontSize: "10px" }}
              >
                {t("chat.retry")}
              </button>
            )}
          </div>
        )}

        {/* Индикатор анимации */}
        {currentMessageState?.isAnimating && !isReducedMotion && (
          <div
            className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse"
            style={{ animation: "pulse 1s infinite" }}
          />
        )}
      </animated.div>
    </animated.div>
  );
}

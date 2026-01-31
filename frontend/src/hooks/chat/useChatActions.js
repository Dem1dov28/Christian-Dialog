import { useCallback } from "react";
import apiClient from "../../services/api";

/**
 * Хук для управления действиями с сообщениями в чате
 * Включает сохранение, удаление, копирование, ответ, жалобу и другие действия
 */
export function useChatActions({
  activeConversation,
  messages,
  chatTitle,
  systemChat,
  loadMessages,
  updateMessagesForConversation,
  deleteMessage,
  showError,
  showSuccess,
  t,
  isAuthenticated,
}) {
  // Универсальная функция копирования текста в буфер обмена с fallback
  const copyToClipboard = useCallback(
    async (textToCopy) => {
      if (!textToCopy || typeof textToCopy !== "string") {
        return false;
      }

      // Сначала пробуем современный Clipboard API
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textToCopy);
          return true;
        }
      } catch (error) {
        console.warn("[Clipboard] navigator.clipboard.writeText failed:", error);
        // Переходим к fallback ниже
      }

      // Fallback: document.execCommand("copy") через скрытый textarea
      try {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        textarea.style.left = "-1000px";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!successful) {
          throw new Error("document.execCommand('copy') returned false");
        }
        return true;
      } catch (error) {
        console.error("[Clipboard] Fallback copy failed:", error);
      }

      // Последний fallback: показываем пользователю диалог с текстом для ручного копирования
      try {
        if (typeof window !== "undefined" && window.prompt) {
          window.prompt(
            t("chat.manualCopyPrompt", {
              defaultValue: "Скопируйте текст сообщения и нажмите Ctrl+C / ⌘C:",
            }),
            textToCopy
          );
          // Считаем, что пользователь получил текст для копирования
          return true;
        }
      } catch (error) {
        console.error("[Clipboard] Manual copy prompt failed:", error);
      }

      return false;
    },
    [t]
  );
  // Сохранение сообщения в Saved Messages
  const handleSave = useCallback(
    async (messageId, { silent = false } = {}) => {
      if (!isAuthenticated) {
        showError(t("chat.needLogin", { defaultValue: "Необходима авторизация" }));
        return;
      }

      if (!activeConversation) {
        showError(t("chat.noActiveChat", { defaultValue: "Нет активного чата" }));
        return;
      }

      try {
        const message = messages.find((msg) => msg.id === messageId);
        if (!message) {
          showError(t("chat.messageNotFound", { defaultValue: "Сообщение не найдено" }));
          return;
        }

        const chatName = chatTitle;
        const agentName = message.agentName || null;

        const saveData = {
          original_message_id: messageId,
          original_chat_id: activeConversation.id,
          original_chat_name: chatName,
          original_agent_name: agentName,
          is_from_user: message.is_from_user,
        };

        const savedMessage = await apiClient.saveMessageToSavedMessages(saveData);

        if (systemChat?.id && savedMessage && updateMessagesForConversation) {
          try {
            // Мягко обновляем локальное состояние Saved Messages, добавляя сохраненное сообщение
            // вместо полной перезагрузки через loadMessages
            updateMessagesForConversation(systemChat.id, (prev) => {
              // Проверяем, нет ли уже такого сообщения (на случай гонки или дублей)
              if (prev.some(msg => msg.id === savedMessage.id)) return prev;
              return [...prev, savedMessage];
            });
          } catch (error) {
            console.error("Failed to optimistically update Saved Messages after save:", error);
          }
        }

        if (!silent) {
          showSuccess(t("chat.messageSaved", { defaultValue: "Сообщение сохранено" }));
        }
        return savedMessage;
      } catch (error) {
        if (silent) {
          console.error("Failed to save message:", error);
        } else {
          showError(
            error?.response?.data?.detail ||
            t("chat.saveError", { defaultValue: "Не удалось сохранить сообщение" })
          );
        }
        return false;
      }
    },
    [
      isAuthenticated,
      activeConversation,
      messages,
      chatTitle,
      systemChat,
      loadMessages,
      updateMessagesForConversation,
      showError,
      showSuccess,
      t,
    ]
  );

  // Удаление сообщения
  const handleDelete = useCallback(
    async (messageId) => {
      if (!activeConversation) {
        showError(t("chat.noActiveChat", { defaultValue: "Нет активного чата" }));
        return;
      }

      try {
        await deleteMessage(messageId);
        showSuccess(t("chat.messageDeleted", { defaultValue: "Сообщение удалено" }));
      } catch (error) {
        console.error("Failed to delete message:", error);
        showError(
          error?.response?.data?.detail ||
          t("chat.deleteError", { defaultValue: "Не удалось удалить сообщение" })
        );
      }
    },
    [activeConversation, deleteMessage, showError, showSuccess, t]
  );

  // Копирование сообщения
  const handleCopy = useCallback(
    async (messageId) => {
      try {
        const message = messages.find((msg) => msg.id === messageId);
        if (!message) {
          showError(
            t("chat.messageNotFound", {
              defaultValue: "Сообщение не найдено",
            })
          );
          return;
        }

        // Берём текст сообщения из полей text/content (в зависимости от формата сообщений)
        // visibleMessages из useProcessedMessages используют поле text
        let textToCopy =
          (typeof message.text === "string" && message.text) ||
          (typeof message.content === "string" && message.content) ||
          "";

        // Создаем временный элемент для извлечения текста из HTML
        if (textToCopy.includes("<")) {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = textToCopy;
          textToCopy = tempDiv.textContent || tempDiv.innerText || "";
        }

        if (!textToCopy || typeof textToCopy !== "string") {
          showError(
            t("chat.noTextToCopy", {
              defaultValue: "Нет текста для копирования",
            })
          );
          return;
        }

        const ok = await copyToClipboard(textToCopy);
        if (!ok) {
          showError(
            t("chat.copyError", {
              defaultValue: "Не удалось скопировать сообщение",
            })
          );
          return;
        }

        showSuccess(
          t("chat.messageCopied", {
            defaultValue: "Сообщение скопировано",
          })
        );
      } catch (error) {
        console.error("Failed to copy message:", error);
        showError(
          t("chat.copyError", {
            defaultValue: "Не удалось скопировать сообщение",
          })
        );
      }
    },
    [messages, copyToClipboard, showError, showSuccess, t]
  );

  // Массовое копирование сообщений
  const handleBulkCopy = useCallback(
    async (selectedMessagesSet) => {
      try {
        const selectedIds = Array.from(selectedMessagesSet);
        const selectedMessages = messages
          .filter((msg) => selectedIds.includes(msg.id))
          .sort((a, b) => a.id - b.id);

        if (selectedMessages.length === 0) {
          showError(t("chat.noMessagesSelected", { defaultValue: "Нет выбранных сообщений" }));
          return;
        }

        let textToCopy = "";

        selectedMessages.forEach((message, index) => {
          let messageText =
            (typeof message.text === "string" && message.text) ||
            (typeof message.content === "string" && message.content) ||
            "";

          if (messageText.includes("<")) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = messageText;
            messageText = tempDiv.textContent || tempDiv.innerText || "";
          }

          const author = message.is_from_user
            ? t("chat.you", { defaultValue: "Вы" })
            : message.agentName || t("chat.agent", { defaultValue: "Агент" });

          textToCopy += `${author}: ${messageText}`;
          if (index < selectedMessages.length - 1) {
            textToCopy += "\n\n";
          }
        });

        if (!textToCopy || typeof textToCopy !== "string") {
          showError(
            t("chat.noTextToCopy", {
              defaultValue: "Нет текста для копирования",
            })
          );
          return;
        }

        const ok = await copyToClipboard(textToCopy);
        if (!ok) {
          showError(
            t("chat.copyError", {
              defaultValue: "Не удалось скопировать сообщения",
            })
          );
          return;
        }

        showSuccess(
          t("chat.messagesCopied", {
            count: selectedMessages.length,
            defaultValue: `Скопировано ${selectedMessages.length} сообщений`,
          })
        );
      } catch (error) {
        console.error("Failed to copy messages:", error);
        showError(t("chat.copyError", { defaultValue: "Не удалось скопировать сообщения" }));
      }
    },
    [messages, copyToClipboard, showError, showSuccess, t]
  );

  // Массовое удаление сообщений
  const handleBulkDelete = useCallback(
    async (selectedMessagesSet, clearSelection) => {
      try {
        const selectedIds = Array.from(selectedMessagesSet);

        if (selectedIds.length === 0) {
          showError(t("chat.noMessagesSelected", { defaultValue: "Нет выбранных сообщений" }));
          return;
        }

        // Удаляем все выбранные сообщения
        const deletePromises = selectedIds.map((id) => deleteMessage(id));
        await Promise.all(deletePromises);

        clearSelection();
        showSuccess(
          t("chat.messagesDeleted", {
            count: selectedIds.length,
            defaultValue: `Удалено ${selectedIds.length} сообщений`,
          })
        );
      } catch (error) {
        console.error("Failed to delete messages:", error);
        showError(t("chat.deleteError", { defaultValue: "Не удалось удалить сообщения" }));
      }
    },
    [deleteMessage, showError, showSuccess, t]
  );

  // Отправка жалобы
  const handleReport = useCallback(
    async (messageId, reportText) => {
      try {
        // Отправляем жалобу через API
        await apiClient.createReport({
          message_id: messageId,
          text: reportText,
          chat_id: activeConversation?.id,
        });

        showSuccess(t("chat.complaintSent", { defaultValue: "Жалоба отправлена" }));
      } catch (error) {
        console.error("Failed to send report:", error);
        showError(t("chat.complaintError", { defaultValue: "Не удалось отправить жалобу" }));
      }
    },
    [activeConversation?.id, showError, showSuccess, t]
  );

  return {
    handleSave,
    handleDelete,
    handleCopy,
    handleBulkCopy,
    handleBulkDelete,
    handleReport,
  };
}


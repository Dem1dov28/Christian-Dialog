import { useState, useEffect, useMemo } from "react";

/**
 * Хук для управления циклическими промптами для пустого состояния чата
 */
export function useCyclingPrompts({
  language,
  EMPTY_CHAT_PROMPTS,
  activeConversation,
}) {
  // Определяем promptsByLanguage перед использованием
  const promptsByLanguage = useMemo(() => {
    const langKey = language && EMPTY_CHAT_PROMPTS[language] ? language : "ru";
    return EMPTY_CHAT_PROMPTS[langKey] || [];
  }, [language, EMPTY_CHAT_PROMPTS]);

  // Определяем cyclingPromptIndex перед использованием
  const [cyclingPromptIndex, setCyclingPromptIndex] = useState(() => {
    if (!promptsByLanguage.length) return 0;
    return Math.floor(Math.random() * promptsByLanguage.length);
  });

  useEffect(() => {
    if (!promptsByLanguage.length) return;
    setCyclingPromptIndex(
      Math.floor(Math.random() * promptsByLanguage.length)
    );
  }, [promptsByLanguage, activeConversation?.id]);

  useEffect(() => {
    if (!promptsByLanguage.length) return undefined;
    const interval = setInterval(() => {
      setCyclingPromptIndex((prev) => {
        if (promptsByLanguage.length <= 1) {
          return prev;
        }
        let next = Math.floor(Math.random() * promptsByLanguage.length);
        if (next === prev) {
          next = (next + 1) % promptsByLanguage.length;
        }
        return next;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [promptsByLanguage]);

  const cyclingPrompt =
    promptsByLanguage[cyclingPromptIndex] ||
    (language === "ru"
      ? "Начните новый диалог — чат ждёт ваше сообщение."
      : "Start a new dialogue—the chat is waiting for your message.");

  return {
    promptsByLanguage,
    cyclingPromptIndex,
    setCyclingPromptIndex,
    cyclingPrompt,
  };
}


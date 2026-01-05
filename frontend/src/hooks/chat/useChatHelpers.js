import { useCallback } from "react";

/**
 * Хук для простых вспомогательных обработчиков чата
 */
export function useChatHelpers({
  setIsDialogueLoading,
  setIsLoading,
  // УДАЛЕНО - все параметры для удаленных инструментов
}) {
  // Обработчик отмены генерации
  const handleCancelGeneration = useCallback(() => {
    setIsDialogueLoading(false);
    setIsLoading(false);
  }, [setIsDialogueLoading, setIsLoading]);

  // УДАЛЕНО - handlePurchaseModeToggleWithTodos (инструменты были удалены)

  return {
    handleCancelGeneration,
    // УДАЛЕНО - handlePurchaseModeToggleWithTodos
  };
}


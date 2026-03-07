import { useCallback } from "react";

/**
 * Хук для управления панелями приложения (профиль)
 */
export function usePanelHandlers({
  setIsProfileVisible,
}) {
  const openProfile = useCallback(() => {
    setIsProfileVisible(true);
  }, [setIsProfileVisible]);

  const closeProfile = useCallback(() => {
    setIsProfileVisible(false);
  }, [setIsProfileVisible]);

  return {
    openProfile,
    closeProfile,
  };
}


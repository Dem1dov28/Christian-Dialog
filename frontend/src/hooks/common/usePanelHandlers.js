import { useCallback } from "react";

/**
 * Хук для управления панелями приложения (правая панель, профиль, настройки ИИ)
 */
export function usePanelHandlers({
  isRightPanelVisible,
  setIsRightPanelVisible,
  setIsProfileVisible,
  setIsAISettingsVisible,
  rightPanelRef,
}) {
  const toggleRightPanel = useCallback(() => {
    if (isRightPanelVisible) {
      // Если панель открыта, закрываем с анимацией через ref
      if (rightPanelRef.current?.close) {
        rightPanelRef.current.close();
      } else {
        setIsRightPanelVisible(false);
      }
    } else {
      setIsRightPanelVisible(true);
    }
  }, [isRightPanelVisible, setIsRightPanelVisible, rightPanelRef]);

  const closeRightPanel = useCallback(() => {
    // Эта функция вызывается из RightPanel.handleClose после завершения анимации
    setIsRightPanelVisible(false);
  }, [setIsRightPanelVisible]);

  const closeRightPanelWithAnimation = useCallback(() => {
    // Закрываем с анимацией через ref, если доступно
    if (rightPanelRef.current?.close) {
      rightPanelRef.current.close();
    } else {
      setIsRightPanelVisible(false);
    }
  }, [setIsRightPanelVisible, rightPanelRef]);

  const openProfile = useCallback(() => {
    setIsProfileVisible(true);
    closeRightPanelWithAnimation();
    setIsAISettingsVisible(false);
  }, [setIsProfileVisible, setIsAISettingsVisible, closeRightPanelWithAnimation]);

  const closeProfile = useCallback(() => {
    setIsProfileVisible(false);
  }, [setIsProfileVisible]);

  const openAISettings = useCallback(() => {
    setIsAISettingsVisible(true);
    setIsProfileVisible(false);
    closeRightPanelWithAnimation();
  }, [setIsAISettingsVisible, setIsProfileVisible, closeRightPanelWithAnimation]);

  const closeAISettings = useCallback(() => {
    setIsAISettingsVisible(false);
  }, [setIsAISettingsVisible]);

  return {
    toggleRightPanel,
    closeRightPanel,
    closeRightPanelWithAnimation,
    openProfile,
    closeProfile,
    openAISettings,
    closeAISettings,
  };
}


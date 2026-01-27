import { useCallback } from "react";

/**
 * Хук для управления панелями приложения (правая панель, профиль)
 */
export function usePanelHandlers({
  isRightPanelVisible,
  setIsRightPanelVisible,
  setIsProfileVisible,
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
  }, [setIsProfileVisible, closeRightPanelWithAnimation]);

  const closeProfile = useCallback(() => {
    setIsProfileVisible(false);
  }, [setIsProfileVisible]);


  return {
    toggleRightPanel,
    closeRightPanel,
    closeRightPanelWithAnimation,
    openProfile,
    closeProfile,
  };
}


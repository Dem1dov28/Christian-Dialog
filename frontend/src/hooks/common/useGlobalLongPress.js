import { useEffect } from 'react';

/**
 * Глобальный обработчик long press для мобильных устройств
 * Автоматически эмулирует onContextMenu через long press (1000ms)
 * Работает для всех элементов с onContextMenu
 */
export function useGlobalLongPress() {
  useEffect(() => {
    const longPressTimers = new Map(); // element -> timer
    const touchStarts = new Map(); // element -> { x, y, time }

    const handleTouchStart = (e) => {
      // Используем элемент, где произошёл touchstart
      // React автоматически найдёт обработчик onContextMenu через свою систему событий
      const element = e.target;
      
      if (!element || element === document.body || element === document.documentElement) {
        return;
      }

      const touch = e.touches[0];
      touchStarts.set(element, {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      });

      // Запускаем таймер на 1000ms (1 секунда)
      const timer = setTimeout(() => {
        const startData = touchStarts.get(element);
        if (!startData) return;

        // Диспатчим нативное событие contextmenu
        // React автоматически найдёт и вызовет обработчик onContextMenu
        try {
          const contextMenuEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: startData.x,
            clientY: startData.y,
            button: 2,
            buttons: 2,
            view: window,
          });
          
          // Диспатчим событие на элемент
          // React перехватит его и вызовет соответствующий обработчик
          element.dispatchEvent(contextMenuEvent);
        } catch (err) {
          console.error('Error dispatching contextmenu event:', err);
        }

        // Очищаем
        longPressTimers.delete(element);
        touchStarts.delete(element);
      }, 1000);

      longPressTimers.set(element, timer);
    };

    const handleTouchMove = (e) => {
      // Используем тот же элемент, что и при touchstart
      // Находим активный таймер по любому элементу в цепочке
      let element = e.target;
      while (element && element !== document.body) {
        if (touchStarts.has(element)) {
          break;
        }
        element = element.parentElement;
      }
      
      if (!element || !touchStarts.has(element)) return;

      const startData = touchStarts.get(element);
      if (!startData) return;

      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startData.x);
      const dy = Math.abs(touch.clientY - startData.y);

      // Если сдвинулись больше чем на 10px - отменяем long press
      if (dx > 10 || dy > 10) {
        const timer = longPressTimers.get(element);
        if (timer) {
          clearTimeout(timer);
          longPressTimers.delete(element);
          touchStarts.delete(element);
        }
      }
    };

    const handleTouchEnd = (e) => {
      // Находим элемент с активным таймером
      let element = e.target;
      while (element && element !== document.body) {
        if (touchStarts.has(element)) {
          break;
        }
        element = element.parentElement;
      }
      
      if (!element || !touchStarts.has(element)) return;

      const timer = longPressTimers.get(element);
      if (timer) {
        clearTimeout(timer);
        longPressTimers.delete(element);
        touchStarts.delete(element);
      }
    };

    const handleTouchCancel = (e) => {
      // Находим элемент с активным таймером
      let element = e.target;
      while (element && element !== document.body) {
        if (touchStarts.has(element)) {
          break;
        }
        element = element.parentElement;
      }
      
      if (!element || !touchStarts.has(element)) return;

      const timer = longPressTimers.get(element);
      if (timer) {
        clearTimeout(timer);
        longPressTimers.delete(element);
        touchStarts.delete(element);
      }
    };

    // Добавляем обработчики на document с capture фазой для раннего перехвата
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true, capture: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      document.removeEventListener('touchmove', handleTouchMove, { capture: true });
      document.removeEventListener('touchend', handleTouchEnd, { capture: true });
      document.removeEventListener('touchcancel', handleTouchCancel, { capture: true });
      
      // Очищаем все таймеры
      longPressTimers.forEach(timer => clearTimeout(timer));
      longPressTimers.clear();
      touchStarts.clear();
    };
  }, []);
}


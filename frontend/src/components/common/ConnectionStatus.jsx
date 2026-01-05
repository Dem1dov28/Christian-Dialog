import React, { useState, useEffect } from "react";

const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Проверяем статус при загрузке
    if (!navigator.onLine) {
      setShowOfflineMessage(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOnline && showOfflineMessage) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center py-2 px-4 z-50">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">
            Работа в офлайн режиме. Некоторые функции могут быть недоступны.
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default ConnectionStatus;

import React, { createContext, useContext, useState } from 'react';
import Notification from '../components/ui/notification';
import { useLanguage } from './LanguageContext';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const { t } = useLanguage();

  const addNotification = (notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: 'success',
      duration: 3000,
      ...notification
    };
    
    setNotifications(prev => [...prev, newNotification]);
    return id;
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const showSuccess = (message, title = null) => {
    return addNotification({ 
      type: 'success', 
      title: title || t("common.success"), 
      message 
    });
  };

  const showError = (message, title = null) => {
    return addNotification({ 
      type: 'error', 
      title: title || t("common.error"), 
      message 
    });
  };

  const showInfo = (message, title = null) => {
    return addNotification({ 
      type: 'info', 
      title: title || t("common.info"), 
      message 
    });
  };

  const value = {
    addNotification,
    removeNotification,
    showSuccess,
    showError,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* Рендерим уведомления */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
        {notifications.map(notification => (
          <div key={notification.id} className="pointer-events-auto" style={{ maxWidth: '24rem', width: '100%' }}>
            <Notification
              {...notification}
              onClose={removeNotification}
            />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

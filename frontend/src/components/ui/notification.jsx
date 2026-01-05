import React, { useEffect, useState, useRef } from 'react';
import { BiCheckCircle, BiError, BiInfoCircle } from 'react-icons/bi';

const Notification = ({ 
  id, 
  type = 'success', 
  title, 
  message, 
  duration = 3000, 
  onClose 
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isShown, setIsShown] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);

  // Анимация появления
  useEffect(() => {
    setIsRendered(true);
    // Двойной requestAnimationFrame для гарантии, что элемент отрендерен в начальном состоянии перед анимацией
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsShown(true);
      });
    });
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsShown(false);
    setIsClosing(true);
    setTimeout(() => {
      setIsRendered(false);
      onClose?.(id);
    }, 300); // Время для анимации исчезновения
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <BiCheckCircle className="text-green-500 text-xl" />;
      case 'error':
        return <BiError className="text-red-500 text-xl" />;
      case 'info':
        return <BiInfoCircle className="text-purple-500 text-xl" />;
      default:
        return <BiInfoCircle className="text-purple-500 text-xl" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'info':
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  if (!isRendered) return null;

  return (
    <div
      className={`
        max-w-sm w-full
        ${getBgColor()}
        border rounded-lg shadow-lg p-4
        ${isClosing ? 'notification-slide-out' : isShown ? 'notification-slide-in' : ''}
      `}
      style={{
        transform: (!isShown && !isClosing) ? 'translateX(100%)' : undefined,
        opacity: (!isShown && !isClosing) ? 0 : undefined,
      }}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              {title}
            </div>
          )}
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {message}
          </div>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
        >
          <BiError className="text-lg" />
        </button>
      </div>
    </div>
  );
};

export default Notification;

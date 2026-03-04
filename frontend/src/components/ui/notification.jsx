import React, { useEffect, useState, useRef } from 'react';
import { BiCheckCircle, BiError, BiX } from 'react-icons/bi';

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

  useEffect(() => {
    setIsRendered(true);
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
    }, 300);
  };

  const getIconStyle = () => {
    switch (type) {
      case 'success':
        return { color: 'var(--accent)' };
      case 'error':
        return { color: 'var(--badge-red, #ef4444)' };
      case 'info':
      default:
        return { color: 'var(--accent)' };
    }
  };

  const getBgStyle = () => {
    switch (type) {
      case 'success':
        return { background: 'var(--bg-secondary)', borderColor: 'var(--accent)', borderWidth: '1px', borderStyle: 'solid' };
      case 'error':
        return { background: 'var(--bg-secondary)', borderColor: 'var(--badge-red, #ef4444)', borderWidth: '1px', borderStyle: 'solid' };
      case 'info':
      default:
        return { background: 'var(--bg-secondary)', borderColor: 'var(--accent)', borderWidth: '1px', borderStyle: 'solid' };
    }
  };

  if (!isRendered) return null;

  return (
    <div
      className={`
        max-w-sm w-full rounded-lg shadow-lg p-4
        ${isClosing ? 'notification-slide-out' : isShown ? 'notification-slide-in' : ''}
      `}
      style={{
        ...getBgStyle(),
        transform: (!isShown && !isClosing) ? 'translateX(100%)' : undefined,
        opacity: (!isShown && !isClosing) ? 0 : undefined,
      }}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3" style={getIconStyle()}>
          {type === 'error' ? <BiError className="text-xl" /> : <BiCheckCircle className="text-xl" />}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-white)' }}>
              {title}
            </div>
          )}
          <div className="text-sm" style={{ color: 'var(--text-gray)' }}>
            {message}
          </div>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 ml-2 transition-colors duration-200 notification-close-btn"
        >
          <BiX className="text-lg" />
        </button>
      </div>
    </div>
  );
};

export default Notification;

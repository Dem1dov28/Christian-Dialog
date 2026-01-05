import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import apiClient from "../../services/api";

/**
 * Модальное окно для просмотра изображений
 * 
 * @param {boolean} isOpen - Открыто ли модальное окно
 * @param {Object} image - Данные изображения { filename, original_filename, displayName } или { imageUrl, displayName }
 * @param {Function} onClose - Функция закрытия модального окна
 */
export default function ImageModal({ isOpen, image, onClose }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const closingRef = useRef(false);
  const modalRef = useRef(null);

  // Загрузка изображения
  useEffect(() => {
    if (!isOpen || !image) {
      setImageUrl(null);
      return;
    }

    // Если передан прямой URL изображения, используем его
    if (image.imageUrl) {
      setImageUrl(image.imageUrl);
      setIsLoading(false);
      return;
    }

    // Если передан filename, загружаем через API
    if (image.filename) {
      setIsLoading(true);
      const loadImage = async () => {
        try {
          const url = `${apiClient.baseURL}/api/files/${encodeURIComponent(image.filename)}`;
          const headers = {};
          if (apiClient.token) {
            headers["Authorization"] = `Bearer ${apiClient.token}`;
          }

          const response = await fetch(url, { headers });
          if (!response.ok) throw new Error("Failed to load image");

          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          setImageUrl(blobUrl);
          setIsLoading(false);
        } catch (error) {
          console.error("Error loading image:", error);
          setIsLoading(false);
          // Ошибка будет видна через состояние loading
        }
      };

      loadImage();
    }
  }, [isOpen, image]);

  // Очистка blob URL при закрытии или размонтировании
  useEffect(() => {
    return () => {
      if (imageUrl) {
        window.URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsShown(false);
    setTimeout(() => {
      setIsRendered(false);
      onClose();
    }, 300); // Длительность анимации
  };

  const handleTransitionEnd = (e) => {
    // Срабатывает только на модальном окне, не на backdrop
    if (e.target === modalRef.current && !isShown && closingRef.current) {
      // Дополнительная проверка на случай, если timeout уже сработал
    }
  };

  // Анимация появления/исчезновения модального окна
  useEffect(() => {
    if (isOpen) {
      closingRef.current = false;
      setIsRendered(true);
      requestAnimationFrame(() => setIsShown(true));
    } else if (isRendered) {
      setIsShown(false);
    }
  }, [isOpen, isRendered]);

  // Закрытие по Escape
  useEffect(() => {
    if (!isRendered) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isRendered]);

  if (!isRendered || !image) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-hidden ${
        isShown ? "ai-panel-backdrop" : "ai-panel-backdrop-closing"
      }`}
      style={{ paddingTop: '120px', paddingBottom: '20px' }}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
    >
      <div
        ref={modalRef}
        onTransitionEnd={handleTransitionEnd}
        className={`bg-transparent backdrop-blur-md rounded-lg sm:rounded-xl shadow-2xl relative flex flex-col ${
          isShown ? "ai-panel-modal-fade-in" : "ai-panel-modal-fade-out"
        }`}
        style={{ 
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: 'clamp(4px, 1vw, 12px)',
          // Ограничиваем контейнер размерами viewport с учетом padding overlay
          // p-2 = 0.5rem (8px), sm:p-4 = 1rem (16px), md:p-6 = 1.5rem (24px)
          maxWidth: 'calc(100vw - 1rem)',
          maxHeight: 'calc(100vh - 160px)',
          width: 'min-content',
          height: 'min-content',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Контейнер для изображения */}
        <div className="flex items-center justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center min-w-[200px] min-h-[200px] sm:w-64 sm:h-64">
              <div className="text-sm sm:text-base" style={{ color: 'rgba(255, 255, 255, 0.96)' }}>Загрузка...</div>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={image.displayName || image.original_filename || 'Изображение'}
              className="object-contain rounded-md sm:rounded-lg"
              style={{ 
                // Изображение ограничено внутренней областью контейнера
                // Вычитаем padding контейнера (clamp(4px, 1vw, 12px) * 2 = clamp(8px, 2vw, 24px))
                maxWidth: 'calc(100vw - 1rem - clamp(8px, 2vw, 24px))',
                maxHeight: 'calc(100vh - 1rem - clamp(8px, 2vw, 24px) - 60px)',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block'
              }}
              loading="eager"
            />
          ) : (
            <div className="flex items-center justify-center min-w-[200px] min-h-[200px] sm:w-64 sm:h-64">
              <div className="text-sm sm:text-base" style={{ color: 'rgba(255, 255, 255, 0.96)' }}>Ошибка загрузки</div>
            </div>
          )}
        </div>

        {/* Кнопка закрытия - крестик сверху справа, привязана к основному контейнеру */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 rounded-full transition-all duration-200 focus:outline-none shadow-lg z-10"
          aria-label="Закрыть"
          style={{ 
            width: 'clamp(28px, 3vw, 40px)',
            height: 'clamp(28px, 3vw, 40px)',
            padding: 'clamp(4px, 0.5vw, 8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            background: 'transparent',
            color: 'rgba(255, 255, 255, 0.96)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.3)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = '';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.5)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <svg
            style={{
              width: 'clamp(14px, 2vw, 20px)',
              height: 'clamp(14px, 2vw, 20px)',
              flexShrink: 0
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Название файла или имя агента - отдельный контейнер под изображением */}
        {(image.displayName || image.original_filename) && (
          <div className="mt-2 w-full max-w-full overflow-hidden flex justify-center">
            <div 
              className="rounded-md sm:rounded-lg"
              style={{
                maxWidth: '100%',
                minWidth: 0,
                overflow: 'hidden',
                padding: 'clamp(4px, 0.5vw, 8px) clamp(8px, 1vw, 16px)',
                fontSize: 'clamp(10px, 1.2vw, 14px)',
                lineHeight: '1.4',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.96)'
              }}
              title={image.displayName || image.original_filename}
            >
              <span 
                className="block truncate"
                style={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  fontSize: 'inherit',
                  lineHeight: 'inherit'
                }}
              >
                {image.displayName || image.original_filename}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Рендерим модальное окно через Portal в body
  return createPortal(modalContent, document.body);
}


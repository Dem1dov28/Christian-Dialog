import React, { useEffect } from "react";
import { BiCheckCircle } from "react-icons/bi";

/**
 * Модалка «Сообщение скопировано» — под цвета выбранной темы, авто-скрытие
 */
const CopySuccessModal = ({ isOpen, onClose, message, duration = 1800 }) => {
  useEffect(() => {
    if (!isOpen || duration <= 0) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-3 ai-panel-modal-fade-in"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        }}
      >
        <BiCheckCircle
          className="flex-shrink-0 text-2xl"
          style={{ color: "var(--accent)" }}
        />
        <span
          className="text-base font-medium"
          style={{ color: "var(--text-white)" }}
        >
          {message}
        </span>
      </div>
    </div>
  );
};

export default CopySuccessModal;

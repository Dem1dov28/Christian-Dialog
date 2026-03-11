import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiX, FiUser, FiLock, FiTrash2, FiAlertTriangle, FiLogOut, FiChevronRight } from "react-icons/fi";
import { useLanguage } from "../../contexts/LanguageContext";

const EditProfileModal = ({
  isOpen,
  onClose,
  newUsername,
  setNewUsername,
  onUpdateUsername,
  onResetPassword,
  onOpenDeleteDataModal,
  onOpenDeleteAccountModal,
  onLogoutAllDevices,
  isLoading,
  user,
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isShown, setIsShown] = useState(false);
  const modalRef = useRef(null);
  const closingRef = useRef(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (isOpen) {
      closingRef.current = false;
      setIsRendered(true);
      requestAnimationFrame(() => setIsShown(true));
    } else if (isRendered) {
      setIsShown(false);
    }
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isRendered) return;
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isRendered]);

  useEffect(() => {
    if (!isRendered) return;
    const handleEscape = (event) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isRendered]);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsShown(false);
    setTimeout(() => {
      setIsRendered(false);
      onClose();
    }, 300);
  };

  if (!isRendered) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] ${
        isShown ? "ai-panel-backdrop" : "ai-panel-backdrop-closing"
      }`}
      style={{ paddingTop: "80px", paddingBottom: "20px" }}
    >
      <div
        ref={modalRef}
        className={`chat-input-frosted rounded-xl shadow-xl w-full max-w-md mx-4 overflow-y-auto ${
          isShown ? "ai-panel-modal-fade-in" : "ai-panel-modal-fade-out"
        }`}
        style={{ maxHeight: "calc(100dvh - 120px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-semibold text-[var(--text-white)]">
            {t("profile.editProfile")}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-[var(--text-dim)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-white)] transition-colors"
            aria-label={t("common.close")}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="divide-y divide-[var(--border-color)]">
          {/* Update Username */}
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <FiUser className="w-5 h-5 text-[var(--text-dim)]" />
              <span className="text-[var(--text-white)] font-medium">
                {t("profile.privacy.updateUsername")}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={t("profile.privacy.usernamePlaceholder")}
                className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-white)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateUsername();
                }}
                disabled={isLoading || !newUsername.trim()}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? t("profile.privacy.saving") : t("profile.privacy.save")}
              </button>
            </div>
          </div>

          {/* Reset Password */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
              onResetPassword();
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FiLock className="w-5 h-5 text-[var(--text-dim)]" />
              <span className="text-[var(--text-white)] font-medium">
                {t("profile.privacy.resetPassword")}
              </span>
            </div>
            <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
          </button>

          {/* Delete Data */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
              onOpenDeleteDataModal();
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FiTrash2 className="w-5 h-5 text-orange-500" />
              <span className="text-[var(--text-white)] font-medium">
                {t("profile.privacy.deleteData")}
              </span>
            </div>
            <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
          </button>

          {/* Delete Account */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
              onOpenDeleteAccountModal();
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FiAlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-500 font-medium">
                {t("profile.privacy.deleteAccount")}
              </span>
            </div>
            <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
          </button>

          {/* Logout All Devices */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLogoutAllDevices();
            }}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 text-left"
          >
            <div className="flex items-center gap-3">
              <FiLogOut className="w-5 h-5 text-[var(--text-dim)]" />
              <span className="text-[var(--text-white)] font-medium">
                {t("profile.privacy.logoutAllDevices")}
              </span>
            </div>
            <FiChevronRight className="w-4 h-4 text-[var(--text-dim)]" />
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default EditProfileModal;

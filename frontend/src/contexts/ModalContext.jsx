import React, { createContext, useContext, useState } from "react";

const ModalContext = createContext(undefined);

export function ModalProvider({ children }) {
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAboutUsModalOpen, setIsAboutUsModalOpen] = useState(false);

  const openSupportModal = () => {
    setIsSupportModalOpen(true);
  };

  const closeSupportModal = () => {
    setIsSupportModalOpen(false);
  };
  
  const openReportModal = () => {
    setIsReportModalOpen(true);
  };
  
  const closeReportModal = () => {
    setIsReportModalOpen(false);
  };

  const openAboutUsModal = () => {
    setIsAboutUsModalOpen(true);
  };

  const closeAboutUsModal = () => {
    setIsAboutUsModalOpen(false);
  };

  const value = {
    isSupportModalOpen,
    setIsSupportModalOpen,
    openSupportModal,
    closeSupportModal,
    isReportModalOpen,
    setIsReportModalOpen,
    openReportModal,
    closeReportModal,
    isAboutUsModalOpen,
    setIsAboutUsModalOpen,
    openAboutUsModal,
    closeAboutUsModal,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
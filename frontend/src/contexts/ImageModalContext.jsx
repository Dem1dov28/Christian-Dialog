import React, { createContext, useContext, useState } from "react";
import ImageModal from "../components/chat/ImageModal";

const ImageModalContext = createContext(null);

export const ImageModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [image, setImage] = useState(null);

  const openImageModal = (imageData) => {
    setImage(imageData);
    setIsOpen(true);
  };

  const closeImageModal = () => {
    setIsOpen(false);
    setImage(null);
  };

  return (
    <ImageModalContext.Provider value={{ openImageModal, closeImageModal }}>
      {children}
      <ImageModal
        isOpen={isOpen}
        image={image}
        onClose={closeImageModal}
      />
    </ImageModalContext.Provider>
  );
};

export const useImageModal = () => {
  const context = useContext(ImageModalContext);
  if (!context) {
    throw new Error("useImageModal must be used within ImageModalProvider");
  }
  return context;
};


/**
 * Message State Management Hook
 *
 * Manages message state lifecycle with session persistence, retry mechanisms,
 * and integration with React Spring animations.
 */

import { useState, useEffect, useCallback, useRef } from "react";

// Message state enum
export const MessageState = {
  SENDING: "sending",
  THINKING: "thinking",
  RECEIVED: "received",
  ERROR: "error",
  RETRYING: "retrying",
};

// Animation type enum
export const AnimationType = {
  SLIDE_IN: "slide_in",
  THINKING_DOTS: "thinking_dots",
  HOVER_EFFECT: "hover_effect",
  ERROR_PULSE: "error_pulse",
};

// Maximum retry attempts
const MAX_RETRY_ATTEMPTS = 3;

// Session storage key prefix
const STORAGE_PREFIX = "message_state_";

/**
 * Generate unique temporary message ID
 */
const generateTempId = () => {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get session storage key for message state
 */
const getStorageKey = (messageId) => {
  return `${STORAGE_PREFIX}${messageId}`;
};

/**
 * Save message state to session storage
 */
const saveMessageState = (messageId, state) => {
  try {
    const key = getStorageKey(messageId);
    sessionStorage.setItem(
      key,
      JSON.stringify({
        ...state,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("Failed to save message state to session storage:", error);
  }
};

/**
 * Load message state from session storage
 */
const loadMessageState = (messageId) => {
  try {
    const key = getStorageKey(messageId);
    const stored = sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn("Failed to load message state from session storage:", error);
    return null;
  }
};

/**
 * Remove message state from session storage (helper)
 */
const removeMessageStateFromStorage = (messageId) => {
  try {
    const key = getStorageKey(messageId);
    sessionStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to remove message state from session storage:", error);
  }
};

/**
 * Clean up old message states from session storage
 */
const cleanupOldStates = () => {
  try {
    const keys = Object.keys(sessionStorage);
    const messageStateKeys = keys.filter((key) =>
      key.startsWith(STORAGE_PREFIX)
    );

    messageStateKeys.forEach((key) => {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        try {
          const state = JSON.parse(stored);
          const timestamp = new Date(state.timestamp);
          const now = new Date();
          const ageInHours = (now - timestamp) / (1000 * 60 * 60);

          // Remove states older than 24 hours
          if (ageInHours > 24) {
            sessionStorage.removeItem(key);
          }
        } catch (parseError) {
          // Remove corrupted entries
          sessionStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.warn("Failed to cleanup old message states:", error);
  }
};

/**
 * Message State Management Hook
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onStateChange - Callback for state changes
 * @param {Function} options.onRetry - Callback for retry attempts
 * @param {Function} options.onError - Callback for errors
 * @returns {Object} Hook return object
 */
export const useMessageState = (options = {}) => {
  const { onStateChange, onRetry, onError } = options;

  // State management
  const [messageStates, setMessageStates] = useState(new Map());
  const [retryAttempts, setRetryAttempts] = useState(new Map());
  const cleanupRef = useRef(new Set());

  // Initialize cleanup on mount
  useEffect(() => {
    cleanupOldStates();

    return () => {
      // Cleanup on unmount
      cleanupRef.current.forEach((messageId) => {
        removeMessageStateFromStorage(messageId);
      });
    };
  }, []);

  /**
   * Create new message state
   */
  const createMessageState = useCallback(
    (messageId, initialState = MessageState.SENDING) => {
      const tempId = messageId || generateTempId();

      const newState = {
        id: tempId,
        state: initialState,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        errorMessage: null,
        isAnimating: initialState === MessageState.SENDING,
        animationType:
          initialState === MessageState.SENDING ? AnimationType.SLIDE_IN : null,
      };

      setMessageStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(tempId, newState);
        return newMap;
      });

      // Save to session storage
      saveMessageState(tempId, newState);

      // Track for cleanup
      cleanupRef.current.add(tempId);

      // Notify state change
      onStateChange?.(tempId, newState);

      return tempId;
    },
    [onStateChange]
  );

  /**
   * Update message state
   */
  const updateMessageState = useCallback(
    (messageId, updates) => {
      setMessageStates((prev) => {
        const newMap = new Map(prev);
        const currentState = newMap.get(messageId);

        if (!currentState) {
          console.warn(`Message state not found for ID: ${messageId}`);
          return prev;
        }

        // Проверяем, есть ли реальные изменения
        const hasChanges = Object.keys(updates).some((key) => {
          return currentState[key] !== updates[key];
        });

        if (!hasChanges) {
          return prev;
        }

        const updatedState = {
          ...currentState,
          ...updates,
          timestamp: new Date().toISOString(),
        };

        newMap.set(messageId, updatedState);

        // Save to session storage
        saveMessageState(messageId, updatedState);

        // Notify state change
        onStateChange?.(messageId, updatedState);

        return newMap;
      });
    },
    [onStateChange]
  );

  /**
   * Get message state
   */
  const getMessageState = useCallback(
    (messageId) => {
      return messageStates.get(messageId) || loadMessageState(messageId);
    },
    [messageStates]
  );

  /**
   * Set message to thinking state
   */
  const setThinkingState = useCallback(
    (messageId, estimatedDuration = 2000) => {
      updateMessageState(messageId, {
        state: MessageState.THINKING,
        isAnimating: true,
        animationType: AnimationType.THINKING_DOTS,
        estimatedDuration,
      });
    },
    [updateMessageState]
  );

  /**
   * Set message to received state
   */
  const setReceivedState = useCallback(
    (messageId) => {
      // Проверяем, не находится ли сообщение уже в состоянии RECEIVED
      const currentState = getMessageState(messageId);
      if (currentState && currentState.state === MessageState.RECEIVED) {
        return;
      }

      updateMessageState(messageId, {
        state: MessageState.RECEIVED,
        isAnimating: false,
        animationType: null,
        errorMessage: null,
      });
    },
    [updateMessageState, getMessageState]
  );

  /**
   * Set message to error state
   */
  const setErrorState = useCallback(
    (messageId, errorMessage) => {
      updateMessageState(messageId, {
        state: MessageState.ERROR,
        isAnimating: true,
        animationType: AnimationType.ERROR_PULSE,
        errorMessage: errorMessage || "An error occurred",
      });

      // Notify error
      onError?.(messageId, errorMessage);
    },
    [updateMessageState, onError]
  );

  /**
   * Retry failed message
   */
  const retryMessage = useCallback(
    (messageId) => {
      const currentRetryCount = retryAttempts.get(messageId) || 0;

      if (currentRetryCount >= MAX_RETRY_ATTEMPTS) {
        console.warn(
          `Maximum retry attempts exceeded for message: ${messageId}`
        );
        return false;
      }

      const newRetryCount = currentRetryCount + 1;
      setRetryAttempts((prev) => {
        const newMap = new Map(prev);
        newMap.set(messageId, newRetryCount);
        return newMap;
      });

      // Update state to retrying
      updateMessageState(messageId, {
        state: MessageState.RETRYING,
        retryCount: newRetryCount,
        isAnimating: true,
        animationType: AnimationType.SLIDE_IN,
        errorMessage: null,
      });

      // Notify retry attempt
      onRetry?.(messageId, newRetryCount);

      return true;
    },
    [retryAttempts, updateMessageState, onRetry]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(
    (messageId) => {
      updateMessageState(messageId, {
        state: MessageState.RECEIVED,
        errorMessage: null,
        isAnimating: false,
        animationType: null,
      });
    },
    [updateMessageState]
  );

  /**
   * Remove message state
   */
  const removeMessageState = useCallback((messageId) => {
    setMessageStates((prev) => {
      const newMap = new Map(prev);
      newMap.delete(messageId);
      return newMap;
    });

    setRetryAttempts((prev) => {
      const newMap = new Map(prev);
      newMap.delete(messageId);
      return newMap;
    });

    // Remove from session storage
    removeMessageStateFromStorage(messageId);

    // Remove from cleanup tracking
    cleanupRef.current.delete(messageId);
  }, []);

  /**
   * Check if message is in specific state
   */
  const isInState = useCallback(
    (messageId, state) => {
      const messageState = getMessageState(messageId);
      return messageState?.state === state;
    },
    [getMessageState]
  );

  /**
   * Get all message states
   */
  const getAllMessageStates = useCallback(() => {
    return Array.from(messageStates.values());
  }, [messageStates]);

  /**
   * Get messages by state
   */
  const getMessagesByState = useCallback(
    (state) => {
      return getAllMessageStates().filter((msg) => msg.state === state);
    },
    [getAllMessageStates]
  );

  /**
   * Clear all message states
   */
  const clearAllStates = useCallback(() => {
    setMessageStates(new Map());
    setRetryAttempts(new Map());

    // Clear session storage
    try {
      const keys = Object.keys(sessionStorage);
      const messageStateKeys = keys.filter((key) =>
        key.startsWith(STORAGE_PREFIX)
      );
      messageStateKeys.forEach((key) => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn(
        "Failed to clear message states from session storage:",
        error
      );
    }
  }, []);

  /**
   * Restore states from session storage
   */
  const restoreStatesFromStorage = useCallback(() => {
    try {
      const keys = Object.keys(sessionStorage);
      const messageStateKeys = keys.filter((key) =>
        key.startsWith(STORAGE_PREFIX)
      );

      const restoredStates = new Map();
      messageStateKeys.forEach((key) => {
        const stored = sessionStorage.getItem(key);
        if (stored) {
          try {
            const state = JSON.parse(stored);
            restoredStates.set(state.id, state);
            cleanupRef.current.add(state.id);
          } catch (parseError) {
            console.warn(
              `Failed to parse stored state for key ${key}:`,
              parseError
            );
            sessionStorage.removeItem(key);
          }
        }
      });

      setMessageStates(restoredStates);
    } catch (error) {
      console.warn("Failed to restore states from session storage:", error);
    }
  }, []);

  return {
    // State management
    messageStates: Array.from(messageStates.values()),
    createMessageState,
    updateMessageState,
    removeMessageState,
    getMessageState,
    clearAllStates,
    restoreStatesFromStorage,

    // State transitions
    setThinkingState,
    setReceivedState,
    setErrorState,
    clearError,

    // Retry management
    retryMessage,
    retryAttempts: Array.from(retryAttempts.entries()),

    // State queries
    isInState,
    getAllMessageStates,
    getMessagesByState,

    // Constants
    MessageState,
    AnimationType,
    MAX_RETRY_ATTEMPTS,
  };
};

export default useMessageState;

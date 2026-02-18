import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

/**
 * LazyGoogleOAuthProvider - loads Google OAuth script only when needed
 * This reduces initial bundle size by ~90KB
 */
export function LazyGoogleOAuthProvider({ clientId, children }) {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const scriptRef = useRef(null);

  useEffect(() => {
    // Check if script is already loaded
    if (window.google?.accounts?.oauth2) {
      setIsScriptLoaded(true);
      return;
    }

    // Load Google script dynamically
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsScriptLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Google OAuth script');
    };

    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current && document.body.contains(scriptRef.current)) {
        document.body.removeChild(scriptRef.current);
      }
    };
  }, []);

  // Render children with GoogleOAuthProvider even while loading
  // The GoogleOAuthProvider will handle the context, and GoogleLogin
  // will work once the script is fully loaded
  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}

export default LazyGoogleOAuthProvider;

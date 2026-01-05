import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useMaxWidth(breakpoint) {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (event) => {
      setMatches(event.matches);
    };

    setMatches(mql.matches);
    mql.addEventListener("change", onChange);

    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, [breakpoint]);

  return matches;
}

export function useIsMobile() {
  return useMaxWidth(MOBILE_BREAKPOINT);
}

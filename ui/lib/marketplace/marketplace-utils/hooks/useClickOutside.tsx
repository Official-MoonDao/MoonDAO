import { useEffect } from "react";

export function useClickOutside(
  ref: any,
  enabled: boolean,
  setEnabled: Function
) {
  function handleClickOutside(e: Event) {
    ref.current && !ref.current.contains(e.target) && setEnabled(false);
    document.removeEventListener("click", handleClickOutside);
  }
  useEffect(() => {
    if (enabled) {
      setTimeout(
        () => document.addEventListener("click", handleClickOutside),
        500
      );
    }
  }, [enabled]);

  return enabled;
}

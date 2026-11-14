"use client";

import { useEffect, useRef, type RefObject } from "react";

interface UseClickOutsideOptions<T extends HTMLElement = HTMLDivElement> {
  enabled?: boolean;
  onClose: () => void;
  /** Optional existing RefObject to bind instead of creating a new one */
  targetRef?: RefObject<T | null>;
  /** Optional array of element refs or IDs that should not trigger the close callback when clicked */
  ignoreRefs?: Array<RefObject<HTMLElement | null>>;
  /** Whether pressing the Escape key should trigger onClose (defaults to true) */
  closeOnEscape?: boolean;
}

/**
 * Custom hook to detect clicks/touches outside of a specified element
 * and handle Escape key dismissal.
 * 
 * Uses stable callback refs to avoid removing and re-attaching document listeners on every render.
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>({
  enabled = true,
  onClose,
  targetRef,
  ignoreRefs = [],
  closeOnEscape = true,
}: UseClickOutsideOptions<T>): RefObject<T | null> {
  const internalRef = useRef<T | null>(null);
  const ref = targetRef || internalRef;

  const savedOnClose = useRef(onClose);
  useEffect(() => {
    savedOnClose.current = onClose;
  }, [onClose]);

  const savedIgnoreRefs = useRef(ignoreRefs);
  useEffect(() => {
    savedIgnoreRefs.current = ignoreRefs;
  }, [ignoreRefs]);

  useEffect(() => {
    if (!enabled) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target || !ref.current) return;

      // Click is inside the referenced element
      if (ref.current.contains(target)) return;

      // Click is inside one of the ignored elements (e.g. trigger buttons)
      for (const ignoreRef of savedIgnoreRefs.current) {
        if (ignoreRef.current?.contains(target)) return;
      }

      savedOnClose.current();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!closeOnEscape) return;
      if (event.key === "Escape") {
        // Prevent closing if user is currently interacting with an active text input or select
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement
        ) {
          // Blur first on Escape, don't close container immediately
          active.blur();
          return;
        }
        savedOnClose.current();
      }
    }

    // Capture phase listener to intercept before Three.js or stopPropagation can swallow
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, ref, closeOnEscape]);

  return ref;
}

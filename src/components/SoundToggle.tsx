"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isSoundMuted, setSoundMuted } from "@/lib/sound";

const SOUND_CHANGE_EVENT = "a2oj-sound-change";

function subscribeToSoundChanges(callback: () => void) {
  window.addEventListener(SOUND_CHANGE_EVENT, callback);
  return () => window.removeEventListener(SOUND_CHANGE_EVENT, callback);
}

function getSoundSnapshot() {
  return isSoundMuted();
}

function getServerSoundSnapshot() {
  return false;
}

export function SoundToggle() {
  const subscribe = useCallback(subscribeToSoundChanges, []);
  const muted = useSyncExternalStore(subscribe, getSoundSnapshot, getServerSoundSnapshot);

  function toggleSound() {
    const nextMuted = !muted;
    setSoundMuted(nextMuted);
    window.dispatchEvent(new Event(SOUND_CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
      title={muted ? "Bật âm thanh" : "Tắt âm thanh"}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/15 text-[var(--cream)] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]"
    >
      {muted ? (
        // 🔇 Muted icon
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
          <path
            d="M11 5 6 9H2v6h4l5 4V5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      ) : (
        // 🔊 Unmuted icon
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
          <path
            d="M11 5 6 9H2v6h4l5 4V5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.54 8.46a5 5 0 0 1 0 7.07"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M19.07 4.93a10 10 0 0 1 0 14.14"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}

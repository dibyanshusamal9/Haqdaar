"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";

// The call screen (mic, audio, keypad) loads only when someone starts a call.
const CallExperience = dynamic(() => import("./CallExperience"), { ssr: false });

const CallContext = createContext<{ openCall: () => void }>({ openCall: () => undefined });

export const useCall = () => useContext(CallContext);

/** Lets any page start the phone-line demo; the call screen covers the whole page. */
export function CallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openCall = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  // The page behind the call should not scroll.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return (
    <CallContext.Provider value={{ openCall }}>
      {children}
      <AnimatePresence>{open && <CallExperience key="call" onClose={close} />}</AnimatePresence>
    </CallContext.Provider>
  );
}

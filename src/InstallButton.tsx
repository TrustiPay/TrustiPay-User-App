import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallButton() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      // prevents the browser mini-infobar and lets you trigger it from your UI
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setPromptEvent(null);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const onInstallClick = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt(); // triggers the install prompt
    await promptEvent.userChoice;
    setPromptEvent(null); // can only prompt once per event instance
  };

  if (!promptEvent) return null;

  return (
    <button
      onClick={onInstallClick}
      className="rounded-full border border-cyan-300/50 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-sm shadow-cyan-500/30 transition hover:border-cyan-200 hover:bg-cyan-300/20 focus-visible:outline-2 focus-visible:outline-cyan-400"
    >
      Download App
    </button>
  );
}

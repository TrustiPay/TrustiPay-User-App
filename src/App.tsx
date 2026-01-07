import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TrustipayLogo from "./assets/trustipay-logo.png";
import TrustipayIcon from "./assets/trustipay-icon.png";
import { InstallButton } from "./InstallButton";

type Screen =
  | "login"
  | "home"
  | "transfer"
  | "confirm"
  | "success"
  | "history"
  | "offline"
  | "offlineSuccess";

type TransferDraft = {
  recipient: string;
  amount: string;
  note: string;
};

type TransferDetail = {
  recipient: string;
  amount: number;
  note: string;
  reference: string;
  timestamp: number;
};

type HistoryEntry = {
  id: string;
  recipient: string;
  note: string;
  amount: number;
  direction: "sent" | "received";
  timestamp: number;
};

const quickAmounts = [500, 1000, 2000, 5000];

const seededHistory: HistoryEntry[] = [
  {
    id: "TP-2026-00018",
    recipient: "Kevin at work",
    note: "Reimbursement for tickets",
    amount: 4000,
    direction: "sent",
    timestamp: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "TP-2026-00017",
    recipient: "Asha Fernando",
    note: "Dinner split from Friday",
    amount: 6200,
    direction: "sent",
    timestamp: Date.now() - 1000 * 60 * 60 * 26,
  },
  {
    id: "TP-2026-00016",
    recipient: "Salary",
    note: "November payroll",
    amount: 145000,
    direction: "received",
    timestamp: Date.now() - 1000 * 60 * 60 * 72,
  },
];

const defaultDraft: TransferDraft = {
  recipient: "",
  amount: "",
  note: "",
};

const formatCurrency = (amount: number) =>
  `LKR ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString("en-GB", {
    hour12: false,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const initialsFromName = (name: string) => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "U";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const generateReferenceId = () =>
  `TP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [isBooting, setIsBooting] = useState(true);
  const [userName, setUserName] = useState("");
  const [loginName, setLoginName] = useState("Chinthana");
  const [loginPin, setLoginPin] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [draft, setDraft] = useState<TransferDraft>(defaultDraft);
  const [pendingTransfer, setPendingTransfer] = useState<TransferDetail | null>(
    null
  );
  const [lastTransfer, setLastTransfer] = useState<TransferDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(seededHistory);
  const [balance, setBalance] = useState(125000);
  const [transferError, setTransferError] = useState("");
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "sent" | "received"
  >("all");
  const [historySearch, setHistorySearch] = useState("");
  const [biometricStatus, setBiometricStatus] = useState<
    "idle" | "verifying" | "verified"
  >("idle");
  const [cameraStatus, setCameraStatus] = useState<
    "idle" | "requesting" | "scanning" | "error"
  >("idle");
  const [cameraError, setCameraError] = useState("");
  const [offlineScanResult, setOfflineScanResult] = useState("");
  const [offlineRecordedAt, setOfflineRecordedAt] = useState<number | null>(
    null
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  const isLoggedIn = Boolean(userName);
  const activeTitle: Record<Screen, string> = {
    login: "Welcome",
    home: "Home",
    transfer: "Transfer",
    confirm: "Confirm",
    success: "Success",
    history: "History",
    offline: "Offline payment",
    offlineSuccess: "Offline recorded",
  };

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return history.filter((entry) => {
      const matchesFilter =
        historyFilter === "all" || entry.direction === historyFilter;
      const matchesSearch =
        !query ||
        entry.recipient.toLowerCase().includes(query) ||
        entry.note.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [history, historyFilter, historySearch]);

  const recentActivity = history.slice(0, 3);

  const handleLogin = () => {
    if (!loginName.trim()) {
      setLoginError("Please enter your name");
      return;
    }
    setUserName(loginName.trim());
    setLoginError("");
    setScreen("home");
    if (!rememberMe) {
      setLoginPin("");
    }
  };

  const handleBack = () => {
    if (screen === "transfer") {
      setScreen("home");
    } else if (screen === "confirm") {
      setScreen("transfer");
    } else if (screen === "history") {
      setScreen("home");
    } else if (screen === "success") {
      setScreen("home");
    } else if (screen === "offline") {
      setScreen("transfer");
    } else if (screen === "offlineSuccess") {
      setScreen("transfer");
    }
  };

  const handleContinueToConfirm = () => {
    const amountValue = Number(draft.amount.toString().replace(/,/g, ""));
    if (!draft.recipient.trim()) {
      setTransferError("Add a recipient name");
      return;
    }
    if (!amountValue || amountValue <= 0) {
      setTransferError("Enter an amount above LKR 0");
      return;
    }
    if (amountValue > balance) {
      setTransferError("Insufficient balance");
      return;
    }
    setTransferError("");
    const detail: TransferDetail = {
      recipient: draft.recipient.trim(),
      amount: Math.round(amountValue * 100) / 100,
      note: draft.note.trim(),
      reference: generateReferenceId(),
      timestamp: Date.now(),
    };
    setPendingTransfer(detail);
    setScreen("confirm");
  };

  const finalizeTransfer = (detail: TransferDetail) => {
    const completed: TransferDetail = {
      ...detail,
      timestamp: Date.now(),
    };
    const entry: HistoryEntry = {
      id: completed.reference,
      recipient: completed.recipient,
      note: completed.note,
      amount: completed.amount,
      direction: "sent",
      timestamp: completed.timestamp,
    };
    setHistory((prev) => [entry, ...prev]);
    setBalance((prev) => Math.max(0, prev - completed.amount));
    setLastTransfer(completed);
    setDraft(defaultDraft);
    setPendingTransfer(null);
    setBiometricStatus("idle");
    setScreen("success");
  };

  const handleStartQrScan = async () => {
    if (cameraStatus === "requesting" || cameraStatus === "scanning") return;
    setCameraError("");
    setOfflineScanResult("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported in this browser.");
      setCameraStatus("error");
      return;
    }
    try {
      setCameraStatus("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraStatus("scanning");
      setTimeout(() => {
        stopCameraStream();
        setCameraStatus("idle");
        setOfflineScanResult(
          `QR-${Math.floor(100000 + Math.random() * 900000)}`
        );
        setOfflineRecordedAt(Date.now());
        setScreen("offlineSuccess");
      }, 1500);
    } catch (error) {
      console.error("Camera permission failed", error);
      setCameraError("Camera permission denied or unavailable.");
      setCameraStatus("error");
    }
  };

  const handleFingerprint = () => {
    if (!pendingTransfer) {
      setScreen("transfer");
      return;
    }
    setBiometricStatus("verifying");
    setTimeout(() => {
      setBiometricStatus("verified");
      setTimeout(() => finalizeTransfer(pendingTransfer), 300);
    }, 600);
  };

  const handleBottomNav = (next: Screen) => {
    if (!isLoggedIn) return;
    if (
      next === "confirm" ||
      next === "success" ||
      next === "offline" ||
      next === "offlineSuccess"
    )
      return;
    setScreen(next);
  };

  const currentDraftAmount = Number(draft.amount.toString().replace(/,/g, ""));
  const canContinue =
    draft.recipient.trim() &&
    currentDraftAmount > 0 &&
    currentDraftAmount <= balance;

  useEffect(() => {
    if (screen !== "offline") return;
    return () => {
      stopCameraStream();
      setCameraStatus("idle");
    };
  }, [screen, stopCameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const renderBootScreen = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950">
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(34,211,238,0.12), transparent 32%), radial-gradient(circle at 80% 0%, rgba(52,211,153,0.12), transparent 26%), #020617",
        }}
      />
      <div className="absolute h-112 w-md animate-pulse rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute h-112 w-md animate-ping rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative mx-auto flex flex-col items-center gap-4 px-6 text-center">
        <div className="relative">
          <div className="absolute inset-2 rounded-full border border-cyan-300/40" />
          <div className="absolute -inset-4 rounded-[36px] bg-linear-to-r from-cyan-400/15 via-emerald-400/10 to-blue-600/10 blur-2xl" />
          <div className="flex h-32 w-32 items-center justify-center rounded-full pt-3 border border-white/10 bg-white/90 shadow-2xl shadow-cyan-500/20 backdrop-blur">
            <img
              src={TrustipayIcon}
              alt="TrustiPay logo"
              className="h-32 w-32 object-contain"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold text-white">
          <span className="text-slate-300">Launching TrustiPay</span>
          <div className="flex items-center gap-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Securing your wallet and loading your experience…
        </p>
      </div>
    </div>
  );

  const renderHeader = () => {
    const showBack =
      screen === "transfer" ||
      screen === "confirm" ||
      screen === "history" ||
      screen === "success" ||
      screen === "offline" ||
      screen === "offlineSuccess";
    return (
      <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            {showBack ? (
              <button
                aria-label="Go back"
                onClick={handleBack}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-cyan-300/40 hover:bg-cyan-300/10 focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M15 18L9 12L15 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <img
                  src={TrustipayLogo}
                  alt="TrustiPay Logo"
                  className="h-15 w-auto"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <InstallButton />
            {isLoggedIn ? (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 text-slate-950 font-bold">
                  {initialsFromName(userName)}
                </div>
                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-white">{userName}</p>
                  <p>Active</p>
                </div>
              </div>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                Guest
              </span>
            )}
          </div>
        </div>
        <div className="text-sm font-semibold text-white text-center py-2 border-t border-white/5 bg-slate-950/90">
          {activeTitle[screen]}
        </div>
      </header>
    );
  };

  const renderLogin = () => (
    <div className="flex min-h-[calc(100vh-20rem)] flex-col justify-center gap-6 py-6">
      <div className="space-y-2 text-center">
        <div className="space-y-1">
          <p className="text-2xl font-semibold text-white">Welcome back</p>
          <p className="text-sm text-slate-400">
            Sign in to continue your payments journey.
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/50 sm:p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              className="block text-sm font-medium text-slate-200"
              htmlFor="name"
            >
              Username
            </label>
            <input
              id="name"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              placeholder="Chinthana"
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-inner shadow-slate-950/40 placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>
          <div className="space-y-2">
            <label
              className="block text-sm font-medium text-slate-200"
              htmlFor="pin"
            >
              Security PIN
            </label>
            <input
              id="pin"
              value={loginPin}
              onChange={(e) => setLoginPin(e.target.value)}
              placeholder="••••"
              inputMode="numeric"
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white shadow-inner shadow-slate-950/40 placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-400"
              />
              Remember me
            </label>
          </div>
          {loginError && <p className="text-sm text-rose-300">{loginError}</p>}
          <button
            onClick={handleLogin}
            className="flex w-full items-center justify-center rounded-xl bg-linear-to-r from-cyan-400 via-emerald-400 to-blue-600 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:shadow-cyan-400/40"
          >
            Log in
          </button>
          <p className="text-center text-xs text-slate-400">
            By continuing you agree to our Terms and Privacy.
          </p>
        </div>
      </div>
    </div>
  );

  const renderGreeting = () => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 shadow-inner shadow-slate-950/30">
      <p className="text-sm text-slate-300">Hello,</p>
      <p className="text-2xl font-semibold text-white sm:text-3xl">
        {userName}
      </p>
      <p className="text-sm text-slate-400">How can I help you today?</p>
    </div>
  );

  const renderBalanceCard = () => (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-emerald-400 via-cyan-400 to-blue-600 p-px shadow-2xl shadow-cyan-500/30">
      <div className="relative rounded-[22px] bg-slate-950/70 px-5 py-6 sm:px-6">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.15),transparent_45%)]" />
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm text-white/80">Available balance</p>
            <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {formatCurrency(balance)}
            </p>
            <p className="text-xs text-white/80">Last updated just now</p>
          </div>
          <div className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white">
            LKR wallet
          </div>
        </div>
      </div>
    </div>
  );

  const renderQuickActions = () => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-950/40">
      <div className="flex items-center justify-between pb-3">
        <p className="text-sm font-semibold text-white">Quick actions</p>
        <span className="text-xs text-slate-400">Mobile-first grid</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <button
          onClick={() => setScreen("transfer")}
          className="group rounded-xl border col-span-2 sm:col-span-1 border-cyan-300/20 bg-cyan-400/10 px-4 py-4 text-left transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/30">
            ✦
          </span>
          <p className="mt-3 text-base font-semibold text-white">
            Pay With Voice
          </p>
          <p className="text-xs text-slate-400">Send securely in seconds</p>
        </button>
        <button
          onClick={() => setScreen("transfer")}
          className="group rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white font-bold">
            ⇄
          </span>
          <p className="mt-3 text-base font-semibold text-white">
            Transfer Money
          </p>
          <p className="text-xs text-slate-400">Send securely in seconds</p>
        </button>
        <button
          onClick={() => setScreen("history")}
          className="group rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white font-bold">
            ⏱
          </span>
          <p className="mt-3 text-base font-semibold text-white">History</p>
          <p className="text-xs text-slate-400">Check recent activity</p>
        </button>
      </div>
    </div>
  );

  const renderRecentActivity = () => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-950/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Recent activity</p>
          <p className="text-xs text-slate-400">Latest 3 entries</p>
        </div>
        <button
          onClick={() => setScreen("history")}
          className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
        >
          View all
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {recentActivity.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 px-3 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white font-semibold">
                {initialsFromName(entry.recipient)}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {entry.direction === "sent" ? "Sent to" : "Received from"}{" "}
                  {entry.recipient}
                </p>
                <p className="text-xs text-slate-400">{entry.note}</p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-semibold ${
                  entry.direction === "sent"
                    ? "text-rose-200"
                    : "text-emerald-200"
                }`}
              >
                {entry.direction === "sent" ? "-" : "+"}{" "}
                {formatCurrency(entry.amount)}
              </p>
              <p className="text-[11px] text-slate-500">
                {formatDateTime(entry.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="space-y-4 pb-6">
      {renderGreeting()}
      {renderBalanceCard()}
      {renderQuickActions()}
      {renderRecentActivity()}
    </div>
  );

  const renderTransfer = () => (
    <div className="space-y-4 pb-12">
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 px-4 py-3 text-xs text-cyan-100">
        Listening dock reserved — highlight the field you are speaking about.
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-950/40 sm:p-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              className="text-sm font-semibold text-white"
              htmlFor="recipient"
            >
              Send to
            </label>
            <input
              id="recipient"
              value={draft.recipient}
              onChange={(e) =>
                setDraft((d) => ({ ...d, recipient: e.target.value }))
              }
              placeholder="Type contact label (e.g., Kevin at work)"
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400"
            />
            <p className="text-xs text-slate-400">
              Helper: Type contact label to search.
            </p>
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-semibold text-white"
              htmlFor="amount"
            >
              Amount
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-4 shadow-inner shadow-slate-950/40">
              <span className="text-sm font-semibold text-slate-300">LKR</span>
              <input
                id="amount"
                inputMode="decimal"
                value={draft.amount}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, amount: e.target.value }))
                }
                placeholder="0.00"
                className="w-full bg-transparent text-4xl font-semibold tracking-tight text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() =>
                    setDraft((d) => ({ ...d, amount: amt.toString() }))
                  }
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
                >
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>
            {currentDraftAmount > balance && (
              <p className="text-sm text-rose-300">Insufficient balance</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white" htmlFor="note">
              Note
            </label>
            <textarea
              id="note"
              value={draft.note}
              onChange={(e) =>
                setDraft((d) => ({ ...d, note: e.target.value }))
              }
              placeholder="Add a note (optional)"
              className="min-h-22.5 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>
          {transferError && (
            <p className="text-sm text-rose-300">{transferError}</p>
          )}
          <button
            disabled={!canContinue}
            onClick={handleContinueToConfirm}
            className="w-full rounded-xl bg-linear-to-r from-cyan-400 via-emerald-400 to-blue-600 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:shadow-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue
          </button>
          <button
            onClick={() => setScreen("offline")}
            className="w-full text-center text-sm font-semibold text-cyan-200 underline-offset-2 hover:text-cyan-100 hover:underline"
          >
            Offline Payment
          </button>
        </div>
      </div>
    </div>
  );

  const renderConfirm = () => {
    if (!pendingTransfer) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-rose-100">
            No transfer details yet. Add a recipient and amount first.
          </div>
          <button
            onClick={() => setScreen("transfer")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-cyan-300/40 hover:bg-cyan-300/10"
          >
            Go to Transfer
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-5 pb-10">
        {biometricStatus === "verified" && (
          <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-emerald-100">
            Fingerprint verified ✓
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-slate-950/40">
          <p className="text-sm font-semibold text-white">You are sending</p>
          <p className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
            {formatCurrency(pendingTransfer.amount)}
          </p>
          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Recipient</span>
              <span className="text-sm font-semibold text-white">
                {pendingTransfer.recipient}
              </span>
            </div>
            {pendingTransfer.note && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-slate-400">Note</span>
                <span className="text-sm font-semibold text-white">
                  {pendingTransfer.note}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Fee</span>
              <span className="text-sm font-semibold text-emerald-200">
                LKR 0.00
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Total</span>
              <span className="text-sm font-semibold text-white">
                {formatCurrency(pendingTransfer.amount)}
              </span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-slate-950/40">
          <p className="text-sm font-semibold text-white">
            Approve this transfer
          </p>
          <div className="mt-4 flex flex-col items-center gap-4">
            <button
              onClick={handleFingerprint}
              disabled={biometricStatus === "verifying"}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-cyan-400 via-emerald-400 to-blue-600 text-slate-950 shadow-xl shadow-cyan-500/30 transition hover:shadow-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 11V13M9 22C12.866 22 16 18.866 16 15V13C16 9.13401 12.866 6 9 6C5.13401 6 2 9.13401 2 13V15C2 18.866 5.13401 22 9 22ZM18 10V13M14 2C17.866 2 21 5.13401 21 9V13C21 16.866 17.866 20 14 20"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <p className="text-sm text-slate-300">
              {biometricStatus === "verifying"
                ? "Verifying fingerprint..."
                : "Verify fingerprint to approve"}
            </p>
            <button
              onClick={() => setScreen("transfer")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-cyan-300/40 hover:bg-cyan-300/10"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOffline = () => (
    <div className="space-y-4 pb-12">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-950/40">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">
            Offline payment methods
          </p>
          <p className="text-xs text-slate-400">
            Choose a nearby method to record your payment without connectivity.
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <button
            onClick={handleStartQrScan}
            className="flex w-full items-center justify-between rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-cyan-200/50 hover:bg-cyan-400/15"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 text-slate-950 font-bold">
                QR
              </span>
              QR payment
            </span>
            <span className="text-xs text-cyan-100">
              {cameraStatus === "scanning" ? "Scanning..." : "Tap to scan"}
            </span>
          </button>
          <button className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10">
            <span className="flex items-center gap-3 opacity-70">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white font-bold">
                Wi
              </span>
              Wi‑Fi Direct (placeholder)
            </span>
            <span className="text-xs text-slate-400">Coming soon</span>
          </button>
          <button className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10">
            <span className="flex items-center gap-3 opacity-70">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white font-bold">
                Bt
              </span>
              Bluetooth (placeholder)
            </span>
            <span className="text-xs text-slate-400">Coming soon</span>
          </button>
        </div>
        {cameraStatus === "requesting" && (
          <p className="mt-3 text-xs text-cyan-100">
            Requesting camera permission…
          </p>
        )}
        {cameraStatus === "scanning" && (
          <div className="mt-3 space-y-2 rounded-xl border border-cyan-300/30 bg-slate-900/80 p-3">
            <p className="text-xs text-cyan-100">
              Camera active — align QR code within view.
            </p>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <video
                ref={videoRef}
                className="aspect-video w-full bg-black/60"
              />
            </div>
          </div>
        )}
        {cameraError && (
          <p className="mt-3 text-xs text-rose-200">
            Camera error: {cameraError}
          </p>
        )}
        <button
          onClick={() => setScreen("transfer")}
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-cyan-300/40 hover:bg-cyan-300/10"
        >
          Back to Transfer
        </button>
      </div>
    </div>
  );

  const renderOfflineSuccess = () => (
    <div className="space-y-5 pb-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30">
          ✓
        </div>
        <p className="text-2xl font-semibold text-white">
          Offline payment recorded
        </p>
        <p className="text-sm text-slate-400">
          The QR scan was captured and stored for syncing.
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-slate-950/40">
        <p className="text-sm font-semibold text-white">Details</p>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <div className="flex items-center justify-between">
            <span>Status</span>
            <span className="font-semibold text-emerald-200">Recorded</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Method</span>
            <span className="font-semibold text-white">QR payment</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Reference</span>
            <span className="font-semibold text-white">
              {offlineScanResult || "Pending reference"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Timestamp</span>
            <span className="font-semibold text-white">
              {offlineRecordedAt
                ? formatDateTime(offlineRecordedAt)
                : "Not recorded yet"}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <button
          onClick={() => setScreen("history")}
          className="w-full rounded-xl bg-linear-to-r from-cyan-400 via-emerald-400 to-blue-600 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:shadow-cyan-400/40"
        >
          View history
        </button>
        <button
          onClick={() => setScreen("transfer")}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-cyan-300/40 hover:bg-cyan-300/10"
        >
          Back to Transfer
        </button>
        <button
          onClick={() => setScreen("home")}
          className="w-full rounded-xl border border-white/5 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:border-white/20"
        >
          Back to Home
        </button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="space-y-5 pb-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30">
          ✓
        </div>
        <p className="text-2xl font-semibold text-white">Transfer sent!</p>
        <p className="text-sm text-slate-400">Your payment is on its way.</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-slate-950/40">
        {lastTransfer ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Recipient</span>
              <span className="text-sm font-semibold text-white">
                {lastTransfer.recipient}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Amount</span>
              <span className="text-sm font-semibold text-white">
                {formatCurrency(lastTransfer.amount)}
              </span>
            </div>
            {lastTransfer.note && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-slate-400">Note</span>
                <span className="text-sm font-semibold text-white">
                  {lastTransfer.note}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Reference</span>
              <span className="text-sm font-semibold text-white">
                {lastTransfer.reference}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Timestamp</span>
              <span className="text-sm font-semibold text-white">
                {formatDateTime(lastTransfer.timestamp)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300">No transfer details found.</p>
        )}
      </div>
      <div className="space-y-3">
        <button
          onClick={() => setScreen("history")}
          className="w-full rounded-xl bg-linear-to-r from-cyan-400 via-emerald-400 to-blue-600 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:shadow-cyan-400/40"
        >
          View history
        </button>
        <button
          onClick={() => {
            setDraft(defaultDraft);
            setScreen("transfer");
          }}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:border-cyan-300/40 hover:bg-cyan-300/10"
        >
          Send another transfer
        </button>
        <button
          onClick={() => setScreen("home")}
          className="w-full rounded-xl border border-white/5 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:border-white/20"
        >
          Back to Home
        </button>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4 pb-12">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-950/40">
        <div className="space-y-3">
          <input
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Search recipients / notes"
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400"
          />
          <div className="flex flex-wrap gap-2">
            {(["all", "sent", "received"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setHistoryFilter(filter)}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  historyFilter === filter
                    ? "border border-cyan-300/60 bg-cyan-300/15 text-white"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/10"
                }`}
              >
                {filter === "all"
                  ? "All"
                  : filter === "sent"
                  ? "Sent"
                  : "Received"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {filteredHistory.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center shadow-inner shadow-slate-950/40">
            <p className="text-sm font-semibold text-white">
              No transactions yet
            </p>
            <p className="text-xs text-slate-400">
              Start by making your first transfer.
            </p>
            <button
              onClick={() => setScreen("transfer")}
              className="mt-3 rounded-xl bg-linear-to-r from-cyan-400 via-emerald-400 to-blue-600 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:shadow-cyan-400/40"
            >
              Make your first transfer
            </button>
          </div>
        ) : (
          filteredHistory.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-950/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white font-semibold">
                  {initialsFromName(entry.recipient)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {entry.direction === "sent" ? "Sent to " : "Received from "}
                    {entry.recipient}
                  </p>
                  <p className="text-xs text-slate-400">{entry.note}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatDateTime(entry.timestamp)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${
                    entry.direction === "sent"
                      ? "text-rose-200"
                      : "text-emerald-200"
                  }`}
                >
                  {entry.direction === "sent" ? "-" : "+"}{" "}
                  {formatCurrency(entry.amount)}
                </p>
                <p className="text-[11px] text-slate-500">{entry.id}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderBottomNav = () => {
    if (!isLoggedIn) return null;
    const items: { key: Screen; label: string; icon: string }[] = [
      { key: "home", label: "Home", icon: "⌂" },
      { key: "transfer", label: "Transfer", icon: "⇄" },
      { key: "history", label: "History", icon: "⏱" },
    ];
    return (
      <nav className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-slate-950 via-slate-950/95 to-slate-950/70 pb-3 pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 px-4 sm:px-6">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => handleBottomNav(item.key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                screen === item.key
                  ? "border-cyan-300/60 bg-cyan-300/15 text-white shadow-lg shadow-cyan-500/20"
                  : "border-white/5 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/10"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    );
  };

  const renderScreen = () => {
    if (!isLoggedIn && screen !== "login") {
      setScreen("login");
    }
    switch (screen) {
      case "login":
        return renderLogin();
      case "home":
        return renderHome();
      case "transfer":
        return renderTransfer();
      case "confirm":
        return renderConfirm();
      case "offline":
        return renderOffline();
      case "offlineSuccess":
        return renderOfflineSuccess();
      case "success":
        return renderSuccess();
      case "history":
        return renderHistory();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      {isBooting && renderBootScreen()}
      {renderHeader()}
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 pb-28 pt-4 sm:px-6 sm:pb-24">
        {renderScreen()}
      </div>
      {renderBottomNav()}
    </div>
  );
}

export default App;

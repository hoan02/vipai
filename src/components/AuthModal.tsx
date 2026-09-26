"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Icon } from "@/lib/icons";
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { AuthMode } from "@/lib/auth-modal";

export function AuthModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOpen = (e: CustomEvent<{ mode?: AuthMode }>) => {
      setMode(e.detail?.mode || "signin");
      setError(null);
      setSuccess(null);
      setOpen(true);
    };

    const handleClose = () => {
      setOpen(false);
    };

    const handleClick = (e: MouseEvent) => {
      const trigger = (e.target as HTMLElement)?.closest("[data-auth-modal]");
      if (trigger) {
        e.preventDefault();
        const requestedMode = (trigger.getAttribute("data-auth-modal") as AuthMode) || "signin";
        setMode(requestedMode);
        setError(null);
        setSuccess(null);
        setOpen(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("aigiare:open-auth" as unknown as keyof WindowEventMap, handleOpen as EventListener);
    window.addEventListener("aigiare:close-auth" as unknown as keyof WindowEventMap, handleClose as EventListener);
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("aigiare:open-auth" as unknown as keyof WindowEventMap, handleOpen as EventListener);
      window.removeEventListener("aigiare:close-auth" as unknown as keyof WindowEventMap, handleClose as EventListener);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    setError(null);
    setSuccess(null);
  };

  const handleSwitchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const res = (await signIn.credential({
          credential: email,
          password: password,
        })) as { error?: { message?: string } } | undefined;

        if (res?.error) {
          setError(res.error.message || "Email hoặc mật khẩu không chính xác.");
          setLoading(false);
          return;
        }

        setSuccess("Đăng nhập thành công! Đang chuyển hướng...");
        setTimeout(() => {
          setOpen(false);
          router.push("/dashboard");
          router.refresh();
        }, 600);
      } else {
        const res = (await signUp.credential({
          email,
          password,
          firstname: firstName.trim() || undefined,
          lastname: lastName.trim() || undefined,
        })) as { error?: { message?: string } } | undefined;

        if (res?.error) {
          setError(res.error.message || "Không thể tạo tài khoản. Vui lòng thử lại.");
          setLoading(false);
          return;
        }

        setSuccess("Tạo tài khoản thành công! Đang đăng nhập...");
        setTimeout(() => {
          setOpen(false);
          router.push("/dashboard");
          router.refresh();
        }, 600);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
      setError(msg);
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-opacity duration-200 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-[420px] bg-[#10131a] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200">
        {/* Glow ambient background effect */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-emerald-500/15 blur-3xl pointer-events-none rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
              <Icon name="ic-aigiare" viewBox="0 0 24 24" width={20} height={20} />
            </div>
            <span className="font-semibold text-white tracking-tight text-base">AiGiare</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => handleSwitchMode("signin")}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              mode === "signin"
                ? "bg-white text-black shadow-md shadow-black/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode("signup")}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              mode === "signup"
                ? "bg-white text-black shadow-md shadow-black/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            Tạo tài khoản
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2.5 mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="flex items-start gap-2.5 mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <span className="leading-snug">{success}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-2.5 animate-in fade-in duration-200">
              <div>
                <label className="block text-[11px] font-medium text-white/70 mb-1" htmlFor="modal-firstname">
                  Tên
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={14} />
                  <input
                    id="modal-firstname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-white/70 mb-1" htmlFor="modal-lastname">
                  Họ
                </label>
                <input
                  id="modal-lastname"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Nguyen"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-white/70 mb-1" htmlFor="modal-email">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={14} />
              <input
                ref={emailInputRef}
                id="modal-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-white/70" htmlFor="modal-password">
                Mật khẩu
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={14} />
              <input
                id="modal-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "signup" ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Tối thiểu 8 ký tự" : "••••••••"}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-9 py-2.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-black font-semibold rounded-xl py-2.5 px-4 text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {mode === "signin" ? "Đang xác thực..." : "Đang tạo tài khoản..."}
              </>
            ) : (
              <>
                {mode === "signin" ? "Đăng nhập ngay" : "Tạo tài khoản"}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Footer switch prompt */}
        <p className="mt-5 text-center text-[11.5px] text-white/45">
          {mode === "signin" ? (
            <>
              Chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("signup")}
                className="text-emerald-400 font-medium hover:underline cursor-pointer"
              >
                Đăng ký tài khoản mới
              </button>
            </>
          ) : (
            <>
              Đã có tài khoản?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("signin")}
                className="text-emerald-400 font-medium hover:underline cursor-pointer"
              >
                Đăng nhập ngay
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

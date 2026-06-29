import React, { useState, useEffect } from "react";
import { 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { LogIn, LogOut, User as UserIcon, RefreshCw, Smartphone, Key, AlertCircle, CheckCircle, Shield } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AuthOverlayProps {
  currentUser: User | null;
}

export default function AuthOverlay({ currentUser }: AuthOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"connected" | "disconnected">("connected");

  useEffect(() => {
    // Simple online/offline tracker
    const handleOnline = () => setStatus("connected");
    const handleOffline = () => setStatus("disconnected");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setIsOpen(false);
      setEmail("");
      setPassword("");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use.");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError(err.message || "An error occurred during authentication.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setIsOpen(false);
    } catch (err: any) {
      console.error("Google sign-in failed:", err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut(auth).catch((err) => console.error("Sign-out error:", err));
  };

  return (
    <div id="auth-container" className="relative z-40">
      {/* Top Bar Indicators */}
      <div className="flex items-center gap-4 bg-forest-card/60 backdrop-blur-md px-4 py-2 rounded-full border border-forest-border text-xs text-earth-sage">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 rounded-full ${status === "connected" ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <span>{status === "connected" ? "Live Sync Active" : "Offline Mode"}</span>
        </div>
        
        <div className="h-3 w-[1px] bg-forest-border" />

        <button 
          id="sync-settings-btn"
          onClick={() => setIsOpen(!isOpen)} 
          className="flex items-center gap-1.5 hover:text-earth-sand transition-colors font-mono"
        >
          <Smartphone size={13} className="text-earth-sand" />
          {!currentUser ? "Offline / Sync Account" : currentUser.isAnonymous ? "Cloud Backup Setup" : `${currentUser.email?.split("@")[0] || "My Account"}`}
        </button>
      </div>

      {/* Auth Settings Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black z-40"
            />

            {/* Modal Body */}
            <motion.div 
              id="auth-modal"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute right-0 top-12 mt-1 w-80 bg-forest-card border border-forest-border rounded-xl shadow-2xl p-5 z-50 text-left"
            >
              <h3 className="font-display font-medium text-earth-sand text-sm tracking-wide mb-1 flex items-center gap-2">
                <Smartphone size={15} />
                Multi-Device Synchronization
              </h3>
              <p className="text-xs text-earth-sage mb-4 leading-relaxed">
                Connect your account to access your lists in real-time from your laptop, mobile phone, or tablet.
              </p>

              {!currentUser || currentUser?.isAnonymous ? (
                <div>
                  <div className="flex gap-2 p-2.5 rounded-lg bg-forest-darkest/50 border border-forest-border/40 mb-4 items-start">
                    <UserIcon size={14} className="text-earth-sage mt-0.5 shrink-0" />
                    <div className="text-[11px] text-earth-sage">
                      <span className="text-earth-sand font-mono block">
                        Current Mode: {!currentUser ? "Guest Offline Mode" : "Guest Cloud Mode"}
                      </span>
                      {!currentUser ? (
                        <span>Your tasks are stored on this browser's secure cache. Sign in with Google to enable real-time cloud synchronization!</span>
                      ) : (
                        <span>Your tasks are stored in guest cloud space. Register an email or sign in below to sync them permanently across devices!</span>
                      )}
                    </div>
                  </div>

                  {/* Google Sign-In Option */}
                  <button 
                    id="google-signin-btn"
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-2 mb-3 bg-earth-sand hover:bg-earth-sand/90 text-forest-darkest rounded-lg text-xs font-semibold transition-colors flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Shield size={13} />
                    Sign In with Google (Cloud Sync)
                  </button>

                  <div className="flex items-center my-3 text-[10px] text-earth-sage/50 uppercase font-mono tracking-widest gap-2">
                    <div className="flex-1 h-[1px] bg-forest-border/40" />
                    <span>Or Email Account</span>
                    <div className="flex-1 h-[1px] bg-forest-border/40" />
                  </div>

                  <form id="auth-form" onSubmit={handleAuthSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 mb-1 font-mono">Email Address</label>
                      <input 
                        id="auth-email-input"
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full bg-forest-darkest border border-forest-border rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-earth-sage/80 mb-1 font-mono">Password</label>
                      <input 
                        id="auth-password-input"
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-forest-darkest border border-forest-border rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    {error && (
                      <div className="flex gap-1.5 text-[11px] text-earth-clay items-start">
                        <AlertCircle size={13} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col gap-2">
                      <button 
                        id="auth-submit-btn"
                        type="submit" 
                        disabled={loading}
                        className="w-full py-2 bg-earth-moss hover:bg-earth-moss/80 text-earth-sand rounded-lg text-xs font-medium transition-colors flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Key size={13} />
                        )}
                        {mode === "signin" ? "Sign In & Sync" : "Create Account & Backup"}
                      </button>

                      <button 
                        id="auth-toggle-mode-btn"
                        type="button" 
                        onClick={() => {
                          setMode(mode === "signin" ? "signup" : "signin");
                          setError("");
                        }}
                        className="text-center text-[11px] text-earth-sage hover:text-earth-sand transition-colors cursor-pointer py-1"
                      >
                        {mode === "signin" ? "Need a new account? Sign Up" : "Have an account? Log In"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-forest-darkest/50 border border-forest-border">
                    <div className="flex items-center gap-2 text-xs font-mono text-green-400 mb-1">
                      <CheckCircle size={14} />
                      Cloud Backed Up
                    </div>
                    <span className="block text-xs text-earth-sage break-all">
                      Logged in: <b className="text-white font-sans">{currentUser?.email}</b>
                    </span>
                    <span className="block text-[10px] text-earth-sage/70 font-mono mt-1">
                      UID: {currentUser?.uid.substring(0, 10)}...
                    </span>
                  </div>

                  <button 
                    id="signout-btn"
                    onClick={handleSignOut}
                    className="w-full py-1.5 bg-forest-light hover:bg-forest-light/80 text-earth-sage hover:text-white rounded-lg text-xs font-medium transition-all flex justify-center items-center gap-2 cursor-pointer border border-forest-border"
                  >
                    <LogOut size={13} />
                    Sign Out / Switch Account
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

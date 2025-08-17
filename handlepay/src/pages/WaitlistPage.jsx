// src/pages/WaitlistPage.jsx
import React, { useMemo, useState } from "react";
import { isAddress } from "viem";
import { Send, Plus, X } from "lucide-react";

const SOCIAL_PLATFORMS = [
  { key: "twitter",  label: "Twitter" },
  { key: "telegram", label: "Telegram" },
  { key: "discord",  label: "Discord" },
  { key: "instagram", label: "Instagram" },
];

function normalizeHandle(v) {
  return String(v || "").trim().replace(/^@/, "");
}

export default function WaitlistPage() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  // start with one row, default to the first platform
  const [socials, setSocials] = useState([{ platform: "twitter", handle: "" }]);

  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const emailOk = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim()),
    [email]
  );
  const walletOk = useMemo(() => isAddress(wallet || "0x0"), [wallet]);

  // Track which platforms are already chosen (by other rows)
  const chosenPlatforms = useMemo(
    () => new Set(socials.map((s) => s.platform)),
    [socials]
  );

  // Get list of platforms that are not yet chosen
  const unusedPlatforms = useMemo(
    () => SOCIAL_PLATFORMS.filter((p) => !chosenPlatforms.has(p.key)),
    [chosenPlatforms]
  );

  // Validate: 1) first name, 2) valid email, 3) valid EVM address,
  // 4) every social row has a handle, 5) platforms are unique
  const canSubmit = useMemo(() => {
    const platformsUnique =
      new Set(socials.map((s) => s.platform)).size === socials.length;
    const allHandlesOk = socials.every((s) => s.platform && s.handle.trim());
    return (
      first.trim() &&
      emailOk &&
      walletOk &&
      socials.length >= 1 &&
      allHandlesOk &&
      platformsUnique &&
      !submitting
    );
  }, [first, emailOk, walletOk, socials, submitting]);

  function updateSocial(index, patch) {
    setSocials((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function removeSocial(index) {
    setSocials((prev) => prev.filter((_, i) => i !== index));
  }

  function addSocial() {
    // Pick first unused platform if available
    const next = unusedPlatforms[0]?.key || null;
    if (!next) return; // nothing left to add
    setSocials((prev) => [...prev, { platform: next, handle: "" }]);
  }

  // Build select options per row:
  // include the row's current platform (so the select doesn’t blank out)
  // PLUS all other unused platforms
  function optionsForRow(rowIndex) {
    const currentKey = socials[rowIndex]?.platform;
    const currentOpt =
      SOCIAL_PLATFORMS.find((p) => p.key === currentKey) || null;

    const others = SOCIAL_PLATFORMS.filter((p) => {
      if (p.key === currentKey) return false; // already included as currentOpt
      // allow only platforms not chosen by *other* rows
      const chosenElsewhere = socials.some(
        (s, i) => i !== rowIndex && s.platform === p.key
      );
      return !chosenElsewhere;
    });

    return currentOpt ? [currentOpt, ...others] : others;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setStatus(null);

    if (!canSubmit) {
      return setStatus({
        kind: "error",
        msg: "Please fill all required fields correctly.",
      });
    }

    setSubmitting(true);
    try {
      const payload = {
        first: first.trim(),
        last: last.trim(),
        email: email.trim(),
        wallet: wallet.trim(),
        socials: socials.map((s) => ({
          platform: s.platform,
          handle: normalizeHandle(s.handle),
        })),
        ts: new Date().toISOString(),
      };
      console.log("[WAITLIST]", payload);

      // Simulate server work
      await new Promise((r) => setTimeout(r, 700));

      setStatus({
        kind: "ok",
        msg: "Thanks! Your response was recorded. We’ll add you to the waitlist.",
      });

      // reset
      setFirst("");
      setLast("");
      setEmail("");
      setWallet("");
      setSocials([{ platform: "twitter", handle: "" }]);
    } catch (err) {
      setStatus({
        kind: "error",
        msg: err?.message || "Something went wrong. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="fixed left-0 right-0 top-24 bottom-16 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-xl">
          <h1 className="text-2xl font-bold mb-4 text-center">Join the Waitlist</h1>

          <div className="bg-white rounded-2xl border shadow p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    First name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Last name</label>
                  <input
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 ${
                    email ? (emailOk ? "border-emerald-300" : "border-rose-300") : ""
                  }`}
                />
              </div>

              {/* Wallet */}
              <div>
                <label className="block text-xs font-medium mb-1">
                  EVM Wallet <span className="text-rose-500">*</span>
                </label>
                <input
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 font-mono ${
                    wallet ? (walletOk ? "border-emerald-300" : "border-rose-300") : ""
                  }`}
                  placeholder="0x..."
                />
              </div>

              {/* Social handles (unique platforms) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium">
                    Social Handles <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Each platform can be added once
                  </span>
                </div>

                {socials.map((s, i) => {
                  const opts = optionsForRow(i);
                  return (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                      <select
                        value={s.platform}
                        onChange={(e) => updateSocial(i, { platform: e.target.value })}
                        className="rounded-xl border px-3 py-2"
                      >
                        {opts.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.label}
                          </option>
                        ))}
                      </select>

                      <div className="flex gap-2">
                        <input
                          value={s.handle}
                          onChange={(e) => updateSocial(i, { handle: e.target.value })}
                          className="flex-1 rounded-xl border px-3 py-2"
                          placeholder="@username"
                        />
                        {socials.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSocial(i)}
                            className="p-2 text-rose-600 hover:text-rose-800"
                            aria-label="Remove handle"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addSocial}
                  disabled={unusedPlatforms.length === 0}
                  className={`text-sm flex items-center gap-1 ${
                    unusedPlatforms.length === 0
                      ? "text-slate-400 cursor-not-allowed"
                      : "text-sky-600 hover:text-sky-700"
                  }`}
                >
                  <Plus size={14} /> Add another
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-2 border bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting…" : "Join Waitlist"}
              </button>

              {status && (
                <div
                  className={`text-sm mt-3 text-center ${
                    status.kind === "ok" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {status.msg}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

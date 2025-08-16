import React, { useState } from "react";
import { useAccount } from "wagmi";
import USERS from "../data/seedUsers.js";
import { Send } from "lucide-react";

const handleTypes = [
  { key: "username", label: "Username" },
  { key: "github", label: "GitHub" },
  { key: "twitter", label: "X" },
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
];

export default function PaymentsPage() {
  const { address, isConnected } = useAccount();
  const [toType, setToType] = useState("username");
  const [toValue, setToValue] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("ETH");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(null);

  function resolveToAddress() {
    const val = toValue.trim().toLowerCase();
    const target = USERS.find((u) => {
      if (toType === "username") return u.username.toLowerCase() === val;
      const h = (u.handles?.[toType] || "").toLowerCase();
      return h.replace(/^@/, "") === val.replace(/^@/, "");
    });
    return target?.address || null;
  }

  async function onSend(e) {
    e.preventDefault();
    setStatus(null);

    if (!isConnected) return setStatus({ kind: "error", msg: "Connect a wallet first (top-right)." });

    const to = resolveToAddress();
    if (!to) return setStatus({ kind: "error", msg: "Could not resolve recipient from the handle provided." });
    if (!amount || Number(amount) <= 0) return setStatus({ kind: "error", msg: "Enter a valid amount." });

    // TODO: Replace with wagmi write call.
    await new Promise((r) => setTimeout(r, 600));
    setStatus({ kind: "ok", msg: `Pretend-sent ${amount} ${asset} to ${to.slice(0,6)}…${to.slice(-4)}` });
    setAmount(""); setNote("");
  }

  return (
    <main className="pt-24 pb-16">
      <div className="mx-auto w-full max-w-2xl px-6">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Payments</h1>

        <div className="rounded-2xl border shadow-sm bg-white p-5 space-y-4">
          <div className="text-sm text-slate-600">
            {isConnected ? (
              <div>
                From (connected): <span className="font-mono">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
              </div>
            ) : (
              <div>Connect your wallet via the button in the top-right.</div>
            )}
          </div>

          <form onSubmit={onSend} className="space-y-4">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Type</label>
                <select value={toType} onChange={(e) => setToType(e.target.value)} className="w-full rounded-xl border px-3 py-2">
                  {handleTypes.map((h) => (<option key={h.key} value={h.key}>{h.label}</option>))}
                </select>
              </div>
              <div className="col-span-7">
                <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Handle</label>
                <input value={toValue} onChange={(e) => setToValue(e.target.value)} placeholder="e.g. @alice" className="w-full rounded-xl border px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="w-full rounded-xl border px-3 py-2" />
              </div>
              <div className="col-span-6">
                <label className="block text-xs font-medium text-slate-600 mb-1">Asset</label>
                <select value={asset} onChange={(e) => setAsset(e.target.value)} className="w-full rounded-xl border px-3 py-2">
                  <option>ETH</option>
                  <option disabled>USDC (soon)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Note (optional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thanks for the help!" className="w-full rounded-xl border px-3 py-2" />
            </div>

            <button type="submit" className="w-full md:w-auto inline-flex items-center gap-2 rounded-2xl px-4 py-2 border bg-slate-900 text-white hover:bg-slate-800">
              <Send className="h-4 w-4"/> Send
            </button>

            {status && (
              <div className={`text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}>{status.msg}</div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

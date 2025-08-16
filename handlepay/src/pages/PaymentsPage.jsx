import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAccount, useSendTransaction, useChainId } from "wagmi";
import { parseEther } from "viem";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { mainnet, base } from "viem/chains";
import USERS from "../data/seedUsers.js";
import { Send } from "lucide-react";

const DEST_CHAINS = [
  { id: mainnet.id, label: "Ethereum Mainnet", symbol: "ETH" },
  { id: base.id, label: "Base Mainnet", symbol: "ETH" },
];

const handleTypes = [
  { key: "username", label: "Username" },
  { key: "github",   label: "GitHub"   },
  { key: "twitter",  label: "X"        },
  { key: "telegram", label: "Telegram" },
];

export default function PaymentsPage() {
  // --- preload route params
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [toType, setToType]   = useState(params.get("toType")  || "username");
  const [toValue, setToValue] = useState(params.get("toValue") || "");

  // --- wallet / dynamic
  const { isConnected, address } = useAccount();
  const chainId = useChainId(); // current wallet chain
  const { setShowAuthFlow } = useDynamicContext();

  // --- wagmi native send
  const { sendTransaction, isPending } = useSendTransaction();

  // --- form state
  const [amount, setAmount] = useState("");
  const [destChainId, setDestChainId] = useState(base.id); // default to Base Sepolia
  const [status, setStatus] = useState(null);

  // (toy) handle → address resolver
  function resolveToAddress() {
    const val = toValue.trim().toLowerCase().replace(/^@/, "");
    const target = USERS.find((u) => {
      if (toType === "username") return u.username.toLowerCase() === val;
      const h = (u.handles?.[toType] || "").toLowerCase().replace(/^@/, "");
      return h === val;
    });
    return target?.address || null;
  }

  // Placeholder you’ll replace with your LayerZero logic
  async function crossChainTransfer({ fromChainId, toChainId, to, amountWei, note }) {
    // TODO: integrate LayerZero (OFT/adapter) here.
    // This is where you’d call your bridge/send function.
    console.log("LayerZero xchain:", { fromChainId, toChainId, to, amountWei: amountWei.toString(), note });
    // simulate async
    await new Promise(r => setTimeout(r, 800));
    return { txHash: "0x_simulated_lz" };
  }

  async function onSend(e) {
    e.preventDefault();
    setStatus(null);

    if (!isConnected) {
      setShowAuthFlow(true); // open Dynamic modal
      setStatus({ kind: "info", msg: "Please connect your wallet to continue." });
      return;
    }

    const to = resolveToAddress();
    if (!to) return setStatus({ kind: "error", msg: "Could not resolve recipient." });

    const valueWei = (() => {
      try { return parseEther(String(amount || "0")); } catch { return null; }
    })();
    if (!valueWei || amount <= 0) return setStatus({ kind: "error", msg: "Enter a valid amount." });

    try {
      if (chainId === destChainId) {
        // same chain → native transfer
        const tx = await sendTransaction({ to, value: valueWei });
        setStatus({ kind: "ok", msg: `Sent ${amount} ETH to ${to.slice(0,6)}…${to.slice(-4)} (same-chain)` });
      } else {
        // different chain → call your LZ bridge
        const res = await crossChainTransfer({
          fromChainId: chainId,
          toChainId: destChainId,
          to,
          amountWei: valueWei,
          note: "", // add if needed
        });
        setStatus({ kind: "ok", msg: `Cross-chain init ok → ${res.txHash || "LayerZero job queued"}` });
      }
      setAmount("");
    } catch (err) {
      setStatus({ kind: "error", msg: err?.shortMessage || err?.message || "Transaction failed" });
    }
  }

  return (
    <main className="pt-24 pb-16">
      <div className="mx-auto w-full max-w-2xl px-6">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Payments</h1>

        <div className="rounded-2xl border shadow-sm bg-white p-5 space-y-4">
          <div className="text-sm text-slate-600">
            {isConnected ? (
              <div>
                From (connected): <span className="font-mono">{address?.slice(0,6)}…{address?.slice(-4)}</span> ·
                Chain ID: <span className="font-mono">{chainId ?? "?"}</span>
              </div>
            ) : (
              <div>Not connected. Click <strong>Login</strong> (top-right) or press <strong>Send</strong> to open the modal.</div>
            )}
          </div>

          <form onSubmit={onSend} className="space-y-4">
            {/* Recipient */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Type</label>
                <select value={toType} onChange={(e) => setToType(e.target.value)} className="w-full rounded-xl border px-3 py-2">
                  {handleTypes.map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}
                </select>
              </div>
              <div className="col-span-7">
                <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Handle</label>
                <input value={toValue} onChange={(e) => setToValue(e.target.value)} placeholder="e.g. @alice" className="w-full rounded-xl border px-3 py-2" />
              </div>
            </div>

            {/* Amount + Destination Chain */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.01" className="w-full rounded-xl border px-3 py-2" />
              </div>
              <div className="col-span-6">
                <label className="block text-xs font-medium text-slate-600 mb-1">Destination Chain</label>
                <select value={destChainId} onChange={(e) => setDestChainId(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2">
                  {DEST_CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full md:w-auto inline-flex items-center gap-2 rounded-2xl px-4 py-2 border bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {isPending ? "Sending…" : chainId === destChainId ? "Send" : "Bridge via LayerZero"}
            </button>

            {status && (
              <div className={`text-sm ${
                status.kind === "ok" ? "text-emerald-600" :
                status.kind === "info" ? "text-sky-600" : "text-rose-600"
              }`}>
                {status.msg}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

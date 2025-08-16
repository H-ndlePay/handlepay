// src/pages/PaymentsPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccount, useSendTransaction, useChainId } from "wagmi";
import { parseEther } from "viem";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { mainnet, base } from "viem/chains";
import { Send, Check } from "lucide-react";

// Destination chains
const DEST_CHAINS = [
  { id: mainnet.id, label: "Ethereum Mainnet", symbol: "ETH" },
  { id: base.id,    label: "Base Mainnet",     symbol: "ETH" },
];

// Supported handle types
const handleTypes = [
  { key: "twitter",  label: "Twitter" },
  { key: "telegram", label: "Telegram" },
];

// The Graph endpoint & queries
const GRAPH_URL = "https://api.studio.thegraph.com/query/118793/handlepay-registry-base/v0.0.1";
async function graphRequest(query, variables) {
  const res = await fetch(GRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Graph request failed: ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors[0]?.message || "GraphQL error");
  return body.data;
}

const RESOLVE_HANDLE = /* GraphQL */ `
  query ResolveHandle($platform: String!, $username: String!) {
    handleAddeds(
      first: 1,
      where: { platform: $platform, username: $username },
      orderBy: blockTimestamp,
      orderDirection: desc
    ) {
      memberId
    }
  }
`;
const MEMBER_WALLET = /* GraphQL */ `
  query MemberWallet($memberId: BigInt!) {
    memberCreateds(where: { memberId: $memberId }) {
      wallet
    }
  }
`;

function normalizeHandleInput(v) {
  return String(v || "").trim().replace(/^@/, "");
}

export default function PaymentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const initialType = (params.get("toType") || "twitter").toLowerCase();
  const normalizedInitialType = initialType === "x" ? "twitter" : initialType;

  const [toType, setToType]   = useState(normalizedInitialType);
  const [toValue, setToValue] = useState(params.get("toValue") || "");

  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { setShowAuthFlow } = useDynamicContext();
  const { sendTransaction, isPending } = useSendTransaction();

  const [amount, setAmount] = useState("");
  const [destChainId, setDestChainId] = useState(base.id);
  const [status, setStatus] = useState(null);

  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [resolveError, setResolveError] = useState(null);

  const debounceRef = useRef(null);
  const destChainObj = useMemo(() => DEST_CHAINS.find((c) => c.id === destChainId) || DEST_CHAINS[0], [destChainId]);

  const resolveHandleToWallet = useCallback(async (platformKey, rawHandle) => {
    const platform = platformKey.toLowerCase();
    const username = normalizeHandleInput(rawHandle);
    if (!platform || !username) return null;
    const p = platform === "x" ? "twitter" : platform;

    setResolving(true);
    setResolveError(null);
    try {
      const r1 = await graphRequest(RESOLVE_HANDLE, { platform: p, username });
      const memberId = r1?.handleAddeds?.[0]?.memberId;
      if (!memberId) throw new Error("No member found.");

      const r2 = await graphRequest(MEMBER_WALLET, { memberId });
      const wallet = r2?.memberCreateds?.[0]?.wallet;
      if (!wallet) throw new Error("Wallet not found.");
      return wallet;
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const username = normalizeHandleInput(toValue);
    if (!username) {
      setResolvedAddress(null);
      setResolveError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const addr = await resolveHandleToWallet(toType, toValue);
        setResolvedAddress(addr);
        setResolveError(null);
      } catch (err) {
        setResolvedAddress(null);
        setResolveError(err?.message || "Failed to resolve.");
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [toType, toValue, resolveHandleToWallet]);

  const canEditPayment = !!resolvedAddress && !resolving;
  const canSubmit = canEditPayment && !isPending;

  async function crossChainTransfer({ fromChainId, toChainId, to, amountWei }) {
    console.log("LayerZero xchain:", { fromChainId, toChainId, to, amountWei: amountWei.toString() });
    await new Promise((r) => setTimeout(r, 800));
    return { txHash: "0x_simulated_layerzero" };
  }

  async function onSend(e) {
    e.preventDefault();
    setStatus(null);
    if (!isConnected) {
      setShowAuthFlow(true);
      return setStatus({ kind: "info", msg: "Please connect your wallet." });
    }

    let to = resolvedAddress;
    if (!to) {
      try {
        to = await resolveHandleToWallet(toType, toValue);
      } catch (err) {
        return setStatus({ kind: "error", msg: err?.message || "Could not resolve." });
      }
    }

    const valueWei = (() => {
      try { return parseEther(String(amount)); } catch { return null; }
    })();
    if (!valueWei || Number(amount) <= 0) return setStatus({ kind: "error", msg: "Invalid amount." });

    try {
      if (chainId === destChainId) {
        await sendTransaction({ to, value: valueWei });
        setStatus({
          kind: "ok",
          msg: `Sent ${amount} ${destChainObj.symbol} to ${to.slice(0, 6)}…${to.slice(-4)} (same-chain)`,
        });
      } else {
        const res = await crossChainTransfer({
          fromChainId: chainId,
          toChainId: destChainId,
          to,
          amountWei: valueWei,
        });
        setStatus({ kind: "ok", msg: `Cross-chain init → ${res.txHash}` });
      }
      setAmount("");
    } catch (err) {
      setStatus({ kind: "error", msg: err?.shortMessage || err?.message || "Transaction failed" });
    }
  }

  return (
    <main className="pt-24 pb-16">
      <div className="mx-auto w-full max-w-2xl px-6">
        <h1 className="text-2xl font-bold mb-4">Payments</h1>

        <div className="bg-white rounded-2xl border shadow p-5 space-y-4">
          <div className="text-sm text-slate-600">
            {isConnected ? (
              <div>
                From (connected):{" "}
                <span className="font-mono">
                  {address?.slice(0,6)}…{address?.slice(-4)}
                </span>{" "}
              </div>
            ) : (
              <div>
                Not connected. Click <strong>Login</strong> or press <strong>Send</strong>.
              </div>
            )}
          </div>

          <form onSubmit={onSend} className="space-y-4">
            {/* Recipient field */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Type</label>
                <select
                  value={toType}
                  onChange={(e) => setToType(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                >
                  {handleTypes.map((h) => (
                    <option key={h.key} value={h.key}>{h.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-7">
                <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Handle</label>
                <div className="relative">
                  <input
                    value={toValue}
                    onChange={(e) => setToValue(e.target.value)}
                    placeholder="e.g. @alice"
                    className="w-full rounded-xl border px-3 py-2 pr-10"
                  />
                  {resolvedAddress && !resolving && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600 pointer-events-none" />
                  )}
                </div>
                <div className="mt-1 text-xs">
                  {resolving && <span className="text-slate-500">Resolving…</span>}
                  {!resolving && resolveError &&(
                    <span className="text-rose-600">Could not resolve handle.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Amount and chain (disabled until resolved) */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Amount ({destChainObj.symbol})
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.01"
                  className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={!canEditPayment}
                />
              </div>
              <div className="col-span-6">
                <label className="block text-xs font-medium text-slate-600 mb-1">Destination Chain</label>
                <select
                  value={destChainId}
                  onChange={(e) => setDestChainId(Number(e.target.value))}
                  className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={!canEditPayment}
                >
                  {DEST_CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full md:w-auto inline-flex items-center gap-2 rounded-2xl px-4 py-2 border bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              {isPending ? "Sending…" : chainId === destChainId ? "Send" : "Bridge via LayerZero"}
            </button>

            {status && (
              <div className={`text-sm ${
                status.kind === "ok" ? "text-emerald-600" :
                status.kind === "info" ? "text-sky-600" :
                "text-rose-600"
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

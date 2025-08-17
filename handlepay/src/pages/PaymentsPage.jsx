// src/pages/PaymentsPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  useAccount,
  useSendTransaction,
  useChainId,
  useWriteContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { parseEther, parseUnits, isAddress, toHex, encodeFunctionData } from "viem";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { mainnet, base } from "viem/chains";
import { Send, Check } from "lucide-react";
import { graphClient } from "../lib/graphClient";

/* ──────────────────────────────────────────────────────────
   CHAINS
   ────────────────────────────────────────────────────────── */
const DEST_CHAINS = [
  { id: mainnet.id, label: "Ethereum Mainnet", symbol: "ETH" },
  { id: base.id,    label: "Base Mainnet",     symbol: "ETH" },
];

/* USDC mainnet addresses */
const USDC_ADDRESSES = {
  [mainnet.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eb48",
  [base.id]:    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

/* Your HandleRegistry addresses per chain */
const REGISTRY_ADDRESSES = {
  // [mainnet.id]: "0xYourEthereumMainnetRegistry",
  [base.id]: "0x132727D74dF3246b64046598626415258dc648f0", // Base mainnet
};

/* Minimal ABIs */
const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
];

const HANDLE_REGISTRY_ABI = [
  {
    type: "function",
    name: "payToHandle",
    stateMutability: "payable",
    inputs: [
      { name: "platform", type: "string" },
      { name: "username", type: "string" },
    ],
    outputs: [],
  },
];

/* Handle types — now includes Discord & Instagram */
const HANDLE_TYPES = [
  { key: "twitter",   label: "Twitter"   },
  { key: "telegram",  label: "Telegram"  },
  { key: "discord",   label: "Discord"   },
  { key: "instagram", label: "Instagram" },
];

/* Graph queries (case-insensitive via username_in) */
const RESOLVE_HANDLE = `
  query ResolveHandle($platform: String!, $usernames: [String!]) {
    handleAddeds(
      first: 1,
      where: { platform: $platform, username_in: $usernames },
      orderBy: blockTimestamp,
      orderDirection: desc
    ) { memberId username }
  }
`;
const MEMBER_WALLET = `
  query MemberWallet($memberId: BigInt!) {
    memberCreateds(where: { memberId: $memberId }) { wallet }
  }
`;

/* Helpers */
const DEBUG = true;
const stripAt = (v) => String(v || "").trim().replace(/^@/, "");
const toTitle = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v);
function usernameCandidates(raw) {
  const baseName = stripAt(raw);
  const lower = baseName.toLowerCase();
  const upper = baseName.toUpperCase();
  const title = toTitle(baseName);
  return Array.from(new Set([baseName, lower, upper, title].filter(Boolean)));
}

export default function PaymentsPage() {
  // Prefill from URL
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialType = (params.get("toType") || "twitter").toLowerCase();
  const normalizedInitialType = initialType === "x" ? "twitter" : initialType;

  // Wallet & clients
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { setShowAuthFlow } = useDynamicContext();

  // wagmi helpers (used for native send & ERC20 transfer)
  const { sendTransaction, isPending: isNativePending } = useSendTransaction();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  // Form state
  const [toType, setToType]           = useState(normalizedInitialType);
  const [toValue, setToValue]         = useState(params.get("toValue") || "");
  const [currency, setCurrency]       = useState("ETH"); // ETH | USDC
  const [amount, setAmount]           = useState("");
  const [destChainId, setDestChainId] = useState(base.id);
  const [status, setStatus]           = useState(null);

  // Resolution state
  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [resolvedUsernameCased, setResolvedUsernameCased] = useState(null);
  const [resolvedPlatform, setResolvedPlatform] = useState(null);
  const [resolveError, setResolveError] = useState(null);
  const debounceRef = useRef(null);

  // Derived
  const destChainObj = useMemo(
    () => DEST_CHAINS.find((c) => c.id === destChainId) || DEST_CHAINS[0],
    [destChainId]
  );
  const isPending = isNativePending || isWritePending;
  const canEditPayment = !!resolvedAddress && !resolving;
  const canSubmit = canEditPayment && !isPending;

  // Default Destination Chain to the current wallet chain when connected
  useEffect(() => {
    if (chainId && destChainId !== chainId) {
      setDestChainId(chainId);
    }
  }, [chainId]); // eslint-disable-line

  // Resolver using username_in (case-insensitive)
  const resolveHandleToWallet = useCallback(async (platformKey, rawHandle) => {
    const platform = (platformKey || "").toLowerCase().trim();
    if (!platform) return null;
    const p = platform === "x" ? "twitter" : platform; // normalize X→twitter

    const usernames = usernameCandidates(rawHandle);
    if (!usernames.length) return null;

    setResolving(true);
    setResolveError(null);
    try {
      const r1 = await graphClient.request(RESOLVE_HANDLE, { platform: p, usernames });
      const entry = r1?.handleAddeds?.[0];
      if (!entry?.memberId) throw new Error("No member found for that handle.");

      const r2 = await graphClient.request(MEMBER_WALLET, { memberId: entry.memberId });
      const wallet = r2?.memberCreateds?.[0]?.wallet;
      if (!wallet || !isAddress(wallet)) throw new Error("Member wallet not found.");

      if (DEBUG) console.log("[resolve]:", { platform: p, input: rawHandle, username: entry.username, wallet });
      return { wallet, usernameCased: entry.username, platform: p };
    } finally {
      setResolving(false);
    }
  }, []);

  // Debounce resolve as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const candidates = usernameCandidates(toValue);
    if (!candidates.length) {
      setResolvedAddress(null);
      setResolvedUsernameCased(null);
      setResolvedPlatform(null);
      setResolveError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await resolveHandleToWallet(toType, toValue);
        setResolvedAddress(res?.wallet || null);
        setResolvedUsernameCased(res?.usernameCased || null);
        setResolvedPlatform(res?.platform || null);
        setResolveError(null);
      } catch (err) {
        setResolvedAddress(null);
        setResolvedUsernameCased(null);
        setResolvedPlatform(null);
        setResolveError(err?.message || "Failed to resolve handle.");
      }
    }, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [toType, toValue, resolveHandleToWallet]);

  // Force a wallet native send prompt using EIP-1193 (fallback)
  async function promptNativeViaEip1193({ from, to, valueWei, data }) {
    if (typeof window === "undefined" || !window.ethereum)
      throw new Error("No injected wallet found.");
    const hexValue =
      typeof valueWei === "bigint" ? toHex(valueWei) : `0x${BigInt(valueWei).toString(16)}`;
    const params = [{ from, to, value: hexValue }];
    if (data) params[0].data = data;
    if (DEBUG) console.log("[fallback] eth_sendTransaction", params[0]);
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params,
    });
    return txHash;
  }

  // Cross-chain stubs (simulate only)
  async function bridgeEthWithLayerZero({ fromChainId, toChainId, to, amountWei }) {
    console.log("Simulate LayerZero ETH bridge →", { fromChainId, toChainId, to, amountWei: amountWei.toString() });
    await new Promise((r) => setTimeout(r, 600));
    return { txHash: "0x_simulated_lz_eth" };
  }
  async function bridgeUsdcWithCCTP({ fromChainId, toChainId, to, amountUSDC6 }) {
    console.log("Simulate CCTP v2 USDC bridge →", { fromChainId, toChainId, to, amountUSDC6: amountUSDC6.toString() });
    await new Promise((r) => setTimeout(r, 600));
    return { messageId: "cctp_v2_message_simulated" };
  }

  // Submit
  async function onSend(e) {
    e.preventDefault();
    setStatus(null);

    if (!isConnected) {
      setShowAuthFlow(true);
      return setStatus({ kind: "info", msg: "Please connect your wallet to continue." });
    }

    // Fresh resolution (wallet + canonical username/platform)
    let to = resolvedAddress;
    let platformCanonical = resolvedPlatform;
    let usernameCanonical = resolvedUsernameCased;

    if (!to || !platformCanonical || !usernameCanonical) {
      try {
        const res = await resolveHandleToWallet(toType, toValue);
        to = res.wallet;
        platformCanonical = res.platform;
        usernameCanonical = res.usernameCased;
      } catch (err) {
        return setStatus({ kind: "error", msg: err?.message || "Could not resolve recipient." });
      }
    }

    try {
      if (currency === "ETH") {
        // ETH path
        const valueWei = (() => { try { return parseEther(String(amount || "0")); } catch { return null; } })();
        if (!valueWei || Number(amount) <= 0) {
          return setStatus({ kind: "error", msg: "Enter a valid ETH amount." });
        }

        if (chainId === destChainId) {
          // ✅ SAME-CHAIN ETH — REAL TX (no explicit simulate)
          const registryAddr = REGISTRY_ADDRESSES[destChainId];

          if (registryAddr) {
            // Build calldata for payToHandle(platform, username)
            const data = encodeFunctionData({
              abi: HANDLE_REGISTRY_ABI,
              functionName: "payToHandle",
              args: [platformCanonical, usernameCanonical],
            });

            try {
              if (!walletClient) throw new Error("No wallet client available.");
              // This sends a real transaction with data+value; wallet will prompt
              const txHash = await walletClient.sendTransaction({
                to: registryAddr,
                account: address,
                value: valueWei,
                data,
              });

              setStatus({
                kind: "ok",
                msg: `Submitted: ${txHash.slice(0, 10)}… — paying ${amount} ETH to ${usernameCanonical} via HandleRegistry.`,
              });
            } catch (sendErr) {
              console.error("[payToHandle] sendTransaction failed, falling back to native:", sendErr);
              // Fallback: plain native send to resolved wallet to guarantee a prompt
              try {
                const txHash = await promptNativeViaEip1193({ from: address, to, valueWei });
                setStatus({
                  kind: "ok",
                  msg: `Fallback native transfer submitted: ${txHash.slice(0, 10)}…`,
                });
              } catch (ee) {
                setStatus({ kind: "error", msg: ee?.message || "Transaction failed." });
              }
            }
          } else {
            // No registry for this chain → direct native send
            await sendTransaction({ account: address, to, value: valueWei, chainId });
            setStatus({
              kind: "ok",
              msg: `Sent ${amount} ETH to ${to.slice(0, 6)}…${to.slice(-4)}.`,
            });
          }
        } else {
          // 🔁 CROSS-CHAIN ETH (simulated only)
          const res = await bridgeEthWithLayerZero({
            fromChainId: chainId,
            toChainId: destChainId,
            to,
            amountWei: valueWei,
          });
          setStatus({ kind: "ok", msg: `LayerZero (sim) → ${res.txHash}` });
        }
      } else {
        // USDC path
        const usdcAddr = USDC_ADDRESSES[destChainId];
        if (!usdcAddr) return setStatus({ kind: "error", msg: "USDC not supported on selected chain." });

        const amountUSDC6 = (() => { try { return parseUnits(String(amount || "0"), 6); } catch { return null; } })();
        if (!amountUSDC6 || Number(amount) <= 0) {
          return setStatus({ kind: "error", msg: "Enter a valid USDC amount." });
        }

        if (chainId === destChainId) {
          // Same-chain USDC (standard ERC-20 transfer; wagmi may simulate under the hood)
          await writeContractAsync({
            abi: ERC20_ABI,
            address: usdcAddr,
            functionName: "transfer",
            args: [to, amountUSDC6],
            account: address,
            chainId,
          });
          setStatus({
            kind: "ok",
            msg: `Sent ${amount} USDC to ${to.slice(0, 6)}…${to.slice(-4)}.`,
          });
        } else {
          // 🔁 CROSS-CHAIN USDC (simulated only)
          const res = await bridgeUsdcWithCCTP({
            fromChainId: chainId,
            toChainId: destChainId,
            to,
            amountUSDC6,
          });
          setStatus({ kind: "ok", msg: `CCTP v2 (sim) → ${res.messageId}` });
        }
      }

      setAmount("");
    } catch (err) {
      console.error("[send] error:", err);
      setStatus({ kind: "error", msg: err?.shortMessage || err?.message || "Transaction failed." });
    }
  }

  return (
    <main className="bg-gray-50 min-h-screen">
      {/* Full-viewport centering with room for fixed nav (top-24 / bottom-16) */}
      <div className="fixed left-0 right-0 top-24 bottom-16 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <h1 className="text-2xl font-bold mb-4 text-center">Payments</h1>

          <div className="bg-white rounded-2xl border shadow p-5 space-y-4">
            <div className="text-sm text-slate-600 text-center">
              {isConnected ? (
                <div>
                  From: <span className="font-mono">{address?.slice(0,6)}…{address?.slice(-4)}</span>
                  {" · "}Chain ID: <span className="font-mono">{chainId ?? "?"}</span>
                </div>
              ) : (
                <div>Not connected. Click <strong>Login</strong> or press <strong>Send</strong>.</div>
              )}
            </div>

            <form onSubmit={onSend} className="space-y-4">
              {/* Recipient */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Recipient Type</label>
                  <select value={toType} onChange={(e) => setToType(e.target.value)} className="w-full rounded-xl border px-3 py-2">
                    {HANDLE_TYPES.map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}
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
                    {!resolving && resolveError && <span className="text-rose-600">Could not resolve handle.</span>}
                    {!resolving && !resolvedAddress && !resolveError && (
                      <span className="text-slate-500">Enter a valid handle to continue.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Currency / Amount / Destination (disabled until resolved) */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!canEditPayment}
                  >
                    <option value="ETH">ETH</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount ({currency})</label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder={currency === "ETH" ? "0.01" : "10"}
                    className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!canEditPayment}
                  />
                </div>
                <div className="col-span-4">
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
                {isPending
                  ? "Waiting for wallet…"
                  : chainId === destChainId
                    ? `Send ${currency}`
                    : currency === "ETH"
                      ? "Bridge via LayerZero (sim)"
                      : "Bridge via CCTP v2 (sim)"}
              </button>

              {status && (
                <div className={`text-sm ${
                  status.kind === "ok" ? "text-emerald-600"
                  : status.kind === "info" ? "text-sky-600"
                  : "text-rose-600"
                }`}>
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

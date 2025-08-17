// src/lib/handleRegistry.js
import { createPublicClient, http, decodeEventLog } from "viem";
import { base } from "viem/chains";

/** 🔁 PUT YOUR REAL DEPLOYED ADDRESS HERE (Base mainnet) */
export const HANDLE_REGISTRY_ADDRESS = "0x132727D74dF3246b64046598626415258dc648f0";

/** Minimal ABI for reads + events used below */
export const handleRegistryAbi = [
  // reads
  {
    type: "function",
    stateMutability: "view",
    name: "nextMemberId",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "members",
    inputs: [{ type: "uint256" }],
    outputs: [
      { type: "uint256", name: "id" },
      { type: "address", name: "wallet" },
      { type: "uint256", name: "joinedBlock" },
      { type: "bool",    name: "isActive" },
    ],
  },
  // events
  {
    type: "event",
    name: "MemberCreated",
    inputs: [
      { indexed: true,  type: "uint256", name: "memberId" },
      { indexed: false, type: "address", name: "wallet" },
    ],
  },
  {
    type: "event",
    name: "HandleAdded",
    inputs: [
      { indexed: true,  type: "uint256", name: "memberId" },
      { indexed: false, type: "string",  name: "platform" },
      { indexed: false, type: "string",  name: "username" },
    ],
  },
];

export const client = createPublicClient({
  chain: base,                 // Base mainnet
  transport: http(),           // Consider using your own RPC: http("https://base-mainnet.g.alchemy.com/v2/<KEY>")
});

/**
 * Load active members + handles from chain.
 * - Reads members 1..nextMemberId-1 and filters isActive
 * - Scans HandleAdded logs and attaches { [platform]: username } to each member
 * @param {bigint|number} fromBlock (optional) deployment block for faster scans
 */
export async function loadRegistry({ fromBlock } = {}) {
  // 1) Read nextMemberId
  const nextId = await client.readContract({
    address: HANDLE_REGISTRY_ADDRESS,
    abi: handleRegistryAbi,
    functionName: "nextMemberId",
  });

  // 2) Pull active members
  const members = [];
  const upper = Number(nextId ?? 1n);
  for (let id = 1; id < upper; id++) {
    try {
      const m = await client.readContract({
        address: HANDLE_REGISTRY_ADDRESS,
        abi: handleRegistryAbi,
        functionName: "members",
        args: [BigInt(id)],
      });
      if (m?.isActive) {
        members.push({
          id,
          wallet: m.wallet,
          joinedBlock: m.joinedBlock,
          isActive: m.isActive,
          handles: {}, // to be filled from logs
        });
      }
    } catch {
      // tolerate gaps
    }
  }
  if (!members.length) return [];

  // 3) Build index
  const byId = new Map(members.map((m) => [m.id, m]));

  // 4) Scan logs (fromBlock optional but recommended)
  const logs = await client.getLogs({
    address: HANDLE_REGISTRY_ADDRESS,
    fromBlock: fromBlock ?? 0n,
    toBlock: "latest",
  });

  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: handleRegistryAbi, ...log });
      if (decoded.eventName === "HandleAdded") {
        const { memberId, platform, username } = decoded.args;
        const m = byId.get(Number(memberId));
        if (m) m.handles[platform] = username;
      }
    } catch {
      // ignore unrelated / non-decodable logs
    }
  }

  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** Resolve a (platform, username) → wallet address (reads + a quick log scan) */
export async function getWalletForHandle(platform, username, { fromBlock } = {}) {
  const normalized = String(username).replace(/^@/, "");
  const list = await loadRegistry({ fromBlock });
  for (const m of list) {
    if ((m.handles?.[platform] || "").replace(/^@/, "") === normalized) return m.wallet;
  }
  return null;
}

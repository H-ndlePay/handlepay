// src/pages/UsersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { graphClient } from "../lib/graphClient";
import { MEMBERS, HANDLES_FOR_MEMBER } from "../lib/queries";
import { User, AtSign, Search, Check } from "lucide-react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const ethClient = createPublicClient({ chain: mainnet, transport: http() });
const DEBUG_ENS = false;

// Blue circle + white check (Twitter/Instagram-style)
function VerifiedBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-sky-500 text-white align-middle ${className}`}
      style={{ width: 14, height: 14 }}
      title="Verified via ENS"
      aria-label="Verified via ENS"
    >
      <Check className="w-[9px] h-[9px]" strokeWidth={3} />
    </span>
  );
}

// Normalize to bare username (no @, no links), lowercase
function normalizeHandle(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/^@/, "");
  s = s.replace(/^https?:\/\/(www\.)?t\.me\//i, "");
  s = s.replace(/^t\.me\//i, "");
  s = s.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "");
  s = s.replace(/[\/#?].*$/, "");
  return s.toLowerCase();
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [platformFilter, setPlatformFilter] = useState("all"); // all|twitter|telegram
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const { memberCreateds } = await graphClient.request(MEMBERS);

      const enriched = await Promise.all(
        memberCreateds.map(async (m) => {
          const { handleAddeds } = await graphClient.request(HANDLES_FOR_MEMBER, {
            memberId: m.memberId,
          });

          let ensName = null;
          let ensAvatar = null;
          let ensTwitterRaw = "";
          let ensTelegramRaw = "";
          let ensSocial = { twitter: "", telegram: "" };

          try {
            ensName = await ethClient.getEnsName({ address: m.wallet });
            if (DEBUG_ENS) {
              console.groupCollapsed(
                `%c[ENS] Wallet ${m.wallet}`,
                "color:#2563eb;font-weight:bold"
              );
              console.log("Reverse-resolved ENS:", ensName || "(none)");
            }
            if (ensName) {
              ensAvatar = await ethClient.getEnsAvatar({ name: ensName });
              // Twitter standard key
              ensTwitterRaw = await ethClient.getEnsText({
                name: ensName,
                key: "com.twitter",
              });
              // Telegram standard key (org.telegram); also check com.telegram as fallback
              ensTelegramRaw =
                (await ethClient.getEnsText({ name: ensName, key: "org.telegram" })) ||
                (await ethClient.getEnsText({ name: ensName, key: "com.telegram" }));

              ensSocial = {
                twitter: normalizeHandle(ensTwitterRaw),
                telegram: normalizeHandle(ensTelegramRaw),
              };

              if (DEBUG_ENS) {
                console.log("Avatar:", ensAvatar || "(none)");
                console.log("com.twitter:", ensTwitterRaw || "(none)");
                console.log("org/com.telegram:", ensTelegramRaw || "(none)");
                console.log("Normalized ENS socials:", ensSocial);
              }
            }
          } catch (e) {
            if (DEBUG_ENS) console.error("ENS lookup failed for", m.wallet, e);
          } finally {
            if (DEBUG_ENS) console.groupEnd?.();
          }

          return {
            ...m,
            handles: handleAddeds || [],
            ensName,
            ensAvatar,
            ensSocial, // { twitter, telegram }
          };
        })
      );

      setUsers(enriched);
    }
    load();
  }, []);

  // Filter by platform + query
  const filtered = useMemo(() => {
    const q = normalizeHandle(query);
    if (platformFilter === "all" && !q) return users;

    return users
      .map((u) => {
        const handles = (u.handles || []).filter((h) => {
          const p = String(h.platform || "").toLowerCase();
          const uname = normalizeHandle(h.username);
          const platformOk =
            platformFilter === "all" ||
            (platformFilter === "twitter" && (p === "twitter" || p === "x")) ||
            (platformFilter === "telegram" && p === "telegram");
          const queryOk = !q || uname.includes(q);
          return platformOk && queryOk;
        });
        return { ...u, handles };
      })
      .filter((u) => u.handles.length > 0 || (platformFilter === "all" && !q));
  }, [users, platformFilter, query]);

  return (
    <main className="pt-24 pb-16 bg-gray-50 min-h-screen">
      {/* Full-width container (no max-w cap) */}
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-10 space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Member Directory</h1>

        {/* 🔎 Search + Filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="h-10 rounded-lg border bg-white px-3 text-sm"
            aria-label="Platform filter"
          >
            <option value="all">All</option>
            <option value="twitter">Twitter</option>
            <option value="telegram">Telegram</option>
          </select>

          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                platformFilter === "all" ? "Search handles…" : `Search ${platformFilter} usernames…`
              }
              className="w-full h-10 pl-9 pr-3 rounded-lg border bg-white text-sm"
              aria-label="Search handles"
            />
          </div>
        </div>

        {/* Responsive grid: full-width, scales up to 4 columns on xl */}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((u) => {
            const first = u.handles[0];
            const defaultLink = first
              ? `/payments?toType=${encodeURIComponent(first.platform)}&toValue=${encodeURIComponent(
                  first.username
                )}`
              : null;

            const Card = (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  {u.ensAvatar ? (
                    <img
                      src={u.ensAvatar}
                      alt="ENS Avatar"
                      className="h-10 w-10 rounded-full border"
                    />
                  ) : (
                    <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <User size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    {u.ensName ? (
                      <>
                        <p className="font-medium text-gray-800 truncate">{u.ensName}</p>
                        <p className="text-xs text-gray-500 truncate">{u.wallet}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500">Wallet</p>
                        <p className="font-mono text-sm text-gray-800 truncate">{u.wallet}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Handles */}
                {u.handles.length > 0 ? (
                  <ul className="space-y-2">
                    {u.handles.map((h, i) => {
                      const platform = String(h.platform || "").trim().toLowerCase();
                      const uname = normalizeHandle(h.username);
                      const key = platform === "x" ? "twitter" : platform;

                      // Per-handle ENS match (badge shown only when usernames match)
                      const isVerified =
                        (key === "twitter" && u.ensSocial.twitter && uname === u.ensSocial.twitter) ||
                        (key === "telegram" && u.ensSocial.telegram && uname === u.ensSocial.telegram);

                      const to = `/payments?toType=${encodeURIComponent(h.platform)}&toValue=${encodeURIComponent(
                        h.username
                      )}`;

                      return (
                        <li key={i} className="text-sm">
                          <Link
                            to={to}
                            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 group"
                            title="Send payment"
                          >
                            <AtSign className="h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                            {/* Platform name WITHOUT leading '@' */}
                            <span className="font-medium capitalize">{h.platform}</span>
                            {/* Keep @ for the username (remove this span to hide '@username') */}
                            <span className="text-gray-600">@{h.username}</span>
                            {isVerified && <VerifiedBadge className="ml-1" />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic">No handles added yet</p>
                )}
              </div>
            );

            return defaultLink ? (
              <div
                key={u.memberId}
                role="button"
                tabIndex={0}
                onClick={() => navigate(defaultLink)}
                onKeyDown={(e) => e.key === "Enter" && navigate(defaultLink)}
                className="cursor-pointer"
              >
                {Card}
              </div>
            ) : (
              <div key={u.memberId}>{Card}</div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

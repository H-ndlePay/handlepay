// src/pages/UsersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { graphClient } from "../lib/graphClient";
import { MEMBERS, HANDLES_FOR_MEMBER } from "../lib/queries";
import { User, Search } from "lucide-react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

import { FaSquareXTwitter } from "react-icons/fa6";
import { FaTelegramPlane, FaDiscord, FaInstagram } from "react-icons/fa";

const ethClient = createPublicClient({ chain: mainnet, transport: http() });
const DEBUG_ENS = false;

// Normalize to bare username (no @, no links), lowercase
function normalizeHandle(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/^@/, "");
  s = s.replace(/^https?:\/\/(www\.)?t\.me\//i, "");
  s = s.replace(/^t\.me\//i, "");
  s = s.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "");
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  s = s.replace(/[\/#?].*$/, "");
  return s.toLowerCase();
}

const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [platformFilter, setPlatformFilter] = useState("all"); // all|twitter|telegram|discord|instagram
  const [query, setQuery] = useState("");

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
              if (DEBUG_ENS) console.log("Avatar:", ensAvatar || "(none)");
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
            (platformFilter === "telegram" && p === "telegram") ||
            (platformFilter === "discord" && p === "discord") ||
            (platformFilter === "instagram" && p === "instagram");
          const queryOk = !q || uname.includes(q);
          return platformOk && queryOk;
        });
        return { ...u, handles };
      })
      .filter((u) => u.handles.length > 0 || (platformFilter === "all" && !q));
  }, [users, platformFilter, query]);

  // Platform row (ONLY @username navigates to payments)
  function PlatformRow({ platformRaw, username }) {
    const platform = String(platformRaw || "").toLowerCase();
    const uname = normalizeHandle(username);

    let Icon = null;
    let label = platformRaw;
    let externalUrl = null;
    let externalText = null;

    if (platform === "twitter" || platform === "x") {
      Icon = FaSquareXTwitter;
      externalUrl = `https://x.com/${encodeURIComponent(uname)}`;
      externalText = "View on X";
      label = "Twitter";
    } else if (platform === "telegram") {
      Icon = FaTelegramPlane;
      externalUrl = `https://t.me/${encodeURIComponent(uname)}`;
      externalText = "Chat on Telegram";
      label = "Telegram";
    } else if (platform === "discord") {
      Icon = FaDiscord;
      if (/^\d+$/.test(uname)) {
        externalUrl = `https://discord.com/users/${uname}`;
      } else {
        externalUrl = `https://discord.com/app`;
      }
      externalText = "Message on Discord";
      label = "Discord";
    } else if (platform === "instagram") {
      Icon = FaInstagram;
      externalUrl = `https://instagram.com/${encodeURIComponent(uname)}`;
      externalText = "View on Instagram";
      label = "Instagram";
    }

    const paymentLink = `/payments?toType=${encodeURIComponent(platformRaw)}&toValue=${encodeURIComponent(
      username
    )}`;

    return (
      <li className="text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          {Icon && <Icon className="h-4 w-4 text-gray-600 shrink-0" />}
          <span className="font-medium capitalize">{label}</span>

          {/* Clicking @username → Payments */}
          <Link
            to={paymentLink}
            className="text-gray-600 hover:text-gray-900"
            title="Pay this handle"
          >
            @{username}
          </Link>

          {/* External link (never triggers Payments) */}
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="ml-auto text-[11px] text-sky-600 hover:text-sky-700"
              title={externalText}
            >
              {externalText}
            </a>
          )}
        </div>
      </li>
    );
  }

  return (
    <main className="pt-24 pb-16 bg-gray-50 min-h-screen">
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-10 space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Member Directory</h1>

        {/* Search + Filter */}
        <div className="flex items-center gap-3">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="h-10 rounded-lg border bg-white px-3 text-sm"
            aria-label="Platform filter"
          >
            <option value="all">All</option>
            <option value="twitter">Twitter</option>
            <option value="telegram">Telegram</option>
            <option value="discord">Discord</option>
            <option value="instagram">Instagram</option>
          </select>

          {/* Full stretch search bar */}
          <div className="flex-1 relative">
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

        {/* Cards */}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((u) => {
            return (
              <div
                key={u.memberId}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition"
              >
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
                    <p className="font-medium text-gray-800 truncate">
                      {u.ensName || "Member"}
                    </p>
                    {/* ▼ Wallet address directly below the name */}
                    <p className="font-mono text-xs text-gray-500 truncate">
                      {shortAddr(u.wallet)}
                    </p>
                  </div>
                </div>

                {/* Handles */}
                {u.handles.length > 0 ? (
                  <ul className="space-y-2">
                    {u.handles.map((h, i) => (
                      <PlatformRow key={i} platformRaw={h.platform} username={h.username} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic">No handles added yet</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

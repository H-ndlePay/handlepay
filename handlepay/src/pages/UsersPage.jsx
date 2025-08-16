import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Github, Twitter, MessageCircle, Wallet } from "lucide-react";
import SearchBar from "../components/SearchBar.jsx";
import USERS from "../data/seedUsers.js";

const handleTypes = ["username", "github", "twitter", "telegram"]; 

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function UsersPage() {
  const q = useQuery().get("q") || "";
  const [users] = useState(USERS);

  const filtered = useMemo(() => {
    if (!q) return users;
    const [maybeType, ...rest] = q.split(":");
    const value = rest.join(":").toLowerCase();
    const type = handleTypes.includes(maybeType) ? maybeType : "username";
    return users.filter((u) => {
      if (type === "username") return u.username.toLowerCase().includes(value);
      const v = u.handles?.[type]?.toLowerCase?.() || "";
      return v.includes(value.replace(/^@/, ""));
    });
  }, [q, users]);

  return (
    <main className="pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <div className="flex w-full max-w-2xl rounded-lg border bg-white shadow-sm overflow-hidden">
            <select className="px-3 py-2 text-sm text-slate-700 border-r outline-none focus:ring-0 bg-white">
              <option value="username">Username</option>
              <option value="github">GitHub</option>
              <option value="twitter">Twitter</option>
              <option value="telegram">Telegram</option>
            </select>
            <input
              type="text"
              placeholder="Search by username..."
              className="flex-1 px-3 py-2 text-sm outline-none bg-white"
            />
            <button className="px-4 text-slate-600 hover:text-slate-900">🔍</button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-slate-600">No users found.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((u) => (
              <motion.div key={u.username} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border shadow-sm p-4 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">@{u.username}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[18rem]">{u.address}</div>
                  </div>
                  <Wallet className="h-5 w-5 text-slate-400" />
                </div>
                <div className="mt-3 text-sm text-slate-700 space-y-1">
                  <div className="flex items-center gap-2"><Github className="h-4 w-4"/> {u.handles.github}</div>
                  <div className="flex items-center gap-2"><Twitter className="h-4 w-4"/> {u.handles.twitter}</div>
                  <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4"/> {u.handles.telegram}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

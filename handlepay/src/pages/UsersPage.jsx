import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Github, Twitter, MessageCircle, Wallet } from "lucide-react";
import SearchBar from "../components/SearchBar.jsx";
import { loadRegistry } from "../lib/handleRegistry.js";

const handleTypes = ["username", "github", "twitter", "telegram"];

function useQueryString() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function UsersPage() {
  const qs = useQueryString();
  const q = qs.get("q") || "";
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["handle-registry"],
    queryFn: () => loadRegistry(/* optionally { fromBlock: 12345678n } */),
    staleTime: 30_000,
  });

  const users = data || [];

  const filtered = useMemo(() => {
    if (!q) return users;
    const [maybeType, ...rest] = q.split(":");
    const value = rest.join(":").toLowerCase();
    const type = handleTypes.includes(maybeType) ? maybeType : "username";

    return users.filter((u) => {
      if (type === "username") {
        // No explicit top-level username in contract; search any handle string
        return Object.values(u.handles || {})
          .join(" ")
          .toLowerCase()
          .includes(value.replace(/^@/, ""));
      }
      const handle = (u.handles?.[type] || "").toLowerCase();
      return handle.replace(/^@/, "").includes(value.replace(/^@/, ""));
    });
  }, [q, users]);

  const goToPay = (type, value) =>
    navigate(`/payments?toType=${encodeURIComponent(type)}&toValue=${encodeURIComponent(value)}`);

  return (
    <main className="pt-24 pb-16">
      <div className="mx-auto w-full max-w-7xl px-6 space-y-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <SearchBar />
        </div>

        {isLoading && <div className="text-slate-600">Loading from Base…</div>}
        {error && <div className="text-rose-600 text-sm">Failed to load registry.</div>}

        {!isLoading && filtered.length === 0 ? (
          <div className="text-slate-600">No users found.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((u) => {
              const primary =
                u.handles?.twitter ||
                u.handles?.github ||
                u.handles?.telegram ||
                u.wallet;

              return (
                <motion.div
                  key={`member-${u.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border shadow-sm p-4 bg-white cursor-pointer hover:shadow-md"
                  onClick={() => goToPay("username", primary)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold">
                        {primary?.startsWith("0x") ? (
                          <span className="font-mono">
                            {primary.slice(0, 6)}…{primary.slice(-4)}
                          </span>
                        ) : (
                          primary
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-[18rem] font-mono">
                        {u.wallet.slice(0, 10)}…{u.wallet.slice(-8)}
                      </div>
                    </div>
                    <Wallet className="h-5 w-5 text-slate-400" />
                  </div>

                  <div className="mt-3 text-sm text-slate-700 space-y-1">
                    {u.handles?.github && (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToPay("github", u.handles.github);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <Github className="h-4 w-4" /> {u.handles.github}
                      </div>
                    )}
                    {u.handles?.twitter && (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToPay("twitter", u.handles.twitter);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <Twitter className="h-4 w-4" /> {u.handles.twitter}
                      </div>
                    )}
                    {u.handles?.telegram && (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToPay("telegram", u.handles.telegram);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <MessageCircle className="h-4 w-4" /> {u.handles.telegram}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

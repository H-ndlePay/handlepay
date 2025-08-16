import React from "react";
import { Link, useLocation } from "react-router-dom";
import { UsersRound, Send } from "lucide-react";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";

function Logo() {
  return (
    <Link to="/" className="font-extrabold text-xl tracking-tight">
      <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">Handle</span>
      <span className="text-slate-900">Pay</span>
    </Link>
  );
}

export default function Nav() {
  const { pathname } = useLocation();
  const linkCls = (p) => `px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2 ${pathname===p?"bg-slate-100": ""}`;

  return (
    <nav className="fixed top-0 inset-x-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto w-full max-w-7xl px-6 py-3 flex items-center gap-4">
        <Logo />
        <div className="hidden md:flex items-center gap-2 text-sm">
          <Link to="/" className={linkCls("/")}> <UsersRound className="h-4 w-4"/> Users</Link>
          <Link to="/payments" className={linkCls("/payments")}> <Send className="h-4 w-4"/> Payments</Link>
        </div>
        <div className="flex-1" />
        <div className="flex items-center">
          <DynamicWidget />
        </div>
      </div>
    </nav>
  );
}

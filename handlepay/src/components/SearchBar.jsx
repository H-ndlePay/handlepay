import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

const handleTypes = [
  { key: "username", label: "Username" },
  { key: "github", label: "GitHub" },
  { key: "twitter", label: "X" },
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
];

export default function SearchBar({ defaultType = "username", defaultValue = "" }) {
  const [type, setType] = useState(defaultType);
  const [value, setValue] = useState(defaultValue);
  const nav = useNavigate();

  function onSubmit(e) {
    e.preventDefault();
    const q = `${type}:${value}`.trim();
    nav(`/?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 pl-3 pr-1 text-slate-700 border-r bg-slate-50">
          <select value={type} onChange={(e) => setType(e.target.value)} className="bg-transparent py-2 pr-2 text-sm outline-none" aria-label="Handle type">
            {handleTypes.map((h) => (
              <option key={h.key} value={h.key}>{h.label}</option>
            ))}
          </select>
        </div>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Search by ${type}…`} className="flex-1 px-4 py-2 outline-none" />
        <button type="submit" className="px-4 py-2 hover:bg-slate-50">
          <Search className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}

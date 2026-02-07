"use client";

import { Search } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xl">
      <Search
        size={16}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Search events... (press "/")'
        className="search-input w-full py-3 pl-11 pr-16 text-sm"
        disabled={isLoading}
      />
      <kbd className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-border font-mono">
        Enter
      </kbd>
    </form>
  );
}

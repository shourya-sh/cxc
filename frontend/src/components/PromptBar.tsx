"use client";

import { Brain, Search, Send, X, Sparkles, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { sendChatMessage } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Who's gonna win tonight?",
  "What's the safest bet today?",
  "Where does the model disagree with the market?",
  "Tell me about the model",
  "Which game has the biggest edge?",
  "Break down the Thunder game",
];

export default function PromptBar() {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (question?: string) => {
    const msg = (question || value).trim();
    if (!msg || isLoading) return;

    setIsOpen(true);
    setValue("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error — make sure the backend is running.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const clearChat = () => {
    setMessages([]);
    setIsOpen(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Input bar */}
      <form onSubmit={handleFormSubmit} className="relative">
        <Brain
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-accent"
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => {
            if (messages.length > 0) setIsOpen(true);
          }}
          placeholder='Ask CXC anything... "Who wins tonight?" (press /)'
          className="search-input w-full py-3.5 pl-11 pr-20 text-sm"
          disabled={isLoading}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-accent" />
          ) : value.trim() ? (
            <button
              type="submit"
              className="p-1.5 rounded-md bg-accent text-bg-primary hover:opacity-80 transition-opacity"
            >
              <Send size={12} />
            </button>
          ) : (
            <kbd className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-border font-mono">
              /
            </kbd>
          )}
        </div>
      </form>

      {/* Suggestions — show when no messages yet and input not focused */}
      {messages.length === 0 && !isOpen && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 justify-center">
          {SUGGESTIONS.slice(0, 4).map((s) => (
            <button
              key={s}
              onClick={() => handleSubmit(s)}
              className="text-[11px] text-text-muted px-2.5 py-1 rounded-full border border-border hover:border-accent hover:text-accent transition-all"
            >
              <Sparkles size={9} className="inline mr-1 opacity-50" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chat panel */}
      {isOpen && messages.length > 0 && (
        <div className="mt-3 glass-card overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-accent" />
              <span className="text-xs font-semibold text-text-primary">
                CXC AI Analyst
              </span>
              <span className="text-[10px] text-text-muted">
                Powered by Gemini
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="text-[10px] text-text-muted hover:text-text-primary transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-bg-elevated transition-colors"
              >
                <X size={12} className="text-text-muted" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-accent text-bg-primary rounded-br-sm"
                      : "bg-bg-elevated text-text-primary rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="text-sm leading-relaxed prose-sm"
                      dangerouslySetInnerHTML={{
                        __html: formatMarkdown(msg.content),
                      }}
                    />
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-bg-elevated rounded-xl px-4 py-3 rounded-bl-sm">
                  <div className="flex items-center gap-2 text-text-muted">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">Analyzing games...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick follow-ups */}
          {!isLoading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {["Tell me more", "Any edges today?", "Safest pick?"].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubmit(s)}
                  className="text-[10px] text-text-muted px-2 py-1 rounded-full border border-border hover:border-accent hover:text-accent transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Simple markdown formatter for bold, bullets, and newlines */
function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>')
    .replace(/^\* (.+)$/gm, '<li class="ml-3">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-3">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="space-y-1 my-1">$&</ul>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, "<br/>");
}

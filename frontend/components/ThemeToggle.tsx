"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 8px",
        borderRadius: "999px",
        border: "none",
        cursor: "pointer",
        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        width: "76px",
        height: "34px",
        background: isDark
          ? "linear-gradient(135deg, #1e2d45, #2a3f5f)"
          : "linear-gradient(135deg, #fde68a, #fbbf24)",
        boxShadow: isDark
          ? "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "0 2px 8px rgba(251,191,36,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
      }}
    >
      {/* Sun Icon */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
        opacity: isDark ? 0.4 : 1,
        transform: isDark ? "scale(0.85)" : "scale(1)",
        transition: "all 0.3s ease",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={isDark ? "#fbbf24" : "#92400e"}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      </div>

      {/* Moon Icon */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
        opacity: isDark ? 1 : 0.4,
        transform: isDark ? "scale(1)" : "scale(0.85)",
        transition: "all 0.3s ease",
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke={isDark ? "#818cf8" : "#1e3a5f"}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </div>

      {/* Sliding Knob */}
      <div style={{
        position: "absolute",
        top: "3px",
        left: isDark ? "44px" : "3px",
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        background: isDark
          ? "linear-gradient(135deg, #6366f1, #4f46e5)"
          : "linear-gradient(135deg, #ffffff, #f3f4f6)",
        transition: "left 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 2,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: isDark
          ? "0 2px 6px rgba(99,102,241,0.5)"
          : "0 2px 6px rgba(0,0,0,0.2)",
      }}>
        {!isDark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#f59e0b" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="#ffffff" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </div>
    </button>
  );
}
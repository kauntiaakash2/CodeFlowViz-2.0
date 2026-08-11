"use client";

import React, { useState, useEffect, useRef } from "react";

export type CursorOption = {
  name: string;
  value: string;
  effect?: "none" | "glow" | "trail" | "sparkle" | "orbit";
};

const CURSOR_OPTIONS: CursorOption[] = [
  { name: "Default", value: "default", effect: "none" },
  { name: "Glow", value: "pointer", effect: "glow" },
  { name: "Trail", value: "crosshair", effect: "trail" },
  { name: "Sparkle", value: "pointer", effect: "sparkle" },
  { name: "Orbit", value: "grab", effect: "orbit" },
];

const CURSOR_STORAGE_KEY = "codeflowviz:cursor-style";

export default function CursorSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCursor, setSelectedCursor] = useState<CursorOption>(CURSOR_OPTIONS[0]);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string; createdAt: number }[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Restore a previously selected cursor without affecting server rendering.
  useEffect(() => {
    try {
      const savedCursor = window.localStorage.getItem(CURSOR_STORAGE_KEY);
      const matchingCursor = CURSOR_OPTIONS.find((option) => option.name === savedCursor);
      if (matchingCursor) {
        setSelectedCursor(matchingCursor);
      }
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }
  }, []);

  // Apply cursor style, cleanup body cursor, and handle particle lifetimes
  useEffect(() => {
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = selectedCursor.value;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      if (selectedCursor.effect === "trail" || selectedCursor.effect === "sparkle") {
        const colors = ["#7c3aed", "#06b6d4", "#3b82f6", "#ec4899", "#f59e0b"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        setParticles((prev) => [
          ...prev.filter((p) => Date.now() - p.createdAt < 600), // expire particles older than 600ms
          { id: Date.now() + Math.random(), x: e.clientX, y: e.clientY, color: randomColor, createdAt: Date.now() },
        ]);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.style.cursor = previousCursor;
    };
  }, [selectedCursor]);

  // Clean up stale particles periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles((prev) => prev.filter((p) => Date.now() - p.createdAt < 600));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={dropdownRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      }}
      style={{ position: "relative", display: "inline-block" }}
    >
      {/* Inject Keyframes for Orbit Spin */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Glow Effect Element */}
      {selectedCursor.effect === "glow" && (
        <div
          style={{
            position: "fixed",
            top: mousePos.y - 40,
            left: mousePos.x - 40,
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.35) 0%, rgba(6,182,212,0.1) 70%, transparent 100%)",
            pointerEvents: "none",
            zIndex: 9999,
            transition: "transform 0.05s linear",
          }}
        />
      )}

      {/* Orbit Effect Element */}
      {selectedCursor.effect === "orbit" && (
        <div
          style={{
            position: "fixed",
            top: mousePos.y - 15,
            left: mousePos.x - 15,
            width: "30px",
            height: "30px",
            border: "2px dashed rgba(124,58,237,0.7)",
            borderRadius: "50%",
            pointerEvents: "none",
            zIndex: 9999,
            animation: "spin 2s linear infinite",
          }}
        />
      )}

      {/* Trail / Sparkle Particles */}
      {(selectedCursor.effect === "trail" || selectedCursor.effect === "sparkle") &&
        particles.map((p) => {
          const age = Date.now() - p.createdAt;
          const lifeProgress = 1 - age / 600; // fade out over 600ms
          return (
            <div
              key={p.id}
              style={{
                position: "fixed",
                top: p.y - 4,
                left: p.x - 4,
                width: selectedCursor.effect === "sparkle" ? "10px" : "8px",
                height: selectedCursor.effect === "sparkle" ? "10px" : "8px",
                borderRadius: selectedCursor.effect === "sparkle" ? "0%" : "50%",
                background: p.color,
                boxShadow: `0 0 8px ${p.color}`,
                pointerEvents: "none",
                zIndex: 9998,
                opacity: lifeProgress > 0 ? lifeProgress : 0,
                transform: `scale(${lifeProgress > 0 ? lifeProgress : 0})`,
                transition: "opacity 0.1s linear, transform 0.1s linear",
              }}
            />
          );
        })}

      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Cursor style: ${selectedCursor.name}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="cursor-style-options"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 12px",
          borderRadius: "999px",
          border: "1px solid var(--border-color, #34558f)",
          background: "var(--bg-secondary, #10203b)",
          color: "var(--text-primary, #d7e4f8)",
          cursor: "pointer",
          fontSize: "0.85rem",
          fontWeight: 500,
          transition: "all 0.2s ease",
        }}
      >
        <span>Cursor: <strong>{selectedCursor.name}</strong></span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div
          id="cursor-style-options"
          role="listbox"
          aria-label="Cursor styles"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: "140px",
            background: "var(--bg-panel, #12121e)",
            border: "1px solid var(--border-color, #1e1e35)",
            borderRadius: "10px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            zIndex: 50,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {CURSOR_OPTIONS.map((opt) => (
            <button
              key={opt.name}
              role="option"
              aria-selected={selectedCursor.name === opt.name}
              onClick={() => {
                setSelectedCursor(opt);
                setIsOpen(false);
                try {
                  window.localStorage.setItem(CURSOR_STORAGE_KEY, opt.name);
                } catch {
                  // Keep the selector usable when storage is unavailable.
                }
              }}
              style={{
                background: selectedCursor.name === opt.name ? "var(--accent-blue, #7c3aed)33" : "transparent",
                border: "none",
                borderRadius: 0,
                padding: "8px 12px",
                textAlign: "left",
                fontSize: "0.82rem",
                color: "var(--text-primary, #e2e8f0)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border-color, #1e1e35)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = selectedCursor.name === opt.name ? "var(--accent-blue, #7c3aed)33" : "transparent")}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

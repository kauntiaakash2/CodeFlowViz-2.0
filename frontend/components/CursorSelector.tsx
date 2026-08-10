"use client";

import { useState, useEffect, useRef } from "react";

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

export default function CursorSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCursor, setSelectedCursor] = useState<CursorOption>(CURSOR_OPTIONS[0]);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Apply cursor style and mouse tracking for visual effects
  useEffect(() => {
    document.body.style.cursor = selectedCursor.value;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      if (selectedCursor.effect === "trail" || selectedCursor.effect === "sparkle") {
        const colors = ["#7c3aed", "#06b6d4", "#3b82f6", "#ec4899", "#f59e0b"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        setParticles((prev) => [
          ...prev.slice(-15), // keep last 15 particles
          { id: Date.now() + Math.random(), x: e.clientX, y: e.clientY, color: randomColor },
        ]);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.style.cursor = "default";
    };
  }, [selectedCursor]);

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
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
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
        particles.map((p, idx) => (
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
              opacity: (idx + 1) / particles.length,
              transform: `scale(${(idx + 1) / particles.length})`,
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          />
        ))}

      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select custom cursor style"
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
              onClick={() => {
                setSelectedCursor(opt);
                setIsOpen(false);
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
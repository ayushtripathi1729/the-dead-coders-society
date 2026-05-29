"use client";

import { motion } from "framer-motion";

const glyphs = ["01", "DP", "DFS", "AC", "WA", "TLE", "λ", "{}", "∑", "F1"];

export function ArenaBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 grid-fog scanline noise-overlay">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent,rgba(0,0,0,.78)_63%)]" />
      <div className="absolute inset-0 opacity-[0.18] [background-image:repeating-linear-gradient(112deg,transparent_0_18px,rgba(255,255,255,.06)_19px,transparent_20px_44px)]" />
      <motion.div
        className="absolute -left-24 top-12 h-72 w-[150vw] rotate-[-8deg] bg-gradient-to-r from-transparent via-[#8E2BFF]/20 to-transparent blur-3xl"
        animate={{ x: [-120, 120, -120], opacity: [0.16, 0.3, 0.16] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 h-64 w-[120vw] -translate-x-1/2 bg-gradient-to-t from-[#050505] via-[#8E2BFF]/10 to-transparent blur-2xl"
        animate={{ opacity: [0.45, 0.72, 0.45] }}
        transition={{ duration: 5.5, repeat: Infinity }}
      />
      <div className="absolute left-0 top-0 flex h-full w-full justify-around overflow-hidden opacity-25">
        {Array.from({ length: 14 }).map((_, column) => (
          <motion.div
            key={column}
            className="matrix-column flex flex-col gap-5 font-[family-name:var(--font-mono)] text-sm font-bold text-[#9AFF00]"
            initial={{ y: column % 2 ? -80 : 80 }}
            animate={{ y: column % 2 ? 80 : -80 }}
            transition={{ duration: 6 + column * 0.35, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          >
            {Array.from({ length: 24 }).map((__, index) => (
              <span key={index}>{glyphs[(index + column) % glyphs.length]}</span>
            ))}
          </motion.div>
        ))}
      </div>
      <motion.div
        className="electric absolute left-1/2 top-24 h-px w-[70vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#9AFF00] to-transparent"
        animate={{ opacity: [0.2, 0.85, 0.2], scaleX: [0.8, 1, 0.85] }}
        transition={{ duration: 1.9, repeat: Infinity }}
      />
      <div className="lightning-flash absolute right-[14%] top-0 h-[62vh] w-px rotate-[18deg] bg-[#9AFF00] shadow-[0_0_34px_10px_rgba(154,255,0,.45)]" />
      <div className="lightning-flash absolute left-[9%] top-[18%] h-[44vh] w-px -rotate-[27deg] bg-[#8E2BFF] shadow-[0_0_34px_10px_rgba(142,43,255,.5)] [animation-delay:2.1s]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

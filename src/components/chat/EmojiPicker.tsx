"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";

const EMOJI_CATEGORIES = [
  { name: "Smileys", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐"] },
  { name: "Gestures", emojis: ["👍","👎","👊","✊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤏","💪"] },
  { name: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"] },
  { name: "Animals", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🐢","🐍","🦎","🦂","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪"] },
  { name: "Food", emojis: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🍔","🍟","🍕","🌭","🥪","🌮","🍣","🍦","🍩","🍪","🎂","🍰"] },
  { name: "Activities", emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🥊","🥋","🎯","⛳","🎮","🎲","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🪘"] },
  { name: "Objects", emojis: ["💡","🔦","🕯️","🔥","💎","🔑","🗝️","🔨","🪓","⛏️","🔧","🪛","🔩","⚙️","🧲","💣","🪄","⚔️","🛡️","🏹","📱","💻","⌨️","🖥️","📷","📸","🔭","🔬","💰","🏆"] },
  { name: "Symbols", emojis: ["✅","❌","❓","❗","‼️","⁉️","💯","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","⭐","🌟","💫","✨","🔸","🔹","🔶","🔷","▶️","⏸️","⏹️","⏺️","🔃","🔄"] },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  positionClass?: string;
}

export default function EmojiPicker({ 
  onSelect, 
  onClose,
  positionClass = "absolute bottom-full mb-2"
}: EmojiPickerProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const filteredCategories = search.trim()
    ? EMOJI_CATEGORIES.map((cat) => ({
        ...cat,
        emojis: cat.emojis.filter((e) =>
          e.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((cat) => cat.emojis.length > 0)
    : EMOJI_CATEGORIES;

  return (
    <div
      ref={pickerRef}
      className={`${positionClass} w-[calc(100vw-1rem)] max-w-[320px] max-h-[70svh] sm:max-h-[360px] flex flex-col bg-ink-surface2 border border-ink-border rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150`}
    >
      {/* Search */}
      <div className="p-2 border-b border-ink-border">
        <input
          type="text"
          placeholder={t("chat.searchEmoji")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg bg-ink-surface border border-ink-border px-3 py-1.5 text-sm outline-none focus:border-command transition-colors placeholder:text-ink-muted"
        />
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ink-border">
        {filteredCategories.length === 0 && (
          <p className="text-center text-ink-muted text-sm py-6">
            {t("chat.noEmojisFound")}
          </p>
        )}
        {filteredCategories.map((category) => (
          <div key={category.name} className="mb-2">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider px-1 mb-1">
              {category.name}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {category.emojis.map((emoji, idx) => (
                <button
                  key={`${category.name}-${idx}`}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  className="flex aspect-square min-h-8 w-full items-center justify-center rounded text-lg transition-colors hover:bg-ink-border cursor-pointer"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

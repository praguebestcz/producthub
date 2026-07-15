"use client";

import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Textarea s @našeptávačem členů projektu — bez knihovny. Seznam členů
// přichází ze server componentu (stránka je za requireProjectRole), takže
// žádný nový endpoint; platnost zmínek stejně znovu ověřuje server.

export type MentionMember = {
  userId: number;
  name: string;
  avatarUrl: string | null;
};

// Rozepsaný @token před kurzorem: „@Han" → query "Han".
const TOKEN_RE = /(^|\s)@([^\s@]{0,50})$/;

export function MentionTextarea({
  value,
  onValueChange,
  mentions,
  onMentionsChange,
  members,
  placeholder,
  disabled,
  autoFocus,
}: {
  value: string;
  onValueChange: (value: string) => void;
  mentions: number[];
  onMentionsChange: (mentions: number[]) => void;
  members: MentionMember[];
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null); // null = zavřeno
  const [tokenStart, setTokenStart] = useState(0); // pozice @ v textu
  const [highlighted, setHighlighted] = useState(0);

  const suggestions =
    query === null
      ? []
      : members
          .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 6);

  // Po každé změně textu/kurzoru zjisti, jestli je před kurzorem @token.
  function refreshSuggester(text: string, caret: number) {
    const match = TOKEN_RE.exec(text.slice(0, caret));
    if (match) {
      setQuery(match[2]);
      setTokenStart(caret - match[2].length - 1);
      setHighlighted(0);
    } else {
      setQuery(null);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onValueChange(e.target.value);
    refreshSuggester(e.target.value, e.target.selectionStart ?? 0);
  }

  function pick(member: MentionMember) {
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const next =
      value.slice(0, tokenStart) + "@" + member.name + " " + value.slice(caret);
    onValueChange(next);
    if (!mentions.includes(member.userId)) {
      onMentionsChange([...mentions, member.userId]);
    }
    setQuery(null);
    // Kurzor za vloženou zmínku (po rerenderu).
    const pos = tokenStart + member.name.length + 2;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query === null || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setQuery(null);
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={3}
        maxLength={10_000}
      />
      {query !== null && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border bg-popover shadow-md"
        >
          {suggestions.map((m, i) => (
            <li key={m.userId} role="option" aria-selected={i === highlighted}>
              <button
                type="button"
                // onMouseDown — dřív než blur textarey zavře seznam.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                  i === highlighted && "bg-accent",
                )}
              >
                <Avatar size="sm">
                  {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                  <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Před odesláním: zmínky, jejichž „@Jméno" už v textu není (uživatel je
// smazal), se neposílají — jinak by dostal notifikaci omylem.
export function activeMentions(
  text: string,
  mentions: number[],
  members: MentionMember[],
): number[] {
  return mentions.filter((id) => {
    const member = members.find((m) => m.userId === id);
    return member !== undefined && text.includes("@" + member.name);
  });
}

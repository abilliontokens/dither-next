"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DitherAvatar, DitherBadge, DitherButton, DitherInput } from "@dither-kit";

import { DemoCard } from "../DemoCard";

/**
 * ChatExamples — chat-thread · chat-assistant · chat-support · chat-channel
 * section pack. Port of `src/pages/docs/examples/ChatExamples.vue`.
 *
 * State mapping (guide §4): `reactive`/`ref` → `useState`; `computed` →
 * `useMemo`; Vue `watch([...], () => nextTick(scroll), { flush: "post" })` →
 * `useEffect` with the same deps scrolling a ref (runs after paint). Timer
 * IDs live in refs; a single mount cleanup clears them all. `window.matchMedia`
 * (reduced-motion fast path in aiAsk) is guarded by `typeof window !==
 * "undefined"` for SSR safety (AGENTS.md). `v-model` → `value` + `onChange`;
 * `@submit.prevent` → `onSubmit` that calls `e.preventDefault()`. The typing
 * dots and AI cursor use the same `animate-pulse` + `motion-reduce:` recipe as
 * the Vue source.
 */
type ThreadColor = "green" | "purple" | "blue";
type Msg = { from: "me" | "them"; text: string; at: string };
type Thread = {
  id: string;
  name: string;
  color: ThreadColor;
  unread: number;
  replies: string[];
  messages: Msg[];
};

const INITIAL_THREADS: Thread[] = [
  {
    id: "rei",
    name: "Rei Toma",
    color: "purple",
    unread: 0,
    replies: ["On it — give me ten minutes.", "Pushed. Check the preview link."],
    messages: [
      { from: "them", text: "Morning — the new palette landed in staging.", at: "09:12" },
      { from: "me", text: "Saw it. The green reads much better on dark.", at: "09:14" },
      { from: "them", text: "Agreed. I still want to tune the orange ramp.", at: "09:15" },
    ],
  },
  {
    id: "kai",
    name: "Kai Raster",
    color: "green",
    unread: 2,
    replies: ["Ticket closed — customer confirmed.", "Done. Anything else today?"],
    messages: [
      { from: "them", text: "Two tickets left in the queue.", at: "08:40" },
      { from: "them", text: "One looks like the export bug again.", at: "08:41" },
    ],
  },
];

type AiMsg = { role: "user" | "assistant"; text: string };

const AI_ANSWERS: Record<string, string> = {
  "What can a seed do?":
    "One integer derives a full visual personality — texture, easing, bloom, entrance, even the dither matrix. Same seed, same picture, forever.",
  "Theme the charts":
    "Override the shadcn-style tokens — background, foreground, border, accent — and every chart chrome follows. The dither reads the same vars.",
  "Export an artboard":
    "Open Studio, select the artboard, and use Export — PNG for pixels, or copy the Vue snippet to keep it live.",
};
const AI_FALLBACK =
  "Try a seed — pass any integer to a chart and watch the texture, easing and bloom derive from it. Explicit props always win.";

type SupportMsg = { from: "me" | "agent" | "system"; text: string; at: string };
const SUPPORT_REPLIES: Record<string, string> = {
  "Where is my order?": "Order #1187 shipped yesterday — tracking says it arrives Thursday.",
  "Reset my password": "Done — a reset link is in your inbox. It expires in 15 minutes.",
  "Talk to a human": "Connecting you — a teammate picks this up from here.",
};

type Reaction = { label: string; count: number; mine: boolean };
type ChannelMsg = {
  author: string;
  color: ThreadColor;
  text: string;
  at: string;
  reactions: Reaction[];
};
const INITIAL_CHANNEL: ChannelMsg[] = [
  { author: "Rei Toma", color: "purple", text: "Palette v3 is in staging — poke at the orange ramp.", at: "09:12", reactions: [{ label: "+1", count: 2, mine: false }] },
  { author: "Rei Toma", color: "purple", text: "Charts pick it up automatically, no prop changes.", at: "09:12", reactions: [] },
  { author: "Kai Raster", color: "green", text: "Export bug #214 is reproduced — fix lands today.", at: "09:20", reactions: [{ label: "ship it", count: 1, mine: false }] },
  { author: "You", color: "blue", text: "I will take the docs pass once both land.", at: "09:24", reactions: [] },
];

const stamp = () => new Date().toTimeString().slice(0, 5);

const SNIPPET = `{/* conversation list */}
{threads.map(t => (
  <button key={t.id} aria-pressed={active === t.id}
    onClick={() => open(t.id)} className="flex items-center gap-2">
    <DitherAvatar name={t.name} size={24} color={t.color} />
    <span>{t.name} — {t.messages.at(-1).text}</span>
    {t.unread ? <DitherBadge color="green">{t.unread}</DitherBadge> : null}
  </button>
))}

{/* thread */}
{active.messages.map((m, i) => (
  <div key={i} className={m.from === 'me' ? 'flex justify-end' : 'flex justify-start'}>
    <div className="max-w-[75%] rounded-lg border px-2.5 py-1.5"
      className={m.from === 'me' ? 'border-accent/40 bg-accent/10' : 'bg-card/40'}>
      {m.text} <span>{m.at}</span>
    </div>
  </div>
))}
{typing && <div aria-live="polite">…typing dots…</div>}

{/* composer */}
<form onSubmit={e => { e.preventDefault(); send(); }}>
  <DitherInput value={draft} onChange={setDraft} placeholder="Message…" />
  <DitherButton color="green" type="submit">Send</DitherButton>
</form>`;

const SNIPPET_AI = `{/* assistant thread: chips ask, replies stream, stop cancels */}
{messages.map((m, i) => (
  <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
    <div className={m.role === 'user' ? 'border-accent/40 bg-accent/10' : 'bg-card/40'}
      className="max-w-[80%] rounded-lg border px-2.5 py-1.5">{m.text}</div>
  </div>
))}

{!streaming && (
  <div role="group" aria-label="Suggestions">   {/* chips */}
    {suggestions.map(s => <button key={s} onClick={() => ask(s)}>{s}</button>)}
  </div>
)}
{streaming && <button onClick={stop}>Stop generating</button>}

<form onSubmit={e => { e.preventDefault(); ask(draft); }}>
  <DitherInput value={draft} onChange={setDraft} placeholder="Ask about the kit…" />
  <DitherButton color="purple" type="submit" disabled={streaming}>Ask</DitherButton>
</form>

{/* reduced motion: the reply lands whole instead of streaming */}`;

const SNIPPET_SUPPORT = `{/* support: status header · quick replies · escalation */}
<header>Support · <span className="size-1.5 rounded-full bg-green" /> online</header>

{messages.map((m, i) => (
  <div key={i}>
    {m.from === 'system'
      ? <p className="text-center">{m.text}</p>  {/* ticket line */}
      : <div className={m.from === 'me' ? 'justify-end' : ''}>{m.text}</div>}
  </div>
))}
{typing && <div>…agent typing…</div>}

<div role="group" aria-label="Quick replies">
  {quickReplies.map(q => <button key={q} onClick={() => ask(q)}>{q}</button>)}
</div>
{/* "Talk to a human" answers, then a system line opens the ticket */}`;

const SNIPPET_CHANNEL = `{/* channel: flat rows · author grouping · reactions */}
{messages.map((m, i) => (
  <div key={i} className="flex gap-2.5">
    {!grouped(i)
      ? <DitherAvatar name={m.author} size={24} color={m.color} />
      : <div className="w-6" />                {/* same author → no avatar */}
    <div>
      {!grouped(i) && <p><b>{m.author}</b> <time>{m.at}</time></p>}
      <p>{m.text}</p>
      {m.reactions.map(r => (
        <button key={r.label} aria-pressed={r.mine}
          onClick={() => react(i, r.label)}>{r.label} {r.count}</button>
      ))}
    </div>
  </div>
))}

<form onSubmit={e => { e.preventDefault(); post(); }}>
  <DitherInput value={draft} onChange={setDraft} placeholder="Message #dither-dev…" />
</form>`;

export function ChatExamples() {
  /* --- chat thread --- */
  const [threads, setThreads] = useState<Thread[]>(INITIAL_THREADS);
  const [activeId, setActiveId] = useState("rei");
  const active = useMemo(
    () => threads.find((t) => t.id === activeId)!,
    [threads, activeId],
  );
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);

  function openThread(id: string) {
    setActiveId(id);
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
  }

  function send() {
    const text = draft.trim();
    if (!text || typing) return;
    const id = active.id;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, messages: [...t.messages, { from: "me" as const, text, at: stamp() }] }
          : t,
      ),
    );
    setDraft("");
    setTyping(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const reply = t.replies[t.messages.length % t.replies.length];
          return { ...t, messages: [...t.messages, { from: "them", text: reply, at: stamp() }] };
        }),
      );
      setTyping(false);
    }, 1200);
  }

  /* --- shared timer pool (support chat) --- */
  const timersRef = useRef<Set<number>>(new Set());
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  };

  /* --- AI assistant --- */
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([
    { role: "assistant", text: "Hi — ask me about seeds, theming, or exporting. Or pick a suggestion below." },
  ]);
  const [aiDraft, setAiDraft] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const aiScroller = useRef<HTMLDivElement | null>(null);
  const streamIdRef = useRef<number | null>(null);

  function aiStop() {
    if (streamIdRef.current !== null) {
      window.clearInterval(streamIdRef.current);
      streamIdRef.current = null;
    }
    setAiStreaming(false);
    setAiMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && !last.text) {
        return prev.map((m, i) => (i === prev.length - 1 ? { ...m, text: "—" } : m));
      }
      return prev;
    });
  }

  function aiAsk(prompt: string) {
    const text = prompt.trim();
    if (!text || aiStreaming) return;
    const answer = AI_ANSWERS[text] ?? AI_FALLBACK;
    const withUser: AiMsg[] = [...aiMessages, { role: "user", text }];
    const target = withUser.length;
    setAiMessages([...withUser, { role: "assistant", text: "" }]);
    setAiDraft("");
    setAiStreaming(true);
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAiMessages((prev) =>
        prev.map((m, i) => (i === target ? { ...m, text: answer } : m)),
      );
      setAiStreaming(false);
      return;
    }
    let i = 0;
    streamIdRef.current = window.setInterval(() => {
      i = Math.min(i + 3, answer.length);
      const slice = answer.slice(0, i);
      setAiMessages((prev) =>
        prev.map((m, idx) => (idx === target ? { ...m, text: slice } : m)),
      );
      if (i >= answer.length) aiStop();
    }, 24);
  }

  /* --- support chat --- */
  const [supportMessages, setSupportMessages] = useState<SupportMsg[]>([
    { from: "agent", text: "Hi, you have reached dither support. How can I help?", at: "10:02" },
  ]);
  const [supportTyping, setSupportTyping] = useState(false);
  const [supportDraft, setSupportDraft] = useState("");
  const supportScroller = useRef<HTMLDivElement | null>(null);

  function supportAsk(prompt: string) {
    const text = prompt.trim();
    if (!text || supportTyping) return;
    setSupportMessages((prev) => [...prev, { from: "me", text, at: stamp() }]);
    setSupportDraft("");
    setSupportTyping(true);
    later(() => {
      const reply = SUPPORT_REPLIES[text] ?? "Let me check that for you — one moment.";
      setSupportMessages((prev) => [...prev, { from: "agent", text: reply, at: stamp() }]);
      setSupportTyping(false);
      if (text === "Talk to a human") {
        later(
          () =>
            setSupportMessages((prev) => [
              ...prev,
              { from: "system", text: "Ticket #4821 opened — Rei joined the conversation", at: stamp() },
            ]),
          900,
        );
      }
    }, 1100);
  }

  /* --- team channel --- */
  const [channelMessages, setChannelMessages] = useState<ChannelMsg[]>(INITIAL_CHANNEL);
  const [channelDraft, setChannelDraft] = useState("");
  const channelScroller = useRef<HTMLDivElement | null>(null);
  /** Consecutive rows from one author collapse — avatar and name print once. */
  const grouped = (i: number) =>
    i > 0 && channelMessages[i - 1].author === channelMessages[i].author;

  function channelPost() {
    const text = channelDraft.trim();
    if (!text) return;
    setChannelMessages((prev) => [
      ...prev,
      { author: "You", color: "blue", text, at: stamp(), reactions: [] },
    ]);
    setChannelDraft("");
  }

  function react(index: number, label: string) {
    setChannelMessages((prev) =>
      prev.map((msg, i) => {
        if (i !== index) return msg;
        const reactions = msg.reactions.map((r) => ({ ...r }));
        const existing = reactions.find((x) => x.label === label);
        if (!existing) {
          reactions.push({ label, count: 1, mine: true });
        } else {
          existing.mine = !existing.mine;
          existing.count += existing.mine ? 1 : -1;
        }
        return { ...msg, reactions: reactions.filter((x) => x.count > 0) };
      }),
    );
  }

  /* --- keep each thread pinned to the newest message --- */
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [active.messages.length, typing, activeId]);

  useEffect(() => {
    aiScroller.current?.scrollTo({ top: aiScroller.current.scrollHeight });
  }, [aiMessages.length, aiMessages[aiMessages.length - 1]?.text]);

  useEffect(() => {
    supportScroller.current?.scrollTo({ top: supportScroller.current.scrollHeight });
  }, [supportMessages.length, supportTyping]);

  useEffect(() => {
    channelScroller.current?.scrollTo({ top: channelScroller.current.scrollHeight });
  }, [channelMessages.length]);

  /* --- unmount: clear every pending timer --- */
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (streamIdRef.current !== null) window.clearInterval(streamIdRef.current);
      timersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return (
    <>
      <section id="chat-thread" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Chat thread</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Conversation list beside a live thread — unread badges clear when you
          open them, sending appends your bubble, and the other side types back.
          The typing dots hold still under reduced motion.
        </p>
        <DemoCard code={SNIPPET}>
          <div className="mx-auto flex h-96 max-w-2xl overflow-hidden rounded-lg border border-border/60 bg-background/40">
            <aside
              className="flex w-52 shrink-0 flex-col border-r border-border/60"
              aria-label="Conversations"
            >
              <div className="border-b border-border/60 p-2.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
                Messages
              </div>
              <div className="grid content-start gap-0.5 p-1.5">
                {threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={activeId === t.id}
                    className={`flex min-w-0 items-center gap-2 rounded-md p-2 text-left transition-colors ${
                      activeId === t.id ? "bg-card" : "hover:bg-card/60"
                    }`}
                    onClick={() => openThread(t.id)}
                  >
                    <DitherAvatar name={t.name} size={24} color={t.color} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[11px] text-foreground">{t.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {t.messages[t.messages.length - 1].text}
                      </span>
                    </span>
                    {t.unread ? (
                      <DitherBadge color="green" className="shrink-0 text-[9px]">
                        {t.unread}
                      </DitherBadge>
                    ) : null}
                  </button>
                ))}
              </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-3">
                <DitherAvatar name={active.name} size={20} color={active.color} />
                <span className="text-[12px] text-foreground">{active.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">today</span>
              </div>
              <div
                ref={scroller}
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
              >
                {active.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-end gap-2 ${
                      m.from === "me" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.from === "them" ? (
                      <DitherAvatar
                        name={active.name}
                        size={20}
                        color={active.color}
                        className="shrink-0"
                      />
                    ) : null}
                    <div
                      className={`max-w-[75%] rounded-lg border px-2.5 py-1.5 ${
                        m.from === "me"
                          ? "border-accent/40 bg-accent/10"
                          : "border-border/60 bg-card/40"
                      }`}
                    >
                      <p className="text-[11px] leading-relaxed text-foreground">{m.text}</p>
                      <span className="mt-0.5 block text-right text-[9px] tabular-nums text-muted-foreground/70">
                        {m.at}
                      </span>
                    </div>
                  </div>
                ))}
                {typing ? (
                  <div className="flex items-end gap-2" aria-live="polite">
                    <DitherAvatar
                      name={active.name}
                      size={20}
                      color={active.color}
                      className="shrink-0"
                    />
                    <div
                      className="rounded-lg border border-border/60 bg-card/40 px-2.5 py-2"
                      aria-label="Typing"
                    >
                      <span className="flex gap-1">
                        {Array.from({ length: 3 }, (_, idx) => (
                          <span
                            key={idx}
                            className="size-1 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
                            style={{ animationDelay: `${(idx + 1) * 150}ms` }}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
              <form
                className="flex shrink-0 items-center gap-2 border-t border-border/60 p-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <DitherInput
                  value={draft}
                  onChange={setDraft}
                  placeholder="Message…"
                  className="min-w-0 flex-1 text-[11px]"
                />
                <DitherButton
                  color="green"
                  className="shrink-0 px-3 py-1.5 text-[11px]"
                  disabled={!draft.trim() || typing}
                >
                  Send
                </DitherButton>
              </form>
            </div>
          </div>
        </DemoCard>
      </section>

      {/* AI assistant */}
      <section id="chat-assistant" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">AI assistant</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          An assistant thread — suggestion chips ask for you, replies stream in
          character by character, and Stop cancels mid-sentence. Under reduced
          motion the answer lands whole.
        </p>
        <DemoCard code={SNIPPET_AI}>
          <div className="mx-auto flex h-96 max-w-md flex-col overflow-hidden rounded-lg border border-border/60 bg-background/40">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-3">
              <DitherAvatar name="dither assistant" size={20} color="purple" />
              <span className="text-[12px] text-foreground">Assistant</span>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: "var(--swatch-purple)" }}
                  aria-hidden="true"
                />
                {aiStreaming ? "thinking" : "ready"}
              </span>
            </div>
            <div
              ref={aiScroller}
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
              aria-live="polite"
            >
              {aiMessages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg border px-2.5 py-1.5 ${
                      m.role === "user"
                        ? "border-accent/40 bg-accent/10"
                        : "border-border/60 bg-card/40"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">
                      {m.text}
                      {aiStreaming && i === aiMessages.length - 1 ? (
                        <span
                          className="animate-pulse motion-reduce:animate-none"
                          aria-hidden="true"
                        >
                          ▍
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-border/60 p-2.5">
              {!aiStreaming ? (
                <div className="flex flex-wrap gap-1.5 pb-2" role="group" aria-label="Suggestions">
                  {Object.keys(AI_ANSWERS).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                      onClick={() => aiAsk(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="pb-2">
                  <button
                    type="button"
                    className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                    onClick={aiStop}
                  >
                    Stop generating
                  </button>
                </div>
              )}
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  aiAsk(aiDraft);
                }}
              >
                <DitherInput
                  value={aiDraft}
                  onChange={setAiDraft}
                  placeholder="Ask about the kit…"
                  className="min-w-0 flex-1 text-[11px]"
                />
                <DitherButton
                  color="purple"
                  className="shrink-0 px-3 py-1.5 text-[11px]"
                  disabled={!aiDraft.trim() || aiStreaming}
                >
                  Ask
                </DitherButton>
              </form>
            </div>
          </div>
        </DemoCard>
      </section>

      {/* Support chat */}
      <section id="chat-support" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Support chat</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A support widget — online status in the header, quick-reply chips that
          really answer, and “Talk to a human” escalates: the agent replies, then
          a system line opens the ticket.
        </p>
        <DemoCard code={SNIPPET_SUPPORT}>
          <div className="mx-auto flex h-96 max-w-md flex-col overflow-hidden rounded-lg border border-border/60 bg-background/40">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-3">
              <DitherAvatar name="Nia Grid" size={20} color="green" />
              <span className="text-[12px] text-foreground">Support</span>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: "var(--swatch-green)" }}
                  aria-hidden="true"
                />
                online · ~2 min
              </span>
            </div>
            <div
              ref={supportScroller}
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
            >
              <div className="text-center text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
                Today
              </div>
              {supportMessages.map((m, i) =>
                m.from === "system" ? (
                  <p key={i} className="px-4 text-center text-[10px] text-muted-foreground">
                    {m.text}
                  </p>
                ) : (
                  <div
                    key={i}
                    className={`flex items-end gap-2 ${
                      m.from === "me" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.from === "agent" ? (
                      <DitherAvatar
                        name="Nia Grid"
                        size={20}
                        color="green"
                        className="shrink-0"
                      />
                    ) : null}
                    <div
                      className={`max-w-[75%] rounded-lg border px-2.5 py-1.5 ${
                        m.from === "me"
                          ? "border-accent/40 bg-accent/10"
                          : "border-border/60 bg-card/40"
                      }`}
                    >
                      <p className="text-[11px] leading-relaxed text-foreground">{m.text}</p>
                      <span className="mt-0.5 block text-right text-[9px] tabular-nums text-muted-foreground/70">
                        {m.at}
                      </span>
                    </div>
                  </div>
                ),
              )}
              {supportTyping ? (
                <div className="flex items-end gap-2" aria-live="polite">
                  <DitherAvatar
                    name="Nia Grid"
                    size={20}
                    color="green"
                    className="shrink-0"
                  />
                  <div
                    className="rounded-lg border border-border/60 bg-card/40 px-2.5 py-2"
                    aria-label="Agent typing"
                  >
                    <span className="flex gap-1">
                      {Array.from({ length: 3 }, (_, idx) => (
                        <span
                          key={idx}
                          className="size-1 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
                          style={{ animationDelay: `${(idx + 1) * 150}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-border/60 p-2.5">
              <div className="flex flex-wrap gap-1.5 pb-2" role="group" aria-label="Quick replies">
                {Object.keys(SUPPORT_REPLIES).map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-40"
                    disabled={supportTyping}
                    onClick={() => supportAsk(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  supportAsk(supportDraft);
                }}
              >
                <DitherInput
                  value={supportDraft}
                  onChange={setSupportDraft}
                  placeholder="Write a message…"
                  className="min-w-0 flex-1 text-[11px]"
                />
                <DitherButton
                  color="green"
                  className="shrink-0 px-3 py-1.5 text-[11px]"
                  disabled={!supportDraft.trim() || supportTyping}
                >
                  Send
                </DitherButton>
              </form>
            </div>
          </div>
        </DemoCard>
      </section>

      {/* Team channel */}
      <section id="chat-channel" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Team channel</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          A channel, not bubbles — flat rows where consecutive messages from one
          author group under a single name, and reactions toggle with a click.
          Post something and watch your rows group too.
        </p>
        <DemoCard code={SNIPPET_CHANNEL}>
          <div className="mx-auto flex h-96 max-w-lg flex-col overflow-hidden rounded-lg border border-border/60 bg-background/40">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-3">
              <span className="text-[12px] text-foreground">#dither-dev</span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                4 members
              </span>
            </div>
            <div ref={channelScroller} className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="pb-2 text-center text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
                Today
              </div>
              {channelMessages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 rounded-md px-1.5 transition-colors hover:bg-card/40 ${
                    grouped(i) ? "py-0.5" : "pt-2.5 pb-0.5"
                  }`}
                >
                  {!grouped(i) ? (
                    <DitherAvatar
                      name={m.author}
                      size={24}
                      color={m.color}
                      className="mt-0.5 shrink-0"
                    />
                  ) : (
                    <div className="w-6 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    {!grouped(i) ? (
                      <p className="flex items-baseline gap-2">
                        <span className="text-[11px] text-foreground">{m.author}</span>
                        <time className="text-[9px] tabular-nums text-muted-foreground/70">
                          {m.at}
                        </time>
                      </p>
                    ) : null}
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{m.text}</p>
                    {m.reactions.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.reactions.map((r) => (
                          <button
                            key={r.label}
                            type="button"
                            aria-pressed={r.mine}
                            className={`rounded-full border px-1.5 py-px text-[9px] tabular-nums transition-colors ${
                              r.mine
                                ? "border-accent/50 bg-accent/10 text-foreground"
                                : "border-border/60 text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => react(i, r.label)}
                          >
                            {r.label} {r.count}
                          </button>
                        ))}
                        <button
                          type="button"
                          aria-label="Add reaction"
                          className="rounded-full border border-border/60 px-1.5 py-px text-[9px] text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => react(i, "+1")}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <form
              className="flex shrink-0 items-center gap-2 border-t border-border/60 p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                channelPost();
              }}
            >
              <DitherInput
                value={channelDraft}
                onChange={setChannelDraft}
                placeholder="Message #dither-dev…"
                className="min-w-0 flex-1 text-[11px]"
              />
              <DitherButton
                color="blue"
                className="shrink-0 px-3 py-1.5 text-[11px]"
                disabled={!channelDraft.trim()}
              >
                Post
              </DitherButton>
            </form>
          </div>
        </DemoCard>
      </section>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";

import { DitherButton, DitherCheckbox, DitherInput, DitherPagination } from "@dither-kit";

import { DemoCard } from "../DemoCard";

/**
 * TableExamples — data-table section pack.
 * Port of `src/pages/docs/examples/TableExamples.vue`.
 *
 * One section. The whole table contract — filter, sortable columns with
 * aria-sort, page-scoped select-all, a bulk remove, presence dots, and
 * dithered pagination. State mapping (guide §4): `ref` arrays/scalars →
 * `useState`; `computed` → `useMemo`; `v-model:page` → `page` + `onPageChange`;
 * `v-model="query"` → `value` + `onChange`; `:model-value`/`@update:model-value`
 * on DitherCheckbox → `value` + `onChange`. The presence dot reads the palette
 * swatch vars via inline style, matching the Vue source verbatim.
 */
type MemberStatus = "active" | "away" | "offline";
type Member = {
  name: string;
  email: string;
  role: string;
  status: MemberStatus;
  joined: string;
};

const INITIAL_MEMBERS: Member[] = [
  { name: "Ada Byte", email: "ada@acme.io", role: "Engineering", status: "active", joined: "2023-01-14" },
  { name: "Rei Toma", email: "rei@acme.io", role: "Design", status: "active", joined: "2023-03-02" },
  { name: "Juno Bit", email: "juno@acme.io", role: "Product", status: "away", joined: "2022-11-20" },
  { name: "Mika Dot", email: "mika@acme.io", role: "Engineering", status: "offline", joined: "2024-02-08" },
  { name: "Kai Raster", email: "kai@acme.io", role: "Support", status: "active", joined: "2023-07-19" },
  { name: "Ivy Pixel", email: "ivy@acme.io", role: "Marketing", status: "away", joined: "2022-05-30" },
  { name: "Sol Bayer", email: "sol@acme.io", role: "Engineering", status: "active", joined: "2024-06-11" },
  { name: "Nia Grid", email: "nia@acme.io", role: "Finance", status: "offline", joined: "2023-09-25" },
  { name: "Rio Halftone", email: "rio@acme.io", role: "Design", status: "active", joined: "2024-01-03" },
];

const STATUS: Record<MemberStatus, { color: "green" | "orange" | "grey"; label: string }> = {
  active: { color: "green", label: "Active" },
  away: { color: "orange", label: "Away" },
  offline: { color: "grey", label: "Offline" },
};

const PAGE_SIZE = 5;

const SNIPPET = `<DitherInput value={query} onChange={setQuery} placeholder="Filter members…" />

<table className="w-full text-left">
  <thead>
    <tr className="border-b">
      <th><DitherCheckbox value={allOnPage} onChange={toggleAll} /></th>
      <th aria-sort="ascending">
        <button onClick={() => sortBy('name')}>Name ↑</button>
      </th>
      <th>Role</th>
      <th>Status</th>
      <th><button onClick={() => sortBy('joined')}>Joined</button></th>
    </tr>
  </thead>
  <tbody>
    {paged.map(m => (
      <tr key={m.email} className={selected.has(m.email) ? 'bg-card/50' : ''}>
        <td><DitherCheckbox value={selected.has(m.email)}
          onChange={() => toggleRow(m.email)} /></td>
        <td>{m.name} — {m.email}</td>
        <td>{m.role}</td>
        <td>   {/* presence dot from the palette swatch vars */}
          <span className="size-1.5 rounded-full"
            style={{ background: \`var(--swatch-\${STATUS[m.status].color})\` }} />
          {STATUS[m.status].label}
        </td>
        <td>{m.joined}</td>
      </tr>
    ))}
  </tbody>
</table>

<footer className="flex items-center justify-between">
  {rangeLabel}
  <DitherPagination page={page} total={pages} onPageChange={setPage} />
</footer>

{/* selection toolbar appears while rows are checked:
   n selected · <DitherButton color="red">Remove</DitherButton> */}`;

export function TableExamples() {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "joined">("joined");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  function sortBy(key: "name" | "joined") {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const ariaSort = (key: "name" | "joined") =>
    sortKey !== key ? "none" : sortDir === 1 ? "ascending" : "descending";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? members.filter(
          (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
        )
      : members;
    return [...rows].sort((a, b) => a[sortKey].localeCompare(b[sortKey]) * sortDir);
  }, [members, query, sortKey, sortDir]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    [filtered.length],
  );
  const paged = useMemo(() => {
    const p = Math.min(page, pages);
    return filtered.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  }, [filtered, page, pages]);

  const rangeLabel = useMemo(() => {
    const total = filtered.length;
    if (!total) return "No members match";
    const p = Math.min(page, pages);
    const from = (p - 1) * PAGE_SIZE + 1;
    const to = Math.min(p * PAGE_SIZE, total);
    return `Showing ${from}\u2013${to} of ${total}`;
  }, [filtered.length, page, pages]);

  const allOnPage = paged.length > 0 && paged.every((m) => selected.has(m.email));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (paged.length > 0 && paged.every((m) => next.has(m.email))) {
        paged.forEach((m) => next.delete(m.email));
      } else {
        paged.forEach((m) => next.add(m.email));
      }
      return next;
    });
  }

  function toggleRow(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function removeSelected() {
    setMembers((prev) => prev.filter((m) => !selected.has(m.email)));
    setSelected(new Set());
  }

  return (
    <>
      <section id="table-members" className="mt-16 scroll-mt-24">
        <h2 className="text-lg tracking-tight">Data table</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The whole table contract in one block — filter, sortable columns with
          aria-sort, page-scoped select-all, a bulk remove that really removes,
          presence dots, and dithered pagination. Filter and sort compose; the
          range label tells the truth.
        </p>
        <DemoCard code={SNIPPET}>
          <div className="mx-auto max-w-2xl rounded-lg border border-border/60 bg-background/40">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 p-3">
              <div>
                <div className="text-[13px] tracking-tight text-foreground">Team members</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Everyone with workspace access.
                </div>
              </div>
              <DitherInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder="Filter members…"
                className="w-44 text-[11px]"
              />
            </div>
            {selected.size ? (
              <div className="flex items-center justify-between border-b border-border/60 bg-card/30 px-3 py-2">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {selected.size} selected
                </span>
                <DitherButton
                  color="red"
                  className="px-2.5 py-1 text-[10px]"
                  onClick={removeSelected}
                >
                  Remove
                </DitherButton>
              </div>
            ) : null}
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="w-10 px-3 py-2">
                    <DitherCheckbox
                      value={allOnPage}
                      aria-label="Select page"
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="py-2 pr-3" aria-sort={ariaSort("name")}>
                    <button
                      type="button"
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                      onClick={() => sortBy("name")}
                    >
                      Member
                      {sortKey === "name" ? (
                        <span aria-hidden="true">{sortDir === 1 ? "↑" : "↓"}</span>
                      ) : null}
                    </button>
                  </th>
                  <th className="py-2 pr-3 font-normal">Role</th>
                  <th className="py-2 pr-3 font-normal">Status</th>
                  <th className="py-2 pr-3" aria-sort={ariaSort("joined")}>
                    <button
                      type="button"
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                      onClick={() => sortBy("joined")}
                    >
                      Joined
                      {sortKey === "joined" ? (
                        <span aria-hidden="true">{sortDir === 1 ? "↑" : "↓"}</span>
                      ) : null}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((m) => (
                  <tr
                    key={m.email}
                    className={`border-b border-border/40 transition-colors last:border-0 hover:bg-card/40${
                      selected.has(m.email) ? " bg-card/50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <DitherCheckbox
                        value={selected.has(m.email)}
                        aria-label={`Select ${m.name}`}
                        onChange={() => toggleRow(m.email)}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <div className="text-foreground">{m.name}</div>
                      <div className="text-[10px] text-muted-foreground">{m.email}</div>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{m.role}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: `var(--swatch-${STATUS[m.status].color})`,
                          }}
                          aria-hidden="true"
                        />
                        {STATUS[m.status].label}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">{m.joined}</td>
                  </tr>
                ))}
                {!paged.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No members match “{query}”.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-border/60 p-3">
              <span className="text-[10px] tabular-nums text-muted-foreground">{rangeLabel}</span>
              <DitherPagination page={page} total={pages} onPageChange={setPage} />
            </div>
          </div>
        </DemoCard>
      </section>
    </>
  );
}

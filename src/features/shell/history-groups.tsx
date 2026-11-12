import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function historyDate(key: string) {
  const month = key.length === 7;
  const date = new Date(`${month ? key + "-01" : key}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return key;
  return new Intl.DateTimeFormat(document.documentElement.lang || undefined, month
    ? { month: "long", year: "numeric" }
    : { month: "short", year: "numeric", day: "numeric", weekday: "short" }).format(date);
}

export function HistoryGroups<T>({ items, groupKey, children }: {
  items: T[];
  groupKey: (item: T) => string;
  children: (item: T) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = groupKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return <div className="history-groups">{Array.from(groups, ([key, rows]) =>
    <section key={key}>
      <button className="history-group-toggle" type="button" aria-expanded={!collapsed.has(key)} onClick={() => setCollapsed(previous => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      })}><time dateTime={key}>{historyDate(key)}</time><span>{rows.length}</span><ChevronDown size={14} /></button>
      {!collapsed.has(key) && rows.map(children)}
    </section>)}</div>;
}

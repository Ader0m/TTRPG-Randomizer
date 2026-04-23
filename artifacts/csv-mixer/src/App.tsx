import { useState, useRef, useEffect, useMemo } from "react";

type Row = string[];

interface Table {
  id: string;
  name: string;
  rows: Row[];
}

interface Entity {
  id: string;
  name: string;
  tables: Table[];
}

function parseCsv(text: string): { rows: Row[] } {
  const out: Row[] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    cur.push(field);
    field = "";
  };
  const pushRow = () => {
    out.push(cur);
    cur = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      pushField();
      pushRow();
      i++;
      continue;
    }
    if (c === ";" && !text.slice(0, 200).includes(",")) {
      pushField();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || cur.length > 0) {
    pushField();
    pushRow();
  }
  const cleaned = out.filter((r) => r.some((v) => v && v.trim() !== ""));
  return { rows: cleaned };
}

function pickRandomIndex(len: number): number {
  return Math.floor(Math.random() * len);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

type View = "settings" | "randomize" | "saved";

type GenItem = { tableId: string; tableName: string; idx: number; row: Row };

interface SavedGeneration {
  id: string;
  name?: string;
  sourceEntityId: string;
  sourceEntityName: string;
  createdAt: number;
  items: GenItem[];
}

function EntityPicker({
  entities,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: {
  entities: Entity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
}) {
  const selected = entities.find((e) => e.id === selectedId) ?? null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[200px]"
      >
        {entities.length === 0 && <option value="">— нет сущностей —</option>}
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} ({e.tables.length})
          </option>
        ))}
      </select>
      <button
        onClick={onCreate}
        className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition inline-flex items-center gap-1.5"
        title="Создать сущность генерации"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Новая
      </button>
      {selected && onRename && (
        <button
          onClick={() => {
            const name = prompt("Новое название сущности генерации:", selected.name);
            if (name && name.trim()) onRename(selected.id, name.trim());
          }}
          className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition"
        >
          Переименовать
        </button>
      )}
      {selected && onDelete && (
        <button
          onClick={() => {
            if (confirm(`Удалить сущность «${selected.name}» и все её таблицы?`)) onDelete(selected.id);
          }}
          className="px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition"
        >
          Удалить
        </button>
      )}
    </div>
  );
}

function TableNameInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      alert("Название не может быть пустым.");
      setDraft(value);
      return;
    }
    if (trimmed === value) return;
    onCommit(trimmed);
    // If commit was rejected (duplicate), parent value stays the same and our useEffect will revert draft.
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="font-medium text-sm bg-transparent border-b border-transparent hover:border-border focus:border-ring focus:outline-none px-1 py-0.5 flex-1"
    />
  );
}

function SettingsView({
  entities,
  setEntities,
  selectedEntityId,
  setSelectedEntityId,
}: {
  entities: Entity[];
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const entity = entities.find((e) => e.id === selectedEntityId) ?? null;

  const updateEntity = (id: string, fn: (e: Entity) => Entity) => {
    setEntities((prev) => prev.map((e) => (e.id === id ? fn(e) : e)));
  };

  const isEntityNameTaken = (name: string, exceptId?: string) => {
    const n = name.trim().toLowerCase();
    return entities.some((e) => e.id !== exceptId && e.name.trim().toLowerCase() === n);
  };

  const isTableNameTaken = (entityId: string, name: string, exceptId?: string) => {
    const ent = entities.find((e) => e.id === entityId);
    if (!ent) return false;
    const n = name.trim().toLowerCase();
    return ent.tables.some((t) => t.id !== exceptId && t.name.trim().toLowerCase() === n);
  };

  const uniqueTableName = (entityId: string, base: string, taken: Set<string>) => {
    const lower = (s: string) => s.trim().toLowerCase();
    const ent = entities.find((e) => e.id === entityId);
    const existing = new Set<string>([
      ...(ent?.tables.map((t) => lower(t.name)) ?? []),
      ...Array.from(taken).map(lower),
    ]);
    if (!existing.has(lower(base))) return base;
    let i = 2;
    while (existing.has(lower(`${base} (${i})`))) i++;
    return `${base} (${i})`;
  };

  const createEntity = () => {
    const raw = prompt("Название сущности генерации:");
    if (raw === null) return;
    const name = raw.trim();
    if (!name) return;
    if (isEntityNameTaken(name)) {
      alert(`Сущность с названием «${name}» уже существует.`);
      return;
    }
    const id = uid();
    setEntities((prev) => [...prev, { id, name, tables: [] }]);
    setSelectedEntityId(id);
  };

  const deleteEntity = (id: string) => {
    setEntities((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (selectedEntityId === id) {
        setSelectedEntityId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const renameEntity = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      alert("Название не может быть пустым.");
      return;
    }
    if (isEntityNameTaken(trimmed, id)) {
      alert(`Сущность с названием «${trimmed}» уже существует.`);
      return;
    }
    updateEntity(id, (e) => ({ ...e, name: trimmed }));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !entity) return;
    const newTables: Table[] = [];
    const usedNames = new Set<string>();
    for (const file of Array.from(files)) {
      const text = await file.text();
      const { rows } = parseCsv(text);
      const base = file.name.replace(/\.csv$/i, "");
      const finalName = uniqueTableName(entity.id, base, usedNames);
      usedNames.add(finalName);
      newTables.push({ id: uid(), name: finalName, rows });
    }
    updateEntity(entity.id, (e) => ({ ...e, tables: [...e.tables, ...newTables] }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeTable = (tableId: string) => {
    if (!entity) return;
    updateEntity(entity.id, (e) => ({ ...e, tables: e.tables.filter((t) => t.id !== tableId) }));
  };

  const renameTable = (tableId: string, name: string) => {
    if (!entity) return;
    if (isTableNameTaken(entity.id, name, tableId)) {
      alert(`Таблица с названием «${name.trim()}» уже есть в этой сущности.`);
      return;
    }
    updateEntity(entity.id, (e) => ({
      ...e,
      tables: e.tables.map((t) => (t.id === tableId ? { ...t, name } : t)),
    }));
  };

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Сущность генерации</h2>
          <p className="text-sm text-muted-foreground">
            Группа таблиц, из которых будет идти случайный выбор. Создайте
            сущность, дайте ей название и загрузите в неё CSV таблицы.
          </p>
        </div>
        <EntityPicker
          entities={entities}
          selectedId={selectedEntityId}
          onSelect={setSelectedEntityId}
          onCreate={createEntity}
          onDelete={deleteEntity}
          onRename={renameEntity}
        />
      </section>

      {entity ? (
        <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                Таблицы в «{entity.name}»
              </h2>
              <p className="text-sm text-muted-foreground">
                Поддерживаются файлы .csv. Все строки считаются данными.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:opacity-90 transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Загрузить CSV
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </div>

          {entity.tables.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-lg p-10 text-center text-muted-foreground">
              В этой сущности пока нет таблиц. Нажмите «Загрузить CSV», чтобы добавить.
            </div>
          ) : (
            <div className="space-y-3">
              {entity.tables.map((t) => (
                <div key={t.id} className="border border-border rounded-lg p-4 bg-background">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <TableNameInput
                        value={t.name}
                        onCommit={(name) => renameTable(t.id, name)}
                      />
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {t.rows.length} {t.rows.length === 1 ? "строка" : "строк"}
                      </span>
                    </div>
                    <button
                      onClick={() => removeTable(t.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="text-xs w-full">
                      <tbody>
                        {t.rows.map((r, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            <td className="px-2 py-1.5 text-muted-foreground font-mono w-10">{i + 1}</td>
                            {r.map((c, j) => (
                              <td key={j} className="px-2 py-1.5">{c}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="bg-card rounded-xl border border-border p-10 shadow-sm text-center text-muted-foreground">
          Создайте сущность генерации, чтобы начать загружать в неё таблицы.
        </section>
      )}
    </div>
  );
}

function RandomizeView({
  entities,
  selectedEntityId,
  setSelectedEntityId,
  onSave,
}: {
  entities: Entity[];
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  onSave: (sourceEntityId: string, sourceEntityName: string, items: GenItem[], name: string) => void;
}) {
  const [items, setItems] = useState<GenItem[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const entity = entities.find((e) => e.id === selectedEntityId) ?? null;
  const tables = entity?.tables ?? [];

  const canGenerate = tables.length > 0 && tables.some((t) => t.rows.length > 0);

  const formatItem = (it: GenItem) =>
    `"${it.tableName}" "№ ${it.idx + 1}" "${it.row.join(" | ")}"`;

  const generate = () => {
    if (!entity) return;
    const next: GenItem[] = [];
    for (const t of entity.tables) {
      if (t.rows.length === 0) continue;
      const idx = pickRandomIndex(t.rows.length);
      next.push({ tableId: t.id, tableName: t.name, idx, row: t.rows[idx] });
    }
    setItems(next);
    setJustSaved(false);
  };

  const save = () => {
    if (!entity || items.length === 0) return;
    const name = prompt(
      "Название сохранённой сущности (можно оставить пустым):",
      "",
    );
    if (name === null) return; // user cancelled
    onSave(entity.id, entity.name, items, name.trim());
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const regenerateOne = (tableId: string) => {
    if (!entity) return;
    const t = entity.tables.find((x) => x.id === tableId);
    if (!t || t.rows.length === 0) return;
    const idx = pickRandomIndex(t.rows.length);
    setItems((prev) =>
      prev.map((it) =>
        it.tableId === tableId
          ? { tableId: t.id, tableName: t.name, idx, row: t.rows[idx] }
          : it,
      ),
    );
  };

  const copy = () => {
    if (items.length === 0) return;
    const text = items.map(formatItem).join("\n────────────────────\n");
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Сущность генерации</h2>
          <p className="text-sm text-muted-foreground">
            Выберите, из какой группы таблиц будут случайно браться строки.
          </p>
        </div>
        <EntityPicker
          entities={entities}
          selectedId={selectedEntityId}
          onSelect={setSelectedEntityId}
          onCreate={() => {
            const name = prompt("Название сущности генерации:");
            if (!name || !name.trim()) return;
            // re-using SettingsView's create logic via parent isn't trivial here;
            // but we update at the parent level via the same setter on the entities prop is not available.
            // The "Новая" button in Randomize is a convenience; we trigger an event via window prompt + dispatch.
            const ev = new CustomEvent("create-entity", { detail: name.trim() });
            window.dispatchEvent(ev);
          }}
        />
      </section>

      <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-lg font-semibold">Генерация</h2>
            <p className="text-sm text-muted-foreground">
              {entity
                ? `Из каждой таблицы сущности «${entity.name}» будет взята случайная строка.`
                : "Выберите сущность генерации, чтобы продолжить."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {items.length > 0 && (
              <>
                <button
                  onClick={copy}
                  className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition"
                >
                  Копировать
                </button>
                <button
                  onClick={save}
                  className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition inline-flex items-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                  {justSaved ? "Сохранено" : "Сохранить"}
                </button>
              </>
            )}
            <button
              onClick={generate}
              disabled={!canGenerate}
              className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M3 21v-5h5" /></svg>
              Сгенерировать
            </button>
          </div>
        </div>

        {!canGenerate && (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm mb-4">
            {entity
              ? "В выбранной сущности нет таблиц с данными. Загрузите их в «Настройках»."
              : "Сначала выберите или создайте сущность генерации."}
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground font-mono whitespace-pre-line">
            {'Здесь появится результат, например:\n"Имена" "№ 3" "Анна"\n────────────────────\n"Глаголы" "№ 7" "бежит"'}
          </div>
        ) : (
          <ul className="rounded-lg border border-input bg-background p-2">
            {items.map((it, idx) => (
              <li key={it.tableId}>
                <div className="flex items-start gap-2 group">
                  <button
                    onClick={() => regenerateOne(it.tableId)}
                    title={`Перегенерировать строку из «${it.tableName}»`}
                    className="shrink-0 mt-1.5 p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition"
                    aria-label="Перегенерировать"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M3 21v-5h5" />
                    </svg>
                  </button>
                  <div className="flex-1 px-2 py-2 font-mono text-sm break-words">
                    {formatItem(it)}
                  </div>
                </div>
                {idx < items.length - 1 && (
                  <div className="ml-10 my-1 border-t border-border" />
                )}
              </li>
            ))}
          </ul>
        )}

        {tables.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">Таблиц в работе:</span>
            {tables.map((t) => (
              <span key={t.id}>
                {t.name} <span className="text-foreground/40">({t.rows.length})</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SavedView({
  saved,
  setSaved,
  entities,
}: {
  saved: SavedGeneration[];
  setSaved: React.Dispatch<React.SetStateAction<SavedGeneration[]>>;
  entities: Entity[];
}) {
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const exportSaved = () => {
    if (saved.length === 0) {
      alert("Пока нечего выгружать.");
      return;
    }
    const payload = {
      type: "csv-mixer:saved",
      version: 1,
      exportedAt: new Date().toISOString(),
      items: saved,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `csv-mixer-saved-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importSaved = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const arr: unknown = Array.isArray(data) ? data : data?.items;
      if (!Array.isArray(arr)) {
        alert("Файл не похож на выгрузку «Сохранённого».");
        return;
      }
      const incoming: SavedGeneration[] = [];
      for (const raw of arr) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        const items = Array.isArray(r.items) ? (r.items as GenItem[]) : null;
        if (
          typeof r.sourceEntityId !== "string" ||
          typeof r.sourceEntityName !== "string" ||
          typeof r.createdAt !== "number" ||
          !items
        ) {
          continue;
        }
        incoming.push({
          id: typeof r.id === "string" ? r.id : uid(),
          name: typeof r.name === "string" && r.name ? r.name : undefined,
          sourceEntityId: r.sourceEntityId,
          sourceEntityName: r.sourceEntityName,
          createdAt: r.createdAt,
          items,
        });
      }
      if (incoming.length === 0) {
        alert("В файле не найдено подходящих записей.");
        return;
      }
      let added = 0;
      let skipped = 0;
      setSaved((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const merged = [...prev];
        for (const it of incoming) {
          let item = it;
          if (existingIds.has(item.id)) {
            // assign a fresh id to avoid collision instead of skipping
            item = { ...item, id: uid() };
          }
          merged.push(item);
          existingIds.add(item.id);
          added++;
        }
        merged.sort((a, b) => b.createdAt - a.createdAt);
        return merged;
      });
      const msg = `Загружено записей: ${added}` + (skipped ? `, пропущено: ${skipped}` : "");
      alert(msg);
    } catch {
      alert("Не удалось прочитать файл. Убедитесь, что это корректный JSON.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const formatItem = (it: GenItem) =>
    `"${it.tableName}" "№ ${it.idx + 1}" "${it.row.join(" | ")}"`;

  const formatDate = (ts: number) => {
    try {
      return new Date(ts).toLocaleString("ru-RU");
    } catch {
      return "";
    }
  };

  // Build the list of source-entity options that actually appear in the saved list
  const sourceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of saved) {
      if (!map.has(s.sourceEntityId)) map.set(s.sourceEntityId, s.sourceEntityName);
    }
    // Prefer current entity name if it exists
    for (const e of entities) {
      if (map.has(e.id)) map.set(e.id, e.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [saved, entities]);

  const visible = useMemo(() => {
    const list = filter === "all" ? saved : saved.filter((s) => s.sourceEntityId === filter);
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [saved, filter]);

  const removeOne = (id: string) => {
    setSaved((prev) => prev.filter((s) => s.id !== id));
    if (openId === id) setOpenId(null);
  };

  const opened = openId ? saved.find((s) => s.id === openId) ?? null : null;

  if (opened) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground mb-1">
                Сущность: <span className="font-medium text-foreground">{opened.sourceEntityName}</span>
                <span className="mx-2">•</span>
                {formatDate(opened.createdAt)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold tracking-tight break-words">
                  {opened.name || "Без названия"}
                </h2>
                <button
                  onClick={() => {
                    const next = prompt(
                      "Новое название (можно оставить пустым):",
                      opened.name ?? "",
                    );
                    if (next === null) return;
                    const trimmed = next.trim();
                    setSaved((prev) =>
                      prev.map((s) =>
                        s.id === opened.id ? { ...s, name: trimmed || undefined } : s,
                      ),
                    );
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition"
                  title="Переименовать"
                  aria-label="Переименовать"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                </button>
              </div>
            </div>
            <button
              onClick={() => setOpenId(null)}
              className="p-2 rounded-lg border border-border hover:bg-muted transition shrink-0"
              aria-label="Закрыть"
              title="Закрыть"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <ul className="rounded-lg border border-input bg-card p-2">
            {opened.items.map((it, idx) => (
              <li key={it.tableId + ":" + idx}>
                <div className="px-3 py-3 font-mono text-sm break-words">
                  {formatItem(it)}
                </div>
                {idx < opened.items.length - 1 && (
                  <div className="my-1 border-t border-border" />
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex gap-2 flex-wrap">
            <button
              onClick={() => {
                const text = opened.items.map(formatItem).join("\n────────────────────\n");
                navigator.clipboard?.writeText(text);
              }}
              className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition"
            >
              Копировать
            </button>
            <button
              onClick={() => {
                if (confirm("Удалить эту сохранённую сущность?")) removeOne(opened.id);
              }}
              className="px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-semibold">Сохранённое</h2>
          <p className="text-sm text-muted-foreground">
            Здесь хранятся результаты, которые вы сохранили из вкладки «Генерация».
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Фильтр:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[180px]"
            >
              <option value="all">Все</option>
              {sourceOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <button
            onClick={exportSaved}
            className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition inline-flex items-center gap-1.5"
            title="Скачать всё «Сохранённое» в JSON"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Выгрузить
          </button>
          <label
            className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition inline-flex items-center gap-1.5 cursor-pointer"
            title="Загрузить ранее выгруженный JSON"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            Загрузить
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => importSaved(e.target.files)}
            />
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-lg p-10 text-center text-muted-foreground text-sm">
          {saved.length === 0
            ? "Пока ничего не сохранено. Сгенерируйте результат и нажмите «Сохранить» во вкладке «Генерация»."
            : "По выбранному фильтру ничего не найдено."}
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {visible.map((s) => {
            const preview = s.items
              .slice(0, 2)
              .map((it) => `${it.tableName}: ${it.row.join(" | ")}`)
              .join(" • ");
            return (
              <li key={s.id}>
                <button
                  onClick={() => setOpenId(s.id)}
                  className="group w-full text-left p-4 rounded-lg border border-border bg-background hover:border-accent/60 hover:bg-accent/5 transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-accent/10 text-accent truncate max-w-[60%]">
                      {s.sourceEntityName}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(s.createdAt)}
                    </span>
                  </div>
                  <div className={`text-sm font-semibold mb-1 break-words ${s.name ? "text-foreground" : "text-muted-foreground italic"}`}>
                    {s.name || "Без названия"}
                  </div>
                  <div className="text-sm text-foreground/70 line-clamp-2">
                    {preview || "(пусто)"}
                    {s.items.length > 2 && (
                      <span className="text-muted-foreground"> … +{s.items.length - 2}</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {s.items.length} {s.items.length === 1 ? "строка" : "строк"}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const STORAGE_KEY = "csv-mixer:state:v1";
const SAVED_KEY = "csv-mixer:saved:v1";

function loadSaved(): SavedGeneration[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedGeneration[]) : [];
  } catch {
    return [];
  }
}

function loadState(): { entities: Entity[]; selectedEntityId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entities: [], selectedEntityId: null };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entities)) {
      return { entities: [], selectedEntityId: null };
    }
    return {
      entities: parsed.entities as Entity[],
      selectedEntityId: parsed.selectedEntityId ?? null,
    };
  } catch {
    return { entities: [], selectedEntityId: null };
  }
}

export default function App() {
  const [view, setView] = useState<View>("settings");
  const initial = useState(() => loadState())[0];
  const initialSaved = useState(() => loadSaved())[0];
  const [entities, setEntities] = useState<Entity[]>(initial.entities);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initial.selectedEntityId);
  const [saved, setSaved] = useState<SavedGeneration[]>(initialSaved);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ entities, selectedEntityId }),
      );
    } catch {
      // ignore quota / serialization errors
    }
  }, [entities, selectedEntityId]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
      // ignore quota / serialization errors
    }
  }, [saved]);

  const handleSaveGeneration = (
    sourceEntityId: string,
    sourceEntityName: string,
    items: GenItem[],
    name: string,
  ) => {
    setSaved((prev) => [
      { id: uid(), name: name || undefined, sourceEntityId, sourceEntityName, createdAt: Date.now(), items },
      ...prev,
    ]);
  };

  // listen for create-entity events fired from RandomizeView's "Новая" button
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      const name = ce.detail?.trim();
      if (!name) return;
      const lower = name.toLowerCase();
      let created = false;
      setEntities((prev) => {
        if (prev.some((x) => x.name.trim().toLowerCase() === lower)) {
          alert(`Сущность с названием «${name}» уже существует.`);
          return prev;
        }
        const id = uid();
        created = true;
        setSelectedEntityId(id);
        return [...prev, { id, name, tables: [] }];
      });
      void created;
    };
    window.addEventListener("create-entity", handler);
    return () => window.removeEventListener("create-entity", handler);
  }, []);

  // Keep saved generations' "Сущность" label in sync when an entity is renamed
  useEffect(() => {
    setSaved((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        const ent = entities.find((e) => e.id === s.sourceEntityId);
        if (ent && ent.name !== s.sourceEntityName) {
          changed = true;
          return { ...s, sourceEntityName: ent.name };
        }
        return s;
      });
      return changed ? next : prev;
    });
  }, [entities]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            CSV Mixer
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Случайные комбинации из CSV таблиц
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Создайте сущность генерации, загрузите в неё таблицы, а потом в
            вкладке «Генерация» получайте случайные строки.
          </p>
        </header>

        <nav className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => setView("settings")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              view === "settings"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Настройки
          </button>
          <button
            onClick={() => setView("randomize")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              view === "randomize"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Генерация
          </button>
          <button
            onClick={() => setView("saved")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition inline-flex items-center gap-1.5 ${
              view === "saved"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Сохранённое
            {saved.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-accent/15 text-accent">
                {saved.length}
              </span>
            )}
          </button>
        </nav>

        {view === "settings" && (
          <SettingsView
            entities={entities}
            setEntities={setEntities}
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
          />
        )}
        {view === "randomize" && (
          <RandomizeView
            entities={entities}
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
            onSave={handleSaveGeneration}
          />
        )}
        {view === "saved" && (
          <SavedView saved={saved} setSaved={setSaved} entities={entities} />
        )}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Все данные обрабатываются прямо в браузере — ничего не отправляется на сервер.
        </footer>
      </div>
    </div>
  );
}

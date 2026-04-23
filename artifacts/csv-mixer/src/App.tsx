import { useState, useRef, useEffect } from "react";

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

type View = "settings" | "randomize";

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

  const createEntity = () => {
    const name = prompt("Название сущности генерации:");
    if (!name || !name.trim()) return;
    const id = uid();
    setEntities((prev) => [...prev, { id, name: name.trim(), tables: [] }]);
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
    updateEntity(id, (e) => ({ ...e, name }));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !entity) return;
    const newTables: Table[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      const { rows } = parseCsv(text);
      newTables.push({
        id: uid(),
        name: file.name.replace(/\.csv$/i, ""),
        rows,
      });
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
                      <input
                        value={t.name}
                        onChange={(e) => renameTable(t.id, e.target.value)}
                        className="font-medium text-sm bg-transparent border-b border-transparent hover:border-border focus:border-ring focus:outline-none px-1 py-0.5 flex-1"
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
}: {
  entities: Entity[];
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
}) {
  const [output, setOutput] = useState("");
  const entity = entities.find((e) => e.id === selectedEntityId) ?? null;
  const tables = entity?.tables ?? [];

  const canGenerate = tables.length > 0 && tables.some((t) => t.rows.length > 0);

  const generate = () => {
    if (!entity) return;
    const lines: string[] = [];
    for (const t of entity.tables) {
      if (t.rows.length === 0) continue;
      const idx = pickRandomIndex(t.rows.length);
      const row = t.rows[idx];
      lines.push(`"${t.name}" "№ ${idx + 1}" "${row.join(" | ")}"`);
    }
    setOutput(lines.join("\n────────────────────\n"));
  };

  const copy = () => {
    if (output) navigator.clipboard?.writeText(output);
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
            <h2 className="text-lg font-semibold">Окно рандомизации</h2>
            <p className="text-sm text-muted-foreground">
              {entity
                ? `Из каждой таблицы сущности «${entity.name}» будет взята случайная строка.`
                : "Выберите сущность генерации, чтобы продолжить."}
            </p>
          </div>
          <div className="flex gap-2">
            {output && (
              <button
                onClick={copy}
                className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition"
              >
                Копировать
              </button>
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

        <textarea
          value={output}
          onChange={(e) => setOutput(e.target.value)}
          readOnly={!canGenerate}
          placeholder={'Здесь появится результат, например:\n"Имена" "№ 3" "Анна"\n"Глаголы" "№ 7" "бежит"'}
          className="w-full min-h-[280px] font-mono text-sm p-4 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />

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

export default function App() {
  const [view, setView] = useState<View>("settings");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // listen for create-entity events fired from RandomizeView's "Новая" button
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>;
      const name = ce.detail;
      if (!name) return;
      const id = uid();
      setEntities((prev) => [...prev, { id, name, tables: [] }]);
      setSelectedEntityId(id);
    };
    window.addEventListener("create-entity", handler);
    return () => window.removeEventListener("create-entity", handler);
  }, []);

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
            окне рандомизации получайте случайные строки.
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
            Окно рандомизации
          </button>
        </nav>

        {view === "settings" ? (
          <SettingsView
            entities={entities}
            setEntities={setEntities}
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
          />
        ) : (
          <RandomizeView
            entities={entities}
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
          />
        )}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Все данные обрабатываются прямо в браузере — ничего не отправляется на сервер.
        </footer>
      </div>
    </div>
  );
}

import { useState, useRef, useMemo } from "react";

type Row = string[];

interface Table {
  id: string;
  name: string;
  headers: Row;
  rows: Row[];
}

function parseCsv(text: string): { headers: Row; rows: Row[] } {
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
  if (cleaned.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = cleaned;
  return { headers, rows };
}

function pickRandomIndex(len: number): number {
  return Math.floor(Math.random() * len);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

type View = "settings" | "randomize";

interface AppProps {
  view: View;
  setView: (v: View) => void;
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
}

function SettingsView({ tables, setTables }: { tables: Table[]; setTables: React.Dispatch<React.SetStateAction<Table[]>> }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const newTables: Table[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      const { headers, rows } = parseCsv(text);
      newTables.push({
        id: uid(),
        name: file.name.replace(/\.csv$/i, ""),
        headers,
        rows,
      });
    }
    setTables((prev) => [...prev, ...newTables]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeTable = (id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
  };

  const renameTable = (id: string, name: string) => {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  };

  return (
    <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-semibold">Таблицы</h2>
          <p className="text-sm text-muted-foreground">
            Поддерживаются файлы .csv. Первая строка — заголовки.
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

      {tables.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-lg p-10 text-center text-muted-foreground">
          Нет загруженных таблиц. Нажмите «Загрузить CSV», чтобы начать.
        </div>
      ) : (
        <div className="space-y-3">
          {tables.map((t) => (
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
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="px-2 py-1.5 font-medium w-10">№</th>
                      {t.headers.map((h, i) => (
                        <th key={i} className="px-2 py-1.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-2 py-1.5 text-muted-foreground font-mono">{i + 1}</td>
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
  );
}

function RandomizeView({ tables }: { tables: Table[] }) {
  const [output, setOutput] = useState("");

  const canGenerate = tables.length > 0 && tables.some((t) => t.rows.length > 0);

  const generate = () => {
    const lines: string[] = [];
    for (const t of tables) {
      if (t.rows.length === 0) continue;
      const idx = pickRandomIndex(t.rows.length);
      const row = t.rows[idx];
      lines.push(`"${t.name}" "№ ${idx + 1}" "${row.join(" | ")}"`);
    }
    setOutput(lines.join("\n"));
  };

  const copy = () => {
    if (output) navigator.clipboard?.writeText(output);
  };

  return (
    <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-semibold">Окно рандомизации</h2>
          <p className="text-sm text-muted-foreground">
            Из каждой загруженной таблицы будет взята случайная строка.
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
          Загрузите хотя бы одну таблицу с данными на странице «Настройки».
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
  );
}

function Shell({ view, setView, tables, setTables }: AppProps) {
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
            Загрузите CSV таблицы на странице настроек, затем перейдите в окно
            рандомизации, чтобы получить случайные строки.
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
          <SettingsView tables={tables} setTables={setTables} />
        ) : (
          <RandomizeView tables={tables} />
        )}

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Все данные обрабатываются прямо в браузере — ничего не отправляется на сервер.
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("settings");
  const [tables, setTables] = useState<Table[]>([]);
  // suppress unused warning for useMemo import removal
  useMemo(() => null, []);
  return <Shell view={view} setView={setView} tables={tables} setTables={setTables} />;
}

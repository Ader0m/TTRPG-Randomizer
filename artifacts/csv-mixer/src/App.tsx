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

function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function App() {
  const [tables, setTables] = useState<Table[]>([]);
  const [separator, setSeparator] = useState(" ");
  const [results, setResults] = useState<{ id: string; parts: { tableName: string; row: Row }[] }[]>([]);
  const [count, setCount] = useState(1);
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

  const generate = () => {
    if (tables.length === 0) return;
    const newResults = [];
    for (let i = 0; i < count; i++) {
      const parts = tables
        .map((t) => {
          const row = pickRandom(t.rows);
          return row ? { tableName: t.name, row } : null;
        })
        .filter((p): p is { tableName: string; row: Row } => p !== null);
      newResults.push({ id: uid(), parts });
    }
    setResults((prev) => [...newResults, ...prev]);
  };

  const clearResults = () => setResults([]);

  const totalCombinations = useMemo(() => {
    if (tables.length === 0) return 0;
    return tables.reduce((acc, t) => acc * Math.max(t.rows.length, 1), 1);
  }, [tables]);

  const canGenerate = tables.length > 0 && tables.every((t) => t.rows.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            CSV Mixer
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Случайные комбинации из CSV таблиц
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Загрузите одну или несколько CSV таблиц. По нажатию кнопки приложение
            случайно выберет по одной целой строке из каждой таблицы и склеит их
            в готовый ответ.
          </p>
        </header>

        <section className="bg-card rounded-xl border border-border p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-lg font-semibold">1. Таблицы</h2>
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
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          {t.headers.map((h, i) => (
                            <th key={i} className="px-2 py-1.5 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {t.rows.slice(0, 3).map((r, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            {r.map((c, j) => (
                              <td key={j} className="px-2 py-1.5">{c}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {t.rows.length > 3 && (
                      <div className="text-xs text-muted-foreground mt-1 px-2">
                        … и ещё {t.rows.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-card rounded-xl border border-border p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">2. Настройки</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium block mb-1.5">Разделитель между частями</span>
              <input
                value={separator}
                onChange={(e) => setSeparator(e.target.value)}
                placeholder="например, пробел или ' — '"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium block mb-1.5">Сколько вариантов сгенерировать</span>
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          {tables.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Возможных комбинаций: <span className="font-mono font-medium text-foreground">{totalCombinations.toLocaleString("ru-RU")}</span>
            </p>
          )}
        </section>

        <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <h2 className="text-lg font-semibold">3. Результаты</h2>
            <div className="flex gap-2">
              {results.length > 0 && (
                <button
                  onClick={clearResults}
                  className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition"
                >
                  Очистить
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

          {results.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 text-sm">
              {canGenerate
                ? "Нажмите «Сгенерировать», чтобы создать случайные комбинации."
                : "Загрузите хотя бы одну таблицу с данными."}
            </div>
          ) : (
            <ul className="space-y-3">
              {results.map((r, idx) => {
                const text = r.parts.map((p) => p.row.join(" ")).join(separator);
                return (
                  <li
                    key={r.id}
                    className="border border-border rounded-lg p-4 bg-background hover:border-accent/50 transition"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        #{results.length - idx}
                      </span>
                      <button
                        onClick={() => navigator.clipboard?.writeText(text)}
                        className="text-xs text-muted-foreground hover:text-foreground transition"
                        title="Скопировать"
                      >
                        Копировать
                      </button>
                    </div>
                    <p className="text-base leading-relaxed">{text}</p>
                    <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {r.parts.map((p, i) => (
                        <span key={i}>
                          <span className="font-medium text-foreground/70">{p.tableName}:</span>{" "}
                          {p.row.join(", ")}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Все данные обрабатываются прямо в браузере — ничего не отправляется на сервер.
        </footer>
      </div>
    </div>
  );
}

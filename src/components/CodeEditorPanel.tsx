import React, { useState, useRef } from 'react';
import {
  Play,
  Copy,
  Download,
  Terminal,
  RotateCcw,
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  Check,
  Eye,
  Cpu,
  Loader2,
  Keyboard,
  Layout,
} from 'lucide-react';

interface CodeEditorPanelProps {
  roomName: string;
  roomId: string;
  canEdit?: boolean;
  code: {
    content: string;
    language: string;
    lastUpdatedBy: string;
  };
  onUpdateCode: (content: string, language?: string) => void;
  onClose: () => void;
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  compileOutput?: string;
  exitCode: number;
  executionTimeMs: number;
  engine: string;
  language: string;
}

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript (Node.js)', ext: 'js' },
  { id: 'typescript', name: 'TypeScript (esbuild)', ext: 'ts' },
  { id: 'python', name: 'Python 3', ext: 'py' },
  { id: 'cpp', name: 'C++ (GCC C++20)', ext: 'cpp' },
  { id: 'c', name: 'C (GCC C17)', ext: 'c' },
  { id: 'java', name: 'Java (OpenJDK)', ext: 'java' },
  { id: 'csharp', name: 'C# (Mono)', ext: 'cs' },
  { id: 'go', name: 'Go (Golang)', ext: 'go' },
  { id: 'rust', name: 'Rust', ext: 'rs' },
  { id: 'sql', name: 'SQL (SQLite 3)', ext: 'sql' },
  { id: 'html', name: 'HTML5 & CSS3 (Canlı Önizleme)', ext: 'html' },
  { id: 'json', name: 'JSON Doğrulayıcı', ext: 'json' },
];

const CODE_TEMPLATES: { name: string; language: string; code: string }[] = [
  {
    name: '🐍 Python: Veri Analizi & Algoritma',
    language: 'python',
    code: `# Python 3 Sunucu Derleyicisi Testi
import math

def asal_sayilari_bul(limit):
    asallar = []
    for sayi in range(2, limit + 1):
        if all(sayi % i != 0 for i in range(2, int(math.isqrt(sayi)) + 1)):
            asallar.append(sayi)
    return asallar

liste = asal_sayilari_bul(50)
print(f"1-50 arası asal sayılar ({len(liste)} adet):", liste)
print("Toplamları:", sum(liste))
`,
  },
  {
    name: '🔷 TypeScript: Tip Güvenli Mimari',
    language: 'typescript',
    code: `// TypeScript (esbuild + Node.js VM) Derleme Testi
interface Kullanici {
  id: number;
  ad: string;
  rol: 'owner' | 'admin' | 'editor' | 'viewer';
  puan: number;
}

const ekip: Kullanici[] = [
  { id: 1, ad: "Ahmet", rol: "owner", puan: 95 },
  { id: 2, ad: "Zeynep", rol: "admin", puan: 88 },
  { id: 3, ad: "Mehmet", rol: "editor", puan: 92 },
];

const ortalama = ekip.reduce((toplam, k) => toplam + k.puan, 0) / ekip.length;
console.log("Takım Üyeleri:", ekip.map(k => \`\${k.ad} (\${k.rol})\`).join(", "));
console.log("Ortalama Performans Puanı:", ortalama.toFixed(2));
`,
  },
  {
    name: '⚙️ C++20: Hızlı Sıralama & Vektör',
    language: 'cpp',
    code: `#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>

int main() {
    std::vector<int> veriler = {42, 15, 8, 99, 23, 4, 16, 55};
    std::sort(veriler.begin(), veriler.end());

    std::cout << "Siralanmis Dizi: ";
    for (int x : veriler) std::cout << x << " ";
    std::cout << "\\nToplam: " << std::accumulate(veriler.begin(), veriler.end(), 0) << std::endl;
    return 0;
}
`,
  },
  {
    name: '☕ Java: Nesne Yönelimli Sistem',
    language: 'java',
    code: `import java.util.*;

class Prog {
    public static void main(String[] args) {
        List<String> moduller = Arrays.asList("WebSocket", "WebRTC", "Canvas2D", "AI-Generator", "Compiler");
        System.out.println("CollabBoard Aktif Modüller (" + moduller.size() + "):");
        for (int i = 0; i < moduller.size(); i++) {
            System.out.println("  " + (i + 1) + ". " + moduller.get(i));
        }
    }
}
`,
  },
  {
    name: '🗄️ SQL: Tablo Oluşturma & Sorgu',
    language: 'sql',
    code: `CREATE TABLE odalar (id INTEGER PRIMARY KEY, ad TEXT, kullanici_sayisi INTEGER, kilitli TEXT);
INSERT INTO odalar VALUES (1, 'Genel Çalışma Alanı', 8, 'Açık');
INSERT INTO odalar VALUES (2, 'Mimari Tasarım Odası', 5, 'Kilitli');
INSERT INTO odalar VALUES (3, 'Backend Ekibi', 11, 'Açık');

SELECT id || ' | ' || ad || ' | Katılımcı: ' || kullanici_sayisi || ' | Durum: ' || kilitli FROM odalar ORDER BY kullanici_sayisi DESC;
`,
  },
  {
    name: '🌐 HTML5 & CSS3: Canlı Kart Tasarımı',
    language: 'html',
    code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 90vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; padding: 24px; border-radius: 16px; width: 320px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.4); }
    .badge { display: inline-block; background: #2563eb; color: white; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px; margin-bottom: 12px; }
    h2 { margin: 0 0 8px 0; font-size: 20px; }
    p { margin: 0 0 16px 0; color: #94a3b8; font-size: 14px; line-height: 1.5; }
    button { background: #10b981; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">CANLI ÖNİZLEME</span>
    <h2>CollabBoard UI</h2>
    <p>HTML, CSS ve JavaScript kodlarınızı gerçek zamanlı olarak bu alanda önizleyebilirsiniz.</p>
    <button onclick="this.textContent = '🎉 Tıklandı!'">Test Et</button>
  </div>
</body>
</html>`,
  },
];

const WANDBOX_CLIENT_MAP: Record<string, { compiler: string; label: string }> = {
  python: { compiler: 'cpython-3.12.7', label: 'Python 3.12 (Wandbox Cloud)' },
  cpp: { compiler: 'gcc-head', label: 'GCC C++20 (Wandbox Cloud)' },
  c: { compiler: 'gcc-head-c', label: 'GCC C17 (Wandbox Cloud)' },
  csharp: { compiler: 'mono-6.12.0.199', label: 'Mono C# (Wandbox Cloud)' },
  java: { compiler: 'openjdk-jdk-22+36', label: 'OpenJDK 22 (Wandbox Cloud)' },
  go: { compiler: 'go-1.23.2', label: 'Go 1.23 (Wandbox Cloud)' },
  rust: { compiler: 'rust-1.82.0', label: 'Rust 1.82 (Wandbox Cloud)' },
  sql: { compiler: 'sqlite-3.46.1', label: 'SQLite 3.46 (Wandbox Cloud)' },
};

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  roomName,
  roomId,
  canEdit = true,
  code,
  onUpdateCode,
  onClose,
}) => {
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [stdinText, setStdinText] = useState<string>('');
  const [showStdin, setShowStdin] = useState<boolean>(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Client-side fallback compiler (used if hosted on static GitHub Pages without Node backend)
  const executeClientFallback = async (
    sourceCode: string,
    lang: string,
    stdinVal: string
  ): Promise<ExecutionResult> => {
    const startTime = performance.now();

    if (lang === 'javascript' || lang === 'typescript') {
      const logs: string[] = [];
      const errors: string[] = [];
      const stdinLines = stdinVal.split(/\r?\n/);
      let stdinIdx = 0;

      const formatItem = (a: unknown) =>
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a);

      const customConsole = {
        log: (...args: unknown[]) => logs.push(args.map(formatItem).join(' ')),
        info: (...args: unknown[]) => logs.push(args.map(formatItem).join(' ')),
        warn: (...args: unknown[]) => logs.push('⚠️ ' + args.map(formatItem).join(' ')),
        error: (...args: unknown[]) => errors.push(args.map(formatItem).join(' ')),
        table: (d: unknown) => logs.push(formatItem(d)),
      };

      try {
        // Basic TypeScript type annotation stripping if running in static browser fallback
        const runnableJs =
          lang === 'typescript'
            ? sourceCode
                .replace(/interface\s+\w+\s*\{[\s\S]*?\}/g, '')
                .replace(/:\s*[A-Za-z0-9_<>\[\]\s|'"`]+(?=[=;,)\n])/g, '')
            : sourceCode;

        const runFn = new Function('console', 'input', 'prompt', runnableJs);
        const inputFn = () => (stdinIdx < stdinLines.length ? stdinLines[stdinIdx++] : '');
        const ret = runFn(customConsole, inputFn, inputFn);
        if (ret !== undefined && logs.length === 0) {
          logs.push(formatItem(ret));
        }
        return {
          stdout: logs.join('\n'),
          stderr: errors.join('\n'),
          exitCode: errors.length > 0 ? 1 : 0,
          executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
          engine: 'Tarayıcı V8 Sandbox Motoru',
          language: lang,
        };
      } catch (err) {
        return {
          stdout: logs.join('\n'),
          stderr: String(err),
          exitCode: 1,
          executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
          engine: 'Tarayıcı V8 Sandbox Motoru',
          language: lang,
        };
      }
    }

    if (lang === 'json') {
      try {
        const parsed = JSON.parse(sourceCode);
        return {
          stdout: JSON.stringify(parsed, null, 2),
          stderr: '',
          exitCode: 0,
          executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
          engine: 'JSON Doğrulayıcı',
          language: lang,
        };
      } catch (e) {
        return {
          stdout: '',
          stderr: String(e),
          exitCode: 1,
          executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
          engine: 'JSON Doğrulayıcı',
          language: lang,
        };
      }
    }

    // Multi-language cloud compiler via Wandbox API (works directly from GitHub Pages too!)
    const cfg = WANDBOX_CLIENT_MAP[lang] || WANDBOX_CLIENT_MAP.python;
    const resp = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compiler: cfg.compiler,
        code: sourceCode,
        stdin: stdinVal || '',
        save: false,
      }),
    });

    const data = await resp.json();
    const compileErr = (data.compiler_error || data.compiler_output || '').trim();
    const progErr = (data.program_error || '').trim();
    return {
      stdout: (data.program_output || '').trimEnd(),
      stderr: [compileErr, progErr].filter(Boolean).join('\n'),
      compileOutput: compileErr,
      exitCode: Number(data.status ?? 0),
      executionTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      engine: cfg.label,
      language: lang,
    };
  };

  // Compile & Run Code via Backend Compiler API (with automatic Cloud Compiler fallback for GitHub Pages)
  const handleRunCode = async () => {
    if (code.language === 'html') {
      setShowHtmlPreview(true);
    }

    setIsRunning(true);
    try {
      const response = await fetch('/api/code/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.content,
          language: code.language,
          stdin: stdinText,
          roomId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = (await response.json()) as ExecutionResult;
      setExecResult(result);
    } catch {
      // Fallback for static GitHub Pages hosting where /api/code/execute is not on local server
      try {
        const fallbackResult = await executeClientFallback(
          code.content,
          code.language,
          stdinText
        );
        setExecResult(fallbackResult);
      } catch (fallbackErr) {
        setExecResult({
          stdout: '',
          stderr: `Derleme Hatası: ${String(fallbackErr)}`,
          exitCode: 1,
          executionTimeMs: 0,
          engine: 'Cloud Compiler',
          language: code.language,
        });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code.content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code.content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const langObj = LANGUAGES.find((l) => l.id === code.language);
    const ext = langObj?.ext || 'txt';
    const blob = new Blob([code.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collab-code-${roomId}-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle Tab key inside code textarea for proper indentation
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!canEdit) return;
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const nextVal = code.content.substring(0, start) + '  ' + code.content.substring(end);
      onUpdateCode(nextVal, code.language);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleRunCode();
    }
  };

  // Generate line numbers
  const linesCount = code.content.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(linesCount, 1) }, (_, i) => i + 1);

  return (
    <div
      className={`fixed z-30 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
        isFullscreen
          ? 'inset-6'
          : 'top-16 right-4 bottom-6 w-[620px] max-w-[calc(100vw-32px)]'
      }`}
    >
      {/* Editor Header */}
      <div className="h-12 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between gap-3 text-xs select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full bg-rose-500/80 shrink-0" />
          <span className="w-3 h-3 rounded-full bg-amber-500/80 shrink-0" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80 shrink-0" />
          <span className="font-semibold text-slate-200 ml-1.5 truncate">
            {roomName} <span className="font-mono text-slate-500">(#{roomId})</span>
          </span>
          {!canEdit && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-semibold shrink-0">
              <Eye className="w-3 h-3" />
              Salt Okunur
            </span>
          )}
          {code.lastUpdatedBy && (
            <span className="text-slate-500 text-[11px] hidden sm:inline truncate">
              · <strong className="text-slate-400">{code.lastUpdatedBy}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Language Selector */}
          <select
            value={code.language}
            disabled={!canEdit}
            onChange={(e) => {
              const nextLang = e.target.value;
              onUpdateCode(code.content, nextLang);
              if (nextLang === 'html') setShowHtmlPreview(true);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs font-medium focus:outline-hidden disabled:opacity-50"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {code.language === 'html' && (
            <button
              onClick={() => setShowHtmlPreview((v) => !v)}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${
                showHtmlPreview
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Canlı HTML Önizlemeyi Aç/Kapat"
            >
              <Layout className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            title={isFullscreen ? 'Küçült' : 'Tam Ekran'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            title="Kapat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split Body: Code Editor + Optional Live HTML Preview */}
      <div className="flex-1 flex overflow-hidden bg-slate-900">
        {/* Line Numbers */}
        <div className="w-12 py-3 bg-slate-950/40 text-slate-600 font-mono text-xs select-none text-right pr-3 shrink-0 overflow-hidden">
          {lineNumbers.map((num) => (
            <div key={num} className="leading-6">
              {num}
            </div>
          ))}
        </div>

        {/* Code Text Area */}
        <textarea
          ref={textareaRef}
          value={code.content}
          readOnly={!canEdit}
          onKeyDown={handleTextareaKeyDown}
          onChange={(e) => {
            if (canEdit) onUpdateCode(e.target.value, code.language);
          }}
          spellCheck={false}
          className="flex-1 p-3 bg-transparent text-emerald-400 font-mono text-xs leading-6 outline-none resize-none overflow-y-auto selection:bg-blue-600/40 select-text"
          placeholder="// Bu odaya özel ortak kod alanına kodunuzu yazın ve Derle & Çalıştır (Ctrl+Enter) butonuna tıklayın..."
        />

        {/* Live HTML/CSS Preview Pane */}
        {code.language === 'html' && showHtmlPreview && (
          <div className="w-1/2 border-l border-slate-800 bg-white flex flex-col">
            <div className="h-7 bg-slate-100 border-b border-slate-200 px-3 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>Canlı Tarayıcı Önizlemesi</span>
              <button
                onClick={() => setShowHtmlPreview(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <iframe
              title="HTML Live Preview"
              sandbox="allow-scripts"
              srcDoc={code.content}
              className="flex-1 w-full border-none"
            />
          </div>
        )}
      </div>

      {/* Standard Input (stdin) Drawer */}
      {showStdin && (
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-2.5 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-amber-400" />
              Standart Girdi (stdin) — input(), cin, Scanner vb. için her satıra bir değer yazın:
            </span>
            <button
              onClick={() => setShowStdin(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              Gizle
            </button>
          </div>
          <textarea
            value={stdinText}
            onChange={(e) => setStdinText(e.target.value)}
            rows={2}
            placeholder="Örn:&#10;Ahmet&#10;42"
            className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 outline-none focus:border-blue-500 resize-none select-text"
          />
        </div>
      )}

      {/* Compiler & Execution Console Output */}
      {execResult && (
        <div className="h-48 bg-slate-950 border-t border-slate-800 flex flex-col shrink-0">
          <div className="h-8 px-4 flex items-center justify-between text-xs text-slate-400 border-b border-slate-900 select-none">
            <div className="flex items-center gap-2 min-w-0">
              <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-semibold text-slate-200">Derleyici & Konsol Çıktısı</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center gap-1 truncate">
                <Cpu className="w-3 h-3 text-emerald-400" />
                {execResult.engine}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                  execResult.exitCode === 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                }`}
              >
                Çıkış: {execResult.exitCode} ({execResult.executionTimeMs}ms)
              </span>
            </div>
            <button
              onClick={() => setExecResult(null)}
              className="flex items-center gap-1 hover:text-slate-200 text-[11px] shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Temizle
            </button>
          </div>
          <div className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-2 select-text">
            {execResult.stdout && (
              <pre className="whitespace-pre-wrap text-emerald-300 leading-relaxed">
                {execResult.stdout}
              </pre>
            )}
            {execResult.stderr && (
              <pre className="whitespace-pre-wrap text-rose-400 bg-rose-950/30 border border-rose-900/50 rounded-lg p-2.5 leading-relaxed">
                {execResult.stderr}
              </pre>
            )}
            {!execResult.stdout && !execResult.stderr && (
              <div className="text-slate-500 italic">
                Program başarıyla çalıştı ancak konsola çıktı (stdout) yazdırmadı.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor Footer & Quick Tools */}
      <div className="h-12 bg-slate-950 border-t border-slate-800 px-4 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          {/* Compile & Run Code */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold rounded-lg shadow-sm transition-colors"
            title="Kodu Sunucu Derleyicisinde Derle ve Çalıştır (Ctrl+Enter)"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Derleniyor...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Derle & Çalıştır</span>
              </>
            )}
          </button>

          {/* Toggle Stdin */}
          <button
            onClick={() => setShowStdin((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${
              showStdin || stdinText
                ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Program İçin Standart Girdi (stdin) Ekle"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Girdi (stdin)</span>
          </button>

          {/* Multi-Language Templates Dropdown */}
          {canEdit && (
            <div className="relative group">
              <button className="flex items-center gap-1 px-2.5 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Örnek Kodlar</span>
              </button>
              <div className="absolute bottom-full mb-2 left-0 hidden group-hover:flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 w-64 z-50">
                {CODE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onUpdateCode(tmpl.code, tmpl.language);
                      if (tmpl.language === 'html') setShowHtmlPreview(true);
                    }}
                    className="px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            title="Kodu Kopyala"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            title="Dosya Olarak İndir"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

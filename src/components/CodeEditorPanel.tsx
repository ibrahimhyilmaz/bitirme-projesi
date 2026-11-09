import React, { useState, useRef, useEffect } from 'react';
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
  Users,
  Plus,
  FileUp,
  Settings2,
} from 'lucide-react';
import { CodeCursorPresence } from '../types';
import { CodeFile } from '../hooks/useWebSocket';
import { useT } from '../i18n';
import { CodeEditorSettings } from './CodeEditorSettings';
import { updateCodePrefs, useCodePrefs } from '../utils/codePrefs';

interface CodeEditorPanelProps {
  roomName: string;
  roomId: string;
  canEdit?: boolean;
  code: {
    content: string;
    language: string;
    lastUpdatedBy: string;
    files?: CodeFile[];
  };
  codeCursors?: CodeCursorPresence[];
  currentUserId?: string;
  onUpdateCode: (content: string, language?: string) => void;
  onUpdateCodeFiles?: (files: CodeFile[]) => void;
  onCursorMove?: (cursor: {
    line: number;
    column: number;
    selectionStart: number;
    selectionEnd: number;
  }) => void;
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
  code: sharedCode,
  codeCursors = [],
  currentUserId,
  onUpdateCode: onUpdateMainCode,
  onUpdateCodeFiles,
  onCursorMove,
  onClose,
}) => {
  const { t } = useT();
  const prefs = useCodePrefs();
  const [showCodeSettings, setShowCodeSettings] = useState<boolean>(false);

  // ---- Multiple files: "main" is the room's primary code, the rest live in sharedCode.files ----
  const extraFiles = sharedCode.files ?? [];
  const [activeFileId, setActiveFileId] = useState<string>('main');
  const activeExtra = activeFileId !== 'main' ? extraFiles.find((f) => f.id === activeFileId) : undefined;
  const code = activeExtra
    ? { content: activeExtra.content, language: activeExtra.language, lastUpdatedBy: sharedCode.lastUpdatedBy }
    : sharedCode;
  const onUpdateCode = (content: string, language?: string) => {
    if (activeExtra) {
      onUpdateCodeFiles?.(
        extraFiles.map((f) =>
          f.id === activeExtra.id ? { ...f, content, language: language || f.language } : f
        )
      );
    } else {
      onUpdateMainCode(content, language);
    }
  };
  const mainExt = LANGUAGES.find((l) => l.id === sharedCode.language)?.ext || 'txt';
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const MAX_EXTRA_FILES = 19;

  const languageFromName = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return LANGUAGES.find((l) => l.ext === ext)?.id || (ext === 'htm' ? 'html' : ext === 'mjs' || ext === 'jsx' ? 'javascript' : ext === 'tsx' ? 'typescript' : ext === 'h' || ext === 'hpp' ? 'cpp' : 'javascript');
  };
  const newFileId = () => `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const handleAddEmptyFile = () => {
    if (!canEdit || !onUpdateCodeFiles || extraFiles.length >= MAX_EXTRA_FILES) return;
    const ext = LANGUAGES.find((l) => l.id === code.language)?.ext || 'txt';
    let n = extraFiles.length + 1;
    let name = `dosya${n}.${ext}`;
    while (extraFiles.some((f) => f.name === name)) name = `dosya${++n}.${ext}`;
    const file: CodeFile = { id: newFileId(), name, language: code.language, content: '' };
    onUpdateCodeFiles([...extraFiles, file]);
    setActiveFileId(file.id);
  };

  const handleUploadFiles = async (list: FileList | null) => {
    if (!list || !canEdit || !onUpdateCodeFiles) return;
    const added: CodeFile[] = [];
    for (const f of Array.from(list)) {
      if (extraFiles.length + added.length >= MAX_EXTRA_FILES) break;
      if (f.size > 200000) continue;
      try {
        const text = await f.text();
        if (text.includes('\u0000')) continue; // binary file
        added.push({ id: newFileId(), name: f.name, language: languageFromName(f.name), content: text });
      } catch {}
    }
    if (added.length > 0) {
      onUpdateCodeFiles([...extraFiles, ...added]);
      setActiveFileId(added[added.length - 1].id);
    }
  };

  const handleCloseFile = (id: string) => {
    if (!canEdit || !onUpdateCodeFiles) return;
    const target = extraFiles.find((f) => f.id === id);
    if (!target) return;
    if (target.content.trim() && !window.confirm(t('code.files.confirmClose', { name: target.name }))) return;
    onUpdateCodeFiles(extraFiles.filter((f) => f.id !== id));
    if (activeFileId === id) setActiveFileId('main');
  };

  const handleRenameFile = (id: string) => {
    if (!canEdit || !onUpdateCodeFiles) return;
    const target = extraFiles.find((f) => f.id === id);
    if (!target) return;
    const next = window.prompt(t('code.files.rename'), target.name)?.trim();
    if (!next || next === target.name) return;
    onUpdateCodeFiles(
      extraFiles.map((f) =>
        f.id === id ? { ...f, name: next.slice(0, 120), language: languageFromName(next) } : f
      )
    );
  };

  // ---- Resizable terminal (drag the bar above it up / down) ----
  const startTerminalResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = prefs.terminalHeight;
    const maxH = Math.max(120, window.innerHeight - 260);
    const move = (ev: PointerEvent) => {
      const next = Math.min(maxH, Math.max(80, startH + (startY - ev.clientY)));
      updateCodePrefs({ terminalHeight: Math.round(next) });
      setIsTerminalCollapsed(false);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [stdinText, setStdinText] = useState<string>('');
  const [showStdin, setShowStdin] = useState<boolean>(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showTemplatesMenu, setShowTemplatesMenu] = useState<boolean>(false);
  const [localCursor, setLocalCursor] = useState<{ line: number; column: number }>({
    line: 1,
    column: 1,
  });
  const [scrollOffset, setScrollOffset] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineGutterRef = useRef<HTMLDivElement>(null);
  const templatesMenuRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (templatesMenuRef.current && !templatesMenuRef.current.contains(e.target as Node)) {
        setShowTemplatesMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Compute 1-based line and column from character index
  const computeLineCol = (text: string, index: number) => {
    const safeIdx = Math.max(0, Math.min(index, text.length));
    const slice = text.slice(0, safeIdx);
    const lines = slice.split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  };

  const broadcastCurrentSelection = (el: HTMLTextAreaElement, textOverride?: string) => {
    const text = textOverride !== undefined ? textOverride : el.value;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    savedSelectionRef.current = { start, end };
    const { line, column } = computeLineCol(text, start);
    setLocalCursor({ line, column });
    if (onCursorMove) {
      onCursorMove({
        line,
        column,
        selectionStart: start,
        selectionEnd: end,
      });
    }
  };

  // Preserve local cursor position when remote code updates arrive
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || document.activeElement !== el || !savedSelectionRef.current) return;
    const { start, end } = savedSelectionRef.current;
    const maxLen = code.content.length;
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(Math.min(start, maxLen), Math.min(end, maxLen));
      } catch {}
    });
  }, [code.content]);

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

  const [terminalLine, setTerminalLine] = useState<string>('');
  const [terminalInputLines, setTerminalInputLines] = useState<string[]>([]);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState<boolean>(false);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const terminalOutputRef = useRef<HTMLDivElement>(null);

  // Compile & Run Code with optional new terminal input line
  const handleRunWithStdin = async (overrideStdin?: string) => {
    const effectiveStdin = overrideStdin !== undefined ? overrideStdin : stdinText;
    if (code.language === 'html') {
      setShowHtmlPreview(true);
    }

    setIsTerminalCollapsed(false);
    setIsRunning(true);
    try {
      const response = await fetch('/api/code/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.content,
          language: code.language,
          stdin: effectiveStdin,
          roomId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = (await response.json()) as ExecutionResult;
      setExecResult(result);
    } catch {
      try {
        const fallbackResult = await executeClientFallback(
          code.content,
          code.language,
          effectiveStdin
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
      requestAnimationFrame(() => {
        if (terminalOutputRef.current) {
          terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
        }
        terminalInputRef.current?.focus();
      });
    }
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = terminalLine;
    if (trimmed === 'clear' || trimmed === 'cls') {
      setExecResult(null);
      setTerminalInputLines([]);
      setStdinText('');
      setTerminalLine('');
      return;
    }

    const nextLines = trimmed.length > 0 ? [...terminalInputLines, trimmed] : terminalInputLines;
    const nextStdin = nextLines.join('\n');
    setTerminalInputLines(nextLines);
    setStdinText(nextStdin);
    setTerminalLine('');
    handleRunWithStdin(nextStdin);
  };

  // Generate line numbers
  const codeLines = code.content.split('\n');
  const linesCount = codeLines.length;
  const lineNumbers = Array.from({ length: Math.max(linesCount, 1) }, (_, i) => i + 1);
  const remoteCursors = codeCursors.filter((c) => c.userId !== currentUserId);

  return (
    <div
      className={`fixed bg-slate-900 flex flex-col overflow-hidden transition-all duration-200 ${
        isFullscreen
          ? 'inset-0 z-50 w-screen h-screen rounded-none border-0 shadow-none'
          : 'top-16 right-4 bottom-6 w-[680px] max-w-[calc(100vw-32px)] z-30 border border-slate-700/80 rounded-2xl shadow-2xl'
      }`}
    >
      {/* Editor Header */}
      <div className="h-12 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between gap-3 text-xs select-none shrink-0">
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
              · Son yazan: <strong className="text-slate-300">{code.lastUpdatedBy}</strong>
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

          {/* Code editor & console settings */}
          <button
            onClick={() => setShowCodeSettings((v) => !v)}
            className={`p-1.5 rounded-lg transition-colors ${
              showCodeSettings ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={t('code.settings.title')}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              isFullscreen
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Yap'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Küçült</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tam Ekran</span>
              </>
            )}
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

      {showCodeSettings && (
        <div className="absolute right-3 top-14 z-40 w-[340px] max-w-[calc(100%-24px)] max-h-[70%] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl p-4 cb-anim-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-400" />
              {t('code.settings.title')}
            </h3>
            <button onClick={() => setShowCodeSettings(false)} className="p-1 rounded hover:bg-slate-800 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <CodeEditorSettings isDark />
        </div>
      )}

      {/* File tabs: main file + any number of extra files */}
      <div className="bg-slate-950 border-b border-slate-800 px-2 flex items-center gap-1 overflow-x-auto shrink-0 select-none">
        {[{ id: 'main', name: `main.${mainExt}` }, ...extraFiles].map((f) => {
          const isActive = (activeExtra ? activeExtra.id : 'main') === f.id;
          return (
            <div
              key={f.id}
              onClick={() => setActiveFileId(f.id)}
              onDoubleClick={() => f.id !== 'main' && handleRenameFile(f.id)}
              className={`group flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-[11px] font-mono cursor-pointer border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-blue-500 text-slate-100 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
              title={f.id === 'main' ? t('code.files.main') : t('code.files.renameHint')}
            >
              <span>{f.name}</span>
              {f.id !== 'main' && canEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseFile(f.id);
                  }}
                  className="p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                  title={t('common.close')}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        {canEdit && onUpdateCodeFiles && (
          <div className="flex items-center gap-0.5 pl-1 shrink-0">
            <button
              type="button"
              onClick={handleAddEmptyFile}
              disabled={extraFiles.length >= MAX_EXTRA_FILES}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
              title={t('code.files.new')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => fileUploadRef.current?.click()}
              disabled={extraFiles.length >= MAX_EXTRA_FILES}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
              title={t('code.files.upload')}
            >
              <FileUp className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileUploadRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleUploadFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>

      {/* Live Multi-User Collaborator Cursor Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between gap-2 text-[11px] select-none shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-slate-400 font-medium">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Ortak Düzenleme:</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono text-[10px] border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Siz · Satır {localCursor.line}, Sütun {localCursor.column}
          </span>
          {remoteCursors.length > 0 ? (
            remoteCursors.map((rc) => (
              <button
                key={rc.userId}
                type="button"
                onClick={() => {
                  const el = textareaRef.current;
                  if (!el) return;
                  el.focus();
                  const targetPos = Math.min(rc.selectionStart, code.content.length);
                  el.setSelectionRange(targetPos, targetPos);
                }}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold text-white shadow-xs transition-transform hover:scale-105"
                style={{
                  backgroundColor: `${rc.userColor}28`,
                  border: `1px solid ${rc.userColor}`,
                  color: '#f8fafc',
                }}
                title={`${rc.userName} kullanıcısının imlecine git (Satır ${rc.line}, Sütun ${rc.column})`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: rc.userColor }}
                />
                <span>{rc.userName}</span>
                <span className="opacity-80">
                  · Satır {rc.line}:{rc.column}
                </span>
              </button>
            ))
          ) : (
            <span className="text-slate-500 text-[10px]">
              Odadaki diğer kullanıcılar kod yazdığında canlı imleçleri burada görünür
            </span>
          )}
        </div>
      </div>

      {/* Main Split Body: Code Editor + Optional Live HTML Preview */}
      <div className="flex-1 flex overflow-hidden bg-slate-900 relative min-h-[180px]">
        {/* Line Numbers Gutter */}
        <div
          ref={lineGutterRef}
          style={{ fontSize: prefs.editorFontSize }}
          className="w-14 py-3 bg-slate-950/60 text-slate-600 font-mono text-xs select-none text-right pr-3 shrink-0 overflow-hidden border-r border-slate-800/60"
        >
          {lineNumbers.map((num) => {
            const peerOnLine = remoteCursors.find((c) => c.line === num);
            const isLocalLine = localCursor.line === num;
            return (
              <div
                key={num}
                className={`leading-6 relative flex items-center justify-end gap-1 ${
                  isLocalLine ? 'text-slate-200 font-bold' : ''
                }`}
                style={
                  peerOnLine
                    ? {
                        color: peerOnLine.userColor,
                        fontWeight: 700,
                      }
                    : undefined
                }
              >
                {peerOnLine && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: peerOnLine.userColor }}
                    title={`${peerOnLine.userName} (Satır ${num})`}
                  />
                )}
                <span>{num}</span>
              </div>
            );
          })}
        </div>

        {/* Code Text Area + Live Remote Cursors Overlay */}
        <div className="flex-1 relative overflow-hidden flex">
          {/* Remote Active Line Highlights & Cursor Carets Overlay */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden z-10"
            aria-hidden="true"
          >
            {remoteCursors.map((rc) => {
              const lineIdx = Math.max(0, rc.line - 1);
              const colIdx = Math.max(0, rc.column - 1);
              const topPx = 12 + lineIdx * 24 - scrollOffset.top;
              const leftPx = 12 + colIdx * (prefs.editorFontSize * 0.6017) - scrollOffset.left;

              return (
                <React.Fragment key={rc.userId}>
                  {/* Remote User Active Line Highlight */}
                  <div
                    className="absolute left-0 right-0 h-6 transition-all duration-75"
                    style={{
                      top: `${topPx}px`,
                      backgroundColor: `${rc.userColor}18`,
                      borderLeft: `3px solid ${rc.userColor}`,
                    }}
                  />
                  {/* Remote User Blinking Caret & Floating Name Badge */}
                  <div
                    className="absolute transition-all duration-75"
                    style={{
                      top: `${topPx}px`,
                      left: `${Math.max(8, leftPx)}px`,
                    }}
                  >
                    <div
                      className="w-0.5 h-6 animate-pulse shadow-sm"
                      style={{ backgroundColor: rc.userColor }}
                    />
                    <div
                      className="absolute -top-4 left-0 px-1.5 py-0.2 rounded text-[9px] font-bold text-white whitespace-nowrap shadow-md"
                      style={{ backgroundColor: rc.userColor }}
                    >
                      {rc.userName} ({rc.line}:{rc.column})
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <textarea
            ref={textareaRef}
            value={code.content}
            readOnly={!canEdit}
            onKeyDown={handleTextareaKeyDown}
            onKeyUp={(e) => broadcastCurrentSelection(e.currentTarget)}
            onClick={(e) => broadcastCurrentSelection(e.currentTarget)}
            onSelect={(e) => broadcastCurrentSelection(e.currentTarget)}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollOffset({ top: target.scrollTop, left: target.scrollLeft });
              if (lineGutterRef.current) {
                lineGutterRef.current.scrollTop = target.scrollTop;
              }
            }}
            onChange={(e) => {
              const nextVal = e.target.value;
              broadcastCurrentSelection(e.currentTarget, nextVal);
              if (canEdit) onUpdateCode(nextVal, code.language);
            }}
            spellCheck={false}
            wrap="off"
            style={{ fontSize: prefs.editorFontSize }}
            className="flex-1 p-3 bg-transparent text-emerald-400 font-mono text-xs leading-6 outline-none resize-none overflow-auto selection:bg-blue-600/40 select-text relative z-20"
            placeholder="// Bu odaya özel ortak kod alanına kodunuzu yazın ve Derle & Çalıştır (Ctrl+Enter) butonuna tıklayın..."
          />
        </div>

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

      {/* Interactive Terminal & Compiler Console (Always accessible, supports direct stdin typing) */}
      <div
        style={{
          height: isTerminalCollapsed ? 36 : prefs.terminalHeight,
          backgroundColor: prefs.terminalBg,
          fontSize: prefs.terminalFontSize,
        }}
        className="border-t border-slate-800 flex flex-col shrink-0 relative"
      >
        {/* Drag this bar up / down to resize the terminal */}
        <div
          onPointerDown={startTerminalResize}
          onDoubleClick={() => updateCodePrefs({ terminalHeight: 208 })}
          className="absolute -top-1.5 inset-x-0 h-3 cursor-row-resize z-10 flex items-center justify-center group"
          title={t('code.terminal.resize')}
        >
          <span className="w-12 h-1 rounded-full bg-slate-600/70 group-hover:bg-blue-500 transition-colors" />
        </div>
        <div
          onClick={() => terminalInputRef.current?.focus()}
          className="h-9 px-4 flex items-center justify-between text-xs text-slate-400 border-b border-slate-900 select-none shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold" style={{ color: prefs.terminalText }}>
              {t('code.terminal.title')}
            </span>
            {execResult && (
              <>
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
              </>
            )}
            {terminalInputLines.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-mono text-[10px]">
                {terminalInputLines.length} girdi satırı
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExecResult(null);
                setTerminalInputLines([]);
                setStdinText('');
                setTerminalLine('');
              }}
              className="flex items-center gap-1 hover:text-slate-200 text-[11px]"
              title="Terminal Çıktısını ve Girdileri Temizle"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('code.terminal.clear')}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsTerminalCollapsed((v) => !v);
              }}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-semibold"
            >
              {isTerminalCollapsed ? t('code.terminal.open') : t('code.terminal.collapse')}
            </button>
          </div>
        </div>

        {!isTerminalCollapsed && (
          <>
            <div
              ref={terminalOutputRef}
              onClick={() => terminalInputRef.current?.focus()}
              style={{ color: prefs.terminalText }}
              className="flex-1 px-4 py-2.5 font-mono overflow-y-auto space-y-1.5 select-text cursor-text"
            >
              {terminalInputLines.length > 0 && (
                <div className="space-y-0.5 pb-1 border-b border-slate-900">
                  {terminalInputLines.map((ln, idx) => (
                    <div key={idx} style={{ color: prefs.terminalInputText }} className="flex items-center gap-1.5">
                      <span className="text-slate-500 select-none">&gt;</span>
                      <span>{ln}</span>
                    </div>
                  ))}
                </div>
              )}

              {isRunning && (
                <div className="flex items-center gap-2 text-amber-300 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Kod derleniyor ve çalıştırılıyor...</span>
                </div>
              )}

              {execResult ? (
                <>
                  {execResult.stdout && (
                    <pre style={{ color: prefs.terminalText }} className="whitespace-pre-wrap leading-relaxed">
                      {execResult.stdout}
                    </pre>
                  )}
                  {execResult.stderr && (
                    <pre
                      style={{ color: prefs.terminalErrorText }}
                      className="whitespace-pre-wrap bg-black/20 border border-white/10 rounded-lg p-2.5 leading-relaxed"
                    >
                      {execResult.stderr}
                    </pre>
                  )}
                  {!execResult.stdout && !execResult.stderr && (
                    <div className="text-slate-500 italic">
                      Program başarıyla çalıştı (Konsola çıktı üretilmedi).
                    </div>
                  )}
                </>
              ) : (
                !isRunning && (
                  <div className="text-slate-500 text-[11px] leading-relaxed">
                    Doğrudan aşağıdaki terminal satırına program girdisi (<code className="text-slate-300">input()</code>, <code className="text-slate-300">cin</code>, <code className="text-slate-300">Scanner</code>) yazıp <kbd className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">Enter</kbd> tuşuna basarak kodu çalıştırabilirsiniz.
                  </div>
                )
              )}
            </div>

            {/* Direct Interactive Terminal Input Prompt */}
            <form
              onSubmit={handleTerminalSubmit}
              className="h-9 px-3 bg-slate-900/90 border-t border-slate-800/90 flex items-center gap-2 font-mono text-xs shrink-0"
            >
              <span className="text-emerald-400 font-bold select-none">$</span>
              <input
                ref={terminalInputRef}
                type="text"
                value={terminalLine}
                onChange={(e) => setTerminalLine(e.target.value)}
                placeholder="Terminale girdi yazın ve çalıştırmak için Enter'a basın (Temizlemek için: clear)..."
                className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 outline-none select-text"
              />
              <button
                type="submit"
                disabled={isRunning}
                className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-sans font-semibold transition-colors shrink-0"
              >
                Gönder & Çalıştır ↵
              </button>
            </form>
          </>
        )}
      </div>

      {/* Editor Footer & Quick Tools */}
      <div className="h-12 bg-slate-950 border-t border-slate-800 px-4 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          {/* Compile & Run Code */}
          <button
            onClick={() => handleRunWithStdin()}
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

          {/* Multi-Language Templates Dropdown (Click + Seamless Hover Bridge) */}
          {canEdit && (
            <div
              ref={templatesMenuRef}
              className="relative"
              onMouseEnter={() => setShowTemplatesMenu(true)}
              onMouseLeave={() => setShowTemplatesMenu(false)}
            >
              <button
                type="button"
                onClick={() => setShowTemplatesMenu((v) => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${
                  showTemplatesMenu
                    ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Örnek Kodlar</span>
              </button>
              {showTemplatesMenu && (
                <div className="absolute bottom-full pb-2 left-0 z-50">
                  <div className="flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 w-64">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
                      Hazır Kod Şablonları
                    </div>
                    {CODE_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          onUpdateCode(tmpl.code, tmpl.language);
                          if (tmpl.language === 'html') setShowHtmlPreview(true);
                          setShowTemplatesMenu(false);
                        }}
                        className="px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-blue-600/25 hover:text-white rounded-lg transition-colors"
                      >
                        {tmpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

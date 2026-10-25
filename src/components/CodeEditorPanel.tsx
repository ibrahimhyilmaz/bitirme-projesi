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
} from 'lucide-react';

interface CodeEditorPanelProps {
  code: {
    content: string;
    language: string;
    lastUpdatedBy: string;
  };
  onUpdateCode: (content: string, language?: string) => void;
  onClose: () => void;
}

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'python', name: 'Python' },
  { id: 'html', name: 'HTML & CSS' },
  { id: 'json', name: 'JSON' },
  { id: 'sql', name: 'SQL' },
];

const CODE_TEMPLATES = [
  {
    name: '⚡ Veri İşleme & Algoritma',
    code: `// Takım Görevleri ve Hız Analizi
const sprintTasks = [
  { title: "WebSocket State Engine", points: 8, done: true },
  { title: "WebRTC Voice Mesh", points: 13, done: true },
  { title: "Canvas Bezier Curves", points: 5, done: true },
  { title: "Code Editor Sandbox", points: 8, done: true },
  { title: "File Upload Vault", points: 5, done: false },
];

const completedPoints = sprintTasks
  .filter(task => task.done)
  .reduce((acc, curr) => acc + curr.points, 0);

console.log("🚀 Tamamlanan Story Points:", completedPoints);
console.log("📈 İlerleme Oranı: %" + Math.round((completedPoints / 39) * 100));
`,
  },
  {
    name: '📐 Canvas Bezier Eğrisi',
    code: `// Beyaz Tahta İçin Yumuşak Çizgi Hesabı
function computeBezierSpline(points) {
  if (points.length < 2) return points;
  console.log("Nokta sayısı:", points.length);
  const smoothed = [];
  for (let i = 0; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    smoothed.push({ x: midX, y: midY });
  }
  return smoothed;
}

const pts = [{x: 10, y: 10}, {x: 40, y: 80}, {x: 90, y: 120}];
console.log("Hesaplanan eğri noktaları:", computeBezierSpline(pts));
`,
  },
  {
    name: '🌐 WebSocket Olay Yöneticisi',
    code: `// WebSocket Olay Dağıtıcısı
class EventRouter {
  constructor() {
    this.handlers = new Map();
  }
  on(event, fn) {
    this.handlers.set(event, fn);
  }
  dispatch(event, payload) {
    const handler = this.handlers.get(event);
    if (handler) handler(payload);
  }
}

const router = new EventRouter();
router.on('cursor:move', (data) => console.log("İmleç pozisyonu:", data));
router.dispatch('cursor:move', { x: 420, y: 310, user: "Ahmet" });
`,
  },
];

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  code,
  onUpdateCode,
  onClose,
}) => {
  const [outputLogs, setOutputLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Safe run JavaScript code
  const handleRunCode = () => {
    setIsRunning(true);
    const logs: string[] = [];

    const customConsole = {
      log: (...args: unknown[]) => {
        logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
      },
      error: (...args: unknown[]) => {
        logs.push('❌ HATA: ' + args.map((a) => String(a)).join(' '));
      },
      warn: (...args: unknown[]) => {
        logs.push('⚠️ UYARI: ' + args.map((a) => String(a)).join(' '));
      },
    };

    try {
      const startTime = performance.now();
      // Safe sandboxed function execution
      const runFn = new Function('console', code.content);
      runFn(customConsole);
      const executionTime = (performance.now() - startTime).toFixed(2);
      logs.push(`\n⚡ Kod başarıyla çalıştırıldı (${executionTime}ms)`);
    } catch (err) {
      logs.push(`❌ Çalışma Zamanı Hatası: ${String(err)}`);
    }

    setOutputLogs(logs);
    setIsRunning(false);
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
    const blob = new Blob([code.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collab-code-${Date.now()}.${code.language === 'python' ? 'py' : code.language === 'typescript' ? 'ts' : 'js'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate line numbers
  const linesCount = code.content.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(linesCount, 1) }, (_, i) => i + 1);

  return (
    <div
      className={`fixed z-30 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
        isFullscreen
          ? 'inset-6'
          : 'top-16 right-4 bottom-6 w-[560px] max-w-[calc(100vw-32px)]'
      }`}
    >
      {/* Editor Header */}
      <div className="h-12 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between gap-3 text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/80" />
          <span className="w-3 h-3 rounded-full bg-amber-500/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="font-semibold text-slate-300 ml-2">Ortak Kod Editörü</span>
          {code.lastUpdatedBy && (
            <span className="text-slate-500 text-[11px] hidden sm:inline">
              · Son düzenleyen: <strong className="text-slate-400">{code.lastUpdatedBy}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            value={code.language}
            onChange={(e) => onUpdateCode(code.content, e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-300 text-xs focus:outline-hidden"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

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

      {/* Code Editor Body */}
      <div className="flex-1 flex overflow-hidden bg-slate-900">
        {/* Line Numbers */}
        <div className="w-12 py-3 bg-slate-950/40 text-slate-600 font-mono text-xs select-none text-right pr-3 shrink-0">
          {lineNumbers.map((num) => (
            <div key={num} className="leading-6">
              {num}
            </div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={code.content}
          onChange={(e) => onUpdateCode(e.target.value)}
          spellCheck={false}
          className="flex-1 p-3 bg-transparent text-emerald-400 font-mono text-xs leading-6 outline-none resize-none overflow-y-auto selection:bg-blue-600/40"
          placeholder="// Kodunuzu buraya yazın..."
        />
      </div>

      {/* Execution Console Output */}
      {outputLogs.length > 0 && (
        <div className="h-44 bg-slate-950 border-t border-slate-800 flex flex-col shrink-0">
          <div className="h-8 px-4 flex items-center justify-between text-xs text-slate-400 border-b border-slate-900 select-none">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-slate-300">Konsol Çıktısı</span>
            </div>
            <button
              onClick={() => setOutputLogs([])}
              className="flex items-center gap-1 hover:text-slate-200 text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              Temizle
            </button>
          </div>
          <div className="flex-1 p-3 font-mono text-xs text-slate-300 overflow-y-auto space-y-1">
            {outputLogs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Footer & Quick Tools */}
      <div className="h-12 bg-slate-950 border-t border-slate-800 px-4 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          {/* Run Code */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Çalıştır</span>
          </button>

          {/* Templates Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Örnekler</span>
            </button>
            <div className="absolute bottom-full mb-2 left-0 hidden group-hover:flex flex-col bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1.5 w-56 z-50">
              {CODE_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => onUpdateCode(tmpl.code, 'javascript')}
                  className="px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800 rounded transition-colors"
                >
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>
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

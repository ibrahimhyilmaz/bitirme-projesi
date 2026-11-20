/**
 * In-browser Python (Pyodide) running in a Web Worker.
 * - works on static hosting (GitHub Pages) without any server
 * - supports `pip install <package>` through micropip (pure-Python wheels + Pyodide's bundled scientific stack)
 * - a runaway script can be killed by terminating the worker
 */

const PYODIDE_VERSION = '0.26.4';
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PKG_STORAGE_KEY = 'collab_py_pkgs';

const WORKER_SOURCE = `
importScripts('${INDEX_URL}pyodide.js');
let py = null;
let booting = null;
async function boot() {
  py = await loadPyodide({ indexURL: '${INDEX_URL}' });
  await py.loadPackage('micropip');
}
function post(id, data) { self.postMessage(Object.assign({ id: id }, data)); }
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (!booting) booting = boot();
    await booting;
    if (m.op === 'run') {
      let out = '', err = '';
      py.setStdout({ batched: (s) => { out += s + '\\n'; } });
      py.setStderr({ batched: (s) => { err += s + '\\n'; } });
      const lines = String(m.stdin || '').split(/\\r?\\n/);
      let i = 0;
      py.setStdin({ stdin: () => (i < lines.length ? lines[i++] : undefined) });
      let exit = 0;
      try {
        await py.loadPackagesFromImports(m.code);
        await py.runPythonAsync(m.code);
      } catch (ex) {
        exit = 1;
        let t = String((ex && ex.message) || ex);
        const k = t.indexOf('File "<exec>"');
        if (k > 0) t = 'Traceback (most recent call last):\\n  ' + t.slice(k);
        err += t + '\\n';
      }
      post(m.id, { ok: true, stdout: out.replace(/\\n$/, ''), stderr: err.replace(/\\n$/, ''), exit: exit });
    } else if (m.op === 'pip') {
      const micropip = py.pyimport('micropip');
      let log = '', errText = '', exit = 0;
      for (const spec of m.packages) {
        try {
          await micropip.install(spec);
          log += 'Successfully installed ' + spec + '\\n';
        } catch (ex) {
          exit = 1;
          errText += 'ERROR: ' + String((ex && ex.message) || ex).split('\\n').slice(0, 4).join('\\n') + '\\n';
        }
      }
      post(m.id, { ok: true, stdout: log.replace(/\\n$/, ''), stderr: errText.replace(/\\n$/, ''), exit: exit });
    } else if (m.op === 'list') {
      const micropip = py.pyimport('micropip');
      const lst = micropip.list();
      const text = String(lst.toString());
      post(m.id, { ok: true, stdout: text, stderr: '', exit: 0 });
    }
  } catch (ex) {
    post(m.id, { ok: false, error: String((ex && ex.message) || ex) });
  }
};
`;

export interface PyResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: PyResult) => void; reject: (e: Error) => void }>();
let warmedPackages = false;

function ensureWorker(): Worker {
  if (worker) return worker;
  const blob = new Blob([WORKER_SOURCE], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const w = new Worker(url);
  w.onmessage = (e: MessageEvent) => {
    const d = e.data as {
      id: number;
      ok: boolean;
      error?: string;
      stdout?: string;
      stderr?: string;
      exit?: number;
    };
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    if (!d.ok) p.reject(new Error(d.error || 'Pyodide hatası'));
    else p.resolve({ stdout: d.stdout || '', stderr: d.stderr || '', exitCode: d.exit || 0 });
  };
  w.onerror = (ev) => {
    const err = new Error(ev.message || 'Python çalışma ortamı yüklenemedi');
    pending.forEach((p) => p.reject(err));
    pending.clear();
    worker = null;
  };
  worker = w;
  return w;
}

function call(payload: Record<string, unknown>, timeoutMs: number): Promise<PyResult> {
  const w = ensureWorker();
  const id = ++seq;
  return new Promise<PyResult>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      // kill a hung/infinite script; next call boots a fresh interpreter
      w.terminate();
      worker = null;
      warmedPackages = false;
      reject(new Error('Zaman aşımı: program çok uzun sürdü ve durduruldu.'));
    }, timeoutMs);
    pending.set(id, {
      resolve: (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        window.clearTimeout(timer);
        reject(e);
      },
    });
    w.postMessage({ id, ...payload });
  });
}

export function getInstalledPyPackages(): string[] {
  try {
    const raw = localStorage.getItem(PKG_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function rememberPackages(specs: string[]) {
  try {
    const set = new Set(getInstalledPyPackages());
    specs.forEach((s) => set.add(s));
    localStorage.setItem(PKG_STORAGE_KEY, JSON.stringify(Array.from(set).slice(0, 40)));
  } catch {}
}

/** Re-install packages the user added in an earlier session (each page load starts a fresh interpreter) */
async function warmPackages() {
  if (warmedPackages) return;
  warmedPackages = true;
  const pkgs = getInstalledPyPackages();
  if (pkgs.length > 0) {
    try {
      await call({ op: 'pip', packages: pkgs }, 180_000);
    } catch {}
  }
}

export async function runPython(code: string, stdin: string): Promise<PyResult> {
  await warmPackages();
  return call({ op: 'run', code, stdin }, 90_000);
}

const SAFE_SPEC = /^[A-Za-z0-9][A-Za-z0-9._\-]*(\[[A-Za-z0-9,_\-]+\])?((==|>=|<=|~=|!=|>|<)[A-Za-z0-9.*+!_\-]+)?$/;

export interface PipCommand {
  action: 'install' | 'list' | 'uninstall' | 'unknown';
  packages: string[];
  invalid: string[];
}

/** Recognise `pip install x`, `pip3 install x`, `python -m pip install x`, `pip list` ... */
export function parsePipCommand(line: string): PipCommand | null {
  const m = line.trim().match(/^(?:!?\s*)?(?:python3?\s+-m\s+)?pip3?\s+(\S+)\s*(.*)$/i);
  if (!m) return null;
  const sub = m[1].toLowerCase();
  const rest = m[2]
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !/^(-U|--upgrade|-q|--quiet|--user|--no-cache-dir|--disable-pip-version-check)$/i.test(t));
  if (sub === 'list' || sub === 'freeze') return { action: 'list', packages: [], invalid: [] };
  if (sub === 'install') {
    const packages: string[] = [];
    const invalid: string[] = [];
    for (const t of rest) {
      if (SAFE_SPEC.test(t)) packages.push(t);
      else invalid.push(t);
    }
    return { action: 'install', packages: packages.slice(0, 8), invalid };
  }
  if (sub === 'uninstall') return { action: 'uninstall', packages: rest, invalid: [] };
  return { action: 'unknown', packages: [], invalid: [] };
}

export async function runPip(cmd: PipCommand): Promise<PyResult> {
  if (cmd.action === 'list') {
    const r = await call({ op: 'list' }, 120_000);
    return r;
  }
  if (cmd.action === 'install') {
    if (cmd.invalid.length > 0) {
      return {
        stdout: '',
        stderr: `ERROR: Geçersiz paket adı: ${cmd.invalid.join(', ')}`,
        exitCode: 1,
      };
    }
    if (cmd.packages.length === 0) {
      return { stdout: '', stderr: 'ERROR: Kurulacak paket adı yazın. Örn: pip install numpy', exitCode: 1 };
    }
    const r = await call({ op: 'pip', packages: cmd.packages }, 240_000);
    if (r.exitCode === 0) rememberPackages(cmd.packages);
    return r;
  }
  return {
    stdout: '',
    stderr: 'Bu tarayıcı terminalinde yalnızca "pip install <paket>" ve "pip list" desteklenir.',
    exitCode: 1,
  };
}

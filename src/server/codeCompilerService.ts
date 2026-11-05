import { Router } from 'express';
import vm from 'vm';
import { spawn } from 'child_process';
import esbuild from 'esbuild';
import { roomManager } from './roomManager';
import { CompilerExecutionResult } from './types';

const WANDBOX_COMPILERS: Record<string, { compiler: string; label: string }> = {
  python: { compiler: 'cpython-3.12.7', label: 'Python 3.12 (Wandbox)' },
  cpp: { compiler: 'gcc-head', label: 'GCC C++20 (Wandbox)' },
  c: { compiler: 'gcc-head-c', label: 'GCC C17 (Wandbox)' },
  csharp: { compiler: 'mono-6.12.0.199', label: 'Mono C# (Wandbox)' },
  java: { compiler: 'openjdk-jdk-22+36', label: 'OpenJDK 22 (Wandbox)' },
  go: { compiler: 'go-1.23.2', label: 'Go 1.23 (Wandbox)' },
  rust: { compiler: 'rust-1.82.0', label: 'Rust 1.82 (Wandbox)' },
  sql: { compiler: 'sqlite-3.46.1', label: 'SQLite 3.46 (Wandbox)' },
};

function runInNodeVm(
  jsCode: string,
  stdinText: string
): { stdout: string; stderr: string; exitCode: number } {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const stdinLines = stdinText.split(/\r?\n/);
  let stdinIdx = 0;

  const formatVal = (v: unknown): string => {
    if (typeof v === 'string') return v;
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return String(v);
    }
  };

  const sandboxConsole = {
    log: (...args: unknown[]) => stdoutLines.push(args.map(formatVal).join(' ')),
    info: (...args: unknown[]) => stdoutLines.push(args.map(formatVal).join(' ')),
    warn: (...args: unknown[]) => stdoutLines.push('⚠️ ' + args.map(formatVal).join(' ')),
    error: (...args: unknown[]) => stderrLines.push(args.map(formatVal).join(' ')),
    table: (data: unknown) => stdoutLines.push(formatVal(data)),
  };

  const sandbox = {
    console: sandboxConsole,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    Buffer,
    URL,
    URLSearchParams,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    input: () => (stdinIdx < stdinLines.length ? stdinLines[stdinIdx++] : ''),
    prompt: () => (stdinIdx < stdinLines.length ? stdinLines[stdinIdx++] : ''),
    process: {
      env: { NODE_ENV: 'sandbox' },
      version: process.version,
      platform: process.platform,
      argv: ['node', 'script.js'],
      stdout: {
        write: (str: string) => {
          stdoutLines.push(String(str).replace(/\n$/, ''));
        },
      },
      stderr: {
        write: (str: string) => {
          stderrLines.push(String(str).replace(/\n$/, ''));
        },
      },
    },
  };

  try {
    const context = vm.createContext(sandbox);
    const script = new vm.Script(jsCode, { filename: 'collabboard-script.js' });
    const result = script.runInContext(context, { timeout: 4000 });
    if (result !== undefined && stdoutLines.length === 0 && stderrLines.length === 0) {
      stdoutLines.push(formatVal(result));
    }
    return {
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
      exitCode: stderrLines.length > 0 ? 1 : 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    stderrLines.push(message);
    return {
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
      exitCode: 1,
    };
  }
}

function runNativePython(
  code: string,
  stdinText: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-u', '-c', code], {
      timeout: 5000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      if (stdout.length < 64000) stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      if (stderr.length < 64000) stderr += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (codeNum) => {
      resolve({
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: codeNum ?? 0,
      });
    });

    if (stdinText) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();
  });
}

async function runViaWandbox(
  language: string,
  code: string,
  stdinText: string
): Promise<CompilerExecutionResult> {
  const cfg = WANDBOX_COMPILERS[language] || WANDBOX_COMPILERS.python;
  const response = await fetch('https://wandbox.org/api/compile.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compiler: cfg.compiler,
      code,
      stdin: stdinText || '',
      save: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Wandbox compiler HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    status?: string | number;
    program_output?: string;
    program_message?: string;
    program_error?: string;
    compiler_output?: string;
    compiler_error?: string;
    compiler_message?: string;
  };

  const exitCode = Number(data.status ?? 0);
  const compileOutput = (
    data.compiler_error ||
    data.compiler_output ||
    data.compiler_message ||
    ''
  ).trim();
  const stdout = (data.program_output || '').trimEnd();
  const stderr = [compileOutput, (data.program_error || '').trim()].filter(Boolean).join('\n');

  return {
    stdout,
    stderr,
    compileOutput,
    exitCode: isNaN(exitCode) ? 0 : exitCode,
    engine: cfg.label,
  };
}

export const codeCompilerRouter = Router();

codeCompilerRouter.post('/api/code/execute', async (req, res) => {
  const startTime = performance.now();
  const {
    code = '',
    language = 'javascript',
    stdin = '',
    roomId,
    executedBy,
  } = req.body as {
    code?: string;
    language?: string;
    stdin?: string;
    roomId?: string;
    executedBy?: string;
  };

  if (!code || !code.trim()) {
    res.json({
      stdout: '',
      stderr: 'Çalıştırılacak kod boş.',
      exitCode: 1,
      executionTimeMs: 0,
      engine: 'CollabBoard Compiler',
      language,
    });
    return;
  }

  try {
    let result: CompilerExecutionResult;

    if (language === 'javascript') {
      const vmRes = runInNodeVm(code, stdin);
      result = {
        ...vmRes,
        engine: `Node.js ${process.version} VM`,
      };
    } else if (language === 'typescript') {
      try {
        const transformed = await esbuild.transform(code, {
          loader: 'ts',
          target: 'es2022',
          format: 'cjs',
        });
        const vmRes = runInNodeVm(transformed.code, stdin);
        result = {
          ...vmRes,
          compileOutput: transformed.warnings.length
            ? transformed.warnings.map((w) => w.text).join('\n')
            : undefined,
          engine: `esbuild TypeScript + Node.js ${process.version}`,
        };
      } catch (tsErr: unknown) {
        const errMsg = tsErr instanceof Error ? tsErr.message : String(tsErr);
        result = {
          stdout: '',
          stderr: `TypeScript Derleme Hatası:\n${errMsg}`,
          compileOutput: errMsg,
          exitCode: 1,
          engine: 'esbuild TypeScript Compiler',
        };
      }
    } else if (language === 'python') {
      try {
        const pyRes = await runNativePython(code, stdin);
        result = {
          ...pyRes,
          engine: 'Python 3 (Sunucu Native)',
        };
      } catch {
        result = await runViaWandbox('python', code, stdin);
      }
    } else if (language === 'json') {
      try {
        const parsed = JSON.parse(code);
        result = {
          stdout:
            `✅ Geçerli JSON (${Object.keys(parsed).length} anahtar):\n` +
            JSON.stringify(parsed, null, 2),
          stderr: '',
          exitCode: 0,
          engine: 'JSON Doğrulayıcı & Biçimlendirici',
        };
      } catch (jsonErr: unknown) {
        result = {
          stdout: '',
          stderr: `❌ JSON Sözdizimi Hatası: ${
            jsonErr instanceof Error ? jsonErr.message : String(jsonErr)
          }`,
          exitCode: 1,
          engine: 'JSON Doğrulayıcı',
        };
      }
    } else if (language === 'html') {
      result = {
        stdout: '✅ HTML5 & CSS3 belgesi derlendi ve Canlı Önizleme sekmesinde görüntülendi.',
        stderr: '',
        exitCode: 0,
        engine: 'HTML5 Canlı Render Motoru',
      };
    } else {
      result = await runViaWandbox(language, code, stdin);
    }

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    const payload = {
      ...result,
      executionTimeMs,
      language,
      executedBy: executedBy || 'Kullanıcı',
      timestamp: Date.now(),
    };

    if (roomId && roomManager.rooms.has(roomId)) {
      roomManager.broadcastToRoom(roomId, {
        type: 'code-execution-result',
        result: payload,
      });
    }

    res.json(payload);
  } catch (err: unknown) {
    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    res.json({
      stdout: '',
      stderr: `Derleyici Bağlantı Hatası: ${err instanceof Error ? err.message : String(err)}`,
      exitCode: 1,
      executionTimeMs,
      engine: 'CollabBoard Compiler',
      language,
    });
  }
});

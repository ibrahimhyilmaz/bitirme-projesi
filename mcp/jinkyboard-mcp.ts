/**
 * JinkyBoard MCP server (stdio).
 *
 * Lets any MCP client (Claude Desktop, Claude Code, Cursor, ...) draw on a JinkyBoard whiteboard:
 *   list_shapes     - every shape type the board can render
 *   create_diagram  - nodes + links  -> auto-laid-out flow chart / architecture / mind map (no AI call, no tokens)
 *   create_drawing  - shapes on a 100x100 grid -> scaled illustration (no AI call)
 *   ai_generate     - natural-language prompt -> shapes via the configured AI provider (OpenAI, Claude,
 *                     OpenRouter, Groq, DeepSeek, Mistral, Together, Ollama, custom). Falls back to the free,
 *                     key-less engine when no provider is configured.
 *   push_to_room    - send elements into a LIVE room of a running JinkyBoard server (appear instantly)
 *
 * Configuration (environment variables, set in the MCP client config):
 *   COLLAB_SERVER_URL   default http://localhost:3000   (the JinkyBoard server started with `npm run dev`)
 *   AI_PROVIDER         openai | anthropic | openrouter | groq | deepseek | mistral | together | ollama | custom
 *   AI_API_KEY          provider API key
 *   AI_MODEL            optional model override
 *   AI_BASE_URL         optional (custom / ollama)
 *
 * Run:  npx tsx mcp/JinkyBoard-mcp.ts
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import WebSocket from 'ws';
import { ALL_SHAPE_TYPES, type CanvasElement } from '../src/types/index.ts';
import { EXTRA_SHAPES } from '../src/utils/extraShapes.ts';
import { diagramToElements, drawToElements, freeGenerate, type Shape } from '../src/utils/freeAI.ts';
import {
  generateElements,
  isProviderReady,
  type ProviderConfig,
  type ProviderId,
} from '../src/ai/core.ts';

const SERVER_URL = (process.env.COLLAB_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '');

function providerFromEnv(): ProviderConfig | null {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase() as ProviderId;
  if (!provider) return null;
  const cfg: ProviderConfig = {
    provider,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    baseUrl: process.env.AI_BASE_URL,
  };
  return isProviderReady(cfg) ? cfg : null;
}

/** Join a live room as a short-lived bot and drop the elements onto the board */
async function pushToRoom(roomCode: string, elements: CanvasElement[], serverUrl = SERVER_URL): Promise<string> {
  const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
  const botId = `mcp-bot-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise<string>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error(`Sunucudan yanıt alınamadı (${wsUrl}). JinkyBoard sunucusu çalışıyor mu?`));
    }, 10_000);
    ws.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`Sunucuya bağlanılamadı (${wsUrl}): ${e.message}`));
    });
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'join-room',
          roomId: roomCode.toLowerCase(),
          user: { id: botId, name: 'AI Asistanı', color: '#a855f7', avatar: 'AI' },
          ownerKey: botId,
        })
      );
    });
    ws.on('message', (raw) => {
      let msg: { type?: string; message?: string; code?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === 'room-error') {
        clearTimeout(timer);
        ws.close();
        reject(new Error(`${msg.code || 'HATA'}: ${msg.message || 'Odaya girilemedi'}`));
      } else if (msg.type === 'init-room') {
        ws.send(JSON.stringify({ type: 'elements-load-template', elements, _senderId: botId }));
        setTimeout(() => {
          clearTimeout(timer);
          ws.close();
          resolve(`${elements.length} nesne #${roomCode.toUpperCase()} odasına eklendi.`);
        }, 400);
      }
    });
  });
}

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();

const server = new McpServer({ name: 'JinkyBoard', version: '1.0.0' });

const placement = {
  centerX: z.number().optional().describe('Canvas centre X (default 500)'),
  centerY: z.number().optional().describe('Canvas centre Y (default 350)'),
  roomCode: z.string().length(5).optional().describe('If set, the result is pushed into this live room'),
  serverUrl: z.string().url().optional().describe('JinkyBoard server URL (default COLLAB_SERVER_URL)'),
};

async function finish(elements: CanvasElement[], roomCode?: string, serverUrl?: string) {
  let note = '';
  if (roomCode) {
    try {
      note = await pushToRoom(roomCode, elements, serverUrl);
    } catch (e) {
      note = `Odaya gönderilemedi: ${(e as Error).message}`;
    }
  }
  return {
    content: [
      { type: 'text' as const, text: `${elements.length} nesne üretildi. ${note}`.trim() },
      { type: 'text' as const, text: JSON.stringify(elements) },
    ],
  };
}

server.registerTool(
  'list_shapes',
  {
    title: 'Şekil listesi',
    description: 'Lists every shape type the whiteboard can render, including the extra SVG-path shapes.',
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          builtIn: ALL_SHAPE_TYPES.filter((t) => !(t in EXTRA_SHAPES)),
          extra: Object.entries(EXTRA_SHAPES).map(([id, d]) => ({ id, label: d.label, group: d.group })),
          others: ['line', 'arrow', 'double-arrow', 'curved-arrow', 'text', 'sticky', 'polygon (points[])'],
        }),
      },
    ],
  })
);

server.registerTool(
  'create_diagram',
  {
    title: 'Diyagram oluştur',
    description:
      'Create a flow chart / architecture / mind-map from nodes and links. Layout is computed locally (no AI call). shape: box, round, diamond, db, cloud, hex, para.',
    inputSchema: {
      nodes: z.array(z.object({ id: z.string(), label: z.string(), shape: z.string().optional() })).min(1).max(30),
      edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })).max(60),
      ...placement,
    },
  },
  async ({ nodes, edges, centerX, centerY, roomCode, serverUrl }) => {
    const els = diagramToElements(
      nodes.map((n) => ({ id: n.id, label: n.label, shape: (n.shape || 'round').toLowerCase() })),
      edges,
      centerX ?? 500,
      centerY ?? 350,
      'AI Asistanı'
    );
    return finish(els, roomCode, serverUrl);
  }
);

server.registerTool(
  'create_drawing',
  {
    title: 'Çizim oluştur',
    description:
      'Create an illustration from shapes placed on a 100x100 grid (y grows downward). kind: rect, round, circle, tri, diamond, star, hex, heart, cloud, trap, cyl, line (w,h = delta), text (label). Background first, details last.',
    inputSchema: {
      shapes: z
        .array(
          z.object({
            kind: z.string(),
            x: z.number(),
            y: z.number(),
            w: z.number(),
            h: z.number(),
            color: colorSchema,
            label: z.string().optional(),
          })
        )
        .min(1)
        .max(80),
      ...placement,
    },
  },
  async ({ shapes, centerX, centerY, roomCode, serverUrl }) => {
    const list: Shape[] = shapes.map((s) => ({ ...s, kind: s.kind.toLowerCase(), color: s.color || '#3b82f6' }));
    return finish(drawToElements(list, centerX ?? 500, centerY ?? 350, 'AI Asistanı'), roomCode, serverUrl);
  }
);

server.registerTool(
  'ai_generate',
  {
    title: 'Yapay zeka ile çiz',
    description:
      'Describe what to draw in plain language. Uses the AI provider configured through AI_PROVIDER / AI_API_KEY (OpenAI, Claude, OpenRouter, Groq, DeepSeek, Mistral, Together, Ollama, custom); falls back to the free key-less engine.',
    inputSchema: {
      prompt: z.string().min(2).max(600),
      kind: z.enum(['diagram', 'drawing']).optional(),
      detail: z.enum(['quick', 'standard', 'detailed', 'masterpiece']).optional(),
      ...placement,
    },
  },
  async ({ prompt, kind, detail, centerX, centerY, roomCode, serverUrl }) => {
    const cx = centerX ?? 500;
    const cy = centerY ?? 350;
    const cfg = providerFromEnv();
    try {
      const els = cfg
        ? await generateElements(cfg, { prompt, centerX: cx, centerY: cy, author: 'AI Asistanı', kind, detail })
        : (await freeGenerate({ prompt, centerX: cx, centerY: cy, author: 'AI Asistanı' })).elements;
      return finish(els, roomCode, serverUrl);
    } catch (e) {
      return { isError: true, content: [{ type: 'text' as const, text: `Çizim üretilemedi: ${(e as Error).message}` }] };
    }
  }
);

server.registerTool(
  'push_to_room',
  {
    title: 'Odaya gönder',
    description: 'Send previously generated elements (JSON array) into a live JinkyBoard room.',
    inputSchema: {
      roomCode: z.string().length(5),
      elements: z.array(z.record(z.string(), z.unknown())).min(1).max(300),
      serverUrl: z.string().url().optional(),
    },
  },
  async ({ roomCode, elements, serverUrl }) => {
    try {
      const msg = await pushToRoom(roomCode, elements as unknown as CanvasElement[], serverUrl);
      return { content: [{ type: 'text' as const, text: msg }] };
    } catch (e) {
      return { isError: true, content: [{ type: 'text' as const, text: (e as Error).message }] };
    }
  }
);

await server.connect(new StdioServerTransport());

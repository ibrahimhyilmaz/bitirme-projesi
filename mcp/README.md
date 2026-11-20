# CollabBoard MCP sunucusu

Claude Desktop, Claude Code, Cursor gibi herhangi bir MCP istemcisinin CollabBoard tahtasına şekil, diyagram ve çizim eklemesini sağlar.

## Araçlar

| Araç | Ne yapar | Yapay zeka çağrısı |
| --- | --- | --- |
| `list_shapes` | Çizilebilen tüm şekil türlerini listeler | yok |
| `create_diagram` | Düğüm + bağlantı listesinden akış şeması / mimari / zihin haritası üretir, yerleşimi yerelde hesaplar | yok (0 token) |
| `create_drawing` | 100x100 ızgarada şekil listesinden çizim üretir | yok (0 token) |
| `ai_generate` | Düz metin isteğinden çizim üretir (sağlayıcı: OpenAI, Claude, OpenRouter, Groq, DeepSeek, Mistral, Together, Ollama, özel). Sağlayıcı yoksa ücretsiz anahtarsız motoru kullanır | var |
| `push_to_room` | Üretilmiş nesneleri çalışan bir odaya canlı olarak gönderir | yok |

`create_*` ve `ai_generate` araçları `roomCode` (5 haneli oda kodu) verilirse sonucu doğrudan o odaya gönderir; nesneler odadakilerde anında görünür.

## Çalıştırma

```powershell
npm run dev      # CollabBoard sunucusu (http://localhost:3000)
npm run mcp      # MCP sunucusu (stdio)
```

## Claude Desktop yapılandırması

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "collabboard": {
      "command": "npx",
      "args": ["tsx", "D:/SoftwareTechs/bitirme-projesi/bitirme-projesi/mcp/collabboard-mcp.ts"],
      "env": {
        "COLLAB_SERVER_URL": "http://localhost:3000",
        "AI_PROVIDER": "openrouter",
        "AI_API_KEY": "sk-or-...",
        "AI_MODEL": "openai/gpt-4o-mini"
      }
    }
  }
}
```

Claude Code için: `claude mcp add collabboard -- npx tsx mcp/collabboard-mcp.ts`

## Ortam değişkenleri

- `COLLAB_SERVER_URL` — çalışan CollabBoard sunucusu (varsayılan `http://localhost:3000`)
- `AI_PROVIDER` — `openai`, `anthropic`, `openrouter`, `groq`, `deepseek`, `mistral`, `together`, `ollama`, `custom`
- `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` — sağlayıcı anahtarı, model, (özel/yerel için) adres

## Not

Odaya gönderme, WebSocket sunucusuna ihtiyaç duyar. GitHub Pages gibi sunucusuz (MQTT) kurulumda `push_to_room` çalışmaz; araçlar yine nesne JSON'unu döndürür.

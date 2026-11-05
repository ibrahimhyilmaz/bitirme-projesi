import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { CanvasElement } from './types';
import { buildFallbackSvg } from './aiSvgTemplates';
import { buildFallbackCanvasElements } from './aiVectorPresets';

export const aiRouter = Router();

aiRouter.post('/api/ai/generate-canvas', async (req, res) => {
  const {
    prompt,
    centerX = 500,
    centerY = 350,
    author = 'AI Asistanı',
    thinkingLevel = 'standard',
    targetDuration = 20,
  } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Lütfen oluşturulacak şekil veya diyagram için bir açıklama girin.' });
    return;
  }

  const trimmedPrompt = prompt.trim();
  const isDiagram =
    /şema|diyagram|akış|flowchart|mimari|architecture|erd|uml|süreç|process|roadmap|tablo|graph/i.test(
      trimmedPrompt
    );

  const durationSec = Number(targetDuration) || 20;
  const timeoutMs =
    thinkingLevel === 'masterpiece' || durationSec >= 55
      ? 75000
      : thinkingLevel === 'detailed' || durationSec >= 30
      ? 48000
      : thinkingLevel === 'quick' || durationSec <= 15
      ? 22000
      : 32000;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallbackElements = buildFallbackCanvasElements(
      trimmedPrompt,
      centerX,
      centerY,
      author,
      thinkingLevel
    );
    res.json({ elements: fallbackElements, source: 'fallback' });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let depthInstruction = '';
    let targetPieceCount = '10 ila 18';

    if (thinkingLevel === 'masterpiece' || durationSec >= 55) {
      targetPieceCount = '35 ila 55';
      depthInstruction = `
ZAMAN VE DERİN DÜŞÜNME SEVİYESİ: EN ÜST SEVİYE BAŞYAPIT & DERİN DÜŞÜNME (1 DAKİKA / 60 SANİYE).
- 35 ila 55 adet incelikli, birbiriyle uyumlu geometrik parça üret.
- Nesnenin 3B hacmini hissettiren çoklu katmanlar, zemin temas gölgesi, ışık parlamaları ve zengin detaylar ekle.`;
    } else if (thinkingLevel === 'detailed' || durationSec >= 30) {
      targetPieceCount = '20 ila 32';
      depthInstruction = `
ZAMAN VE DERİN DÜŞÜNME SEVİYESİ: AYRINTILI & ZENGİN (35 SANİYE).
- 20 ila 32 adet özenle konumlandırılmış geometrik parça üret.`;
    } else if (thinkingLevel === 'quick' || durationSec <= 15) {
      targetPieceCount = '5 ila 8';
      depthInstruction = `
ZAMAN VE DERİN DÜŞÜNME SEVİYESİ: HIZLI & TASLAK (10 SANİYE).
- Yalnızca 5 ila 8 adet temel geometrik parça ile nesneyi en yalın, hızlı ve net minimalist taslak haliyle çiz.`;
    } else {
      targetPieceCount = '10 ila 18';
      depthInstruction = `
ZAMAN VE DERİN DÜŞÜNME SEVİYESİ: STANDART DENGELİ (20 SANİYE).
- 10 ila 18 adet geometrik parça kullan. Dengeli, orantılı ve net olsun.`;
    }

    const systemInstruction = isDiagram
      ? `Sen profesyonel bir beyaz tahta (whiteboard) diyagram ve şema mimarısın.
Kullanıcının isteğini doğrudan tuvalde düzenlenebilir akış şeması öğeleri (rounded-rect, diamond, sticky, arrow, text) olarak tasarla.
Merkez koordinatı: (centerX = ${Math.round(centerX)}, centerY = ${Math.round(centerY)}).`
      : `Sen profesyonel bir beyaz tahta (whiteboard) illüstratör ve vektör grafik motorusun.
Kullanıcının istediği "${trimmedPrompt}" nesnesini, doğrudan tuval (canvas) üzerinde çizilecek vektörel geometrik parçalar dizisi olarak üretirsin.
Merkez koordinatı: (centerX = ${Math.round(centerX)}, centerY = ${Math.round(centerY)}).
${depthInstruction}
KURALLAR:
1. ETİKET / BAŞLIK / YAZI KESİNLİKLE YASAKTIR.
2. ÇERÇEVE / KART KUTUSU YASAKTIR.
3. type: circle, rounded-rect, rectangle, triangle, diamond, star, arrow, line. fillColor opak ve canlı olmalıdır.`;

    const schemaConfig = {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: 'Oluşturulan çizim veya nesnenin kısa Türkçe açıklaması',
          },
          elements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
                color: { type: Type.STRING },
                fillColor: { type: Type.STRING },
                strokeWidth: { type: Type.NUMBER },
                rotation: { type: Type.NUMBER },
              },
              required: ['type', 'x', 'y', 'width', 'height', 'color', 'fillColor'],
            },
          },
        },
        required: ['elements'],
      },
    };

    const promptText = isDiagram
      ? `Kullanıcı Şema İsteği: "${trimmedPrompt}". Düşünme Seviyesi: ${thinkingLevel}.`
      : `Kullanıcı Çizim İsteği: "${trimmedPrompt}". Düşünme Seviyesi: ${thinkingLevel} (~${durationSec} saniye). Hedef: ${targetPieceCount} parça.`;

    const modelsToTry = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
    let responseText = '';
    const loopStartTime = Date.now();

    for (const modelName of modelsToTry) {
      const elapsed = Date.now() - loopStartTime;
      const remainingMs = timeoutMs - elapsed;
      if (remainingMs < 5000) break;
      const attemptTimeoutMs = Math.min(remainingMs, timeoutMs);

      try {
        let timer: NodeJS.Timeout | null = null;
        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: schemaConfig,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Timeout on ${modelName}`)), attemptTimeoutMs);
        });

        const resObj = await Promise.race([generatePromise, timeoutPromise]);
        if (timer) clearTimeout(timer);
        if (resObj && resObj.text) {
          responseText = resObj.text;
          break;
        }
      } catch {
        // Fallback to next model or procedural preset
      }
    }

    if (!responseText) {
      const fallback = buildFallbackCanvasElements(
        trimmedPrompt,
        centerX,
        centerY,
        author,
        thinkingLevel
      );
      res.json({ elements: fallback, summary: `${trimmedPrompt} tuvale çizildi.` });
      return;
    }

    const parsed = JSON.parse(responseText);
    const rawElements = Array.isArray(parsed.elements) ? parsed.elements : [];

    const allowedTypes = new Set([
      'rectangle',
      'rounded-rect',
      'circle',
      'diamond',
      'triangle',
      'star',
      'arrow',
      'line',
      'sticky',
      'text',
    ]);

    const now = Date.now();
    let sanitized: CanvasElement[] = rawElements
      .filter(
        (el: Record<string, unknown>) =>
          el && typeof el.type === 'string' && allowedTypes.has(el.type)
      )
      .map((el: Record<string, unknown>, idx: number) => {
        const stroke = typeof el.color === 'string' && el.color ? el.color : '#0f172a';
        let fill = typeof el.fillColor === 'string' && el.fillColor ? el.fillColor.trim() : '';

        if (!fill || fill === 'transparent') {
          if (
            el.type === 'circle' ||
            el.type === 'rectangle' ||
            el.type === 'rounded-rect' ||
            el.type === 'triangle' ||
            el.type === 'diamond' ||
            el.type === 'star'
          ) {
            fill = stroke !== '#0f172a' ? stroke : '#3b82f6';
          } else {
            fill = 'transparent';
          }
        }

        return {
          id: `ai-${now}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          type: el.type as CanvasElement['type'],
          x: Number(el.x) || centerX,
          y: Number(el.y) || centerY,
          width:
            el.width !== undefined && Number(el.width) > 0
              ? Number(el.width)
              : el.type === 'sticky'
              ? 180
              : 80,
          height:
            el.height !== undefined && Number(el.height) > 0
              ? Number(el.height)
              : el.type === 'sticky'
              ? 150
              : 80,
          color: stroke,
          fillColor: fill,
          strokeWidth: Number(el.strokeWidth) || 2.5,
          strokeStyle: 'solid',
          opacity: 1,
          text: typeof el.text === 'string' ? el.text : undefined,
          fontSize: 16,
          rotation: Number(el.rotation) || 0,
          flipX: false,
          flipY: false,
          createdBy: author,
          updatedAt: now,
        };
      });

    if (!isDiagram) {
      sanitized = sanitized.filter((el) => el.type !== 'text');
    }

    if (sanitized.length === 0) {
      const fallback = buildFallbackCanvasElements(
        trimmedPrompt,
        centerX,
        centerY,
        author,
        thinkingLevel
      );
      res.json({ elements: fallback, summary: `${trimmedPrompt} tuvale çizildi.` });
      return;
    }

    res.json({
      elements: sanitized,
      summary: parsed.summary || `${sanitized.length} parça tahtaya çizildi.`,
    });
  } catch {
    if (res.headersSent) return;
    const fallback = buildFallbackCanvasElements(
      trimmedPrompt,
      centerX,
      centerY,
      author,
      thinkingLevel
    );
    res.json({
      elements: fallback,
      summary: `${trimmedPrompt} tuvale çizildi.`,
    });
  }
});

aiRouter.post('/api/ai/generate-image', async (req, res) => {
  const {
    prompt,
    centerX = 500,
    centerY = 350,
    author = 'AI Görsel',
    thinkingLevel = 'standard',
    targetDuration = 20,
  } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Lütfen oluşturulacak görsel için bir açıklama girin.' });
    return;
  }

  const trimmedPrompt = prompt.trim();
  const width = 300;
  const height = 300;
  const now = Date.now();
  const elementId = `ai-img-${now}-${Math.random().toString(36).substring(2, 6)}`;

  const durationSec = Number(targetDuration) || 20;
  const timeoutMs =
    thinkingLevel === 'masterpiece' || durationSec >= 55
      ? 75000
      : thinkingLevel === 'detailed' || durationSec >= 30
      ? 48000
      : thinkingLevel === 'quick' || durationSec <= 15
      ? 22000
      : 32000;

  const createResult = (svgCode: string, summary: string) => ({
    element: {
      id: elementId,
      type: 'image' as const,
      x: Math.round(centerX - width / 2),
      y: Math.round(centerY - height / 2),
      width,
      height,
      strokeWidth: 0,
      color: 'transparent',
      fillColor: 'transparent',
      imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svgCode)}`,
      rotation: 0,
      flipX: false,
      flipY: false,
      createdBy: author,
      updatedAt: now,
    },
    summary,
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallbackSvg = buildFallbackSvg(trimmedPrompt, thinkingLevel);
    res.json(createResult(fallbackSvg, `${trimmedPrompt} görseli tahtaya eklendi.`));
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const modelsToTry = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
    let rawSvg = '';
    const loopStartTime = Date.now();

    for (const modelName of modelsToTry) {
      const elapsed = Date.now() - loopStartTime;
      const remainingMs = timeoutMs - elapsed;
      if (remainingMs < 5000) break;
      const attemptTimeoutMs = Math.min(remainingMs, timeoutMs);

      try {
        let timer: NodeJS.Timeout | null = null;
        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents: `Sen yetenekli bir SVG illüstratörüsün. Kullanıcının istediği "${trimmedPrompt}" nesnesi için modern, temiz, zengin renkli ve gölgeli bir vektörel SVG çizimi oluştur. Arka plan şeffaf olsun, yazı veya dış çerçeve ekleme. Sadece <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">...</svg> döndür.`,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Timeout on ${modelName}`)), attemptTimeoutMs);
        });

        const resObj = await Promise.race([generatePromise, timeoutPromise]);
        if (timer) clearTimeout(timer);
        if (resObj && resObj.text) {
          rawSvg = (resObj.text || '').trim();
          if (rawSvg.includes('<svg') && rawSvg.includes('</svg>')) {
            break;
          }
        }
      } catch {
        // Continue to fallback
      }
    }

    rawSvg = rawSvg.replace(/^```(xml|svg)?/i, '').replace(/```$/i, '').trim();

    if (rawSvg.includes('<svg') && rawSvg.includes('</svg>')) {
      const startIdx = rawSvg.indexOf('<svg');
      const endIdx = rawSvg.lastIndexOf('</svg>') + 6;
      let cleanSvg = rawSvg.slice(startIdx, endIdx);
      cleanSvg = cleanSvg.replace(/<text[\s\S]*?<\/text>/gi, '');
      res.json(createResult(cleanSvg, `${trimmedPrompt} görseli tahtaya eklendi.`));
      return;
    }

    const fallbackSvg = buildFallbackSvg(trimmedPrompt, thinkingLevel);
    res.json(createResult(fallbackSvg, `${trimmedPrompt} görseli tahtaya eklendi.`));
  } catch {
    if (res.headersSent) return;
    const fallbackSvg = buildFallbackSvg(trimmedPrompt, thinkingLevel);
    res.json(createResult(fallbackSvg, `${trimmedPrompt} görseli tahtaya eklendi.`));
  }
});

export type BadgeId =
  | 'master_sketcher'
  | 'code_architect'
  | 'team_voice'
  | 'versatile_creator'
  | 'room_host'
  | 'studio_marathon';

/** 0 = Locked, 1 = Bronze, 2 = Silver, 3 = Gold, 4 = Diamond */
export type BadgeTier = 0 | 1 | 2 | 3 | 4;
export type UnlockedBadgeTier = 1 | 2 | 3 | 4;

export interface BadgeTierMeta {
  tier: BadgeTier;
  name: string;
  shortCode: string;
  gradFrom: string;
  gradMid: string;
  gradTo: string;
  ringColor: string;
  barColor: string;
  badgeTextClass: string;
  pillClass: string;
  cardBorderClass: string;
}

export const BADGE_TIER_META: Record<BadgeTier, BadgeTierMeta> = {
  0: {
    tier: 0,
    name: 'Kilitli',
    shortCode: '—',
    gradFrom: '#475569',
    gradMid: '#3f4c5f',
    gradTo: '#334155',
    ringColor: '#64748b',
    barColor: '#64748b',
    badgeTextClass: 'text-slate-500 dark:text-slate-400',
    pillClass:
      'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    cardBorderClass: 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/35',
  },
  1: {
    tier: 1,
    name: 'Bronz',
    shortCode: 'B',
    gradFrom: '#9a3412',
    gradMid: '#c2692c',
    gradTo: '#e59a54',
    ringColor: '#f59e0b',
    barColor: '#c2692c',
    badgeTextClass: 'text-amber-700 dark:text-amber-400',
    pillClass:
      'bg-amber-100/80 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/70',
    cardBorderClass: 'border-amber-200/90 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/15',
  },
  2: {
    tier: 2,
    name: 'Gümüş',
    shortCode: 'G',
    gradFrom: '#475569',
    gradMid: '#94a3b8',
    gradTo: '#e2e8f0',
    ringColor: '#cbd5e1',
    barColor: '#64748b',
    badgeTextClass: 'text-slate-700 dark:text-slate-200',
    pillClass:
      'bg-slate-200/80 dark:bg-slate-700/70 text-slate-700 dark:text-slate-100 border-slate-300 dark:border-slate-500',
    cardBorderClass: 'border-slate-300 dark:border-slate-600/80 bg-slate-100/60 dark:bg-slate-800/50',
  },
  3: {
    tier: 3,
    name: 'Altın',
    shortCode: 'A',
    gradFrom: '#b45309',
    gradMid: '#eab308',
    gradTo: '#fef08a',
    ringColor: '#facc15',
    barColor: '#eab308',
    badgeTextClass: 'text-yellow-700 dark:text-yellow-300',
    pillClass:
      'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/80',
    cardBorderClass: 'border-yellow-300/90 dark:border-yellow-700/70 bg-yellow-50/50 dark:bg-yellow-950/15',
  },
  4: {
    tier: 4,
    name: 'Elmas',
    shortCode: 'E',
    gradFrom: '#0284c7',
    gradMid: '#38bdf8',
    gradTo: '#818cf8',
    ringColor: '#67e8f9',
    barColor: '#06b6d4',
    badgeTextClass: 'text-cyan-700 dark:text-cyan-300',
    pillClass:
      'bg-cyan-100/80 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700/80',
    cardBorderClass: 'border-cyan-300/90 dark:border-cyan-700/70 bg-cyan-50/45 dark:bg-cyan-950/20',
  },
};

export interface AccountStats {
  drawCount: number;
  codeEditCount: number;
  voiceCollabs: number;
  roomsCreated: number;
  pdfOrAiCount: number;
  activeMinutes: number;
  acceptedInvites: number;
}

export const EMPTY_ACCOUNT_STATS: AccountStats = {
  drawCount: 0,
  codeEditCount: 0,
  voiceCollabs: 0,
  roomsCreated: 0,
  pdfOrAiCount: 0,
  activeMinutes: 0,
  acceptedInvites: 0,
};

export interface BadgeProgressSnapshot {
  tier: BadgeTier;
  nextTier: UnlockedBadgeTier | null;
  current: number;
  target: number;
  percent: number;
  label: string;
  isMaxTier: boolean;
}

export interface BadgeDefinition {
  id: BadgeId;
  title: string;
  subtitle: string;
  description: string;
  accentFrom: string;
  accentTo: string;
  ringColor: string;
  /** Cumulative targets for [Bronze, Silver, Gold, Diamond] */
  tiers: readonly [number, number, number, number];
  getMetricValue: (stats: AccountStats) => number;
  formatValue: (value: number) => string;
  formatTarget: (target: number) => string;
  getProgress: (stats: AccountStats, storedTier?: BadgeTier) => BadgeProgressSnapshot;
  isUnlocked: (stats: AccountStats) => boolean;
}

function formatNumber(n: number): string {
  return n.toLocaleString('tr-TR');
}

function formatDurationMinutes(mins: number): string {
  if (mins >= 60 && mins % 60 === 0) {
    return `${formatNumber(mins / 60)} sa`;
  }
  if (mins >= 120) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${formatNumber(h)} sa ${m} dk` : `${formatNumber(h)} sa`;
  }
  return `${formatNumber(mins)} dk`;
}

export function computeTierFromValue(
  tiers: readonly [number, number, number, number],
  value: number
): BadgeTier {
  if (value >= tiers[3]) return 4;
  if (value >= tiers[2]) return 3;
  if (value >= tiers[1]) return 2;
  if (value >= tiers[0]) return 1;
  return 0;
}

function buildCumulativeProgress(
  tiers: readonly [number, number, number, number],
  rawValue: number,
  formatVal: (v: number) => string,
  formatTarget: (t: number) => string,
  storedTier: BadgeTier = 0
): BadgeProgressSnapshot {
  const computedTier = computeTierFromValue(tiers, rawValue);
  const tier = (computedTier > storedTier ? computedTier : storedTier) as BadgeTier;

  if (tier >= 4) {
    return {
      tier: 4,
      nextTier: null,
      current: Math.max(rawValue, tiers[3]),
      target: tiers[3],
      percent: 100,
      label: `${formatVal(Math.max(rawValue, tiers[3]))} · Maksimum`,
      isMaxTier: true,
    };
  }

  const tierIdx = tier as 0 | 1 | 2 | 3;
  const nextTier = (tierIdx + 1) as UnlockedBadgeTier;
  const target: number = tiers[tierIdx];
  const current = Math.min(target, Math.max(0, rawValue));
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return {
    tier,
    nextTier,
    current,
    target,
    percent,
    label: `${formatVal(current)} / ${formatTarget(target)}`,
    isMaxTier: false,
  };
}

export const BADGE_DEFINITIONS: ReadonlyArray<BadgeDefinition> = [
  {
    id: 'master_sketcher',
    title: 'Usta Çizer',
    subtitle: 'Üretim Eşiği',
    description: 'Tahtada çizim, şekil veya not oluşturarak kademeleri yükseltin (25 · 200 · 1.000 · 10.000).',
    accentFrom: '#2563eb',
    accentTo: '#38bdf8',
    ringColor: '#60a5fa',
    tiers: [25, 200, 1000, 10000],
    getMetricValue: (s) => s.drawCount,
    formatValue: (v) => formatNumber(v),
    formatTarget: (t) => `${formatNumber(t)} çizim`,
    getProgress: (s, storedTier = 0) =>
      buildCumulativeProgress(
        [25, 200, 1000, 10000],
        s.drawCount,
        (v) => formatNumber(v),
        (t) => `${formatNumber(t)} çizim`,
        storedTier
      ),
    isUnlocked: (s) => s.drawCount >= 25,
  },
  {
    id: 'code_architect',
    title: 'Kod Mimarı',
    subtitle: 'Yazılım & Senkron',
    description: 'Ortak kod editöründe anlamlı kod düzenlemeleri yaparak kademeleri açın (10 · 100 · 500 · 5.000).',
    accentFrom: '#059669',
    accentTo: '#34d399',
    ringColor: '#34d399',
    tiers: [10, 100, 500, 5000],
    getMetricValue: (s) => s.codeEditCount,
    formatValue: (v) => formatNumber(v),
    formatTarget: (t) => `${formatNumber(t)} kod katkısı`,
    getProgress: (s, storedTier = 0) =>
      buildCumulativeProgress(
        [10, 100, 500, 5000],
        s.codeEditCount,
        (v) => formatNumber(v),
        (t) => `${formatNumber(t)} kod katkısı`,
        storedTier
      ),
    isUnlocked: (s) => s.codeEditCount >= 10,
  },
  {
    id: 'team_voice',
    title: 'Takım Sesi',
    subtitle: 'Sesli İşbirliği',
    description: 'Başka katılımcıların bulunduğu odalarda sesli kanala katılarak yükselir (1 · 10 · 50 · 250).',
    accentFrom: '#7c3aed',
    accentTo: '#c084fc',
    ringColor: '#a78bfa',
    tiers: [1, 10, 50, 250],
    getMetricValue: (s) => s.voiceCollabs,
    formatValue: (v) => formatNumber(v),
    formatTarget: (t) => `${formatNumber(t)} sesli oturum`,
    getProgress: (s, storedTier = 0) =>
      buildCumulativeProgress(
        [1, 10, 50, 250],
        s.voiceCollabs,
        (v) => formatNumber(v),
        (t) => `${formatNumber(t)} sesli oturum`,
        storedTier
      ),
    isUnlocked: (s) => s.voiceCollabs >= 1,
  },
  {
    id: 'versatile_creator',
    title: 'Çok Yönlü Üretici',
    subtitle: 'Tam Stüdyo',
    description:
      'Çizim, kod ve PDF/Şablon/AI alanlarının üçünde birden hedefe ulaşarak yükselir (1 · 10 · 50 · 250).',
    accentFrom: '#d97706',
    accentTo: '#fbbf24',
    ringColor: '#fbbf24',
    tiers: [1, 10, 50, 250],
    getMetricValue: (s) => Math.min(s.drawCount, s.codeEditCount, s.pdfOrAiCount),
    formatValue: (v) => formatNumber(v),
    formatTarget: (t) => `her araçta ${formatNumber(t)}`,
    getProgress: (s, storedTier = 0) => {
      const minPillar = Math.min(s.drawCount, s.codeEditCount, s.pdfOrAiCount);
      const base = buildCumulativeProgress(
        [1, 10, 50, 250],
        minPillar,
        (v) => formatNumber(v),
        (t) => `her araçta ${formatNumber(t)}`,
        storedTier
      );
      if (base.tier === 0) {
        const readyPillars =
          (s.drawCount >= 1 ? 1 : 0) +
          (s.codeEditCount >= 1 ? 1 : 0) +
          (s.pdfOrAiCount >= 1 ? 1 : 0);
        return {
          ...base,
          current: readyPillars,
          target: 3,
          percent: Math.round((readyPillars / 3) * 100),
          label: `${readyPillars} / 3 araç alanı`,
        };
      }
      return base;
    },
    isUnlocked: (s) => s.drawCount >= 1 && s.codeEditCount >= 1 && s.pdfOrAiCount >= 1,
  },
  {
    id: 'room_host',
    title: 'Oda Kurucusu',
    subtitle: 'Topluluk & Davet',
    description: 'Çalışma odaları oluşturarak veya arkadaş davetlerini kabul ederek yükselir (3 · 15 · 50 · 200).',
    accentFrom: '#e11d48',
    accentTo: '#fb7185',
    ringColor: '#fb7185',
    tiers: [3, 15, 50, 200],
    getMetricValue: (s) => s.roomsCreated + s.acceptedInvites,
    formatValue: (v) => formatNumber(v),
    formatTarget: (t) => `${formatNumber(t)} oda & davet`,
    getProgress: (s, storedTier = 0) =>
      buildCumulativeProgress(
        [3, 15, 50, 200],
        s.roomsCreated + s.acceptedInvites,
        (v) => formatNumber(v),
        (t) => `${formatNumber(t)} oda & davet`,
        storedTier
      ),
    isUnlocked: (s) => s.roomsCreated + s.acceptedInvites >= 3,
  },
  {
    id: 'studio_marathon',
    title: 'Stüdyo Maratonu',
    subtitle: 'Odaklanma Süresi',
    description: 'Çalışma odalarında aktif zaman geçirerek kademeleri açın (15 dk · 2 sa · 15 sa · 100 sa).',
    accentFrom: '#0891b2',
    accentTo: '#22d3ee',
    ringColor: '#38bdf8',
    tiers: [15, 120, 900, 6000],
    getMetricValue: (s) => s.activeMinutes,
    formatValue: formatDurationMinutes,
    formatTarget: formatDurationMinutes,
    getProgress: (s, storedTier = 0) =>
      buildCumulativeProgress(
        [15, 120, 900, 6000],
        s.activeMinutes,
        formatDurationMinutes,
        formatDurationMinutes,
        storedTier
      ),
    isUnlocked: (s) => s.activeMinutes >= 15,
  },
];

const VALID_BADGE_IDS = new Set<string>(BADGE_DEFINITIONS.map((b) => b.id));

export function createEmptyBadgeTiers(): Record<BadgeId, BadgeTier> {
  return {
    master_sketcher: 0,
    code_architect: 0,
    team_voice: 0,
    versatile_creator: 0,
    room_host: 0,
    studio_marathon: 0,
  };
}

/**
 * Parses Firestore badge tokens into a tier map.
 * Supports both new tiered tokens ("master_sketcher:2") and legacy flat tokens ("master_sketcher" -> tier 1).
 */
export function parseBadgeEntries(rawBadges: string[] = []): Record<BadgeId, BadgeTier> {
  const tiers = createEmptyBadgeTiers();
  for (const entry of rawBadges) {
    if (typeof entry !== 'string' || !entry) continue;
    const [rawId, rawTier] = entry.split(':');
    if (!VALID_BADGE_IDS.has(rawId)) continue;
    const id = rawId as BadgeId;
    const parsed = rawTier !== undefined ? Number(rawTier) : 1;
    const safeTier: BadgeTier =
      parsed >= 4 ? 4 : parsed === 3 ? 3 : parsed === 2 ? 2 : parsed >= 1 ? 1 : 0;
    if (safeTier > tiers[id]) {
      tiers[id] = safeTier;
    }
  }
  return tiers;
}

/** Serializes non-zero badge tiers to canonical Firestore tokens: ["master_sketcher:2", ...] */
export function serializeBadgeTiers(tiers: Record<BadgeId, BadgeTier>): string[] {
  const tokens: string[] = [];
  for (const def of BADGE_DEFINITIONS) {
    const t = tiers[def.id] || 0;
    if (t >= 1) {
      tokens.push(`${def.id}:${t}`);
    }
  }
  return tokens;
}

/**
 * Evaluates cumulative 4-tier badge progression monotonically (never downgrades previously earned tiers).
 */
export function evaluateBadgeTiers(
  stats: AccountStats,
  existingBadges: string[] = []
): { tiers: Record<BadgeId, BadgeTier>; badgeTokens: string[] } {
  const tiers = parseBadgeEntries(existingBadges);
  for (const def of BADGE_DEFINITIONS) {
    const earned = computeTierFromValue(def.tiers, def.getMetricValue(stats));
    if (earned > tiers[def.id]) {
      tiers[def.id] = earned;
    }
  }
  return {
    tiers,
    badgeTokens: serializeBadgeTiers(tiers),
  };
}

export function evaluateUnlockedBadges(
  stats: AccountStats,
  existingBadges: string[] = []
): string[] {
  return evaluateBadgeTiers(stats, existingBadges).badgeTokens;
}

export function countUnlockedBadges(tiers: Record<BadgeId, BadgeTier>): number {
  let count = 0;
  for (const def of BADGE_DEFINITIONS) {
    if ((tiers[def.id] || 0) >= 1) count++;
  }
  return count;
}

export function getBadgeById(id: string): BadgeDefinition | undefined {
  const cleanId = id.includes(':') ? id.split(':')[0] : id;
  return BADGE_DEFINITIONS.find((b) => b.id === cleanId);
}

export const PROFILE_COLOR_PALETTE = [
  '#2563eb', // Cobalt
  '#7c3aed', // Violet
  '#059669', // Emerald
  '#ea580c', // Orange
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#d97706', // Amber
  '#e11d48', // Crimson
  '#0f766e', // Teal
];

export const MAX_AVATAR_FILE_BYTES = 1024 * 1024; // 1 MB
export const DIRECT_AVATAR_MAX_CHARS = 700_000;
export const AVATAR_CHUNK_SIZE = 420_000;
export const AVATAR_CHUNK_PREFIX = 'chunked:';

const MAX_STATIC_AVATAR_DATA_URL_CHARS = 320_000;
const MAX_GIF_DATA_URL_CHARS = 1_450_000; // ~1 MB binary encoded in base64 + data URL header

/**
 * Prepares an uploaded avatar image for storage:
 * - Both static photos (PNG/JPEG/WebP) and animated GIFs are capped at 1 MB raw file size.
 * - Animated GIFs are preserved intact (keeping animation!).
 * - PNG / JPEG / WebP images are center-cropped to a crisp 192x192 square and compressed.
 */
export async function processAvatarFile(file: File): Promise<string> {
  const mime = (file.type || '').toLowerCase();
  const isGif = mime === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
  const isAllowed =
    isGif ||
    mime === 'image/png' ||
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/webp';

  if (!isAllowed) {
    throw new Error('Yalnızca PNG, JPEG, WebP veya GIF formatında görseller yükleyebilirsiniz.');
  }

  if (file.size > MAX_AVATAR_FILE_BYTES) {
    throw new Error(
      'Profil fotoğrafı veya hareketli GIF en fazla 1 MB olabilir. Lütfen daha küçük bir dosya seçin.'
    );
  }

  if (isGif) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('GIF dosyası okunamadı.'));
      reader.readAsDataURL(file);
    });
    if (dataUrl.length > MAX_GIF_DATA_URL_CHARS) {
      throw new Error('GIF dosyası 1 MB profil sınırını aşıyor. Lütfen daha küçük bir GIF deneyin.');
    }
    return dataUrl;
  }

  // Static image (PNG / JPEG / WebP): center-crop into crisp 192x192 square
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Görsel yüklenemedi.'));
      el.src = objectUrl;
    });

    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Görsel işleme başlatılamadı.');

    const srcMin = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = ((img.naturalWidth || img.width) - srcMin) / 2;
    const sy = ((img.naturalHeight || img.height) - srcMin) / 2;
    ctx.drawImage(img, sx, sy, srcMin, srcMin, 0, 0, size, size);

    // Prefer WebP, fallback to JPEG
    let out = canvas.toDataURL('image/webp', 0.86);
    if (!out.startsWith('data:image/webp') || out.length > MAX_STATIC_AVATAR_DATA_URL_CHARS) {
      out = canvas.toDataURL('image/jpeg', 0.84);
    }
    if (out.length > MAX_STATIC_AVATAR_DATA_URL_CHARS) {
      out = canvas.toDataURL('image/jpeg', 0.65);
    }
    return out;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function generateFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CB-${suffix}`;
}

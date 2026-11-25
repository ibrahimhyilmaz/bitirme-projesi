export type BadgeId =
  | 'master_sketcher'
  | 'code_architect'
  | 'team_voice'
  | 'versatile_creator'
  | 'room_host'
  | 'studio_marathon';

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

export interface BadgeDefinition {
  id: BadgeId;
  title: string;
  subtitle: string;
  description: string;
  accentFrom: string;
  accentTo: string;
  ringColor: string;
  getProgress: (stats: AccountStats) => { current: number; target: number; label: string };
  isUnlocked: (stats: AccountStats) => boolean;
}

export const BADGE_DEFINITIONS: ReadonlyArray<BadgeDefinition> = [
  {
    id: 'master_sketcher',
    title: 'Usta Çizer',
    subtitle: 'Üretim Eşiği',
    description: 'Tahtada toplam 25 çizim, şekil veya not oluşturarak kazanılır.',
    accentFrom: '#2563eb',
    accentTo: '#38bdf8',
    ringColor: '#60a5fa',
    getProgress: (s) => ({
      current: Math.min(25, s.drawCount),
      target: 25,
      label: `${Math.min(25, s.drawCount)} / 25 çizim`,
    }),
    isUnlocked: (s) => s.drawCount >= 25,
  },
  {
    id: 'code_architect',
    title: 'Kod Mimarı',
    subtitle: 'Yazılım & Senkron',
    description: 'Ortak kod editöründe en az 10 anlamlı kod düzenlemesi yaparak kazanılır.',
    accentFrom: '#059669',
    accentTo: '#34d399',
    ringColor: '#34d399',
    getProgress: (s) => ({
      current: Math.min(10, s.codeEditCount),
      target: 10,
      label: `${Math.min(10, s.codeEditCount)} / 10 kod katkısı`,
    }),
    isUnlocked: (s) => s.codeEditCount >= 10,
  },
  {
    id: 'team_voice',
    title: 'Takım Sesi',
    subtitle: 'Sesli İşbirliği',
    description: 'Başka katılımcıların da bulunduğu bir odada sesli kanala katılarak kazanılır.',
    accentFrom: '#7c3aed',
    accentTo: '#c084fc',
    ringColor: '#a78bfa',
    getProgress: (s) => ({
      current: Math.min(1, s.voiceCollabs),
      target: 1,
      label: s.voiceCollabs >= 1 ? 'Tamamlandı' : '0 / 1 ekip sesli oturumu',
    }),
    isUnlocked: (s) => s.voiceCollabs >= 1,
  },
  {
    id: 'versatile_creator',
    title: 'Çok Yönlü Üretici',
    subtitle: 'Tam Stüdyo',
    description: 'Aynı hesapla hem çizim, hem kod hem de PDF, şablon veya AI çizim kullanarak kazanılır.',
    accentFrom: '#d97706',
    accentTo: '#fbbf24',
    ringColor: '#fbbf24',
    getProgress: (s) => {
      const pillars =
        (s.drawCount >= 1 ? 1 : 0) +
        (s.codeEditCount >= 1 ? 1 : 0) +
        (s.pdfOrAiCount >= 1 ? 1 : 0);
      return {
        current: pillars,
        target: 3,
        label: `${pillars} / 3 araç alanı`,
      };
    },
    isUnlocked: (s) => s.drawCount >= 1 && s.codeEditCount >= 1 && s.pdfOrAiCount >= 1,
  },
  {
    id: 'room_host',
    title: 'Oda Kurucusu',
    subtitle: 'Topluluk & Davet',
    description: 'En az 3 çalışma odası oluşturarak veya bir arkadaş daveti kabul alarak kazanılır.',
    accentFrom: '#e11d48',
    accentTo: '#fb7185',
    ringColor: '#fb7185',
    getProgress: (s) => {
      if (s.acceptedInvites >= 1) {
        return { current: 3, target: 3, label: 'Davet kabul edildi' };
      }
      return {
        current: Math.min(3, s.roomsCreated),
        target: 3,
        label: `${Math.min(3, s.roomsCreated)} / 3 oda`,
      };
    },
    isUnlocked: (s) => s.roomsCreated >= 3 || s.acceptedInvites >= 1,
  },
  {
    id: 'studio_marathon',
    title: 'Stüdyo Maratonu',
    subtitle: 'Odaklanma Süresi',
    description: 'Çalışma odalarında toplam 15 aktif dakika geçirerek kazanılır.',
    accentFrom: '#0891b2',
    accentTo: '#22d3ee',
    ringColor: '#38bdf8',
    getProgress: (s) => ({
      current: Math.min(15, s.activeMinutes),
      target: 15,
      label: `${Math.min(15, s.activeMinutes)} / 15 dakika`,
    }),
    isUnlocked: (s) => s.activeMinutes >= 15,
  },
];

export function evaluateUnlockedBadges(
  stats: AccountStats,
  existingBadges: string[] = []
): BadgeId[] {
  const set = new Set<BadgeId>();
  const validIds = new Set<string>(BADGE_DEFINITIONS.map((b) => b.id));
  for (const b of existingBadges) {
    if (validIds.has(b)) set.add(b as BadgeId);
  }
  for (const def of BADGE_DEFINITIONS) {
    if (def.isUnlocked(stats)) {
      set.add(def.id);
    }
  }
  return Array.from(set);
}

export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === id);
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

const MAX_AVATAR_DATA_URL_CHARS = 320_000;

/**
 * Prepares an uploaded avatar image for Firestore storage:
 * - Animated GIFs are preserved intact (keeping animation!) when <= 230KB raw file size.
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

  if (isGif) {
    if (file.size > 235 * 1024) {
      throw new Error(
        'Hareketli GIF profil resmi en fazla 230 KB olabilir. Lütfen daha küçük bir GIF seçin.'
      );
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('GIF dosyası okunamadı.'));
      reader.readAsDataURL(file);
    });
    if (dataUrl.length > MAX_AVATAR_DATA_URL_CHARS) {
      throw new Error('GIF dosyası profil sınırını aşıyor. Lütfen daha küçük bir GIF deneyin.');
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
    if (!out.startsWith('data:image/webp') || out.length > MAX_AVATAR_DATA_URL_CHARS) {
      out = canvas.toDataURL('image/jpeg', 0.84);
    }
    if (out.length > MAX_AVATAR_DATA_URL_CHARS) {
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

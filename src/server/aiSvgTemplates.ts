export function buildFallbackSvg(
  prompt: string,
  _thinkingLevel: string = 'standard',
  strict: boolean = false
): string {
  const lower = prompt.toLowerCase().trim();

  // 1. Apple (Elma)
  if ((lower.includes('elma') || lower.includes('apple')) && !/ağaç|agac|tree|orman/.test(lower)) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="appleGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="60%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </radialGradient>
    <radialGradient id="leafGrad" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#86efac"/>
      <stop offset="100%" stop-color="#15803d"/>
    </radialGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>
  </defs>
  <ellipse cx="200" cy="350" rx="100" ry="20" fill="#cbd5e1" opacity="0.6"/>
  <path d="M 200 110 C 230 60, 290 70, 280 115 C 250 140, 210 120, 200 110 Z" fill="url(#leafGrad)" stroke="#166534" stroke-width="3"/>
  <path d="M 202 110 Q 240 95 278 115" stroke="#14532d" stroke-width="2" fill="none"/>
  <path d="M 200 135 C 196 90, 220 60, 230 50" stroke="#78350f" stroke-width="12" stroke-linecap="round" fill="none"/>
  <path d="M 200 145 C 160 110, 80 125, 80 215 C 80 295, 150 340, 200 340 C 250 340, 320 295, 320 215 C 320 125, 240 110, 200 145 Z" fill="url(#appleGrad)" stroke="#7f1d1d" stroke-width="4" filter="url(#shadow)"/>
  <ellipse cx="200" cy="148" rx="22" ry="8" fill="#7f1d1d" opacity="0.45"/>
  <ellipse cx="140" cy="190" rx="25" ry="50" transform="rotate(-25 140 190)" fill="#ffffff" opacity="0.45"/>
  <ellipse cx="132" cy="170" rx="10" ry="20" transform="rotate(-25 132 170)" fill="#ffffff" opacity="0.75"/>
</svg>`;
  }

  // 2. Car (Araba / Otomobil)
  if (lower.includes('araba') || lower.includes('otomobil') || lower.includes('araç') || lower.includes('car')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="carBody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="60%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="carGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="100%" stop-color="#7dd3fc"/>
    </linearGradient>
    <radialGradient id="wheelRim" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#334155"/>
    </radialGradient>
  </defs>
  <ellipse cx="200" cy="305" rx="170" ry="16" fill="#64748b" opacity="0.35"/>
  <path d="M 100 200 L 145 135 C 155 125, 170 120, 185 120 L 255 120 C 270 120, 285 125, 295 138 L 335 200 Z" fill="url(#carBody)" stroke="#1e3a8a" stroke-width="4"/>
  <path d="M 148 190 L 160 140 L 210 140 L 210 190 Z" fill="url(#carGlass)" stroke="#0284c7" stroke-width="3"/>
  <path d="M 220 190 L 220 140 L 260 140 L 290 190 Z" fill="url(#carGlass)" stroke="#0284c7" stroke-width="3"/>
  <rect x="40" y="190" width="320" height="70" rx="24" fill="url(#carBody)" stroke="#1e3a8a" stroke-width="4"/>
  <path d="M 345 205 C 360 210, 360 225, 345 230 Z" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
  <path d="M 55 205 C 40 210, 40 225, 55 230 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/>
  <line x1="60" y1="218" x2="330" y2="218" stroke="#60a5fa" stroke-width="3" stroke-linecap="round"/>
  <circle cx="115" cy="265" r="38" fill="#0f172a" stroke="#334155" stroke-width="4"/>
  <circle cx="115" cy="265" r="22" fill="url(#wheelRim)" stroke="#cbd5e1" stroke-width="3"/>
  <circle cx="115" cy="265" r="8" fill="#0f172a"/>
  <circle cx="280" cy="265" r="38" fill="#0f172a" stroke="#334155" stroke-width="4"/>
  <circle cx="280" cy="265" r="22" fill="url(#wheelRim)" stroke="#cbd5e1" stroke-width="3"/>
  <circle cx="280" cy="265" r="8" fill="#0f172a"/>
</svg>`;
  }

  // 3. Cat (Kedi)
  if (lower.includes('kedi') || lower.includes('cat')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="catGrad" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fed7aa"/>
      <stop offset="80%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#c2410c"/>
    </radialGradient>
  </defs>
  <polygon points="100,180 80,70 180,130" fill="url(#catGrad)" stroke="#9a3412" stroke-width="5"/>
  <polygon points="105,160 95,95 165,135" fill="#fbcfe8"/>
  <polygon points="300,180 320,70 220,130" fill="url(#catGrad)" stroke="#9a3412" stroke-width="5"/>
  <polygon points="295,160 305,95 235,135" fill="#fbcfe8"/>
  <ellipse cx="200" cy="210" rx="125" ry="105" fill="url(#catGrad)" stroke="#9a3412" stroke-width="5"/>
  <ellipse cx="150" cy="190" rx="18" ry="24" fill="#10b981" stroke="#047857" stroke-width="3"/>
  <ellipse cx="150" cy="190" rx="7" ry="18" fill="#064e3b"/>
  <circle cx="145" cy="182" r="5" fill="#ffffff"/>
  <ellipse cx="250" cy="190" rx="18" ry="24" fill="#10b981" stroke="#047857" stroke-width="3"/>
  <ellipse cx="250" cy="190" rx="7" ry="18" fill="#064e3b"/>
  <circle cx="245" cy="182" r="5" fill="#ffffff"/>
  <polygon points="200,225 188,212 212,212" fill="#f43f5e"/>
  <path d="M 200 225 Q 185 245 170 238" stroke="#7c2d12" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M 200 225 Q 215 245 230 238" stroke="#7c2d12" stroke-width="4" fill="none" stroke-linecap="round"/>
  <line x1="160" y1="225" x2="80" y2="215" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="160" y1="235" x2="75" y2="245" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="240" y1="225" x2="320" y2="215" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
  <line x1="240" y1="235" x2="325" y2="245" stroke="#7c2d12" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;
  }

  // 4. Tree (Ağaç)
  if (lower.includes('ağaç') || lower.includes('agac') || lower.includes('tree') || lower.includes('orman')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="canopy1" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#86efac"/>
      <stop offset="60%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#15803d"/>
    </radialGradient>
    <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#78350f"/>
      <stop offset="50%" stop-color="#92400e"/>
      <stop offset="100%" stop-color="#451a03"/>
    </linearGradient>
  </defs>
  <ellipse cx="200" cy="355" rx="140" ry="20" fill="#bbf7d0"/>
  <path d="M 175 190 L 170 345 C 160 350, 150 355, 140 355 L 260 355 C 250 355, 240 350, 230 345 L 225 190 Z" fill="url(#trunkGrad)"/>
  <circle cx="140" cy="180" r="65" fill="url(#canopy1)"/>
  <circle cx="260" cy="180" r="65" fill="url(#canopy1)"/>
  <circle cx="160" cy="120" r="65" fill="url(#canopy1)"/>
  <circle cx="240" cy="120" r="65" fill="url(#canopy1)"/>
  <circle cx="200" cy="150" r="80" fill="url(#canopy1)"/>
  <circle cx="160" cy="140" r="12" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
  <circle cx="230" cy="150" r="12" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
  <circle cx="195" cy="100" r="12" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
  <circle cx="210" cy="190" r="12" fill="#ef4444" stroke="#991b1b" stroke-width="2"/>
</svg>`;
  }

  // 5. Rocket (Roket)
  if (lower.includes('roket') || lower.includes('rocket') || lower.includes('uzay aracı')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rocketBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <linearGradient id="fire" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="40%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
  </defs>
  <circle cx="80" cy="80" r="3" fill="#fde047"/>
  <circle cx="330" cy="95" r="4" fill="#fde047"/>
  <circle cx="70" cy="220" r="2.5" fill="#fde047"/>
  <circle cx="340" cy="250" r="3" fill="#fde047"/>
  <polygon points="175,270 200,370 225,270" fill="url(#fire)"/>
  <polygon points="185,270 200,330 215,270" fill="#fef08a"/>
  <polygon points="150,230 110,270 160,270" fill="#dc2626" stroke="#991b1b" stroke-width="3"/>
  <polygon points="250,230 290,270 240,270" fill="#dc2626" stroke="#991b1b" stroke-width="3"/>
  <path d="M 200 45 C 160 90, 150 200, 155 270 L 245 270 C 250 200, 240 90, 200 45 Z" fill="url(#rocketBody)" stroke="#475569" stroke-width="4"/>
  <path d="M 200 45 C 180 70, 170 100, 168 115 L 232 115 C 230 100, 220 70, 200 45 Z" fill="#ef4444"/>
  <circle cx="200" cy="165" r="26" fill="#38bdf8" stroke="#0284c7" stroke-width="5"/>
  <circle cx="200" cy="165" r="20" fill="#bae6fd"/>
  <circle cx="194" cy="158" r="6" fill="#ffffff"/>
</svg>`;
  }

  // 6. Dog (Köpek)
  if (lower.includes('köpek') || lower.includes('kopek') || lower.includes('dog') || lower.includes('puppy')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="dogFur" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fed7aa"/>
      <stop offset="80%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </radialGradient>
  </defs>
  <ellipse cx="110" cy="180" rx="40" ry="80" transform="rotate(-15 110 180)" fill="#c2410c" stroke="#9a3412" stroke-width="4"/>
  <ellipse cx="290" cy="180" rx="40" ry="80" transform="rotate(15 290 180)" fill="#c2410c" stroke="#9a3412" stroke-width="4"/>
  <ellipse cx="200" cy="205" rx="115" ry="105" fill="url(#dogFur)" stroke="#9a3412" stroke-width="4"/>
  <ellipse cx="160" cy="185" rx="14" ry="20" fill="#0f172a"/>
  <circle cx="156" cy="178" r="4.5" fill="#ffffff"/>
  <ellipse cx="240" cy="185" rx="14" ry="20" fill="#0f172a"/>
  <circle cx="236" cy="178" r="4.5" fill="#ffffff"/>
  <ellipse cx="200" cy="235" rx="48" ry="36" fill="#ffedd5" stroke="#ea580c" stroke-width="2"/>
  <ellipse cx="200" cy="222" rx="18" ry="13" fill="#0f172a"/>
  <circle cx="196" cy="218" r="3.5" fill="#ffffff" opacity="0.8"/>
  <path d="M 200 234 L 200 250" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
  <path d="M 200 250 Q 185 260 175 252" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M 200 250 Q 215 260 225 252" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="200" cy="264" rx="14" ry="18" fill="#fb7185" stroke="#e11d48" stroke-width="2"/>
</svg>`;
  }

  // 7. Bird (Kuş)
  if (lower.includes('kuş') || lower.includes('kus') || lower.includes('bird')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="birdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="60%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <polygon points="90,260 50,300 120,270" fill="#0369a1"/>
  <ellipse cx="190" cy="220" rx="95" ry="75" fill="url(#birdGrad)" stroke="#075985" stroke-width="4"/>
  <path d="M 170 240 Q 220 280 260 240 Q 210 230 170 240 Z" fill="#bae6fd"/>
  <path d="M 140 210 C 120 230, 150 270, 210 240 C 220 210, 180 190, 140 210 Z" fill="#0284c7" stroke="#075985" stroke-width="3"/>
  <circle cx="270" cy="165" r="48" fill="url(#birdGrad)" stroke="#075985" stroke-width="4"/>
  <polygon points="310,165 375,178 308,188" fill="#f59e0b" stroke="#d97706" stroke-width="2.5"/>
  <circle cx="282" cy="155" r="9" fill="#0f172a"/>
  <circle cx="280" cy="152" r="3" fill="#ffffff"/>
  <line x1="170" y1="290" x2="160" y2="330" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
  <line x1="210" y1="290" x2="205" y2="330" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
</svg>`;
  }

  // 8. Fish (Balık)
  if (lower.includes('balık') || lower.includes('balik') || lower.includes('fish')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fishGrad" x1="0%" y1="0%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="50%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <circle cx="340" cy="120" r="10" fill="#38bdf8" opacity="0.6"/>
  <circle cx="365" cy="85" r="6" fill="#38bdf8" opacity="0.6"/>
  <polygon points="120,200 40,120 70,200 40,280" fill="#f97316" stroke="#c2410c" stroke-width="3"/>
  <polygon points="190,130 230,80 270,130" fill="#fb923c" stroke="#c2410c" stroke-width="2.5"/>
  <polygon points="190,270 230,310 260,270" fill="#fb923c" stroke="#c2410c" stroke-width="2.5"/>
  <ellipse cx="220" cy="200" rx="110" ry="72" fill="url(#fishGrad)" stroke="#c2410c" stroke-width="4"/>
  <path d="M 215 132 Q 235 200 215 268" stroke="#ffffff" stroke-width="12" fill="none" opacity="0.9"/>
  <circle cx="285" cy="185" r="12" fill="#ffffff" stroke="#c2410c" stroke-width="2"/>
  <circle cx="288" cy="185" r="6" fill="#0f172a"/>
  <path d="M 315 210 Q 300 220 290 215" stroke="#7c2d12" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;
  }

  // 9. Coffee / Tea
  if (lower.includes('kahve') || lower.includes('çay') || lower.includes('cay') || lower.includes('fincan') || lower.includes('coffee') || lower.includes('tea')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cupGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <path d="M 160 140 Q 150 100 170 70" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.75"/>
  <path d="M 200 130 Q 215 90 195 60" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.75"/>
  <path d="M 240 140 Q 230 100 250 70" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.75"/>
  <ellipse cx="200" cy="315" rx="135" ry="22" fill="#cbd5e1" stroke="#94a3b8" stroke-width="3.5"/>
  <ellipse cx="200" cy="310" rx="110" ry="16" fill="#f8fafc"/>
  <path d="M 260 190 C 340 190, 340 260, 255 260" stroke="#e2e8f0" stroke-width="18" fill="none" stroke-linecap="round"/>
  <path d="M 260 190 C 340 190, 340 260, 255 260" stroke="#94a3b8" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M 120 170 L 135 285 C 138 300, 262 300, 265 285 L 280 170 Z" fill="url(#cupGrad)" stroke="#94a3b8" stroke-width="4"/>
  <ellipse cx="200" cy="170" rx="80" ry="18" fill="#78350f" stroke="#451a03" stroke-width="2"/>
  <ellipse cx="200" cy="170" rx="60" ry="12" fill="#92400e"/>
</svg>`;
  }

  // 10. Pizza
  if (lower.includes('pizza')) {
    return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <path d="M 80 90 Q 200 50 320 90 L 200 350 Z" fill="#d97706" stroke="#b45309" stroke-width="4"/>
  <path d="M 95 105 Q 200 70 305 105 L 200 330 Z" fill="#fde047"/>
  <circle cx="160" cy="140" r="22" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
  <circle cx="240" cy="150" r="22" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
  <circle cx="190" cy="210" r="20" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
  <circle cx="210" cy="275" r="16" fill="#dc2626" stroke="#991b1b" stroke-width="2"/>
  <ellipse cx="140" cy="190" rx="10" ry="6" transform="rotate(-30 140 190)" fill="#15803d"/>
  <ellipse cx="250" cy="220" rx="10" ry="6" transform="rotate(40 250 220)" fill="#15803d"/>
</svg>`;
  }

  // In strict mode (client-side offline fallback) never invent a generic sticker
  if (strict) return '';

  // 11. Generic Aesthetic Vector Sticker
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="stickerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <radialGradient id="starShine" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#eab308"/>
    </radialGradient>
  </defs>
  <circle cx="200" cy="200" r="140" fill="url(#stickerGlow)" opacity="0.18"/>
  <circle cx="200" cy="200" r="105" fill="url(#stickerGlow)" opacity="0.3"/>
  <polygon points="200,60 235,145 325,150 255,210 280,295 200,245 120,295 145,210 75,150 165,145" fill="url(#starShine)" stroke="#ca8a04" stroke-width="4"/>
  <polygon points="200,130 240,200 200,270 160,200" fill="#ffffff" opacity="0.9"/>
  <circle cx="200" cy="200" r="22" fill="url(#stickerGlow)"/>
  <polygon points="100,100 105,115 120,120 105,125 100,140 95,125 80,120 95,115" fill="#fde047"/>
  <polygon points="300,90 304,102 316,106 304,110 300,122 296,110 284,106 296,102" fill="#38bdf8"/>
</svg>`;
}

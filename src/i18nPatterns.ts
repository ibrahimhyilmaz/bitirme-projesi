/**
 * Translations for dynamic user-facing messages (room errors, kick notices...) whose text embeds
 * room names/codes/counts and therefore cannot be matched as an exact phrase.
 * Index order: [en, de, fr, es, ar].
 */
type Fn = (...g: string[]) => string[];

const PATTERNS: [RegExp, Fn][] = [
  [
    /^(\d+) Deneme Yapıldı$/,
    (n) => [
      `${n} attempt${n === '1' ? '' : 's'} made`,
      `${n} Versuch${n === '1' ? '' : 'e'} unternommen`,
      `${n} tentative${n === '1' ? '' : 's'} effectuée${n === '1' ? '' : 's'}`,
      `${n} intento${n === '1' ? '' : 's'} realizado${n === '1' ? '' : 's'}`,
      `تمت ${n} محاولة`,
    ],
  ],
  [
    /^⏱️ (\d+) sn \/ (.+)$/,
    (n, label) => {
      const l = label.replace(/sn/g, 's').replace('dk', 'min');
      return [`⏱️ ${n} s / ${l}`, `⏱️ ${n} Sek. / ${l}`, `⏱️ ${n} s / ${l}`, `⏱️ ${n} s / ${l}`, `⏱️ ${n} ث / ${l}`];
    },
  ],
  [
    /^🔄 Hata sonrası kendi kendini onaran çözüm moduyla tekrar deneniyor \(Deneme #(\d+)\)\.\.\.$/,
    (n) => [
      `🔄 Retrying with the self-healing solve mode after the error (attempt #${n})...`,
      `🔄 Erneuter Versuch im selbstheilenden Lösungsmodus nach dem Fehler (Versuch #${n})...`,
      `🔄 Nouvel essai en mode de résolution auto-réparateur après l’erreur (essai #${n})...`,
      `🔄 Reintentando con el modo de resolución autorreparable tras el error (intento #${n})...`,
      `🔄 إعادة المحاولة بوضع الحل الذاتي الإصلاح بعد الخطأ (محاولة #${n})...`,
    ],
  ],
  [
    /^"(.+)" \(#([A-Za-z0-9_-]+)\) odası şu anda kilitli\. Oda yöneticisi yeni katılımları kapattı\.$/,
    (n, c) => [
      `"${n}" (#${c}) is currently locked. The room admin has closed new entries.`,
      `„${n}“ (#${c}) ist derzeit gesperrt. Der Raumadmin hat neue Beitritte geschlossen.`,
      `« ${n} » (#${c}) est actuellement verrouillée. L’administrateur a fermé les nouvelles entrées.`,
      `«${n}» (#${c}) está bloqueada actualmente. El administrador cerró las nuevas entradas.`,
      `الغرفة "${n}" (#${c}) مقفلة حاليًا. أغلق مدير الغرفة الانضمامات الجديدة.`,
    ],
  ],
  [
    /^"(.+)" \(#([A-Za-z0-9_-]+)\) odası maksimum kapasiteye ulaştı \((\d+)\/(\d+) kişi\)\. Bu odaya giriş yapılamaz\.$/,
    (n, c, a, b) => [
      `"${n}" (#${c}) has reached its maximum capacity (${a}/${b} people). It cannot be entered.`,
      `„${n}“ (#${c}) hat die maximale Kapazität erreicht (${a}/${b} Personen). Der Beitritt ist nicht möglich.`,
      `« ${n} » (#${c}) a atteint sa capacité maximale (${a}/${b} personnes). Impossible d’y entrer.`,
      `«${n}» (#${c}) alcanzó su capacidad máxima (${a}/${b} personas). No se puede entrar.`,
      `الغرفة "${n}" (#${c}) بلغت سعتها القصوى (${a}/${b} أشخاص). لا يمكن الدخول إليها.`,
    ],
  ],
  [
    /^"(.+)" \(#([A-Za-z0-9_-]+)\) odası kurucu tarafından kilitlenmiş\.$/,
    (n, c) => [
      `"${n}" (#${c}) was locked by its owner.`,
      `„${n}“ (#${c}) wurde vom Gründer gesperrt.`,
      `« ${n} » (#${c}) a été verrouillée par son propriétaire.`,
      `«${n}» (#${c}) fue bloqueada por su propietario.`,
      `قام مالك الغرفة "${n}" (#${c}) بقفلها.`,
    ],
  ],
  [
    /^"(.+)" \(#([A-Za-z0-9_-]+)\) odasının maksimum kişi kapasitesi \((\d+)\/(\d+)\) dolmuş\.$/,
    (n, c, a, b) => [
      `The maximum capacity of "${n}" (#${c}) is full (${a}/${b}).`,
      `Die maximale Kapazität von „${n}“ (#${c}) ist erreicht (${a}/${b}).`,
      `La capacité maximale de « ${n} » (#${c}) est atteinte (${a}/${b}).`,
      `La capacidad máxima de «${n}» (#${c}) está llena (${a}/${b}).`,
      `السعة القصوى للغرفة "${n}" (#${c}) ممتلئة (${a}/${b}).`,
    ],
  ],
  [
    /^"(.+)" \(#([A-Za-z0-9_-]+)\) odası kilitli\.$/,
    (n, c) => [
      `"${n}" (#${c}) is locked.`,
      `„${n}“ (#${c}) ist gesperrt.`,
      `« ${n} » (#${c}) est verrouillée.`,
      `«${n}» (#${c}) está bloqueada.`,
      `الغرفة "${n}" (#${c}) مقفلة.`,
    ],
  ],
  [
    /^"(.+)" \(#([A-Za-z0-9_-]+)\) odası dolu \((\d+)\/(\d+)\)\.$/,
    (n, c, a, b) => [
      `"${n}" (#${c}) is full (${a}/${b}).`,
      `„${n}“ (#${c}) ist voll (${a}/${b}).`,
      `« ${n} » (#${c}) est pleine (${a}/${b}).`,
      `«${n}» (#${c}) está llena (${a}/${b}).`,
      `الغرفة "${n}" (#${c}) ممتلئة (${a}/${b}).`,
    ],
  ],
  [
    /^#([A-Za-z0-9_-]+) kodlu bir oda bulunamadı\. Yalnızca oluşturulmuş odalara geçiş yapılabilir\.$/,
    (c) => [
      `No room with code #${c} was found. You can only switch to rooms that have been created.`,
      `Es wurde kein Raum mit dem Code #${c} gefunden. Sie können nur zu bereits erstellten Räumen wechseln.`,
      `Aucune salle avec le code #${c} n’a été trouvée. Vous ne pouvez passer qu’à des salles déjà créées.`,
      `No se encontró ninguna sala con el código #${c}. Solo puede cambiar a salas ya creadas.`,
      `لم يتم العثور على غرفة بالرمز #${c}. يمكنك الانتقال إلى الغرف التي تم إنشاؤها فقط.`,
    ],
  ],
  [
    /^#([A-Za-z0-9_-]+) kodlu oda artık mevcut değil\. Yalnızca oluşturulmuş odalara geçiş yapılabilir\.$/,
    (c) => [
      `The room with code #${c} no longer exists. You can only switch to rooms that have been created.`,
      `Der Raum mit dem Code #${c} existiert nicht mehr. Sie können nur zu bereits erstellten Räumen wechseln.`,
      `La salle avec le code #${c} n’existe plus. Vous ne pouvez passer qu’à des salles déjà créées.`,
      `La sala con el código #${c} ya no existe. Solo puede cambiar a salas ya creadas.`,
      `الغرفة بالرمز #${c} لم تعد موجودة. يمكنك الانتقال إلى الغرف التي تم إنشاؤها فقط.`,
    ],
  ],
  [
    /^#([A-Za-z0-9_-]+) kodlu bir çalışma odası bulunamadı\. Lütfen oda kodunu kontrol edin veya yeni bir oda oluşturun\.$/,
    (c) => [
      `No workspace with code #${c} was found. Please check the room code or create a new room.`,
      `Es wurde kein Arbeitsraum mit dem Code #${c} gefunden. Bitte prüfen Sie den Raumcode oder erstellen Sie einen neuen Raum.`,
      `Aucun espace de travail avec le code #${c} n’a été trouvé. Vérifiez le code ou créez une nouvelle salle.`,
      `No se encontró ningún espacio de trabajo con el código #${c}. Compruebe el código o cree una sala nueva.`,
      `لم يتم العثور على مساحة عمل بالرمز #${c}. تحقق من رمز الغرفة أو أنشئ غرفة جديدة.`,
    ],
  ],
  [
    /^#([A-Za-z0-9_-]+) koduna sahip aktif bir oda bulunamadı\. Lütfen oda kodunu kontrol edin veya yeni bir oda oluşturun\.$/,
    (c) => [
      `No active room with code #${c} was found. Please check the room code or create a new room.`,
      `Es wurde kein aktiver Raum mit dem Code #${c} gefunden. Bitte prüfen Sie den Raumcode oder erstellen Sie einen neuen Raum.`,
      `Aucune salle active avec le code #${c} n’a été trouvée. Vérifiez le code ou créez une nouvelle salle.`,
      `No se encontró ninguna sala activa con el código #${c}. Compruebe el código o cree una sala nueva.`,
      `لم يتم العثور على غرفة نشطة بالرمز #${c}. تحقق من رمز الغرفة أو أنشئ غرفة جديدة.`,
    ],
  ],
  [
    /^#([A-Za-z0-9_-]+) oda kodu zaten kullanılıyor\. Lütfen farklı bir (?:oda )?kod(?:u)? seçin(?: veya bu koda katılmayı deneyin| \(yeni kod üretebilirsiniz\))?\.$/,
    (c) => [
      `Room code #${c} is already in use. Please choose a different code.`,
      `Der Raumcode #${c} wird bereits verwendet. Bitte wählen Sie einen anderen Code.`,
      `Le code de salle #${c} est déjà utilisé. Veuillez choisir un autre code.`,
      `El código de sala #${c} ya está en uso. Elija otro código.`,
      `رمز الغرفة #${c} مستخدم بالفعل. يرجى اختيار رمز مختلف.`,
    ],
  ],
  [
    /^"(.+)" odasından (.+) tarafından çıkarıldınız\. Lütfen başka bir odaya katılın veya yeni oda oluşturun\.$/,
    (n, by) => [
      `You were removed from "${n}" by ${by}. Please join another room or create a new one.`,
      `Sie wurden von ${by} aus „${n}“ entfernt. Bitte treten Sie einem anderen Raum bei oder erstellen Sie einen neuen.`,
      `Vous avez été retiré de « ${n} » par ${by}. Rejoignez une autre salle ou créez-en une nouvelle.`,
      `${by} le expulsó de «${n}». Únase a otra sala o cree una nueva.`,
      `تمت إزالتك من "${n}" بواسطة ${by}. يرجى الانضمام إلى غرفة أخرى أو إنشاء غرفة جديدة.`,
    ],
  ],
  [
    /^Bir kullanıcı en fazla (\d+) oda açabilir\..*$/,
    (n) => [
      `A user can open at most ${n} rooms. Delete or close one of your current rooms to create a new one.`,
      `Ein Nutzer kann höchstens ${n} Räume öffnen. Löschen oder schließen Sie einen Ihrer Räume, um einen neuen zu erstellen.`,
      `Un utilisateur peut ouvrir au maximum ${n} salles. Supprimez ou fermez l’une de vos salles pour en créer une nouvelle.`,
      `Un usuario puede abrir como máximo ${n} salas. Elimine o cierre una de sus salas para crear otra.`,
      `يمكن للمستخدم فتح ${n} غرف كحد أقصى. احذف إحدى غرفك الحالية أو أغلقها لإنشاء غرفة جديدة.`,
    ],
  ],
];

const IDX = { en: 0, de: 1, fr: 2, es: 3, ar: 4 } as const;

export function translateDynamicPhrase(trimmed: string, lang: keyof typeof IDX): string | null {
  const idx = IDX[lang];
  for (const [re, fn] of PATTERNS) {
    const m = re.exec(trimmed);
    if (m) return fn(...m.slice(1))[idx];
  }
  return null;
}

import { useEffect, useSyncExternalStore } from 'react';
import type { LanguageCode } from './types';
import { EXTRA_PHRASES } from './i18nExtra';
import { EXTRA_PHRASES_2 } from './i18nExtra2';
import { EXTRA_PHRASES_3 } from './i18nExtra3';
import { EXTRA_PHRASES_4 } from './i18nExtra4';
import { translateDynamicPhrase } from './i18nPatterns';

export const LANGUAGE_OPTIONS: { code: LanguageCode; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

type Dict = Record<string, string>;

const tr: Dict = {
  'settings.title': 'Uygulama & Çalışma Alanı Ayarları',
  'settings.subtitle': 'Dil, tema, yüzen kutucuklar, kod editörü ve çizim tercihleri',
  'settings.close': 'Kapat',
  'settings.done': 'Tamam',
  'settings.footer': 'Ayarlarınız tarayıcı belleğine otomatik kaydedilir.',
  'tab.appearance': 'Görünüm & Tema',
  'tab.panels': 'Kutucuklar',
  'tab.drawing': 'Çoklu Seçim & Çizim',
  'tab.shortcuts': 'Ses & Kısayollar',
  'tab.editor': 'Kod Editörü',
  'tab.language': 'Dil',
  'lang.title': 'Arayüz Dili',
  'lang.desc': 'Uygulama arayüzünün dilini seçin. Arapça seçildiğinde arayüz sağdan sola düzenlenir.',
  'panels.title': 'Çalışma Alanı Kutucukları',
  'panels.toolbar': 'Ana Araç Çubuğu',
  'panels.stylebar': 'Stil, Renk & Döndürme Çubuğu',
  'panels.voicebar': 'Sesli Kanal Kutucuğu',
  'panels.minimap': 'Mini Harita',
  'panels.clock': 'Saat',
  'panels.folder': 'Klasör',
  'panels.shown': 'Gösteriliyor',
  'panels.hidden': 'Gizli',
  'panels.fullyHide': 'Tamamen Gizle',
  'panels.fullyHideDesc': 'Tüm kutucukları ve geri getirme çiplerini kaldırır; yalnızca tuval kalır.',
  'panels.fullyShow': 'Tamamen Göster',
  'panels.fullyShowDesc': 'Tüm kutucukları (saat, klasör, mini harita dahil) açar ve konumları sıfırlar.',
  'panels.fullyHiddenNotice': 'Arayüz tamamen gizli. Geri açmak için Ayarlar → Kutucuklar → Tamamen Göster.',
  'panels.resetPositions': 'Sürüklenen Konumları Sıfırla',
  'editor.title': 'Kod Editörü Ayarları',
  'editor.fontSize': 'Editör yazı boyutu',
  'editor.textColor': 'Editör yazı rengi',
  'editor.bgColor': 'Editör arka plan rengi',
  'editor.tabSize': 'Sekme (Tab) boşluğu',
  'editor.consoleFontSize': 'Konsol yazı boyutu',
  'editor.consoleTextColor': 'Konsol çıktı rengi',
  'editor.consoleErrorColor': 'Konsol hata rengi',
  'editor.consoleBgColor': 'Konsol arka plan rengi',
  'editor.consoleHeight': 'Konsol yüksekliği',
  'editor.reset': 'Editör Ayarlarını Sıfırla',
  'editor.preview': 'Önizleme',
  'code.files': 'Dosyalar',
  'code.newFile': 'Yeni dosya',
  'code.importFiles': 'Cihazdan dosya ekle',
  'code.deleteFile': 'Dosyayı sil',
  'code.mainFile': 'ana',
  'code.settings': 'Editör Ayarları',
  'code.fileNamePrompt': 'Dosya adı (örn. util.js, main.py):',
  'code.terminalResize': 'Terminal yüksekliğini sürükleyerek ayarla',
  'folder.title': 'Klasör',
  'folder.empty': 'Dosyaları buraya sürükleyip bırakın veya Dosya Ekle’ye basın.',
  'folder.add': 'Dosya Ekle',
  'folder.hint': 'Dosyaları buradan tahtaya sürükleyip bırakabilirsiniz.',
  'folder.remove': 'Klasörden kaldır',
  'folder.dropHere': 'Bırakın',
  'clock.title': 'Saat',
  'clock.show24': '24 saat',
  'clock.showSeconds': 'Saniye',
  'rooms.myRooms': 'Odalarım',
  'rooms.myRoomsDesc': 'Oluşturduğunuz odalar — tek tıkla geri dönün.',
  'rooms.noMyRooms': 'Henüz oluşturduğunuz bir oda yok.',
  'rooms.enter': 'Gir',
  'rooms.saved': 'Kayıtlı',
  'rooms.live': 'Aktif',
  'rooms.lockedIdle': 'Hareketsizlik nedeniyle kilitlendi',
  'history.title': 'Oda Geçmişi',
  'history.created': 'Oluşturduğunuz',
  'history.active': 'Aktif',
  'history.empty': 'Henüz girdiğiniz bir oda yok. Girdiğiniz odaların kodları burada listelenir.',
  'history.owner': 'Kurucu',
  'history.member': 'Katılımcı',
  'history.remove': 'Geçmişten kaldır',
  'session.timeout': 'Oturum 1 saat hareketsiz kaldığı için zaman aşımına uğradı ve oda kilitlendi. Aynı kodla girerek kaldığınız yerden devam edebilirsiniz.',
  'auth.profileSaved': 'Google hesabınız Firebase’e kaydedildi.',
};

const en: Dict = {
  'settings.title': 'App & Workspace Settings',
  'settings.subtitle': 'Language, theme, floating widgets, code editor and drawing preferences',
  'settings.close': 'Close',
  'settings.done': 'Done',
  'settings.footer': 'Your settings are saved automatically in your browser.',
  'tab.appearance': 'Appearance & Theme',
  'tab.panels': 'Widgets',
  'tab.drawing': 'Selection & Drawing',
  'tab.shortcuts': 'Sound & Shortcuts',
  'tab.editor': 'Code Editor',
  'tab.language': 'Language',
  'lang.title': 'Interface Language',
  'lang.desc': 'Choose the interface language. Arabic switches the layout to right-to-left.',
  'panels.title': 'Workspace Widgets',
  'panels.toolbar': 'Main Toolbar',
  'panels.stylebar': 'Style, Color & Rotate Bar',
  'panels.voicebar': 'Voice Channel Widget',
  'panels.minimap': 'Minimap',
  'panels.clock': 'Clock',
  'panels.folder': 'Folder',
  'panels.shown': 'Shown',
  'panels.hidden': 'Hidden',
  'panels.fullyHide': 'Hide Everything',
  'panels.fullyHideDesc': 'Removes all widgets and their restore chips; only the canvas remains.',
  'panels.fullyShow': 'Show Everything',
  'panels.fullyShowDesc': 'Opens every widget (including clock, folder and minimap) and resets positions.',
  'panels.fullyHiddenNotice': 'The interface is fully hidden. Restore it from Settings → Widgets → Show Everything.',
  'panels.resetPositions': 'Reset Dragged Positions',
  'editor.title': 'Code Editor Settings',
  'editor.fontSize': 'Editor font size',
  'editor.textColor': 'Editor text color',
  'editor.bgColor': 'Editor background color',
  'editor.tabSize': 'Tab width',
  'editor.consoleFontSize': 'Console font size',
  'editor.consoleTextColor': 'Console output color',
  'editor.consoleErrorColor': 'Console error color',
  'editor.consoleBgColor': 'Console background color',
  'editor.consoleHeight': 'Console height',
  'editor.reset': 'Reset Editor Settings',
  'editor.preview': 'Preview',
  'code.files': 'Files',
  'code.newFile': 'New file',
  'code.importFiles': 'Add files from device',
  'code.deleteFile': 'Delete file',
  'code.mainFile': 'main',
  'code.settings': 'Editor Settings',
  'code.fileNamePrompt': 'File name (e.g. util.js, main.py):',
  'code.terminalResize': 'Drag to resize the terminal',
  'folder.title': 'Folder',
  'folder.empty': 'Drag & drop files here or press Add Files.',
  'folder.add': 'Add Files',
  'folder.hint': 'Drag files from here onto the board.',
  'folder.remove': 'Remove from folder',
  'folder.dropHere': 'Drop here',
  'clock.title': 'Clock',
  'clock.show24': '24-hour',
  'clock.showSeconds': 'Seconds',
  'rooms.myRooms': 'My Rooms',
  'rooms.myRoomsDesc': 'Rooms you created — jump back in with one click.',
  'rooms.noMyRooms': 'You have not created any rooms yet.',
  'rooms.enter': 'Enter',
  'rooms.saved': 'Saved',
  'rooms.live': 'Live',
  'rooms.lockedIdle': 'Locked due to inactivity',
  'history.title': 'Room History',
  'history.created': 'Created',
  'history.active': 'Active',
  'history.empty': 'No rooms yet. The codes of rooms you enter are listed here.',
  'history.owner': 'Owner',
  'history.member': 'Member',
  'history.remove': 'Remove from history',
  'session.timeout': 'Your session timed out after 1 hour of inactivity and the room was locked. Re-enter with the same code to continue where you left off.',
  'auth.profileSaved': 'Your Google account was saved to Firebase.',
};

const de: Dict = {
  'settings.title': 'App- & Arbeitsbereich-Einstellungen',
  'settings.subtitle': 'Sprache, Design, schwebende Widgets, Code-Editor und Zeichenoptionen',
  'settings.close': 'Schließen',
  'settings.done': 'Fertig',
  'settings.footer': 'Ihre Einstellungen werden automatisch im Browser gespeichert.',
  'tab.appearance': 'Darstellung & Design',
  'tab.panels': 'Widgets',
  'tab.drawing': 'Auswahl & Zeichnen',
  'tab.shortcuts': 'Ton & Tastenkürzel',
  'tab.editor': 'Code-Editor',
  'tab.language': 'Sprache',
  'lang.title': 'Oberflächensprache',
  'lang.desc': 'Wählen Sie die Sprache der Oberfläche. Arabisch schaltet das Layout auf rechts-nach-links.',
  'panels.title': 'Arbeitsbereich-Widgets',
  'panels.toolbar': 'Haupt-Werkzeugleiste',
  'panels.stylebar': 'Stil-, Farb- & Drehleiste',
  'panels.voicebar': 'Sprachkanal-Widget',
  'panels.minimap': 'Minimap',
  'panels.clock': 'Uhr',
  'panels.folder': 'Ordner',
  'panels.shown': 'Sichtbar',
  'panels.hidden': 'Ausgeblendet',
  'panels.fullyHide': 'Alles ausblenden',
  'panels.fullyHideDesc': 'Entfernt alle Widgets samt Wiederherstellungs-Chips; nur die Leinwand bleibt.',
  'panels.fullyShow': 'Alles anzeigen',
  'panels.fullyShowDesc': 'Öffnet alle Widgets (inkl. Uhr, Ordner, Minimap) und setzt Positionen zurück.',
  'panels.fullyHiddenNotice': 'Die Oberfläche ist komplett ausgeblendet. Wiederherstellen: Einstellungen → Widgets → Alles anzeigen.',
  'panels.resetPositions': 'Verschobene Positionen zurücksetzen',
  'editor.title': 'Code-Editor-Einstellungen',
  'editor.fontSize': 'Editor-Schriftgröße',
  'editor.textColor': 'Editor-Textfarbe',
  'editor.bgColor': 'Editor-Hintergrundfarbe',
  'editor.tabSize': 'Tab-Breite',
  'editor.consoleFontSize': 'Konsolen-Schriftgröße',
  'editor.consoleTextColor': 'Konsolen-Ausgabefarbe',
  'editor.consoleErrorColor': 'Konsolen-Fehlerfarbe',
  'editor.consoleBgColor': 'Konsolen-Hintergrundfarbe',
  'editor.consoleHeight': 'Konsolenhöhe',
  'editor.reset': 'Editor-Einstellungen zurücksetzen',
  'editor.preview': 'Vorschau',
  'code.files': 'Dateien',
  'code.newFile': 'Neue Datei',
  'code.importFiles': 'Dateien vom Gerät hinzufügen',
  'code.deleteFile': 'Datei löschen',
  'code.mainFile': 'haupt',
  'code.settings': 'Editor-Einstellungen',
  'code.fileNamePrompt': 'Dateiname (z. B. util.js, main.py):',
  'code.terminalResize': 'Ziehen, um das Terminal zu vergrößern/verkleinern',
  'folder.title': 'Ordner',
  'folder.empty': 'Dateien hierher ziehen oder „Dateien hinzufügen“ drücken.',
  'folder.add': 'Dateien hinzufügen',
  'folder.hint': 'Ziehen Sie Dateien von hier auf das Board.',
  'folder.remove': 'Aus Ordner entfernen',
  'folder.dropHere': 'Hier ablegen',
  'clock.title': 'Uhr',
  'clock.show24': '24-Stunden',
  'clock.showSeconds': 'Sekunden',
  'rooms.myRooms': 'Meine Räume',
  'rooms.myRoomsDesc': 'Von Ihnen erstellte Räume – mit einem Klick zurück.',
  'rooms.noMyRooms': 'Sie haben noch keine Räume erstellt.',
  'rooms.enter': 'Beitreten',
  'rooms.saved': 'Gespeichert',
  'rooms.live': 'Aktiv',
  'rooms.lockedIdle': 'Wegen Inaktivität gesperrt',
  'history.title': 'Raumverlauf',
  'history.created': 'Erstellt',
  'history.active': 'Aktiv',
  'history.empty': 'Noch keine Räume besucht.',
  'history.owner': 'Ersteller',
  'history.member': 'Teilnehmer',
  'history.remove': 'Aus Verlauf entfernen',
  'session.timeout': 'Die Sitzung ist nach 1 Stunde Inaktivität abgelaufen und der Raum wurde gesperrt. Mit demselben Code beitreten, um fortzufahren.',
  'auth.profileSaved': 'Ihr Google-Konto wurde in Firebase gespeichert.',
};

const fr: Dict = {
  'settings.title': 'Paramètres de l’application et de l’espace',
  'settings.subtitle': 'Langue, thème, widgets flottants, éditeur de code et dessin',
  'settings.close': 'Fermer',
  'settings.done': 'Terminé',
  'settings.footer': 'Vos paramètres sont enregistrés automatiquement dans le navigateur.',
  'tab.appearance': 'Apparence & thème',
  'tab.panels': 'Widgets',
  'tab.drawing': 'Sélection & dessin',
  'tab.shortcuts': 'Son & raccourcis',
  'tab.editor': 'Éditeur de code',
  'tab.language': 'Langue',
  'lang.title': 'Langue de l’interface',
  'lang.desc': 'Choisissez la langue de l’interface. L’arabe passe la mise en page de droite à gauche.',
  'panels.title': 'Widgets de l’espace de travail',
  'panels.toolbar': 'Barre d’outils principale',
  'panels.stylebar': 'Barre style, couleur & rotation',
  'panels.voicebar': 'Widget du canal vocal',
  'panels.minimap': 'Mini-carte',
  'panels.clock': 'Horloge',
  'panels.folder': 'Dossier',
  'panels.shown': 'Affiché',
  'panels.hidden': 'Masqué',
  'panels.fullyHide': 'Tout masquer',
  'panels.fullyHideDesc': 'Retire tous les widgets et leurs pastilles de rappel ; seul le canevas reste.',
  'panels.fullyShow': 'Tout afficher',
  'panels.fullyShowDesc': 'Ouvre tous les widgets (horloge, dossier, mini-carte inclus) et réinitialise les positions.',
  'panels.fullyHiddenNotice': 'L’interface est entièrement masquée. Restaurez-la via Paramètres → Widgets → Tout afficher.',
  'panels.resetPositions': 'Réinitialiser les positions',
  'editor.title': 'Paramètres de l’éditeur de code',
  'editor.fontSize': 'Taille de police de l’éditeur',
  'editor.textColor': 'Couleur du texte de l’éditeur',
  'editor.bgColor': 'Couleur de fond de l’éditeur',
  'editor.tabSize': 'Largeur de tabulation',
  'editor.consoleFontSize': 'Taille de police de la console',
  'editor.consoleTextColor': 'Couleur de sortie de la console',
  'editor.consoleErrorColor': 'Couleur d’erreur de la console',
  'editor.consoleBgColor': 'Couleur de fond de la console',
  'editor.consoleHeight': 'Hauteur de la console',
  'editor.reset': 'Réinitialiser l’éditeur',
  'editor.preview': 'Aperçu',
  'code.files': 'Fichiers',
  'code.newFile': 'Nouveau fichier',
  'code.importFiles': 'Ajouter des fichiers depuis l’appareil',
  'code.deleteFile': 'Supprimer le fichier',
  'code.mainFile': 'principal',
  'code.settings': 'Paramètres de l’éditeur',
  'code.fileNamePrompt': 'Nom du fichier (ex. util.js, main.py) :',
  'code.terminalResize': 'Glisser pour redimensionner le terminal',
  'folder.title': 'Dossier',
  'folder.empty': 'Glissez-déposez des fichiers ici ou appuyez sur Ajouter.',
  'folder.add': 'Ajouter des fichiers',
  'folder.hint': 'Glissez les fichiers d’ici vers le tableau.',
  'folder.remove': 'Retirer du dossier',
  'folder.dropHere': 'Déposez ici',
  'clock.title': 'Horloge',
  'clock.show24': '24 heures',
  'clock.showSeconds': 'Secondes',
  'rooms.myRooms': 'Mes salles',
  'rooms.myRoomsDesc': 'Les salles que vous avez créées — revenez en un clic.',
  'rooms.noMyRooms': 'Vous n’avez encore créé aucune salle.',
  'rooms.enter': 'Entrer',
  'rooms.saved': 'Enregistrée',
  'rooms.live': 'Active',
  'rooms.lockedIdle': 'Verrouillée pour inactivité',
  'history.title': 'Historique des salles',
  'history.created': 'Créées',
  'history.active': 'Active',
  'history.empty': 'Aucune salle visitée pour le moment.',
  'history.owner': 'Fondateur',
  'history.member': 'Membre',
  'history.remove': 'Retirer de l’historique',
  'session.timeout': 'La session a expiré après 1 heure d’inactivité et la salle a été verrouillée. Rentrez avec le même code pour reprendre.',
  'auth.profileSaved': 'Votre compte Google a été enregistré dans Firebase.',
};

const es: Dict = {
  'settings.title': 'Ajustes de la app y del espacio',
  'settings.subtitle': 'Idioma, tema, widgets flotantes, editor de código y dibujo',
  'settings.close': 'Cerrar',
  'settings.done': 'Listo',
  'settings.footer': 'Tus ajustes se guardan automáticamente en el navegador.',
  'tab.appearance': 'Apariencia y tema',
  'tab.panels': 'Widgets',
  'tab.drawing': 'Selección y dibujo',
  'tab.shortcuts': 'Sonido y atajos',
  'tab.editor': 'Editor de código',
  'tab.language': 'Idioma',
  'lang.title': 'Idioma de la interfaz',
  'lang.desc': 'Elige el idioma de la interfaz. El árabe cambia el diseño a derecha-a-izquierda.',
  'panels.title': 'Widgets del espacio de trabajo',
  'panels.toolbar': 'Barra de herramientas principal',
  'panels.stylebar': 'Barra de estilo, color y giro',
  'panels.voicebar': 'Widget del canal de voz',
  'panels.minimap': 'Minimapa',
  'panels.clock': 'Reloj',
  'panels.folder': 'Carpeta',
  'panels.shown': 'Visible',
  'panels.hidden': 'Oculto',
  'panels.fullyHide': 'Ocultar todo',
  'panels.fullyHideDesc': 'Quita todos los widgets y sus chips de restauración; solo queda el lienzo.',
  'panels.fullyShow': 'Mostrar todo',
  'panels.fullyShowDesc': 'Abre todos los widgets (reloj, carpeta y minimapa incluidos) y restablece posiciones.',
  'panels.fullyHiddenNotice': 'La interfaz está totalmente oculta. Restáurala en Ajustes → Widgets → Mostrar todo.',
  'panels.resetPositions': 'Restablecer posiciones',
  'editor.title': 'Ajustes del editor de código',
  'editor.fontSize': 'Tamaño de fuente del editor',
  'editor.textColor': 'Color del texto del editor',
  'editor.bgColor': 'Color de fondo del editor',
  'editor.tabSize': 'Ancho de tabulación',
  'editor.consoleFontSize': 'Tamaño de fuente de la consola',
  'editor.consoleTextColor': 'Color de salida de la consola',
  'editor.consoleErrorColor': 'Color de error de la consola',
  'editor.consoleBgColor': 'Color de fondo de la consola',
  'editor.consoleHeight': 'Altura de la consola',
  'editor.reset': 'Restablecer editor',
  'editor.preview': 'Vista previa',
  'code.files': 'Archivos',
  'code.newFile': 'Archivo nuevo',
  'code.importFiles': 'Añadir archivos del dispositivo',
  'code.deleteFile': 'Eliminar archivo',
  'code.mainFile': 'principal',
  'code.settings': 'Ajustes del editor',
  'code.fileNamePrompt': 'Nombre del archivo (p. ej. util.js, main.py):',
  'code.terminalResize': 'Arrastra para cambiar la altura del terminal',
  'folder.title': 'Carpeta',
  'folder.empty': 'Arrastra archivos aquí o pulsa Añadir archivos.',
  'folder.add': 'Añadir archivos',
  'folder.hint': 'Arrastra archivos desde aquí al tablero.',
  'folder.remove': 'Quitar de la carpeta',
  'folder.dropHere': 'Suelta aquí',
  'clock.title': 'Reloj',
  'clock.show24': '24 horas',
  'clock.showSeconds': 'Segundos',
  'rooms.myRooms': 'Mis salas',
  'rooms.myRoomsDesc': 'Las salas que creaste — vuelve con un clic.',
  'rooms.noMyRooms': 'Aún no has creado ninguna sala.',
  'rooms.enter': 'Entrar',
  'rooms.saved': 'Guardada',
  'rooms.live': 'Activa',
  'rooms.lockedIdle': 'Bloqueada por inactividad',
  'history.title': 'Historial de salas',
  'history.created': 'Creadas',
  'history.active': 'Activa',
  'history.empty': 'Aún no has entrado en ninguna sala.',
  'history.owner': 'Creador',
  'history.member': 'Miembro',
  'history.remove': 'Quitar del historial',
  'session.timeout': 'La sesión caducó tras 1 hora de inactividad y la sala se bloqueó. Entra con el mismo código para continuar.',
  'auth.profileSaved': 'Tu cuenta de Google se guardó en Firebase.',
};

const ar: Dict = {
  'settings.title': 'إعدادات التطبيق ومساحة العمل',
  'settings.subtitle': 'اللغة والمظهر والأدوات العائمة ومحرر الأكواد وخيارات الرسم',
  'settings.close': 'إغلاق',
  'settings.done': 'تم',
  'settings.footer': 'تُحفظ إعداداتك تلقائيًا في المتصفح.',
  'tab.appearance': 'المظهر والسمة',
  'tab.panels': 'الأدوات',
  'tab.drawing': 'التحديد والرسم',
  'tab.shortcuts': 'الصوت والاختصارات',
  'tab.editor': 'محرر الأكواد',
  'tab.language': 'اللغة',
  'lang.title': 'لغة الواجهة',
  'lang.desc': 'اختر لغة الواجهة. عند اختيار العربية يتحول التخطيط من اليمين إلى اليسار.',
  'panels.title': 'أدوات مساحة العمل',
  'panels.toolbar': 'شريط الأدوات الرئيسي',
  'panels.stylebar': 'شريط النمط واللون والتدوير',
  'panels.voicebar': 'أداة القناة الصوتية',
  'panels.minimap': 'الخريطة المصغرة',
  'panels.clock': 'الساعة',
  'panels.folder': 'المجلد',
  'panels.shown': 'ظاهر',
  'panels.hidden': 'مخفي',
  'panels.fullyHide': 'إخفاء الكل',
  'panels.fullyHideDesc': 'يزيل جميع الأدوات وأزرار استعادتها؛ تبقى اللوحة فقط.',
  'panels.fullyShow': 'إظهار الكل',
  'panels.fullyShowDesc': 'يفتح جميع الأدوات (بما فيها الساعة والمجلد والخريطة) ويعيد المواضع.',
  'panels.fullyHiddenNotice': 'الواجهة مخفية بالكامل. للاستعادة: الإعدادات ← الأدوات ← إظهار الكل.',
  'panels.resetPositions': 'إعادة المواضع',
  'editor.title': 'إعدادات محرر الأكواد',
  'editor.fontSize': 'حجم خط المحرر',
  'editor.textColor': 'لون نص المحرر',
  'editor.bgColor': 'لون خلفية المحرر',
  'editor.tabSize': 'عرض علامة التبويب',
  'editor.consoleFontSize': 'حجم خط وحدة التحكم',
  'editor.consoleTextColor': 'لون ناتج وحدة التحكم',
  'editor.consoleErrorColor': 'لون الأخطاء',
  'editor.consoleBgColor': 'لون خلفية وحدة التحكم',
  'editor.consoleHeight': 'ارتفاع وحدة التحكم',
  'editor.reset': 'إعادة ضبط المحرر',
  'editor.preview': 'معاينة',
  'code.files': 'الملفات',
  'code.newFile': 'ملف جديد',
  'code.importFiles': 'إضافة ملفات من الجهاز',
  'code.deleteFile': 'حذف الملف',
  'code.mainFile': 'رئيسي',
  'code.settings': 'إعدادات المحرر',
  'code.fileNamePrompt': 'اسم الملف (مثل util.js, main.py):',
  'code.terminalResize': 'اسحب لتغيير ارتفاع الطرفية',
  'folder.title': 'المجلد',
  'folder.empty': 'اسحب الملفات وأفلتها هنا أو اضغط إضافة ملفات.',
  'folder.add': 'إضافة ملفات',
  'folder.hint': 'اسحب الملفات من هنا إلى اللوحة.',
  'folder.remove': 'إزالة من المجلد',
  'folder.dropHere': 'أفلت هنا',
  'clock.title': 'الساعة',
  'clock.show24': '24 ساعة',
  'clock.showSeconds': 'الثواني',
  'rooms.myRooms': 'غرفي',
  'rooms.myRoomsDesc': 'الغرف التي أنشأتها — عد إليها بنقرة واحدة.',
  'rooms.noMyRooms': 'لم تنشئ أي غرفة بعد.',
  'rooms.enter': 'دخول',
  'rooms.saved': 'محفوظة',
  'rooms.live': 'نشطة',
  'rooms.lockedIdle': 'مغلقة بسبب عدم النشاط',
  'history.title': 'سجل الغرف',
  'history.created': 'أنشأتها',
  'history.active': 'نشطة',
  'history.empty': 'لم تدخل أي غرفة بعد.',
  'history.owner': 'المؤسس',
  'history.member': 'عضو',
  'history.remove': 'إزالة من السجل',
  'session.timeout': 'انتهت الجلسة بعد ساعة من عدم النشاط وتم قفل الغرفة. ادخل بنفس الرمز لمتابعة عملك.',
  'auth.profileSaved': 'تم حفظ حساب Google الخاص بك في Firebase.',
};

const DICTS: Record<LanguageCode, Dict> = { tr, en, de, fr, es, ar };

// Site-wide Turkish phrase -> [en, de, fr, es, ar] translation table for automatic DOM translation
const PHRASE_TABLE: Record<string, [string, string, string, string, string]> = {
  // TopNav & Navigation
  'AI Çizim': ['AI Draw', 'KI-Zeichnung', 'Dessin IA', 'Dibujo IA', 'رسم ذكي'],
  'AI Çiz': ['AI Draw', 'KI-Zeichn.', 'Dessin IA', 'Dibujo IA', 'رسم ذكي'],
  'Şablonlar': ['Templates', 'Vorlagen', 'Modèles', 'Plantillas', 'القوالب'],
  'Hazır Şablonlar': ['Ready Templates', 'Fertige Vorlagen', 'Modèles prêts', 'Plantillas listas', 'قوالب جاهزة'],
  'Kod': ['Code', 'Code', 'Code', 'Código', 'الكود'],
  'Notlar': ['Notes', 'Notizen', 'Notes', 'Notas', 'الملاحظات'],
  'Ortak Notlar': ['Shared Notes', 'Gemeinsame Notizen', 'Notes partagées', 'Notas compartidas', 'ملاحظات مشتركة'],
  'Dosyalar': ['Files', 'Dateien', 'Fichiers', 'Archivos', 'الملفات'],
  'Dosya Paylaşımı': ['File Sharing', 'Dateifreigabe', 'Partage de fichiers', 'Compartir archivos', 'مشاركة الملفات'],
  'Sohbet': ['Chat', 'Chat', 'Discussion', 'Chat', 'الدردشة'],
  'Davet': ['Invite', 'Einladen', 'Inviter', 'Invitar', 'دعوة'],
  'Kopyalandı': ['Copied', 'Kopiert', 'Copié', 'Copiado', 'تم النسخ'],
  'Kodu Kopyala': ['Copy Code', 'Code kopieren', 'Copier le code', 'Copiar código', 'نسخ الرمز'],
  'Dışa Aktar': ['Export', 'Exportieren', 'Exporter', 'Exportar', 'تصدير'],
  'Kurucu': ['Owner', 'Ersteller', 'Fondateur', 'Creador', 'المؤسس'],
  'Düzenleyici': ['Editor', 'Bearbeiter', 'Éditeur', 'Editor', 'محرر'],
  'İzleyici': ['Viewer', 'Betrachter', 'Lecteur', 'Lector', 'مشاهد'],
  'İzleyici Modu': ['Viewer Mode', 'Betrachtermodus', 'Mode lecteur', 'Modo lector', 'وضع المشاهدة'],
  'Aktif Çalışma Odası': ['Active Workspace Room', 'Aktiver Arbeitsraum', 'Salle de travail active', 'Sala de trabajo activa', 'غرفة العمل النشطة'],
  '5 Haneli Oda Kodu ile Geç': ['Switch by 5-Digit Room Code', 'Per 5-stelligem Raumcode wechseln', 'Changer avec code à 5 caractères', 'Cambiar con código de 5 dígitos', 'التبديل برمز الغرفة من 5 خانات'],
  'Geç': ['Go', 'Los', 'Aller', 'Ir', 'انتقال'],
  'Yeni Oda Oluştur / Tüm Odalar': ['Create Room / All Rooms', 'Raum erstellen / Alle Räume', 'Créer une salle / Toutes les salles', 'Crear sala / Todas las salas', 'إنشاء غرفة / كل الغرف'],
  'Kapasite Sınırı & Oda Kilidi': ['Capacity Limit & Room Lock', 'Kapazitätslimit & Raumsperre', 'Limite de capacité & verrouillage', 'Límite de capacidad y bloqueo', 'حد السعة وقفل الغرفة'],
  'Başka Odaya Geç': ['Switch Room', 'Raum wechseln', 'Changer de salle', 'Cambiar de sala', 'الانتقال لغرفة أخرى'],
  'Genel Çalışma Alanı': ['General Workspace', 'Allgemeiner Arbeitsbereich', 'Espace de travail général', 'Espacio de trabajo general', 'مساحة العمل العامة'],
  'Çalışma Alanı': ['Workspace', 'Arbeitsbereich', 'Espace de travail', 'Espacio de trabajo', 'مساحة العمل'],
  'Kutucuklar (Gizle / Göster)': ['Widgets (Hide / Show)', 'Widgets (Ein-/Ausblenden)', 'Widgets (Masquer / Afficher)', 'Widgets (Ocultar / Mostrar)', 'الأدوات (إخفاء / إظهار)'],
  '1. Ana Araç Çubuğu': ['1. Main Toolbar', '1. Haupt-Werkzeugleiste', '1. Barre d’outils principale', '1. Barra principal', '1. شريط الأدوات الرئيسي'],
  '2. Renk & Stil Çubuğu': ['2. Color & Style Bar', '2. Farb- & Stilleiste', '2. Barre couleur & style', '2. Barra de color y estilo', '2. شريط اللون والنمط'],
  '3. Sesli Kanal Kutusu': ['3. Voice Channel Box', '3. Sprachkanal-Box', '3. Boîte canal vocal', '3. Caja de canal de voz', '3. صندوق القناة الصوتية'],
  '4. Mini Harita & Odak': ['4. Minimap & Focus', '4. Minimap & Fokus', '4. Mini-carte & focus', '4. Minimapa y enfoque', '4. الخريطة المصغرة والتركيز'],
  '5. Dijital Saat Kutusu': ['5. Digital Clock Box', '5. Digitaluhr-Box', '5. Horloge numérique', '5. Reloj digital', '5. الساعة الرقمية'],
  '6. Dosya Klasörü Kutusu': ['6. File Folder Box', '6. Dateiordner-Box', '6. Dossier de fichiers', '6. Carpeta de archivos', '6. مجلد الملفات'],
  'Üst/Alt Flex Düzenine Kenetle & Göster': ['Dock to Default Layout & Show', 'An Standardlayout andocken & zeigen', 'Ancrer à la disposition & afficher', 'Acoplar al diseño y mostrar', 'إرساء للوضع الافتراضي وإظهار'],
  'Açık': ['Open', 'Offen', 'Ouvert', 'Abierto', 'مفتوح'],
  'Gizli': ['Hidden', 'Ausgeblendet', 'Masqué', 'Oculto', 'مخفي'],
  'AÇIK': ['ON', 'EIN', 'ACTIF', 'ACTIVO', 'مفعل'],
  'KAPALI': ['OFF', 'AUS', 'INACTIF', 'INACTIVO', 'مغلق'],
  'Aç': ['On', 'Ein', 'Ouvrir', 'Abrir', 'فتح'],
  'Kapat': ['Close', 'Aus', 'Fermer', 'Cerrar', 'إغلاق'],

  // Toolbar & Drawing Tools
  'Araçlar (Gizli)': ['Tools (Hidden)', 'Werkzeuge (Ausgeblendet)', 'Outils (Masqués)', 'Herramientas (Ocultas)', 'الأدوات (مخفية)'],
  'Çizim Kalemi': ['Drawing Pen', 'Zeichenstift', 'Crayon à dessin', 'Lápiz de dibujo', 'قلم الرسم'],
  'Sabit kalınlıkta akıcı ve pürüzsüz serbest el çizimi yapar.': [
    'Draws smooth freehand lines with uniform thickness.',
    'Zeichnet flüssige Freihandlinien mit gleichmäßiger Stärke.',
    'Trace des lignes fluides à main levée d’épaisseur uniforme.',
    'Dibuja líneas fluidas a mano alzada con grosor uniforme.',
    'يرسم خطوطًا حرة سلسة بسُمك ثابت.',
  ],
  'Dolma Kalem': ['Fountain Pen', 'Füllfederhalter', 'Stylo-plume', 'Pluma estilográfica', 'قلم حبر سائل'],
  'Baskıya ve hıza duyarlı: yavaş gidince kalın, hızlı kaydırınca ince çizer.': [
    'Pressure & speed sensitive: thick when moving slowly, thin when dragging fast.',
    'Druck- & geschwindigkeitsabhängig: langsam dick, schnell dünn.',
    'Sensible à la vitesse et pression : épais lentement, fin rapidement.',
    'Sensible a velocidad y presión: grueso al ir lento, fino al deslizar rápido.',
    'حساس للسرعة والضغط: سميك عند الحركة البطيئة ورفيع عند السحب السريع.',
  ],
  'Çizim Kalemi (P)': ['Drawing Pen (P)', 'Zeichenstift (P)', 'Crayon à dessin (P)', 'Lápiz de dibujo (P)', 'قلم الرسم (P)'],
  'Çizim Kalemi (Standart serbest çizim - P)': [
    'Drawing Pen (Standard freehand drawing - P)',
    'Zeichenstift (Standard-Freihandzeichnen - P)',
    'Crayon à dessin (Dessin à main levée standard - P)',
    'Lápiz de dibujo (Dibujo libre estándar - P)',
    'قلم الرسم (رسم حر قياسي - P)',
  ],
  'Dolma Kalem (Hıza ve baskıya duyarlı: yavaş gidince kalın, hızlı kaydırınca ince çizer - Shift+P)': [
    'Fountain Pen (Speed & pressure sensitive: thick when slow, thin when fast - Shift+P)',
    'Füllfederhalter (Geschwindigkeits- & druckabhängig: langsam dick, schnell dünn - Shift+P)',
    'Stylo-plume (Sensible à la vitesse : épais lentement, fin rapidement - Shift+P)',
    'Pluma estilográfica (Sensible a la velocidad: grueso lento, fino rápido - Shift+P)',
    'قلم حبر سائل (حساس للسرعة والضغط - Shift+P)',
  ],
  'Kalem Türünü Değiştir (Çizim Kalemi / Dolma Kalem)': [
    'Switch Pen Type (Drawing Pen / Fountain Pen)',
    'Stifttyp wechseln (Zeichenstift / Füllfederhalter)',
    'Changer de stylo (Crayon / Stylo-plume)',
    'Cambiar tipo de lápiz (Lápiz / Pluma estilográfica)',
    'تغيير نوع القلم (قلم رسم / قلم حبر)',
  ],
  'Fosforlu Vurgulayıcı Kalem': ['Highlighter Pen', 'Textmarker', 'Surligneur', 'Marcador fluorescente', 'قلم تظليل فسفوري'],
  'Boya Kovası - Kapalı Alanların ve Şekillerin İçini Doldur (B)': [
    'Paint Bucket - Fill Enclosed Regions and Shapes (B)',
    'Farbeimer - Geschlossene Bereiche und Formen füllen (B)',
    'Pot de peinture - Remplir les zones fermées et formes (B)',
    'Bote de pintura - Rellenar áreas cerradas y formas (B)',
    'دلو الطلاء - تعبئة المناطق المغلقة والأشكال (B)',
  ],
  'Öğe Silgisi': ['Object Eraser', 'Objektradierer', 'Gomme d’objet', 'Borrador de objetos', 'ممحاة العناصر'],
  'Dokunulan şekil veya çizgiyi tek dokunuşta tamamen kaldırır.': [
    'Removes any touched shape or stroke completely in a single tap.',
    'Entfernt berührte Formen oder Linien sofort vollständig.',
    'Supprime complètement toute forme ou ligne touchée d’un seul geste.',
    'Elimina por completo cualquier forma o trazo tocado de un solo toque.',
    'يزيل أي شكل أو خط يتم لمسه بالكامل بلمسة واحدة.',
  ],
  'Hassas Silgi': ['Precision Eraser', 'Präzisionsradierer', 'Gomme de précision', 'Borrador de precisión', 'ممحاة دقيقة'],
  'Yalnızca dokunduğu kısmı siler, serbest çizimleri böler.': [
    'Erases only the touched area and splits freehand strokes.',
    'Löscht nur den berührten Bereich und teilt Freihandlinien.',
    'Efface uniquement la zone touchée et divise les traits.',
    'Borra solo la parte tocada y divide los trazos libres.',
    'يمحو الجزء الملموس فقط ويقسم الخطوط الحرة.',
  ],
  'Şekil & Diyagram Kütüphanesi': ['Shape & Diagram Library', 'Form- & Diagrammbibliothek', 'Bibliothèque de formes', 'Biblioteca de formas', 'مكتبة الأشكال والمخططات'],
  '27 Vektörel Şekil': ['27 Vector Shapes', '27 Vektorformen', '27 formes vectorielles', '27 formas vectoriales', '27 شكلاً متجهًا'],
  'Seç, Taşı, Boyutlandır ve Döndür (V)': ['Select, Move, Resize & Rotate (V)', 'Auswählen, Bewegen, Skalieren & Drehen (V)', 'Sélectionner, déplacer, redimensionner & pivoter (V)', 'Seleccionar, mover, redimensionar y girar (V)', 'تحديد ونقل وتغيير الحجم وتدوير (V)'],
  'Tuvali Kaydır (H veya Boşluk Tuşu)': ['Pan Canvas (H or Spacebar)', 'Leinwand verschieben (H oder Leertaste)', 'Déplacer le canevas (H ou Espace)', 'Desplazar lienzo (H o Espacio)', 'تحريك اللوحة (H أو مسافة)'],
  'Bağlantı Oku (A)': ['Connector Arrow (A)', 'Verbindungspfeil (A)', 'Flèche de connexion (A)', 'Flecha conectora (A)', 'سهم ربط (A)'],
  'Düz Çizgi (L)': ['Straight Line (L)', 'Gerade Linie (L)', 'Ligne droite (L)', 'Línea recta (L)', 'خط مستقيم (L)'],
  'Yapışkan Not (N)': ['Sticky Note (N)', 'Haftnotiz (N)', 'Note adhésive (N)', 'Nota adhesiva (N)', 'ملاحظة لاصقة (N)'],
  'Metin Yazısı (T)': ['Text Tool (T)', 'Textwerkzeug (T)', 'Outil texte (T)', 'Texto (T)', 'أداة النص (T)'],
  'Tahtaya Görsel Yükle': ['Upload Image to Board', 'Bild aufs Board laden', 'Importer une image', 'Subir imagen al tablero', 'رفع صورة إلى اللوحة'],
  'Lazer İşaretçi (K)': ['Laser Pointer (K)', 'Laserpointer (K)', 'Pointeur laser (K)', 'Puntero láser (K)', 'مؤشر ليزر (K)'],
  'Tahtayı Temizle': ['Clear Board', 'Board leeren', 'Effacer le tableau', 'Limpiar tablero', 'مسح اللوحة'],
  'Tümünü Sil?': ['Clear All?', 'Alles löschen?', 'Tout effacer ?', '¿Borrar todo?', 'مسح الكل؟'],
  'Evet': ['Yes', 'Ja', 'Oui', 'Sí', 'نعم'],
  'İptal': ['Cancel', 'Abbrechen', 'Annuler', 'Cancelar', 'إلغاء'],
  'Kaydet': ['Save', 'Speichern', 'Enregistrer', 'Guardar', 'حفظ'],

  // StyleBar
  'Stil (Gizli)': ['Style (Hidden)', 'Stil (Ausgeblendet)', 'Style (Masqué)', 'Estilo (Oculto)', 'النمط (مخفي)'],
  'Silgi Alanı:': ['Eraser Shape:', 'Radiererform:', 'Forme gomme :', 'Área borrador:', 'شكل الممحاة:'],
  'Yuvarlak': ['Circle', 'Rund', 'Rond', 'Círculo', 'دائري'],
  'Kare': ['Square', 'Quadrat', 'Carré', 'Cuadrado', 'مربع'],
  'İç Dolgu:': ['Fill:', 'Füllung:', 'Remplissage :', 'Relleno:', 'التعبئة:'],
  'Çizgi Stili': ['Stroke Style', 'Linienstil', 'Style de trait', 'Estilo de línea', 'نمط الخط'],
  'Düz': ['Solid', 'Durchgehend', 'Continu', 'Sólido', 'متصل'],
  'Kesikli': ['Dashed', 'Gestrichelt', 'Tirets', 'Guiones', 'متقطع'],
  'Noktalı': ['Dotted', 'Gepunktet', 'Pointillé', 'Punteado', 'منقط'],
  'Saydamlık': ['Opacity', 'Deckkraft', 'Opacité', 'Opacidad', 'الشفافية'],
  'Kalınlık Ayarı': ['Thickness', 'Linienstärke', 'Épaisseur', 'Grosor', 'السُمك'],
  'Canlı Önizleme': ['Live Preview', 'Live-Vorschau', 'Aperçu en direct', 'Vista previa', 'معاينة حية'],
  'Döndürme Açısı': ['Rotation Angle', 'Drehwinkel', 'Angle de rotation', 'Ángulo de rotación', 'زاوية التدوير'],
  'Öne Getir': ['Bring Front', 'Nach vorn', 'Premier plan', 'Traer al frente', 'إحضار للأمام'],
  'Arkaya At': ['Send Back', 'Nach hinten', 'Arrière-plan', 'Enviar atrás', 'إرسال للخلف'],

  // VoiceChatBar
  'Sesli Kanal': ['Voice Channel', 'Sprachkanal', 'Canal vocal', 'Canal de voz', 'القناة الصوتية'],
  'Sesli Kanal Üyeleri': ['Voice Channel Members', 'Sprachkanal-Mitglieder', 'Membres du canal vocal', 'Miembros del canal de voz', 'أعضاء القناة الصوتية'],
  'Kişiye Özel Ses Ayarı': ['Per-User Volume', 'Individuelle Lautstärke', 'Volume par utilisateur', 'Volumen por usuario', 'مستوى الصوت لكل مستخدم'],
  'Sessiz': ['Muted', 'Stumm', 'Muet', 'Silenciado', 'صامت'],
  'Canlı': ['Live', 'Live', 'En direct', 'En vivo', 'مباشر'],
  'Kapalı': ['Off', 'Aus', 'Fermé', 'Apagado', 'مغلق'],
  'Mikrofon kapalı': ['Microphone muted', 'Mikrofon stumm', 'Microphone coupé', 'Micrófono apagado', 'الميكروفون مكتوم'],
  'Konuşuyor...': ['Speaking...', 'Spricht...', 'Parle...', 'Hablando...', 'يتحدث...'],
  'Mikrofon açık (Beklemede)': ['Mic open (Standby)', 'Mikrofon offen (Bereit)', 'Micro ouvert (Attente)', 'Micrófono abierto (Espera)', 'الميكروفون مفتوح'],
  'Giriş:': ['Input:', 'Eingang:', 'Entrée :', 'Entrada:', 'الإدخال:'],
  'Ses:': ['Vol:', 'Lautst.:', 'Vol. :', 'Vol.:', 'الصوت:'],
  'Kısayol: M (Sustur)': ['Shortcut: M (Mute)', 'Kürzel: M (Stumm)', 'Raccourci : M (Muet)', 'Atajo: M (Silenciar)', 'اختصار: M (كتم)'],
  'D (Sağırlaştır)': ['D (Deafen)', 'D (Ton aus)', 'D (Sourdine)', 'D (Ensordecer)', 'D (كتم السماعة)'],
  '(Sen)': ['(You)', '(Du)', '(Vous)', '(Tú)', '(أنت)'],

  // Minimap & Canvas Footer
  'Mini Harita': ['Minimap', 'Minimap', 'Mini-carte', 'Minimapa', 'الخريطة المصغرة'],
  'Izgara': ['Grid', 'Raster', 'Grille', 'Cuadrícula', 'شبكة'],
  'Düzeni Kenetle': ['Dock Layout', 'Layout andocken', 'Ancrer la disposition', 'Acoplar diseño', 'إرساء التخطيط'],
  'Orta Tuş: Hızlı Seçim': ['Middle Click: Quick Radial', 'Mittelklick: Schnellwahl', 'Clic milieu : Menu rapide', 'Clic central: Menú rápido', 'الزر الأوسط: اختيار سريع'],

  // Settings Modal sections
  'Renk Teması Seçimi': ['Color Theme Selection', 'Farbschema-Auswahl', 'Choix du thème de couleur', 'Selección de tema de color', 'اختيار سمة الألوان'],
  'Açık Tema (Varsayılan)': ['Light Theme (Default)', 'Helles Design (Standard)', 'Thème clair (Défaut)', 'Tema claro (Predeterminado)', 'السمة الفاتحة (افتراضي)'],
  'Ferah beyaz yüzeyler ve net kontrastlı noktalı tuval': [
    'Clean white surfaces and crisp high-contrast dotted canvas',
    'Helle weiße Oberflächen und kontrastreiche Punkt-Leinwand',
    'Surfaces blanches épurées et canevas pointillé contrasté',
    'Superficies blancas limpias y lienzo punteado de alto contraste',
    'أسطح بيضاء مريحة ولوحة منقطة عالية التباين',
  ],
  'Koyu Tema (Dark)': ['Dark Theme', 'Dunkles Design (Dark)', 'Thème sombre (Dark)', 'Tema oscuro (Dark)', 'السمة الداكنة'],
  'Göz yormayan koyu arduvaz arayüz ve karanlık çalışma alanı': [
    'Eye-friendly dark slate interface and dark workspace',
    'Augenschonende dunkle Oberfläche und dunkler Arbeitsbereich',
    'Interface ardoise sombre reposante pour les yeux',
    'Interfaz oscura cómoda para la vista y espacio de trabajo oscuro',
    'واجهة داكنة مريحة للعين ومساحة عمل مظلمة',
  ],
  'Gece Mavisi (Midnight)': ['Midnight Blue', 'Mitternachtsblau (Midnight)', 'Bleu nuit (Midnight)', 'Azul medianoche (Midnight)', 'الأزرق الليلي'],
  'Derin uzay mavisi kontrastı, kodlama ve gece çalışmaları için ideal': [
    'Deep space-blue contrast, ideal for coding and night sessions',
    'Tiefblauer Kontrast, ideal zum Programmieren und für Nachtarbeit',
    'Contraste bleu profond, idéal pour le code et le travail de nuit',
    'Contraste azul profundo, ideal para programar y sesiones nocturnas',
    'تباين أزرق ليلي عميق مثالي للبرمجة والعمل الليلي',
  ],
  'Sıcak Kağıt / Mimarlık': ['Warm Paper / Architecture', 'Warmes Papier / Architektur', 'Papier chaud / Architecture', 'Papel cálido / Arquitectura', 'ورق دافئ / هندسي'],
  'Eskiz defteri dokusunda sıcak krem tuval ve yumuşak kontrast': [
    'Sketchbook-style warm cream canvas with soft contrast',
    'Warmes Creme-Papier im Skizzenbuch-Stil mit weichem Kontrast',
    'Canevas crème chaud style carnet de croquis à contraste doux',
    'Lienzo crema cálido estilo cuaderno de bocetos con contraste suave',
    'لوحة كريمية دافئة بطابع دفتر الرسم وتباين ناعم',
  ],
  'Beyaz Tahta Zemin Deseni': ['Whiteboard Background Pattern', 'Hintergrundmuster der Leinwand', 'Motif de fond du tableau', 'Patrón de fondo del tablero', 'نمط خلفية اللوحة'],
  'Noktalı Tuval': ['Dotted Canvas', 'Punktraster', 'Canevas pointillé', 'Lienzo punteado', 'لوحة منقطة'],
  'Klasik mimari nokta ızgarası': ['Classic architectural dot grid', 'Klassisches Architektur-Punktraster', 'Grille de points architecturale', 'Cuadrícula de puntos clásica', 'شبكة نقاط هندسية كلاسيكية'],
  'Kareli Izgara': ['Square Grid', 'Quadratraster', 'Grille quadrillée', 'Cuadrícula cuadrada', 'شبكة مربعات'],
  'Teknik çizim ve hizalama': ['Technical drawing and alignment', 'Technisches Zeichnen & Ausrichten', 'Dessin technique et alignement', 'Dibujo técnico y alineación', 'للرسم التقني والمحاذاة'],
  'Düz Zemin': ['Plain Background', 'Glatter Hintergrund', 'Fond uni', 'Fondo liso', 'خلفية سادة'],
  'Çizgisiz saf çalışma alanı': ['Pure line-free workspace', 'Reiner Arbeitsbereich ohne Linien', 'Espace pur sans lignes', 'Espacio puro sin líneas', 'مساحة عمل صافية بدون خطوط'],
  'Toplu Kutucuk İşlemleri': ['Bulk Widget Actions', 'Massenaktionen für Widgets', 'Actions groupées des widgets', 'Acciones masivas de widgets', 'إجراءات الأدوات الجماعية'],
  'Her Bir Kutucuğu Ayrı Yönet (Aç / Kapat)': [
    'Manage Each Widget Individually (On / Off)',
    'Jedes Widget einzeln verwalten (Ein / Aus)',
    'Gérer chaque widget individuellement (Ouvrir / Fermer)',
    'Gestionar cada widget individualmente (Abrir / Cerrar)',
    'إدارة كل أداة بشكل منفصل (تشغيل / إيقاف)',
  ],
  'Tek tek bağımsız kontrol': ['Independent per-widget control', 'Unabhängige Einzelsteuerung', 'Contrôle individuel indépendant', 'Control individual independiente', 'تحكم مستقل لكل أداة'],
  'Seç İmleci Çoklu Seçim Alanı (Marquee Box) Davranışı': [
    'Select Cursor Marquee Box Behavior',
    'Verhalten des Auswahlrahmens (Marquee Box)',
    'Comportement du cadre de sélection multiple',
    'Comportamiento del cuadro de selección múltiple',
    'سلوك مربع التحديد المتعدد',
  ],
  'Temas Eden Tüm Parçaları Seç (Önerilen)': [
    'Select All Touched / Intersecting Items (Recommended)',
    'Alle berührten Elemente auswählen (Empfohlen)',
    'Sélectionner tous les éléments touchés (Recommandé)',
    'Seleccionar todos los elementos tocados (Recomendado)',
    'تحديد جميع العناصر الملموسة (موصى به)',
  ],
  'Yalnızca Tamamen İçindekileri Seç': [
    'Select Only Fully Contained Items',
    'Nur vollständig eingeschlossene auswählen',
    'Sélectionner uniquement les éléments entièrement inclus',
    'Seleccionar solo los elementos completamente contenidos',
    'تحديد العناصر المحتواة بالكامل فقط',
  ],
  'Serbest Kalem Çizimlerini Otomatik Yumuşat': [
    'Auto-Smooth Freehand Pen Strokes',
    'Freihandzeichnungen automatisch glätten',
    'Lisser automatiquement les traits à main levée',
    'Suavizar automáticamente trazos a mano alzada',
    'تنعيم الخطوط الحرة تلقائيًا',
  ],
  'Diğer Kullanıcıların Canlı İmleçlerini Göster': [
    'Show Live Cursors of Other Users',
    'Live-Cursor anderer Benutzer anzeigen',
    'Afficher les curseurs en direct des autres utilisateurs',
    'Mostrar cursores en vivo de otros usuarios',
    'إظهار مؤشرات المستخدمين الآخرين مباشرة',
  ],
  'Arayüz & Bildirim Sesleri': ['Interface & Notification Sounds', 'Oberflächen- & Hinweistöne', 'Sons d’interface & notifications', 'Sonidos de interfaz y notificación', 'أصوات الواجهة والإشعارات'],
  'Klavye Kısayolları Rehberi': ['Keyboard Shortcuts Guide', 'Tastenkürzel-Übersicht', 'Guide des raccourcis clavier', 'Guía de atajos de teclado', 'دليل اختصارات لوحة المفاتيح'],
  'Tüm Ayarları Varsayılana Sıfırla': ['Reset All Settings to Default', 'Alle Einstellungen zurücksetzen', 'Réinitialiser tous les paramètres', 'Restablecer todos los ajustes', 'إعادة ضبط جميع الإعدادات للافتراضي'],

  // ChatDrawer, Notes, Files, Templates, AI, Export, Rooms, UserSetup
  'Oda Sohbeti': ['Room Chat', 'Raum-Chat', 'Discussion de salle', 'Chat de la sala', 'دردشة الغرفة'],
  'Genel Sohbet': ['General Chat', 'Allgemeiner Chat', 'Discussion générale', 'Chat general', 'الدردشة العامة'],
  'Özel Sohbet': ['Private Chat', 'Privater Chat', 'Discussion privée', 'Chat privado', 'دردشة خاصة'],
  'Özel Mesaj': ['Private Message', 'Private Nachricht', 'Message privé', 'Mensaje privado', 'رسالة خاصة'],
  'Mesajınızı yazın...': ['Type your message...', 'Nachricht eingeben...', 'Écrivez votre message...', 'Escribe tu mensaje...', 'اكتب رسالتك...'],
  'Gönder': ['Send', 'Senden', 'Envoyer', 'Enviar', 'إرسال'],
  'Mesajı Sil': ['Delete Message', 'Nachricht löschen', 'Supprimer le message', 'Eliminar mensaje', 'حذف الرسالة'],
  'Tahtayı Dışa / İçe Aktar': ['Export / Import Board', 'Board exportieren / importieren', 'Exporter / Importer le tableau', 'Exportar / Importar tablero', 'تصدير / استيراد اللوحة'],
  'Dışa Aktar (İndir)': ['Export (Download)', 'Exportieren (Herunterladen)', 'Exporter (Télécharger)', 'Exportar (Descargar)', 'تصدير (تنزيل)'],
  'İçe Aktar (Yükle)': ['Import (Upload)', 'Importieren (Hochladen)', 'Importer (Téléverser)', 'Importar (Subir)', 'استيراد (رفع)'],
  'Yapay Zeka (AI) İle Tahtada Çizim Oluştur': [
    'Generate Drawing on Board with AI',
    'Zeichnung mit KI auf dem Board erstellen',
    'Générer un dessin sur le tableau avec l’IA',
    'Generar dibujo en el tablero con IA',
    'إنشاء رسم على اللوحة بالذكاء الاصطناعي',
  ],
  'Oluştur ve Tahtaya Ekle': ['Generate & Add to Board', 'Erstellen & zum Board hinzufügen', 'Générer et ajouter au tableau', 'Generar y añadir al tablero', 'إنشاء وإضافة إلى اللوحة'],

  // OnboardingTour.tsx (Interactive Tour)
  'Adım 1 / 5 · Hoş Geldiniz': [
    'Step 1 / 5 · Welcome',
    'Schritt 1 / 5 · Willkommen',
    'Étape 1 / 5 · Bienvenue',
    'Paso 1 / 5 · Bienvenida',
    'الخطوة 1 / 5 · مرحباً بك',
  ],
  'CollabBoard Ortak Çalışma Tahtasına Hoş Geldiniz!': [
    'Welcome to the CollabBoard Collaborative Whiteboard!',
    'Willkommen auf dem CollabBoard Kollaborations-Board!',
    'Bienvenue sur le tableau collaboratif CollabBoard !',
    '¡Bienvenido a la pizarra colaborativa CollabBoard!',
    'مرحباً بك في لوحة العمل التشاركية CollabBoard!',
  ],
  'Yeni kaligrafik CB kimliğimiz ve geliştirilmiş gerçek zamanlı çalışma alanımızla ekip arkadaşlarınızla çizim yapabilir, diyagramlar kurabilir, ortak kod derleyebilir ve sesli görüşebilirsiniz.': [
    'With our calligraphic CB identity and enhanced real-time workspace, you can draw with teammates, build diagrams, compile collaborative code, and talk on the voice channel.',
    'Mit unserer kalligrafischen CB-Identität und dem Echtzeit-Arbeitsbereich können Sie im Team zeichnen, Diagramme erstellen, gemeinsam Code ausführen und per Sprachkanal sprechen.',
    'Grâce à notre identité calligraphique CB et notre espace temps réel amélioré, dessinez en équipe, créez des diagrammes, compilez du code collaboratif et discutez en vocal.',
    'Con nuestra identidad caligráfica CB y el espacio en tiempo real mejorado, puedes dibujar en equipo, crear diagramas, compilar código colaborativo y hablar por voz.',
    'مع هويتنا الخطية الجديدة ومساحة العمل الفورية المطورة، يمكنك الرسم مع فريقك وإنشاء المخططات وتشغيل الأكواد المشتركة والتحدث صوتياً.',
  ],
  'Sonsuz tuval üzerinde Boşluk (Space) + Sürükle veya Orta Tuş ile gezinebilirsiniz.': [
    'Pan across the infinite canvas using Spacebar + Drag or the Middle Mouse Button.',
    'Bewegen Sie sich mit Leertaste + Ziehen oder der mittleren Maustaste über die unendliche Leinwand.',
    'Déplacez-vous sur le canevas infini avec Espace + Glisser ou le bouton central de la souris.',
    'Desplázate por el lienzo infinito usando Espacio + Arrastrar o el botón central del ratón.',
    'تنقل عبر اللوحة اللانهائية باستخدام مفتاح المسافة (Space) + السحب أو زر الفأرة الأوسط.',
  ],
  'Sağ üstteki "Tanıtım Turu" butonuna tıklayarak bu rehberi istediğiniz zaman yeniden açabilirsiniz.': [
    'You can reopen this guide anytime by clicking the "Tour" button at the top right.',
    'Sie können diese Anleitung jederzeit über die Schaltfläche „Tour“ oben rechts erneut öffnen.',
    'Vous pouvez rouvrir ce guide à tout moment en cliquant sur le bouton « Visite » en haut à droite.',
    'Puedes volver a abrir esta guía en cualquier momento haciendo clic en el botón "Tour" arriba a la derecha.',
    'يمكنك إعادة فتح هذا الدليل في أي وقت بالنقر على زر "جولة تعريفية" في أعلى اليمين.',
  ],
  'Adım 2 / 5 · Çizim & Google Fonts Tipografisi': [
    'Step 2 / 5 · Drawing & Google Fonts Typography',
    'Schritt 2 / 5 · Zeichnen & Google Fonts Typografie',
    'Étape 2 / 5 · Dessin & Typographie Google Fonts',
    'Paso 2 / 5 · Dibujo y tipografía Google Fonts',
    'الخطوة 2 / 5 · الرسم وخطوط Google Fonts',
  ],
  'Zengin Araç Çubuğu & Gelişmiş Metin Seçenekleri': [
    'Rich Toolbar & Advanced Text Options',
    'Umfangreiche Werkzeugleiste & Textoptionen',
    'Barre d’outils riche & options de texte avancées',
    'Barra de herramientas rica y opciones de texto avanzadas',
    'شريط أدوات غني وخيارات نصوص متقدمة',
  ],
  'Alt araç çubuğundan Seçim (V), Kalem (P), Şekiller, Yapışkan Not (S) ve Metin (T) araçlarına anında erişebilirsiniz. Metin eklerken doğrudan kutunun üzerinde yüzen hızlı font çubuğu açılır!': [
    'Instantly access Select (V), Pen (P), Shapes, Sticky Note (S), and Text (T) tools from the bottom toolbar. When adding text, a floating quick-font bar opens right above the box!',
    'Greifen Sie über die untere Leiste sofort auf Auswahl (V), Stift (P), Formen, Haftnotiz (S) und Text (T) zu. Beim Schreiben öffnet sich direkt über dem Feld eine schwebende Schriftleiste!',
    'Accédez instantanément aux outils Sélection (V), Stylo (P), Formes, Note (S) et Texte (T) depuis la barre inférieure. Une barre de police flottante s’ouvre au-dessus du texte !',
    'Accede al instante a Selección (V), Lápiz (P), Formas, Nota adhesiva (S) y Texto (T) desde la barra inferior. ¡Al escribir se abre una barra flotante de fuentes sobre el cuadro!',
    'وصول فوري لأدوات التحديد (V) والقلم (P) والأشكال والملاحظات اللاصقة (S) والنص (T) من الشريط السفلي، مع شريط خطوط عائم يظهر مباشرة فوق النص!',
  ],
  'Google Fonts: Plus Jakarta Sans, Playfair Display, Caveat, Dancing Script, Space Grotesk, Oswald, Merriweather ve JetBrains Mono.': [
    'Google Fonts: Plus Jakarta Sans, Playfair Display, Caveat, Dancing Script, Space Grotesk, Oswald, Merriweather, and JetBrains Mono.',
    'Google Fonts: Plus Jakarta Sans, Playfair Display, Caveat, Dancing Script, Space Grotesk, Oswald, Merriweather und JetBrains Mono.',
    'Google Fonts : Plus Jakarta Sans, Playfair Display, Caveat, Dancing Script, Space Grotesk, Oswald, Merriweather et JetBrains Mono.',
    'Google Fonts: Plus Jakarta Sans, Playfair Display, Caveat, Dancing Script, Space Grotesk, Oswald, Merriweather y JetBrains Mono.',
    'خطوط Google Fonts: Plus Jakarta Sans وPlayfair Display وCaveat وDancing Script وSpace Grotesk وOswald وMerriweather وJetBrains Mono.',
  ],
  '12px ile 96px arasında 13 farklı font boyutu, Kalın (B), İtalik (I) ve Hizalama seçenekleri.': [
    '13 font sizes from 12px to 96px, plus Bold (B), Italic (I), and Alignment options.',
    '13 Schriftgrößen von 12px bis 96px sowie Fett (B), Kursiv (I) und Ausrichtungsoptionen.',
    '13 tailles de police de 12px à 96px, ainsi que les options Gras (B), Italique (I) et Alignement.',
    '13 tamaños de fuente de 12px a 96px, además de opciones de Negrita (B), Cursiva (I) y Alineación.',
    '13 حجماً مختلفاً للخط من 12px إلى 96px، مع خيارات عريض (B) ومائل (I) والمحاذاة.',
  ],
  'Şimdi Metin Aracını (T) Aktifleştir ve Fontları Gör': [
    'Activate Text Tool (T) Now & Explore Fonts',
    'Textwerkzeug (T) jetzt aktivieren & Schriften ansehen',
    'Activer l’outil Texte (T) et voir les polices',
    'Activar herramienta de texto (T) y ver fuentes',
    'فعّل أداة النص (T) الآن واستعرض الخطوط',
  ],
  'Adım 3 / 5 · Hızlı Erişim & Mini Harita': [
    'Step 3 / 5 · Quick Access & Minimap',
    'Schritt 3 / 5 · Schnellzugriff & Minimap',
    'Étape 3 / 5 · Accès rapide & Mini-carte',
    'Paso 3 / 5 · Acceso rápido y Minimapa',
    'الخطوة 3 / 5 · الوصول السريع والخريطة المصغرة',
  ],
  'Sağ Tık Radyal Menü, Canlı Önizleme & Mini Harita': [
    'Quick Radial Menu, Live Preview & Minimap',
    'Radiales Schnellmenü, Live-Vorschau & Minimap',
    'Menu radial rapide, Aperçu en direct & Mini-carte',
    'Menú radial rápido, Vista previa y Minimapa',
    'القائمة الدائرية السريعة والمعاينة الحية والخريطة المصغرة',
  ],
  'Tahtanın herhangi bir yerinde Sağ Tık yaparak dairesel hızlı araç menüsünü açabilir, sol alt köşedeki Mini Harita (Minimap) ile tüm çizimleri kuşbakışı görüp tek tıkla istediğiniz bölgeye odaklanabilirsiniz.': [
    'Open the circular quick-tool menu anywhere on the board, and use the Minimap at the bottom-left to view the entire board from above and jump to any area in one click.',
    'Öffnen Sie überall auf dem Board das kreisförmige Schnellmenü und nutzen Sie die Minimap unten links für eine Vogelperspektive und den Sofortsprung zu jedem Bereich.',
    'Ouvrez le menu circulaire rapide n’importe où sur le tableau et utilisez la Mini-carte en bas à gauche pour avoir une vue d’ensemble et cibler une zone en un clic.',
    'Abre el menú circular rápido en cualquier parte del tablero y usa el Minimapa abajo a la izquierda para ver todo el lienzo y enfocar cualquier zona con un clic.',
    'افتح قائمة الأدوات الدائرية السريعة في أي مكان على اللوحة، واستخدم الخريطة المصغرة أسفل اليسار لرؤية جميع الرسومات والانتقال لأي منطقة بنقرة واحدة.',
  ],
  'Tahtada Sağ Tık: Fırça, Metin, Not, Şekil, Lazer ve AI Çizim araçlarına imlecinizi uzaklaştırmadan ulaşın.': [
    'Quick Radial Menu: Reach Pen, Text, Note, Shape, Laser, and AI Draw tools without moving your cursor away.',
    'Schnellmenü: Erreichen Sie Stift, Text, Notiz, Form, Laser und KI-Zeichnung direkt unter dem Cursor.',
    'Menu rapide : Accédez aux outils Stylo, Texte, Note, Forme, Laser et Dessin IA sans éloigner votre curseur.',
    'Menú rápido: Accede a Lápiz, Texto, Nota, Forma, Láser y Dibujo IA sin alejar el cursor.',
    'الوصول السريع: اصل إلى أدوات الفرشاة والنص والملاحظات والأشكال والليزر والرسم الذكي دون إبعاد المؤشر.',
  ],
  'Mini Harita: Üzerine tıklayarak veya sürükleyerek büyük diyagramlarda anında gezin.': [
    'Minimap: Click or drag inside the minimap to navigate across large diagrams instantly.',
    'Minimap: Klicken oder ziehen Sie in der Minimap, um sofort durch große Diagramme zu navigieren.',
    'Mini-carte : Cliquez ou glissez dessus pour naviguer instantanément dans les grands diagrammes.',
    'Minimapa: Haz clic o arrastra sobre él para navegar al instante por grandes diagramas.',
    'الخريطة المصغرة: انقر أو اسحب داخلها للتنقل فوراً عبر المخططات الكبيرة.',
  ],
  'Adım 4 / 5 · Çok Kullanıcılı Kod Editörü': [
    'Step 4 / 5 · Multi-User Code Editor',
    'Schritt 4 / 5 · Mehrbenutzer-Code-Editor',
    'Étape 4 / 5 · Éditeur de code multi-utilisateurs',
    'Paso 4 / 5 · Editor de código multiusuario',
    'الخطوة 4 / 5 · محرر الأكواد التشاركي',
  ],
  'Canlı İmleçli Ortak Kod Editörü & Derleyici': [
    'Collaborative Code Editor & Compiler with Live Cursors',
    'Kollaborativer Code-Editor & Compiler mit Live-Cursorn',
    'Éditeur de code collaboratif & compilateur avec curseurs en direct',
    'Editor de código colaborativo y compilador con cursores en vivo',
    'محرر ومترجم أكواد تشاركي مع مؤشرات حية',
  ],
  'Üst menüdeki "Kod" sekmesiyle odadaki tüm kullanıcılar aynı anda kod yazabilir, birbirlerinin hangi satır ve sütunda olduğunu renkli canlı imleçlerle görebilir ve 10 dilde kodu derleyip çalıştırabilir.': [
    'With the "Code" tab in the top bar, everyone in the room can write code simultaneously, see each other’s line and column with colored live cursors, and compile & run code in 10 languages.',
    'Über den Reiter „Code“ in der oberen Leiste können alle im Raum gleichzeitig programmieren, Live-Cursor in Farbe sehen und Code in 10 Sprachen kompilieren und ausführen.',
    'Avec l’onglet « Code » du menu supérieur, tous les participants peuvent coder simultanément, voir les curseurs colorés en direct et compiler du code dans 10 langages.',
    'Con la pestaña "Código" del menú superior, todos en la sala pueden programar a la vez, ver cursores en vivo de colores y compilar y ejecutar código en 10 lenguajes.',
    'من خلال تبويب "الكود" في الشريط العلوي، يمكن لجميع المستخدمين في الغرفة كتابة الكود معاً ورؤية المؤشرات الحية الملونة وتشغيل الكود بـ 10 لغات.',
  ],
  'Diğer kullanıcıların aktif satırı kendi renkleriyle vurgulanır ve imleç üzerinde isim etiketi görünür.': [
    'Other users’ active lines are highlighted in their own color with a name badge above their cursor.',
    'Die aktive Zeile anderer Nutzer wird farblich hervorgehoben und zeigt ein Namensschild am Cursor.',
    'La ligne active des autres utilisateurs est surlignée dans leur couleur avec leur nom sur le curseur.',
    'La línea activa de otros usuarios se resalta con su color y muestra su nombre sobre el cursor.',
    'يتم تمييز السطر النشط للمستخدمين الآخرين بألوانهم الخاصة مع ظهور شارة الاسم فوق المؤشر.',
  ],
  'Kullanıcı etiketine tıklayarak doğrudan o kişinin yazdığı satıra odaklanabilirsiniz.': [
    'Click on any user badge to jump directly to the line that person is editing.',
    'Klicken Sie auf ein Benutzerschild, um direkt zur Zeile dieser Person zu springen.',
    'Cliquez sur le badge d’un utilisateur pour centrer directement la ligne qu’il modifie.',
    'Haz clic en la etiqueta de un usuario para enfocar directamente la línea que está escribiendo.',
    'انقر على شارة أي مستخدم للتركيز مباشرة على السطر الذي يكتب فيه.',
  ],
  'Ortak Kod Editörünü Önizle': [
    'Preview Collaborative Code Editor',
    'Kollaborativen Code-Editor testen',
    'Prévisualiser l’éditeur de code collaboratif',
    'Previsualizar el editor de código colaborativo',
    'معاينة محرر الأكواد التشاركي',
  ],
  'Adım 5 / 5 · QR Kod & GitHub Pages Paylaşımı': [
    'Step 5 / 5 · QR Code & Instant Sharing',
    'Schritt 5 / 5 · QR-Code & Sofort-Teilen',
    'Étape 5 / 5 · Code QR & Partage instantané',
    'Paso 5 / 5 · Código QR y uso compartido instantáneo',
    'الخطوة 5 / 5 · رمز QR والمشاركة الفورية',
  ],
  'QR Kod ve Bağlantı İle Anında Ekip Daveti': [
    'Instant Team Invite via QR Code & Link',
    'Sofortige Team-Einladung per QR-Code & Link',
    'Invitation d’équipe instantanée par QR code & lien',
    'Invitación instantánea al equipo con código QR y enlace',
    'دعوة الفريق فوراً عبر رمز QR والرابط',
  ],
  'Sağ üstteki "Davet Et" butonu ile odanızın doğrudan bağlantısını veya QR kodunu paylaşarak telefon, tablet veya farklı bilgisayarlardaki arkadaşlarınızı anında aynı odaya davet edebilirsiniz.': [
    'Use the "Invite" button at the top right to share your room’s direct link or QR code and invite teammates on phones, tablets, or other computers into the same room instantly.',
    'Teilen Sie über „Einladen“ oben rechts den Direktlink oder QR-Code Ihres Raums, um Teammitglieder auf Smartphone, Tablet oder PC sofort in denselben Raum einzuladen.',
    'Utilisez le bouton « Inviter » en haut à droite pour partager le lien direct ou le QR code de votre salle et inviter instantanément vos collègues sur mobile, tablette ou PC.',
    'Usa el botón "Invitar" arriba a la derecha para compartir el enlace directo o el código QR de tu sala e invitar al instante a amigos desde móvil, tablet u ordenador.',
    'باستخدام زر "دعوة" أعلى اليمين، شارك الرابط المباشر للغرفة أو رمز QR لدعوة أصدقائك من الهاتف أو الجهاز اللوحي أو الحاسوب إلى نفس الغرفة فوراً.',
  ],
  'GitHub Pages ve tüm cihazlarla tam uyumlu sunucusuz gerçek zamanlı senkronizasyon.': [
    'Real-time multi-device synchronization fully compatible across desktop, tablet, and mobile browsers.',
    'Echtzeit-Synchronisation, voll kompatibel mit allen Desktop-, Tablet- und Mobil-Browsern.',
    'Synchronisation en temps réel compatible avec tous les appareils et navigateurs.',
    'Sincronización en tiempo real totalmente compatible con todos los dispositivos y navegadores.',
    'مزامنة فورية متوافقة تماماً مع جميع الأجهزة والمتصفحات.',
  ],
  'İsterseniz mevcut tahta çizimlerini davet linkine gömerek tek tıkla aktarabilirsiniz.': [
    'You can also embed current board drawings into the invite link or place the QR card directly on the canvas.',
    'Sie können aktuelle Zeichnungen auch direkt in den Einladungslink einbetten oder die QR-Karte aufs Board setzen.',
    'Vous pouvez également intégrer les dessins actuels dans le lien d’invitation ou poser le QR code sur le tableau.',
    'También puedes incrustar los dibujos actuales en el enlace de invitación o pegar el QR en el tablero.',
    'يمكنك أيضاً تضمين رسومات اللوحة الحالية في رابط الدعوة أو لصق بطاقة QR على اللوحة بنقرة واحدة.',
  ],
  'Davet & QR Kod Penceresini Aç': [
    'Open Invite & QR Code Modal',
    'Einladungs- & QR-Code-Fenster öffnen',
    'Ouvrir la fenêtre d’invitation & QR code',
    'Abrir ventana de invitación y código QR',
    'فتح نافذة الدعوة ورمز QR',
  ],
  'Turu Kapat': [
    'Close Tour',
    'Tour schließen',
    'Fermer la visite',
    'Cerrar tour',
    'إغلاق الجولة',
  ],
  '1. Esnek Kutucuklar & Tahta Düzeni': [
    '1. Flexible Widgets & Board Layout',
    '1. Flexible Widgets & Board-Layout',
    '1. Widgets flexibles & disposition du tableau',
    '1. Widgets flexibles y diseño del tablero',
    '1. الأدوات المرنة وتخطيط اللوحة',
  ],
  'Esnek Arayüz & Kontroller': [
    'Flexible UI & Controls',
    'Flexible Oberfläche & Steuerung',
    'Interface & contrôles flexibles',
    'Interfaz y controles flexibles',
    'واجهة مرنة وعناصر تحكم',
  ],
  'Tahtadaki 6 ana kutucuğun (Araç Çubuğu, Stil & Renk, Sesli Kanal, Mini Harita, Dijital Saat ve Dosya Klasörü) tamamını dilediğiniz yere sürükleyebilir, göz ikonuyla küçültebilir veya Üst Bar\'daki "Kutucuklar" menüsünden yönetebilirsiniz.': [
    'You can drag all 6 floating widgets (Toolbar, Style & Color, Voice Channel, Minimap, Digital Clock, and File Folder) anywhere on the board, minimize them with the eye icon, or manage them from the "Widgets" menu in the Top Bar.',
    'Sie können alle 6 Widgets (Werkzeugleiste, Stil & Farbe, Sprachkanal, Minimap, Digitaluhr und Dateiordner) frei verschieben, per Augensymbol minimieren oder über das Menü „Widgets“ in der oberen Leiste verwalten.',
    'Vous pouvez déplacer les 6 widgets (Barre d’outils, Style & Couleur, Canal vocal, Mini-carte, Horloge numérique et Dossier de fichiers), les réduire avec l’icône œil ou les gérer depuis le menu « Widgets ».',
    'Puedes arrastrar los 6 widgets (Barra de herramientas, Estilo y color, Canal de voz, Minimapa, Reloj digital y Carpeta de archivos), minimizarlos con el icono del ojo o gestionarlos desde el menú "Widgets".',
    'يمكنك سحب جميع الأدوات الست إلى أي مكان على اللوحة، أو تصغيرها بأيقونة العين، أو إدارتها من قائمة "الأدوات" في الشريط العلوي.',
  ],
  'Ayarlar (⚙️) menüsünden Açık, Koyu (Dark), Gece Mavisi ve Sıcak Kağıt temaları arasında geçiş yapabilir; noktalı, kareli veya düz zemin seçebilirsiniz.': [
    'Switch between Light, Dark, Midnight Blue, and Warm Paper themes in Settings (⚙️), and choose dotted, grid, or plain canvas backgrounds.',
    'Wechseln Sie in den Einstellungen (⚙️) zwischen Hell, Dunkel, Mitternachtsblau und Warmem Papier sowie zwischen Punkt-, Raster- oder glattem Hintergrund.',
    'Changez de thème (Clair, Sombre, Bleu nuit, Papier chaud) dans les Paramètres (⚙️) et choisissez un fond pointillé, quadrillé ou uni.',
    'Cambia entre los temas Claro, Oscuro, Azul medianoche y Papel cálido en Ajustes (⚙️), y elige fondo punteado, cuadrícula o liso.',
    'بدّل بين السمات الفاتحة والداكنة والأزرق الليلي والورق الدافئ من الإعدادات (⚙️)، واختر خلفية منقطة أو شبكية أو سادة.',
  ],
  'Sol alttaki "Düzeni Kenetle" butonuyla dağılan tüm kutucukları tek tıkla varsayılan hizasına geri toplayabilirsiniz.': [
    'Click "Dock Layout" at the bottom-left to snap all scattered widgets back to their default positions in one click.',
    'Mit „Layout andocken“ unten links bringen Sie alle verteilten Widgets mit einem Klick in ihre Standardposition zurück.',
    'Cliquez sur « Ancrer la disposition » en bas à gauche pour réaligner tous les widgets en un clic.',
    'Haz clic en "Acoplar diseño" abajo a la izquierda para devolver todos los widgets a su posición predeterminada.',
    'انقر على "إرساء التخطيط" أسفل اليسار لإعادة جميع الأدوات إلى مواضعها الافتراضية بنقرة واحدة.',
  ],
  'Sol alttaki Mini Harita üzerinden büyük çizimlerde anında gezinebilir ve tüm öğeleri ekrana sığdırabilirsiniz.': [
    'Navigate large boards instantly and fit all elements to the screen using the Minimap at the bottom-left.',
    'Navigieren Sie über die Minimap unten links sofort durch große Zeichnungen und passen Sie alle Elemente an den Bildschirm an.',
    'Naviguez instantanément sur de grands tableaux et ajustez tous les éléments à l’écran grâce à la Mini-carte en bas à gauche.',
    'Navega al instante por tableros grandes y ajusta todos los elementos a la pantalla con el Minimapa abajo a la izquierda.',
    'تنقل فوراً في اللوحات الكبيرة وقم بملاءمة جميع العناصر للشاشة باستخدام الخريطة المصغرة أسفل اليسار.',
  ],
  '2. Zengin Çizim & Diyagram Araçları': [
    '2. Rich Drawing & Diagram Tools',
    '2. Umfangreiche Zeichen- & Diagrammwerkzeuge',
    '2. Outils riches de dessin & diagramme',
    '2. Herramientas ricas de dibujo y diagramas',
    '2. أدوات الرسم والمخططات الغنية',
  ],
  '27 Vektörel Şekil & Çift Silgi': [
    '27 Vector Shapes & Dual Erasers',
    '27 Vektorformen & Doppelradierer',
    '27 formes vectorielles & double gomme',
    '27 formas vectoriales y doble borrador',
    '27 شكلاً متجهاً وممحاة مزدوجة',
  ],
  'Araç çubuğundaki gelişmiş çizim araçlarıyla serbest eskizlerden teknik akış diyagramlarına kadar her şeyi çizebilirsiniz.': [
    'Draw everything from freehand sketches to technical flowcharts with the advanced tools in the toolbar.',
    'Zeichnen Sie mit den Werkzeugen der Symbolleiste alles von Freihandskizzen bis zu technischen Flussdiagrammen.',
    'Dessinez tout, des croquis à main levée aux organigrammes techniques, grâce aux outils avancés de la barre d’outils.',
    'Dibuja desde bocetos libres hasta diagramas de flujo técnicos con las herramientas avanzadas de la barra.',
    'ارسم كل شيء من الرسومات الحرة إلى المخططات الانسيابية التقنية باستخدام الأدوات المتقدمة في شريط الأدوات.',
  ],
  '27 Vektörel Şekil: Temel geometrik şekiller, akış diyagramları, UML sembolleri, 3B küp/silindir ve konuşma balonları.': [
    '27 Vector Shapes: Basic geometric shapes, flowcharts, UML symbols, 3D cube/cylinder, and callout bubbles.',
    '27 Vektorformen: Geometrische Grundformen, Flussdiagramme, UML-Symbole, 3D-Würfel/-Zylinder und Sprechblasen.',
    '27 formes vectorielles : Formes géométriques, organigrammes, symboles UML, cube/cylindre 3D et bulles.',
    '27 formas vectoriales: Formas geométricas, diagramas de flujo, símbolos UML, cubo/cilindro 3D y bocadillos.',
    '27 شكلاً متجهاً: أشكال هندسية أساسية، مخططات انسيابية، رموز UML، مكعب/أسطوانة ثلاثية الأبعاد وفقاعات كلام.',
  ],
  'Çift Modlu Silgi (E / Shift+E): Öğe Silgisi dokunulan şekli tek hamlede siler; Hassas Silgi ise çizgileri dokunduğu yerden keserek böler.': [
    'Dual-Mode Eraser (E / Shift+E): Object Eraser deletes whole shapes in one tap; Precision Eraser slices through freehand strokes.',
    'Doppel-Radierer (E / Shift+E): Der Objektradierer löscht ganze Formen; der Präzisionsradierer teilt Freihandlinien exakt.',
    'Gomme double mode (E / Shift+E) : La gomme d’objet supprime la forme entière ; la gomme de précision découpe les traits.',
    'Borrador dual (E / Shift+E): El borrador de objetos elimina formas enteras; el borrador de precisión divide trazos libres.',
    'ممحاة مزدوجة (E / Shift+E): ممحاة العناصر تحذف الشكل بالكامل؛ والممحاة الدقيقة تقسم الخطوط الحرة.',
  ],
  'Farenin orta tekerlek tuşuna (Middle Click) basılı tutarak Hızlı Radyal Araç Menüsünü imlecinizin altında açabilirsiniz!': [
    'Hold the middle mouse wheel button (Middle Click) anywhere on the canvas to open the Quick Radial Tool Menu right under your cursor!',
    'Halten Sie die mittlere Maustaste (Mittelklick) gedrückt, um das radiale Schnellwahlmenü direkt unter dem Cursor zu öffnen!',
    'Maintenez le bouton central de la souris (Clic milieu) pour ouvrir le menu radial rapide sous votre curseur !',
    '¡Mantén pulsado el botón central del ratón (Clic central) para abrir el menú radial rápido bajo el cursor!',
    'اضغط مطولاً على زر الفأرة الأوسط لفتح قائمة الأدوات الدائرية السريعة تحت المؤشر مباشرة!',
  ],
  '3. Yapay Zeka (AI) Çizim & Hazır Şablonlar': [
    '3. AI Drawing & Ready Templates',
    '3. KI-Zeichnung & Fertige Vorlagen',
    '3. Dessin IA & Modèles prêts à l’emploi',
    '3. Dibujo con IA y plantillas listas',
    '3. الرسم بالذكاء الاصطناعي والقوالب الجاهزة',
  ],
  'Akıllı Üretim Araçları': [
    'Smart Generation Tools',
    'Intelligente Erstellungswerkzeuge',
    'Outils de génération intelligents',
    'Herramientas de generación inteligente',
    'أدوات الإنشاء الذكية',
  ],
  'Boş bir tahtayla vakit kaybetmeyin: Yapay zeka ile saniyeler içinde diyagramlar üretin veya profesyonel şablonları yükleyin.': [
    'Don’t start from a blank board: generate diagrams in seconds with AI or load professional templates.',
    'Starten Sie nicht bei null: Erstellen Sie in Sekunden Diagramme mit KI oder laden Sie professionelle Vorlagen.',
    'Ne partez pas d’une page blanche : générez des diagrammes en quelques secondes avec l’IA ou chargez des modèles professionnels.',
    'No empieces desde cero: genera diagramas en segundos con IA o carga plantillas profesionales.',
    'لا تبدأ من لوحة فارغة: أنشئ مخططات في ثوانٍ بالذكاء الاصطناعي أو حمّل قوالب احترافية.',
  ],
  'AI Çizim: İstediğiniz çizimi veya mimari şemayı yazın; 4 farklı düşünme seviyesinden (10 sn Hızlı Taslak\'tan 1 dk Başyapıt\'a) birini seçerek tahtaya ekleyin.': [
    'AI Draw: Describe any drawing or architecture diagram and pick from 4 thinking stages (from 10s Quick Draft to 1m Masterpiece).',
    'KI-Zeichnung: Beschreiben Sie Ihre Zeichnung oder Ihr Diagramm und wählen Sie aus 4 Detailstufen (von 10 Sek. Entwurf bis 1 Min. Meisterwerk).',
    'Dessin IA : Décrivez votre dessin ou schéma et choisissez parmi 4 niveaux de détail (du brouillon 10 s au chef-d’œuvre 1 min).',
    'Dibujo IA: Describe tu dibujo o diagrama y elige entre 4 niveles de detalle (desde borrador de 10 s hasta obra maestra de 1 min).',
    'الرسم الذكي: صف الرسم أو المخطط المطلوب واختر من بين 4 مستويات تفكير لإضافته إلى اللوحة.',
  ],
  'Şablonlar: Beyin Fırtınası, Kanban Panosu, Sistem Mimarisi veya Kullanıcı Akışı şablonlarını mevcut çalışmanıza ekleyin.': [
    'Templates: Append Brainstorming, Kanban Board, System Architecture, or User Flow templates directly to your board.',
    'Vorlagen: Fügen Sie Brainstorming-, Kanban-, Systemarchitektur- oder User-Flow-Vorlagen direkt zu Ihrem Board hinzu.',
    'Modèles : Ajoutez des modèles de Brainstorming, Kanban, Architecture système ou Flux utilisateur à votre tableau.',
    'Plantillas: Añade plantillas de Lluvia de ideas, Kanban, Arquitectura de sistemas o Flujo de usuario a tu tablero.',
    'القوالب: أضف قوالب العصف الذهني أو كانبان أو هندسة النظام أو تدفق المستخدم إلى لوحتك.',
  ],
  'Kod: Entegre kod editörü ile JavaScript/TypeScript ve Python kodlarını odadaki herkesle birlikte yazıp anında çalıştırın.': [
    'Code: Write and execute JavaScript/TypeScript and Python code live with everyone in the room using the built-in code sandbox.',
    'Code: Schreiben und starten Sie JavaScript/TypeScript- und Python-Code gemeinsam im integrierten Code-Editor.',
    'Code : Écrivez et exécutez du code JavaScript/TypeScript et Python en direct avec toute la salle.',
    'Código: Escribe y ejecuta código JavaScript/TypeScript y Python en vivo con todos en la sala.',
    'الكود: اكتب وشغّل أكواد JavaScript/TypeScript وPython مباشرة مع جميع أعضاء الغرفة.',
  ],
  '4. Gerçek Zamanlı Sesli Kanal, Sohbet & Dosyalar': [
    '4. Real-Time Voice Channel, Chat & Files',
    '4. Echtzeit-Sprachkanal, Chat & Dateien',
    '4. Canal vocal en temps réel, discussion & fichiers',
    '4. Canal de voz en tiempo réel, chat y archivos',
    '4. القناة الصوتية المباشرة والدردشة والملفات',
  ],
  'Canlı Ekip İletişimi': [
    'Live Team Communication',
    'Live-Teamkommunikation',
    'Communication d’équipe en direct',
    'Comunicación de equipo en vivo',
    'تواصل الفريق المباشر',
  ],
  'Harici bir uygulamaya ihtiyaç duymadan tahta üzerinde ekibinizle konuşun, mesajlaşın ve zengin belgeler paylaşın.': [
    'Talk, chat, and share rich documents with your team right on the board without needing external apps.',
    'Sprechen, chatten und teilen Sie Dokumente direkt auf dem Board – ganz ohne externe Zusatzprogramme.',
    'Parlez, discutez et partagez des documents directement sur le tableau sans application externe.',
    'Habla, chatea y comparte documentos directamente en el tablero sin necesidad de aplicaciones externas.',
    'تحدث وتراسل وشارك المستندات مع فريقك مباشرة على اللوحة دون الحاجة لتطبيقات خارجية.',
  ],
  'Sesli Kanal (WebRTC): Mikrofon (M) ve sağırlaştırma (D) kısayollarıyla konuşun; her katılımcının ses seviyesini ayrı ayrı ayarlayın.': [
    'Voice Channel (WebRTC): Talk using microphone (M) and deafen (D) shortcuts, and adjust each participant’s volume individually.',
    'Sprachkanal (WebRTC): Nutzen Sie Mikrofon- (M) und Stummschalt-Kürzel (D) und passen Sie die Lautstärke jedes Teilnehmers einzeln an.',
    'Canal vocal (WebRTC) : Utilisez les raccourcis micro (M) et sourdine (D), et réglez le volume de chaque participant.',
    'Canal de voz (WebRTC): Usa los atajos de micrófono (M) y silencio (D), y ajusta el volumen de cada participante.',
    'القناة الصوتية (WebRTC): تحدث باستخدام اختصارات الميكروفون (M) وكتم الصوت (D)، واضبط مستوى صوت كل مشارك.',
  ],
  'Dosyalar & Ortak Notlar: Markdown (.md), PDF, görsel ve videoları (maks. 3 dk) odaya yükleyip doğrudan tuvale kart olarak sürükleyin.': [
    'Files & Shared Notes: Upload Markdown (.md), PDF, images, and videos (up to 3 min) and drag them directly onto the canvas as cards.',
    'Dateien & Notizen: Laden Sie Markdown (.md), PDFs, Bilder und Videos (max. 3 Min.) hoch und ziehen Sie sie direkt als Karten aufs Board.',
    'Fichiers & Notes : Importez Markdown (.md), PDF, images et vidéos (max. 3 min) et glissez-les directement sur le canevas.',
    'Archivos y Notas: Sube Markdown (.md), PDF, imágenes y vídeos (máx. 3 min) y arrástralos directamente al lienzo.',
    'الملفات والملاحظات المشتركة: ارفع ملفات Markdown وPDF والصور والفيديو واسحبها مباشرة إلى اللوحة.',
  ],
  'Sohbet & Canlı Emoji: Mesajlara emoji tepkisi bırakın, animasyonlu GIF gönderin veya alt bardan ekrana canlı emoji uçurun.': [
    'Chat & Live Emoji: React to messages with emojis, send animated GIFs, or launch live floating emoji bursts across the screen.',
    'Chat & Live-Emojis: Reagieren Sie mit Emojis auf Nachrichten, senden Sie GIFs oder lassen Sie Live-Emojis über das Board fliegen.',
    'Discussion & Émojis : Réagissez aux messages, envoyez des GIF animés ou lancez des émojis en direct sur l’écran.',
    'Chat y Emojis en vivo: Reacciona a los mensajes, envía GIFs animados o lanza emojis flotantes en vivo por la pantalla.',
    'الدردشة والرموز التعبيرية: تفاعل مع الرسائل وأرسل صور GIF متحركة أو أطلق رموزاً تعبيرية حية على الشاشة.',
  ],
  '5. 5 Haneli Oda Kodu, QR Davet & Yetki Yönetimi': [
    '5. 5-Digit Room Code, QR Invite & Permissions',
    '5. 5-stelliger Raumcode, QR-Einladung & Rechte',
    '5. Code salle à 5 caractères, invitation QR & droits',
    '5. Código de sala de 5 dígitos, invitación QR y permisos',
    '5. رمز الغرفة الخماسي ودعوة QR وإدارة الصلاحيات',
  ],
  'Odalar, Güvenlik & Dışa Aktarım': [
    'Rooms, Security & Export',
    'Räume, Sicherheit & Export',
    'Salles, sécurité & exportation',
    'Salas, seguridad y exportación',
    'الغرف والأمان والتصدير',
  ],
  'Çalışma odalarınızı 5 haneli benzersiz kodlarla yönetin, ekibinizi QR kodla davet edin ve çalışmanızı yedekleyin.': [
    'Manage your workspaces with unique 5-digit codes, invite your team via QR code, and back up your work.',
    'Verwalten Sie Ihre Arbeitsräume mit 5-stelligen Codes, laden Sie Ihr Team per QR-Code ein und sichern Sie Ihre Arbeit.',
    'Gérez vos espaces avec des codes uniques à 5 caractères, invitez votre équipe par QR code et sauvegardez votre travail.',
    'Gestiona tus salas con códigos únicos de 5 dígitos, invita a tu equipo con código QR y respalda tu trabajo.',
    'أدر غرف العمل برموز خماسية فريدة، وادعُ فريقك عبر رمز QR واحفظ نسخة احتياطية من عملك.',
  ],
  '5 Haneli Oda Sistemi: Sol üstteki oda menüsünden yeni oda açabilir, oda kapasitesini belirleyebilir veya odayı kilitleyebilirsiniz.': [
    '5-Digit Room System: Create new rooms, set capacity limits, or lock the room from the top-left room menu.',
    '5-stelliges Raumsystem: Erstellen Sie im Raummenü oben links neue Räume, legen Sie Limits fest oder sperren Sie den Raum.',
    'Système de salle à 5 caractères : Créez des salles, définissez la capacité ou verrouillez la salle depuis le menu en haut à gauche.',
    'Sistema de salas de 5 dígitos: Crea nuevas salas, define la capacidad o bloquea la sala desde el menú superior izquierdo.',
    'نظام الغرف الخماسي: أنشئ غرفاً جديدة أو حدد السعة أو اقفل الغرفة من قائمة الغرف أعلى اليسار.',
  ],
  'Davet & Rol Yönetimi: QR kodu tahtaya yapıştırabilir, katılımcılara Düzenleyici (Editor) veya İzleyici (Viewer) yetkisi verebilirsiniz.': [
    'Invite & Role Management: Paste the QR code onto the board and assign Editor or Viewer permissions to participants.',
    'Einladung & Rollen: Fügen Sie den QR-Code aufs Board ein und weisen Sie Teilnehmern Bearbeiter- oder Betrachterrechte zu.',
    'Invitation & Rôles : Collez le QR code sur le tableau et attribuez des rôles Éditeur ou Lecteur aux participants.',
    'Invitación y Roles: Pega el código QR en el tablero y asigna permisos de Editor o Lector a los participantes.',
    'الدعوة وإدارة الأدوار: الصق رمز QR على اللوحة وامنح المشاركين صلاحيات محرر أو مشاهد.',
  ],
  'Dışa / İçe Aktar: Tahtanızı yüksek çözünürlüklü PNG görseli olarak indirin veya JSON yedek dosyası olarak kaydedip geri yükleyin.': [
    'Export / Import: Download your board as a high-res PNG image or save and restore it as a JSON backup file.',
    'Export / Import: Laden Sie Ihr Board als hochauflösendes PNG herunter oder speichern und laden Sie es als JSON-Backup.',
    'Exporter / Importer : Téléchargez votre tableau en PNG haute résolution ou sauvegardez/restaurez un fichier JSON.',
    'Exportar / Importar: Descarga tu tablero como imagen PNG de alta resolución o guárdalo y restáuralo como archivo JSON.',
    'تصدير / استيراد: نزّل اللوحة كصورة PNG عالية الدقة أو احفظها واستعدها كملف احتياطي JSON.',
  ],
  'CollabBoard Hızlı Başlangıç Rehberi': [
    'CollabBoard Quick Start Guide',
    'CollabBoard Schnellstart-Anleitung',
    'Guide de démarrage rapide CollabBoard',
    'Guía de inicio rápido de CollabBoard',
    'دليل البدء السريع لـ CollabBoard',
  ],
  'Buradan Erişebilirsiniz': [
    'Access It Right Here',
    'Hier direkt erreichbar',
    'Accessible directement ici',
    'Accede desde aquí',
    'يمكنك الوصول إليه من هنا',
  ],
  'Tanıtım Turunu Kapat': [
    'Close Onboarding Tour',
    'Einführungstour schließen',
    'Fermer la visite guidée',
    'Cerrar tour de bienvenida',
    'إغلاق جولة التعريف',
  ],
  'Atla': ['Skip', 'Überspringen', 'Passer', 'Omitir', 'تخطي'],
  'Geri': ['Back', 'Zurück', 'Retour', 'Atrás', 'رجوع'],
  'İleri': ['Next', 'Weiter', 'Suivant', 'Siguiente', 'التالي'],
  'Başla': ['Get Started', 'Starten', 'Commencer', 'Empezar', 'ابدأ الآن'],

  // Toolbar Shape Categories & 27 Vector Shapes
  'Temel Şekiller': ['Basic Shapes', 'Grundformen', 'Formes de base', 'Formas básicas', 'الأشكال الأساسية'],
  'Oklar & Bağlantılar': ['Arrows & Connectors', 'Pfeile & Verbinder', 'Flèches & connecteurs', 'Flechas y conectores', 'الأسهم والروابط'],
  'Akış Diyagramı & Mimari': ['Flowchart & Architecture', 'Flussdiagramm & Architektur', 'Organigramme & architecture', 'Diagrama de flujo y arquitectura', 'المخطط الانسيابي والهندسة'],
  'Yıldızlar, Semboller & Balonlar': ['Stars, Symbols & Callouts', 'Sterne, Symbole & Blasen', 'Étoiles, symboles & bulles', 'Estrellas, símbolos y bocadillos', 'النجوم والرموز والفقاعات'],
  'Dikdörtgen': ['Rectangle', 'Rechteck', 'Rectangle', 'Rectángulo', 'مستطيل'],
  'Yuvarlatılmış': ['Rounded Rect', 'Abgerundet', 'Rect. arrondi', 'Rect. redondeado', 'مستطيل مستدير'],
  'Daire / Elips': ['Circle / Ellipse', 'Kreis / Ellipse', 'Cercle / Ellipse', 'Círculo / Elipse', 'دائرة / قطع ناقص'],
  'Üçgen': ['Triangle', 'Dreieck', 'Triangle', 'Triángulo', 'مثلث'],
  'Dik Üçgen': ['Right Triangle', 'Rechtw. Dreieck', 'Triangle rect.', 'Triángulo rect.', 'مثلث قائم'],
  'Eşkenar Dörtgen': ['Diamond', 'Raute', 'Losange', 'Rombo', 'معين'],
  'Beşgen': ['Pentagon', 'Fünfeck', 'Pentagone', 'Pentágono', 'خماسي'],
  'Altıgen': ['Hexagon', 'Sechseck', 'Hexagone', 'Hexágono', 'سداسي'],
  'Sekizgen': ['Octagon', 'Achteck', 'Octogone', 'Octágono', 'ثماني'],
  'Paralelkenar': ['Parallelogram', 'Parallelogramm', 'Parallélogramme', 'Paralelogramo', 'متوازي أضلاع'],
  'Yamuk': ['Trapezoid', 'Trapez', 'Trapèze', 'Trapecio', 'شبه منحرف'],
  'Tek Yönlü Ok': ['Single Arrow', 'Einzelpfeil', 'Flèche simple', 'Flecha simple', 'سهم مفرد'],
  'Çift Yönlü Ok': ['Double Arrow', 'Doppelpfeil', 'Flèche double', 'Flecha doble', 'سهم مزدوج'],
  'Kavisli Ok': ['Curved Arrow', 'Gebogener Pfeil', 'Flèche courbe', 'Flecha curva', 'سهم منحني'],
  'Dirsekli Bağlantı': ['Elbow Connector', 'Winkelverbinder', 'Connecteur coudé', 'Conector acodado', 'رابط بزاوية'],
  'Kalın Blok Ok': ['Block Arrow', 'Blockpfeil', 'Flèche bloc', 'Flecha de bloque', 'سهم عريض'],
  'Veritabanı (Silindir)': ['Database (Cylinder)', 'Datenbank (Zylinder)', 'Base de données', 'Base de datos (Cilindro)', 'قاعدة بيانات (أسطوانة)'],
  '3B Küp / Kutu': ['3D Cube / Box', '3D-Würfel / Box', 'Cube 3D / Boîte', 'Cubo 3D / Caja', 'مكعب ثلاثي الأبعاد'],
  'Doküman / Rapor': ['Document / Report', 'Dokument / Bericht', 'Document / Rapport', 'Documento / Informe', 'مستند / تقرير'],
  'Bulut / Sunucu': ['Cloud / Server', 'Cloud / Server', 'Nuage / Serveur', 'Nube / Servidor', 'سحابة / خادم'],
  'Kapsül (Başlat/Bitir)': ['Capsule (Start/End)', 'Kapsel (Start/Ende)', 'Capsule (Début/Fin)', 'Cápsula (Inicio/Fin)', 'كبسولة (بداية/نهاية)'],
  'Not / Yorum Kartı': ['Note / Comment Card', 'Notiz- / Kommentarkarte', 'Carte note / commentaire', 'Tarjeta de nota', 'بطاقة ملاحظة'],
  'Yıldız': ['Star', 'Stern', 'Étoile', 'Estrella', 'نجمة'],
  '8 Köşeli Yıldız': ['8-Point Star', '8-zackiger Stern', 'Étoile à 8 branches', 'Estrella de 8 puntas', 'نجمة ثمانية'],
  'Artı / Haç': ['Plus / Cross', 'Plus / Kreuz', 'Plus / Croix', 'Cruz / Más', 'علامة زائد'],
  'Kalp': ['Heart', 'Herz', 'Cœur', 'Corazón', 'قلب'],
  'Konuşma Balonu': ['Speech Callout', 'Sprechblase', 'Bulle de dialogue', 'Bocadillo de texto', 'فقاعة كلام'],
  'Silgi Türünü Değiştir (Öğe / Hassas)': [
    'Switch Eraser Type (Object / Precision)',
    'Radierertyp wechseln (Objekt / Präzision)',
    'Changer de gomme (Objet / Précision)',
    'Cambiar tipo de borrador (Objeto / Precisión)',
    'تغيير نوع الممحاة (عنصر / دقيق)',
  ],
  'Hassas Silgi (Dokunduğu yeri siler / böler - Kısayol: E veya Shift+E)': [
    'Precision Eraser (Erases / splits touched area - Shortcut: E or Shift+E)',
    'Präzisionsradierer (Löscht / teilt berührten Bereich - Kürzel: E oder Shift+E)',
    'Gomme de précision (Efface / divise la zone touchée - Raccourci : E ou Shift+E)',
    'Borrador de precisión (Borra / divide el área tocada - Atajo: E o Shift+E)',
    'ممحاة دقيقة (تمحو / تقسم الجزء الملموس - اختصار: E أو Shift+E)',
  ],
  'Öğe Silgisi (Tek hamlede öğeyi siler - Kısayol: E)': [
    'Object Eraser (Deletes whole item in one tap - Shortcut: E)',
    'Objektradierer (Löscht ganzes Element sofort - Kürzel: E)',
    'Gomme d’objet (Supprime l’élément d’un coup - Raccourci : E)',
    'Borrador de objetos (Elimina el elemento de un toque - Atajo: E)',
    'ممحاة العناصر (تحذف العنصر بلمسة واحدة - اختصار: E)',
  ],
  'Geri Al (Ctrl+Z)': ['Undo (Ctrl+Z)', 'Rückgängig (Strg+Z)', 'Annuler (Ctrl+Z)', 'Deshacer (Ctrl+Z)', 'تراجع (Ctrl+Z)'],
  'İleri Al (Ctrl+Y)': ['Redo (Ctrl+Y)', 'Wiederholen (Strg+Y)', 'Rétablir (Ctrl+Y)', 'Rehacer (Ctrl+Y)', 'إعادة (Ctrl+Y)'],
  'Uzaklaştır': ['Zoom Out', 'Verkleinern', 'Dézoomer', 'Alejar', 'تصغير'],
  'Yakınlaştır': ['Zoom In', 'Vergrößern', 'Zoomer', 'Acercar', 'تكبير'],
  'Yakınlaştırmayı Sıfırla (%100)': ['Reset Zoom (100%)', 'Zoom zurücksetzen (100%)', 'Réinitialiser le zoom (100%)', 'Restablecer zoom (100%)', 'إعادة ضبط التكبير (100%)'],
  'Araç Çubuğunu Gizle (Küçült)': ['Minimize Toolbar', 'Werkzeugleiste minimieren', 'Réduire la barre d’outils', 'Minimizar barra de herramientas', 'تصغير شريط الأدوات'],
  'Araç Çubuğunu Göster': ['Show Toolbar', 'Werkzeugleiste anzeigen', 'Afficher la barre d’outils', 'Mostrar barra de herramientas', 'إظهار شريط الأدوات'],
  'Stil Çubuğunu Gizle (Küçült)': ['Minimize Style Bar', 'Stilleiste minimieren', 'Réduire la barre de style', 'Minimizar barra de estilo', 'تصغير شريط النمط'],
  'Stil Çubuğunu Göster': ['Show Style Bar', 'Stilleiste anzeigen', 'Afficher la barre de style', 'Mostrar barra de estilo', 'إظهار شريط النمط'],

  // CanvasQuickAccess & Radial Menu
  'Seçim': ['Select', 'Auswahl', 'Sélection', 'Selección', 'تحديد'],
  'Kalem': ['Pen', 'Stift', 'Stylo', 'Lápiz', 'قلم'],
  'Metin': ['Text', 'Text', 'Texte', 'Texto', 'نص'],
  'Not': ['Note', 'Notiz', 'Note', 'Nota', 'ملاحظة'],
  'Şekil': ['Shape', 'Form', 'Forme', 'Forma', 'شكل'],
  'Ok': ['Arrow', 'Pfeil', 'Flèche', 'Flecha', 'سهم'],
  'Lazer': ['Laser', 'Laser', 'Laser', 'Láser', 'ليزر'],
  'Silgi': ['Eraser', 'Radierer', 'Gomme', 'Borrador', 'ممحاة'],
  'Hızlı Seçim': ['Quick Select', 'Schnellwahl', 'Sélection rapide', 'Selección rápida', 'اختيار سريع'],
  'Sürükle / Tıkla': ['Drag / Click', 'Ziehen / Klicken', 'Glisser / Cliquer', 'Arrastrar / Clic', 'اسحب / انقر'],
  'AI Çizim Asistanı': ['AI Drawing Assistant', 'KI-Zeichenassistent', 'Assistant de dessin IA', 'Asistente de dibujo IA', 'مساعد الرسم الذكي'],
  'Harita': ['Map', 'Karte', 'Carte', 'Mapa', 'خريطة'],
  'Mini Haritayı Göster': ['Show Minimap', 'Minimap anzeigen', 'Afficher la mini-carte', 'Mostrar minimapa', 'إظهار الخريطة المصغرة'],
  'Mini Harita Kutusunu Gizle': ['Minimize Minimap Box', 'Minimap minimieren', 'Réduire la mini-carte', 'Minimizar minimapa', 'تصغير الخريطة المصغرة'],
  'Mini Haritayı Küçült / Genişlet': ['Collapse / Expand Minimap', 'Minimap ein-/ausklappen', 'Réduire / Agrandir la mini-carte', 'Contraer / Expandir minimapa', 'طي / توسيع الخريطة المصغرة'],
  'Canlı Araç & Tipografi Önizlemesi': ['Live Tool & Typography Preview', 'Live-Werkzeug- & Typografie-Vorschau', 'Aperçu en direct de l’outil & typographie', 'Vista previa de herramienta y tipografía', 'معاينة الأداة والخط مباشرة'],
  'Tüm Çizimleri Ekrana Sığdır': ['Fit All Drawings to Screen', 'Alle Zeichnungen einpassen', 'Ajuster tous les dessins à l’écran', 'Ajustar todos los dibujos a la pantalla', 'ملاءمة جميع الرسومات للشاشة'],
  'Merkeze Dön (100%)': ['Return to Center (100%)', 'Zur Mitte zurückkehren (100%)', 'Retour au centre (100%)', 'Volver al centro (100%)', 'العودة للمركز (100%)'],
  'Haritayı Daralt': ['Collapse Map', 'Karte einklappen', 'Réduire la carte', 'Contraer mapa', 'طي الخريطة'],
  'Haritayı Genişlet': ['Expand Map', 'Karte ausklappen', 'Agrandir la carte', 'Expandir mapa', 'توسيع الخريطة'],

  // TemplatesModal & BOARD_TEMPLATES
  'Hazır Çalışma Şablonları': ['Ready Workspace Templates', 'Fertige Arbeitsvorlagen', 'Modèles de travail prêts', 'Plantillas de trabajo listas', 'قوالب العمل الجاهزة'],
  'Tek tıkla ekibinizle ortak çalışmaya başlayabileceğiniz profesyonel panolar.': [
    'Professional boards to start collaborating with your team in a single click.',
    'Professionelle Boards, um mit einem Klick im Team zusammenzuarbeiten.',
    'Des tableaux professionnels pour collaborer avec votre équipe en un clic.',
    'Tableros profesionales para empezar a colaborar con tu equipo en un clic.',
    'لوحات احترافية لبدء العمل المشترك مع فريقك بنقرة واحدة.',
  ],
  'Önizleme hazır': ['Preview ready', 'Vorschau bereit', 'Aperçu prêt', 'Vista previa lista', 'المعاينة جاهزة'],
  '✓ Seçildi': ['✓ Selected', '✓ Ausgewählt', '✓ Sélectionné', '✓ Seleccionado', '✓ محدد'],
  'Seç': ['Select', 'Wählen', 'Choisir', 'Elegir', 'اختر'],
  'Yükleme Modu:': ['Load Mode:', 'Lademodus:', 'Mode de chargement :', 'Modo de carga:', 'وضع التحميل:'],
  'Mevcut Tahtaya Ekle': ['Append to Current Board', 'Zum aktuellen Board hinzufügen', 'Ajouter au tableau actuel', 'Añadir al tablero actual', 'إضافة إلى اللوحة الحالية'],
  'Tahtayı Sıfırla & Yükle': ['Reset Board & Load', 'Board leeren & laden', 'Réinitialiser & charger', 'Restablecer y cargar', 'إعادة ضبط اللوحة والتحميل'],
  'Vazgeç': ['Cancel', 'Abbrechen', 'Annuler', 'Cancelar', 'إلغاء'],
  'Şablonu Uygula': ['Apply Template', 'Vorlage anwenden', 'Appliquer le modèle', 'Aplicar plantilla', 'تطبيق القالب'],
  '🧠 Beyin Fırtınası & Fikir Haritası': ['🧠 Brainstorming & Mind Map', '🧠 Brainstorming & Mindmap', '🧠 Brainstorming & Carte mentale', '🧠 Lluvia de ideas y mapa mental', '🧠 العصف الذهني وخريطة الأفكار'],
  'Merkezi bir fikir etrafında dallanan yapışkan notlar ve bağlantı okları.': [
    'Sticky notes and connector arrows branching around a central idea.',
    'Haftnotizen und Verbindungspfeile rund um eine zentrale Idee.',
    'Notes adhésives et flèches de connexion autour d’une idée centrale.',
    'Notas adhesivas y flechas conectoras alrededor de una idea central.',
    'ملاحظات لاصقة وأسهم ربط تتفرع حول فكرة مركزية.',
  ],
  'Fikir Geliştirme': ['Ideation', 'Ideenfindung', 'Idéation', 'Ideación', 'تطوير الأفكار'],
  '📋 Çevik (Agile) Kanban Panosu': ['📋 Agile Kanban Board', '📋 Agiles Kanban-Board', '📋 Tableau Kanban Agile', '📋 Tablero Kanban Ágil', '📋 لوحة كانبان الرشيقة'],
  'Yapılacaklar, Devam Edenler ve Tamamlananlar sütunlarından oluşan görev panosu.': [
    'Task board with To Do, In Progress, and Done columns.',
    'Aufgaben-Board mit Spalten für Offen, In Arbeit und Erledigt.',
    'Tableau de tâches avec colonnes À faire, En cours et Terminé.',
    'Tablero de tareas con columnas Por hacer, En curso y Completado.',
    'لوحة مهام تتكون من أعمدة المهام المطلوبة والجارية والمكتملة.',
  ],
  'Proje Yönetimi': ['Project Management', 'Projektmanagement', 'Gestion de projet', 'Gestión de proyectos', 'إدارة المشاريع'],
  '🏗️ Sistem Mimarisi & Akış Şeması': ['🏗️ System Architecture & Flowchart', '🏗️ Systemarchitektur & Flussdiagramm', '🏗️ Architecture système & Organigramme', '🏗️ Arquitectura de sistemas y flujo', '🏗️ هندسة النظام والمخطط الانسيابي'],
  'İstemci, API Ağ Geçidi, Servisler ve Veritabanı katmanlarını gösteren teknik diyagram.': [
    'Technical diagram illustrating Client, API Gateway, Services, and Database layers.',
    'Technisches Diagramm mit Client-, API-Gateway-, Service- und Datenbankschichten.',
    'Diagramme technique illustrant Client, API Gateway, Services et Base de données.',
    'Diagrama técnico con capas de Cliente, API Gateway, Servicios y Base de datos.',
    'مخطط تقني يوضح طبقات العميل وبوابة API والخدمات وقاعدة البيانات.',
  ],
  'Yazılım & Mühendislik': ['Software & Engineering', 'Software & Engineering', 'Logiciel & Ingénierie', 'Software e Ingeniería', 'البرمجيات والهندسة'],
  '🔄 Sprint Retrospektifi': ['🔄 Sprint Retrospective', '🔄 Sprint-Retrospektive', '🔄 Rétrospective de Sprint', '🔄 Retrospectiva de Sprint', '🔄 مراجعة السبرينت'],
  'Neler iyi gitti, neler geliştirilmeli ve aksiyon kararları için 3 sütunlu değerlendirme.': [
    '3-column review for What Went Well, What Can Be Improved, and Action Items.',
    '3-Spalten-Auswertung für Was lief gut, Was kann besser werden und Maßnahmen.',
    'Évaluation en 3 colonnes : Points positifs, À améliorer et Actions.',
    'Evaluación en 3 columnas: Qué salió bien, Qué mejorar y Acciones.',
    'تقييم من 3 أعمدة لما سار بشكل جيد وما يحتاج لتحسين وخطوات العمل.',
  ],
  'Ekip Değerlendirme': ['Team Review', 'Team-Auswertung', 'Bilan d’équipe', 'Evaluación de equipo', 'تقييم الفريق'],

  // ExportModal.tsx
  'Tahtayı Dışa Aktar & Yedekle': ['Export & Backup Board', 'Board exportieren & sichern', 'Exporter & sauvegarder le tableau', 'Exportar y respaldar tablero', 'تصدير اللوحة والنسخ الاحتياطي'],
  'PNG Görseli': ['PNG Image', 'PNG-Bild', 'Image PNG', 'Imagen PNG', 'صورة PNG'],
  'PNG İndir': ['Download PNG', 'PNG herunterladen', 'Télécharger PNG', 'Descargar PNG', 'تنزيل PNG'],
  'Yüksek çözünürlüklü (2x Retina) ekran görüntüsü olarak kaydeder.': [
    'Saves as a high-resolution (2x Retina) image snapshot.',
    'Speichert als hochauflösendes (2x Retina) Bild.',
    'Enregistre sous forme d’image haute résolution (2x Retina).',
    'Guarda como imagen de alta resolución (2x Retina).',
    'يحفظ كصورة عالية الدقة (2x Retina).',
  ],
  'Beyaz arka plan ekle (işaretsiz: saydam)': [
    'Include white background (unchecked: transparent)',
    'Weißen Hintergrund einbeziehen (ohne Haken: transparent)',
    'Inclure un fond blanc (décoché : transparent)',
    'Incluir fondo blanco (desmarcado: transparente)',
    'إضافة خلفية بيضاء (غير محدد: شفاف)',
  ],
  'JSON Proje Yedeği': ['JSON Project Backup', 'JSON-Projektsicherung', 'Sauvegarde JSON du projet', 'Copia de seguridad JSON', 'نسخة احتياطية JSON للمشروع'],
  'JSON İndir': ['Download JSON', 'JSON herunterladen', 'Télécharger JSON', 'Descargar JSON', 'تنزيل JSON'],
  'Tüm tahta öğelerini vektörel koordinatlarıyla birlikte yedekler.': [
    'Backs up all board elements along with their vector coordinates.',
    'Sichert alle Board-Elemente samt ihrer Vektorkoordinaten.',
    'Sauvegarde tous les éléments du tableau avec leurs coordonnées vectorielles.',
    'Respalda todos los elementos del tablero con sus coordenadas vectoriales.',
    'يحفظ جميع عناصر اللوحة مع إحداثياتها المتجهة.',
  ],
  'Yedekten Geri Yükle': ['Restore from Backup', 'Aus Backup wiederherstellen', 'Restaurer depuis une sauvegarde', 'Restaurar desde copia', 'الاستعادة من نسخة احتياطية'],
  'JSON Yükle': ['Upload JSON', 'JSON hochladen', 'Importer JSON', 'Subir JSON', 'رفع JSON'],
  'Yüklendi': ['Uploaded', 'Geladen', 'Importé', 'Cargado', 'تم الرفع'],
  'Önceden indirdiğiniz bir CollabBoard JSON dosyasını tahtaya aktarın.': [
    'Import a previously downloaded CollabBoard JSON file onto the board.',
    'Importieren Sie eine zuvor heruntergeladene CollabBoard-JSON-Datei aufs Board.',
    'Importez un fichier JSON CollabBoard précédemment téléchargé sur le tableau.',
    'Importa un archivo JSON de CollabBoard descargado previamente al tablero.',
    'استورد ملف JSON محفوظ مسبقاً إلى اللوحة.',
  ],

  // NotesPanel.tsx
  'Ortak Çalışma Notları': ['Shared Workspace Notes', 'Gemeinsame Arbeitsnotizen', 'Notes de travail partagées', 'Notas de trabajo compartidas', 'ملاحظات العمل المشتركة'],
  'Şablon': ['Template', 'Vorlage', 'Modèle', 'Plantilla', 'قالب'],
  '📋 Toplantı Gündemi & Kararlar': ['📋 Meeting Agenda & Decisions', '📋 Tagesordnung & Beschlüsse', '📋 Ordre du jour & décisions', '📋 Agenda de reunión y decisiones', '📋 جدول الاجتماع والقرارات'],
  '🏗️ Yazılım Mimarisi Tasarımı': ['🏗️ Software Architecture Design', '🏗️ Softwarearchitektur-Entwurf', '🏗️ Conception d’architecture logicielle', '🏗️ Diseño de arquitectura de software', '🏗️ تصميم هندسة البرمجيات'],
  'Kopyala': ['Copy', 'Kopieren', 'Copier', 'Copiar', 'نسخ'],
  'Markdown Olarak İndir': ['Download as Markdown', 'Als Markdown herunterladen', 'Télécharger en Markdown', 'Descargar como Markdown', 'تنزيل بصيغة Markdown'],
  'Toplantı notları, kararlar ve yapılacaklar listesini buraya yazın...': [
    'Write meeting notes, decisions, and action items here...',
    'Besprechungsnotizen, Entscheidungen und Aufgaben hier eingeben...',
    'Écrivez ici vos notes de réunion, décisions et listes de tâches...',
    'Escribe aquí notas de reunión, decisiones y tareas pendientes...',
    'اكتب ملاحظات الاجتماع والقرارات وقائمة المهام هنا...',
  ],
  'Markdown formatı desteklenir': ['Markdown formatting supported', 'Markdown-Formatierung unterstützt', 'Format Markdown pris en charge', 'Formato Markdown compatible', 'يدعم تنسيق Markdown'],
  'İzleyici Modu (Salt Okunur)': ['Viewer Mode (Read-Only)', 'Betrachtermodus (Schreibgeschützt)', 'Mode lecteur (Lecture seule)', 'Modo lector (Solo lectura)', 'وضع المشاهدة (للقراءة فقط)'],

  // FileShareModal.tsx
  'Paylaşılan Dosyalar': ['Shared Files', 'Geteilte Dateien', 'Fichiers partagés', 'Archivos compartidos', 'الملفات المشتركة'],
  'Dosya Yüklenemedi': ['File Upload Failed', 'Datei-Upload fehlgeschlagen', 'Échec de l’importation', 'Error al subir archivo', 'فشل رفع الملف'],
  'Dosya kontrol ediliyor ve optimize ediliyor...': [
    'Validating and optimizing file...',
    'Datei wird geprüft und optimiert...',
    'Vérification et optimisation du fichier...',
    'Verificando y optimizando archivo...',
    'جارٍ فحص الملف وتحسينه...',
  ],
  'Dosya yüklemek için tıklayın veya sürükleyip bırakın': [
    'Click or drag and drop to upload a file',
    'Klicken oder Datei hierher ziehen zum Hochladen',
    'Cliquez ou glissez-déposez pour importer un fichier',
    'Haz clic o arrastra y suelta para subir un archivo',
    'انقر أو اسحب وأفلت لرفع ملف',
  ],
  'Markdown (.md), PDF, Word, PPTX, Excel, Görseller ve Videolar (Maks. 3 dk / 50 MB)': [
    'Markdown (.md), PDF, Word, PPTX, Excel, Images & Videos (Max 3 min / 50 MB)',
    'Markdown (.md), PDF, Word, PPTX, Excel, Bilder & Videos (Max. 3 Min. / 50 MB)',
    'Markdown (.md), PDF, Word, PPTX, Excel, Images & Vidéos (Max. 3 min / 50 Mo)',
    'Markdown (.md), PDF, Word, PPTX, Excel, Imágenes y Vídeos (Máx. 3 min / 50 MB)',
    'ملفات Markdown وPDF وWord وPPTX وExcel والصور والفيديو (الحد الأقصى 3 دقائق / 50 ميجابايت)',
  ],
  'Güvenlik: .exe ve çalıştırılabilir dosyalara izin verilmez': [
    'Security: .exe and executable files are not permitted',
    'Sicherheit: .exe und ausführbare Dateien sind nicht erlaubt',
    'Sécurité : les fichiers .exe et exécutables ne sont pas autorisés',
    'Seguridad: no se permiten archivos .exe ni ejecutables',
    'الأمان: لا يُسمح بملفات .exe والملفات التنفيذية',
  ],
  'Henüz dosya paylaşılmadı': ['No files shared yet', 'Noch keine Dateien geteilt', 'Aucun fichier partagé pour le moment', 'Aún no se han compartido archivos', 'لم تتم مشاركة أي ملفات بعد'],
  'Odadaki üyelerle paylaşmak istediğiniz Markdown (.md), PDF, belge, görsel veya videoları buraya ekleyip tahtaya taşıyabilirsiniz.': [
    'Upload Markdown (.md), PDFs, documents, images, or videos here to share with room members and place onto the board.',
    'Laden Sie Markdown (.md), PDFs, Dokumente, Bilder oder Videos hier hoch, um sie mit dem Raum zu teilen und aufs Board zu ziehen.',
    'Ajoutez ici des fichiers Markdown (.md), PDF, documents, images ou vidéos pour les partager et les placer sur le tableau.',
    'Sube aquí archivos Markdown (.md), PDF, documentos, imágenes o vídeos para compartirlos y llevarlos al tablero.',
    'أضف ملفات Markdown أو PDF أو المستندات أو الصور أو الفيديو هنا لمشاركتها ونقلها إلى اللوحة.',
  ],
  'Önizle': ['Preview', 'Vorschau', 'Aperçu', 'Vista previa', 'معاينة'],
  'Tahtaya Ekle': ['Add to Board', 'Zum Board', 'Ajouter au tableau', 'Añadir al tablero', 'إضافة للوحة'],
  'Doküman Kartı Olarak Tahtaya Ekle': ['Add to Board as Document Card', 'Als Dokumentkarte zum Board hinzufügen', 'Ajouter comme carte document', 'Añadir como tarjeta de documento', 'إضافة كبطاقة مستند إلى اللوحة'],
  'İndir': ['Download', 'Herunterladen', 'Télécharger', 'Descargar', 'تنزيل'],
  'Sil': ['Delete', 'Löschen', 'Supprimer', 'Eliminar', 'حذف'],
  'İpucu: Markdown (.md), görsel, PDF ve videoları tahtaya sürükleyebilirsiniz.': [
    'Tip: You can drag Markdown (.md), images, PDFs, and videos directly onto the board.',
    'Tipp: Sie können Markdown (.md), Bilder, PDFs und Videos direkt aufs Board ziehen.',
    'Astuce : Glissez vos fichiers Markdown (.md), images, PDF et vidéos directement sur le tableau.',
    'Consejo: Puedes arrastrar Markdown (.md), imágenes, PDF y vídeos directamente al tablero.',
    'نصيحة: يمكنك سحب ملفات Markdown والصور وPDF والفيديو مباشرة إلى اللوحة.',
  ],

  // ChatDrawer.tsx
  'Henüz sohbet mesajı yok': ['No chat messages yet', 'Noch keine Chat-Nachrichten', 'Aucun message pour le moment', 'Aún no hay mensajes de chat', 'لا توجد رسائل دردشة بعد'],
  'Odadaki üyelerle sohbet edin, emojiler ve animasyonlu GIF\'ler gönderin!': [
    'Chat with room members, send emojis and animated GIFs!',
    'Chatten Sie mit Raumkollaborateuren, senden Sie Emojis und animierte GIFs!',
    'Discutez avec les membres de la salle, envoyez des émojis et des GIF animés !',
    '¡Chatea con los miembros de la sala, envía emojis y GIFs animados!',
    'تحدث مع أعضاء الغرفة وأرسل رموزاً تعبيرية وصور GIF متحركة!',
  ],
  'Sen': ['You', 'Du', 'Vous', 'Tú', 'أنت'],
  'Son Mesaja Tepki:': ['React to Last Message:', 'Reaktion auf letzte Nachricht:', 'Réagir au dernier message :', 'Reaccionar al último mensaje:', 'تفاعل مع آخر رسالة:'],
  'Emojiler': ['Emojis', 'Emojis', 'Émojis', 'Emojis', 'الرموز التعبيرية'],
  'GIF\'ler': ['GIFs', 'GIFs', 'GIFs', 'GIFs', 'صور GIF'],
  'Emoji ara...': ['Search emojis...', 'Emojis suchen...', 'Rechercher un émoji...', 'Buscar emojis...', 'ابحث عن رمز تعبيري...'],
  'GIF ara...': ['Search GIFs...', 'GIFs suchen...', 'Rechercher un GIF...', 'Buscar GIFs...', 'ابحث عن GIF...'],
  'Tümü': ['All', 'Alle', 'Tous', 'Todos', 'الكل'],
  'Yüzler': ['Faces', 'Gesichter', 'Visages', 'Caras', 'وجوه'],
  'Jestler & Eller': ['Gestures & Hands', 'Gesten & Hände', 'Gestes & mains', 'Gestos y manos', 'إيماءات وأيدي'],
  'Kalpler': ['Hearts', 'Herzen', 'Cœurs', 'Corazones', 'قلوب'],
  'Kutlama': ['Celebration', 'Feier', 'Célébration', 'Celebración', 'احتفال'],
  'Araçlar & Semboller': ['Objects & Symbols', 'Objekte & Symbole', 'Objets & symboles', 'Objetos y símbolos', 'أدوات ورموز'],
  'Doğa & Hayvanlar': ['Nature & Animals', 'Natur & Tiere', 'Nature & animaux', 'Naturaleza y animales', 'طبيعة وحيوانات'],
  'Alkış': ['Applause', 'Applaus', 'Applaudissements', 'Aplausos', 'تصفيق'],
  'Onay': ['Approve', 'Zustimmung', 'Validation', 'Aprobación', 'موافقة'],
  'Gülme': ['Laugh', 'Lachen', 'Rire', 'Risa', 'ضحك'],
  'Şaşırma': ['Wow', 'Staunen', 'Surprise', 'Sorpresa', 'دهشة'],
  'Dans': ['Dance', 'Tanz', 'Danse', 'Baile', 'رقص'],
  'Teşekkür': ['Thanks', 'Danke', 'Merci', 'Gracias', 'شكراً'],
  'veya GIF bağlantısı yapıştırın (https://...)': [
    'or paste a GIF URL (https://...)',
    'oder GIF-URL einfügen (https://...)',
    'ou collez un lien GIF (https://...)',
    'o pega un enlace GIF (https://...)',
    'أو الصق رابط GIF (https://...)',
  ],
  'Ekle': ['Add', 'Hinzufügen', 'Ajouter', 'Añadir', 'إضافة'],
  'Genel odaya mesaj yazın... (Enter)': [
    'Write a message to the general room... (Enter)',
    'Nachricht an den allgemeinen Raum schreiben... (Enter)',
    'Écrivez un message au salon général... (Entrée)',
    'Escribe un mensaje a la sala general... (Enter)',
    'اكتب رسالة إلى الغرفة العامة... (Enter)',
  ],
  'Tüm Emojiler': ['All Emojis', 'Alle Emojis', 'Tous les émojis', 'Todos los emojis', 'كل الرموز التعبيرية'],
  'GIF Gönder': ['Send GIF', 'GIF senden', 'Envoyer un GIF', 'Enviar GIF', 'إرسال GIF'],
  'Mesajınızı silin': ['Delete your message', 'Eigene Nachricht löschen', 'Supprimer votre message', 'Eliminar tu mensaje', 'حذف رسالتك'],

  // AIPromptModal.tsx
  '⚡ Hızlı Taslak': ['⚡ Quick Draft', '⚡ Schnellentwurf', '⚡ Brouillon rapide', '⚡ Borrador rápido', '⚡ مسودة سريعة'],
  '⚖️ Standart': ['⚖️ Standard', '⚖️ Standard', '⚖️ Standard', '⚖️ Estándar', '⚖️ قياسي'],
  '🎨 Ayrıntılı': ['🎨 Detailed', '🎨 Detailliert', '🎨 Détaillé', '🎨 Detallado', '🎨 مفصل'],
  '🧠 1 Dk Başyapıt': ['🧠 1m Masterpiece', '🧠 1-Min. Meisterwerk', '🧠 Chef-d’œuvre 1 min', '🧠 Obra maestra 1 min', '🧠 تحفة في دقيقة'],
  'Hızlı & Minimalist (5-8 Şekil Parçası)': ['Fast & Minimalist (5-8 Shape Parts)', 'Schnell & Minimalistisch (5-8 Formen)', 'Rapide & Minimaliste (5-8 formes)', 'Rápido y Minimalista (5-8 formas)', 'سريع وبسيط (5-8 قطع أشكال)'],
  'Dengeli & Net (10-18 Şekil Parçası)': ['Balanced & Clear (10-18 Shape Parts)', 'Ausgewogen & Klar (10-18 Formen)', 'Équilibré & Net (10-18 formes)', 'Equilibrado y Claro (10-18 formas)', 'متوازن وواضح (10-18 قطعة)'],
  'Gelişmiş & Ayrıntılı (20-32 Şekil Parçası)': ['Advanced & Detailed (20-32 Shape Parts)', 'Erweitert & Detailliert (20-32 Formen)', 'Avancé & Détaillé (20-32 formes)', 'Avanzado y Detallado (20-32 formas)', 'متقدم ومفصل (20-32 قطعة)'],
  'En Üst Düzey Başyapıt (35-50+ Şekil Parçası)': ['Ultimate Masterpiece (35-50+ Shape Parts)', 'Meisterwerk-Stufe (35-50+ Formen)', 'Chef-d’œuvre ultime (35-50+ formes)', 'Obra Maestra Suprema (35-50+ formas)', 'تحفة فنية متكاملة (35-50+ قطعة)'],
};

Object.assign(PHRASE_TABLE, EXTRA_PHRASES, EXTRA_PHRASES_2, EXTRA_PHRASES_3, EXTRA_PHRASES_4);

const LANG_INDEX: Record<Exclude<LanguageCode, 'tr'>, number> = {
  en: 0,
  de: 1,
  fr: 2,
  es: 3,
  ar: 4,
};

export function translatePhrase(raw: string, lang: LanguageCode): string {
  if (lang === 'tr' || !raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const idx = LANG_INDEX[lang];

  const exact = PHRASE_TABLE[trimmed];
  if (exact && exact[idx]) {
    return raw.replace(trimmed, exact[idx]);
  }

  const dynamic = translateDynamicPhrase(trimmed, lang);
  if (dynamic) return raw.replace(trimmed, dynamic);

  // Dynamic patterns (e.g. "Yakınlaştırma: %100", "6/6 Açık", "1 kişi", "3 öğe seçildi", "Adım 1", "4 nesne", "2 dosya")
  if (trimmed.startsWith('Yakınlaştırma:')) {
    const labels = ['Zoom:', 'Zoom:', 'Zoom :', 'Zoom:', 'التكبير:'];
    return raw.replace('Yakınlaştırma:', labels[idx]);
  }
  const stepMatch = trimmed.match(/^Adım\s+(\d+.*)$/i);
  if (stepMatch) {
    const prefixes = ['Step', 'Schritt', 'Étape', 'Paso', 'الخطوة'];
    return `${prefixes[idx]} ${stepMatch[1]}`;
  }
  const openMatch = trimmed.match(/^(\d+\/\d+)\s+Açık$/);
  if (openMatch) {
    const suffixes = ['Open', 'Offen', 'Ouverts', 'Abiertos', 'مفتوح'];
    return `${openMatch[1]} ${suffixes[idx]}`;
  }
  const personMatch = trimmed.match(/^(\d+)\s+kişi$/i);
  if (personMatch) {
    const suffixes = ['users', 'Personen', 'personnes', 'personas', 'أشخاص'];
    return `${personMatch[1]} ${suffixes[idx]}`;
  }
  const selectedMatch = trimmed.match(/^(\d+)\s+öğe seçildi$/);
  if (selectedMatch) {
    const suffixes = ['items selected', 'Elemente ausgewählt', 'éléments sélectionnés', 'elementos seleccionados', 'عناصر محددة'];
    return `${selectedMatch[1]} ${suffixes[idx]}`;
  }
  const objCountMatch = trimmed.match(/^(\d+)\s+nesne$/);
  if (objCountMatch) {
    const suffixes = ['objects', 'Objekte', 'objets', 'objetos', 'عناصر'];
    return `${objCountMatch[1]} ${suffixes[idx]}`;
  }
  const fileCountMatch = trimmed.match(/^(\d+)\s+dosya$/);
  if (fileCountMatch) {
    const suffixes = ['files', 'Dateien', 'fichiers', 'archivos', 'ملفات'];
    return `${fileCountMatch[1]} ${suffixes[idx]}`;
  }
  const charCountMatch = trimmed.match(/^(\d+)\s+karakter$/);
  if (charCountMatch) {
    const suffixes = ['characters', 'Zeichen', 'caractères', 'caracteres', 'حرفاً'];
    return `${charCountMatch[1]} ${suffixes[idx]}`;
  }
  const releaseMatch = trimmed.match(/^Bırak:\s*(.+)$/);
  if (releaseMatch) {
    const prefixes = ['Release:', 'Loslassen:', 'Relâcher :', 'Soltar:', 'أفلت:'];
    return `${prefixes[idx]} ${releaseMatch[1]}`;
  }
  const dmPlaceholderMatch = trimmed.match(/^(.+)\s+için özel mesaj yazın\.\.\.\s*\(Enter\)$/);
  if (dmPlaceholderMatch) {
    const templates = [
      `Write a private message to ${dmPlaceholderMatch[1]}... (Enter)`,
      `Private Nachricht an ${dmPlaceholderMatch[1]}... (Enter)`,
      `Message privé à ${dmPlaceholderMatch[1]}... (Entrée)`,
      `Mensaje privado para ${dmPlaceholderMatch[1]}... (Enter)`,
      `اكتب رسالة خاصة إلى ${dmPlaceholderMatch[1]}... (Enter)`,
    ];
    return templates[idx];
  }
  const roomNotesMatch = trimmed.match(/^(.+)\s+·\s+Notlar$/);
  if (roomNotesMatch) {
    const suffixes = ['Notes', 'Notizen', 'Notes', 'Notas', 'الملاحظات'];
    return `${roomNotesMatch[1]} · ${suffixes[idx]}`;
  }
  const strokeMatch = trimmed.match(/^Çizgi Kalınlığı:\s*(.+)$/);
  if (strokeMatch) {
    const prefixes = ['Stroke Width:', 'Linienstärke:', 'Épaisseur :', 'Grosor de línea:', 'سُمك الخط:'];
    return `${prefixes[idx]} ${strokeMatch[1]}`;
  }

  return raw;
}

const STORAGE_KEY = 'collab_language';

function readInitialLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (saved && DICTS[saved]) return saved;
  } catch {}
  return 'tr';
}

let currentLanguage: LanguageCode = readInitialLanguage();
const listeners = new Set<() => void>();

function applyDocumentLanguage(lang: LanguageCode) {
  try {
    const opt = LANGUAGE_OPTIONS.find((o) => o.code === lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = opt?.dir || 'ltr';
  } catch {}
}

applyDocumentLanguage(currentLanguage);

export function getLanguage(): LanguageCode {
  return currentLanguage;
}

export function setLanguage(lang: LanguageCode): void {
  if (!DICTS[lang] || lang === currentLanguage) return;
  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  applyDocumentLanguage(lang);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function translate(lang: LanguageCode, key: string): string {
  return DICTS[lang]?.[key] ?? tr[key] ?? key;
}

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return {
    lang,
    t: (key: string) => translate(lang, key),
  };
}

// WeakMaps storing { orig, lastOut } so both language switches AND dynamic React updates (like Tour steps) are 100% reactive
interface TrackedString {
  orig: string;
  lastOut: string;
}

const textNodeMap = new WeakMap<Text, TrackedString>();
const titleAttrMap = new WeakMap<Element, TrackedString>();
const placeholderAttrMap = new WeakMap<Element, TrackedString>();

function translateDOMSubtree(root: Node, lang: LanguageCode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.currentNode;

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const parentTag = textNode.parentElement?.tagName;
      if (
        parentTag !== 'SCRIPT' &&
        parentTag !== 'STYLE' &&
        parentTag !== 'TEXTAREA' &&
        parentTag !== 'CODE'
      ) {
        const currentVal = textNode.nodeValue || '';
        const tracked = textNodeMap.get(textNode);
        let orig: string;
        if (!tracked) {
          orig = currentVal;
        } else if (currentVal !== tracked.lastOut) {
          // React dynamically updated this text node (e.g., changing OnboardingTour step or state)
          orig = currentVal;
        } else {
          orig = tracked.orig;
        }
        const targetText = lang === 'tr' ? orig : translatePhrase(orig, lang);
        textNodeMap.set(textNode, { orig, lastOut: targetText });
        if (textNode.nodeValue !== targetText) {
          textNode.nodeValue = targetText;
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const titleAttr = el.getAttribute('title');
      if (titleAttr !== null) {
        const tracked = titleAttrMap.get(el);
        const origTitle =
          !tracked || titleAttr !== tracked.lastOut ? titleAttr : tracked.orig;
        const targetTitle = lang === 'tr' ? origTitle : translatePhrase(origTitle, lang);
        titleAttrMap.set(el, { orig: origTitle, lastOut: targetTitle });
        if (titleAttr !== targetTitle) {
          el.setAttribute('title', targetTitle);
        }
      }
      const placeholderAttr = el.getAttribute('placeholder');
      if (placeholderAttr !== null) {
        const tracked = placeholderAttrMap.get(el);
        const origPlaceholder =
          !tracked || placeholderAttr !== tracked.lastOut
            ? placeholderAttr
            : tracked.orig;
        const targetPlaceholder =
          lang === 'tr' ? origPlaceholder : translatePhrase(origPlaceholder, lang);
        placeholderAttrMap.set(el, {
          orig: origPlaceholder,
          lastOut: targetPlaceholder,
        });
        if (placeholderAttr !== targetPlaceholder) {
          el.setAttribute('placeholder', targetPlaceholder);
        }
      }
    }
    node = walker.nextNode();
  }
}

export function useAutoTranslateDOM() {
  const { lang } = useI18n();

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;
    let isApplying = false;

    const runPass = () => {
      if (isApplying) return;
      isApplying = true;
      try {
        translateDOMSubtree(document.body, lang);
      } finally {
        isApplying = false;
      }
    };

    runPass();

    const observer = new MutationObserver(() => {
      if (isApplying) return;
      runPass();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'placeholder'],
    });

    return () => observer.disconnect();
  }, [lang]);
}


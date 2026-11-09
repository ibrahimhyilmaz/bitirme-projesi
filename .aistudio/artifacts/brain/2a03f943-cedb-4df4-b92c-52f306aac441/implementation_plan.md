# Ön Karşılama Ekranı, 5 Haneli Oda Kodu Sistemi ve Oda Kapasite Kontrolü Planı

> **Not:** Tuval üzerindeki bozuk/yüklenemeyen görsellerin `drawImage` sırasında oluşturduğu `InvalidStateError` hatası (`canvasRenderer.ts`) giderildi.

## 1. Ön Karşılama Ekranı (Tam Ekran Giriş Kapısı — Gate Screen)
- **Beyaz Tahtanın Gizlenmesi (Strict Gate):**
  - Kullanıcı sayfaya ilk girdiğinde (veya davet linkiyle geldiğinde) karşılama ekranındaki işlemler tamamlanıp odaya giriş onaylanana kadar ana çalışma alanı (`TopNav`, `CanvasBoard`, `Toolbar`, `StyleBar` vb.) **hiçbir şekilde DOM'da render edilmeyecek** ve arka planda görünmeyecek.
  - Karşılama ekranı tamamlanmadan `useWebSocket` ve `useFirebaseSync` bağlantıları başlatılmayacak (`enabled: hasJoinedWorkspace`); böylece henüz giriş yapmamış ziyaretçilerin odada aktif kullanıcı olarak sayılması önlenecek.
- **Karşılama Ekranı Tasarımı ve Seçenekler (`UserSetupModal.tsx` -> Tam Ekran Karşılama Kapısı):**
  - **Üst Kısım:** Uygulama logosu (`BrandLogo`) ve başlık alanı.
  - **Google ile Giriş Seçeneği:** Kullanıcı tek tıkla Google hesabıyla giriş yapabilecek (`signInWithGoogle`). Giriş yapıldığında kullanıcının Google adı ve profil fotoğrafı otomatik olarak doldurulacak.
  - **1. Ana Seçenek — "Yeni Oda Oluştur" (Modal Akışı):**
    - Tıklandığında açılan oda oluşturma adımında/modalında sırasıyla:
      1. **Kullanıcı Adı** (Google ile giriş yapıldıysa otomatik dolu gelir, düzenlenebilir) + Avatar Rengi
      2. **Oda Adı** (Örn: *Mimari Tasarım Odası*)
      3. **Oda Kodu (5 Haneli Random Seed):** Otomatik üretilen 5 haneli büyük harf/rakam kombinasyonu (Örn: `K7X9A`), yanında "Yeni Kod Üret" (Yenile) ve "Kopyala" butonları ile.
      4. **Maksimum Kapasite (`maxUsers`):** 2 ile 30 kişi arasında belirlenebilen maksimum katılımcı sınırı.
    - **"Odayı Oluştur ve Başla"** butonuna basıldığında oda bu 5 haneli kod, oda adı ve belirlenen kapasite sınırı ile oluşturulup doğrudan odaya giriş yapılacak.
  - **2. Ana Seçenek — "Oda Kodu ile Giriş Yap":**
    - Karşılama ekranında kullanıcı kendi adını ve **5 haneli oda kodunu** girerek mevcut bir odaya katılabilecek.
    - Paylaşılan bir davet linki (`?room=ABC12`) ile gelindiğinde karşılama ekranı açılacak, 5 haneli oda kodu alanı otomatik dolu gelecek ve kullanıcı adını girip (veya Google ile giriş yapıp) onayladığında odaya bağlanacak.

## 2. Yeni Oda Oluşturma ve Maksimum Kapasite (`maxUsers`) Sorunlarının Çözümü
- **Oda Oluşturma Parametrelerinin Tam Aktarımı:**
  - `App.tsx`, `RoomsModal.tsx`, `UserSetupModal.tsx` ve `useWebSocket.ts` arasındaki oda oluşturma ve seçme akışında `customMaxUsers` ve `customRoomName` parametrelerinin eksiksiz taşınması sağlanacak.
  - WebSocket `join-room` mesajına ve Mesh `mesh-join` el sıkışmasına `maxUsers` ve `isCreatingRoom` bilgisi eklenecek.
- **Kapasite Sınırı (`maxUsers`) ve Kilitli Oda (`isLocked`) Engellemesi:**
  - **WebSocket Sunucu & İstemci Kontrolü:** `server.ts` tarafından `ROOM_FULL` veya `ROOM_LOCKED` hatası döndüğünde istemcinin MQTT/BroadcastChannel mesh ağına katılması anında durdurulacak ve bağlantı kesilecek.
  - **Serverless Mesh / P2P Kapasite Kontrolü:** `useWebSocket.ts` içerisindeki `mesh-join` ve `mesh-welcome` paketlerinde, odanın mevcut kullanıcı sayısı `roomSettings.maxUsers` sınırına ulaşmışsa veya oda kilitliyse (`isLocked`), oda sahibi/mevcut akranlar yeni katılmaya çalışan kullanıcıya `room-error` (`ROOM_FULL` / `ROOM_LOCKED`) paketi gönderecek ve kullanıcıyı odaya dahil etmeyecek.
  - **Kullanıcıyı Karşılama Ekranında veya Mevcut Odada Tutma:**
    - Kullanıcı ilk giriş ekranındayken dolu veya kilitli bir odaya girmeye çalışırsa giriş tamamen engellenecek, beyaz tahta açılmayacak ve karşılama ekranında net bir uyarı mesajı (*"Bu oda maksimum kapasiteye (X/X) ulaşmış"* veya *"Bu oda kilitli"*) gösterilecek.
    - Kullanıcı zaten bir odadayken başka bir dolu/kilitli odaya geçmeye çalışırsa geçiş iptal edilerek mevcut odasında kalması sağlanacak ve uyarı bildirimi gösterilecek.

## 3. Odadayken Kod ile Başka Bir Odaya Geçiş Özelliği
- **Üst Bar (`TopNav.tsx`) Hızlı Oda Geçiş Menüsü:**
  - Üst bardaki oda rozetine/butonuna tıklandığında veya yanındaki hızlı geçiş açılır menüsünden **5 haneli oda kodu** girilerek anında başka bir odaya geçiş yapılabilecek; ayrıca mevcut odanın 5 haneli kodu tek tıkla kopyalanabilecek.
- **Oda Yönetimi Penceresi (`RoomsModal.tsx`):**
  - "Odalar & Geçiş" sekmesinin en üstüne **"Oda Kodu ile Hızlı Geçiş"** alanı eklenecek (5 haneli kod girişi + "Odaya Geç" butonu).
  - "Yeni Oda Oluştur" sekmesinde de 5 haneli rastgele oda kodu (seed) üretici, oda adı ve maksimum kapasite ayarı standart hale getirilecek.

# CollabBoard Gerçek Zamanlı Senkronizasyon, Oda Kuralları, Etkileşim ve Arayüz İyileştirme Planı

## 1. Gerçek Zamanlı WebSocket & WebRTC Senkronizasyonu ve Odadan Ayrılma Düzeltmeleri
- **Çizim, İşaret (Ping) ve Nesne Eylemlerinin Anlık İletimi (`src/hooks/useWebSocket.ts`, `server.ts`)**:
  - İstemcide `isMeshModeRef` aktif olduğunda WebSocket (`wsRef.current`) üzerinden mesaj gönderimini devre dışı bırakan hatalı koşul kaldırılacak; hem WebSocket açıkken sunucu üzerinden hem de yedek Mesh/Firestore katmanı üzerinden çizim (`element-create`, `element-update`, `elements-batch-update`, `element-delete`), lazer/işaret (`user-ping`) ve hızlı tepki (`reaction`) paketleri çift yönlü ve eksiksiz iletilecek.
- **WebRTC Sesli Sohbet (`src/utils/audio.ts`, `src/hooks/useWebSocket.ts`, `server.ts`)**:
  - `sendWebRTCSignal` fonksiyonunun WebRTC `offer`, `answer` ve `ice-candidate` sinyallerini doğrudan WebSocket sunucusuna (`webrtc-signal`) ve eş zamanlı olarak Mesh kanalına iletmesi sağlanacak.
  - Mikrofon açıldığında (`toggleMute`) yerel ses izinin (`MediaStreamTrack.enabled`) tüm aktif `RTCPeerConnection` bağlantılarına eklendiği ve karşı tarafın `<audio>` bileşeninde otomatik oynatıldığı doğrulanacak.
- **Oda Değiştirirken / Ayrılırken Katılımcı Listesinin Temizlenmesi (`src/hooks/useWebSocket.ts`, `server.ts`)**:
  - Kullanıcı başka bir odaya geçtiğinde önce mevcut odası için sunucuya açık bir `leave-room` ve `mesh-leave` sinyali gönderilecek; sunucu tarafında kullanıcı önceki odanın `room.users` listesinden derhal çıkarılıp odadaki diğer kullanıcılara `user-left` bildirimi yayınlanacak.

## 2. Oda Kuralları, 5 Karakter Sınırı ve Kullanıcı Başına Maksimum 3 Oda
- **Var Olmayan Odaya Girişin Engellenmesi (`server.ts`, `src/hooks/useWebSocket.ts`, `src/components/UserSetupModal.tsx`)**:
  - Kullanıcı "Oda Kodu ile Giriş" yaptığında (`isCreatingRoom: false`), girilen 5 haneli koda sahip bir oda sunucuda/Firestore'da mevcut değilse otomatik oda oluşturulmayacak; `ROOM_NOT_FOUND` (*"Böyle bir oda bulunamadı. Lütfen oda kodunu kontrol edin veya yeni bir oda oluşturun."*) hatası döndürülerek giriş engellenecek.
- **Kesin 5 Karakter Oda Kodu Sınırı (`src/components/UserSetupModal.tsx`, `src/components/TopNav.tsx`, `src/components/RoomsModal.tsx`)**:
  - Tüm oda kodu girdi alanlarında `maxLength={5}` ve `.slice(0, 5)` kısıtlaması uygulanarak 5 karakterden uzun kod girilmesi veya gönderilmesi tamamen engellenecek.
- **Temiz Oda İsmi (`server.ts`, `src/components/UserSetupModal.tsx`, `src/components/TopNav.tsx`, `src/components/RoomsModal.tsx`)**:
  - Oda oluşturulurken veya görüntülendiğinde oda kodunun oda adına eklenmesi (`Oda Adı #KOD` vb.) kaldırılacak; oda adı kullanıcının girdiği şekliyle sade tutulacak, 5 haneli oda kodu ayrı rozette gösterilecek.
- **Kullanıcı Başına Maksimum 3 Oda Sınırı (`server.ts`, `src/components/UserSetupModal.tsx`, `src/components/RoomsModal.tsx`)**:
  - Sunucu ve istemci tarafında bir kullanıcının (`ownerKey` / `ownerId`) aynı anda en fazla **3 aktif çalışma odası** (`MAX_ROOMS_PER_USER = 3`) açabilmesi kuralı eklenecek.
  - Kullanıcı 4. odayı açmaya çalıştığında işlem engellenerek mevcut 3 odasından birini kapatması veya silmesi için uyarı gösterilecek ve Oda Yönetimi modalından kendi odalarını tek tıkla silme/kapatma imkanı sunulacak.

## 3. Orta Tekerlek ile Sürüklemeli Hızlı Seçim, Sağ Tık Kaydırma ve Bağlam Menüsü
- **Orta Fare Tekerleği (`e.button === 1`) ile Dairesel Hızlı Seçim (`src/components/CanvasBoard.tsx`, `src/components/CanvasQuickAccess.tsx`)**:
  - Orta tekerlek tuşuna basılı tutulduğunda imleç konumunda dairesel hızlı araç menüsü açılacak.
  - Kullanıcı orta tuşu basılı tutarak fareyi istediği aracın yönüne doğru sürüklediğinde ilgili dilim vurgulanacak ve tuş bırakıldığında o araç otomatik seçilerek menü kapanacak.
- **Sağ Tık (`e.button === 2`) ile Tuval Kaydırma ve Seçili Nesne Bağlam Menüsü (`src/components/CanvasBoard.tsx`)**:
  - Sağ tık basılı tutulup sürüklendiğinde tuval kaydırılacak (`pan`); sürükleme yapıldıysa sağ tık bırakıldığında bağlam menüsü açılmayacak.
  - Bir nesne üzerine sağ tıklandığında (sürüklemeden) açılan sağ tık hızlı işlemler menüsündeki butonların çalışmama sorunu (`handlePointerDown` içinde menünün tıklama gerçekleşmeden kapatılması) giderilecek; tüm katman, çoğaltma, döndürme, kilitleme, renk ve silme butonları sorunsuz çalışacak.

## 4. Konsol Hatalarının Giderilmesi
- **Favicon 404 Hatası (`index.html`)**:
  - `index.html` içerisine inline SVG veri URI formatında `<link rel="icon" ...>` eklenerek `/favicon.ico` 404 hatası tamamen ortadan kaldırılacak.
- **Passive Event Listener `preventDefault` Hatası (`src/components/CanvasBoard.tsx`)**:
  - React'in pasif `onWheel` dinleyicisi yerine `containerRef` üzerine `useEffect` ile `{ passive: false }` bayraklı yerel `wheel` dinleyicisi bağlanarak konsoldaki `Unable to preventDefault inside passive event listener invocation` hatası tamamen giderilecek.

## 5. Karşılama Ekranı Sabit Boyut & İç Kaydırma ve Google Auth / Firebase Düzeltmesi
- **Karşılama Kartı Boyutlandırması (`src/components/UserSetupModal.tsx`)**:
  - Karşılama ekranındaki kart her cihazda sabit genişlik (`max-w-[460px] w-full`) ve maksimum yükseklik (`max-h-[88vh] flex flex-col`) değerlerine sahip olacak; içerik taştığında kartın gövdesi özel ince kaydırma çubuğu (`overflow-y-auto`) ile kaydırılacak.
- **Google ile Giriş ve Firebase Senkronizasyonu (`src/firebase.ts`, `src/hooks/useFirebaseSync.ts`, `src/components/UserSetupModal.tsx`)**:
  - `firebase-applet-config.json` yapılandırması ile Google Auth (`signInWithPopup` ve ortam kısıtlamalarına karşı güvenli hata yönetimi / oturum kalıcılığı) ve Firestore oda/element senkronizasyonu iyileştirilecek.

## 6. Markdown (`.md`) Dosya Desteği, Tuval Doküman Kartı ve Önizleme
- **Dosya Kasası ve Tuval Desteği (`src/types/canvas.ts`, `src/components/FileShareModal.tsx`, `src/components/CanvasBoard.tsx`, `src/utils/canvasRenderer.ts`)**:
  - `.md` (Markdown) dosyalarının yüklenmesi, Dosya Kasası içerisinde biçimlendirilmiş tam ekran önizleme modalında görüntülenmesi ve tuvale eklendiğinde başlıkları, listeleri ve kod blokları biçimlendirilmiş etkileşimli doküman kartı olarak çizilmesi sağlanacak.

## 7. Tema Uyumu, Geçiş Animasyonları ve AI Çizim Motoru
- **Tema Uyumlu Araç Çubukları (`src/components/Toolbar.tsx`, `src/components/StyleBar.tsx`, `src/components/VoiceChatBar.tsx`, `src/components/CanvasQuickAccess.tsx`)**:
  - Açık, Koyu, Gece (`midnight`) ve Sepya (`sepia`) temalarının tamamında araç çubukları, sağ tık menüsü ve alt panellerin arka plan, kenarlık ve metin renkleri aktif temaya tam uyumlu hale getirilecek.
  - Karşılama ekranı, modallar ve araç çubuklarına akıcı açılış ve geçiş animasyonları eklenecek.
- **AI Çizim Motoru (`server.ts`, `src/components/AIPromptModal.tsx`)**:
  - `@google/genai` SDK çağrıları güncel `gemini-3-flash-preview` modeliyle yapılandırılarak JSON ayrıştırma ve SVG/vektör üretim hataları giderilecek; anlamlı hata mesajları ve tek tıkla yeniden deneme akışı güçlendirilecek.

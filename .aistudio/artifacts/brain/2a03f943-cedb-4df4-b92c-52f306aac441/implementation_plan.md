# CollabBoard Kapsamlı Etkileşim, Performans ve Arayüz İyileştirme Planı

Bu plan; beyaz tahta çizim motoru, çoklu kullanıcı imleç senkronizasyonu, medya/dosya performans optimizasyonu, araç çubuğu ve üst bar yerleşimi ile ortak kod editöründeki 14 kritik sorunun kalıcı olarak çözülmesini kapsar.

## Kullanıcı Onayı ve Kritik Kararlar

> [!IMPORTANT]
> Kullanıcımızla yapılan soru-cevap aşamasında aşağıdaki 3 temel tasarım ve sınır kararı kesinleştirilmiştir:

- **Karar 1 — Video Süre ve Boyut Sınırı**: Tahtaya eklenecek videolar için **maksimum 3 dakika (180 saniye) süre ve 50 MB dosya boyutu** sınırı uygulanacaktır. Sınırı aşan videolar belleğe yüklenmeden önce hızlı meta veri kontrolüyle engellenecek ve kullanıcıya net bir uyarı gösterilecektir.
- **Karar 2 — Sohbet Hızlı Tepki Konumu**: Hızlı tepki emojileri gönderildiğinde hem **sohbet çekmecesinin sol üst kenarında** (çekmece kapalıysa sohbet butonunun hemen altında) canlı animasyon olarak belirecek hem de **ilgili mesaj balonunun üzerinde** tepki rozeti olarak gösterilecektir.
- **Karar 3 — Dikey Araç Çubuğu Düzeni**: Araç çubuğu dikey moda alındığında ekran dışına taşmaması ve rahatça sürüklenebilmesi için **iki sütunlu kompakt dikey panel** düzenine geçecek ve en üstünde sabit bir **sürükleme tutamacı** yer alacaktır.

---

## 1. Genel Bakış ve Temel Kavram

- **Ne Yapar**: CollabBoard üzerindeki gerçek zamanlı iş birliği araçlarını (imleçler, ping, sohbet tepkileri), çizim kalitesini (yumuşak kalem eğrileri, görünür silgi ve kalem ucu imleçleri, ekran dışı fare koruması), medya/dosya performansını (video süre/boyut kontrolü, tüm dosya türlerinin anında tahtaya eklenmesi) ve çalışma alanı ergonomisini (taşmayan üst bar, iki sütunlu taşınabilir dikey araç çubuğu, tam ekran kod editörü ve doğrudan yazılabilir interaktif terminal) kusursuz hale getirir.
- **Hedef Kullanıcı Deneyimi**: Çoklu kullanıcıyla aynı anda çalışırken sıfır takılma, sıfır ekran taşması ve kesintisiz çizim/kodlama akışı.

---

## 2. Kullanıcı Deneyimi ve Görsel Tasarım

### A. Tuval Çizim, İmleç ve Gerçek Zamanlı Etkileşim Akışı
1. **Tuvali Kaydırırken (Pan) İmleç İzolasyonu**:
   - Kullanıcıların imleç konumları ekran pikseli yerine **evren/tuval koordinatı (`worldX, worldY`)** olarak senkronize edilir.
   - Bir kullanıcı "Tuvali Kaydır (El)" aracıyla kendi ekranını kaydırdığında diğer kullanıcıların imleçleri tuval üzerindeki gerçek konumlarında sabit kalır; kaydırma yapan kullanıcının kendi ekran kaydırması diğer ekranlarda sahte imleç hareketi yaratmaz.
2. **Yumuşak Kalem Çizimi (Quadratic Bezier & Nokta Filtreleme)**:
   - Serbest çizim kalemi ve fosforlu kalem, kırıklı düz çizgiler yerine ardışık orta noktalar arasında **ikinci dereceden Bezier eğrileri (`quadraticCurveTo`)** ve hız tabanlı sönümleme kullanarak pürüzsüz, doğal el yazısı kalitesinde çizim üretir.
3. **Görünür Silgi ve Özel Kalem İmleci**:
   - **Silgi (`Öğe Silgisi` ve `Hassas Silgi`)**: Fare ucunda çift halkalı (dış koyu kontrast halka + iç kırmızı/beyaz yarı saydam silme alanı) canlı bir silgi dairesi ve silme izi gösterilir.
   - **Kalem & Fosforlu Kalem**: Kalemin seçili rengini ve kalınlığını tam uç noktasında gösteren özel açılandırılmış SVG kalem imleci kullanılır.
4. **Ekran Dışına Çıkma (Out-of-Bounds) Koruması**:
   - Çizim, silme, taşıma, boyutlandırma veya çoklu seçim yapılırken `Pointer Capture` ve pencere genelindeki (`window`) `pointerup` / `pointercancel` / `blur` dinleyicileri devreye girer. Fare ekranın veya pencerenin dışına çıksa bile işlem kopmaz, takılı kalmaz ve koordinatlar güvenli sınırlar içinde tutulur.
5. **Canlı Ping (Konum İşareti) Aracı**:
   - Ping aracına tıklanıp tuvalde herhangi bir noktaya basıldığında (veya kısayol kullanıldığında), hem yerel ekranda hem de odadaki tüm kullanıcılarda iç içe genişleyen 3 halkalı sonar dalgası ve kullanıcı adı rozeti tam tuval koordinatında belirir.

### B. Arayüz Ergonomisi: Üst Bar, İki Sütunlu Dikey Araç Çubuğu ve Sohbet Tepkileri
1. **Taşmayan Üst Bar (`TopNav`)**:
   - Üst bar 3 bölgeli esnek sıkıştırma yapısına kavuşturulur; orta ve dar ekranlarda ikincil metin etiketleri otomatik daralır, sağ uçtaki **Dışa Aktar** butonu her zaman sabit (`shrink-0`) ve görünür kalır.
2. **İki Sütunlu Kompakt Dikey Araç Çubuğu**:
   - Dikey görünüm seçildiğinde araçlar tek bir uzun şerit yerine **2 sütunlu kompakt ızgara** halinde dizilir.
   - Üst kısımdaki belirgin sürükleme başlığı ile panel ekranın herhangi bir noktasına taşınabilir ve ekran sınırları içinde otomatik hizalanır.
3. **Sohbet Hızlı Tepki Gösterimi**:
   - Hızlı tepki emojilerine basıldığında sohbet çekmecesinin **sol üst kenarında** yumuşak bir animasyonla yüzen tepki kartı çıkar ve aynı anda sohbet akışındaki son mesaj balonuna tepki rozeti eklenir.

### C. Medya, Dosya Optimizasyonu ve AI Çizim Geliştirmeleri
1. **Video Süre (Maks. 3 Dk) & Boyut (Maks. 50 MB) Sınırı ve Bellek Yönetimi**:
   - Video seçildiğinde önce hafif bir `ObjectURL` üzerinden süresi ve boyutu kontrol edilir; 3 dakikayı veya 50 MB'ı aşan videolar reddedilir.
   - Video silindiğinde medya kaynağı (`pause()`, `removeAttribute('src')`, `revokeObjectURL`) anında temizlenerek kasma ve çökme önlenir.
   - Seçili videonun köşe ve kenar boyutlandırma tutamaçları en-boy oranını koruyarak akıcı şekilde çalışır.
2. **Tüm Dosyaların Anında Tahtaya Eklenmesi**:
   - Görsel, PDF ve videoların yanı sıra Word, Excel, PowerPoint, metin ve arşiv dosyaları da tek tıkla veya sürükle-bırak ile tahtaya **etkileşimli Belge Kartı** olarak anında eklenir.
3. **Geliştirilmiş AI Çizim Motoru**:
   - Üretilen şekil gruplarının koordinat merkezi ve boyut ölçeği otomatik dengelenir (tuval dışına taşma veya üst üste binme önlenir), zenginleştirilmiş vektör bileşenleriyle daha tutarlı diyagram ve nesneler çizilir.

### D. Kod Editörü: Gerçek Tam Ekran ve Doğrudan Yazılabilir İnteraktif Terminal
1. **Gerçek Tam Ekran (`100vw x 100vh`)**:
   - Tam ekran butonuna basıldığında kod editörü kenar boşluğu bırakmadan tüm çalışma alanını (`fixed inset-0 z-50`) kaplar; `Esc` veya küçültme butonuyla normal boyuta döner.
2. **Doğrudan Yazılabilir Terminal (Ayrı Girdi Kutusu Kaldırıldı)**:
   - Alt barda yer alan ayrı `Girdi (stdin)` butonu ve çekmecesi kaldırılır.
   - Terminal konsolu doğrudan etkileşimli hale getirilir: kullanıcı terminal içindeki komut/girdi satırına doğrudan yazı yazıp `Enter` tuşuyla girdiyi gönderebilir ve kodu çalıştırabilir.

---

## 3. Temel Ürün Kararları ve Teknik Gerekçeler

- **Karar 1 — Ekran Koordinatı Yerine Evren (World) Koordinatı Senkronizasyonu**:
  - *Seçilen Yaklaşım*: İmleç ve ping verilerini `( (screenX - pan.x) / zoom, (screenY - pan.y) / zoom )` dönüşümüyle tuval koordinatı olarak göndermek.
  - *Neden*: Farklı yakınlaştırma veya kaydırma konumundaki kullanıcıların birbirlerinin imleçlerini her zaman doğru nesne üzerinde görmesini sağlar ve kaydırma sırasında oluşan sahte imleç kaymalarını tamamen bitirir.
- **Karar 2 — Video ve Dosyalarda `ObjectURL` Önbellekleme + Meta Veri Ön Doğrulaması**:
  - *Seçilen Yaklaşım*: Dosyaları önce boyut ve süre açısından doğrulamak, tuval üzerinde önbelleğe alınmış `HTMLImageElement` / `HTMLVideoElement` referanslarıyla çizmek.
  - *Neden*: Dev Base64 dizilerinin her karede yeniden çözümlenmesini önleyerek 60 FPS akıcılık sağlar ve bellek taşmasını engeller.

---

## 4. Teknik Mimari ve Veri Akışı

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        ÜST BAR (Esnek 3-Bölge Düzeni)                        │
│  [Logo & Oda] ─── [AI · Şablon · Kod · Not · Dosya · Sohbet] ─── [Dışa Aktar]│
└─────────┬──────────────────────────────────────────────────────┬─────────────┘
          │                                                      │
          ▼                                                      ▼
┌─────────────────────────────────────────┐    ┌───────────────────────────────┐
│        TUVAL & ÇİZİM MOTORU             │    │   ORTAK KOD EDİTÖRÜ (IDE)     │
│  • Evren Koordinatlı İmleç & Ping       │    │  • Gerçek Tam Ekran (inset-0) │
│  • Bezier Yumuşatma (Kalem/Fosforlu)    │    │  • Çoklu Kullanıcı İmleçleri  │
│  • Görünür Silgi Halka & Özel Kalem Ucu │    │  • Doğrudan Yazılabilir       │
│  • Pointer Capture (Ekran Dışı Koruma)  │    │    İnteraktif Terminal        │
│  • 2 Sütunlu Sürüklenebilir Dikey Araç  │    └───────────────────────────────┘
└─────────┬───────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 MEDYA, DOSYA & SOHBET HIZLI TEPKİ KATMANI                    │
│  • Video Doğrulayıcı (Maks. 3 Dk / 50 MB) + Anında Bellek Temizleme          │
│  • Tüm Dosya Türleri İçin Anında Tuval Kartı / Görsel / PDF / Video Ekleme   │
│  • Sohbet Sol Üst Kenar Yüzen Tepki Animasyonu + Mesaj İçi Tepki Rozeti      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Etkileşimli Bileşen ve Durum Eşlemesi
- **Tuval Etkileşim Katmanı**: `pointerdown` anında aktif pointer yakalanır (`setPointerCapture`), ekran dışına çıkılsa dahi `window` dinleyicileriyle çizim güvenli şekilde tamamlanır. Kaydırma (`pan`) modunda imleç yayını dondurulur.
- **Dikey Araç Çubuğu**: `orientation === 'vertical'` olduğunda 2 sütunlu ızgara ve üst sürükleme tutamacı aktifleşir; sürükleme koordinatları ekran sınırlarına (`clamp`) göre korunur.
- **Kod Editörü İnteraktif Terminali**: Konsol alanı her zaman görünür veya tek tıkla açılır; içinde doğrudan odaklanılabilen `>` komut/girdi satırı bulunur, yazılan girdiler geçmiş çıktılarla birlikte terminal ekranında listelenir ve derleyiciye aktarılır.

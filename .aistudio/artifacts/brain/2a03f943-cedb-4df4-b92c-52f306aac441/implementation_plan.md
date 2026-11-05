# CollabBoard — Arayüz Düzeni, Zengin Şekil Kütüphanesi ve Etkileşim İyileştirmeleri Planı

Bu güncelleme; **Örnek Kodlar** menüsünün fareyle üzerine gelindiğinde kaybolması sorununu, **Kutucuk Gizle/Göster** mekanizmasını, **Tanıtım Turu (Spotlight)** alanının bulanık görünmesi sorununu, **Ok (`Arrow`)** ucunun taşma hatasını düzeltir; **Microsoft Office tarzı genişletilmiş şekil kütüphanesini** ve bileşenlerin üst üste binmesini engelleyen **Üst/Alt Kenetlenen Düzenli Flex Bar + Serbest Taşıma** yerleşim sistemini ekler.

---

## Kullanıcı Onayı & Netleştirilen Kararlar

> [!IMPORTANT]
> Sorular üzerinden netleştirdiğimiz tercihler doğrultusunda aşağıdaki mimari kararlar uygulanacaktır:

- **Onaylanan Karar 1 (Zengin Şekil Kütüphanesi — Tüm Gruplar Dahil)**:
  1. *Akış Şeması & Diyagram Şekilleri*: Silindir (Veritabanı), Paralelkenar (Girdi/Çıktı), Altıgen (Hazırlık), Yamuk (Manuel İşlem).
  2. *Blok Oklar & Bağlayıcılar*: Çift Yönlü Ok, Kalın Blok Ok (Sağ/Sol/Yukarı/Aşağı), Dirsekli/Kıvrımlı Bağlayıcı Ok.
  3. *Konuşma Balonları, Bulut & Açıklama Kutuları (Callouts)*: Konuşma Balonu (Yuvarlak/Köşeli), Düşünce Bulutu, Not/Açıklama Balonu.
  4. *Semboller & Rozetler*: Kalp, Şimşek, Haç/Artı, Beşgen, Sekizgen, Bayrak/Flama.
- **Onaylanan Karar 2 (Çalışma Alanı Yerleşim Düzeni)**:
  - **Üst/Alt Kenarlara Kenetlenen Düzenli Flex Bar + Serbest Taşıma Geçişi**: Varsayılan olarak üstteki bileşenler (`Araç Çubuğu` ve `Sesli Kanal`) ile alttaki bileşenler (`Mini Harita + Izgara Seçici` ve `Stil Çubuğu`) düzenli Flex/Dock yuvalarında hizalanarak birbirinin üstüne asla binmez. Kullanıcı herhangi bir kutucuğu tutamacından sürüklediğinde **Serbest Taşıma (Free Form)** moduna geçer, `"Düzeni Sıfırla / Kenetle"` butonuyla tek tıkla düzenli Flex hizasına geri döner.

---

## 1. Genel Bakış & Çözülen Sorunlar

1. **Örnek Kodlar Menüsü Fare Etkileşimi (`Görsel 1`)**:
   - *Sorun*: `Örnek Kodlar` butonu ile açılan menü arasında `mb-2` (`8px`) boşluk bulunduğu için fareyi butondan menüye taşırken `:hover` durumu kopuyor ve menü hemen kapanıyordu.
   - *Çözüm*: Menü hem **tıklama (click toggle)** ile kalıcı açılır/kapanır hale getirilecek hem de buton ile menü arasına görünmez bir hover köprüsü (`pb-2`) eklenerek dışarı tıklanana veya bir şablon seçilene kadar açık kalması sağlanacak.
2. **Kutucukları Gizle / Göster Kontrolleri**:
   - *Sorun*: `Araç Çubuğu`, `Stil Çubuğu`, `Sesli Kanal` ve `Mini Harita` üzerindeki gizle (`EyeOff`) butonları kutuyu sadece daraltıyor veya tıklama olayları sürükleme katmanıyla çakışabiliyordu; ayrıca tamamen gizlenen kutucukları tek merkezden geri açacak net bir kontrol çubuğu yoktu.
   - *Çözüm*: Her kutucuktaki `Gizle` (`EyeOff`) butonu ilgili kutucuğu çalışma alanından **tamamen gizleyecek** ve kenetli kontrol şeridinde yer alan kompakt **"Görünüm & Kutucuklar" (`Araçlar`, `Stil`, `Ses`, `Harita`, `Izgara`)** hızlı anahtarlarından veya kendi mini sekmesinden tek tıkla anında geri açılabilecek.
3. **Tanıtım Turu (Spotlight) Netlik & Aydınlatma Düzeltmesi (`Görsel 2`)**:
   - *Sorun*: Tam ekran karartma katmanında bulunan `backdrop-blur-[1.5px]` ve `bg-slate-950/60` tüm ekranı kapladığı için vurgulanan (`Buradan Erişebilirsiniz`) hedef alanın içi de bulanık ve karanlık kalıyordu.
   - *Çözüm*: Tam ekran `backdrop-blur` kaldırılarak hedef kutunun etrafında **gerçek 4 parçalı çerçeve / şeffaf pencere (Cutout)** uygulanacak. Böylece vurgulanan araç çubuğu veya buton **%100 net, parlak ve tıklanabilir** görünürken yalnızca dışındaki alan karartılacak.
4. **Ok (`Arrow`) Ucu Taşma Hatası & Genişletilmiş Şekil Kütüphanesi (`Görsel 3`)**:
   - *Sorun*: Ok çizilirken gövde çizgisi (`lineCap = 'round'`) tam uç noktaya (`endX, endY`) kadar çizildiği için kalın çizginin yuvarlak ucu üçgen ok başlığının sivri ucundan dışarı taşıyordu.
   - *Çözüm*: Ok gövdesi çizgisi üçgen başlığın tabanında (`endX - headLength * 0.72 * Math.cos(angle)`) sonlandırılacak; böylece ok ucu her kalınlıkta jilet gibi keskin ve kusursuz bir üçgen olarak görünecek. Ayrıca kategorize edilmiş **Microsoft Office tarzı 18+ yeni vektörel şekil** eklenecek.
5. **Üst Üste Binmeyen Kenetlenmiş Flex Bar + Serbest Taşıma Düzeni (`Görsel 4`)**:
   - *Sorun*: Sol altta `Mini Harita` açıldığında `Noktalı / Izgara / Düz` seçicinin üstünü kapatıyor; üstte ise `Sesli Kanal` ve `Araç Çubuğu` dar ekranlarda çakışabiliyordu.
   - *Çözüm*: Üst ve alt çalışma alanı bölgeleri **Flex Dock** yapısına kavuşturulacak; `Izgara Seçici` doğrudan sol alt dock grubuna (`Mini Harita` ile yan yana, çakışmasız flex-row olarak) bağlanacak.

---

## 2. Kullanıcı Deneyimi & Görsel Tasarım

### A. Çalışma Alanı Yerleşim Mimarisi (Docked Flex Bar + Serbest Mod)
- **Üst Dock Şeridi (`Top Workspace Dock`)**:
  - Ortada `Araç Çubuğu`, sağda `Sesli Kanal` ve `Görünüm / Düzen` hızlı kontrolü yer alır; `flex-wrap` ve `gap-3` sayesinde hiçbir çözünürlükte üst üste binmez.
- **Alt Dock Şeridi (`Bottom Workspace Dock`)**:
  - Sol altta `Mini Harita` ve hemen yanında (dinamik genişliğe duyarlı flex öğesi olarak) `Noktalı | Izgara | Düz` seçicisi ile `Kutucuk Görünürlük` butonları yer alır.
  - Alt ortada `Stil & Tipografi Çubuğu` hizalanır.
- **Serbest Taşıma (Free Form) Geçişi**:
  - Kullanıcı herhangi bir kutucuğun solundaki tutamacı (`Grip`) sürüklediği anda o kutucuk kenetli Flex akışından çıkarak kullanıcının bıraktığı `(x, y)` koordinatına yerleşir. Tutamaca çift tıklandığında veya `"Düzeni Sıfırla"` seçildiğinde tekrar Flex yuvasına kenetlenir.

### B. Kategorili Şekil Seçici (Microsoft Office Tarzı)
Şekiller menüsü (`Toolbar`) 4 net kategoriye ayrılmış geniş bir görsel ızgara sunar:
1. **Temel Geometrik**: Dikdörtgen, Yuvarlatılmış Dikdörtgen, Daire/Elips, Eşkenar Dörtgen, Üçgen, Dik Üçgen, Beşgen, Altıgen, Sekizgen.
2. **Akış Şeması (Flowchart)**: Silindir (Veritabanı), Paralelkenar, Yamuk, Belge (Dalgalı Alt), Bulut.
3. **Oklar & Bağlayıcılar**: İnce Ok (Düzeltilmiş Sivri Uç), Çift Yönlü Ok, Sağ Blok Ok, Sol Blok Ok, Yukarı/Aşağı Blok Ok.
4. **Balonlar & Semboller**: Konuşma Balonu, Açıklama Balonu, Yıldız, Kalp, Şimşek, Haç/Artı, Bayrak.

---

## 3. Teknik Mimari & Veri Akışı

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Çalışma Alanı Yerleşim Yöneticisi                    │
│   [Kenetli Flex Düzeni (Varsayılan)]  <───>  [Serbest Taşıma (x, y)]    │
├───────────────────────────────────┬─────────────────────────────────────┤
│         ÜST KENETLİ KUŞAK         │          ALT KENETLİ KUŞAK          │
│  • Araç Çubuğu (Gizle/Göster)     │  • Sol: Mini Harita + Izgara Seçici │
│  • Sesli Kanal (Gizle/Göster)     │  • Orta: Stil & Font Çubuğu         │
│  • Kutucuk & Düzen Kontrolü       │  • Sağ: Hızlı Düzen / Odak Barı     │
└───────────────────────────────────┴─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 Vektörel Canvas Çizim Motoru (2D Context)               │
│  • Keskin Uçlu Ok Çizimi (Gövde kısaltma + Tam üçgen uç birleşimi)      │
│  • 20+ Parametrik Vektör Şekil (Silindir, Balon, Blok Ok, Semboller)    │
│  • Seçim, Döndürme, Aynalama ve Noktasal Silgi Uyumluluğu               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Etkileşim ve Durum Eşlemesi
- **Gizle / Göster Durumu (`panelVisibility`)**: `toolbar`, `stylebar`, `voicebar`, `minimap`, `gridbar` görünürlük durumları merkezi olarak yönetilir ve `localStorage`'da saklanır. Bir panel gizlendiğinde tamamen DOM'dan kalkar ve üst/alt görünüm çubuğundaki kompakt göz ikonlarından tek tıkla geri getirilir.
- **Spotlight Cutout Hesaplaması (`OnboardingTour`)**: Hedef öğenin `DOMRect` koordinatları alınarak 4 kenar (`üst`, `alt`, `sol`, `sağ`) karartma katmanı oluşturulur; orta pencere tamamen açık bırakılarak hedef bileşen cam gibi net gösterilir.
- **Vektör Şekil Örnekleme (`sampleShapeToWorldPoints` & `drawElement`)**: Yeni eklenen tüm şekiller hem `drawElement` içinde hem de noktasal silgi ve seçim sınır kutusu (`getElementBounds` / `isPointInsideElement`) içinde tam matematiksel koordinatlarıyla desteklenir.

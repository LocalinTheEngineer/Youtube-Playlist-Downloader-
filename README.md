# YouTube Playlist Downloader

Yerel bilgisayarda çalışan bir YouTube video ve playlist indiricisi. Bu depo
geliştirme aşamasındadır: ilk aşamada terminalden çalışan Python indirme motoru
bulunur. FastAPI backend'i, SQLite iş kayıtları ve SSE ilerleme akışı eklenmiştir;
React arayüzünde bağlantı inceleme, video seçimi, indirme ayarları ve kuyruk
ekranı hazırdır. Canlı ilerleme SSE üzerinden gelir; yeni işleri keşfetmek
ve bağlantı sorunlarında durumu almak için 15 saniyelik yedek sorgu kullanılır.

## Özellikler

- Tek video ve playlist bağlantılarını terminalden işleme
- Desteklenen YouTube alan adları için HTTPS URL doğrulaması
- 18 yaş kısıtlı içerikleri indirmeyi reddeden backend filtresi
- yt-dlp ile video ve playlist indirme, indirme ilerlemesini gösterme
- FFmpeg ile ayrı video ve ses akışlarını MP4 dosyasında birleştirme
- Tamamlanan videoları indirme arşivine kaydetme ve tekrarları atlama
- Bir playlist öğesi başarısız olduğunda diğer öğeleri işlemeye devam etme

Uygulama giriş veya tarayıcı çerezi istemez; özel ya da giriş gerektiren
içeriklere erişmeye çalışmaz. Yalnızca indirme hakkınız olan içerikleri kullanın
ve platform koşullarına uyun. Teknik bir araç olması telif veya kullanım izni
sağlamaz.

## Teknoloji ve veri akışı

```text
Terminal CLI -> URL doğrulama -> yt-dlp -> FFmpeg -> yerel dosyalar
```

Mimari, aynı Python indirme motorunu FastAPI üzerinden React
arayüzüne bağlar. İndirme kuyruğu, SSE ilerleme aktarımı ve SQLite geçmişi
backend'de uygulanmıştır.

## Gereksinimler

- Windows 10/11
- Python 3.12 (3.11 de desteklenmesi hedefleniyor)
- Node.js 22 veya üzeri; yt-dlp YouTube JavaScript doğrulaması için kullanır
- FFmpeg ve FFprobe; Windows PATH'inde bulunmalı
- Git

## Kurulum

PowerShell'de depo kökünden çalıştırın:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

FFmpeg/FFprobe ve Node.js'i işletim sisteminize kurup yeni bir terminal açın.
Sürümleri doğrulayın:

```powershell
python --version
node --version
ffmpeg -version
ffprobe -version
```

## Çalıştırma

Depo kökünden backend klasörüne geçin:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m app.cli "https://www.youtube.com/watch?v=VIDEO_ID" --output-dir ..\downloads
```

Playlist indirmek için `watch?v=...` yerine bir playlist URL'si verin:

```powershell
..\.venv\Scripts\python.exe -m app.cli "https://www.youtube.com/playlist?list=PLAYLIST_ID" --output-dir ..\downloads
```

İndirilen dosyalar seçilen klasöre, tekrar indirme arşivi ise aynı klasördeki
`.downloaded.txt` dosyasına yazılır. İndirilen medya ve yerel veriler Git'e
eklenmez.

## Yerel API

Önce `backend` klasöründe migration'ları uygulayın ve API'yi başlatın:

```powershell
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

API belgeleri `http://127.0.0.1:8000/docs` adresindedir.
`GET /api/system/check`, yt-dlp, yt-dlp-ejs, FFmpeg, FFprobe ve bu projede
kullanılan Node.js çalışma ortamının sürüm ve hazırlık durumunu döndürür.
Node.js 22 veya üzeri gerekir. Eksik veya çalışmayan bağımlılıklar `ready: false`
ve Türkçe açıklamayla bildirilir; tanılama endpoint'i HTTP 200 döndürür.
Kontrol backend açılışında da çalışır. Kurulumdan sonra PATH değişikliğinin
görülmesi için backend'i yeni bir terminalden yeniden başlatın.
`POST /api/media/inspect`, `{"url":"https://www.youtube.com/watch?v=VIDEO_ID"}`
gövdesiyle video veya playlist metadata'sını indirmeden inceler.
`POST /api/downloads` indirilecek bağlantıyı, isteğe bağlı video ID listesini,
çıktı dizinini ve `best/1080p/720p/480p/audio` preset'lerinden birini alır;
işi SQLite'a kaydeder ve tek tüketicili yerel kuyruğa ekler. API ile çıktı
yolu yalnızca proje içindeki `downloads/` klasörü altında seçilebilir.
`GET /api/downloads` geçmişi, `GET /api/downloads/{job_id}` iş durumunu verir.
`GET /api/downloads/{job_id}/events`, kalıcı iş ve video durumunu SSE üzerinden
yaklaşık saniyede bir gönderir; iş sonlandığında akışı kapatır.

`POST /api/downloads/{job_id}/cancel` bekleyen işi iptal eder veya çalışan işe
iptal sinyali gönderir. Çalışan iş için `cancel_requested` yanıtı gelir;
nihai durum GET/SSE üzerinden izlenir. İptal, indirme ilerlemesi ve işlem
aşamaları arasında kontrol edilir; devam eden FFmpeg işlemi bitene kadar
bekleyebilir. Tamamlanan dosyalar ve yarım kalan dosyalar korunur.
`POST /api/downloads/{job_id}/retry`, yalnızca başarısız işlerin tamamlanmamış
videoları için yeni bir iş oluşturur; önceki geçmiş kaydı değişmez.

Veritabanı SQLite dosyası varsayılan olarak `data/app.db` konumunda tutulur.
Bağlantı adresi `YTDL_DATABASE_URL` ortam değişkeniyle değiştirilebilir.

## Geliştirme durumu

1. Çekirdek terminal motoru: uygulandı
2. FastAPI, SQLite, iş kuyruğu, SSE, iptal ve yeniden deneme: uygulandı; sertleştirme sürüyor
3. React arayüzü: inceleme, seçim, kalite/alt klasör ayarları, indirme, kuyruk, iptal, yeniden deneme ve SSE uygulandı
4. Güvenlik sertleştirmesi ve otomatik testler: planlandı
5. Masaüstü paketleme ve dağıtım: planlandı

Backend testlerini `backend` klasöründe çalıştırın:

```powershell
..\.venv\Scripts\python.exe -m pytest -q
```

Bu testler geçici veritabanı ve taklit indirme adaptörü kullanır; gerçek
YouTube indirmesi yapmaz. Gerçek indirme ve FFmpeg iptal davranışı için
ayrıca isteğe bağlı entegrasyon doğrulaması gerekir.

## React arayüzünü açma

Backend açıkken ikinci bir terminalde proje kökünden:

```powershell
Set-Location frontend
npm ci
npm run dev
```

`http://localhost:5173` adresinde bağlantı inceleyebilir, video listesini
görebilir, seçim yapabilir ve indirmeyi başlatabilirsiniz. Çıktı biçimi MP4 veya
MP3 olarak seçilir; hedef alanına `downloads` altındaki klasör adı yazılır.
İşletim sistemi klasör seçicisi henüz eklenmedi. Kuyruk, video ilerlemesi,
hız ve kalan süreyi gösterir; çalışan işler iptal edilebilir, başarısız
işlerin kalan videoları yeni bir işte yeniden denenebilir.
Arayüz testleri için `npm test`, denetim için `npm run lint`, üretim derlemesi
için `npm run build` çalıştırın.

## Lisans ve üçüncü taraf yazılımlar

Bu projenin özgün kaynak kodu MIT Lisansı ile sunulur. Python paketleri
`backend/requirements.txt` içinde sabitlenmiştir. FFmpeg/FFprobe sistemde ayrı
kurulur; yt-dlp ve diğer bağımlılıkların kendi lisansları geçerlidir. Uygulama
paketlenip dağıtılmadan önce bağımlılık bildirimleri ve ilgili lisans koşulları
ayrıca gözden geçirilmelidir.

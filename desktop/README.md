# Playlist Studio masaüstü kabuğu

Electron uygulaması React üretim arayüzünü ve FastAPI backend'ini tek pencerede
başlatır. Geliştirme sürümü mevcut `.venv` sanal ortamını, sistemdeki
FFmpeg/FFprobe'u ve Electron'un Node.js çalışma zamanını kullanır.

Proje kökünde backend sanal ortamı kurulu olmalıdır. Ardından:

```powershell
Set-Location desktop
npm ci
npm run dev
```

Uygulama açılırken boş bir yerel port seçer, backend hazır olana kadar bekler ve
arayüzü gösterir. Veritabanı kullanıcı uygulama verisi klasöründe, indirilenler
ise Windows `Downloads/Playlist Studio` klasöründe tutulur. Pencere kapandığında
uygulamanın başlattığı backend süreç ağacı da kapatılır.

## Windows kurucusu

```powershell
Set-Location desktop
npm run dist
```

Bu komut React arayüzünü derler, Python servisini tek bir Windows yürütülebilir
dosyasına dönüştürür, FFmpeg/ffprobe çalışma dosyalarını ekler ve NSIS kurucusunu
`desktop/release` klasörüne yazar. FFmpeg farklı bir klasördeyse önce
`YTDL_FFMPEG_BIN` ortam değişkenini o klasöre ayarlayın.

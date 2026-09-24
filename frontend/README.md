# Playlist Studio arayüzü

React, TypeScript ve Vite ile yerel indirme uygulamasının arayüzü.
Bağlantı inceleme, video seçimi, bağımlılık durumu, kalite/format ve hedef
alt klasör ayarları uygulanmıştır. Seçilen videolar API üzerinden kuyruğa
eklenir. İlerleme SSE üzerinden gelir; iptal ve başarısız videoları yeniden
deneme desteklenir. En fazla iki aktif işe SSE bağlantısı açılır; diğer işler
ve bağlantı kesintileri için 15 saniyelik yedek sorgu kullanılır. Tarayıcının
EventSource yeniden bağlanma mekanizması korunur; iş bittiğinde veya bileşen
kaldırıldığında bağlantı kapatılır. Hatalı olay verisi durumu değiştirmez.

Node.js 22.12+ veya 24 kullanın. Backend'i proje kökündeki README'ye göre
`127.0.0.1:8000` üzerinde başlatın. Bu klasörde:

```powershell
npm ci
npm run dev
```

Tarayıcıdan `http://localhost:5173` adresini açın. Backend CORS politikası bu
yerel origin'i kabul eder. API adresi `src/services/api.ts` içinde tek yerde
tanımlıdır. Seçimler Zustand, API istekleri TanStack Query ile yönetilir.

```powershell
npm test
npm run lint
npm run build
```

Testler API'yi taklit eder ve medya indirmez. Kilit dosyası bağımlılıkların
aynı sürümlerle kurulmasını sağlar. Üretim paketi `dist/` altında oluşturulur.

## Vercel demosu

Üretim derlemesinde `VITE_API_BASE_URL` tanımlı değilse arayüz otomatik olarak
güvenli demo moduna geçer. Bu mod örnek playlist verileri ve tarayıcı içi bir
ilerleme simülasyonu kullanır; YouTube'a istek göndermez ve medya indirmez.
Ziyaretçiler hesap açmadan kalite, video seçimi, kuyruk ve iptal akışlarını
deneyebilir.

Vercel projesinde **Root Directory** olarak `frontend` seçin. Framework Preset
`Vite`, Build Command `npm run build`, Output Directory `dist` olmalıdır.
Demo için ortam değişkeni gerekmez. `vercel.json`, SPA yönlendirmesini içerir.

Canlı bir API daha sonra yayımlanırsa `VITE_API_BASE_URL` ortam değişkenine
`https://.../api` adresi verilir. Demo modunu zorlamak için
`VITE_DEMO_MODE=true` kullanılabilir.

# Playlist Studio arayüzü

React, TypeScript ve Vite ile yerel indirme uygulamasının arayüzü.
Bağlantı inceleme, video seçimi ve bağımlılık durumu ilk aşamada uygulanmıştır.
İndirmeyi başlatma, kalite ayarları ve canlı kuyruk ekranı sonraki aşamadadır.

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

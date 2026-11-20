# شب‌تاز: مسابقه شبانه (ShabTaz: Night Race)

> یک مسابقه‌ی آرکید نئون top-down با مسیر procedural روزانه و سه رقیب ghost deterministic — PWA با Vanilla JS.

[![Version](https://img.shields.io/badge/version-v0.0.3-blue)](https://github.com/andrbi107/shabtaz-night-race/releases/tag/v0.0.3) [![PWA](https://img.shields.io/badge/PWA-installable-purple)](https://andrbi107.github.io/shabtaz-night-race/) [![No deps](https://img.shields.io/badge/dependencies-none-success)](https://github.com/andrbi107/shabtaz-night-race) [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

🎮 **[بازی کن](https://andrbi107.github.io/shabtaz-night-race/)** — نسخه‌ی آنلاین روی GitHub Pages
📦 **[مخزن گیت‌هاب](https://github.com/andrbi107/shabtaz-night-race)** · 🏷️ **[Release v0.0.3](https://github.com/andrbi107/shabtaz-night-race/releases/tag/v0.0.3)**

---

## تغییرات v0.0.2 (جدید)

**شب‌تاز** — nitro boost با شارژ مجدد: دکمه‌ی ⚡ روی صفحه (و کلید N/Shift)، نوار سوخت در HUD، سقف سرعت را ۱.۵۵× بالا می‌برد (~۲s استفاده، ~۸s شارژ). haptic روی wall/lap/finish.

**همه‌ی بازی‌ها** — `mobile-ux.js` مشترک (haptics/install prompt/version stamp) + cache sw.js به v2.

---

## تغییرات v0.0.3 (جدید)

**شب‌تاز** — mini-map از روی دکمه‌های فرمان جابجا شد (به گوشه‌ی بالا-چپ)؛ بازی روی موبایل قابل‌بازی شد.

---

## معرفی

شب‌تاز یک مسابقه‌ی آرکید top-down نئون است. هر روز یک مسیر procedural جدید از seed تاریخ همان روز تولید می‌شود، پس همه در یک روز **همان مسیر** را در برابر **همان سه رقیب AI ghost** می‌رانند. مسابقه ۳ دور است. بهترین lap و بهترین زمان کل در هر روز در `localStorage` ذخیره می‌شود و نتایج اخیر در یک آرایه‌ی history نگه‌داری می‌شود.

هویت بصری نئون festal فارسی است: زعفران `#ffb62e`، turquoise `#35e0c6`، magenta `#ff5575`، violet `#b69cff` روی زمین indigo تیره، با starfield parallax و دو هاله‌ی nebula. مسیر یک نوار closed-loop است که از Catmull-Rom smoothing روی waypointهای seeded می‌گذرد؛ لبه‌ی درونی cyan، بیرونی magenta، خط dashed ریسینگ، و start/finish یک نوار checkered. یک mini-map گوشه‌ی پایین-راست کل مسیر + نقاط AI + بازیکن را نشان می‌دهد.

## ویژگی‌ها

- **seed روزانه deterministic** — `seed = floor(Date.now()/86400000)`؛ `mulberry32` PRNG؛ همان روز = همان مسیر + همان رقیبان.
- **مسیر Catmull-Rom** — ۱۴ نقطه‌ی کنترل با radius variation seeded، ۱۸ segment به ازای هر نقطه → ۲۵۲ نقطه‌ی centerline با tangent/normal/arc-length.
- **فیزیک ماشین** — steering با speed scale (در توقف نمی‌چرخد)، friction، brake، max speed.
- **wall collision arcade** — خروج از لبه = push back + cut سرعت به ~۵۸٪ (بدون damage).
- **collision ماشین-ماشین** — دایره‌ای، جداسازی برابر + blend سرعت.
- **lap detection index-wrap** — عبور از ۲۸٪ آخر به ۲۸٪ اول = +۱ lap؛ عبور برعگی نادیده.
- **۳ رقیب AI ghost** با سرعت seeded (یکی سریع‌تر از max بازیکن، یکی مشابه، یکی کندتر) + offset جانبی seeded.
- **دوربین non-rotating smooth follow**؛ در منو دوربین مسیر را orbit می‌کند (preview زنده).
- **wrong-way detection** با هشدار magenta «اشتباه می‌روی!».
- **رکوردهای روزانه** در `localStorage` (`shabtaz.bestLap.<day>`, `shabtaz.bestTotal.<day>`) + history (cap ۲۰).
- **کنترل کامل تاچ + کیبورد + موس** (با hint «دستگاه را بچرخان» در portrait).
- **PWA آفلاین** با رابط RTL فارسی.

## نحوه‌ی بازی

| دستگاه | فرمان | گاز | ترمز | توقف/صدا |
|---|---|---|---|---|
| **کیبورد** | ←/→ یا A/D | ↑ یا W | ↓ یا S | P/Esc توقف · M mute |
| **تاچ** | ◀ ▶ پایین-چپ | ▲ پایین-راست | ▼ پایین-راست | دکمه‌های HUD |
| **موس** | دکمه‌های ◀ ▶ روی صفحه | دکمه‌ی ▲ | دکمه‌ی ▼ | — |

### مکانیک بازی

- **seed روزانه**: `dayNumber() = floor(Date.now()/86400000)`؛ `generateTrack(seed)` با `mulberry32`.
- **تولید مسیر**: ۱۴ نقطه‌ی کنترل روی دایره با radius variation seeded → Catmull-Rom با ۱۸ segment → ۲۵۲ نقطه با tangent/normal/arc-length.
- **فیزیک بازیکن**: accel = `pAccel`، friction = `pFriction`، brake = `pBrake`، max = `pMax`؛ steering = `pTurn*(0.35 + speedFactor*0.85)`.
- **wall collision**: نزدیک‌ترین index centerline با spiral search ±۲۶؛ offset جانبی اگر `>trackHalf - carWid/2` → push back + cut ~۵۸٪.
- **lap**: عبور index از ۲۸٪ آخر به ۲۸٪ اول = +۱ lap؛ `lap>=3` = `finishRace()`.
- **AI**: هر کدام `progress += baseSpeed`؛ موقعیت = `center[idx] + normal*lateral`؛ heading = tangent centerline.
- **رتبه**: همه بر اساس `lap*totalLength + progress` نزولی.
- **دوربین**: `cam += (player - cam)*0.12`؛ در منو orbit آرام.
- **رکورد**: `shabtaz.bestLap.<day>`/`bestTotal.<day>` + push به `shabtaz.history` (cap ۲۰).
- **wrong-way**: dot product heading·tangent `< -0.25` هنگام حرکت = هشدار.
- **صدا**: WebAudio square-wave beepها برای wall/collision/lap/GO/finish؛ `M` mute (persist).

## نصب روی موبایل/دسکتاپ (PWA)

1. لینک بازی را در **Chrome** یا **Edge** باز کنید (اندروید/دسکتاپ) یا **Safari** (iOS).
2. منوی مرورگر → **Install app** / **Add to Home screen** (اندروید) یا **Share → Add to Home Screen** (iOS).
3. آیکن روی صفحه‌ی اصلی ظاهر می‌شود؛ اجرای آن تمام‌صفحه و مستقل از مرورگر است.
4. پس از اولین بارگذاری، بازی **بدون اینترنت** هم کار می‌کند (service worker کل shell را cache کرده است).

## تکنولوژی

- **HTML5 `<canvas>`** — تمام رندر با primitives (`arc`, `fillRect`, `translate`, `rotate`, `shadowBlur`).
- **Vanilla JavaScript** — بدون هیچ کتابخانه، framework یا CDN.
- **CSS** با `clamp()` برای تایپوگرافی responsive، `safe-area-inset` برای notch موبایل، و `100dvh`.
- **PWA**: `manifest.json` + `sw.js` (service worker که کل shell را precache می‌کند) → بازی پس از اولین بارگذاری **کاملاً آفلاین** و **قابل نصب** روی اندروید/iOS/دسکتاپ است.
- بدون تصویر، فونت یا فایل صوتی خارجی — همه‌چیز با کد تولید می‌شود.

## ساختار پروژه

| فایل | نقش |
|---|---|
| `index.html` | Persian RTL، frame 16:9، canvas `#game` 1600×900، HUD، کنترل‌های تاچ، mini-map، overlayها |
| `styles.css` | نئون responsive؛ `#frame` = `min(100vw, 177.78vh)` با `aspect-ratio:16/9`؛ clamp؛ rotate hint |
| `main.js` | کل بازی: PRNG، تولید مسیر، فیزیک ماشین، AI، collision، lap، رکوردها، render، mini-map، HUD، صدا، loop |
| `manifest.json` | PWA، `orientation:landscape`، icon `any maskable` |
| `sw.js` | precache ۶ فایل shell + cache-first با fallback |
| `icon.svg` | ماشین زعفران نئون روی مسیر تیره با لبه‌های magenta/cyan |

## شخصی‌سازی

در `main.js`:

- `CFG.trackHalf` (۷۴) — عرض مسیر.
- `CFG.laps` (۳) — طول مسابقه.
- `CFG.carLen`, `CFG.carWid` (۳۶، ۲۰) — اندازه‌ی ماشین.
- `CFG.pMax`, `CFG.pAccel`, `CFG.pBrake`, `CFG.pFriction`, `CFG.pTurn` — handling بازیکن.
- `AI_DEFS` — نام، رنگ، سرعت base، offset شروع هر رقیب.
- `PLAYER_LATERAL` (+۱۸) — slot grid بازیکن.
- `COL` — شیء پالت.
- در `generateTrack`: `N` (نقاط کنترل)، `baseR`، دامنه‌های radius variation (۳۰۰/۱۷۰/۲۲۰)، `seg` (رزولوشن spline).
- آستانه‌های lap/wrong-way: band `0.72/0.28` و dot threshold `-0.25`.

## توسعه و اجرای محلی

```bash
git clone https://github.com/andrbi107/shabtaz-night-race.git
cd shabtaz-night-race
# سرویس‌ورکر فقط روی http(s) ثبت می‌شود، پس یک سرور محلی راه بیندازید:
python3 -m http.server 8080
# سپس http://localhost:8080/ را در مرورگر باز کنید
```

برای آزمایش روی موبایل، می‌توانید پوشه را روی گوشی با یک سرور استاتیک سرو کنید یا از `ngrok`/مرورگر موبایل روی همان شبکه استفاده کنید.

## استقرار

محتوای شاخه‌ی `main` به‌صورت خودکار از طریق **GitHub Pages** سرو می‌شود:

**https://andrbi107.github.io/shabtaz-night-race/**

هیچ build stepی لازم نیست — همه‌ی مسیرها relative هستند (`./`)، پس بازی هم از root مخزن و هم از زیرپوشه کار می‌کند.

## نسخه‌گذاری (SemVer)

این پروژه از [Semantic Versioning](https://semver.org/lang/fa/) پیروی می‌کند:

- نسخه‌ها از **`0.0.1`** آغاز می‌شوند (مرحله‌ی پیش از پایداری نهایی؛ هر تغییر می‌تواند breaking باشد).
- قالب: `MAJOR.MINOR.PATCH` → در فاز 0.x: `0.MINOR.PATCH`.
- **هر توسعه یا شخصی‌سازی** در یک شاخه‌ی جداگانه انجام می‌شود:
  - `feat/<name>` برای قابلیت جدید یا شخصی‌سازی
  - `fix/<name>` برای رفع باگ
  - `docs/<name>` برای مستندسازی
  - `refactor/<name>` برای بازسازمان‌دهی کد
- پس از merge به `main`، تگ SemVer بعدی زده می‌شود و یک **GitHub Release** منتشر می‌گردد.
- RELEASE NOTES هر بار در صفحه‌ی Releases مخزن ثبت می‌شود.

### نقشه‌ی نسخه‌بندی پیشنهادی برای توسعه‌های بعدی

| نوع تغییر | bump | مثال |
|---|---|---|
| رفع باگ کوچک، tweak رنگ/عدد | PATCH | `0.0.1` → `0.0.2` |
| قابلیت جدید، مکانیک جدید، level جدید | MINOR | `0.0.1` → `0.1.0` |
| بازنویسی API/ساختار، تغییر breaking | MAJOR (هنوز در 0.x) | `0.1.0` → `0.2.0` |
| رسیدن به پایداری نهایی | — | `0.x.0` → `1.0.0` |

## لایسنس

MIT — استفاده، تغییر و بازنشر آزاد. ساختهشده بهعنوان یک مهارت/قالب آموزشی برای بازی‌سازی PWA با Vanilla JS.

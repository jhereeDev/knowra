# Mobile assets

App icon + splash artwork. Referenced from `apps/mobile/app.json`.

## What goes here

| File | Used for | Required size | Notes |
|---|---|---|---|
| `icon.png` | iOS app icon + fallback for everything | **1024×1024 PNG**, sRGB, no alpha for iOS | Apple rejects icons with transparency. Pad to a solid background if your art has transparent edges. |
| `adaptive-icon.png` | Android adaptive icon **foreground** | **1024×1024 PNG, transparent background** | Center the artwork inside a 66% safe zone — Android masks the corners into a shape (circle / squircle / squircle-rounded depending on launcher). |
| `splash-icon.png` | Splash screen logo | **1024×1024 PNG, transparent** | Renders centered over the brand background. Keep generous padding — it's scaled down. |
| `favicon.png` | Web `<link rel="icon">` | 48×48 or 192×192 PNG | Only matters for the marketing site `apps/web/`. |

If you only have one image right now, drop it as `icon.png` — `app.json` falls back to it for the adaptive icon and splash too. Replace with proper variants later for the best look.

## Where they're wired

See `apps/mobile/app.json`:

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": { "image": "./assets/splash-icon.png", ... },
    "android": {
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", ... }
    },
    "web": { "favicon": "./assets/favicon.png" }
  }
}
```

Changing any of these requires a fresh build (Metro doesn't hot-reload native assets). For a dev client: `eas build --profile development --platform ios`.

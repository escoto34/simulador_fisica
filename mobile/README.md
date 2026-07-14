# FísicaHN Android (APK)

App **Android** del simulador con **Capacitor** (WebView nativo).  
Fuente del lab: `skills/fisicahn/` (igual que web y desktop).

Versión de empaquetado: **1.3.0** · `applicationId`: `hn.fisica.simulador`  
Nombre en el menú del celular: **FísicaHN**

## ¿Para qué?

- Instalar el laboratorio en tablets y celulares (sin depender del navegador)
- Uso **offline** en el aula
- Mismo código que la web / Electron

## Requisitos

- Node.js 20+
- Android SDK (`ANDROID_HOME`) con Platform 35+, Build-Tools, Platform-Tools
- JDK **21** (Capacitor 7)

JDK portable del repo (si existe):

```text
tools/jdk-21/
```

```bash
export ANDROID_HOME="$HOME/Android/Sdk"   # o /opt/android-sdk
export JAVA_HOME="/home/escoto/Documentos/simulador fisica/tools/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
```

## Generar APK (release firmado) — flujo completo con desktop

Desde tu máquina (medido con v**1.3.0**):

```bash
# 1) Desktop Linux
cd "/home/escoto/Documentos/simulador fisica/desktop" && npm install && npm run dist:linux

# 2) Desktop Windows (si aplica)
npm run dist:win

# 3) APK firmado
cd "/home/escoto/Documentos/simulador fisica/mobile" && npm install
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME="/home/escoto/Documentos/simulador fisica/tools/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
npm run build:release
```

Solo Android:

```bash
cd mobile
npm install
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME="/ruta/al/repo/tools/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
npm run build:release
```

### Salida (`mobile/release/`)

| Archivo | Tamaño aprox. | Uso |
|---------|---------------|-----|
| **`FisicaHN-1.3.0-release.apk`** | **~3.5 MB** | **GitHub Releases / aula** (firmado) |
| `FisicaHN-1.3.0-debug.apk` | ~4.4 MB | Solo desarrollo |

Instalar:

```bash
adb install -r release/FisicaHN-1.3.0-release.apk
```

O copia el APK al dispositivo y ábrelo (permitir instalar apps desconocidas si hace falta).

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run sync` | `skills/fisicahn` → `mobile/www` |
| `npm run cap:sync` | Sync + `npx cap sync android` |
| `npm run apk` / `build:debug` | APK **debug** |
| `npm run build:release` | APK **release firmado** |
| `npm run open` | Abre Android Studio |

## Qué poner en GitHub Releases

En el release **v1.3.0** adjunta el APK firmado junto a los instaladores desktop:

- `mobile/release/FisicaHN-1.3.0-release.apk` ← **sí**
- `FisicaHN-1.3.0-debug.apk` ← **no** (salvo que quieras builds de prueba)

Ver también la tabla del README principal del repo.

## Firma release

| Archivo | Uso |
|---------|-----|
| `mobile/keystore/fisicahn-release.p12` | Keystore (local, **no git**) |
| `mobile/keystore/CREDENTIALS.txt` | Contraseñas (local, **no git**) |
| `mobile/android/key.properties` | Gradle (local, **no git**) |

```bash
$ANDROID_HOME/build-tools/*/apksigner verify --print-certs release/FisicaHN-*-release.apk
```

- **Backup** de `mobile/keystore/`: sin el mismo keystore no podrás actualizar la app con el mismo package id.
- Play Store (AAB opcional):

```bash
cd android && ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```

## Subir versión

1. `mobile/package.json` → `"version": "1.4.0"` (siguiente subida)
2. `mobile/android/app/build.gradle`:
   - `versionName "1.4.0"`
   - `versionCode` **+1** (p. ej. 4 → 5)
3. `npm run build:release`

## Estructura

```
mobile/
  www/                 # generada (sync); no editar a mano
  android/             # proyecto Gradle Capacitor
  keystore/            # local; gitignored
  scripts/sync-www.sh
  scripts/build-apk.sh
  release/             # APKs; gitignored
  capacitor.config.json
```

## Notas

- Trabajos: **localStorage** del WebView.
- Supabase / login docente: si hay red y `supabase-config.js` en el sync.
- Icono del launcher: generado desde `desktop/build/icon.png` (logo FísicaHN).

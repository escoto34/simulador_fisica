#!/usr/bin/env bash
# Arma website/ listo para GitHub Pages o Cloudflare Pages:
# copia el simulador desde skills/fisicahn, inyecta config Supabase si hay env, genera ZIP.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/skills/fisicahn"
DEST="$ROOT/website"
SIM="$DEST/sim"
DL="$DEST/downloads"
CFG="$DEST/js/supabase-config.js"

echo "→ Sincronizando simulador → website/sim"
rm -rf "$SIM"
mkdir -p "$SIM" "$DL" "$DEST/js" "$DEST/assets"
# Evita que Jekyll ignore rutas con _ (p. ej. _headers) en GitHub Pages
touch "$DEST/.nojekyll"
# copiar solo lo necesario del simulador
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  "$SRC/" "$SIM/"

# Logo / favicon del sitio también en el sim (rutas assets/)
if [[ -d "$DEST/assets" ]]; then
  mkdir -p "$SIM/assets"
  cp -f "$DEST/assets/logo.svg" "$SIM/assets/logo.svg" 2>/dev/null || true
  cp -f "$DEST/assets/favicon.svg" "$SIM/assets/favicon.svg" 2>/dev/null || true
fi

# Inyectar Supabase desde entorno (CI / local export)
# Solo URL + anon key. NUNCA service_role.
# Limpia comillas/espacios/CR que a veces se pegan al copiar secrets.
_raw_url="${SUPABASE_URL:-}"
_raw_key="${SUPABASE_ANON_KEY:-}"
_raw_url="${_raw_url//$'\r'/}"
_raw_key="${_raw_key//$'\r'/}"
_raw_url="$(printf '%s' "$_raw_url" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//')"
_raw_key="$(printf '%s' "$_raw_key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//')"

if [[ -n "$_raw_url" && -n "$_raw_key" ]]; then
  echo "→ Escribiendo website/js/supabase-config.js desde variables de entorno"
  echo "   URL host: $(printf '%s' "$_raw_url" | sed 's|https\?://||;s|/.*||')"
  echo "   anonKey longitud: ${#_raw_key}"
  if [[ "$_raw_url" != https://* ]]; then
    echo "ERROR: SUPABASE_URL debe empezar por https:// (valor actual inválido o incompleto)" >&2
    exit 1
  fi
  if [[ ${#_raw_key} -lt 20 || "$_raw_key" == *YOUR_* ]]; then
    echo "ERROR: SUPABASE_ANON_KEY parece un placeholder o es demasiado corta" >&2
    exit 1
  fi
  # Escapar para JS string (barras y comillas)
  _url="${_raw_url//\\/\\\\}"
  _url="${_url//\'/\\\'}"
  _key="${_raw_key//\\/\\\\}"
  _key="${_key//\'/\\\'}"
  cat > "$CFG" <<EOF
/**
 * Generado por scripts/build-website.sh — no editar a mano en CI.
 * Solo anon key (pública). Nunca service_role.
 */
export default {
  url: '${_url}',
  anonKey: '${_key}',
  enabled: true
};
EOF
elif [[ "${CI:-}" == "true" || -n "${GITHUB_ACTIONS:-}" ]]; then
  # En GitHub Actions sin secrets: deja claro el fallo (no uses example con YOUR_)
  echo "→ ADVERTENCIA: sin SUPABASE_URL / SUPABASE_ANON_KEY en el entorno de build"
  echo "   En GitHub: Settings → Secrets and variables → Actions"
  echo "   Secrets de repositorio (no solo Environment): SUPABASE_URL y SUPABASE_ANON_KEY"
  cat > "$CFG" <<'EOF'
/** Generado en CI sin secrets — acceso docente deshabilitado */
export default { url: '', anonKey: '', enabled: false };
EOF
else
  if [[ ! -f "$CFG" ]]; then
    echo "→ Creando supabase-config.js deshabilitado (sin SUPABASE_URL/ANON_KEY)"
    cat > "$CFG" <<'EOF'
export default { url: '', anonKey: '', enabled: false };
EOF
  else
    echo "→ Conservando website/js/supabase-config.js existente (dev local)"
  fi
fi

# Copiar config en el sim (USB / ZIP) para login docente y códigos online
if [[ -f "$CFG" ]]; then
  echo "→ Copiando supabase-config.js → website/sim/js/ (ZIP y lab offline con red)"
  mkdir -p "$SIM/js"
  cp -f "$CFG" "$SIM/js/supabase-config.js"
fi

# Enlace "volver" en session-gate ya apunta a ../index.html (landing)

echo "→ Generando downloads/fisicahn.zip"
rm -f "$DL/fisicahn.zip"
(
  cd "$DEST"
  if command -v zip >/dev/null 2>&1; then
    zip -r -q "downloads/fisicahn.zip" sim \
      -x "*.DS_Store" -x "**/.git/**"
  else
    python3 - <<'PY'
import os, zipfile
out = "downloads/fisicahn.zip"
os.makedirs("downloads", exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for dp, _, fns in os.walk("sim"):
        for f in fns:
            if f == ".DS_Store":
                continue
            p = os.path.join(dp, f)
            z.write(p)
print("  (python zip)", os.path.getsize(out), "bytes")
PY
  fi
)

echo "→ Listo para GitHub Pages / Cloudflare Pages"
echo "   Carpeta de publicación: $DEST"
echo "   GitHub Actions: .github/workflows/deploy-pages.yml"
echo "   Docs: docs/SUPABASE_GITHUB_PAGES.md"
ls -lh "$DL/fisicahn.zip"

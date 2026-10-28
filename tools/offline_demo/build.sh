#!/bin/bash
# Builds Closet_Demo.html: the built web app + the offline backend (localApi.js running the real services
# on in-memory data) + embedded photos and fonts, in ONE file that opens without a server.
# Usage (repo root): npm --prefix client run build && bash tools/offline_demo/build.sh [out.html]
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; OUT="${1:-$ROOT/docs/milestone2/Closet_Demo.html}"
ESBUILD="${ESBUILD:-npx --yes esbuild@0.25.10}"; SH="$ROOT/tools/offline_demo/shims"
$ESBUILD "$ROOT/tools/offline_demo/browser.js" --bundle --format=iife --platform=browser --minify --log-level=warning \
  --alias:express="$SH/express.js" --alias:multer="$SH/multer.js" --alias:express-rate-limit="$SH/rateLimit.js" --alias:path="$SH/path.js" \
  --alias:helmet="$SH/empty.js" --alias:cors="$SH/empty.js" --alias:dotenv="$SH/dotenv.js" --alias:bcryptjs="$SH/empty.js" --alias:jsonwebtoken="$SH/empty.js" \
  --alias:pg="$SH/empty.js" --alias:fs="$SH/empty.js" --alias:fs/promises="$SH/empty.js" --alias:crypto="$SH/empty.js" --alias:http="$SH/empty.js" \
  --define:process.env='{"NODE_ENV":"offline","WEATHER_MODE":"estimate"}' --define:process.env.NODE_ENV='"offline"' --define:process.env.WEATHER_MODE='"estimate"' --outfile="$ROOT/tools/offline_demo/.offline.js"
python3 "$ROOT/tools/offline_demo/build.py" "$ROOT/client/dist" "$ROOT/tools/offline_demo/.offline.js" "$ROOT/server/seed/photos" "$OUT"
rm -f "$ROOT/tools/offline_demo/.offline.js"

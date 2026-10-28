#!/bin/bash
# Builds the three versions: interactive (Morph camera + clickable rooms), linear (one safe path, fades), PDF.
set -e
cd "$(dirname "$0")"
export NODE_PATH=/opt/npm-tools/node_modules:/usr/lib/node_modules
MODE=interactive OUT=out/raw_interactive.pptx node deck.js
MODE=linear OUT=out/raw_linear.pptx node deck.js
MODE=linear OUT=out/raw_pdf.pptx node deck.js
python3 post.py out/raw_interactive.pptx out/raw_interactive.json out/Closet_M2_FINAL_Interactive.pptx interactive
python3 post.py out/raw_linear.pptx out/raw_linear.json out/Closet_M2_FINAL_Linear.pptx linear
python3 post.py out/raw_pdf.pptx out/raw_pdf.json out/pdf_src.pptx linear
(cd out && rm -f pdf_src.pdf && timeout 900 soffice --headless --convert-to pdf pdf_src.pptx >/dev/null 2>&1 && mv pdf_src.pdf Closet_M2_FINAL.pdf)
python3 navcheck.py out/Closet_M2_FINAL_Interactive.pptx out/raw_interactive.json > out/navigation_check.txt
cp out/raw_interactive.json out/slides_interactive.json
# thumbnails of the interactive deck for the presenter pack
(rm -rf out/thumbs /tmp/ithumb && mkdir -p out/thumbs /tmp/ithumb && cp out/Closet_M2_FINAL_Interactive.pptx /tmp/ithumb/i.pptx && cd /tmp/ithumb && timeout 1200 soffice --headless --convert-to pdf i.pptx >/dev/null 2>&1 && pdftoppm -r 40 -jpeg i.pdf s >/dev/null 2>&1 && for f in s-*.jpg; do mv "$f" "$OLDPWD/out/thumbs/s-$(printf %03d $((10#${f//[!0-9]/})))".jpg; done)
rm -f out/raw_* out/pdf_src.pptx out/notes_interactive.json
ls -la out

#!/usr/bin/env bash
# render.sh in.svg|html out.png width height
in="$(realpath "$1")"; out="$(realpath -m "$2")"
google-chrome --headless=new --disable-gpu --hide-scrollbars --no-sandbox --window-size="$3,$4" --screenshot="$out" "file://$in" >/dev/null 2>&1

#!/bin/zsh
cd -- "${0:A:h}"
if command -v python3 >/dev/null 2>&1; then
  python3 server.py --open
elif [[ -x /Users/kathyfeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 ]]; then
  /Users/kathyfeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 server.py --open
else
  print '需要 Python 3 才能啟動本機網頁。請在 Codex 中開啟此資料夾並要求啟動預覽。'
fi
read '?按 Enter 關閉此視窗。'

#!/usr/bin/env python3
"""Local-only server for the classroom checkout prototype. No dependencies."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import functools
import threading
import webbrowser

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=4173)
parser.add_argument('--open', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent
handler = functools.partial(SimpleHTTPRequestHandler, directory=str(root))
url = f'http://localhost:{args.port}'
try:
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
except OSError:
    print(f'Port {args.port} is in use. If the prototype is already running, open {url}. Otherwise use --port 4174.')
    raise SystemExit(1)
if args.open:
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
print(f'Checkout demo: {url} — press Ctrl+C to stop.', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()

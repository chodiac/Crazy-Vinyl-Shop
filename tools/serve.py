# -*- coding: utf-8 -*-
"""Local preview server.

Plain `http.server` lets the browser cache JS modules, so an edit can appear to
have no effect. This sends `no-store` and serves 404.html for unknown paths,
which matches how a static host will behave.

    python tools/serve.py [port]
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5180


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            page = os.path.join(ROOT, '404.html')
            if os.path.exists(page):
                with open(page, 'rb') as fh:
                    body = fh.read()
                self.send_response(404)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        super().send_error(code, message, explain)

    def log_message(self, fmt, *args):
        # keep the console readable: only report problems
        if args and str(args[1]).startswith(('4', '5')):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    print(f'Crazy Vinyl Shop -> http://localhost:{PORT}/')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()

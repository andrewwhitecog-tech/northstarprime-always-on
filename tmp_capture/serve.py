import functools, http.server, sys
port, root = int(sys.argv[1]), sys.argv[2]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=root)).serve_forever()

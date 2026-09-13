from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

root = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
if not (root / "index.html").is_file():
    raise SystemExit("Extraia o ZIP inteiro antes de iniciar.")
with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
    url = "http://127.0.0.1:%d/" % server.server_address[1]
    print("Estande GCM - Modelo 02A")
    print("Abra no navegador: " + url)
    print("Mantenha esta janela aberta. Pressione Ctrl+C para encerrar.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Visualizador encerrado.")

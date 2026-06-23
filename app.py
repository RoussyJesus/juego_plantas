from __future__ import annotations

import json
import mimetypes
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
INDEX_FILE = TEMPLATES_DIR / "index.html"
GAME_FILE = TEMPLATES_DIR / "juego.html"

HOST = "127.0.0.1"
PORT = 5000

MODOS = {
    "clasico": {
        "nombre": "Modo clásico",
        "descripcion": "Los enemigos siguen reglas predefinidas.",
    },
    "adaptativo": {
        "nombre": "Modo adaptativo",
        "descripcion": "La IA analiza las jugadas y adapta la estrategia.",
    },
}


class ServidorJuego(BaseHTTPRequestHandler):
    server_version = "DefensaJardin/3.0"

    def do_GET(self) -> None:
        ruta = unquote(urlparse(self.path).path)

        if ruta in {"/", "/index.html"}:
            self._enviar_archivo(INDEX_FILE, "text/html; charset=utf-8")
            return

        if ruta in {"/juego", "/juego.html"}:
            self._enviar_archivo(GAME_FILE, "text/html; charset=utf-8")
            return

        if ruta.startswith("/static/"):
            relativa = ruta.removeprefix("/static/")
            archivo = (STATIC_DIR / relativa).resolve()

            try:
                archivo.relative_to(STATIC_DIR.resolve())
            except ValueError:
                self._enviar_json(
                    {"ok": False, "mensaje": "Ruta no permitida."},
                    HTTPStatus.FORBIDDEN,
                )
                return

            self._enviar_archivo(archivo)
            return

        self._enviar_json(
            {"ok": False, "mensaje": "Recurso no encontrado."},
            HTTPStatus.NOT_FOUND,
        )

    def do_POST(self) -> None:
        ruta = unquote(urlparse(self.path).path)

        if ruta != "/api/iniciar":
            self._enviar_json(
                {"ok": False, "mensaje": "Ruta no encontrada."},
                HTTPStatus.NOT_FOUND,
            )
            return

        try:
            longitud = int(self.headers.get("Content-Length", "0"))
            contenido = self.rfile.read(longitud)
            datos = json.loads(contenido.decode("utf-8")) if contenido else {}
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self._enviar_json(
                {"ok": False, "mensaje": "El contenido JSON no es válido."},
                HTTPStatus.BAD_REQUEST,
            )
            return

        modo = str(datos.get("modo", "adaptativo")).strip().lower()
        if modo not in MODOS:
            modo = "adaptativo"

        self._enviar_json(
            {
                "ok": True,
                "modo": modo,
                "nombre": MODOS[modo]["nombre"],
                "descripcion": MODOS[modo]["descripcion"],
                "inicio": datetime.now().isoformat(timespec="seconds"),
                "url": f"/juego?modo={modo}",
            }
        )

    def _enviar_archivo(self, archivo: Path, tipo: str | None = None) -> None:
        if not archivo.is_file():
            self._enviar_json(
                {"ok": False, "mensaje": "Archivo no encontrado."},
                HTTPStatus.NOT_FOUND,
            )
            return

        contenido = archivo.read_bytes()
        tipo_detectado = tipo or mimetypes.guess_type(archivo.name)[0]
        tipo_detectado = tipo_detectado or "application/octet-stream"

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", tipo_detectado)
        self.send_header("Content-Length", str(len(contenido)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(contenido)

    def _enviar_json(
        self,
        datos: dict[str, object],
        estado: HTTPStatus = HTTPStatus.OK,
    ) -> None:
        contenido = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(contenido)))
        self.end_headers()
        self.wfile.write(contenido)

    def log_message(self, formato: str, *argumentos: object) -> None:
        print(f"[{self.log_date_time_string()}] {formato % argumentos}")


def ejecutar() -> None:
    servidor = ThreadingHTTPServer((HOST, PORT), ServidorJuego)
    print("Defensa del Jardín Inteligente")
    print(f"Portada: http://{HOST}:{PORT}")
    print(f"Tablero: http://{HOST}:{PORT}/juego?modo=adaptativo")
    print("Presiona Ctrl+C para cerrar el servidor.\n")

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor cerrado.")
    finally:
        servidor.server_close()


if __name__ == "__main__":
    ejecutar()

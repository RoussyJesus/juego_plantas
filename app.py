from __future__ import annotations

import csv
import json
import mimetypes
import threading
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
GAME_1_FILE = TEMPLATES_DIR / "juego_1.html"
RECORD_FILE = BASE_DIR / "game_records.csv"
MODEL_DIR = BASE_DIR / "models"

RECORD_FIELDS = [
    "finishedAt",
    "mode",
    "victory",
    "lives",
    "wave",
    "energy",
    "totalAttacks",
    "totalPlants",
    "solarPlants",
    "defensivePlants",
    "attackPlants",
    "girasolCount",
    "nuezCount",
    "tiradoraCount",
    "hieloCount",
    "explosivaCount",
    "dominantPlantType",
    "durationSeconds",
    "durationMinutes",
    "damageAccumulated",
    "enemiesDefeated",
]

MODEL_CACHE = {
    "model": None,
    "path": None,
    "mtime": None,
}

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

        if ruta in {"/juego_1", "/juego_1.html"}:
            self._enviar_archivo(GAME_1_FILE, "text/html; charset=utf-8")
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

        if ruta not in {"/api/iniciar", "/api/registro", "/api/predict"}:
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

        if ruta == "/api/iniciar":
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
            return

        if ruta == "/api/registro":
            if not self._guardar_registro(datos):
                return

            self._enviar_json(
                {"ok": True, "mensaje": "Registro guardado."},
            )
            return

        if ruta == "/api/predict":
            prediction, error = self._predecir_estrategia(datos)
            if error:
                self._enviar_json(
                    {"ok": False, "mensaje": error},
                    HTTPStatus.BAD_REQUEST if "payload" in error.lower() or "falta" in error.lower() else HTTPStatus.NOT_FOUND,
                )
                return

            if prediction is None:
                self._enviar_json(
                    {
                        "ok": False,
                        "mensaje": "No hay modelo de estrategia disponible. Entrena uno primero.",
                    },
                    HTTPStatus.NOT_FOUND,
                )
                return

            self._enviar_json(
                {
                    "ok": True,
                    "recomendacion": prediction,
                },
            )
            return

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

    def _guardar_registro(self, datos: dict[str, object]) -> bool:
        if RECORD_FILE.is_file():
            try:
                with RECORD_FILE.open("r", encoding="utf-8", newline="") as archivo:
                    lector = csv.reader(archivo)
                    encabezado_existente = next(lector, None)
            except OSError:
                encabezado_existente = None

            if encabezado_existente != RECORD_FIELDS:
                try:
                    with RECORD_FILE.open("r", encoding="utf-8", newline="") as archivo_lectura, \
                        (RECORD_FILE.with_suffix('.tmp')).open("w", encoding="utf-8", newline="") as archivo_temp:
                        lector = csv.DictReader(archivo_lectura)
                        escritor = csv.DictWriter(archivo_temp, fieldnames=RECORD_FIELDS)
                        escritor.writeheader()

                        for fila in lector:
                            escritor.writerow({campo: fila.get(campo, "") for campo in RECORD_FIELDS})

                    RECORD_FILE.with_suffix('.tmp').replace(RECORD_FILE)
                except OSError:
                    self._enviar_json(
                        {"ok": False, "mensaje": "No se pudo actualizar el encabezado del registro."},
                        HTTPStatus.INTERNAL_SERVER_ERROR,
                    )
                    return False

        try:
            with RECORD_FILE.open("a", encoding="utf-8", newline="") as archivo:
                escritor = csv.DictWriter(archivo, fieldnames=RECORD_FIELDS)
                if not RECORD_FILE.is_file() or RECORD_FILE.stat().st_size == 0:
                    escritor.writeheader()
                escritor.writerow({campo: datos.get(campo, "") for campo in RECORD_FIELDS})
        except OSError:
            self._enviar_json(
                {"ok": False, "mensaje": "No se pudo guardar el registro."},
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )
            return False

        self._schedule_retraining()
        return True

    def _parse_non_negative_number(self, valor: object) -> float | None:
        if isinstance(valor, bool):
            return None
        if isinstance(valor, (int, float)):
            return float(valor)
        if isinstance(valor, str) and valor.strip() != "":
            try:
                return float(valor)
            except ValueError:
                return None
        return None

    def _validate_predict_payload(self, datos: dict[str, object]) -> tuple[bool, str]:
        campos_numericos = [
            "mode_code",
            "wave",
            "energy",
            "lives",
            "totalAttacks",
            "totalPlants",
            "solarPlants",
            "defensivePlants",
            "attackPlants",
            "girasolCount",
            "nuezCount",
            "tiradoraCount",
            "hieloCount",
            "explosivaCount",
            "dominantPlantType",
            "durationSeconds",
            "durationMinutes",
            "damageAccumulated",
            "enemiesDefeated",
        ]

        for campo in campos_numericos:
            if campo not in datos:
                return False, f"Falta la propiedad '{campo}' en el payload."

            valor = self._parse_non_negative_number(datos[campo])
            if valor is None:
                return False, f"'{campo}' debe ser un número no negativo."

            if campo == "mode_code" and int(valor) not in {0, 1}:
                return False, "'mode_code' debe ser 0 o 1."

        return True, ""

    def _get_predict_features(self, datos: dict[str, object]) -> list[float]:
        return [
            float(datos["mode_code"]),
            float(datos["wave"]),
            float(datos["energy"]),
            float(datos["lives"]),
            float(datos["totalAttacks"]),
            float(datos["totalPlants"]),
            float(datos["solarPlants"]),
            float(datos["defensivePlants"]),
            float(datos["attackPlants"]),
            float(datos["girasolCount"]),
            float(datos["nuezCount"]),
            float(datos["tiradoraCount"]),
            float(datos["hieloCount"]),
            float(datos["explosivaCount"]),
            float(datos["dominantPlantType"]),
            float(datos["durationSeconds"]),
            float(datos["durationMinutes"]),
            float(datos["damageAccumulated"]),
            float(datos["enemiesDefeated"]),
        ]

    def _load_cached_model(self):
        try:
            import joblib
        except ImportError:
            return None

        model_path = None
        for nombre in ["decision_tree_strategy.joblib", "knn_strategy.joblib"]:
            candidato = MODEL_DIR / nombre
            if candidato.is_file():
                model_path = candidato
                break

        if not model_path:
            return None

        mtime = model_path.stat().st_mtime
        if (
            MODEL_CACHE["model"] is not None
            and MODEL_CACHE["path"] == model_path
            and MODEL_CACHE["mtime"] == mtime
        ):
            return MODEL_CACHE["model"]

        try:
            modelo = joblib.load(model_path)
        except Exception as exc:
            self.log_message("No se pudo cargar el modelo %s: %s", model_path, exc)
            return None

        MODEL_CACHE.update({"model": modelo, "path": model_path, "mtime": mtime})
        return modelo

    def _predecir_estrategia(self, datos: dict[str, object]) -> tuple[str | None, str | None]:
        valido, mensaje = self._validate_predict_payload(datos)
        if not valido:
            return None, mensaje

        modelo = self._load_cached_model()
        if modelo is None:
            return None, None

        caracteristicas = self._get_predict_features(datos)

        try:
            prediccion = modelo.predict([caracteristicas])
        except Exception as exc:
            self.log_message("Error en la predicción: %s", exc)
            return None, "El modelo no pudo generar una recomendación."

        return str(prediccion[0]), None

    def _schedule_retraining(self) -> None:
        MODEL_CACHE["model"] = None
        thread = threading.Thread(target=self._train_models, daemon=True)
        thread.start()

    def _train_models(self) -> None:
        try:
            import train_strategy
        except ImportError as exc:
            self.log_message("No se pudo iniciar el retraining automático: %s", exc)
            return

        try:
            train_strategy.retrain_models(RECORD_FILE, MODEL_DIR)
            self.log_message("Retraining automático completado.")
        except Exception as exc:
            self.log_message("Error durante el retraining automático: %s", exc)

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

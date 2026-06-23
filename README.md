# Defensa del Jardín Inteligente

Portada web interactiva creada con:

- Python
- HTML
- CSS
- JavaScript

No necesita Flask ni otras librerías externas.

## 1. Abrir el proyecto en Visual Studio Code

Abre la carpeta `defensa_jardin_web`.

## 2. Ejecutar el servidor

En la terminal escribe:

```bash
python app.py
```

## 3. Abrir la portada

En el navegador ingresa a:

```text
http://127.0.0.1:5000
```

## Controles

- Clic en **Modo clásico** o **Modo adaptativo**.
- Tecla `1`: modo clásico.
- Tecla `2`: modo adaptativo.
- Botón `🔊`: activar o desactivar sonido.
- Botón `⛶`: pantalla completa.
- `Esc`: cerrar la ventana de selección.

## Archivos principales

```text
defensa_jardin_web/
├── app.py
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── styles.css
    ├── js/
    │   └── script.js
    └── img/
        └── portada.png
```

La imagen funciona como fondo principal. Encima se colocaron áreas interactivas
responsivas para seleccionar los dos modos de juego.

"use strict";

const configuraciones = {
    clasico: {
        nombre: "Modo clásico",
        descripcion:
            "Los enemigos utilizan reglas predefinidas y búsqueda heurística A* para elegir su recorrido y atacar el jardín.",
        icono: "🎯",
    },
    adaptativo: {
        nombre: "Modo adaptativo",
        descripcion:
            "La inteligencia artificial registra las jugadas del usuario, identifica patrones y modifica su estrategia de ataque.",
        icono: "🧠",
    },
};

const modal = document.getElementById("modal");
const tituloModal = document.getElementById("tituloModal");
const descripcionModal = document.getElementById("descripcionModal");
const modalIcono = document.getElementById("modalIcono");
const botonIniciar = document.getElementById("botonIniciar");
const botonSonido = document.getElementById("botonSonido");
const botonPantalla = document.getElementById("botonPantalla");
const estado = document.getElementById("estado");

let modoSeleccionado = null;
let sonidoActivo = true;
let temporizadorEstado = null;

function mostrarEstado(mensaje, duracion = 2400) {
    estado.textContent = mensaje;
    estado.classList.add("visible");

    window.clearTimeout(temporizadorEstado);
    temporizadorEstado = window.setTimeout(() => {
        estado.classList.remove("visible");
    }, duracion);
}

function sonidoSeleccion(frecuencia = 540) {
    if (!sonidoActivo) {
        return;
    }

    const AudioContexto = window.AudioContext || window.webkitAudioContext;
    if (!AudioContexto) {
        return;
    }

    const contexto = new AudioContexto();
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();

    oscilador.type = "sine";
    oscilador.frequency.setValueAtTime(frecuencia, contexto.currentTime);
    ganancia.gain.setValueAtTime(0.05, contexto.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(
        0.001,
        contexto.currentTime + 0.18,
    );

    oscilador.connect(ganancia);
    ganancia.connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.18);

    oscilador.addEventListener("ended", () => contexto.close());
}

function abrirModal(modo) {
    const datos = configuraciones[modo];
    if (!datos) {
        return;
    }

    modoSeleccionado = modo;
    tituloModal.textContent = datos.nombre;
    descripcionModal.textContent = datos.descripcion;
    modalIcono.textContent = datos.icono;

    modal.classList.remove("oculto");
    document.body.style.overflow = "hidden";
    botonIniciar.focus();

    sonidoSeleccion(modo === "clasico" ? 520 : 690);
}

function cerrarModal() {
    modal.classList.add("oculto");
    document.body.style.overflow = "hidden";
}

async function iniciarPartida() {
    if (!modoSeleccionado) {
        mostrarEstado("Primero debes seleccionar un modo.");
        return;
    }

    const textoOriginal = botonIniciar.textContent;
    botonIniciar.disabled = true;
    botonIniciar.textContent = "Preparando partida...";

    try {
        const respuesta = await fetch("/api/iniciar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ modo: modoSeleccionado }),
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.ok) {
            throw new Error(datos.mensaje || "No fue posible iniciar la partida.");
        }

        cerrarModal();
        sonidoSeleccion(820);
        mostrarEstado(datos.mensaje, 3500);

        // Aquí se puede redirigir a otra pantalla del videojuego:
         window.location.href = `/juego?modo=${encodeURIComponent(modoSeleccionado)}`;
    } catch (error) {
        mostrarEstado(error.message || "Ocurrió un error inesperado.", 3500);
    } finally {
        botonIniciar.disabled = false;
        botonIniciar.textContent = textoOriginal;
    }
}

document.querySelectorAll("[data-modo]").forEach((boton) => {
    boton.addEventListener("click", () => abrirModal(boton.dataset.modo));
});

document.querySelectorAll("[data-cerrar-modal]").forEach((elemento) => {
    elemento.addEventListener("click", cerrarModal);
});

botonIniciar.addEventListener("click", iniciarPartida);

botonSonido.addEventListener("click", () => {
    sonidoActivo = !sonidoActivo;
    botonSonido.textContent = sonidoActivo ? "🔊" : "🔇";
    botonSonido.setAttribute(
        "aria-label",
        sonidoActivo ? "Desactivar efectos de sonido" : "Activar efectos de sonido",
    );
    mostrarEstado(sonidoActivo ? "Sonido activado" : "Sonido desactivado");
});

botonPantalla.addEventListener("click", async () => {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            mostrarEstado("Pantalla completa activada");
        } else {
            await document.exitFullscreen();
            mostrarEstado("Pantalla completa desactivada");
        }
    } catch {
        mostrarEstado("El navegador no permitió usar la pantalla completa.");
    }
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !modal.classList.contains("oculto")) {
        cerrarModal();
    }

    if (evento.key === "1") {
        abrirModal("clasico");
    }

    if (evento.key === "2") {
        abrirModal("adaptativo");
    }
});

window.addEventListener("load", () => {
    window.setTimeout(() => {
        mostrarEstado("Haz clic en Modo clásico o Modo adaptativo");
    }, 550);
});


"use strict";

const ROWS = 5;
const COLS = 9;

const PLANTS = {
    tiradora: {
        name: "Tiradora",
        cost: 100,
        image: "/static/img/tiradora.png",
    },
    girasol: {
        name: "Girasol",
        cost: 50,
        image: "/static/img/girasol.png",
    },
    nuez: {
        name: "Nuez muro",
        cost: 75,
        image: "/static/img/nuez.png",
    },
    hielo: {
        name: "Planta hielo",
        cost: 125,
        image: "/static/img/planta_hielo.png",
    },
    explosiva: {
        name: "Explosiva",
        cost: 150,
        image: "/static/img/explosiva.png",
    },
};

const state = {
    energy: 280,
    selectedPlant: "tiradora",
    removeMode: false,
    totalAttacks: 0,
    board: Array.from(
        { length: ROWS },
        () => Array(COLS).fill(null),
    ),
};

const gridLayer = document.getElementById("gridLayer");
const energyValue = document.getElementById("energyValue");
const removeTool = document.getElementById("removeTool");
const gameMessage = document.getElementById("gameMessage");

let messageTimer = null;

function showMessage(message, duration = 1800) {
    gameMessage.textContent = message;
    gameMessage.classList.add("visible");

    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
        gameMessage.classList.remove("visible");
    }, duration);
}

function buildGrid() {
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            const cell = document.createElement("div");

            cell.className = "board-cell";
            cell.dataset.row = row;
            cell.dataset.col = col;

            cell.addEventListener("click", () => {
                handleCellClick(row, col);
            });

            cell.addEventListener("contextmenu", event => {
                event.preventDefault();
                removePlant(row, col);
            });

            gridLayer.appendChild(cell);
        }
    }
}

function setupPlantMenu() {
    document.querySelectorAll(".plant-card").forEach(button => {
        button.addEventListener("click", () => {
            const type = button.dataset.plant;
            selectPlant(type);
        });
    });

    removeTool.addEventListener("click", () => {
        state.removeMode = !state.removeMode;
        state.selectedPlant = null;

        removeTool.classList.toggle("active", state.removeMode);

        document.querySelectorAll(".plant-card").forEach(button => {
            button.classList.remove("selected");
        });

        showMessage(
            state.removeMode
                ? "Herramienta para retirar activada."
                : "Herramienta desactivada.",
        );
    });
}

function selectPlant(type) {
    if (!PLANTS[type]) {
        return;
    }

    state.selectedPlant = type;
    state.removeMode = false;

    removeTool.classList.remove("active");

    document.querySelectorAll(".plant-card").forEach(button => {
        button.classList.toggle(
            "selected",
            button.dataset.plant === type,
        );
    });

    showMessage(
        `${PLANTS[type].name} seleccionada · costo ${PLANTS[type].cost}`,
    );
}

function handleCellClick(row, col) {
    if (state.removeMode) {
        removePlant(row, col);
        return;
    }

    const type = state.selectedPlant;

    if (!type) {
        showMessage("Selecciona una planta.");
        return;
    }

    if (state.board[row][col]) {
        showMessage("La casilla ya está ocupada.");
        return;
    }

    const plant = PLANTS[type];

    if (state.energy < plant.cost) {
        showMessage("No tienes suficiente energía.");
        return;
    }

    state.energy -= plant.cost;
    state.board[row][col] = type;

    renderPlant(row, col);
    updateEnergy();
    updateCards();
    updateIntelligencePanels();

    showMessage(`${plant.name} colocada en la fila ${row + 1}.`);
}

function renderPlant(row, col) {
    const cell = getCell(row, col);
    const type = state.board[row][col];

    cell.querySelector(".placed-plant")?.remove();

    if (!type) {
        return;
    }

    const wrapper = document.createElement("div");
    const image = document.createElement("img");

    wrapper.className = `placed-plant ${type}`;
    image.src = PLANTS[type].image;
    image.alt = PLANTS[type].name;

    wrapper.appendChild(image);
    cell.appendChild(wrapper);
}

function removePlant(row, col) {
    const type = state.board[row][col];

    if (!type) {
        showMessage("No hay una planta en esa casilla.");
        return;
    }

    const refund = Math.floor(PLANTS[type].cost * 0.25);

    state.board[row][col] = null;
    state.energy += refund;

    getCell(row, col).querySelector(".placed-plant")?.remove();

    updateEnergy();
    updateCards();
    updateRightPanel();

    showMessage(`Planta retirada · +${refund} de energía.`);
}

function getCell(row, col) {
    return gridLayer.children[row * COLS + col];
}

function updateEnergy() {
    energyValue.textContent = state.energy;
}

function updateCards() {
    document.querySelectorAll(".plant-card").forEach(button => {
        const cost = Number(button.dataset.cost);

        button.classList.toggle(
            "unavailable",
            cost > state.energy,
        );
    });
}

function configureMode() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("modo");
    const badge = document.getElementById("modeBadge");

    if (mode === "clasico") {
        badge.querySelector("span").textContent = "MODO CLÁSICO";
    } else {
        badge.querySelector("span").textContent = "MODO ADAPTATIVO";
    }
}

function start() {
    buildGrid();
    setupPlantMenu();
    configureMode();
    updateEnergy();
    updateCards();

    showMessage(
        "Selecciona una planta y colócala sobre una casilla.",
        2800,
    );
}


/* =========================================================
   PANELES INFERIORES DE IA
   ========================================================= */

const solarSummary = document.getElementById("solarSummary");
const defenseSummary = document.getElementById("defenseSummary");
const pressureSummary = document.getElementById("pressureSummary");
const strategyRecommendation = document.getElementById("strategyRecommendation");
const adaptStrategyButton = document.getElementById("adaptStrategyButton");

function getBoardStatistics() {
    const flatBoard = state.board.flat();
    const totalPlants = flatBoard.filter(Boolean).length;
    const solarPlants = flatBoard.filter(type => type === "girasol").length;
    const defensivePlants = flatBoard.filter(type => type === "nuez").length;
    const attackPlants = flatBoard.filter(type =>
        ["tiradora", "hielo", "explosiva"].includes(type)
    ).length;

    return {
        totalPlants,
        solarPlants,
        defensivePlants,
        attackPlants,
    };
}

function setStatusClass(element, status) {
    element.classList.remove("warning", "danger");

    if (status === "MEDIA" || status === "ESTABLE") {
        element.classList.add("warning");
    }

    if (status === "ALTA" || status === "BAJA" && element === defenseSummary) {
        element.classList.add("danger");
    }
}

function updateIntelligencePanels() {
    const stats = getBoardStatistics();

    const solarStatus =
        stats.solarPlants >= 3
            ? "ÓPTIMA"
            : stats.solarPlants >= 1
              ? "ESTABLE"
              : "BAJA";

    const defenseScore =
        stats.totalPlants +
        stats.defensivePlants * 2 +
        stats.attackPlants;

    const defenseStatus =
        defenseScore >= 12
            ? "BUENA"
            : defenseScore >= 5
              ? "MEDIA"
              : "BAJA";

    const pressureStatus = state.totalAttacks
        ? state.totalAttacks >= 8
            ? "ALTA"
            : "MEDIA"
        : "BAJA";

    solarSummary.textContent = solarStatus;
    defenseSummary.textContent = defenseStatus;
    pressureSummary.textContent = pressureStatus;

    setStatusClass(solarSummary, solarStatus);
    setStatusClass(defenseSummary, defenseStatus);
    setStatusClass(pressureSummary, pressureStatus);

    if (stats.solarPlants === 0) {
        strategyRecommendation.textContent =
            "Comienza con girasoles para generar energía y fortalece tus líneas de defensa.";
    } else if (stats.defensivePlants === 0) {
        strategyRecommendation.textContent =
            "Coloca una nuez muro delante de tus plantas de ataque para protegerlas.";
    } else if (stats.attackPlants < 2) {
        strategyRecommendation.textContent =
            "Añade tiradoras o plantas de hielo para aumentar el daño de tus filas.";
    } else {
        strategyRecommendation.textContent =
            "Tu formación está equilibrada. Refuerza las filas con menos plantas.";
    }
}

adaptStrategyButton.addEventListener("click", () => {
    const stats = getBoardStatistics();

    if (stats.solarPlants === 0) {
        selectPlant("girasol");
        showMessage("Consejo aplicado: coloca un girasol.");
        return;
    }

    if (stats.defensivePlants === 0) {
        selectPlant("nuez");
        showMessage("Consejo aplicado: coloca una nuez muro.");
        return;
    }

    selectPlant("tiradora");
    showMessage("Consejo aplicado: refuerza el ataque con una tiradora.");
});

document.querySelectorAll(".benefit-card").forEach(button => {
    button.addEventListener("click", () => {
        const messages = {
            aprende: "La IA registra la posición y el tipo de plantas que utilizas.",
            analiza: "El sistema compara la defensa de cada fila.",
            mejora: "Las recomendaciones cambian según tu estrategia.",
            protege: "Mantén equilibradas las cinco filas del jardín.",
        };

        showMessage(messages[button.dataset.benefit]);
    });
});

const originalUpdateEnergy = updateEnergy;
updateEnergy = function updateEnergyWithPanels() {
    originalUpdateEnergy();
    updateIntelligencePanels();
};

const originalRenderPlant = renderPlant;
renderPlant = function renderPlantWithPanels(row, col) {
    originalRenderPlant(row, col);
    updateIntelligencePanels();
};

const originalRemovePlant = removePlant;
removePlant = function removePlantWithPanels(row, col) {
    originalRemovePlant(row, col);
    updateIntelligencePanels();
};



/* =========================================================
   HUD SUPERIOR Y PANEL DERECHO DE IA
   ========================================================= */

state.lives = 3;
state.wave = 1;
state.paused = false;
state.sound = true;
state.speed = 1;

const topEnergyValue = document.getElementById("topEnergyValue");
const topWaveValue = document.getElementById("topWaveValue");
const topLivesValue = document.getElementById("topLivesValue");
const precisionValue = document.getElementById("precisionValue");
const precisionRing = document.getElementById("precisionRing");
const patternPolyline = document.getElementById("patternPolyline");
const threatSummary = document.getElementById("threatSummary");
const predictionState = document.getElementById("predictionState");
const learningProgress = document.getElementById("learningProgress");
const learningPercent = document.getElementById("learningPercent");

function updateRightPanel() {
    topEnergyValue.textContent = state.energy;
    topWaveValue.textContent = state.wave;
    topLivesValue.textContent = state.lives;

    const placed = state.board.flat().filter(Boolean).length;
    const accuracy = Math.min(96, 87 + Math.floor(placed * 0.6));
    const learning = Math.min(100, placed * 6);

    precisionValue.textContent = `${accuracy}%`;
    precisionRing.style.background =
        `radial-gradient(circle, #031a2c 53%, transparent 55%),` +
        `conic-gradient(#66ed7a 0deg ${accuracy * 3.6}deg, #0b415b ${accuracy * 3.6}deg 360deg)`;

    learningProgress.style.width = `${learning}%`;
    learningPercent.textContent = `${learning}%`;

    const rows = state.board.map(row => row.filter(Boolean).length);
    const points = rows
        .map((value, index) => `${index * 55},${52 - value * 7}`)
        .join(" ");
    patternPolyline.setAttribute("points", points);

    const total = placed;
    threatSummary.innerHTML =
        total < 5
            ? "<b>Amenaza baja</b><small>Entorno estable</small>"
            : total < 12
              ? "<b>Amenaza media</b><small>IA observando patrones</small>"
              : "<b>Amenaza alta</b><small>Ataque adaptativo probable</small>";

    predictionState.textContent =
        total === 0
            ? "◌ Sin actividad"
            : `◌ Riesgo en fila ${findWeakestRow() + 1}`;
}

function findWeakestRow() {
    const rowStrength = state.board.map(row =>
        row.reduce((sum, type) => {
            if (!type) return sum;
            if (type === "nuez") return sum + 3;
            if (type === "tiradora" || type === "hielo") return sum + 2;
            return sum + 1;
        }, 0)
    );

    return rowStrength.indexOf(Math.min(...rowStrength));
}

function setPaused(value) {
    state.paused = value;
    document.getElementById("pauseScreen").classList.toggle("hidden", !value);
    document.getElementById("pauseControl").textContent = value ? "▶" : "Ⅱ";
}

document.getElementById("pauseControl").addEventListener("click", () => {
    setPaused(!state.paused);
});

document.getElementById("resumeControl").addEventListener("click", () => {
    setPaused(false);
});

document.getElementById("soundControl").addEventListener("click", event => {
    state.sound = !state.sound;
    event.currentTarget.textContent = state.sound ? "🔊" : "🔇";
    showMessage(state.sound ? "Sonido activado." : "Sonido desactivado.");
});

const settingsDialog = document.getElementById("settingsDialog");

document.getElementById("settingsControl").addEventListener("click", () => {
    settingsDialog.showModal();
});

document.getElementById("speedControl").addEventListener("change", event => {
    state.speed = Number(event.target.value);
    showMessage(`Velocidad ${event.target.options[event.target.selectedIndex].text.toLowerCase()}.`);
});

const previousUpdateEnergyForRightPanel = updateEnergy;
updateEnergy = function updateEnergyAndRightPanel() {
    previousUpdateEnergyForRightPanel();
    updateRightPanel();
};

const previousRenderPlantForRightPanel = renderPlant;
renderPlant = function renderPlantAndRightPanel(row, col) {
    previousRenderPlantForRightPanel(row, col);
    updateRightPanel();
};

const previousRemovePlantForRightPanel = removePlant;
removePlant = function removePlantAndRightPanel(row, col) {
    previousRemovePlantForRightPanel(row, col);
    updateRightPanel();
};


start();

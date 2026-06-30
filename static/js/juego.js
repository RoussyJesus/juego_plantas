
"use strict";

const ROWS = 5;
const COLS = 9;

// Modificación de Jardy: durabilidad balanceada de plantas para que el girasol sea el más frágil y la nuez la mejor defensa.
const PLANTS = {
    tiradora: {
        name: "Tiradora",
        cost: 100,
        image: "/static/img/tiradora.png",
        health: 140,
    },
    girasol: {
        name: "Girasol",
        cost: 50,
        image: "/static/img/girasol.png",
        health: 80,
    },
    nuez: {
        name: "Nuez muro",
        cost: 75,
        image: "/static/img/nuez.png",
        health: 480,
    },
    hielo: {
        name: "Planta hielo",
        cost: 125,
        image: "/static/img/planta_hielo.png",
        health: 160,
    },
    explosiva: {
        name: "Explosiva",
        cost: 150,
        image: "/static/img/explosiva.png",
        health: 110,
    },
};

const state = {
    energy: 280,
    selectedPlant: "tiradora",
    removeMode: false,
    totalAttacks: 0,
    hordesStarted: false,
    currentHorde: 0,
    mode: "adaptativo",
    startTime: 0,
    zombies: [],
    hordeActive: false,
    gameFinished: false,
    projectiles: [],
    shooterCooldowns: new Map(),
    sunflowerCooldowns: new Map(),
    sunTokens: [],
    explosiveArmed: new Map(),
    damageAccumulated: 0,
    enemiesDefeated: 0,
    plantHealth: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    plantMaxHealth: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    plantBeingEaten: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
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
    state.plantHealth[row][col] = plant.health;
    state.plantMaxHealth[row][col] = plant.health;

    if (type === "explosiva") {
        state.explosiveArmed.set(`${row}-${col}`, performance.now() + 850);
    }

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

    const healthBar = document.createElement("div");
    const healthFill = document.createElement("span");
    const tears = document.createElement("div");
    const tearLeft = document.createElement("i");
    const tearRight = document.createElement("i");

    healthBar.className = "plant-health";
    healthFill.className = "plant-health-fill";
    healthBar.appendChild(healthFill);

    tears.className = "plant-tears";
    tearLeft.className = "plant-tear tear-left";
    tearRight.className = "plant-tear tear-right";
    tears.append(tearLeft, tearRight);

    wrapper.append(image, healthBar, tears);

    // Modificación de Jardy: aplicar transform por fila para ajustar perspectiva inclinada del fondo
    const rowOffsets = [
        { x: 0, y: -10 }, // fila superior: ligeramente más arriba
        { x: 0, y: -7 },  // fila 2: algo más arriba
        { x: 0, y: -5 },  // fila 3: pequeña corrección
        { x: 0, y: -3 },  // fila 4: leve corrección
        { x: 0, y: 0 },   // fila 5: base
    ];

    const rowOffset = rowOffsets[row] ?? { x: 0, y: 0 };
    const colOffsetX = 12 + col * 3.8;
    const colOffsetY = col * 0.6;
    const skew = -8 + row * 2.2; // menos skew en filas bajas para parecer más rectas hacia el fondo
    const scale = 1 + (0.06 * (1 - row / (ROWS - 1)));

    wrapper.style.transform = `translate(var(--plant-offset-x, 0%), var(--plant-offset-y, 0%)) translateX(${colOffsetX}px) translateY(${rowOffset.y + colOffsetY}px) skewY(${skew}deg) scale(${scale})`;
    wrapper.style.transformOrigin = '50% 60%';

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
    state.plantHealth[row][col] = 0;
    state.plantMaxHealth[row][col] = 0;
    state.plantBeingEaten[row][col] = 0;
    state.shooterCooldowns.delete(`tiradora-${row}-${col}`);
    state.shooterCooldowns.delete(`hielo-${row}-${col}`);
    state.sunflowerCooldowns.delete(`${row}-${col}`);
    state.explosiveArmed.delete(`${row}-${col}`);
    state.explosiveArmed.delete(`${row}-${col}`);
    state.energy += refund;

    getCell(row, col).querySelector(".placed-plant")?.remove();

    for (const zombie of state.zombies) {
        if (
            zombie.eating &&
            zombie.targetRow === row &&
            zombie.targetCol === col
        ) {
            stopEatingPlant(zombie);
        }
    }

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

    state.mode = mode === "clasico" ? "clasico" : "adaptativo";

    if (state.mode === "clasico") {
        badge.querySelector("span").textContent = "MODO CLÁSICO";
    } else {
        badge.querySelector("span").textContent = "MODO ADAPTATIVO";
    }
}

function start() {
    state.startTime = performance.now();
    buildGrid();
    setupPlantMenu();
    configureMode();
    updateEnergy();
    updateCards();
    startHordes();

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
    const counts = {
        girasol: 0,
        nuez: 0,
        tiradora: 0,
        hielo: 0,
        explosiva: 0,
    };

    flatBoard.forEach(type => {
        if (type && counts[type] !== undefined) {
            counts[type] += 1;
        }
    });

    const dominantPlantType = Object.entries(counts).reduce(
        (best, [type, value]) => {
            if (value > best.value) {
                return { type, value };
            }
            return best;
        },
        { type: "none", value: 0 },
    ).type;

    const plantTypeCode = {
        none: 0,
        girasol: 1,
        nuez: 2,
        tiradora: 3,
        hielo: 4,
        explosiva: 5,
    }[dominantPlantType];

    return {
        totalPlants,
        solarPlants: counts.girasol,
        defensivePlants: counts.nuez,
        attackPlants: counts.tiradora + counts.hielo + counts.explosiva,
        girasolCount: counts.girasol,
        nuezCount: counts.nuez,
        tiradoraCount: counts.tiradora,
        hieloCount: counts.hielo,
        explosivaCount: counts.explosiva,
        dominantPlantType: plantTypeCode,
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

// Modificación de Jardy: se mejora la heurística de la IA para recomendar acciones según el estado real del tablero y la amenaza actual.
function getHeuristicRecommendation() {
    const stats = getBoardStatistics();
    const activeThreat = Math.max(
        state.currentHorde * 2,
        state.zombies.length * 1.5,
        state.totalAttacks,
    );
    const weakestRow = findWeakestRow();

    if (stats.solarPlants === 0) {
        return {
            plant: "girasol",
            message: "Prioriza un girasol para sostener la energía y preparar la defensa futura.",
        };
    }

    if (stats.defensivePlants === 0 && activeThreat >= 6) {
        return {
            plant: "nuez",
            message: "La defensa está expuesta; coloca una nuez para absorber el impacto de los zombis.",
        };
    }

    if (stats.attackPlants < 2 && activeThreat >= 4) {
        return {
            plant: "tiradora",
            message: "Añade una tiradora para contener el avance en la fila más vulnerable.",
        };
    }

    if (activeThreat >= 7 && weakestRow >= 0 && state.energy >= 125) {
        return {
            plant: "hielo",
            message: `Usa una planta de hielo en la fila ${weakestRow + 1} para frenar la presión enemiga.`,
        };
    }

    return {
        plant: "tiradora",
        message: "Tu formación está bien, pero una tiradora reforzará el frente más comprometido.",
    };
}

function updateIntelligencePanels() {
    const stats = getBoardStatistics();
    const recommendation = getHeuristicRecommendation();

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
    strategyRecommendation.textContent = recommendation.message;
}

function getStrategyPredictionPayload() {
    const stats = getBoardStatistics();
    const durationSeconds = state.startTime
        ? Math.round((performance.now() - state.startTime) / 1000)
        : 0;

    return {
        mode_code: state.mode === "clasico" ? 0 : 1,
        wave: state.wave,
        energy: state.energy,
        lives: state.lives,
        totalAttacks: state.totalAttacks,
        totalPlants: stats.totalPlants,
        solarPlants: stats.solarPlants,
        defensivePlants: stats.defensivePlants,
        attackPlants: stats.attackPlants,
        girasolCount: stats.girasolCount,
        nuezCount: stats.nuezCount,
        tiradoraCount: stats.tiradoraCount,
        hieloCount: stats.hieloCount,
        explosivaCount: stats.explosivaCount,
        dominantPlantType: stats.dominantPlantType,
        durationSeconds,
        durationMinutes: Number((durationSeconds / 60).toFixed(2)),
        damageAccumulated: state.damageAccumulated,
        enemiesDefeated: state.enemiesDefeated,
    };
}

async function fetchStrategyRecommendation() {
    try {
        const response = await fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(getStrategyPredictionPayload()),
        });

        if (!response.ok) {
            return null;
        }

        const result = await response.json();
        return result.recomendacion || null;
    } catch {
        return null;
    }
}

adaptStrategyButton.addEventListener("click", async () => {
    const predictedPlant = await fetchStrategyRecommendation();
    const recommendation = predictedPlant
        ? { plant: predictedPlant }
        : getHeuristicRecommendation();

    selectPlant(recommendation.plant);
    showMessage(`Consejo aplicado: ${recommendation.plant === "girasol" ? "coloca un girasol" : recommendation.plant === "nuez" ? "coloca una nuez muro" : recommendation.plant === "hielo" ? "coloca una planta de hielo" : "refuerza con una tiradora"}.`);
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
    const rowStrength = state.board.map((row, index) => {
        const plantedDefense = row.reduce((sum, type) => {
            if (!type) return sum;
            if (type === "nuez") return sum + 3.4;
            if (type === "tiradora" || type === "hielo") return sum + 2.2;
            if (type === "explosiva") return sum + 2.6;
            return sum + 1.3;
        }, 0);

        const incomingThreat = state.zombies.filter(
            zombie => !zombie.dying && zombie.row === index,
        ).length * 2.4;
        const pressureBoost = state.currentHorde * 0.5;

        return plantedDefense - incomingThreat - pressureBoost;
    });

    return rowStrength.indexOf(Math.min(...rowStrength));
}

function setPaused(value) {
    state.paused = value;
    document.getElementById("pauseScreen").classList.toggle("hidden", !value);
    const pauseButton = document.getElementById("pauseControl");
    const pauseImage = pauseButton.querySelector("img");
    if (pauseImage) {
        pauseImage.src = value ? "/static/img/continuar.png" : "/static/img/pausa.png";
        pauseImage.alt = value ? "Continuar" : "Pausar";
    } else {
        pauseButton.textContent = value ? "▶" : "Ⅱ";
    }
}

async function recordGameResult(victory) {
    const stats = getBoardStatistics();
    const durationSeconds = state.startTime
        ? Math.round((performance.now() - state.startTime) / 1000)
        : 0;

    const payload = {
        finishedAt: new Date().toISOString(),
        mode: state.mode,
        victory,
        lives: state.lives,
        wave: state.wave,
        energy: state.energy,
        totalAttacks: state.totalAttacks,
        totalPlants: stats.totalPlants,
        solarPlants: stats.solarPlants,
        defensivePlants: stats.defensivePlants,
        attackPlants: stats.attackPlants,
        girasolCount: stats.girasolCount,
        nuezCount: stats.nuezCount,
        tiradoraCount: stats.tiradoraCount,
        hieloCount: stats.hieloCount,
        explosivaCount: stats.explosivaCount,
        dominantPlantType: stats.dominantPlantType,
        durationSeconds,
        durationMinutes: Number((durationSeconds / 60).toFixed(2)),
        damageAccumulated: state.damageAccumulated,
        enemiesDefeated: state.enemiesDefeated,
    };

    try {
        await fetch("/api/registro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error("Error guardando registro de partida:", error);
    }
}

document.getElementById("pauseControl").addEventListener("click", () => {
    setPaused(!state.paused);
});

document.getElementById("resumeControl").addEventListener("click", () => {
    setPaused(false);
});

document.getElementById("soundControl").addEventListener("click", event => {
    state.sound = !state.sound;
    const soundImage = event.currentTarget.querySelector("img");
    if (soundImage) {
        soundImage.src = state.sound ? "/static/img/sonido.png" : "/static/img/sin_sonido.png";
        soundImage.alt = state.sound ? "Sonido activado" : "Sonido desactivado";
    } else {
        event.currentTarget.textContent = state.sound ? "🔊" : "🔇";
    }
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



/* =========================================================
   SISTEMA DE DOS HORDAS DE ZOMBIS
   ========================================================= */

const zombieLayer = document.getElementById("zombieLayer");
const projectileLayer = document.getElementById("projectileLayer");
const sunLayer = document.getElementById("sunLayer");
const waveAnnouncement = document.getElementById("waveAnnouncement");
const waveAnnouncementText = document.getElementById("waveAnnouncementText");
const gameOverScreen = document.getElementById("gameOverScreen");
const restartGameButton = document.getElementById("restartGameButton");

restartGameButton.addEventListener("click", () => {
    window.location.reload();
});


const ZOMBIE_TYPES = {
    lento: { name: "Zombi lento", image: "/static/img/zombie_lento.png", speed: 3.1, health: 120, damage: 10, className: "zombie-slow", badge: "LENTO" },
    rapido: { name: "Zombi rápido", image: "/static/img/zombie_rapido.png", speed: 6.0, health: 80, damage: 8, className: "zombie-fast", badge: "RÁPIDO" },
    resistente: { name: "Zombi resistente", image: "/static/img/zombie_resistente.png", speed: 1.9, health: 280, damage: 18, className: "zombie-tank", badge: "RESISTENTE" },
    saltador: { name: "Zombi saltador", image: "/static/img/zombie_saltador.png", speed: 4.5, health: 105, damage: 12, className: "zombie-jumper", badge: "SALTADOR" },
    jefe: { name: "Zombi jefe", image: "/static/img/zombie_jefe.png", speed: 1.45, health: 520, damage: 30, className: "zombie-boss", badge: "JEFE" },
};

// Modificación de Jardy: la primera oleada solo usa zombis más ligeros y los más difíciles aparecen en la segunda.
const HORDES = [
    {
        number: 1,
        duration: 45000,
        totalZombies: 18,
        spawnInterval: 1800,
        weights: {
            lento: 55,
            rapido: 30,
            saltador: 15,
            resistente: 0,
            jefe: 0,
        },
    },
    {
        number: 2,
        duration: 50000,
        totalZombies: 22,
        spawnInterval: 1500,
        weights: {
            lento: 15,
            rapido: 20,
            saltador: 15,
            resistente: 35,
            jefe: 15,
        },
    },
];

let zombieAnimationId = null;
let lastZombieFrame = performance.now();
let hordeTimerIds = [];

function startHordes() {
    if (state.hordesStarted || state.gameFinished) {
        return;
    }

    state.hordesStarted = true;

    showMessage(
        "Los zombis comenzarán en 20 segundos y aparecerán de forma gradual.",
        4200,
    );

    hordeTimerIds.push(
        window.setTimeout(() => launchHorde(0), 20000),
    );

    if (!zombieAnimationId) {
        lastZombieFrame = performance.now();
        zombieAnimationId = requestAnimationFrame(updateZombies);
    }
}

function launchHorde(index) {
    if (index >= HORDES.length || state.gameFinished) {
        return;
    }

    const horde = HORDES[index];

    state.currentHorde = horde.number;
    state.wave = horde.number;
    state.hordeActive = true;

    updateRightPanel();
    announceHorde(horde.number);

    showMessage(
        horde.number === 1
            ? "Horda 1: los zombis entran poco a poco y la intensidad aumenta."
            : "Horda 2: la presión aumenta con el tiempo.",
        3000,
    );

    let spawned = 0;
    const startedAt = performance.now();

    function spawnNextZombie() {
        if (state.gameFinished || !state.hordeActive) {
            return;
        }

        const elapsed = performance.now() - startedAt;
        const durationFinished = elapsed >= horde.duration;
        const amountFinished = spawned >= horde.totalZombies;

        if (durationFinished || amountFinished) {
            state.hordeActive = false;
            checkHordeFinished();
            return;
        }

        const zombieType = chooseWeightedZombieType(horde.weights);
        const randomRow = Math.floor(Math.random() * ROWS);

        spawnZombie(zombieType, spawned, randomRow);
        spawned += 1;

        const progress = Math.min(1, elapsed / Math.max(1, horde.duration));
        const initialInterval = Math.max(700, horde.spawnInterval);
        const finalInterval = Math.max(220, initialInterval * 0.35);
        const rampedInterval = initialInterval - (initialInterval - finalInterval) * progress;
        const jitter = 0.85 + Math.random() * 0.25;
        const nextDelay = Math.max(
            250,
            Math.min(initialInterval * 1.2, rampedInterval * jitter),
        );

        hordeTimerIds.push(
            window.setTimeout(spawnNextZombie, nextDelay),
        );
    }

    spawnNextZombie();

    hordeTimerIds.push(
        window.setTimeout(() => {
            if (state.currentHorde === horde.number) {
                state.hordeActive = false;
                checkHordeFinished();
            }
        }, horde.duration + 100),
    );
}

function chooseWeightedZombieType(weights) {
    const entries = Object.entries(weights);
    const totalWeight = entries.reduce(
        (sum, [, weight]) => sum + weight,
        0,
    );

    let randomValue = Math.random() * totalWeight;

    for (const [type, weight] of entries) {
        randomValue -= weight;

        if (randomValue <= 0) {
            return type;
        }
    }

    return entries[entries.length - 1][0];
}

function announceHorde(number) {
    waveAnnouncementText.textContent = `HORDA ${number}`;
    waveAnnouncement.classList.remove("hidden");
    waveAnnouncement.classList.add("visible");
    window.setTimeout(() => {
        waveAnnouncement.classList.remove("visible");
        waveAnnouncement.classList.add("hidden");
    }, 1800);
}

function spawnZombie(type, orderIndex = 0, forcedRow = null) {
    const config = ZOMBIE_TYPES[type];
    if (!config) return;
    const row = Number.isInteger(forcedRow)
        ? forcedRow
        : chooseZombieRow();
    const el = document.createElement("div");
    const img = document.createElement("img");
    const badge = document.createElement("span");
    const healthBar = document.createElement("div");
    const healthFill = document.createElement("span");
    el.className = `zombie-unit ${config.className}`;
    const startOffset = 103 + (orderIndex % 5) * 2.6 + Math.random() * 1.8;
    el.style.left = `${startOffset}%`;
    el.style.top = `${row * 20 + 1}%`;
    img.src = config.image;
    img.alt = config.name;
    badge.className = "zombie-speed-badge";
    badge.textContent = config.badge;
    healthBar.className = "zombie-health";
    healthFill.className = "zombie-health-fill";
    healthBar.appendChild(healthFill);
    el.append(img, badge, healthBar);
    zombieLayer.appendChild(el);
    state.zombies.push({
        id: `${Date.now()}-${Math.random()}`, type, row,
        x: startOffset,
        speed: config.speed,
        baseSpeed: config.speed,
        health: config.health,
        maxHealth: config.health,
        damage: config.damage,
        healthFill,
        element: el,
        reachedHouse: false,
        dying: false,
        eating: false,
        frozenUntil: 0,
        targetRow: null,
        targetCol: null,
        lastBiteAt: 0,
    });
    state.totalAttacks += 1;
    updateIntelligencePanels();
    updateRightPanel();
}

// Modificación de Jardy: el modo clásico ahora usa una heurística para elegir filas más vulnerables en lugar de atacar de forma puramente aleatoria.
function getRowDefenseScore(row) {
    return row.reduce((sum, type) => {
        if (!type) return sum;
        if (type === "nuez") return sum + 3.6;
        if (type === "tiradora" || type === "hielo") return sum + 2.4;
        if (type === "explosiva") return sum + 2.8;
        return sum + 1.3;
    }, 0);
}

function chooseClassicZombieRow() {
    const rowScores = state.board.map((row, index) => {
        const defenseScore = getRowDefenseScore(row);
        const currentPressure = state.zombies.filter(
            zombie => !zombie.dying && zombie.row === index,
        ).length * 1.3;
        const hordePressure = state.currentHorde >= 2 ? 1.1 : 0.4;
        const rowHasPlants = row.some(Boolean) ? 0.6 : 0;

        return defenseScore + currentPressure + hordePressure + rowHasPlants;
    });

    const weakestRow = rowScores.reduce(
        (bestIndex, score, index, scores) =>
            score < scores[bestIndex] ? index : bestIndex,
        0,
    );

    return rowScores[weakestRow] <= 6.5 ? weakestRow : Math.floor(Math.random() * ROWS);
}

function chooseZombieRow() {
    const mode = new URLSearchParams(window.location.search).get("modo");

    if (mode === "adaptativo") {
        return Math.random() < 0.72 ? findWeakestRow() : Math.floor(Math.random() * ROWS);
    }

    if (mode === "clasico") {
        return chooseClassicZombieRow();
    }

    return Math.floor(Math.random() * ROWS);
}

/* =========================================================
   PRODUCCIÓN DE SOLES DEL GIRASOL
   ========================================================= */

const SUN_VALUE = 25;
const SUN_PRODUCTION_INTERVAL = 8000;
const SUN_FIRST_DELAY = 2800;
const SUN_LIFETIME = 9000;

function updateSunflowers(timestamp) {
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            if (state.board[row][col] !== "girasol") {
                continue;
            }

            const key = `${row}-${col}`;
            const previousProduction = state.sunflowerCooldowns.get(key);

            if (previousProduction === undefined) {
                state.sunflowerCooldowns.set(
                    key,
                    timestamp - SUN_PRODUCTION_INTERVAL + SUN_FIRST_DELAY,
                );
                continue;
            }

            if (timestamp - previousProduction >= SUN_PRODUCTION_INTERVAL) {
                createSunToken(row, col);
                state.sunflowerCooldowns.set(key, timestamp);
            }
        }
    }
}

function createSunToken(row, col) {
    if (state.board[row][col] !== "girasol") {
        return;
    }

    const token = document.createElement("button");
    const image = document.createElement("img");
    const value = document.createElement("span");

    const baseX = ((col + 0.5) / COLS) * 100;
    const baseY = ((row + 0.5) / ROWS) * 100;
    const offsetX = (Math.random() - 0.5) * 4;
    const offsetY = -5 - Math.random() * 3;

    token.type = "button";
    token.className = "sun-token";
    token.style.left = `${baseX + offsetX}%`;
    token.style.top = `${baseY + offsetY}%`;
    token.setAttribute("aria-label", `Recoger sol de ${SUN_VALUE} de energía`);

    image.src = "/static/img/sol.png";
    image.alt = "Sol";

    value.textContent = `+${SUN_VALUE}`;

    token.append(image, value);
    sunLayer.appendChild(token);

    const sun = {
        id: `${Date.now()}-${Math.random()}`,
        row,
        col,
        element: token,
        collected: false,
        timeoutId: null,
    };

    token.addEventListener("click", event => {
        event.stopPropagation();
        collectSun(sun);
    });

    sun.timeoutId = window.setTimeout(() => {
        expireSun(sun);
    }, SUN_LIFETIME);

    state.sunTokens.push(sun);
}

function collectSun(sun) {
    if (sun.collected || state.paused || state.gameFinished) {
        return;
    }

    sun.collected = true;
    clearTimeout(sun.timeoutId);

    state.energy += SUN_VALUE;
    updateEnergy();
    updateCards();
    updateRightPanel();

    sun.element.classList.add("sun-collected");

    showMessage(`Sol recogido · +${SUN_VALUE} de energía.`, 1200);

    window.setTimeout(() => {
        removeSunToken(sun);
    }, 420);
}

function expireSun(sun) {
    if (sun.collected) {
        return;
    }

    sun.element.classList.add("sun-expiring");

    window.setTimeout(() => {
        removeSunToken(sun);
    }, 450);
}

function removeSunToken(sun) {
    sun.element.remove();
    state.sunTokens = state.sunTokens.filter(
        item => item.id !== sun.id,
    );
}

/* =========================================================
   DISPAROS DE LA TIRADORA Y PLANTA DE HIELO
   ========================================================= */

const PEA_DAMAGE = 35;
const ICE_PEA_DAMAGE = 24;
const PEA_SPEED = 48;
const ICE_PEA_SPEED = 42;
const SHOOT_INTERVAL = 1250;
const ICE_SHOOT_INTERVAL = 1500;
const PEA_HIT_DISTANCE = 4.2;
const FREEZE_DURATION = 4500;
const FREEZE_SPEED_FACTOR = 0.42;

function getPlantX(col) {
    return ((col + 0.72) / COLS) * 100;
}

function hasZombieAhead(row, plantX) {
    return state.zombies.some(zombie =>
        !zombie.dying &&
        zombie.row === row &&
        zombie.x > plantX - 2
    );
}

function updateShooters(timestamp) {
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            const plantType = state.board[row][col];

            if (plantType !== "tiradora" && plantType !== "hielo") {
                continue;
            }

            const plantX = getPlantX(col);

            if (!hasZombieAhead(row, plantX)) {
                continue;
            }

            const key = `${plantType}-${row}-${col}`;
            const previousShot = state.shooterCooldowns.get(key) ?? 0;
            const interval =
                plantType === "hielo"
                    ? ICE_SHOOT_INTERVAL
                    : SHOOT_INTERVAL;

            if (timestamp - previousShot >= interval) {
                if (plantType === "hielo") {
                    fireIcePea(row, col);
                } else {
                    firePea(row, col);
                }

                state.shooterCooldowns.set(key, timestamp);
            }
        }
    }
}

function createProjectile(row, col, type) {
    const projectile = document.createElement("div");
    const startX = getPlantX(col);

    projectile.className =
        type === "ice"
            ? "pea-projectile ice-pea-projectile"
            : "pea-projectile";

    projectile.style.left = `${startX}%`;
    projectile.style.top = `${row * 20 + 9.3}%`;

    projectileLayer.appendChild(projectile);

    state.projectiles.push({
        id: `${Date.now()}-${Math.random()}`,
        row,
        x: startX,
        type,
        speed: type === "ice" ? ICE_PEA_SPEED : PEA_SPEED,
        damage: type === "ice" ? ICE_PEA_DAMAGE : PEA_DAMAGE,
        element: projectile,
    });

    const plantElement = getCell(row, col).querySelector(".placed-plant");

    if (plantElement) {
        plantElement.classList.remove("shooting");
        void plantElement.offsetWidth;
        plantElement.classList.add("shooting");
    }
}

function firePea(row, col) {
    createProjectile(row, col, "normal");
}

function fireIcePea(row, col) {
    createProjectile(row, col, "ice");
}

function updateProjectiles(delta) {
    for (const projectile of [...state.projectiles]) {
        projectile.x += projectile.speed * state.speed * delta;
        projectile.element.style.left = `${projectile.x}%`;

        const target = findProjectileTarget(projectile);

        if (target) {
            hitZombie(target, projectile.damage);

            if (projectile.type === "ice") {
                applyFreezeEffect(target);
                createIceHitEffect(projectile.x, projectile.row);
            } else {
                createHitEffect(projectile.x, projectile.row);
            }

            removeProjectile(projectile);
            continue;
        }

        if (projectile.x > 112) {
            removeProjectile(projectile);
        }
    }
}

function findProjectileTarget(projectile) {
    let nearest = null;
    let nearestDistance = Infinity;

    for (const zombie of state.zombies) {
        if (zombie.dying || zombie.row !== projectile.row) {
            continue;
        }

        const distance = zombie.x - projectile.x;

        if (
            distance >= -1.5 &&
            distance <= PEA_HIT_DISTANCE &&
            Math.abs(distance) < nearestDistance
        ) {
            nearest = zombie;
            nearestDistance = Math.abs(distance);
        }
    }

    return nearest;
}

function hitZombie(zombie, damage) {
    if (zombie.dying) {
        return;
    }

    zombie.health = Math.max(0, zombie.health - damage);

    zombie.healthFill.style.width =
        `${(zombie.health / zombie.maxHealth) * 100}%`;

    zombie.element.classList.remove("zombie-hit");
    void zombie.element.offsetWidth;
    zombie.element.classList.add("zombie-hit");

    if (zombie.health <= 0) {
        defeatZombie(zombie);
    }
}

function applyFreezeEffect(zombie) {
    if (zombie.dying) {
        return;
    }

    zombie.frozenUntil = performance.now() + FREEZE_DURATION;
    zombie.element.classList.add("zombie-frozen");

    window.setTimeout(() => {
        if (
            !zombie.dying &&
            performance.now() >= zombie.frozenUntil
        ) {
            zombie.element.classList.remove("zombie-frozen");
        }
    }, FREEZE_DURATION + 80);
}

function getZombieSpeed(zombie, timestamp) {
    if (timestamp < zombie.frozenUntil) {
        return zombie.baseSpeed * FREEZE_SPEED_FACTOR;
    }

    zombie.element.classList.remove("zombie-frozen");
    return zombie.baseSpeed;
}

function defeatZombie(zombie) {
    if (zombie.dying) {
        return;
    }

    if (zombie.eating) {
        stopEatingPlant(zombie);
    }

    zombie.dying = true;
    zombie.speed = 0;
    zombie.enemiesDefeated = true;
    state.enemiesDefeated += 1;
    zombie.element.classList.remove("zombie-frozen");
    zombie.element.classList.add("zombie-defeated");

    zombie.element.querySelector(".zombie-speed-badge")?.remove();
    zombie.element.querySelector(".zombie-health")?.remove();

    window.setTimeout(() => {
        removeZombieUnit(zombie);
        checkHordeFinished();
    }, 1350);
}

function removeProjectile(projectile) {
    projectile.element.remove();

    state.projectiles = state.projectiles.filter(
        item => item.id !== projectile.id,
    );
}

function createHitEffect(x, row) {
    const effect = document.createElement("span");

    effect.className = "pea-hit-effect";
    effect.style.left = `${x}%`;
    effect.style.top = `${row * 20 + 8.5}%`;

    projectileLayer.appendChild(effect);

    window.setTimeout(() => {
        effect.remove();
    }, 260);
}

function createIceHitEffect(x, row) {
    const effect = document.createElement("span");

    effect.className = "ice-hit-effect";
    effect.style.left = `${x}%`;
    effect.style.top = `${row * 20 + 8.5}%`;

    projectileLayer.appendChild(effect);

    window.setTimeout(() => {
        effect.remove();
    }, 420);
}


/* =========================================================
   PLANTA EXPLOSIVA: ÁREA CUADRADA 3x3
   ========================================================= */

const EXPLOSION_RADIUS_ROWS = 1;
const EXPLOSION_RADIUS_COLS = 1;
const EXPLOSION_TRIGGER_DELAY = 850;
const EXPLOSION_VISUAL_TIME = 720;
const CHARRED_TIME = 950;

function getZombieColumn(zombie) {
    return Math.floor((zombie.x / 100) * COLS);
}

function updateExplosivePlants(timestamp) {
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            if (state.board[row][col] !== "explosiva") {
                continue;
            }

            const key = `${row}-${col}`;
            const armedAt = state.explosiveArmed.get(key);

            if (armedAt === undefined) {
                state.explosiveArmed.set(
                    key,
                    timestamp + EXPLOSION_TRIGGER_DELAY,
                );
                continue;
            }

            if (timestamp < armedAt) {
                continue;
            }

            const targetFound = state.zombies.some(zombie => {
                if (zombie.dying) {
                    return false;
                }

                const zombieCol = getZombieColumn(zombie);

                return (
                    Math.abs(zombie.row - row) <= EXPLOSION_RADIUS_ROWS &&
                    Math.abs(zombieCol - col) <= EXPLOSION_RADIUS_COLS
                );
            });

            if (targetFound) {
                detonateExplosive(row, col);
            }
        }
    }
}

function detonateExplosive(row, col) {
    if (state.board[row][col] !== "explosiva") {
        return;
    }

    const key = `${row}-${col}`;
    state.explosiveArmed.delete(key);

    const centerX = ((col + 0.5) / COLS) * 100;
    const centerY = ((row + 0.5) / ROWS) * 100;

    createExplosionVisual(centerX, centerY, row, col);

    const affectedZombies = state.zombies.filter(zombie => {
        if (zombie.dying) {
            return false;
        }

        const zombieCol = getZombieColumn(zombie);

        return (
            Math.abs(zombie.row - row) <= EXPLOSION_RADIUS_ROWS &&
            Math.abs(zombieCol - col) <= EXPLOSION_RADIUS_COLS
        );
    });

    for (const zombie of affectedZombies) {
        charZombie(zombie);
    }

    removeExplosivePlant(row, col);

    showMessage(
        `¡Explosión! ${affectedZombies.length} zombi(s) alcanzado(s).`,
        1700,
    );
}

function createExplosionVisual(centerX, centerY, row, col) {
    const square = document.createElement("div");
    const fireball = document.createElement("div");
    const sparks = document.createElement("div");

    square.className = "explosion-square";
    square.style.left = `${((col - 1) / COLS) * 100}%`;
    square.style.top = `${((row - 1) / ROWS) * 100}%`;
    square.style.width = `${(3 / COLS) * 100}%`;
    square.style.height = `${(3 / ROWS) * 100}%`;

    fireball.className = "explosion-fireball";
    fireball.style.left = `${centerX}%`;
    fireball.style.top = `${centerY}%`;

    sparks.className = "explosion-sparks";
    sparks.style.left = `${centerX}%`;
    sparks.style.top = `${centerY}%`;

    projectileLayer.append(square, fireball, sparks);

    window.setTimeout(() => {
        square.remove();
        fireball.remove();
        sparks.remove();
    }, EXPLOSION_VISUAL_TIME);
}

function charZombie(zombie) {
    if (zombie.dying) {
        return;
    }

    if (zombie.eating) {
        stopEatingPlant(zombie);
    }

    zombie.dying = true;
    zombie.speed = 0;
    zombie.health = 0;
    zombie.element.classList.remove(
        "zombie-frozen",
        "zombie-hit",
        "zombie-eating",
        "zombie-biting",
    );
    zombie.element.classList.add("zombie-charred");

    zombie.element.querySelector(".zombie-speed-badge")?.remove();
    zombie.element.querySelector(".zombie-health")?.remove();

    window.setTimeout(() => {
        removeZombieUnit(zombie);
        checkHordeFinished();
    }, CHARRED_TIME);
}

function removeExplosivePlant(row, col) {
    const plantElement = getCell(row, col).querySelector(".placed-plant");

    if (plantElement) {
        plantElement.classList.add("explosive-consumed");

        window.setTimeout(() => {
            plantElement.remove();
        }, 420);
    }

    state.board[row][col] = null;
    state.plantHealth[row][col] = 0;
    state.plantMaxHealth[row][col] = 0;
    state.plantBeingEaten[row][col] = 0;
    state.explosiveArmed.delete(`${row}-${col}`);

    for (const zombie of state.zombies) {
        if (
            zombie.eating &&
            zombie.targetRow === row &&
            zombie.targetCol === col
        ) {
            stopEatingPlant(zombie);
        }
    }

    updateCards();
    updateIntelligencePanels();
    updateRightPanel();
}


/* =========================================================
   ZOMBIS COMIENDO PLANTAS
   ========================================================= */

const BITE_INTERVAL = 700;
// Modificación de Jardy: se mejora la colisión para que los zombis entren en contacto con las plantas de forma más natural y consistente.
const PLANT_COLLISION_DISTANCE = 5.2;
const PLANT_COLLISION_EARLY_BUFFER = 1.1;

function getCellLeftX(col) {
    return (col / COLS) * 100;
}

function getCellCenterX(col) {
    return ((col + 0.5) / COLS) * 100;
}

function findPlantCollision(zombie) {
    let closest = null;
    let closestDistance = Infinity;

    const threatRange = zombie.baseSpeed >= 5 ? 4.2 : 5.2;
    const activeRange = Math.max(2.8, threatRange - (zombie.eating ? 0.6 : 0));

    for (let col = COLS - 1; col >= 0; col -= 1) {
        if (!state.board[zombie.row][col]) {
            continue;
        }

        const plantX = getCellCenterX(col) + 0.8;
        const collisionStart = plantX - 2.2;
        const collisionEnd = plantX + 1.3;
        const distance = zombie.x - collisionStart;

        const isInContactZone =
            distance >= -PLANT_COLLISION_EARLY_BUFFER &&
            distance <= activeRange &&
            zombie.x <= collisionEnd + 0.8;

        if (!isInContactZone) {
            continue;
        }

        const scoreDistance = Math.abs(distance);

        if (scoreDistance < closestDistance) {
            closest = { row: zombie.row, col, plantX };
            closestDistance = scoreDistance;
        }
    }

    return closest;
}

function beginEatingPlant(zombie, target) {
    zombie.eating = true;
    zombie.targetRow = target.row;
    zombie.targetCol = target.col;
    zombie.x = target.plantX + 3.4;
    zombie.element.style.left = `${zombie.x}%`;
    zombie.element.classList.add("zombie-eating");

    state.plantBeingEaten[target.row][target.col] += 1;

    const plantElement = getCell(target.row, target.col)
        .querySelector(".placed-plant");

    if (plantElement) {
        plantElement.classList.add("plant-crying");
    }
}

function stopEatingPlant(zombie) {
    if (
        zombie.targetRow !== null &&
        zombie.targetCol !== null &&
        state.plantBeingEaten[zombie.targetRow]
    ) {
        state.plantBeingEaten[zombie.targetRow][zombie.targetCol] =
            Math.max(
                0,
                state.plantBeingEaten[zombie.targetRow][zombie.targetCol] - 1,
            );

        if (
            state.plantBeingEaten[zombie.targetRow][zombie.targetCol] === 0
        ) {
            const plantElement = getCell(
                zombie.targetRow,
                zombie.targetCol,
            ).querySelector(".placed-plant");

            plantElement?.classList.remove("plant-crying");
        }
    }

    zombie.eating = false;
    zombie.targetRow = null;
    zombie.targetCol = null;
    zombie.element.classList.remove("zombie-eating");
}

function updateZombieEating(zombie, timestamp) {
    const row = zombie.targetRow;
    const col = zombie.targetCol;

    if (
        row === null ||
        col === null ||
        !state.board[row][col]
    ) {
        stopEatingPlant(zombie);
        return;
    }

    if (timestamp - zombie.lastBiteAt < BITE_INTERVAL) {
        return;
    }

    zombie.lastBiteAt = timestamp;

    const biteDamage = zombie.damage;
    state.plantHealth[row][col] = Math.max(
        0,
        state.plantHealth[row][col] - biteDamage,
    );
    state.damageAccumulated += biteDamage;

    updatePlantHealthVisual(row, col);

    const plantElement = getCell(row, col).querySelector(".placed-plant");

    if (plantElement) {
        plantElement.classList.remove("plant-bitten");
        void plantElement.offsetWidth;
        plantElement.classList.add("plant-bitten");
    }

    zombie.element.classList.remove("zombie-biting");
    void zombie.element.offsetWidth;
    zombie.element.classList.add("zombie-biting");

    if (state.plantHealth[row][col] <= 0) {
        destroyPlantByZombie(row, col);
    }
}

function updatePlantHealthVisual(row, col) {
    const plantElement = getCell(row, col).querySelector(".placed-plant");

    if (!plantElement) {
        return;
    }

    const fill = plantElement.querySelector(".plant-health-fill");
    const current = state.plantHealth[row][col];
    const maximum = state.plantMaxHealth[row][col] || 1;
    const percent = Math.max(0, (current / maximum) * 100);

    if (fill) {
        fill.style.width = `${percent}%`;
        fill.classList.toggle("warning", percent <= 55);
        fill.classList.toggle("danger", percent <= 25);
    }
}

function destroyPlantByZombie(row, col) {
    const type = state.board[row][col];

    if (!type) {
        return;
    }

    const plantElement = getCell(row, col).querySelector(".placed-plant");

    if (plantElement) {
        plantElement.classList.add("plant-destroyed");

        window.setTimeout(() => {
            plantElement.remove();
        }, 520);
    }

    state.board[row][col] = null;
    state.plantHealth[row][col] = 0;
    state.plantMaxHealth[row][col] = 0;
    state.plantBeingEaten[row][col] = 0;
    state.shooterCooldowns.delete(`tiradora-${row}-${col}`);
    state.shooterCooldowns.delete(`hielo-${row}-${col}`);
    state.sunflowerCooldowns.delete(`${row}-${col}`);

    for (const zombie of state.zombies) {
        if (
            zombie.eating &&
            zombie.targetRow === row &&
            zombie.targetCol === col
        ) {
            stopEatingPlant(zombie);
        }
    }

    updateCards();
    updateIntelligencePanels();
    updateRightPanel();

    showMessage(`${PLANTS[type].name} fue devorada por los zombis.`, 1800);
}

function updateZombies(timestamp) {
    const delta = Math.min((timestamp - lastZombieFrame) / 1000, 0.05);
    lastZombieFrame = timestamp;
    if (!state.paused && !state.gameFinished) {
        updateSunflowers(timestamp);
        updateShooters(timestamp);
        updateProjectiles(delta);
        updateExplosivePlants(timestamp);
        for (const zombie of [...state.zombies]) {
            if (zombie.dying) {
                continue;
            }

            if (zombie.eating) {
                updateZombieEating(zombie, timestamp);
                continue;
            }

            const plantCollision = findPlantCollision(zombie);

            if (plantCollision) {
                beginEatingPlant(zombie, plantCollision);
                continue;
            }

            const currentSpeed = getZombieSpeed(zombie, timestamp);
            zombie.x -= currentSpeed * state.speed * delta;
            zombie.element.style.left = `${zombie.x}%`;

            if (zombie.x <= -9 && !zombie.reachedHouse) {
                zombie.reachedHouse = true;
                zombieReachedHouse(zombie);
            }
        }
    }
    zombieAnimationId = requestAnimationFrame(updateZombies);
}

function zombieReachedHouse(zombie) {
    removeZombieUnit(zombie);

    state.lives = Math.max(0, state.lives - 1);
    topLivesValue.textContent = state.lives;

    if (state.lives <= 0) {
        finishGame(false);
        return;
    }

    showMessage(
        `Un zombi llegó a la casa. Quedan ${state.lives} vidas.`,
        2400,
    );

    checkHordeFinished();
}

function removeZombieUnit(zombie) {
    zombie.element.remove();
    state.zombies = state.zombies.filter(item => item.id !== zombie.id);
}

function checkHordeFinished() {
    if (
        state.hordeActive ||
        state.zombies.length > 0 ||
        state.gameFinished
    ) {
        return;
    }

    if (state.currentHorde < HORDES.length) {
        const nextHordeIndex = state.currentHorde;

        showMessage(
            "Horda superada. La segunda horda comenzará en 1 minuto.",
            4200,
        );

        hordeTimerIds.push(
            window.setTimeout(
                () => launchHorde(nextHordeIndex),
                60000,
            ),
        );

        return;
    }

    finishGame(true);
}

function finishGame(victory) {
    if (state.gameFinished) {
        return;
    }

    state.gameFinished = true;
    state.hordeActive = false;

    hordeTimerIds.forEach(timerId => {
        clearTimeout(timerId);
        clearInterval(timerId);
    });
    hordeTimerIds = [];

    recordGameResult(victory);

    if (victory) {
        showMessage(
            "¡Victoria! Sobreviviste a las dos hordas.",
            5000,
        );
        predictionState.textContent = "✓ Dos hordas superadas";
        const title = document.getElementById("gameOverTitle");
        const message = gameOverScreen.querySelector("p");
        if (title) {
            title.textContent = "¡Victoria! Jardín defendido";
        }
        if (message) {
            message.textContent = "Ganaste la partida. Puedes volver a jugar o salir al menú principal.";
        }
        gameOverScreen.classList.remove("hidden");
        return;
    }

    predictionState.textContent = "✕ El zombi se comió tu cerebro";
    const title = document.getElementById("gameOverTitle");
    const message = gameOverScreen.querySelector("p");
    if (title) {
        title.textContent = "¡El zombi llegó a tu casa!";
    }
    if (message) {
        message.textContent = "Te quedaste sin vidas. ¿Quieres volver a defender el jardín?";
    }
    gameOverScreen.classList.remove("hidden");
}

start();

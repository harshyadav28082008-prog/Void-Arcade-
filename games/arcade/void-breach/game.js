
"use strict";

// VOID BREACH — Puzzle engine

const $ = (id) => document.getElementById(id);

const screens = [
    "menu-screen",
    "instructions-screen",
    "game-screen",
    "pause-screen",
    "result-screen"
];

const STORAGE_KEY = "voidBreachSaveV1";
const STATS_KEY = "voidBreachStatsV1";

const N = 1;
const E = 2;
const S = 4;
const W = 8;

const SHAPES = [5, 10, 3, 6, 12, 9];

let grid = [];
let path = [];
let gridSize = 5;
let level = 1;
let difficulty = "easy";
let moves = 0;
let remainingSeconds = 120;
let startingSeconds = 120;
let timerInterval = null;
let paused = false;
let gameActive = false;
let soundEnabled = true;
let audioContext = null;
let hintIndex = -1;

function showScreen(id) {
    screens.forEach((screenId) => {
        $(screenId).classList.toggle("hidden", screenId !== id);
    });
}

function rotateMask(mask) {
    return ((mask << 1) & 15) | ((mask >> 3) & 1);
}

function rotateTimes(mask, times) {
    for (let i = 0; i < times; i++) {
        mask = rotateMask(mask);
    }
    return mask;
}

function randomInt(max) {
    return Math.floor(Math.random() * max);
}

function formatTime(seconds) {
    const safe = Math.max(0, seconds);
    const minutes = Math.floor(safe / 60);
    const secs = safe % 60;

    return String(minutes).padStart(2, "0") +
        ":" + String(secs).padStart(2, "0");
}

function glyphForMask(mask) {
    const glyphs = {
        1: "↑",
        2: "→",
        4: "↓",
        8: "←",
        5: "│",
        10: "─",
        3: "└",
        6: "┌",
        12: "┐",
        9: "┘",
        7: "├",
        11: "┴",
        13: "┤",
        14: "┬",
        15: "╋"
    };

    return glyphs[mask] || "·";
}

function getStats() {
    try {
        const data = JSON.parse(localStorage.getItem(STATS_KEY));
        return {
            completed: Number(data?.completed) || 0,
            best: Number(data?.best) || 0,
            highestLevel: Number(data?.highestLevel) || 1
        };
    } catch {
        return { completed: 0, best: 0, highestLevel: 1 };
    }
}

function updateMenuStats() {
    const stats = getStats();

    $("menu-completed").textContent = stats.completed;
    $("menu-best").textContent = stats.best;

    try {
        $("continue-button").disabled =
            !localStorage.getItem(STORAGE_KEY);
    } catch {
        $("continue-button").disabled = true;
    }

    $("continue-button").style.opacity =
        $("continue-button").disabled ? "0.45" : "1";
}

function saveStats(score, won) {
    const old = getStats();

    const updated = {
        completed: old.completed + (won ? 1 : 0),
        best: Math.max(old.best, score),
        highestLevel: Math.max(old.highestLevel, won ? level + 1 : level)
    };

    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(updated));
    } catch (error) {
        console.warn("Could not save statistics:", error);
    }

    updateMenuStats();
}

function saveSession() {
    if (!gameActive || !grid.length) return;

    const session = {
        grid,
        path,
        gridSize,
        level,
        difficulty,
        moves,
        remainingSeconds
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
        console.warn("Could not save session:", error);
    }
}

function clearSavedSession() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn("Could not clear saved session:", error);
    }

    updateMenuStats();
}

function createPath(size) {
    const result = [0];
    let row = 0;
    let col = 0;
    let preferEast = true;

    while (row !== size - 1 || col !== size - 1) {
        if (preferEast && col < size - 1) {
            col++;
            preferEast = false;
        } else if (row < size - 1) {
            row++;
            preferEast = true;
        } else {
            col++;
        }

        result.push(row * size + col);
    }

    return result;
}

function directionBetween(from, to, size) {
    if (to === from - size) return N;
    if (to === from + 1) return E;
    if (to === from + size) return S;
    if (to === from - 1) return W;

    return 0;
}

function solutionMaskAt(index, route, size) {
    const position = route.indexOf(index);
    if (position < 0) return 0;

    let mask = 0;

    if (position > 0) {
        mask |= directionBetween(index, route[position - 1], size);
    }

    if (position < route.length - 1) {
        mask |= directionBetween(index, route[position + 1], size);
    }

    return mask;
}

function generatePuzzle() {
    grid = [];
    path = createPath(gridSize);

    for (let i = 0; i < gridSize * gridSize; i++) {
        const desired = solutionMaskAt(i, path, gridSize);
        const isPath = desired !== 0;
        const isSource = i === 0;
        const isCore = i === gridSize * gridSize - 1;

        let solutionMask = desired;

        if (!isPath) {
            solutionMask = SHAPES[randomInt(SHAPES.length)];
        }

        const rotatable = !isSource && !isCore;
        const turns = rotatable ? randomInt(4) : 0;

        grid.push({
            mask: rotateTimes(solutionMask, turns),
            solutionMask,
            kind: isSource ? "source" :
                isCore ? "core" :
                isPath ? "path" : "decoy",
            rotatable
        });
    }

    // Ensure the initial puzzle requires at least one rotation.
    if (path.length > 2) {
        const index = path[1];

        if (grid[index].mask === grid[index].solutionMask) {
            grid[index].mask = rotateMask(grid[index].mask);
        }
    }

    hintIndex = -1;
}

function getPoweredCells() {
    const powered = new Set([0]);
    const queue = [0];

    while (queue.length) {
        const current = queue.shift();
        const row = Math.floor(current / gridSize);
        const col = current % gridSize;

        const directions = [
            { bit: N, opposite: S, next: current - gridSize, valid: row > 0 },
            { bit: E, opposite: W, next: current + 1, valid: col < gridSize - 1 },
            { bit: S, opposite: N, next: current + gridSize, valid: row < gridSize - 1 },
            { bit: W, opposite: E, next: current - 1, valid: col > 0 }
        ];

        for (const direction of directions) {
            if (!direction.valid) continue;
            if (!(grid[current].mask & direction.bit)) continue;

            const next = direction.next;

            if (!(grid[next].mask & direction.opposite)) continue;
            if (powered.has(next)) continue;

            powered.add(next);
            queue.push(next);
        }
    }

    return powered;
}

function isConnected() {
    return getPoweredCells().has(gridSize * gridSize - 1);
}

function renderBoard() {
    const board = $("puzzle-board");
    const powered = getPoweredCells();

    board.innerHTML = "";
    board.style.gridTemplateColumns =
        `repeat(${gridSize}, minmax(0, 1fr))`;

    $("grid-size").textContent =
        `${gridSize} × ${gridSize}`;

    grid.forEach((cell, index) => {
        const tile = document.createElement("button");

        tile.type = "button";
        tile.className = "tile";

        if (cell.kind === "source") {
            tile.classList.add("source");
            tile.textContent = "S";
            tile.setAttribute("aria-label", "Source");
        } else if (cell.kind === "core") {
            tile.classList.add("core");
            tile.textContent = "C";
            tile.setAttribute("aria-label", "Core");
        } else {
            tile.textContent = glyphForMask(cell.mask);
            tile.setAttribute(
                "aria-label",
                `Circuit tile ${index + 1}, rotate to change connections`
            );
        }

        if (powered.has(index)) {
            tile.classList.add("powered");
        }

        if (index === hintIndex) {
            tile.classList.add("hint");
        }

        if (!cell.rotatable) {
            tile.disabled = true;
        }

        tile.addEventListener("click", () => rotateTile(index));

        board.appendChild(tile);
    });

    $("moves").textContent = moves;
    $("timer").textContent = formatTime(remainingSeconds);
    $("level-number").textContent = String(level).padStart(2, "0");
    $("level-title").textContent =
        "BREACH " + String(level).padStart(3, "0");

    const connected = powered.has(gridSize * gridSize - 1);

    $("connection-status").textContent =
        connected ? "CONNECTED" : "DISCONNECTED";

    $("connection-status").classList.toggle("connected", connected);
}

function initAudio() {
    if (!soundEnabled) return;

    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) return;

    if (!audioContext) {
        audioContext = new AudioClass();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
    }
}

function playTone(frequency, duration, type = "sine", volume = 0.035) {
    if (!soundEnabled) return;

    initAudio();
    if (!audioContext) return;

    try {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(
            frequency, audioContext.currentTime
        );

        gain.gain.setValueAtTime(volume, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001, audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        console.warn("Audio playback failed:", error);
    }
}

function playSound(type) {
    const sounds = {
        click: [420, 0.06, "sine"],
        rotate: [620, 0.07, "triangle"],
        hint: [760, 0.12, "sine"],
        pause: [300, 0.1, "triangle"],
        success: [880, 0.15, "sine"],
        failure: [150, 0.3, "sawtooth"]
    };

    const sound = sounds[type];
    if (sound) playTone(sound[0], sound[1], sound[2]);
}

function setMessage(message) {
    $("game-message").textContent = message;
}

function rotateTile(index) {
    if (!gameActive || paused) return;

    const cell = grid[index];
    if (!cell || !cell.rotatable) return;

    initAudio();

    cell.mask = rotateMask(cell.mask);
    moves++;
    hintIndex = -1;

    playSound("rotate");
    renderBoard();

    if (isConnected()) {
        finishGame(true);
        return;
    }

    setMessage("Signal unstable. Keep routing the circuit.");
    saveSession();
}

function startTimer() {
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (!gameActive || paused) return;

        remainingSeconds--;
        $("timer").textContent = formatTime(remainingSeconds);

        if (remainingSeconds <= 0) {
            remainingSeconds = 0;
            finishGame(false);
            return;
        }

        saveSession();
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function startNewGame(nextLevel = 1) {
    initAudio();
    stopTimer();

    level = nextLevel;
    difficulty = $("difficulty-select").value;

    const settings = {
        easy: { size: 5, time: 120 },
        normal: { size: 6, time: 105 },
        hard: { size: 7, time: 90 }
    };

    const chosen = settings[difficulty] || settings.easy;

    gridSize = Math.min(7, chosen.size + Math.floor((level - 1) / 3));
    startingSeconds = Math.max(45, chosen.time - (level - 1) * 5);
    remainingSeconds = startingSeconds;

    moves = 0;
    paused = false;
    gameActive = true;

    generatePuzzle();
    showScreen("game-screen");
    renderBoard();

    setMessage("Connect SOURCE to CORE before time expires.");
    playSound("click");
    saveSession();
    startTimer();
}

function loadSession() {
    let session;

    try {
        session = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
        session = null;
    }

    if (
        !session ||
        !Array.isArray(session.grid) ||
        !Array.isArray(session.path) ||
        session.grid.length !== session.gridSize * session.gridSize ||
        !Number.isFinite(session.remainingSeconds)
    ) {
        setMessage("No valid saved session was found.");
        return;
    }

    stopTimer();

    grid = session.grid;
    path = session.path;
    gridSize = session.gridSize;
    level = session.level || 1;
    difficulty = session.difficulty || "easy";
    moves = session.moves || 0;
    remainingSeconds = session.remainingSeconds;
    startingSeconds = remainingSeconds + 1;

    $("difficulty-select").value = difficulty;

    paused = false;
    gameActive = true;
    hintIndex = -1;

    showScreen("game-screen");
    renderBoard();
    setMessage("Saved session restored. Continue the breach.");

    initAudio();
    startTimer();
}

function finishGame(won) {
    if (!gameActive) return;

    stopTimer();
    gameActive = false;
    paused = false;

    const score = won
        ? Math.max(100, remainingSeconds * 10 + level * 100 - moves * 2)
        : 0;

    $("result-title").textContent =
        won ? "BREACH COMPLETE" : "ACCESS DENIED";

    $("result-eyebrow").textContent =
        won ? "CORE ACCESS GRANTED" : "SECURITY LOCKDOWN";

    $("result-message").textContent = won
        ? "The circuit is connected. Network access secured."
        : "Time expired. The security system has locked the network.";

    $("result-score").textContent = score;
    $("result-time").textContent = formatTime(
        startingSeconds - remainingSeconds
    );
    $("result-moves").textContent = moves;

    $("next-button").hidden = !won;

    saveStats(score, won);
    clearSavedSession();

    showScreen("result-screen");
    playSound(won ? "success" : "failure");
}

function useHint() {
    if (!gameActive || paused) return;

    const wrong = path.find((index) => {
        const cell = grid[index];
        return cell.rotatable && cell.mask !== cell.solutionMask;
    });

    if (wrong === undefined) {
        setMessage("No incorrect path tiles remain. Check the connection.");
        return;
    }

    hintIndex = wrong;
    renderBoard();

    setMessage("Highlighted tile: rotate it to correct the route.");
    playSound("hint");
}

function pauseGame() {
    if (!gameActive || paused) return;

    paused = true;
    showScreen("pause-screen");
    saveSession();
    playSound("pause");
}

function resumeGame() {
    if (!gameActive || !paused) return;

    paused = false;
    showScreen("game-screen");
    renderBoard();
    startTimer();
    playSound("click");
}

function exitToMenu() {
    stopTimer();
    paused = false;
    gameActive = false;

    updateMenuStats();
    showScreen("menu-screen");
}

$("start-button").addEventListener("click", () => {
    startNewGame(1);
});

$("continue-button").addEventListener("click", loadSession);

$("instructions-button").addEventListener("click", () => {
    showScreen("instructions-screen");
});

$("instructions-back").addEventListener("click", () => {
    showScreen("menu-screen");
});

$("hint-button").addEventListener("click", useHint);

$("pause-button").addEventListener("click", pauseGame);

$("resume-button").addEventListener("click", resumeGame);

$("restart-button").addEventListener("click", () => {
    startNewGame(level);
});

$("retry-button").addEventListener("click", () => {
    startNewGame(level);
});

$("next-button").addEventListener("click", () => {
    startNewGame(level + 1);
});

$("result-menu-button").addEventListener("click", exitToMenu);
$("pause-menu-button").addEventListener("click", exitToMenu);

$("sound-button").addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    $("sound-button").textContent =
        soundEnabled ? "SOUND: ON" : "SOUND: OFF";

    if (soundEnabled) {
        initAudio();
        playSound("click");
    }
});

updateMenuStats();
showScreen("menu-screen");

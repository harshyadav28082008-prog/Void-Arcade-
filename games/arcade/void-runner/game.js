
"use strict";

// ==========================================
// VOID RUNNER - First Playable Prototype
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayEyebrow = document.getElementById("overlayEyebrow");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const overlayHint = document.getElementById("overlayHint");
const startButton = document.getElementById("startButton");

let width = 0;
let height = 0;
let lastTime = 0;
let elapsed = 0;
let spawnTimer = 0;
let pickupTimer = 0;
let score = 0;
let best = loadBest();
let gameState = "ready";

let player;
let asteroids = [];
let pickups = [];
let stars = [];

const keys = new Set();
const touchDirections = new Set();

const PLAYER_SPEED = 245;
const PLAYER_RADIUS = 13;

// ==========================================
// SAVING
// ==========================================

function loadBest() {
    try {
        return Number(localStorage.getItem("voidRunnerBest")) || 0;
    } catch (error) {
        return 0;
    }
}

function saveBest() {
    try {
        localStorage.setItem("voidRunnerBest", String(best));
    } catch (error) {
        // The game remains playable if storage is blocked.
    }
}

bestElement.textContent = best;

// ==========================================
// CANVAS RESIZING
// ==========================================

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    width = rect.width;
    height = rect.height;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    createStars();

    if (player) {
        player.x = Math.max(
            PLAYER_RADIUS,
            Math.min(width - PLAYER_RADIUS, player.x)
        );

        player.y = Math.max(
            PLAYER_RADIUS,
            Math.min(height - PLAYER_RADIUS, player.y)
        );
    }

    draw();
}

function createStars() {
    stars = [];

    const count = Math.floor((width * height) / 1800);

    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 1.5 + 0.4,
            alpha: Math.random() * 0.55 + 0.15
        });
    }
}

window.addEventListener("resize", resizeCanvas);

if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
}

// ==========================================
// GAME SETUP
// ==========================================

function resetGame() {
    elapsed = 0;
    spawnTimer = 0.6;
    pickupTimer = 3;
    score = 0;

    asteroids = [];
    pickups = [];

    player = {
        x: width / 2,
        y: height / 2,
        angle: -Math.PI / 2,
        invulnerable: 0
    };

    scoreElement.textContent = "0";

    keys.clear();
    touchDirections.clear();

    document.querySelectorAll(".direction").forEach(button => {
        button.classList.remove("pressed");
    });
}

function startGame() {
    resetGame();

    gameState = "running";
    overlay.classList.add("hidden");
    lastTime = performance.now();
}

function endGame() {
    if (gameState !== "running") return;

    gameState = "over";

    if (score > best) {
        best = score;
        bestElement.textContent = best;
        saveBest();
    }

    overlayEyebrow.textContent = "RUN TERMINATED";
    overlayTitle.textContent = "LOST IN THE VOID";
    overlayText.textContent =
        `Final score: ${score}. Best score: ${best}. ` +
        "The void is waiting. Try again.";

    startButton.textContent = "RETRY";
    overlayHint.textContent = "LEARN THE FIELD. BEAT YOUR RECORD.";

    overlay.classList.remove("hidden");
}

function showReadyScreen() {
    gameState = "ready";

    overlayEyebrow.textContent = "UNKNOWN SPACE";
    overlayTitle.textContent = "ENTER THE VOID";
    overlayText.textContent =
        "Navigate the asteroid field. Collect energy shards. " +
        "Survive as long as you can.";

    startButton.textContent = "START RUN";
    overlayHint.textContent =
        "WASD / ARROW KEYS OR TOUCH CONTROLS";

    overlay.classList.remove("hidden");
}

// ==========================================
// INPUT
// ==========================================

const movementKeys = new Set([
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "w", "a", "s", "d"
]);

window.addEventListener("keydown", event => {
    if (movementKeys.has(event.key)) {
        event.preventDefault();
        keys.add(event.key.toLowerCase());
    }

    if (
        (event.key === "Enter" || event.key === " ") &&
        gameState !== "running"
    ) {
        event.preventDefault();
        startGame();
    }
});

window.addEventListener("keyup", event => {
    keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
    keys.clear();
    touchDirections.clear();

    document.querySelectorAll(".direction").forEach(button => {
        button.classList.remove("pressed");
    });
});

document.querySelectorAll(".direction").forEach(button => {
    const direction = button.dataset.direction;

    button.addEventListener("pointerdown", event => {
        event.preventDefault();

        touchDirections.add(direction);
        button.classList.add("pressed");

        if (button.setPointerCapture) {
            button.setPointerCapture(event.pointerId);
        }
    });

    function releaseDirection(event) {
        event.preventDefault();
        touchDirections.delete(direction);
        button.classList.remove("pressed");
    }

    button.addEventListener("pointerup", releaseDirection);
    button.addEventListener("pointercancel", releaseDirection);
    button.addEventListener("lostpointercapture", () => {
        touchDirections.delete(direction);
        button.classList.remove("pressed");
    });

    button.addEventListener("contextmenu", event => {
        event.preventDefault();
    });
});

startButton.addEventListener("click", startGame);

// ==========================================
// ASTEROID SPAWNING
// ==========================================

function spawnAsteroid() {
    const margin = 35;
    const edge = Math.floor(Math.random() * 4);

    let x;
    let y;

    if (edge === 0) {
        x = Math.random() * width;
        y = -margin;
    } else if (edge === 1) {
        x = width + margin;
        y = Math.random() * height;
    } else if (edge === 2) {
        x = Math.random() * width;
        y = height + margin;
    } else {
        x = -margin;
        y = Math.random() * height;
    }

    const targetX = player.x + (Math.random() - 0.5) * 150;
    const targetY = player.y + (Math.random() - 0.5) * 150;

    const angle = Math.atan2(targetY - y, targetX - x);

    const speed = 75 + Math.random() * 45 + Math.min(elapsed * 2, 100);
    const radius = 12 + Math.random() * 17;

    const points = [];

    for (let i = 0; i < 9; i++) {
        points.push(0.75 + Math.random() * 0.45);
    }

    asteroids.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.8,
        points
    });
}

// ==========================================
// ENERGY PICKUPS
// ==========================================

function spawnPickup() {
    const margin = 28;

    pickups.push({
        x: margin + Math.random() * Math.max(1, width - margin * 2),
        y: margin + Math.random() * Math.max(1, height - margin * 2),
        radius: 9,
        phase: Math.random() * Math.PI * 2
    });
}

// ==========================================
// UPDATE GAME
// ==========================================

function update(dt) {
    if (gameState !== "running") return;

    elapsed += dt;

    // Read keyboard and touch directions.
    let dx = 0;
    let dy = 0;

    if (keys.has("arrowleft") || keys.has("a") ||
        touchDirections.has("left")) dx -= 1;

    if (keys.has("arrowright") || keys.has("d") ||
        touchDirections.has("right")) dx += 1;

    if (keys.has("arrowup") || keys.has("w") ||
        touchDirections.has("up")) dy -= 1;

    if (keys.has("arrowdown") || keys.has("s") ||
        touchDirections.has("down")) dy += 1;

    // Normalize diagonal movement so it is not faster.
    const length = Math.hypot(dx, dy);

    if (length > 0) {
        dx /= length;
        dy /= length;

        player.x += dx * PLAYER_SPEED * dt;
        player.y += dy * PLAYER_SPEED * dt;

        player.angle = Math.atan2(dy, dx);
    }

    // Keep the player inside the arena.
    player.x = Math.max(
        PLAYER_RADIUS,
        Math.min(width - PLAYER_RADIUS, player.x)
    );

    player.y = Math.max(
        PLAYER_RADIUS,
        Math.min(height - PLAYER_RADIUS, player.y)
    );

    // Survival score.
    score = Math.floor(elapsed * 10);
    scoreElement.textContent = score;

    // Spawn more asteroids as time passes.
    spawnTimer -= dt;

    if (spawnTimer <= 0) {
        spawnAsteroid();

        const interval = Math.max(0.32, 1.05 - elapsed * 0.009);
        spawnTimer = interval * (0.8 + Math.random() * 0.4);
    }

    // Spawn energy shards.
    pickupTimer -= dt;

    if (pickupTimer <= 0) {
        if (pickups.length < 3) {
            spawnPickup();
        }

        pickupTimer = 4 + Math.random() * 2;
    }

    // Move and rotate asteroids.
    for (const asteroid of asteroids) {
        asteroid.x += asteroid.vx * dt;
        asteroid.y += asteroid.vy * dt;
        asteroid.rotation += asteroid.spin * dt;
    }

    // Remove asteroids that have left the arena.
    asteroids = asteroids.filter(asteroid =>
        asteroid.x > -80 &&
        asteroid.x < width + 80 &&
        asteroid.y > -80 &&
        asteroid.y < height + 80
    );

    // Collect energy shards.
    for (let i = pickups.length - 1; i >= 0; i--) {
        const pickup = pickups[i];
        pickup.phase += dt * 4;

        const distance = Math.hypot(
            player.x - pickup.x,
            player.y - pickup.y
        );

        if (distance < PLAYER_RADIUS + pickup.radius) {
            score += 25;
            scoreElement.textContent = score;
            pickups.splice(i, 1);
        }
    }

    // Check asteroid collisions.
    for (const asteroid of asteroids) {
        const distance = Math.hypot(
            player.x - asteroid.x,
            player.y - asteroid.y
        );

        if (distance < PLAYER_RADIUS + asteroid.radius * 0.82) {
            endGame();
            break;
        }
    }
}

// ==========================================
// DRAW BACKGROUND
// ==========================================

function drawBackground() {
    ctx.fillStyle = "#080e1d";
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(
        width * 0.5, height * 0.45, 5,
        width * 0.5, height * 0.45,
        Math.max(width, height) * 0.8
    );

    glow.addColorStop(0, "rgba(25, 48, 91, 0.24)");
    glow.addColorStop(1, "rgba(3, 7, 17, 0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = "#d7e9ff";

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

// ==========================================
// DRAW PLAYER
// ==========================================

function drawPlayer() {
    if (!player) return;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Engine glow.
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#55dfff";

    ctx.fillStyle = "#4b83ff";
    ctx.beginPath();
    ctx.moveTo(-9, -5);
    ctx.lineTo(-20 - Math.random() * 4, 0);
    ctx.lineTo(-9, 5);
    ctx.closePath();
    ctx.fill();

    // Ship body.
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#68e4ff";

    ctx.fillStyle = "#c7f5ff";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-9, -10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fill();

    // Cockpit.
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#4b83ff";
    ctx.beginPath();
    ctx.arc(2, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ==========================================
// DRAW ASTEROIDS
// ==========================================

function drawAsteroid(asteroid) {
    ctx.save();

    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.rotation);

    ctx.beginPath();

    for (let i = 0; i < asteroid.points.length; i++) {
        const angle =
            (i / asteroid.points.length) * Math.PI * 2;

        const radius = asteroid.radius * asteroid.points[i];
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.closePath();

    ctx.fillStyle = "#354159";
    ctx.strokeStyle = "#91a5c9";
    ctx.lineWidth = 1.4;

    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(95, 144, 255, 0.18)";

    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#536580";
    ctx.beginPath();
    ctx.arc(-asteroid.radius * 0.2, -asteroid.radius * 0.1,
        asteroid.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ==========================================
// DRAW ENERGY SHARDS
// ==========================================

function drawPickup(pickup) {
    const pulse = Math.sin(pickup.phase) * 2;

    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.rotate(pickup.phase * 0.25);

    ctx.shadowBlur = 18;
    ctx.shadowColor = "#68e4ff";

    ctx.fillStyle = "#68e4ff";
    ctx.beginPath();

    ctx.moveTo(0, -pickup.radius - pulse);
    ctx.lineTo(pickup.radius * 0.7, 0);
    ctx.lineTo(0, pickup.radius + pulse);
    ctx.lineTo(-pickup.radius * 0.7, 0);

    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.restore();
}

// ==========================================
// RENDER FRAME
// ==========================================

function draw() {
    if (!width || !height) return;

    drawBackground();

    for (const pickup of pickups) {
        drawPickup(pickup);
    }

    for (const asteroid of asteroids) {
        drawAsteroid(asteroid);
    }

    drawPlayer();
}

// ==========================================
// MAIN GAME LOOP
// ==========================================

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;

    // Avoid huge movement jumps after a slow frame.
    const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// ==========================================
// INITIALIZE
// ==========================================

resizeCanvas();
resetGame();
showReadyScreen();

requestAnimationFrame(gameLoop);

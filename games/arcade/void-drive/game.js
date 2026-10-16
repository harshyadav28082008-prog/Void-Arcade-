
"use strict";

(() => {
    /* =====================================================
       VOID DRIVE — 25 LEVELS + ENDLESS DRIVE
       ===================================================== */

    const $ = id => document.getElementById(id);

    const canvas = $("drive-canvas");
    const ctx = canvas.getContext("2d");

    const menu = $("main-menu");
    const levelScreen = $("level-screen");
    const gameScreen = $("game-screen");
    const levelGrid = $("level-grid");

    const speedText = $("speed");
    const distanceText = $("distance");
    const speedFill = $("speed-fill");
    const objectiveFill = $("objective-fill");
    const modeDisplay = $("mode-display");

    const objectiveTitle = $("objective-title");
    const objectiveValue = $("objective-value");

    const pausePanel = $("pause-panel");
    const resultPanel = $("result-panel");

    const resultEyebrow = $("result-eyebrow");
    const resultTitle = $("result-title");
    const resultText = $("result-text");
    const resultMain = $("result-main");

    const crashFlash = $("crash-flash");

    const SAVE_KEY = "voidDriveSaveV1";
    const MAX_LEVEL = 25;
    const LEVEL_DISTANCE = 1000;

    const DEFAULT_SAVE = {
        unlocked: 1,
        bestEndless: 0,
        completed: []
    };

    function loadSave() {
        try {
            const data = JSON.parse(
                localStorage.getItem(SAVE_KEY) || "null"
            );

            if (!data) {
                return { ...DEFAULT_SAVE, completed: [] };
            }

            return {
                unlocked: Math.max(
                    1,
                    Math.min(
                        MAX_LEVEL,
                        Math.floor(Number(data.unlocked) || 1)
                    )
                ),
                bestEndless: Math.max(
                    0,
                    Math.floor(Number(data.bestEndless) || 0)
                ),
                completed: Array.isArray(data.completed)
                    ? data.completed.filter(
                        n => Number.isInteger(n) &&
                             n >= 1 &&
                             n <= MAX_LEVEL
                    )
                    : []
            };
        } catch {
            return { ...DEFAULT_SAVE, completed: [] };
        }
    }

    let save = loadSave();

    function saveGame() {
        try {
            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify(save)
            );
        } catch {
            console.warn("VOID DRIVE: save unavailable.");
        }
    }

    /* =====================================================
       CANVAS SIZE
       ===================================================== */

    let width = 0;
    let height = 0;
    let dpr = 1;

    function resizeCanvas() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);

        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);

        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (!running) draw();
    }

    window.addEventListener("resize", resizeCanvas);

    /* =====================================================
       GAME STATE
       ===================================================== */

    let running = false;
    let paused = false;
    let gameOver = false;

    let mode = "level";
    let currentLevel = 1;

    let distance = 0;
    let speed = 0;

    let cameraX = 0;
    let cameraY = 0;
    let lastTime = 0;
    let animationFrame = 0;

    let crashCooldown = 0;

    // Remembers the furthest forward position reached.
    // Driving backwards cannot increase distance again.
    let furthestY = 0;

    const car = {
        x: 0,
        y: 0,
        angle: 0,
        width: 27,
        height: 48,
        maxSpeed: 290,
        acceleration: 180,
        braking: 360,
        friction: 90,
        steering: 2.4
    };

    let roadPoints = [];
    const roadWidth = 190;
    const roadSpacing = 120;

    const keys = new Set();
    const touchControls = new Set();

    /* =====================================================
       ROAD GENERATION
       ===================================================== */

    function generateRoad(startY, amount) {
        let lastX = roadPoints.length
            ? roadPoints[roadPoints.length - 1].x
            : 0;

        let lastY = roadPoints.length
            ? roadPoints[roadPoints.length - 1].y
            : startY;

        let direction = 0;

        for (let i = 0; i < amount; i++) {
            direction += (Math.random() - 0.5) * 0.5;

            direction = Math.max(
                -1.2,
                Math.min(1.2, direction)
            );

            lastX += direction * 55;
            lastY -= roadSpacing;

            roadPoints.push({ x: lastX, y: lastY });
        }
    }

    function resetRoad() {
        roadPoints = [];

        generateRoad(200, 100);

        cameraX = 0;
        cameraY = 0;

        car.x = 0;
        car.y = 0;
        car.angle = 0;
    }

    function roadCenterAt(y) {
        if (!roadPoints.length) return 0;

        let best = roadPoints[0];
        let bestDistance = Math.abs(best.y - y);

        for (const point of roadPoints) {
            const d = Math.abs(point.y - y);

            if (d < bestDistance) {
                best = point;
                bestDistance = d;
            }
        }

        return best.x;
    }

    /* =====================================================
       AUDIO
       ===================================================== */

    let audioContext = null;
    let engineOscillator = null;
    let engineGain = null;

    function initAudio() {
        try {
            if (!audioContext) {
                const AudioContextClass =
                    window.AudioContext ||
                    window.webkitAudioContext;

                if (!AudioContextClass) return;

                audioContext = new AudioContextClass();
            }

            if (audioContext.state === "suspended") {
                audioContext.resume();
            }
        } catch (error) {
            console.warn("Audio unavailable.", error);
        }
    }

    function beep(
        frequency,
        duration,
        type = "sine",
        volume = 0.05
    ) {
        if (!audioContext) return;

        try {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();

            oscillator.type = type;
            oscillator.frequency.value = frequency;

            gain.gain.setValueAtTime(
                volume,
                audioContext.currentTime
            );

            gain.gain.exponentialRampToValueAtTime(
                0.001,
                audioContext.currentTime + duration
            );

            oscillator.connect(gain);
            gain.connect(audioContext.destination);

            oscillator.start();
            oscillator.stop(
                audioContext.currentTime + duration
            );
        } catch {}
    }

    function startEngineSound() {
        if (!audioContext || engineOscillator) return;

        try {
            engineOscillator = audioContext.createOscillator();
            engineGain = audioContext.createGain();

            engineOscillator.type = "sawtooth";
            engineOscillator.frequency.value = 70;
            engineGain.gain.value = 0.008;

            engineOscillator.connect(engineGain);
            engineGain.connect(audioContext.destination);

            engineOscillator.start();
        } catch {
            engineOscillator = null;
            engineGain = null;
        }
    }

    function updateEngineSound() {
        if (!engineOscillator || !engineGain) return;

        engineOscillator.frequency.value = 60 + speed * 0.55;

        engineGain.gain.value = running && !paused
            ? 0.008 + speed / 18000
            : 0;
    }

    function stopEngineSound() {
        if (!engineOscillator) return;

        try {
            engineOscillator.stop();
        } catch {}

        engineOscillator = null;
        engineGain = null;
    }

    /* =====================================================
       MENUS AND SCREENS
       ===================================================== */

    function showScreen(screen) {
        document.querySelectorAll(".screen").forEach(item => {
            item.classList.remove("active");
        });

        screen.classList.add("active");
    }

    $("level-mode-btn").addEventListener("click", () => {
        initAudio();
        buildLevelSelect();
        showScreen(levelScreen);
    });

    $("endless-mode-btn").addEventListener("click", () => {
        initAudio();
        startEndless();
    });

    $("level-back").addEventListener("click", () => {
        showScreen(menu);
    });

    function buildLevelSelect() {
        levelGrid.replaceChildren();

        for (let i = 1; i <= MAX_LEVEL; i++) {
            const unlocked = i <= save.unlocked;
            const card = document.createElement("button");

            card.className = "level-card" +
                (unlocked ? "" : " locked");

            const number = document.createElement("div");
            number.className = "level-number";
            number.textContent = unlocked
                ? String(i).padStart(2, "0")
                : "×";

            const name = document.createElement("span");
            name.className = "level-name";

            name.textContent = !unlocked
                ? "LOCKED"
                : save.completed.includes(i)
                    ? "COMPLETED"
                    : "AVAILABLE";

            card.append(number, name);
            card.disabled = !unlocked;

            if (unlocked) {
                card.addEventListener("click", () => {
                    initAudio();
                    startLevel(i);
                });
            }

            levelGrid.appendChild(card);
        }
    }

    function startLevel(level) {
        mode = "level";
        currentLevel = level;

        modeDisplay.textContent =
            `LEVEL ${String(level).padStart(2, "0")}`;

        objectiveTitle.textContent = "LEVEL DISTANCE";
        objectiveValue.textContent = `0 / ${LEVEL_DISTANCE} M`;

        showScreen(gameScreen);
        startGame();
    }

    function startEndless() {
        mode = "endless";
        currentLevel = 0;

        modeDisplay.textContent = "ENDLESS DRIVE";
        objectiveTitle.textContent = "BEST";
        objectiveValue.textContent = `${save.bestEndless} M`;

        showScreen(gameScreen);
        startGame();
    }

    /* =====================================================
       START / STOP
       ===================================================== */

    function startGame() {
        initAudio();
        stopEngineSound();

        resetRoad();

        distance = 0;
        speed = 0;
        paused = false;
        gameOver = false;
        running = true;
        crashCooldown = 0;
        furthestY = car.y;

        keys.clear();
        touchControls.clear();

        hidePanel(pausePanel);
        hidePanel(resultPanel);

        startEngineSound();

        lastTime = performance.now();

        cancelAnimationFrame(animationFrame);
        resizeCanvas();

        animationFrame = requestAnimationFrame(gameLoop);
    }

    function stopGame() {
        running = false;
        paused = false;

        cancelAnimationFrame(animationFrame);
        stopEngineSound();

        keys.clear();
        touchControls.clear();
    }

    /* =====================================================
       KEYBOARD AND TOUCH CONTROLS
       ===================================================== */

    document.addEventListener("keydown", event => {
        const key = event.key.length === 1
            ? event.key.toLowerCase()
            : event.key;

        if (
            ["ArrowUp", "ArrowDown", "ArrowLeft",
             "ArrowRight", " "].includes(key)
        ) {
            event.preventDefault();
        }

        if (key === " " && event.repeat) return;

        keys.add(key);
    });

    document.addEventListener("keyup", event => {
        const key = event.key.length === 1
            ? event.key.toLowerCase()
            : event.key;

        keys.delete(key);
    });

    window.addEventListener("blur", () => {
        keys.clear();
        touchControls.clear();
    });

    document.querySelectorAll("[data-control]").forEach(button => {
        const control = button.dataset.control;

        const start = event => {
            event.preventDefault();

            button.classList.add("active");
            button.setPointerCapture?.(event.pointerId);

            touchControls.add(control);
        };

        const stop = () => {
            button.classList.remove("active");
            touchControls.delete(control);
        };

        button.addEventListener("pointerdown", start);
        button.addEventListener("pointerup", stop);
        button.addEventListener("pointercancel", stop);
        button.addEventListener("lostpointercapture", stop);
    });

    /* =====================================================
       GAME LOOP
       ===================================================== */

    function gameLoop(now) {
        if (!running || gameOver) return;

        const dt = Math.min((now - lastTime) / 1000, 0.035);
        lastTime = now;

        if (!paused) {
            update(dt);
            draw();
        }

        updateEngineSound();

        if (running && !gameOver) {
            animationFrame = requestAnimationFrame(gameLoop);
        }
    }

    /* =====================================================
       UPDATE
       ===================================================== */

    function update(dt) {
        crashCooldown = Math.max(0, crashCooldown - dt);

        const accelerate =
            keys.has("w") ||
            keys.has("ArrowUp") ||
            touchControls.has("accelerate");

        const brake =
            keys.has("s") ||
            keys.has("ArrowDown") ||
            touchControls.has("brake");

        const left =
            keys.has("a") ||
            keys.has("ArrowLeft") ||
            touchControls.has("left");

        const right =
            keys.has("d") ||
            keys.has("ArrowRight") ||
            touchControls.has("right");

        /* SPEED */

        if (accelerate) {
            speed += car.acceleration * dt;
        } else {
            speed -= car.friction * dt;
        }

        if (brake) {
            speed -= car.braking * dt;
        }

        speed = Math.max(0, Math.min(car.maxSpeed, speed));

        /* STEERING */

        const steering = Number(right) - Number(left);

        if (steering !== 0) {
            const steeringPower =
                0.45 + speed / car.maxSpeed * 0.55;

            car.angle += steering *
                car.steering *
                steeringPower *
                dt;
        }

        /* CAR MOVEMENT */

        car.x += Math.sin(car.angle) * speed * dt;
        car.y -= Math.cos(car.angle) * speed * dt;

        /* NEW FORWARD DISTANCE ONLY */

        if (car.y < furthestY) {
            furthestY = car.y;
        }

        distance = Math.floor(
            Math.max(0, -furthestY * 0.12)
        );

        /* CAMERA */

        cameraX += (car.x - cameraX) * Math.min(1, dt * 5);
        cameraY += (car.y - cameraY) * Math.min(1, dt * 5);

        /* EXTEND ENDLESS ROAD */

        const highestPoint = roadPoints[roadPoints.length - 1];

        if (highestPoint && car.y < highestPoint.y + 1500) {
            generateRoad(highestPoint.y, 50);
        }

        /* ROAD COLLISION */

        const roadCenter = roadCenterAt(car.y);
        const roadDistance = Math.abs(car.x - roadCenter);

        if (roadDistance > roadWidth / 2 + car.width * 0.3) {
            speed = Math.max(0, speed - 150 * dt);

            if (speed > 75 && crashCooldown <= 0) {
                crash();
                return;
            }
        }

        /* LEVEL COMPLETION */

        if (mode === "level" && distance >= LEVEL_DISTANCE) {
            completeLevel();
            return;
        }

        /* ENDLESS RECORD */

        if (mode === "endless") {
            if (distance > save.bestEndless) {
                save.bestEndless = distance;
                saveGame();
            }

            objectiveValue.textContent = `${save.bestEndless} M`;
        }

        updateHUD();
    }

    /* =====================================================
       CRASH AND GAME OVER
       ===================================================== */

    function crash() {
        if (gameOver || crashCooldown > 0) return;

        gameOver = true;
        running = false;
        paused = false;
        crashCooldown = 1;

        speed = 0;

        keys.clear();
        touchControls.clear();

        stopEngineSound();

        crashFlash.classList.remove("active");
        void crashFlash.offsetWidth;
        crashFlash.classList.add("active");

        beep(90, 0.18, "sawtooth", 0.08);
        beep(45, 0.35, "square", 0.05);

        cancelAnimationFrame(animationFrame);

        // Record the final endless distance before showing results.
        if (mode === "endless" && distance > save.bestEndless) {
            save.bestEndless = distance;
            saveGame();
        }

        setTimeout(() => {
            if (gameOver) showGameOver();
        }, 350);
    }

    function showGameOver() {
        resultEyebrow.textContent = "VEHICLE CRASHED";
        resultTitle.textContent = "GAME OVER";

        if (mode === "level") {
            resultText.textContent =
                `You crashed during Level ${currentLevel}. ` +
                `Distance reached: ${distance} / ${LEVEL_DISTANCE} M. ` +
                `This level has not been completed.`;

            resultMain.textContent = "RETRY LEVEL";

            resultMain.onclick = () => {
                startLevel(currentLevel);
            };
        } else {
            resultText.textContent =
                `You drove ${distance} M. ` +
                `Your best endless distance is ${save.bestEndless} M.`;

            resultMain.textContent = "RETRY DRIVE";

            resultMain.onclick = () => {
                startEndless();
            };
        }

        showPanel(resultPanel);
    }

    /* =====================================================
       LEVEL COMPLETE
       ===================================================== */

    function completeLevel() {
        if (!running) return;

        running = false;
        paused = false;
        gameOver = false;

        cancelAnimationFrame(animationFrame);
        stopEngineSound();

        speed = 0;

        if (!save.completed.includes(currentLevel)) {
            save.completed.push(currentLevel);
        }

        if (currentLevel < MAX_LEVEL) {
            save.unlocked = Math.max(
                save.unlocked,
                currentLevel + 1
            );
        }

        saveGame();

        beep(660, 0.12, "sine", 0.07);

        setTimeout(() => {
            if (audioContext) beep(880, 0.2, "sine", 0.07);
        }, 120);

        resultEyebrow.textContent = "LEVEL COMPLETE";

        resultTitle.textContent =
            currentLevel === MAX_LEVEL
                ? "FRONTIER MASTERED"
                : "ROAD CONQUERED";

        resultText.textContent =
            currentLevel === MAX_LEVEL
                ? "All 25 levels have been completed!"
                : `Level ${currentLevel} completed. Level ${currentLevel + 1} is now unlocked.`;

        if (currentLevel < MAX_LEVEL) {
            resultMain.textContent = "NEXT LEVEL";

            resultMain.onclick = () => {
                startLevel(currentLevel + 1);
            };
        } else {
            resultMain.textContent = "REPLAY";

            resultMain.onclick = () => {
                startLevel(MAX_LEVEL);
            };
        }

        showPanel(resultPanel);
        buildLevelSelect();
    }

    /* =====================================================
       HUD
       ===================================================== */

    function updateHUD() {
        speedText.textContent = Math.round(speed);
        distanceText.textContent = distance;

        speedFill.style.width =
            (speed / car.maxSpeed * 100) + "%";

        if (mode === "level") {
            objectiveValue.textContent =
                `${Math.min(distance, LEVEL_DISTANCE)} / ${LEVEL_DISTANCE} M`;

            objectiveFill.style.width =
                Math.min(100, distance / LEVEL_DISTANCE * 100) + "%";
        } else {
            objectiveValue.textContent = `${save.bestEndless} M`;

            objectiveFill.style.width =
                Math.min(100, distance / Math.max(1000, save.bestEndless) * 100) + "%";
        }
    }

    /* =====================================================
       PANELS AND PAUSE
       ===================================================== */

    function showPanel(panel) {
        panel.classList.add("active");
    }

    function hidePanel(panel) {
        panel.classList.remove("active");
    }

    $("pause-btn").addEventListener("click", () => {
        if (!running || gameOver) return;

        paused = !paused;

        if (paused) {
            showPanel(pausePanel);
            updateEngineSound();
        } else {
            hidePanel(pausePanel);
            lastTime = performance.now();
            updateEngineSound();
        }
    });

    $("resume-btn").addEventListener("click", () => {
        if (!running || gameOver) return;

        paused = false;
        hidePanel(pausePanel);
        lastTime = performance.now();
        updateEngineSound();
    });

    $("quit-btn").addEventListener("click", () => {
        stopGame();
        hidePanel(pausePanel);
        hidePanel(resultPanel);
        showScreen(menu);
    });

    $("result-menu").addEventListener("click", () => {
        stopGame();
        hidePanel(resultPanel);
        showScreen(menu);
    });

    /* =====================================================
       DRAW WORLD
       ===================================================== */

    function draw() {
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = "#16231c";
        ctx.fillRect(0, 0, width, height);

        ctx.save();

        const screenCenterX = width / 2;
        const screenCarY = height * 0.63;

        ctx.translate(
            screenCenterX - cameraX,
            screenCarY - cameraY
        );

        drawRoad();
        drawRoadDetails();
        drawCar();

        ctx.restore();

        const gradient = ctx.createRadialGradient(
            width / 2,
            height / 2,
            100,
            width / 2,
            height / 2,
            Math.max(width, height) * 0.75
        );

        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,.42)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    /* =====================================================
       DRAW ROAD
       ===================================================== */

    function drawRoad() {
        if (roadPoints.length < 2) return;

        // Road shadow.
        ctx.beginPath();

        roadPoints.forEach((p, i) => {
            const x = p.x - roadWidth / 2 - 10;

            if (i === 0) ctx.moveTo(x, p.y);
            else ctx.lineTo(x, p.y);
        });

        for (let i = roadPoints.length - 1; i >= 0; i--) {
            const p = roadPoints[i];
            ctx.lineTo(p.x + roadWidth / 2 + 10, p.y);
        }

        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,.28)";
        ctx.fill();

        // Road body.
        ctx.beginPath();

        roadPoints.forEach((p, i) => {
            const x = p.x - roadWidth / 2;

            if (i === 0) ctx.moveTo(x, p.y);
            else ctx.lineTo(x, p.y);
        });

        for (let i = roadPoints.length - 1; i >= 0; i--) {
            const p = roadPoints[i];
            ctx.lineTo(p.x + roadWidth / 2, p.y);
        }

        ctx.closePath();
        ctx.fillStyle = "#30363a";
        ctx.fill();

        // Road edges.
        ctx.strokeStyle = "#879092";
        ctx.lineWidth = 4;

        for (const side of [-1, 1]) {
            ctx.beginPath();

            roadPoints.forEach((p, i) => {
                const x = p.x + side * roadWidth / 2;

                if (i === 0) ctx.moveTo(x, p.y);
                else ctx.lineTo(x, p.y);
            });

            ctx.stroke();
        }

        // Center lane.
        ctx.strokeStyle = "rgba(245,210,126,.7)";
        ctx.lineWidth = 4;
        ctx.setLineDash([28, 25]);

        ctx.beginPath();

        roadPoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });

        ctx.stroke();
        ctx.setLineDash([]);
    }

    /* =====================================================
       ROADSIDE DETAILS
       ===================================================== */

    function drawRoadDetails() {
        for (let i = 0; i < roadPoints.length; i += 3) {
            const p = roadPoints[i];

            for (const side of [-1, 1]) {
                const x = p.x + side * (roadWidth / 2 + 22);

                ctx.fillStyle = "#6b9a89";
                ctx.fillRect(x - 2, p.y - 4, 4, 8);

                ctx.fillStyle = "rgba(99,230,224,.08)";
                ctx.beginPath();
                ctx.arc(x, p.y, 14, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /* =====================================================
       DRAW CAR
       ===================================================== */

    function drawCar() {
        ctx.save();

        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);

        // Shadow.
        ctx.fillStyle = "rgba(0,0,0,.35)";
        ctx.fillRect(
            -car.width / 2 + 4,
            -car.height / 2 + 6,
            car.width,
            car.height
        );

        // Body.
        const gradient = ctx.createLinearGradient(
            -car.width / 2,
            0,
            car.width / 2,
            0
        );

        gradient.addColorStop(0, "#1b6970");
        gradient.addColorStop(0.5, "#63e6e0");
        gradient.addColorStop(1, "#1b6970");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(
            -car.width / 2,
            -car.height / 2,
            car.width,
            car.height,
            8
        );
        ctx.fill();

        // Windows.
        ctx.fillStyle = "#10232a";
        ctx.beginPath();
        ctx.roundRect(-9, -11, 18, 15, 4);
        ctx.fill();

        ctx.fillStyle = "#18353b";
        ctx.fillRect(-8, 10, 16, 7);

        // Headlights.
        ctx.fillStyle = "#f7f1ce";
        ctx.fillRect(-10, -25, 6, 4);
        ctx.fillRect(4, -25, 6, 4);

        // Tail lights.
        ctx.fillStyle = "#ff566f";
        ctx.fillRect(-10, 21, 6, 4);
        ctx.fillRect(4, 21, 6, 4);

        // Wheels.
        ctx.fillStyle = "#080a0c";
        ctx.fillRect(-17, -14, 5, 12);
        ctx.fillRect(12, -14, 5, 12);
        ctx.fillRect(-17, 2, 5, 12);
        ctx.fillRect(12, 2, 5, 12);

        ctx.restore();
    }

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    resizeCanvas();
    updateHUD();
    draw();

})();

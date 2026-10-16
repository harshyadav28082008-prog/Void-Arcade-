"use strict";

(() => {

    /* =========================================================
       VOID ESCAPE
       Three Lane Space Chase
       ========================================================= */

    const canvas =
        document.getElementById("game-canvas");

    const ctx =
        canvas.getContext("2d");

    const startScreen =
        document.getElementById("start-screen");

    const gameOverScreen =
        document.getElementById("game-over");

    const startButton =
        document.getElementById("start-button");

    const restartButton =
        document.getElementById("restart-button");

    const menuButton =
        document.getElementById("menu-button");

    const distanceText =
        document.getElementById("distance");

    const coinsText =
        document.getElementById("coins");

    const bestText =
        document.getElementById("best");

    const savedCoinsText =
        document.getElementById("saved-coins");

    const durabilityText =
        document.getElementById("durability-text");

    const durabilityFill =
        document.getElementById("durability-fill");

    const powerDisplay =
        document.getElementById("power-display");

    const finalDistance =
        document.getElementById("final-distance");

    const finalCoins =
        document.getElementById("final-coins");

    const finalBest =
        document.getElementById("final-best");


    /* =========================================================
       CONSTANTS
       ========================================================= */

    const SAVE_KEY =
        "voidEscapeSaveV2";

    const LANES =
        [-1, 0, 1];

    const MAX_DURABILITY =
        100;


    /* =========================================================
       SAVE
       ========================================================= */

    const defaultSave = {
        coins: 0,
        bestDistance: 0
    };


    let save =
        loadSave();


    function loadSave() {

        try {

            const raw =
                localStorage.getItem(
                    SAVE_KEY
                );

            if (!raw) {
                return {
                    ...defaultSave
                };
            }

            const data =
                JSON.parse(raw);

            return {

                coins:
                    Math.max(
                        0,
                        Number(data.coins) || 0
                    ),

                bestDistance:
                    Math.max(
                        0,
                        Number(data.bestDistance) || 0
                    )
            };

        } catch {

            return {
                ...defaultSave
            };
        }
    }


    function saveGame() {

        try {

            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify(save)
            );

        } catch {}
    }


    /* =========================================================
       CANVAS
       ========================================================= */

    let width = 0;
    let height = 0;
    let dpr = 1;


    function resizeCanvas() {

        dpr =
            Math.min(
                window.devicePixelRatio || 1,
                2
            );

        width =
            window.innerWidth;

        height =
            window.innerHeight;

        canvas.width =
            Math.floor(
                width * dpr
            );

        canvas.height =
            Math.floor(
                height * dpr
            );

        canvas.style.width =
            width + "px";

        canvas.style.height =
            height + "px";

        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );
    }


    window.addEventListener(
        "resize",
        resizeCanvas
    );

    resizeCanvas();


    /* =========================================================
       GAME STATE
       ========================================================= */

    let running = false;

    let lastTime = 0;

    let animationFrame = 0;

    let distance = 0;

    let runCoins = 0;

    let durability =
        MAX_DURABILITY;

    let lane = 0;

    let targetLane = 0;

    let speed = 0;

    let gameTime = 0;

    let spawnTimer = 0;

    let coinTimer = 0;

    let powerTimer = 0;

    let difficulty = 0;

    let shake = 0;


    /* =========================================================
       POWER UPS
       ========================================================= */

    let magnetTime = 0;

    let boostTime = 0;

    let shieldActive = false;


    /* =========================================================
       WORLD OBJECTS
       ========================================================= */

    let obstacles = [];

    let coins = [];

    let powerups = [];

    let particles = [];


    /* =========================================================
       SPACE
       ========================================================= */

    const stars =
        Array.from(
            { length: 180 },
            () => ({
                x:
                    Math.random(),

                y:
                    Math.random(),

                size:
                    Math.random() * 2 + .4,

                speed:
                    Math.random() * 1.5 + .3
            })
        );


    /* =========================================================
       INPUT
       ========================================================= */

    const keys =
        new Set();


    document.addEventListener(
        "keydown",
        event => {

            const key =
                event.key.length === 1
                    ? event.key.toLowerCase()
                    : event.key;

            if (
                [
                    "ArrowLeft",
                    "ArrowRight",
                    " ",
                    "a",
                    "d"
                ].includes(key)
            ) {

                event.preventDefault();
            }

            keys.add(key);

        }
    );


    document.addEventListener(
        "keyup",
        event => {

            const key =
                event.key.length === 1
                    ? event.key.toLowerCase()
                    : event.key;

            keys.delete(key);
        }
    );


    window.addEventListener(
        "blur",
        () => {
            keys.clear();
        }
    );


    /* =========================================================
       MOBILE LANE BUTTONS
       ========================================================= */

    document
        .querySelectorAll(
            "[data-lane]"
        )
        .forEach(button => {

            button.addEventListener(
                "pointerdown",
                event => {

                    event.preventDefault();

                    button.classList.add(
                        "active"
                    );

                    if (
                        button.dataset.lane ===
                        "left"
                    ) {

                        moveLane(-1);

                    } else {

                        moveLane(1);
                    }
                }
            );


            const release = () => {

                button.classList.remove(
                    "active"
                );
            };


            button.addEventListener(
                "pointerup",
                release
            );

            button.addEventListener(
                "pointercancel",
                release
            );

            button.addEventListener(
                "lostpointercapture",
                release
            );
        });


    /* =========================================================
       AUDIO
       ========================================================= */

    let audioContext = null;


    function initAudio() {

        if (!audioContext) {

            const Audio =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!Audio) {
                return;
            }

            audioContext =
                new Audio();
        }

        if (
            audioContext.state ===
            "suspended"
        ) {

            audioContext.resume();
        }
    }


    function sound(
        frequency,
        duration,
        type = "sine",
        volume = .04
    ) {

        if (!audioContext) {
            return;
        }

        const oscillator =
            audioContext.createOscillator();

        const gain =
            audioContext.createGain();

        oscillator.type =
            type;

        oscillator.frequency.value =
            frequency;

        gain.gain.setValueAtTime(
            volume,
            audioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            .001,
            audioContext.currentTime +
            duration
        );

        oscillator.connect(gain);

        gain.connect(
            audioContext.destination
        );

        oscillator.start();

        oscillator.stop(
            audioContext.currentTime +
            duration
        );
    }


    function coinSound() {

        sound(
            700,
            .07,
            "square",
            .045
        );

        setTimeout(
            () =>
                sound(
                    1000,
                    .1,
                    "square",
                    .035
                ),
            45
        );
    }


    function powerSound() {

        sound(
            420,
            .12,
            "sine",
            .05
        );

        setTimeout(
            () =>
                sound(
                    800,
                    .18,
                    "sine",
                    .05
                ),
            70
        );
    }


    function crashSound() {

        sound(
            75,
            .25,
            "sawtooth",
            .08
        );

        setTimeout(
            () =>
                sound(
                    40,
                    .35,
                    "square",
                    .06
                ),
            70
        );
    }


    function gameOverSound() {

        sound(
            180,
            .25,
            "sawtooth",
            .06
        );

        setTimeout(
            () =>
                sound(
                    90,
                    .4,
                    "sawtooth",
                    .06
                ),
            180
        );
    }


    /* =========================================================
       LANE MOVEMENT
       ========================================================= */

    function moveLane(direction) {

        if (!running) {
            return;
        }

        targetLane =
            Math.max(
                -1,
                Math.min(
                    1,
                    targetLane +
                    direction
                )
            );

        sound(
            230,
            .045,
            "square",
            .018
        );
    }


    /* =========================================================
       START
       ========================================================= */

    startButton.addEventListener(
        "click",
        () => {

            initAudio();

            startGame();
        }
    );


    restartButton.addEventListener(
        "click",
        () => {

            initAudio();

            startGame();
        }
    );


    menuButton.addEventListener(
        "click",
        () => {

            stopGame();

            gameOverScreen.classList.remove(
                "active"
            );

            startScreen.classList.add(
                "active"
            );

            updateMenu();
        }
    );


    /* =========================================================
       START GAME
       ========================================================= */

    function startGame() {

        initAudio();

        running = true;

        distance = 0;

        runCoins = 0;

        durability =
            MAX_DURABILITY;

        lane = 0;

        targetLane = 0;

        speed = 230;

        gameTime = 0;

        spawnTimer = .7;

        coinTimer = .4;

        powerTimer = 7;

        difficulty = 0;

        shake = 0;

        magnetTime = 0;

        boostTime = 0;

        shieldActive = false;

        obstacles = [];

        coins = [];

        powerups = [];

        particles = [];

        startScreen.classList.remove(
            "active"
        );

        gameOverScreen.classList.remove(
            "active"
        );

        updateHUD();

        lastTime =
            performance.now();

        cancelAnimationFrame(
            animationFrame
        );

        animationFrame =
            requestAnimationFrame(
                loop
            );
    }


    function stopGame() {

        running = false;

        cancelAnimationFrame(
            animationFrame
        );

        keys.clear();
    }


    /* =========================================================
       LOOP
       ========================================================= */

    function loop(now) {

        if (!running) {
            return;
        }

        const dt =
            Math.min(
                (now - lastTime) / 1000,
                .035
            );

        lastTime = now;

        update(dt);

        draw();

        animationFrame =
            requestAnimationFrame(
                loop
            );
    }


    /* =========================================================
       UPDATE
       ========================================================= */

    function update(dt) {

        gameTime += dt;

        difficulty =
            Math.min(
                1,
                gameTime / 90
            );


        /* ---------------------------------
           Keyboard lane control
           --------------------------------- */

        if (
            keys.has("ArrowLeft") ||
            keys.has("a")
        ) {

            if (!keys.has("_leftPressed")) {

                moveLane(-1);

                keys.add(
                    "_leftPressed"
                );
            }

        } else {

            keys.delete(
                "_leftPressed"
            );
        }


        if (
            keys.has("ArrowRight") ||
            keys.has("d")
        ) {

            if (!keys.has("_rightPressed")) {

                moveLane(1);

                keys.add(
                    "_rightPressed"
                );
            }

        } else {

            keys.delete(
                "_rightPressed"
            );
        }


        /* ---------------------------------
           Speed
           --------------------------------- */

        const baseSpeed =
            230 +
            difficulty * 100;

        const boost =
            boostTime > 0
                ? 1.65
                : 1;

        speed +=
            (
                baseSpeed * boost -
                speed
            ) *
            dt *
            2.2;


        if (boostTime > 0) {

            boostTime -= dt;
        }


        if (magnetTime > 0) {

            magnetTime -= dt;
        }


        /* ---------------------------------
           Distance
           --------------------------------- */

        distance +=
            speed *
            dt *
            .11;


        /* ---------------------------------
           Lane animation
           --------------------------------- */

        lane +=
            (
                targetLane -
                lane
            ) *
            Math.min(
                1,
                dt * 10
            );


        /* ---------------------------------
           Spawn obstacles
           --------------------------------- */

        spawnTimer -= dt;

        if (spawnTimer <= 0) {

            spawnObstacle();

            spawnTimer =
                Math.max(
                    .35,
                    .85 -
                    difficulty * .35
                );
        }


        /* ---------------------------------
           Spawn coins
           --------------------------------- */

        coinTimer -= dt;

        if (coinTimer <= 0) {

            spawnCoinPattern();

            coinTimer =
                .45 +
                Math.random() * .4;
        }


        /* ---------------------------------
           Spawn powerups
           --------------------------------- */

        powerTimer -= dt;

        if (powerTimer <= 0) {

            spawnPowerup();

            powerTimer =
                8 +
                Math.random() * 8;
        }


        /* ---------------------------------
           Move objects
           --------------------------------- */

        const objectSpeed =
            speed *
            dt *
            .9;


        for (const obstacle of obstacles) {

            obstacle.y +=
                objectSpeed;
        }


        for (const coin of coins) {

            coin.y +=
                objectSpeed;
        }


        for (const power of powerups) {

            power.y +=
                objectSpeed;
        }


        /* ---------------------------------
           Magnet
           --------------------------------- */

        if (magnetTime > 0) {

            for (const coin of coins) {

                if (
                    coin.y >
                    height * .25
                ) {

                    coin.x +=
                        (
                            playerScreenX() -
                            coin.x
                        ) *
                        dt *
                        5;

                    coin.y +=
                        (
                            playerScreenY() -
                            coin.y
                        ) *
                        dt *
                        2;
                }
            }
        }


        /* ---------------------------------
           Collision
           --------------------------------- */

        checkObstacleCollisions();

        checkCoinCollisions();

        checkPowerCollisions();


        /* ---------------------------------
           Cleanup
           --------------------------------- */

        obstacles =
            obstacles.filter(
                item =>
                    item.y <
                    height + 120
            );

        coins =
            coins.filter(
                item =>
                    item.y <
                    height + 80
            );

        powerups =
            powerups.filter(
                item =>
                    item.y <
                    height + 80
            );


        /* ---------------------------------
           Particles
           --------------------------------- */

        for (const p of particles) {

            p.x +=
                p.vx * dt;

            p.y +=
                p.vy * dt;

            p.life -= dt;
        }


        particles =
            particles.filter(
                p =>
                    p.life > 0
            );


        shake =
            Math.max(
                0,
                shake - dt * 4
            );


        updateHUD();
    }


    /* =========================================================
       PLAYER POSITION
       ========================================================= */

    function playerScreenX() {

        const roadWidth =
            Math.min(
                width * .65,
                430
            );

        return (
            width / 2 +
            lane *
            roadWidth *
            .28
        );
    }


    function playerScreenY() {

        return height * .76;
    }


    /* =========================================================
       SPAWNING
       ========================================================= */

    function spawnObstacle() {

        let obstacleLane =
            LANES[
                Math.floor(
                    Math.random() *
                    LANES.length
                )
            ];


        /* Sometimes create a two-lane block,
           always leaving one route open. */

        const type =
            Math.random() < .25
                ? "large"
                : "asteroid";


        obstacles.push({

            lane:
                obstacleLane,

            y:
                -100,

            size:
                type === "large"
                    ? 50
                    : 34 +
                      Math.random() * 15,

            rotation:
                Math.random() *
                Math.PI * 2,

            spin:
                (
                    Math.random() -
                    .5
                ) * 3,

            type
        });


        if (
            Math.random() < .18 &&
            gameTime > 15
        ) {

            let secondLane;

            do {

                secondLane =
                    LANES[
                        Math.floor(
                            Math.random() *
                            LANES.length
                        )
                    ];

            } while (
                secondLane ===
                obstacleLane
            );


            obstacles.push({

                lane:
                    secondLane,

                y:
                    -100,

                size:
                    32,

                rotation:
                    Math.random() *
                    Math.PI * 2,

                spin:
                    2,

                type:
                    "asteroid"
            });
        }
    }


    function spawnCoinPattern() {

        const selectedLane =
            LANES[
                Math.floor(
                    Math.random() *
                    LANES.length
                )
            ];


        const count =
            3 +
            Math.floor(
                Math.random() * 4
            );


        for (
            let i = 0;
            i < count;
            i++
        ) {

            coins.push({

                lane:
                    selectedLane,

                x:
                    laneX(
                        selectedLane
                    ),

                y:
                    -70 -
                    i * 45,

                radius:
                    9,

                rotation:
                    0
            });
        }
    }


    function spawnPowerup() {

        const types =
            [
                "magnet",
                "boost",
                "shield"
            ];


        const type =
            types[
                Math.floor(
                    Math.random() *
                    types.length
                )
            ];


        const selectedLane =
            LANES[
                Math.floor(
                    Math.random() *
                    LANES.length
                )
            ];


        powerups.push({

            type,

            lane:
                selectedLane,

            x:
                laneX(
                    selectedLane
                ),

            y:
                -100,

            radius:
                17,

            rotation:
                0
        });
    }


    /* =========================================================
       LANE POSITION
       ========================================================= */

    function laneX(value) {

        const roadWidth =
            Math.min(
                width * .65,
                430
            );

        return (
            width / 2 +
            value *
            roadWidth *
            .28
        );
    }


    /* =========================================================
       COLLISIONS
       ========================================================= */

    function checkObstacleCollisions() {

        const playerX =
            playerScreenX();

        const playerY =
            playerScreenY();


        for (
            let i =
                obstacles.length - 1;
            i >= 0;
            i--
        ) {

            const obstacle =
                obstacles[i];


            if (
                Math.abs(
                    obstacle.lane -
                    targetLane
                ) < .4 &&
                Math.abs(
                    obstacle.y -
                    playerY
                ) <
                    obstacle.size +
                    25
            ) {

                obstacles.splice(
                    i,
                    1
                );

                hitObstacle();

                if (!running) {
                    return;
                }
            }
        }
    }


    function checkCoinCollisions() {

        const px =
            playerScreenX();

        const py =
            playerScreenY();


        for (
            let i =
                coins.length - 1;
            i >= 0;
            i--
        ) {

            const coin =
                coins[i];


            const dx =
                coin.x -
                px;

            const dy =
                coin.y -
                py;


            const distanceToPlayer =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );


            if (
                distanceToPlayer <
                35
            ) {

                collectCoin(i);

            }
        }
    }


    function checkPowerCollisions() {

        const px =
            playerScreenX();

        const py =
            playerScreenY();


        for (
            let i =
                powerups.length - 1;
            i >= 0;
            i--
        ) {

            const power =
                powerups[i];


            if (
                Math.abs(
                    power.x -
                    px
                ) <
                    35 &&
                Math.abs(
                    power.y -
                    py
                ) <
                    40
            ) {

                activatePower(
                    power.type
                );

                powerups.splice(
                    i,
                    1
                );
            }
        }
    }


    /* =========================================================
       COINS
       ========================================================= */

    function collectCoin(index) {

        const coin =
            coins[index];


        runCoins++;

        save.coins++;

        saveGame();

        createParticles(
            coin.x,
            coin.y,
            "#f5d48b",
            8
        );

        coinSound();

        coins.splice(
            index,
            1
        );
    }


    /* =========================================================
       POWERUPS
       ========================================================= */

    function activatePower(type) {

        powerSound();


        if (
            type ===
            "magnet"
        ) {

            magnetTime =
                8;

            createParticles(
                playerScreenX(),
                playerScreenY(),
                "#d98cff",
                15
            );
        }


        if (
            type ===
            "boost"
        ) {

            boostTime =
                5;

            createParticles(
                playerScreenX(),
                playerScreenY(),
                "#f5d48b",
                18
            );
        }


        if (
            type ===
            "shield"
        ) {

            shieldActive =
                true;

            createParticles(
                playerScreenX(),
                playerScreenY(),
                "#75aaff",
                18
            );
        }
    }


    /* =========================================================
       CRASH
       ========================================================= */

    function hitObstacle() {

        if (shieldActive) {

            shieldActive =
                false;

            createParticles(
                playerScreenX(),
                playerScreenY(),
                "#75aaff",
                25
            );

            sound(
                180,
                .15,
                "square",
                .06
            );

            shake =
                .35;

            return;
        }


        durability -= 35;

        speed *= .55;

        shake =
            .65;

        createParticles(
            playerScreenX(),
            playerScreenY(),
            "#ff7288",
            24
        );

        crashSound();


        if (
            durability <= 0
        ) {

            durability = 0;

            endGame();
        }
    }


    /* =========================================================
       GAME OVER
       ========================================================= */

    function endGame() {

        if (!running) {
            return;
        }

        running = false;

        cancelAnimationFrame(
            animationFrame
        );

        gameOverSound();

        save.bestDistance =
            Math.max(
                save.bestDistance,
                Math.floor(
                    distance
                )
            );

        saveGame();

        finalDistance.textContent =
            `${Math.floor(distance)} M`;

        finalCoins.textContent =
            runCoins;

        finalBest.textContent =
            `${save.bestDistance} M`;

        gameOverScreen.classList.add(
            "active"
        );

        updateMenu();
    }


    /* =========================================================
       PARTICLES
       ========================================================= */

    function createParticles(
        x,
        y,
        color,
        amount
    ) {

        for (
            let i = 0;
            i < amount;
            i++
        ) {

            const angle =
                Math.random() *
                Math.PI *
                2;

            const velocity =
                30 +
                Math.random() *
                130;


            particles.push({

                x,
                y,

                vx:
                    Math.cos(angle) *
                    velocity,

                vy:
                    Math.sin(angle) *
                    velocity,

                size:
                    2 +
                    Math.random() *
                    4,

                color,

                life:
                    .3 +
                    Math.random() *
                    .5
            });
        }
    }


    /* =========================================================
       HUD
       ========================================================= */

    function updateHUD() {

        distanceText.textContent =
            Math.floor(
                distance
            );

        coinsText.textContent =
            runCoins;

        bestText.textContent =
            Math.floor(
                Math.max(
                    save.bestDistance,
                    distance
                )
            );

        durabilityText.textContent =
            `${Math.ceil(
                durability
            )}%`;

        durabilityFill.style.width =
            `${durability}%`;


        let powers = [];

        if (
            magnetTime > 0
        ) {

            powers.push(
                `🧲 MAGNET ${magnetTime.toFixed(1)}s`
            );
        }

        if (
            boostTime > 0
        ) {

            powers.push(
                `⚡ BOOST ${boostTime.toFixed(1)}s`
            );
        }

        if (
            shieldActive
        ) {

            powers.push(
                "🛡 SHIELD READY"
            );
        }

        powerDisplay.textContent =
            powers.join(
                "   "
            );
    }


    function updateMenu() {

        savedCoinsText.textContent =
            save.coins;
    }


    /* =========================================================
       DRAW
       ========================================================= */

    function draw() {

        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        drawSpace();

        drawRoad();

        drawObjects();

        drawPlayer();

        drawParticles();

        if (
            shake > 0
        ) {

            /* Screen shake is handled
               through a subtle flash. */
        }
    }


    /* =========================================================
       SPACE BACKGROUND
       ========================================================= */

    function drawSpace() {

        const gradient =
            ctx.createLinearGradient(
                0,
                0,
                0,
                height
            );

        gradient.addColorStop(
            0,
            "#02050d"
        );

        gradient.addColorStop(
            .5,
            "#071522"
        );

        gradient.addColorStop(
            1,
            "#02050d"
        );

        ctx.fillStyle =
            gradient;

        ctx.fillRect(
            0,
            0,
            width,
            height
        );


        for (
            const star of stars
        ) {

            const y =
                (
                    star.y +
                    gameTime *
                    star.speed *
                    .05
                ) % 1;

            ctx.globalAlpha =
                .25 +
                star.size *
                .18;

            ctx.fillStyle =
                "#c9eaff";

            ctx.fillRect(
                star.x *
                width,
                y *
                height,
                star.size,
                star.size
            );
        }

        ctx.globalAlpha = 1;
    }


    /* =========================================================
       THREE LANE ROAD
       ========================================================= */

    function drawRoad() {

        const roadWidth =
            Math.min(
                width * .65,
                430
            );


        const left =
            width / 2 -
            roadWidth / 2;

        const right =
            width / 2 +
            roadWidth / 2;


        /* Road */

        const gradient =
            ctx.createLinearGradient(
                left,
                0,
                right,
                0
            );

        gradient.addColorStop(
            0,
            "#101d2b"
        );

        gradient.addColorStop(
            .5,
            "#162637"
        );

        gradient.addColorStop(
            1,
            "#101d2b"
        );

        ctx.fillStyle =
            gradient;

        ctx.fillRect(
            left,
            0,
            roadWidth,
            height
        );


        /* Edge glow */

        ctx.fillStyle =
            "rgba(117,229,210,.13)";

        ctx.fillRect(
            left,
            0,
            2,
            height
        );

        ctx.fillRect(
            right - 2,
            0,
            2,
            height
        );


        /* Lane lines */

        ctx.setLineDash(
            [35, 35]
        );

        ctx.lineWidth = 2;

        ctx.strokeStyle =
            "rgba(117,229,210,.16)";


        for (
            let i = 1;
            i < 3;
            i++
        ) {

            const x =
                left +
                roadWidth *
                i /
                3;


            ctx.beginPath();

            ctx.moveTo(
                x,
                0
            );

            ctx.lineTo(
                x,
                height
            );

            ctx.stroke();
        }


        ctx.setLineDash([]);


        /* Moving speed lines */

        const offset =
            (
                gameTime *
                speed *
                .8
            ) % 100;


        ctx.strokeStyle =
            "rgba(150,220,255,.07)";

        ctx.lineWidth = 1;


        for (
            let y =
                -100 + offset;
            y < height;
            y += 100
        ) {

            ctx.beginPath();

            ctx.moveTo(
                left + 10,
                y
            );

            ctx.lineTo(
                right - 10,
                y
            );

            ctx.stroke();
        }
    }


    /* =========================================================
       OBJECTS
       ========================================================= */

    function drawObjects() {

        for (
            const coin of coins
        ) {

            drawCoin(
                coin
            );
        }


        for (
            const power of powerups
        ) {

            drawPowerup(
                power
            );
        }


        for (
            const obstacle of obstacles
        ) {

            drawAsteroid(
                obstacle
            );
        }
    }


    /* =========================================================
       COIN
       ========================================================= */

    function drawCoin(coin) {

        coin.rotation +=
            .08;


        ctx.save();

        ctx.translate(
            coin.x,
            coin.y
        );

        ctx.rotate(
            coin.rotation
        );


        ctx.fillStyle =
            "#f5d48b";

        ctx.shadowBlur = 16;

        ctx.shadowColor =
            "#f5d48b";


        ctx.beginPath();

        ctx.arc(
            0,
            0,
            coin.radius,
            0,
            Math.PI * 2
        );

        ctx.fill();


        ctx.shadowBlur = 0;

        ctx.fillStyle =
            "#fff5ca";

        ctx.fillRect(
            -2,
            -6,
            4,
            12
        );


        ctx.restore();
    }


    /* =========================================================
       POWERUP
       ========================================================= */

    function drawPowerup(power) {

        power.rotation +=
            .025;


        let color =
            "#d98cff";

        let symbol =
            "M";


        if (
            power.type ===
            "boost"
        ) {

            color =
                "#f5d48b";

            symbol =
                "⚡";
        }


        if (
            power.type ===
            "shield"
        ) {

            color =
                "#75aaff";

            symbol =
                "◆";
        }


        ctx.save();

        ctx.translate(
            power.x,
            power.y
        );

        ctx.rotate(
            power.rotation
        );


        ctx.shadowBlur = 20;

        ctx.shadowColor =
            color;

        ctx.strokeStyle =
            color;

        ctx.lineWidth = 3;


        ctx.beginPath();

        ctx.arc(
            0,
            0,
            power.radius,
            0,
            Math.PI * 2
        );

        ctx.stroke();


        ctx.shadowBlur = 0;

        ctx.fillStyle =
            color;

        ctx.font =
            "bold 14px Arial";

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";

        ctx.fillText(
            symbol,
            0,
            0
        );


        ctx.restore();
    }


    /* =========================================================
       ASTEROID
       ========================================================= */

    function drawAsteroid(obstacle) {

        ctx.save();

        ctx.translate(
            laneX(
                obstacle.lane
            ),
            obstacle.y
        );

        ctx.rotate(
            obstacle.rotation
        );


        obstacle.rotation +=
            obstacle.spin *
            .016;


        ctx.fillStyle =
            "#5c6470";

        ctx.strokeStyle =
            "#a5adb7";

        ctx.lineWidth = 2;


        ctx.beginPath();


        const points = 9;


        for (
            let i = 0;
            i < points;
            i++
        ) {

            const angle =
                i /
                points *
                Math.PI *
                2;

            const radius =
                obstacle.size *
                (
                    .75 +
                    Math.random() *
                    .25
                );


            const x =
                Math.cos(angle) *
                radius;

            const y =
                Math.sin(angle) *
                radius;


            if (i === 0) {

                ctx.moveTo(
                    x,
                    y
                );

            } else {

                ctx.lineTo(
                    x,
                    y
                );
            }
        }


        ctx.closePath();

        ctx.fill();

        ctx.stroke();


        ctx.fillStyle =
            "rgba(0,0,0,.25)";


        ctx.beginPath();

        ctx.arc(
            -obstacle.size * .2,
            -obstacle.size * .1,
            obstacle.size * .2,
            0,
            Math.PI * 2
        );

        ctx.fill();


        ctx.restore();
    }


    /* =========================================================
       PLAYER SHIP
       ========================================================= */

    function drawPlayer() {

        const x =
            playerScreenX();

        const y =
            playerScreenY();


        ctx.save();

        ctx.translate(
            x,
            y
        );


        /* Shield */

        if (
            shieldActive
        ) {

            ctx.strokeStyle =
                "rgba(117,170,255,.8)";

            ctx.lineWidth = 3;

            ctx.shadowBlur = 25;

            ctx.shadowColor =
                "#75aaff";


            ctx.beginPath();

            ctx.arc(
                0,
                0,
                34 +
                Math.sin(
                    gameTime * 7
                ) * 2,
                0,
                Math.PI * 2
            );

            ctx.stroke();

            ctx.shadowBlur = 0;
        }


        /* Engine */

        ctx.fillStyle =
            boostTime > 0
                ? "#f5d48b"
                : "#75e5d2";


        ctx.beginPath();

        ctx.moveTo(
            -8,
            25
        );

        ctx.lineTo(
            0,
            48 +
            Math.random() * 10
        );

        ctx.lineTo(
            8,
            25
        );

        ctx.closePath();

        ctx.fill();


        /* Ship body */

        ctx.shadowBlur = 18;

        ctx.shadowColor =
            "#75e5d2";

        ctx.fillStyle =
            "#75e5d2";


        ctx.beginPath();

        ctx.moveTo(
            0,
            -32
        );

        ctx.lineTo(
            23,
            23
        );

        ctx.lineTo(
            7,
            18
        );

        ctx.lineTo(
            0,
            26
        );

        ctx.lineTo(
            -7,
            18
        );

        ctx.lineTo(
            -23,
            23
        );

        ctx.closePath();

        ctx.fill();


        ctx.shadowBlur = 0;


        /* Cockpit */

        ctx.fillStyle =
            "#102b38";


        ctx.beginPath();

        ctx.moveTo(
            0,
            -20
        );

        ctx.lineTo(
            8,
            5
        );

        ctx.lineTo(
            -8,
            5
        );

        ctx.closePath();

        ctx.fill();


        ctx.restore();
    }


    /* =========================================================
       PARTICLES
       ========================================================= */

    function drawParticles() {

        for (
            const p of particles
        ) {

            ctx.globalAlpha =
                Math.max(
                    0,
                    p.life * 2
                );

            ctx.fillStyle =
                p.color;

            ctx.fillRect(
                p.x,
                p.y,
                p.size,
                p.size
            );
        }

        ctx.globalAlpha = 1;
    }


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    updateMenu();

    updateHUD();

})();
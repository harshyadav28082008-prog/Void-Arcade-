
"use strict";

/* VOID SPACEFLIGHT
   2D flight simulator. Physics are simplified for gameplay,
   not intended for real-world rocket operation.
*/

const $ = (id) => document.getElementById(id);

const GAME_ID = "void-spaceflight";

const rockets = {
    lancer: {
        name: "Lancer",
        role: "Beginner exploration rocket",
        thrust: 43,
        fuel: 100,
        hull: 100,
        burn: 0.30,
        destinations: ["moon"],
        description: "Easy to control, efficient, and designed for your first lunar mission."
    },
    pioneer: {
        name: "Pioneer",
        role: "Deep-space exploration",
        thrust: 38,
        fuel: 155,
        hull: 100,
        burn: 0.25,
        destinations: ["moon", "mars", "phobos", "deimos"],
        description: "A balanced spacecraft for Mars and its moons."
    },
    voyager: {
        name: "Voyager",
        role: "High-speed inner-planet missions",
        thrust: 51,
        fuel: 130,
        hull: 85,
        burn: 0.38,
        destinations: ["moon", "venus", "mercury"],
        description: "Powerful engines, but less fuel and a more delicate hull."
    },
    colossus: {
        name: "Colossus",
        role: "Heavy long-range spacecraft",
        thrust: 30,
        fuel: 230,
        hull: 150,
        burn: 0.19,
        destinations: ["moon", "mars", "phobos", "deimos"],
        description: "Slow acceleration, generous fuel reserves, and a reinforced hull."
    },
    aether: {
        name: "Aether",
        role: "Advanced multi-destination spacecraft",
        thrust: 40,
        fuel: 220,
        hull: 115,
        burn: 0.23,
        destinations: ["moon", "mars", "phobos", "deimos", "venus", "mercury"],
        description: "Versatile systems for experienced pilots and distant destinations."
    }
};

const destinations = {
    moon: {
        name: "Moon",
        distance: "384,400 km",
        targetSpeed: 7600,
        transferTime: 14,
        gravity: 1.62,
        color: "#b9becb",
        description: "A nearby destination ideal for learning orbital flight."
    },
    mars: {
        name: "Mars",
        distance: "225 million km",
        targetSpeed: 8100,
        transferTime: 24,
        gravity: 3.71,
        color: "#df7859",
        description: "A longer voyage with a demanding approach."
    },
    phobos: {
        name: "Phobos",
        distance: "Mars system",
        targetSpeed: 8000,
        transferTime: 20,
        gravity: 0.006,
        color: "#b99b83",
        description: "A small, irregular moon orbiting Mars."
    },
    deimos: {
        name: "Deimos",
        distance: "Mars system",
        targetSpeed: 7900,
        transferTime: 22,
        gravity: 0.003,
        color: "#a99583",
        description: "A small and distant target near Mars."
    },
    venus: {
        name: "Venus",
        distance: "41 million km",
        targetSpeed: 7800,
        transferTime: 20,
        gravity: 8.87,
        color: "#e6bd78",
        description: "A hot world with a dense atmosphere and a difficult landing."
    },
    mercury: {
        name: "Mercury",
        distance: "77 million km",
        targetSpeed: 8500,
        transferTime: 22,
        gravity: 3.7,
        color: "#aaaeb7",
        description: "A small, fast-moving planet close to the Sun."
    }
};

const phaseNames = {
    pad: "PRE-LAUNCH",
    ascent: "ATMOSPHERIC ASCENT",
    orbit: "ORBITAL INSERTION",
    transfer: "INTERPLANETARY TRANSFER",
    approach: "DESTINATION APPROACH",
    landing: "LANDING",
    paused: "PAUSED",
    complete: "MISSION COMPLETE",
    failed: "MISSION FAILED"
};

const state = {
    phase: "pad",
    rocketId: "lancer",
    destinationId: "moon",
    altitude: 0,
    speed: 0,
    pitch: 90,
    throttle: 100,
    fuel: 100,
    maxFuel: 100,
    hull: 100,
    maxHull: 100,
    elapsed: 0,
    phaseTime: 0,
    descentSpeed: 0,
    paused: false,
    animationId: 0,
    lastTime: 0,
    stars: [],
    particles: [],
    messageTimer: 0,
    resultSuccess: false
};

const canvas = $("space-canvas");
const ctx = canvas.getContext("2d");

let canvasWidth = 1;
let canvasHeight = 1;
let dpr = 1;

function readSave(key, fallback) {
    try {
        if (typeof VoidStorage !== "undefined") {
            return VoidStorage.load(GAME_ID, key, fallback);
        }
        const value = localStorage.getItem("void_arcade_" + GAME_ID + "_" + key);
        return value === null ? fallback : JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function writeSave(key, value) {
    try {
        if (typeof VoidStorage !== "undefined") {
            VoidStorage.save(GAME_ID, key, value);
        } else {
            localStorage.setItem(
                "void_arcade_" + GAME_ID + "_" + key,
                JSON.stringify(value)
            );
        }
    } catch (error) {
        // The game remains playable if saving is unavailable.
    }
}

function playSound(type) {
    try {
        if (typeof VoidSound !== "undefined" && VoidSound[type]) {
            VoidSound[type]();
        }
    } catch (error) {
        // Sound is optional.
    }
}

function showScreen(id) {
    document.querySelectorAll(".screen").forEach((screen) => {
        screen.classList.toggle("active", screen.id === id);
    });
}

function getRocket() {
    return rockets[state.rocketId];
}

function getDestination() {
    return destinations[state.destinationId];
}

function updateRocketOptions() {
    const select = $("rocket-select");
    select.innerHTML = "";

    Object.entries(rockets).forEach(([id, rocket]) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = rocket.name + " — " + rocket.role;
        select.appendChild(option);
    });

    select.value = state.rocketId;
    updateDestinationOptions();
}

function updateDestinationOptions() {
    const rocket = rockets[$("rocket-select").value];
    const select = $("destination-select");
    const previous = select.value;

    select.innerHTML = "";

    rocket.destinations.forEach((id) => {
        const destination = destinations[id];
        const option = document.createElement("option");
        option.value = id;
        option.textContent = destination.name;
        select.appendChild(option);
    });

    if (rocket.destinations.includes(previous)) {
        select.value = previous;
    } else {
        select.selectedIndex = 0;
    }

    updateSelectionInfo();
}

function updateSelectionInfo() {
    const rocket = rockets[$("rocket-select").value];
    const destination = destinations[$("destination-select").value];

    $("rocket-info").innerHTML =
        "<strong>" + rocket.name + "</strong><br>" +
        rocket.description + "<br><br>" +
        "Thrust: " + rocket.thrust + " units/s² · " +
        "Fuel: " + rocket.fuel + " units · " +
        "Hull: " + rocket.hull + "%";

    $("destination-info").innerHTML =
        "<strong>" + destination.name + "</strong><br>" +
        destination.description + "<br><br>" +
        "Reference distance: " + destination.distance;
}

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    canvasWidth = Math.max(1, rect.width);
    canvasHeight = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    makeStars();
}

function makeStars() {
    state.stars = [];

    const count = Math.min(
        180,
        Math.floor(canvasWidth * canvasHeight / 5000)
    );

    for (let i = 0; i < count; i++) {
        state.stars.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            size: Math.random() * 1.6 + 0.3,
            alpha: Math.random() * 0.7 + 0.2
        });
    }
}

function resetMission() {
    cancelAnimationFrame(state.animationId);
  initAudio();
  playSound("launch");

    const rocketId = $("rocket-select").value;
    const destinationId = $("destination-select").value;
    const rocket = rockets[rocketId];

    state.phase = "pad";
    state.rocketId = rocketId;
    state.destinationId = destinationId;

    state.altitude = 0;
    state.speed = 0;
    state.pitch = 90;
    state.throttle = 100;

    state.fuel = rocket.fuel;
    state.maxFuel = rocket.fuel;
    state.hull = rocket.hull;
    state.maxHull = rocket.hull;

    state.elapsed = 0;
    state.phaseTime = 0;
    state.descentSpeed = 0;
    state.paused = false;
    state.lastTime = 0;
    state.particles = [];
    state.resultSuccess = false;

    $("throttle-slider").value = 100;
    $("throttle-value").textContent = "100%";
    $("pause-overlay").classList.add("hidden");
    $("pause-button").textContent = "Ⅱ PAUSE";

    showScreen("flight-screen");
    resizeCanvas();

    state.phase = "ascent";
    $("phase-label").textContent = phaseNames[state.phase];

    setGuidance(
        "Liftoff authorized",
        "Increase thrust to climb. Keep the rocket near 90° during the initial ascent, then gradually tilt toward the horizon as altitude increases.",
        "Climb vertically, then begin the guided gravity turn."
    );

    playSound("click");
    state.animationId = requestAnimationFrame(gameLoop);
}

function setGuidance(title, message, action) {
    $("guidance-title").textContent = title;
    $("guidance-message").textContent = message;
    $("guidance-action").textContent = action;
}

function targetPitch() {
    if (state.phase === "ascent") {
        if (state.altitude < 10) return 85;
        if (state.altitude < 35) return 70;
        if (state.altitude < 70) return 45;
        return 20;
    }

    if (state.phase === "orbit" || state.phase === "transfer") {
        return 15;
    }

    if (state.phase === "approach" || state.phase === "landing") {
        return 90;
    }

    return 90;
}

function targetSpeed() {
    const destination = getDestination();

    if (state.phase === "ascent") {
        if (state.altitude < 10) return 900;
        if (state.altitude < 35) return 2500;
        if (state.altitude < 70) return 5200;
        return destination.targetSpeed;
    }

    if (state.phase === "orbit") return destination.targetSpeed;
    if (state.phase === "transfer") return 0;
    if (state.phase === "approach" || state.phase === "landing") {
        return 60;
    }

    return 0;
}

function setPhase(phase) {
    state.phase = phase;
    state.phaseTime = 0;
      if (phase === "transfer") playSound("orbit");
    if (phase === "approach") playSound("arrival");

    $("phase-label").textContent = phaseNames[phase];

    if (phase === "transfer") {
        state.altitude = 150;
        state.speed = 0;
        state.pitch = 15;

        setGuidance(
            "Transfer burn complete",
            "The spacecraft has entered the transfer phase. Mission control is guiding the spacecraft toward " +
            getDestination().name + ".",
            "Monitor the transfer and prepare for destination approach."
        );
    }

    if (phase === "approach") {
        state.altitude = 100;
        state.speed = 0;
        state.descentSpeed = 500;
        state.pitch = 90;

        setGuidance(
            "Destination acquired",
            getDestination().name +
            " is in visual range. The landing phase is beginning. Use throttle to control descent speed and raise pitch toward 90°.",
            "Reduce descent speed below 60 m/s before surface contact."
        );
    }
}

function updatePhysics(dt) {
    if (state.phase === "ascent") {
        const rocket = getRocket();
        const throttle = state.throttle / 100;
        const angle = state.pitch * Math.PI / 180;

        state.fuel -= rocket.burn * throttle * dt;

        const gravityLoss = 9.8 * Math.sin(angle);
        const acceleration = rocket.thrust * throttle - gravityLoss;

        state.speed = Math.max(0, state.speed + acceleration * dt);

        const verticalSpeed = state.speed * Math.sin(angle);
        state.altitude += verticalSpeed * dt / 1000;

        if (state.altitude > 150) {
            state.altitude = 150;
        }

        if (state.fuel <= 0) {
            state.fuel = 0;
            setGuidance(
                "Fuel exhausted",
                "The engines have no fuel. The rocket cannot complete the required ascent.",
                "Mission failure is imminent."
            );
            finishMission(false, "The rocket ran out of fuel before reaching the required orbit.");
            return;
        }

        if (state.altitude >= 150 && state.speed >= getDestination().targetSpeed) {
            if (state.pitch >= 5 && state.pitch <= 35) {
                setPhase("transfer");
            } else {
                setGuidance(
                    "Correct your flight angle",
                    "Your altitude and speed are sufficient, but your pitch is outside the transfer corridor.",
                    "Adjust pitch to between 5° and 35°."
                );
            }
        } else if (state.altitude >= 150 && state.speed < getDestination().targetSpeed) {
            setGuidance(
                "Orbital speed insufficient",
                "You have reached the target altitude but still need more speed. Manage your fuel carefully.",
                "Increase throttle and maintain a shallow flight angle."
            );
        } else {
            updateAscentGuidance();
        }
    } else if (state.phase === "transfer") {
        state.phaseTime += dt;

        if (state.phaseTime > getDestination().transferTime) {
            setPhase("approach");
        } else {
            setGuidance(
                "Cruise trajectory active",
                "The spacecraft is travelling toward " + getDestination().name +
                ". This transfer is simplified for gameplay.",
                "Prepare for the arrival and landing sequence."
            );
        }
    } else if (state.phase === "approach" || state.phase === "landing") {
        const throttle = state.throttle / 100;

        // Simplified powered descent: throttle counteracts downward speed.
        state.descentSpeed += (3.2 - throttle * 32) * dt;
        state.descentSpeed = Math.max(0, Math.min(1200, state.descentSpeed));

        state.speed = state.descentSpeed;
        state.altitude -= state.descentSpeed * dt / 1000;

        if (state.altitude <= 5 && state.phase !== "landing") {
            setPhase("landing");
        }

        if (state.altitude <= 0) {
            state.altitude = 0;

            if (state.speed <= 60 && state.pitch >= 80 && state.pitch <= 100) {
                finishMission(true, "Successful landing on " + getDestination().name + ".");
            } else {
                state.hull -= Math.max(20, state.speed / 5);

                if (state.hull <= 0 || state.speed > 250) {
                    state.hull = Math.max(0, state.hull);
                    finishMission(false, "The spacecraft impacted the surface too quickly.");
                } else {
                    state.altitude = 0.5;
                    state.descentSpeed = 20;
                    state.speed = 20;
                    setGuidance(
                        "Hard landing",
                        "The spacecraft survived surface contact but suffered damage.",
                        "Mission control is assessing the spacecraft."
                    );

                    finishMission(false, "The landing was too rough to count as a successful mission.");
                }
            }
        }

        if (state.fuel <= 0 && state.altitude > 0) {
            finishMission(false, "Fuel was exhausted before a safe landing.");
        } else {
            updateLandingGuidance();
        }
    }
}

function updateAscentGuidance() {
    const desiredPitch = targetPitch();
    const desiredSpeed = targetSpeed();
    const pitchError = Math.abs(state.pitch - desiredPitch);

    if (state.altitude < 10) {
        setGuidance(
            "Initial ascent",
            "Keep pitch near 85° and build speed while climbing through the lower atmosphere.",
            "Target pitch: 85°. Aim for about 900 m/s by 10 km."
        );
    } else if (state.altitude < 35) {
        setGuidance(
            "Begin gravity turn",
            "Start lowering the nose gradually. Do not turn all at once; maintain thrust to keep accelerating.",
            "Target pitch: 70°. Aim for about 2,500 m/s by 35 km."
        );
    } else if (state.altitude < 70) {
        setGuidance(
            "Continue orbital ascent",
            "Tilt toward the horizon to build horizontal velocity. Watch the target speed and fuel.",
            "Target pitch: 45°. Aim for about 5,200 m/s by 70 km."
        );
    } else {
        setGuidance(
            "Orbital insertion",
            "Build the remaining orbital speed and keep your flight path shallow. You need at least 150 km altitude and the destination's target speed.",
            "Target pitch: 20°. Required speed: " + desiredSpeed + " m/s."
        );
    }

    if (pitchError > 20) {
        $("guidance-status").textContent = "ANGLE WARNING";
    } else {
        $("guidance-status").textContent = "ACTIVE";
    }
}

function updateLandingGuidance() {
    if (state.altitude > 30) {
        setGuidance(
            "Destination approach",
            "Begin reducing descent speed. A high throttle setting slows your downward motion in this landing phase.",
            "Aim for 90° pitch and descend below 300 m/s."
        );
    } else if (state.altitude > 5) {
        setGuidance(
            "Landing sequence",
            "The surface is getting closer. Use strong braking thrust and keep the rocket nearly vertical.",
            "Aim for 90° pitch and less than 150 m/s."
        );
    } else {
        setGuidance(
            "Surface contact imminent",
            "Use high throttle to brake. A safe landing requires a descent speed of 60 m/s or less and a near-vertical rocket.",
            "Target: 90° pitch, speed ≤ 60 m/s."
        );
    }

    $("guidance-status").textContent =
        state.speed > 150 ? "SPEED WARNING" : "ACTIVE";
}

function finishMission(success, message) {
    if (state.phase === "complete" || state.phase === "failed") return;

    state.resultSuccess = success;
    state.phase = success ? "complete" : "failed";

    $("phase-label").textContent = phaseNames[state.phase];
    $("result-title").textContent = success ? "Mission Successful" : "Mission Failed";
    $("result-message").textContent = message;
    $("result-destination").textContent = getDestination().name;
    $("result-altitude").textContent = state.altitude.toFixed(1) + " km";
    $("result-fuel").textContent = fuelPercent().toFixed(1) + "%";
    $("result-hull").textContent = hullPercent().toFixed(1) + "%";

    if (success) {
        const completed = Number(readSave("missionsCompleted", 0)) + 1;
        writeSave("missionsCompleted", completed);
        playSound("collect");
    } else {
        playSound("gameOver");
    }

    $("career-stat").textContent =
        "MISSIONS COMPLETED: " + Number(readSave("missionsCompleted", 0));

    showScreen("result-screen");
}

function fuelPercent() {
    return state.maxFuel > 0 ? Math.max(0, state.fuel / state.maxFuel * 100) : 0;
}

function hullPercent() {
    return state.maxHull > 0 ? Math.max(0, state.hull / state.maxHull * 100) : 0;
}

function updateHUD() {
    $("hud-altitude").textContent = state.altitude.toFixed(1) + " km";
    $("hud-speed").textContent = Math.round(state.speed) + " m/s";
    $("hud-fuel").textContent = fuelPercent().toFixed(0) + "%";
    $("hud-hull").textContent = hullPercent().toFixed(0) + "%";

    $("fuel-meter").style.width = fuelPercent() + "%";
    $("hull-meter").style.width = hullPercent() + "%";

    $("fuel-meter").style.background =
        fuelPercent() < 20 ? "var(--red)" : "var(--green)";

    $("hull-meter").style.background =
        hullPercent() < 30 ? "var(--red)" : "var(--green)";

    $("hud-pitch").textContent = Math.round(state.pitch) + "°";
    $("hud-target-pitch").textContent = targetPitch() + "°";
    $("hud-throttle").textContent = Math.round(state.throttle) + "%";
    $("hud-target-speed").textContent = targetSpeed() + " m/s";
    $("hud-destination").textContent = getDestination().name;

    $("throttle-value").textContent = Math.round(state.throttle) + "%";
}

function drawStars() {
    ctx.fillStyle = "#030711";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (const star of state.stars) {
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

function drawEarth() {
    const w = canvasWidth;
    const h = canvasHeight;

    let radius;
    let centerY;

    if (state.phase === "ascent" || state.phase === "pad") {
        radius = Math.max(w * 0.85, h * 1.05);
        centerY = h * 1.22 - state.altitude * 1.2;
    } else if (state.phase === "transfer") {
        radius = w * 0.16;
        centerY = h * 0.8;
    } else {
        radius = w * 0.1;
        centerY = h * 0.84;
    }

    const centerX = w * 0.5;

    const gradient = ctx.createRadialGradient(
        centerX - radius * 0.25,
        centerY - radius * 0.4,
        radius * 0.05,
        centerX,
        centerY,
        radius
    );

    gradient.addColorStop(0, "#247bb6");
    gradient.addColorStop(0.65, "#10406f");
    gradient.addColorStop(1, "#06172f");

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // Simple decorative continents.
    ctx.fillStyle = "#317e78";
    for (let i = 0; i < 7; i++) {
        const x = centerX + Math.sin(i * 3.3 + state.elapsed * 0.01) * radius * 0.7;
        const y = centerY - radius * 0.4 + i * radius * 0.18;

        ctx.beginPath();
        ctx.ellipse(
            x, y,
            radius * 0.16,
            radius * 0.08,
            i * 0.6, 0, Math.PI * 2
        );
        ctx.fill();
    }

    ctx.restore();

    ctx.strokeStyle = "#68bfff";
    ctx.lineWidth = Math.max(2, radius * 0.015);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, Math.PI * 2);
    ctx.stroke();
}

function drawDestination() {
    const destination = getDestination();

    if (state.phase !== "transfer" &&
        state.phase !== "approach" &&
        state.phase !== "landing") {
        return;
    }

    const w = canvasWidth;
    const h = canvasHeight;

    const radius = state.phase === "transfer"
        ? Math.min(w, h) * 0.11
        : Math.min(w, h) * 0.28;

    const x = state.phase === "transfer" ? w * 0.82 : w * 0.5;
    const y = state.phase === "transfer" ? h * 0.42 : h * 0.88;

    const grad = ctx.createRadialGradient(
        x - radius * 0.3,
        y - radius * 0.35,
        radius * 0.1,
        x,
        y,
        radius
    );

    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.12, destination.color);
    grad.addColorStop(1, "#151925");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(destination.name.toUpperCase(), x, y - radius - 15);
}

function drawRocket() {
    const w = canvasWidth;
    const h = canvasHeight;

    const x = w * 0.5;
    const y = state.phase === "ascent"
        ? h * 0.51
        : state.phase === "transfer"
            ? h * 0.52
            : h * 0.55;

    const size = Math.max(0.65, Math.min(1.15, w / 600));

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((90 - state.pitch) * Math.PI / 180);
    ctx.scale(size, size);

    // Exhaust
    if (state.phase === "ascent" && state.throttle > 0 && state.fuel > 0) {
        const flameLength = 15 + state.throttle * 0.35 + Math.random() * 10;

        ctx.fillStyle = "#ff9b4a";
        ctx.beginPath();
        ctx.moveTo(-7, 17);
        ctx.lineTo(0, 17 + flameLength);
        ctx.lineTo(7, 17);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#72d7ff";
        ctx.beginPath();
        ctx.moveTo(-3, 17);
        ctx.lineTo(0, 17 + flameLength * 0.65);
        ctx.lineTo(3, 17);
        ctx.closePath();
        ctx.fill();
    }

    // Fins
    ctx.fillStyle = "#526b85";
    ctx.beginPath();
    ctx.moveTo(-7, 5);
    ctx.lineTo(-15, 16);
    ctx.lineTo(-6, 14);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(7, 5);
    ctx.lineTo(15, 16);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = "#eaf2fa";
    ctx.beginPath();
    ctx.moveTo(-7, 10);
    ctx.lineTo(-6, -12);
    ctx.lineTo(0, -24);
    ctx.lineTo(6, -12);
    ctx.lineTo(7, 10);
    ctx.closePath();
    ctx.fill();

    // Body shading
    ctx.fillStyle = "#a6bdd2";
    ctx.fillRect(1, -12, 5, 21);

    // Window
    ctx.fillStyle = "#53caff";
    ctx.beginPath();
    ctx.arc(0, -6, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Rocket markings
    ctx.fillStyle = "#163958";
    ctx.fillRect(-5, 2, 10, 2);

    ctx.restore();

    // Pitch indicator
    ctx.strokeStyle = "#77cfff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 42, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();

    ctx.fillStyle = "#d5edff";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(state.pitch) + "°", x, y + 57);
}

function drawTargetMarker() {
    if (state.phase === "pad" || state.phase === "ascent") return;

    const x = canvasWidth * 0.82;
    const y = canvasHeight * 0.30;

    ctx.strokeStyle = "#66d6ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.moveTo(x - 20, y);
    ctx.lineTo(x - 7, y);
    ctx.moveTo(x + 7, y);
    ctx.lineTo(x + 20, y);
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x, y - 7);
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x, y + 20);
    ctx.stroke();

    ctx.fillStyle = "#bfeaff";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("TARGET", x, y + 32);
}

function drawScene() {
    drawStars();
  updateEngineSound();

    if (state.phase === "ascent" || state.phase === "pad") {
        drawEarth();
    } else if (state.phase === "transfer") {
        drawEarth();
        drawDestination();
    } else {
        drawDestination();
    }

    drawTargetMarker();
    drawRocket();

    if (state.paused) {
        ctx.fillStyle = "#02061188";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
}

function gameLoop(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;

    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.05);
    state.lastTime = timestamp;

    if (!state.paused &&
        state.phase !== "complete" &&
        state.phase !== "failed") {
        state.elapsed += dt;
        updatePhysics(dt);
        updateHUD();
    }

    drawScene();

    if (state.phase !== "complete" && state.phase !== "failed") {
        state.animationId = requestAnimationFrame(gameLoop);
    }
}

function changePitch(amount) {
    if (state.paused) return;
    if (state.phase !== "ascent" &&
        state.phase !== "approach" &&
        state.phase !== "landing") return;

    state.pitch = Math.max(0, Math.min(90, state.pitch + amount));
    playSound("click");
    updateHUD();
}

function togglePause() {
    if (state.phase === "complete" || state.phase === "failed") return;

    state.paused = !state.paused;
    $("pause-overlay").classList.toggle("hidden", !state.paused);
    $("pause-button").textContent = state.paused ? "▶ RESUME" : "Ⅱ PAUSE";

    if (state.paused) {
        $("guidance-status").textContent = "PAUSED";
    } else {
        $("guidance-status").textContent = "ACTIVE";
        state.lastTime = 0;
    }
}

function exitToMenu() {
    state.paused = true;
    cancelAnimationFrame(state.animationId);
    $("pause-overlay").classList.add("hidden");
    showScreen("menu-screen");

    $("career-stat").textContent =
        "MISSIONS COMPLETED: " + Number(readSave("missionsCompleted", 0));
}

$("rocket-select").addEventListener("change", updateDestinationOptions);
$("destination-select").addEventListener("change", updateSelectionInfo);

$("launch-button").addEventListener("click", resetMission);
$("retry-button").addEventListener("click", resetMission);
$("return-button").addEventListener("click", exitToMenu);
$("exit-button").addEventListener("click", exitToMenu);
$("pause-button").addEventListener("click", togglePause);
$("resume-button").addEventListener("click", togglePause);

$("pitch-up").addEventListener("click", () => changePitch(2));
$("pitch-down").addEventListener("click", () => changePitch(-2));

$("throttle-slider").addEventListener("input", (event) => {
    state.throttle = Number(event.target.value);
    $("throttle-value").textContent = state.throttle + "%";
    updateHUD();
});

window.addEventListener("resize", resizeCanvas);

window.addEventListener("keydown", (event) => {
    if (event.repeat) return;

    if (event.key === "ArrowUp") {
        event.preventDefault();
        changePitch(2);
    } else if (event.key === "ArrowDown") {
        event.preventDefault();
        changePitch(-2);
    } else if (event.key.toLowerCase() === "p") {
        togglePause();
    }
});

updateRocketOptions();

$("career-stat").textContent =
    "MISSIONS COMPLETED: " + Number(readSave("missionsCompleted", 0));

resizeCanvas();
updateHUD();

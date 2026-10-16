
"use strict";

(() => {
  const canvas = document.getElementById("sf-canvas");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("sf-score");
  const energyEl = document.getElementById("sf-energy");
  const bestEl = document.getElementById("sf-best");

  const overlay = document.getElementById("sf-overlay");
  const overlayTag = document.getElementById("sf-overlay-tag");
  const overlayTitle = document.getElementById("sf-overlay-title");
  const overlayMessage = document.getElementById("sf-overlay-message");
  const startButton = document.getElementById("sf-start");

  const BEST_KEY = "voidArcadeStarboundFlightBest";
  const ENERGY_KEY = "voidArcadeStarboundFlightEnergy";

  const W = canvas.width;
  const H = canvas.height;

  const keys = new Set();
  const touch = new Set();

  let running = false;
  let lastTime = 0;
  let elapsed = 0;
  let score = 0;
  let energy = 0;
  let best = readNumber(BEST_KEY);
  let totalEnergy = readNumber(ENERGY_KEY);
  let obstacleTimer = 0;
  let orbTimer = 0;
  let animationId = 0;

  const player = {
    x: W / 2,
    y: H - 105,
    w: 24,
    h: 30,
    speed: 245,
    invulnerable: 0
  };

  let obstacles = [];
  let orbs = [];
  let particles = [];

  const stars = Array.from({ length: 100 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.random() < 0.75 ? 1 : 2,
    speed: 25 + Math.random() * 90
  }));

  function readNumber(key) {
    try {
      return Number(localStorage.getItem(key)) || 0;
    } catch {
      return 0;
    }
  }

  function saveNumber(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // The game remains playable if storage is unavailable.
    }
  }

  function updateHUD() {
    scoreEl.textContent = Math.floor(score);
    energyEl.textContent = energy;
    bestEl.textContent = best;
  }

  function resetGame() {
    score = 0;
    energy = 0;
    elapsed = 0;
    obstacleTimer = 0.8;
    orbTimer = 1.4;

    player.x = W / 2;
    player.y = H - 105;
    player.invulnerable = 0;

    obstacles = [];
    orbs = [];
    particles = [];

    keys.clear();
    touch.clear();
    updateHUD();
  }

  function startGame() {
    cancelAnimationFrame(animationId);
    resetGame();

    running = true;
    overlay.classList.add("is-hidden");
    lastTime = performance.now();
    animationId = requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;

    if (score > best) {
      best = Math.floor(score);
      saveNumber(BEST_KEY, best);
    }

    totalEnergy += energy;
    saveNumber(ENERGY_KEY, totalEnergy);

    updateHUD();

    overlayTag.textContent = "FLIGHT TERMINATED";
    overlayTitle.textContent = "MISSION COMPLETE";
    overlayMessage.textContent =
      `Distance: ${Math.floor(score)}. Energy collected: ${energy}. ` +
      `Best flight: ${best}.`;
    startButton.textContent = "FLY AGAIN";
    overlay.classList.remove("is-hidden");
  }

  function spawnObstacle() {
    const size = 16 + Math.random() * 20;

    obstacles.push({
      x: 12 + Math.random() * (W - size - 24),
      y: -size - 5,
      w: size,
      h: size * (0.8 + Math.random() * 0.5),
      speed: 115 + Math.random() * 65 + Math.min(150, elapsed * 2.1),
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 2
    });
  }

  function spawnOrb() {
    orbs.push({
      x: 20 + Math.random() * (W - 40),
      y: -15,
      r: 7,
      speed: 100 + Math.min(100, elapsed * 1.2),
      phase: Math.random() * Math.PI * 2
    });
  }

  function burst(x, y, color, amount = 10) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 145;

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25 + Math.random() * 0.5,
        maxLife: 0.75,
        color,
        size: 2 + Math.random() * 3
      });
    }
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y;
  }

  function update(dt) {
    elapsed += dt;
    score += dt * 10;

    const difficulty = Math.min(2.4, 1 + elapsed / 55);
    const left = keys.has("ArrowLeft") || keys.has("a") || touch.has("left");
    const right = keys.has("ArrowRight") || keys.has("d") || touch.has("right");
    const up = keys.has("ArrowUp") || keys.has("w") || touch.has("up");
    const down = keys.has("ArrowDown") || keys.has("s") || touch.has("down");

    let dx = Number(right) - Number(left);
    let dy = Number(down) - Number(up);

    // Normalize diagonal movement so it isn't faster.
    if (dx && dy) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    player.x = Math.max(8, Math.min(W - player.w - 8, player.x));
    player.y = Math.max(12, Math.min(H - player.h - 10, player.y));
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    for (const star of stars) {
      star.y += star.speed * dt * difficulty;

      if (star.y > H) {
        star.y = 0;
        star.x = Math.random() * W;
      }
    }

    obstacleTimer -= dt;
    if (obstacleTimer <= 0) {
      spawnObstacle();
      obstacleTimer = Math.max(0.26, 0.92 - elapsed * 0.006) *
        (0.75 + Math.random() * 0.55);
    }

    orbTimer -= dt;
    if (orbTimer <= 0) {
      spawnOrb();
      orbTimer = 1.4 + Math.random() * 1.4;
    }

    for (const obstacle of obstacles) {
      obstacle.y += obstacle.speed * dt * difficulty;
      obstacle.rotation += obstacle.spin * dt;
    }

    for (const orb of orbs) {
      orb.y += orb.speed * dt;
      orb.phase += dt * 5;
    }

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }

    particles = particles.filter(p => p.life > 0);
    obstacles = obstacles.filter(o => o.y < H + 60);
    orbs = orbs.filter(o => o.y < H + 25);

    const shipBox = {
      x: player.x + 4,
      y: player.y + 4,
      w: player.w - 8,
      h: player.h - 8
    };

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];

      if (overlaps(shipBox, obstacle) && player.invulnerable <= 0) {
        burst(player.x + player.w / 2, player.y + player.h / 2, "#ff708c", 24);
        endGame();
        return;
      }
    }

    for (let i = orbs.length - 1; i >= 0; i--) {
      const orb = orbs[i];
      const orbBox = {
        x: orb.x - orb.r,
        y: orb.y - orb.r,
        w: orb.r * 2,
        h: orb.r * 2
      };

      if (overlaps(shipBox, orbBox)) {
        energy++;
        score += 25;
        burst(orb.x, orb.y, "#68efff", 12);
        orbs.splice(i, 1);
      }
    }

    updateHUD();
  }

  function drawShip() {
    // Brief blink after launch; collisions end the flight.
    if (player.invulnerable > 0 && Math.floor(elapsed * 12) % 2 === 0) {
      return;
    }

    const x = Math.round(player.x);
    const y = Math.round(player.y);

    ctx.fillStyle = "#68efff";
    ctx.fillRect(x + 10, y, 4, 5);
    ctx.fillRect(x + 7, y + 5, 10, 5);
    ctx.fillRect(x + 4, y + 10, 16, 7);
    ctx.fillRect(x, y + 17, 24, 7);
    ctx.fillRect(x + 4, y + 24, 5, 5);
    ctx.fillRect(x + 15, y + 24, 5, 5);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 10, y + 7, 4, 7);

    ctx.fillStyle = "#9e8cff";
    ctx.fillRect(x + 5, y + 18, 4, 3);
    ctx.fillRect(x + 15, y + 18, 4, 3);

    if (running && Math.random() > 0.3) {
      ctx.fillStyle = "#ffbd6b";
      ctx.fillRect(x + 7, y + 30, 3, 5 + Math.random() * 5);
      ctx.fillRect(x + 15, y + 30, 3, 5 + Math.random() * 5);
    }
  }

  function drawObstacle(o) {
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.rotate(o.rotation);

    const s = Math.max(3, Math.floor(Math.min(o.w, o.h) / 4));

    ctx.fillStyle = "#625a7b";
    ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
    ctx.fillStyle = "#a49abf";
    ctx.fillRect(-o.w / 2 + s, -o.h / 2 + s, o.w * 0.45, s);
    ctx.fillStyle = "#37334c";
    ctx.fillRect(o.w / 5, o.h / 5, s * 2, s * 2);

    ctx.restore();
  }

  function drawOrb(orb) {
    const pulse = Math.sin(orb.phase) * 2;

    ctx.fillStyle = "rgba(104,239,255,0.15)";
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r + 5 + pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#68efff";
    ctx.fillRect(orb.x - 3, orb.y - 6, 6, 12);
    ctx.fillRect(orb.x - 6, orb.y - 3, 12, 6);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(orb.x - 1, orb.y - 2, 2, 4);
  }

  function draw() {
    ctx.fillStyle = "#030711";
    ctx.fillRect(0, 0, W, H);

    for (const star of stars) {
      ctx.fillStyle = star.size === 1 ? "#5b7396" : "#b9eaff";
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
    }

    // Subtle lane guides.
    ctx.strokeStyle = "rgba(104,239,255,0.055)";
    ctx.lineWidth = 1;
    for (let x = 80; x < W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (const orb of orbs) drawOrb(orb);
    for (const obstacle of obstacles) drawObstacle(obstacle);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    drawShip();

    // Scanline effect.
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(0, y, W, 1);
    }
  }

  function loop(now) {
    if (!running) return;

    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    update(dt);
    draw();

    if (running) {
      animationId = requestAnimationFrame(loop);
    }
  }

  function setDirection(direction, pressed) {
    if (pressed) touch.add(direction);
    else touch.delete(direction);
  }

  document.addEventListener("keydown", event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const controlled = [
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "w", "a", "s", "d"
    ];

    if (controlled.includes(key)) event.preventDefault();
    keys.add(key);
  });

  document.addEventListener("keyup", event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
  });

  window.addEventListener("blur", () => {
    keys.clear();
    touch.clear();
  });

  document.querySelectorAll("[data-move]").forEach(button => {
    const direction = button.dataset.move;

    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      setDirection(direction, true);
    });

    const release = () => setDirection(direction, false);

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  startButton.addEventListener("click", startGame);

  bestEl.textContent = best;
  energyEl.textContent = 0;
  scoreEl.textContent = 0;

  // Draw a stationary ship behind the opening screen.
  draw();
})();

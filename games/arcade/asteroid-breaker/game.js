
"use strict";

(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    document.getElementById("overlay-title").textContent = "CANVAS ERROR";
    document.getElementById("overlay-message").textContent =
      "This browser could not initialize the game canvas.";
    return;
  }

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const HIGH_SCORE_KEY = "voidArcadeAsteroidBreakerHighScore";

  const scoreElement = document.getElementById("score");
  const highScoreElement = document.getElementById("high-score");
  const livesElement = document.getElementById("lives");
  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMessage = document.getElementById("overlay-message");
  const startButton = document.getElementById("start-button");

  const input = {
    left: false,
    right: false,
    fire: false
  };

  let running = false;
  let animationId = 0;
  let lastTime = 0;
  let elapsed = 0;
  let spawnTimer = 0;
  let fireTimer = 0;
  let score = 0;
  let lives = 3;
  let bestScore = readBestScore();

  let player;
  let bullets = [];
  let asteroids = [];
  let particles = [];
  let stars = [];
  let invulnerable = 0;

  function readBestScore() {
    try {
      const value = Number(localStorage.getItem(HIGH_SCORE_KEY));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch {
      return 0;
    }
  }

  function saveBestScore() {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(bestScore));
    } catch {
      // Gameplay remains available when storage is disabled.
    }
  }

  function formatScore(value) {
    return Math.max(0, Math.floor(value)).toString().padStart(6, "0");
  }

  function updateHUD() {
    scoreElement.textContent = formatScore(score);
    highScoreElement.textContent = formatScore(bestScore);
    livesElement.textContent = "♥ ".repeat(lives).trim() || "—";
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function createStars() {
    stars = [];

    for (let i = 0; i < 85; i++) {
      stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        size: Math.random() > 0.84 ? 3 : 2,
        speed: random(12, 55),
        brightness: random(0.25, 0.9)
      });
    }
  }

  function resetGame() {
    score = 0;
    lives = 3;
    elapsed = 0;
    spawnTimer = 0.45;
    fireTimer = 0;
    invulnerable = 0;

    bullets = [];
    asteroids = [];
    particles = [];

    player = {
      x: WIDTH / 2,
      y: HEIGHT - 78,
      width: 24,
      height: 28,
      speed: 270
    };

    input.left = false;
    input.right = false;
    input.fire = false;

    updateHUD();
    drawScene();
  }

  function makeAsteroid() {
    const radius = random(13, 26);
    const cell = 4;
    const cells = [];
    const columns = Math.ceil((radius * 2) / cell);
    const center = columns / 2;

    for (let row = 0; row < columns; row++) {
      for (let column = 0; column < columns; column++) {
        const dx = column + 0.5 - center;
        const dy = row + 0.5 - center;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (
          distance < center * random(0.83, 1.12) &&
          Math.random() > 0.14
        ) {
          cells.push({
            x: column * cell - radius,
            y: row * cell - radius,
            color: Math.random() > 0.5 ? "#8993a5" : "#586477"
          });
        }
      }
    }

    const difficulty = Math.min(2.6, 1 + elapsed / 45);

    return {
      x: random(radius + 4, WIDTH - radius - 4),
      y: -radius - 8,
      radius,
      speed: random(78, 142) * difficulty,
      drift: random(-48, 48),
      angle: random(0, Math.PI * 2),
      spin: random(-1.2, 1.2),
      cells
    };
  }

  function spawnBullet() {
    bullets.push({
      x: player.x,
      y: player.y - player.height / 2,
      width: 4,
      height: 13,
      speed: 460
    });

    createParticles(player.x, player.y - 16, "#72edff", 2, 24);
  }

  function createParticles(x, y, color, amount = 8, force = 90) {
    for (let i = 0; i < amount; i++) {
      const angle = random(0, Math.PI * 2);
      const speed = random(force * 0.3, force);

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() > 0.5 ? 4 : 3,
        life: random(0.16, 0.45),
        maxLife: 0.45,
        color
      });
    }
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(animationId);
    clearInputs();

    if (score > bestScore) {
      bestScore = score;
      saveBestScore();
    }

    updateHUD();

    overlayTitle.textContent = "SHIP DESTROYED";
    overlayMessage.textContent =
      `Mission over. You scored ${score} points. ` +
      (score >= bestScore && score > 0
        ? "New local record!"
        : `Your best score is ${bestScore}.`);

    startButton.innerHTML = 'RESTART MISSION <span>↻</span>';
    overlay.hidden = false;
  }

  function startGame() {
    cancelAnimationFrame(animationId);
    resetGame();

    running = true;
    lastTime = 0;
    overlay.hidden = true;
    startButton.innerHTML = 'START MISSION <span>▶</span>';

    animationId = requestAnimationFrame(gameLoop);
  }

  function clearInputs() {
    input.left = false;
    input.right = false;
    input.fire = false;

    document.querySelectorAll("[data-control]").forEach(button => {
      button.classList.remove("is-pressed");
    });
  }

  function keyToControl(key) {
    switch (key.toLowerCase()) {
      case "arrowleft":
      case "a":
        return "left";
      case "arrowright":
      case "d":
        return "right";
      case " ":
      case "spacebar":
        return "fire";
      default:
        return null;
    }
  }

  window.addEventListener("keydown", event => {
    const control = keyToControl(event.key);
    if (!control) return;

    event.preventDefault();

    if (running && !event.repeat) {
      input[control] = true;
    }
  });

  window.addEventListener("keyup", event => {
    const control = keyToControl(event.key);
    if (control) {
      event.preventDefault();
      input[control] = false;
    }
  });

  window.addEventListener("blur", clearInputs);

  document.querySelectorAll("[data-control]").forEach(button => {
    const control = button.dataset.control;

    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      if (!running) return;

      input[control] = true;
      button.classList.add("is-pressed");

      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture may not be supported in every preview.
      }
    });

    const release = event => {
      if (event) event.preventDefault();
      input[control] = false;
      button.classList.remove("is-pressed");
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  startButton.addEventListener("click", startGame);

  function updateStars(dt) {
    for (const star of stars) {
      star.y += star.speed * dt;

      if (star.y > HEIGHT) {
        star.y = -3;
        star.x = Math.random() * WIDTH;
      }
    }
  }

  function update(dt) {
    elapsed += dt;
    invulnerable = Math.max(0, invulnerable - dt);

    const difficulty = Math.min(2.6, 1 + elapsed / 45);

    if (input.left) {
      player.x -= player.speed * dt;
    }

    if (input.right) {
      player.x += player.speed * dt;
    }

    player.x = Math.max(
      player.width / 2 + 5,
      Math.min(WIDTH - player.width / 2 - 5, player.x)
    );

    fireTimer -= dt;

    if (input.fire && fireTimer <= 0) {
      spawnBullet();
      fireTimer = 0.19;
    }

    spawnTimer -= dt;

    if (spawnTimer <= 0) {
      asteroids.push(makeAsteroid());
      spawnTimer = Math.max(0.3, 0.92 - elapsed * 0.006);
    }

    for (const bullet of bullets) {
      bullet.y -= bullet.speed * dt;
    }

    bullets = bullets.filter(bullet => bullet.y > -20);

    for (const asteroid of asteroids) {
      asteroid.y += asteroid.speed * dt;
      asteroid.x += asteroid.drift * dt;
      asteroid.angle += asteroid.spin * dt;

      if (asteroid.x < asteroid.radius ||
          asteroid.x > WIDTH - asteroid.radius) {
        asteroid.drift *= -1;
        asteroid.x = Math.max(
          asteroid.radius,
          Math.min(WIDTH - asteroid.radius, asteroid.x)
        );
      }
    }

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      particle.vx *= 0.985;
      particle.vy *= 0.985;
    }

    particles = particles.filter(particle => particle.life > 0);

    // Bullet-to-asteroid collision.
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const asteroid = asteroids[i];
      let destroyed = false;

      for (let j = bullets.length - 1; j >= 0; j--) {
        const bullet = bullets[j];
        const dx = bullet.x - asteroid.x;
        const dy = bullet.y - asteroid.y;
        const hitRadius = asteroid.radius + 4;

        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          bullets.splice(j, 1);
          asteroids.splice(i, 1);

          createParticles(
            asteroid.x,
            asteroid.y,
            "#ffe28a",
            12,
            115
          );

          score += 10;

          if (score > bestScore) {
            bestScore = score;
            saveBestScore();
          }

          updateHUD();
          destroyed = true;
          break;
        }
      }

      if (destroyed) continue;
    }

    // Asteroid-to-ship collision.
    if (invulnerable <= 0) {
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        const dx = player.x - asteroid.x;
        const dy = player.y - asteroid.y;
        const hitRadius = asteroid.radius + 11;

        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          asteroids.splice(i, 1);

          createParticles(player.x, player.y, "#ff7189", 18, 145);

          lives--;
          invulnerable = 1.4;
          updateHUD();

          if (lives <= 0) {
            endGame();
            return;
          }

          break;
        }
      }
    }

    // Remove asteroids that leave the playfield.
    asteroids = asteroids.filter(
      asteroid => asteroid.y < HEIGHT + asteroid.radius + 5
    );

    updateStars(dt);

    // Gradually increase the falling speed of new asteroids.
    if (difficulty > 1) {
      // Difficulty is already applied during asteroid generation.
    }
  }

  function drawBackground() {
    ctx.fillStyle = "#050812";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Faint horizontal retro scan lines.
    ctx.fillStyle = "rgba(114, 237, 255, 0.025)";

    for (let y = 0; y < HEIGHT; y += 8) {
      ctx.fillRect(0, y, WIDTH, 1);
    }

    for (const star of stars) {
      ctx.globalAlpha = star.brightness;
      ctx.fillStyle = "#b7d9ff";
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.globalAlpha = 1;
  }

  function drawShip() {
    if (!player) return;

    // Blink briefly after taking damage.
    if (invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0) {
      return;
    }

    const x = Math.round(player.x);
    const y = Math.round(player.y);

    // Engine flame.
    if (running && Math.random() > 0.25) {
      ctx.fillStyle = "#ffb45f";
      ctx.fillRect(x - 3, y + 12, 6, 7);
      ctx.fillStyle = "#72edff";
      ctx.fillRect(x - 2, y + 14, 4, 4);
    }

    // Pixel-art spaceship.
    ctx.fillStyle = "#d8e6ff";
    ctx.fillRect(x - 3, y - 14, 6, 4);
    ctx.fillRect(x - 7, y - 10, 14, 5);
    ctx.fillRect(x - 10, y - 5, 20, 6);
    ctx.fillRect(x - 13, y + 1, 8, 7);
    ctx.fillRect(x + 5, y + 1, 8, 7);
    ctx.fillRect(x - 6, y + 2, 12, 8);

    ctx.fillStyle = "#72edff";
    ctx.fillRect(x - 3, y - 8, 6, 7);

    ctx.fillStyle = "#526d9b";
    ctx.fillRect(x - 10, y + 5, 5, 4);
    ctx.fillRect(x + 5, y + 5, 5, 4);

    ctx.fillStyle = "#a9ff82";
    ctx.fillRect(x - 1, y - 2, 2, 3);
  }

  function drawAsteroid(asteroid) {
    ctx.save();
    ctx.translate(Math.round(asteroid.x), Math.round(asteroid.y));
    ctx.rotate(asteroid.angle);

    for (const cell of asteroid.cells) {
      ctx.fillStyle = cell.color;
      ctx.fillRect(cell.x, cell.y, 4, 4);
    }

    ctx.fillStyle = "#b7c1d0";
    ctx.fillRect(-3, -3, 4, 4);

    ctx.restore();
  }

  function drawBullets() {
    for (const bullet of bullets) {
      ctx.fillStyle = "#72edff";
      ctx.fillRect(
        Math.round(bullet.x - bullet.width / 2),
        Math.round(bullet.y - bullet.height / 2),
        bullet.width,
        bullet.height
      );

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(
        Math.round(bullet.x - 1),
        Math.round(bullet.y - 4),
        2,
        5
      );
    }
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        Math.round(particle.x),
        Math.round(particle.y),
        particle.size,
        particle.size
      );
    }

    ctx.globalAlpha = 1;
  }

  function drawScene() {
    drawBackground();

    for (const asteroid of asteroids) {
      drawAsteroid(asteroid);
    }

    drawBullets();
    drawParticles();
    drawShip();
  }

  function gameLoop(timestamp) {
    if (!running) return;

    if (!lastTime) lastTime = timestamp;

    // Cap delta time to avoid large jumps after a stalled frame.
    const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
    lastTime = timestamp;

    update(dt);
    drawScene();

    if (running) {
      animationId = requestAnimationFrame(gameLoop);
    }
  }

  createStars();
  resetGame();
  updateHUD();

  overlayTitle.textContent = "READY, PILOT?";
  overlayMessage.textContent =
    "Destroy asteroids, protect your hull, and survive the deep-space field.";
  startButton.innerHTML = 'START MISSION <span>▶</span>';
})();

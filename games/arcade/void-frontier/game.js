
"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("vf-canvas");
  const ctx = canvas.getContext("2d");

  const overlay = $("vf-overlay");
  const overlayEyebrow = $("vf-overlay-eyebrow");
  const overlayTitle = $("vf-overlay-title");
  const overlayText = $("vf-overlay-text");
  const mainAction = $("vf-main-action");
  const toast = $("vf-toast");

  const W = canvas.width;
  const H = canvas.height;
  const SAVE_KEY = "voidArcadeVoidFrontierCampaignV1";
  
  // ============================
  // VOID FRONTIER SOUND SYSTEM
  // ============================

  let soundEnabled = true;
  let audioContext = null;

  const soundButton = $("vf-sound-toggle");

  function ensureAudio() {
    if (!soundEnabled) return;

    try {
      const AudioEngine =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioEngine) return;

      if (!audioContext) {
        audioContext = new AudioEngine();
      }

      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }
    } catch (error) {
      // The game remains playable if audio is unavailable.
    }
  }

  function playTone(
    frequency,
    duration,
    waveform = "sine",
    volume = 0.035,
    endFrequency = frequency,
    delay = 0
  ) {
    if (!soundEnabled) return;

    ensureAudio();
    if (!audioContext) return;

    try {
      const start = audioContext.currentTime + delay;
      const end = start + duration;

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, start);

      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        end
      );

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, volume),
        start + Math.min(0.015, duration / 3)
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(start);
      oscillator.stop(end + 0.01);
    } catch (error) {
      // Ignore individual sound failures.
    }
  }

  function playSound(type) {
    if (!soundEnabled) return;

    switch (type) {
      case "shoot":
        playTone(650, 0.075, "sawtooth", 0.018, 230);
        break;

      case "hit":
        playTone(260, 0.07, "square", 0.018, 110);
        break;

      case "explosion":
        playTone(170, 0.22, "sawtooth", 0.035, 45);
        playTone(85, 0.25, "triangle", 0.025, 35, 0.035);
        break;

      case "damage":
        playTone(240, 0.16, "sawtooth", 0.035, 75);
        playTone(115, 0.2, "square", 0.018, 55, 0.07);
        break;

      case "salvage":
        playTone(660, 0.09, "sine", 0.03, 880);
        playTone(990, 0.12, "sine", 0.025, 1200, 0.075);
        break;

      case "energy":
        playTone(440, 0.12, "sine", 0.03, 660);
        playTone(660, 0.16, "sine", 0.03, 990, 0.1);
        break;

      case "upgrade":
        playTone(440, 0.12, "triangle", 0.03, 660);
        playTone(660, 0.14, "triangle", 0.03, 880, 0.12);
        playTone(880, 0.2, "sine", 0.025, 1100, 0.24);
        break;

      case "victory":
        playTone(523, 0.2, "triangle", 0.035, 523);
        playTone(659, 0.2, "triangle", 0.035, 659, 0.16);
        playTone(784, 0.32, "triangle", 0.04, 784, 0.32);
        break;

      case "defeat":
        playTone(300, 0.22, "triangle", 0.035, 220);
        playTone(220, 0.28, "triangle", 0.03, 130, 0.2);
        break;

      case "start":
        playTone(330, 0.12, "sine", 0.025, 500);
        playTone(500, 0.18, "sine", 0.03, 720, 0.1);
        break;

      case "sector":
        playTone(440, 0.12, "triangle", 0.025, 550);
        playTone(660, 0.16, "triangle", 0.03, 770, 0.13);
        break;
    }
  }

  function updateSoundButton() {
    if (!soundButton) return;

    soundButton.textContent = soundEnabled
      ? "🔊 SOUND: ON"
      : "🔇 SOUND: OFF";

    soundButton.setAttribute(
      "aria-pressed",
      String(soundEnabled)
    );
  }

  if (soundButton) {
    soundButton.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      updateSoundButton();

      if (soundEnabled) {
        ensureAudio();
        playSound("start");
      }
    });
  }

  // Initialize audio from a real user interaction.
  document.addEventListener("pointerdown", () => {
    if (soundEnabled) ensureAudio();
  });

  document.addEventListener("keydown", () => {
    if (soundEnabled) ensureAudio();
  });

  updateSoundButton();


  const SECTORS = [
    { name: "The Outskirts", target: 8, speed: 1, reward: 40 },
    { name: "The Shattered Belt", target: 12, speed: 1.25, reward: 65 },
    { name: "The Silent Reach", target: 16, speed: 1.55, reward: 95 },
    { name: "The Red Expanse", target: 20, speed: 1.85, reward: 130 },
    { name: "The Outer Dark", target: 25, speed: 2.2, reward: 180 }
  ];

  const DEFAULT_SAVE = {
    unlocked: 1,
    current: 0,
    salvage: 0,
    energy: 0,
    totalKills: 0,
    bestScore: 0,
    upgrades: { weapon: 1, shield: 1, engine: 1 }
  };

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);

      const data = JSON.parse(raw);
      const save = {
        ...DEFAULT_SAVE,
        ...data,
        upgrades: { ...DEFAULT_SAVE.upgrades, ...(data.upgrades || {}) }
      };

      save.unlocked = Math.max(1, Math.min(SECTORS.length,
        Math.floor(Number(save.unlocked) || 1)));
      save.current = Math.max(0, Math.min(save.unlocked - 1,
        Math.floor(Number(save.current) || 0)));
      save.salvage = Math.max(0, Number(save.salvage) || 0);
      save.energy = Math.max(0, Number(save.energy) || 0);
      save.totalKills = Math.max(0, Number(save.totalKills) || 0);
      save.bestScore = Math.max(0, Number(save.bestScore) || 0);

      for (const key of ["weapon", "shield", "engine"]) {
        save.upgrades[key] = Math.max(1, Math.min(5,
          Math.floor(Number(save.upgrades[key]) || 1)));
      }

      return save;
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  let campaign = loadSave();

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(campaign));
    } catch {
      showToast("Browser storage unavailable — progress may not persist.");
    }
    updateSidebar();
  }

  let running = false;
  let lastTime = 0;
  let elapsed = 0;
  let score = 0;
  let kills = 0;
  let hull = 100;
  let shield = 50;
  let fireTimer = 0;
  let spawnTimer = 0;
  let damageTimer = 0;
  let toastTimer = null;
  let frameId = 0;

  const keys = new Set();
  const touch = new Set();

  const player = { x: W / 2, y: H - 80, radius: 17 };

  let enemies = [];
  let shots = [];
  let enemyShots = [];
  let pickups = [];
  let particles = [];

  const stars = Array.from({ length: 145 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.random() < 0.8 ? 1 : 2,
    speed: 15 + Math.random() * 65,
    alpha: 0.2 + Math.random() * 0.7
  }));

  function sector() {
    return SECTORS[campaign.current];
  }

  function maxShield() {
    return 50 + (campaign.upgrades.shield - 1) * 25;
  }

  function fireDelay() {
    return Math.max(0.12, 0.32 - (campaign.upgrades.weapon - 1) * 0.045);
  }

  function playerSpeed() {
    return 245 + (campaign.upgrades.engine - 1) * 32;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function updateHUD() {
    $("vf-hull").textContent = Math.max(0, Math.ceil(hull));
    $("vf-shield").textContent = Math.max(0, Math.ceil(shield));
    $("vf-salvage").textContent = campaign.salvage;
    $("vf-energy").textContent = campaign.energy;
    $("vf-sector-name").textContent =
      `SECTOR ${String(campaign.current + 1).padStart(2, "0")}`;
    $("vf-kill-count").textContent = `${kills} / ${sector().target}`;

    const progress = Math.min(100, kills / sector().target * 100);
    $("vf-progress-fill").style.width = `${progress}%`;
  }

  function updateSidebar() {
    $("vf-unlocked").textContent = campaign.unlocked;
    $("vf-total-kills").textContent = campaign.totalKills;
    $("vf-best-score").textContent = campaign.bestScore;

    const rank = campaign.totalKills >= 100 ? "Frontier Veteran"
      : campaign.totalKills >= 40 ? "Sector Specialist"
      : campaign.totalKills >= 15 ? "Pilot"
      : "Recruit";
    $("vf-rank").textContent = rank;

    const labels = {
      weapon: ["Faster fire", "Weapon array"],
      shield: ["More shield", "Shield generator"],
      engine: ["Faster movement", "Engine drive"]
    };

    for (const type of ["weapon", "shield", "engine"]) {
      const level = campaign.upgrades[type];
      const cost = upgradeCost(type);
      $(`vf-${type}-level`).textContent =
        `Level ${level} · ${labels[type][0]}`;
      $(`vf-${type}-cost`).textContent =
        level >= 5 ? "MAXIMUM LEVEL" : `Cost: ${cost} salvage`;

      const button = document.querySelector(`[data-upgrade="${type}"]`);
      button.disabled = level >= 5 || campaign.salvage < cost;
    }

    renderSectorList();
  }

  function upgradeCost(type) {
    const level = campaign.upgrades[type];
    const base = { weapon: 30, shield: 25, engine: 25 }[type];
    return base * level;
  }

  function renderSectorList() {
    const list = $("vf-sector-list");
    list.replaceChildren();

    SECTORS.forEach((s, index) => {
      const unlocked = index < campaign.unlocked;
      const current = index === campaign.current;
      const entry = document.createElement("div");
      entry.className = "vf-sector-entry" +
        (current ? " current" : "") +
        (!unlocked ? " locked" : "");

      const dot = document.createElement("div");
      dot.className = "vf-sector-dot";
      dot.textContent = unlocked ? String(index + 1).padStart(2, "0") : "×";

      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = s.name;
      const description = document.createElement("span");
      description.textContent = unlocked
        ? `${s.target} hostiles · ${s.reward} salvage bonus`
        : "Sector locked";
      details.append(name, description);

      const button = document.createElement("button");
      button.textContent = current ? "ACTIVE" : unlocked ? "DEPLOY" : "LOCKED";
      button.disabled = !unlocked || current || running;

      if (unlocked && !current) {
        button.addEventListener("click", () => {
          campaign.current = index;
          persist();
          prepareBriefing();
        });
      }

      entry.append(dot, details, button);
      list.append(entry);
    });
  }

  function resetRun() {
    elapsed = 0;
    score = 0;
    kills = 0;
    hull = 100;
    shield = maxShield();
    fireTimer = 0;
    spawnTimer = 0.7;
    damageTimer = 0;
    player.x = W / 2;
    player.y = H - 80;
    enemies = [];
    shots = [];
    enemyShots = [];
    pickups = [];
    particles = [];
    keys.clear();
    touch.clear();
    updateHUD();
  }

  function showOverlay(tag, title, message, buttonText, action) {
    overlayEyebrow.textContent = tag;
    overlayTitle.innerHTML = title;
    overlayText.textContent = message;
    mainAction.textContent = buttonText;
    mainAction.onclick = action;
    overlay.classList.remove("vf-hidden");
  }

  function prepareBriefing() {
    running = false;
    cancelAnimationFrame(frameId);
    resetRun();

    showOverlay(
      `FRONTIER COMMAND / SECTOR ${campaign.current + 1}`,
      "EXPEDITION<br><span>BRIEFING.</span>",
      `${sector().name}: eliminate ${sector().target} hostile drones. Collect salvage and energy, and avoid enemy fire. Upgrades remain with your campaign.`,
      "START EXPEDITION",
      startGame
    );

    draw();
    updateSidebar();
  }

  function startGame() {
    cancelAnimationFrame(frameId);
    resetRun();
    playSound("start");
    running = true;
    overlay.classList.add("vf-hidden");
    lastTime = performance.now();
    frameId = requestAnimationFrame(loop);
  }

  function endRun(victory) {
    if (!running) return;
    running = false;
    playSound(victory ? "victory" : "defeat");

    cancelAnimationFrame(frameId);
    keys.clear();
    touch.clear();

    campaign.bestScore = Math.max(campaign.bestScore, Math.floor(score));

    if (victory) {
      campaign.salvage += sector().reward;

      if (campaign.current + 1 < SECTORS.length) {
        campaign.unlocked = Math.max(campaign.unlocked, campaign.current + 2);
      }

      persist();

      if (campaign.current + 1 < SECTORS.length) {
        showOverlay(
          "SECTOR SECURED",
          "FRONTIER<br><span>EXPANDED.</span>",
          `Mission complete. You eliminated ${kills} hostiles and earned a ${sector().reward} salvage bonus. Choose an unlocked sector or continue to the next one.`,
          "CONTINUE FRONTIER",
          () => {
            campaign.current = Math.min(campaign.current + 1, campaign.unlocked - 1);
            persist();
            prepareBriefing();
          }
        );
      } else {
        showOverlay(
          "CAMPAIGN MILESTONE",
          "THE FRONTIER<br><span>IS YOURS.</span>",
          `You secured every currently available sector. Your best score is ${campaign.bestScore}. You can replay sectors to collect more resources and improve your ship.`,
          "REPLAY FINAL SECTOR",
          prepareBriefing
        );
      }
    } else {
      persist();

      showOverlay(
        "SHIP DISABLED",
        "EXPEDITION<br><span>FAILED.</span>",
        `You eliminated ${kills} of ${sector().target} hostiles and scored ${Math.floor(score)} points. Your collected resources and upgrades have been saved. Upgrade your ship or try again.`,
        "RETRY SECTOR",
        startGame
      );
    }

    updateHUD();
    updateSidebar();
    draw();
  }

  function spawnEnemy() {
    const level = sector();

    enemies.push({
      x: 35 + Math.random() * (W - 70),
      y: -30,
      radius: 13 + Math.random() * 5,
      hp: campaign.current >= 2 && Math.random() < 0.35 ? 2 : 1,
      speed: (45 + Math.random() * 35) * level.speed,
      drift: (Math.random() - 0.5) * 65,
      fire: 1.2 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2
    });
  }

  function firePlayerShot() {
    const level = campaign.upgrades.weapon;
    playSound("shoot");

    shots.push({
      x: player.x,
      y: player.y - 20,
      vx: 0,
      vy: -490,
      damage: level >= 4 ? 2 : 1,
      radius: 4
    });

    if (level >= 3) {
      shots.push({
        x: player.x - 10,
        y: player.y - 10,
        vx: -24,
        vy: -460,
        damage: 1,
        radius: 3
      });
      shots.push({
        x: player.x + 10,
        y: player.y - 10,
        vx: 24,
        vy: -460,
        damage: 1,
        radius: 3
      });
    }
  }

  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 150;

      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25 + Math.random() * 0.45,
        maxLife: 0.7,
        color,
        size: 2 + Math.random() * 3
      });
    }
  }

  function dropPickup(x, y) {
    const type = Math.random() < 0.68 ? "salvage" : "energy";
    pickups.push({
      x, y, type,
      radius: 8,
      vy: 65,
      phase: Math.random() * 6
    });
  }

  function damagePlayer(amount) {
    if (damageTimer > 0) return;
    damageTimer = 0.45;
    playSound("damage");

    let remaining = amount;

    if (shield > 0) {
      const absorbed = Math.min(shield, remaining);
      shield -= absorbed;
      remaining -= absorbed;
    }

    if (remaining > 0) hull = Math.max(0, hull - remaining);

    burst(player.x, player.y, shield > 0 ? "#80aaff" : "#ff9eab", 8);
    updateHUD();

    if (hull <= 0) endRun(false);
  }

  function overlaps(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const r = a.radius + b.radius;
    return dx * dx + dy * dy < r * r;
  }

  function update(dt) {
    elapsed += dt;
    score += dt * 4;
    fireTimer -= dt;
    damageTimer = Math.max(0, damageTimer - dt);

    // Slowly regenerate shields when the ship is not taking damage.
    if (damageTimer <= 0 && shield < maxShield()) {
      shield = Math.min(maxShield(), shield + dt * 2.5);
    }

    const left = keys.has("ArrowLeft") || keys.has("a") || touch.has("left");
    const right = keys.has("ArrowRight") || keys.has("d") || touch.has("right");
    const up = keys.has("ArrowUp") || keys.has("w") || touch.has("up");
    const down = keys.has("ArrowDown") || keys.has("s") || touch.has("down");
    const firing = keys.has(" ") || touch.has("fire");

    let dx = Number(right) - Number(left);
    let dy = Number(down) - Number(up);

    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }

    player.x += dx * playerSpeed() * dt;
    player.y += dy * playerSpeed() * dt;
    player.x = Math.max(20, Math.min(W - 20, player.x));
    player.y = Math.max(25, Math.min(H - 25, player.y));

    if (firing && fireTimer <= 0) {
      firePlayerShot();
      fireTimer = fireDelay();
    }

    for (const star of stars) {
      star.y += star.speed * dt;
      if (star.y > H) {
        star.y = 0;
        star.x = Math.random() * W;
      }
    }

    spawnTimer -= dt;

    if (kills < sector().target && spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = Math.max(0.28, 0.85 - campaign.current * 0.08) *
        (0.8 + Math.random() * 0.55);
    }

    for (const enemy of enemies) {
      enemy.phase += dt * 2;
      enemy.x += (enemy.drift + Math.sin(enemy.phase) * 22) * dt;
      enemy.y += enemy.speed * dt;

      if (enemy.x < 20 || enemy.x > W - 20) enemy.drift *= -1;

      enemy.fire -= dt;
      if (enemy.fire <= 0 && enemy.y > 0 && enemy.y < H - 120) {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        const speed = 145 + campaign.current * 18;

        enemyShots.push({
          x: enemy.x,
          y: enemy.y + 8,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 5
        });

        enemy.fire = 1.5 + Math.random() * 1.3;
      }
    }

    for (const shot of shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
    }

    for (const shot of enemyShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
    }

    for (const pickup of pickups) {
      pickup.y += pickup.vy * dt;
      pickup.phase += dt * 4;
    }

    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }

    particles = particles.filter(p => p.life > 0);
    shots = shots.filter(s => s.y > -15 && s.x > -15 && s.x < W + 15);
    enemyShots = enemyShots.filter(s =>
      s.y > -20 && s.y < H + 20 && s.x > -20 && s.x < W + 20);
    pickups = pickups.filter(p => p.y < H + 20);
    enemies = enemies.filter(e => e.y < H + 45);

    // Player shots damage enemies.
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      let destroyed = false;

      for (let j = shots.length - 1; j >= 0; j--) {
        const shot = shots[j];

        if (overlaps(enemy, shot)) {
          enemy.hp -= shot.damage;
          shots.splice(j, 1);
          burst(shot.x, shot.y, "#75e5d2", 3);

          if (enemy.hp <= 0) {
            destroyed = true;
            break;
          }
        }
      }

      if (destroyed) {
        burst(enemy.x, enemy.y, "#ffbd84", 15);
        playSound("explosion");
        dropPickup(enemy.x, enemy.y);
        enemies.splice(i, 1);

        kills++;
        campaign.totalKills++;
        score += 20;
        persist();

        if (kills >= sector().target) {
          endRun(true);
          return;
        }
      }
    }

    // Enemy bullets and collisions damage the player.
    for (let i = enemyShots.length - 1; i >= 0; i--) {
      if (overlaps(player, enemyShots[i])) {
        enemyShots.splice(i, 1);
        damagePlayer(15);
        if (!running) return;
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (overlaps(player, enemies[i])) {
        burst(enemies[i].x, enemies[i].y, "#ff9eab", 12);
        enemies.splice(i, 1);
        damagePlayer(25);
        if (!running) return;
      }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      if (overlaps(player, pickups[i])) {
        const item = pickups[i];

        if (item.type === "salvage") {
          campaign.salvage += 5;
          playSound("salvage");
          burst(item.x, item.y, "#f5d48b", 7);
          showToast("+5 SALVAGE");
        } else {
          campaign.energy += 3;
          playSound("energy");
          shield = Math.min(maxShield(), shield + 12);
          burst(item.x, item.y, "#75e5d2", 7);
          showToast("+3 ENERGY · SHIELD RECHARGED");
        }

        pickups.splice(i, 1);
        persist();
      }
    }

    updateHUD();
  }

  function drawShip() {
    ctx.save();
    ctx.translate(player.x, player.y);

    // Engine glow.
    ctx.fillStyle = "#326f79";
    ctx.beginPath();
    ctx.moveTo(-7, 12);
    ctx.lineTo(0, 29 + Math.random() * 7);
    ctx.lineTo(7, 12);
    ctx.fill();

    ctx.fillStyle = "#75e5d2";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(17, 14);
    ctx.lineTo(6, 10);
    ctx.lineTo(0, 15);
    ctx.lineTo(-6, 10);
    ctx.lineTo(-17, 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#d8fff8";
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(5, 4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();

    if (shield > 0) {
      ctx.strokeStyle = `rgba(128,170,255,${0.22 + 0.15 * Math.sin(elapsed * 5)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    ctx.fillStyle = "#392b43";
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(-18, -3);
    ctx.lineTo(-12, -13);
    ctx.lineTo(0, -8);
    ctx.lineTo(12, -13);
    ctx.lineTo(18, -3);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#e89aaf";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ff8da7";
    ctx.fillRect(-5, -2, 10, 4);

    if (enemy.hp > 1) {
      ctx.fillStyle = "#f5d48b";
      ctx.fillRect(-5, -20, 10, 3);
    }

    ctx.restore();
  }

  function drawPickup(item) {
    const pulse = Math.sin(item.phase) * 2;
    const color = item.type === "salvage" ? "#f5d48b" : "#75e5d2";

    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.PI / 4);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(-11 - pulse, -11 - pulse, 22 + pulse * 2, 22 + pulse * 2);
    ctx.globalAlpha = 1;
    ctx.fillRect(-6, -6, 12, 12);

    ctx.fillStyle = "#fff";
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#070d17";
    ctx.fillRect(0, 0, W, H);

    // Subtle space-grid background.
    ctx.strokeStyle = "rgba(110,160,190,0.07)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (let y = 0; y <= H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    for (const star of stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = "#c6e7ff";
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    for (const item of pickups) drawPickup(item);
    for (const enemy of enemies) drawEnemy(enemy);

    ctx.fillStyle = "#75e5d2";
    for (const shot of shots) {
      ctx.fillRect(shot.x - 2, shot.y - 9, 4, 13);
    }

    ctx.fillStyle = "#ff9eab";
    for (const shot of enemyShots) {
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    drawShip();

    // Compact in-arena sector marker.
    ctx.fillStyle = "rgba(5,10,19,0.7)";
    ctx.fillRect(14, 14, 185, 31);
    ctx.fillStyle = "#75e5d2";
    ctx.font = "12px monospace";
    ctx.fillText(`SECTOR ${String(campaign.current + 1).padStart(2, "0")}`, 25, 34);
  }

  function loop(now) {
    if (!running) return;

    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    update(dt);
    draw();

    if (running) frameId = requestAnimationFrame(loop);
  }

  document.addEventListener("keydown", event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(key)) {
      event.preventDefault();
    }

    if (key === " " && event.repeat) return;
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

  document.querySelectorAll("[data-vf-key]").forEach(button => {
    const direction = button.dataset.vfKey;

    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      touch.add(direction);
    });

    const release = () => touch.delete(direction);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  const fireButton = $("vf-touch-fire");

  fireButton.addEventListener("pointerdown", event => {
    event.preventDefault();
    fireButton.setPointerCapture?.(event.pointerId);
    touch.add("fire");
  });

  const releaseFire = () => touch.delete("fire");
  fireButton.addEventListener("pointerup", releaseFire);
  fireButton.addEventListener("pointercancel", releaseFire);
  fireButton.addEventListener("lostpointercapture", releaseFire);

  document.querySelectorAll("[data-upgrade]").forEach(button => {
    button.addEventListener("click", () => {
      const type = button.dataset.upgrade;
      const level = campaign.upgrades[type];

      if (level >= 5) {
        showToast("SYSTEM ALREADY AT MAXIMUM LEVEL");
        return;
      }

      const cost = upgradeCost(type);
      if (campaign.salvage < cost) {
        showToast("NOT ENOUGH SALVAGE");
        return;
      }

      campaign.salvage -= cost;
      campaign.upgrades[type]++;
      playSound("upgrade");

      if (type === "shield") shield = maxShield();

      persist();
      updateHUD();
      showToast(`${type.toUpperCase()} UPGRADED TO LEVEL ${level + 1}`);
      draw();
    });
  });

  $("vf-reset").addEventListener("click", () => {
    $("vf-reset-dialog").showModal();
  });

  $("vf-reset-dialog").addEventListener("close", () => {
    if ($("vf-reset-dialog").returnValue !== "reset") return;

    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // The campaign resets in memory even if storage is unavailable.
    }

    campaign = structuredClone(DEFAULT_SAVE);
    prepareBriefing();
    showToast("CAMPAIGN RESET");
  });

  // Initial game screen.
  updateHUD();
  updateSidebar();
  prepareBriefing();
})();


"use strict";

const GAMES = [
  {
    id: "void-runner",
    title: "VOID RUNNER",
    category: "arcade",
    categoryLabel: "Arcade",
    description: "A fast-paced browser arcade challenge. Test your reflexes and chase a new high score.",
    keywords: "runner reflex endless action high score",
    status: "live",
    symbol: "V",
    href: "games/arcade/void-runner/index.html"
  },
  {
    id: "last-white-heir",
    title: "THE LAST WHITE HEIR",
    category: "novel",
    categoryLabel: "Novel-Based",
    description: "Enter a fantasy world of royal intrigue, hidden powers, and a kingdom's uncertain future.",
    keywords: "novel fantasy royal king magic political intrigue",
    status: "planned",
    symbol: "♜",
    href: null
  },
  {
    id: "uncharted-realms",
    title: "UNCHARTED REALMS",
    category: "fantasy",
    categoryLabel: "Fantasy-Based",
    description: "A planned fantasy adventure filled with unexplored lands, mysterious powers, and discoveries.",
    keywords: "rpg exploration magic adventure world",
    status: "planned",
    symbol: "✧",
    href: null
  },
  {
    id: "throne-territory",
    title: "THRONE & TERRITORY",
    category: "fantasy",
    categoryLabel: "fantasy-Based",
    description: "A future kingdom-management concept focused on territory, resources, and decisions.",
    keywords: "kingdom strategy empire castle resources",
    status: "planned",
    symbol: "♛",
    href: null
  },
  {
    id: "starbound-flight",
    title: "STARBOUND FLIGHT",
    category: "arcade",
    categoryLabel: "Arcade",
    description: "A planned space-flight experience among distant stars and unfamiliar systems.",
    keywords: "space spaceship flight galaxy science fiction",
    status: "planned",
    symbol: "✦",
    href: null
  },
  {
    id: "frontier-zero",
    title: "FRONTIER ZERO",
    category: "fantasy",
    categoryLabel: "Fantasy-Based",
    description: "An experimental 3D exploration concept set in a world waiting to be discovered.",
    keywords: "3d exploration frontier experimental world",
    status: "planned",
    symbol: "◇",
    href: null
  },
  
{
  id: "asteroid-breaker",
  title: "ASTEROID BREAKER",
  category: "arcade",
  categoryLabel: "Arcade",
  description: "Pilot your spaceship, destroy asteroids, and survive increasingly difficult waves.",
  keywords: "space shooter spaceship pixel retro arcade asteroids action",
  status: "live",
  symbol: "✦",
  href: "games/arcade/asteroid-breaker/index.html"
},
  
{
  id: "starbound-flight",
  title: "STARBOUND FLIGHT",
  category: "arcade",
  categoryLabel: "Arcade",
  description: "Pilot through the stars, dodge space debris, and collect energy in an endless space flight.",
  keywords: "space flight spaceship stars dodging energy retro arcade",
  status: "live",
  symbol: "✦",
  href: "games/arcade/starbound-flight/index.html"
},
  
{
  id: "void-frontier",
  title: "VOID FRONTIER",
  category: "arcade",
  categoryLabel: "Arcade",
  description: "Explore hostile sectors, fight enemy drones, collect salvage, upgrade your ship, and expand your frontier.",
  keywords: "space exploration combat survival ship upgrades missions sci-fi progression",
  status: "live",
  symbol: "◇",
  href: "games/arcade/void-frontier/index.html"
},
{
  id: "void-drive",
  title: "VOID DRIVE",
  category: "arcade",
  categoryLabel: "Arcade",
  description: "A high-speed top-down driving challenge with 25 levels and an endless procedural road.",
  keywords: "car driving racing road arcade endless levels",
  status: "live",
  symbol: "▰",
  href: "games/arcade/void-drive/index.html"
},
{
    id: "void-escape",
    title: "VOID ESCAPE",
    category: "arcade",
    categoryLabel: "Arcade",
    description: "Escape through the deep void, dodge asteroids, collect coins, and upgrade your ship while an enemy pursues you.",
    keywords: "space chase runner spaceship asteroids coins upgrades endless arcade",
    status: "live",
    symbol: "E",
    href: "games/arcade/void-escape/index.html"
},
{
    id: "void-spaceflight",
    title: "VOID SPACEFLIGHT",
    category: "simulation",
    categoryLabel: "Simulation",
    description: "Launch different rockets from Earth, travel across the solar system, and attempt dangerous landings on the Moon, Mars, Phobos, Deimos, Venus, and Mercury.",
    keywords: "space simulator rocket launch planets moon mars phobos deimos venus mercury landing",
    status: "live",
    symbol: "S",
    href: "games/simulation/void-spaceflight/index.html"
},

{
    id: "void-chess",
    title: "VOID CHESS",
    category: "arcade",
    categoryLabel: "Arcade",
    description: "Challenge a computer opponent or a friend in tactical chess. Features legal moves, neon visuals, and synthesized sound effects.",
    keywords: "void chess strategy board game computer friend multiplayer",
    status: "live",
    symbol: "♟",
    href: "games/arcade/void-chess/index.html"
},




];

const STORAGE_KEYS = {
  plays: "voidArcadePlayCounts",
  recent: "voidArcadeRecentGames"
};

let activeCategory = "all";
let searchTerm = "";

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The site remains usable if browser storage is unavailable.
  }
}

function getGame(id) {
  return GAMES.find(game => game.id === id);
}

function gameCard(game, compact = false) {
  const plays = readStorage(STORAGE_KEYS.plays, {});
  const count = Number(plays[game.id]) || 0;
  const isLive = game.status === "live";
  const artClass = `${game.category}-art`;

  const content = `
    <div class="game-art ${artClass}">
      <span class="art-symbol">${game.symbol}</span>
    </div>
    <div class="game-card-content">
      <div class="game-card-top">
        <span class="game-category">${game.categoryLabel}</span>
        <span class="game-status ${isLive ? "" : "planned"}">
          ${isLive ? "● PLAYABLE" : "COMING LATER"}
        </span>
      </div>
      <h3>${game.title}</h3>
      <p>${game.description}</p>
      <div class="game-card-bottom">
        <span>${count} ${count === 1 ? "play" : "plays"}</span>
        <span class="game-open">${isLive ? "Play now ↗" : "In development"}</span>
      </div>
    </div>
  `;

  if (isLive && game.href) {
    return `
      <a
        class="game-card game-card-link ${compact ? "compact-card" : ""}"
        href="${game.href}"
        data-game-id="${game.id}"
      >${content}</a>
    `;
  }

  return `
    <article class="game-card game-card-unavailable ${compact ? "compact-card" : ""}">
      ${content}
    </article>
  `;
}

function matchesSearch(game) {
  const haystack = [
    game.title,
    game.categoryLabel,
    game.category,
    game.description,
    game.keywords
  ].join(" ").toLowerCase();

  const matchesTerm = haystack.includes(searchTerm);
  const matchesCategory =
    activeCategory === "all" || game.category === activeCategory;

  return matchesTerm && matchesCategory;
}

function renderLibrary() {
  const grid = document.getElementById("game-grid");
  if (!grid) return;

  const visibleGames = GAMES.filter(matchesSearch);
  grid.innerHTML = visibleGames.map(game => gameCard(game)).join("");

  const count = document.getElementById("game-count");
  if (count) {
    count.textContent =
      `${visibleGames.length} ${visibleGames.length === 1 ? "game" : "games"}`;
  }

  const emptyMessage = document.getElementById("no-results");
  if (emptyMessage) {
    emptyMessage.hidden = visibleGames.length !== 0;
  }
}

function renderRecentGames() {
  const container = document.getElementById("recent-games");
  if (!container) return;

  const recent = readStorage(STORAGE_KEYS.recent, []);
  const games = recent
    .map(id => getGame(id))
    .filter(game => game && game.status === "live" && game.href)
    .slice(0, 3);

  container.innerHTML = games.length
    ? games.map(game => gameCard(game, true)).join("")
    : `<p class="empty-note">Your recently played games will appear here after you open a game.</p>`;
}

function renderPopularGames() {
  const container = document.getElementById("popular-games");
  if (!container) return;

  const plays = readStorage(STORAGE_KEYS.plays, {});

  const playable = GAMES.filter(game => game.status === "live" && game.href);

  const sorted = [...playable].sort((a, b) => {
    const difference = (Number(plays[b.id]) || 0) -
                       (Number(plays[a.id]) || 0);
    return difference || a.title.localeCompare(b.title);
  });

  container.innerHTML = sorted.length
    ? sorted.slice(0, 3).map(game => gameCard(game, true)).join("")
    : `<p class="empty-note">Playable games will appear here.</p>`;
}

function recordGameOpen(id) {
  const game = getGame(id);
  if (!game || game.status !== "live") return;

  const plays = readStorage(STORAGE_KEYS.plays, {});
  plays[id] = (Number(plays[id]) || 0) + 1;
  writeStorage(STORAGE_KEYS.plays, plays);

  const recent = readStorage(STORAGE_KEYS.recent, []);
  const updatedRecent = [
    id,
    ...recent.filter(recentId => recentId !== id)
  ].slice(0, 10);

  writeStorage(STORAGE_KEYS.recent, updatedRecent);
}

function initialiseHome() {
  const search = document.getElementById("game-search");
  const searchForm = document.getElementById("game-search-form");

  if (search) {
    search.addEventListener("input", () => {
      searchTerm = search.value.trim().toLowerCase();
      renderLibrary();
    });
  }

  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      event.preventDefault();
      searchTerm = search ? search.value.trim().toLowerCase() : "";
      renderLibrary();
      document.getElementById("game-grid")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.filter;

      document.querySelectorAll("[data-filter]").forEach(item => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });

      renderLibrary();
    });
  });

  document.querySelectorAll("[data-jump-category]").forEach(link => {
    link.addEventListener("click", () => {
      const category = link.dataset.jumpCategory;

      // Reset search so the chosen category is easy to browse.
      searchTerm = "";
      if (search) search.value = "";

      activeCategory = category;

      document.querySelectorAll("[data-filter]").forEach(button => {
        const selected = button.dataset.filter === category;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });

      renderLibrary();
    });
  });

  document.addEventListener("click", event => {
    const link = event.target.closest("[data-game-id]");
    if (!link) return;

    recordGameOpen(link.dataset.gameId);
  });

  const year = document.getElementById("footer-year");
  if (year) year.textContent = new Date().getFullYear();

  renderLibrary();
  renderRecentGames();
  renderPopularGames();
}

document.addEventListener("DOMContentLoaded", initialiseHome);

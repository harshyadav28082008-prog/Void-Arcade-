
"use strict";

/* =========================================
   VOID CHESS — Game Engine
   ========================================= */

const $ = (id) => document.getElementById(id);

const boardElement = $("chessboard");
const moveHistoryElement = $("move-history");
console.log("Chess library:", typeof Chess);
console.log("Chessboard element:", boardElement);

const PIECES = {
    wk: "♔", wq: "♕", wr: "♖",
    wb: "♗", wn: "♘", wp: "♙",
    bk: "♚", bq: "♛", br: "♜",
    bb: "♝", bn: "♞", bp: "♟"
};

const PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 335,
    r: 500,
    q: 900,
    k: 20000
};

let chess = null;
let selectedSquare = null;
let legalTargets = [];
let flipped = false;
let soundEnabled = true;
let audioContext = null;
let aiThinking = false;
let gameMode = "computer";
let humanColor = "w";
let difficulty = "easy";
let aiTimer = null;

const files = "abcdefgh";
const ranks = "87654321";

/* =========================================
   AUDIO — Synthesized sound effects
   ========================================= */

function initAudio() {
    if (!soundEnabled) return;

    const AudioEngine =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioEngine) return;

    if (!audioContext) {
        audioContext = new AudioEngine();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
    }
}

function tone(frequency, duration, type, volume, delay = 0) {
    if (!soundEnabled || !audioContext) return;

    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type || "sine";
    oscillator.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(
        Math.max(volume, 0.002),
        start + 0.015
    );
    gain.gain.exponentialRampToValueAtTime(
        0.001,
        start + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
}

function playSound(type) {
    if (!soundEnabled) return;

    initAudio();
    if (!audioContext) return;

    switch (type) {
        case "select":
            tone(540, 0.055, "sine", 0.035);
            break;

        case "move":
            tone(290, 0.075, "triangle", 0.07);
            tone(420, 0.055, "sine", 0.035, 0.045);
            break;

        case "capture":
            tone(180, 0.12, "triangle", 0.10);
            tone(100, 0.16, "sine", 0.06, 0.045);
            break;

        case "check":
            tone(720, 0.12, "triangle", 0.07);
            tone(920, 0.15, "sine", 0.07, 0.13);
            break;

        case "castle":
            tone(330, 0.08, "triangle", 0.07);
            tone(450, 0.08, "triangle", 0.07, 0.08);
            break;

        case "promote":
            tone(500, 0.13, "sine", 0.07);
            tone(700, 0.13, "sine", 0.07, 0.12);
            tone(950, 0.2, "sine", 0.07, 0.24);
            break;

        case "win":
            tone(523, 0.22, "triangle", 0.08);
            tone(659, 0.22, "triangle", 0.08, 0.18);
            tone(784, 0.35, "sine", 0.08, 0.36);
            break;

        case "draw":
            tone(440, 0.22, "triangle", 0.07);
            tone(370, 0.3, "triangle", 0.07, 0.22);
            break;

        case "undo":
            tone(400, 0.07, "sine", 0.045);
            tone(280, 0.09, "sine", 0.045, 0.07);
            break;
    }
}

$("sound-button").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    $("sound-button").textContent = soundEnabled ? "🔊" : "🔇";
    $("sound-button").setAttribute(
        "aria-label",
        soundEnabled ? "Mute sound" : "Enable sound"
    );

    if (soundEnabled) {
        initAudio();
        playSound("select");
    }
});

/* =========================================
   MENU
   ========================================= */

$("mode-select").addEventListener("change", () => {
    $("computer-options").hidden =
        $("mode-select").value !== "computer";
});

$("start-button").addEventListener("click", startGame);
$("new-game-button").addEventListener("click", startGame);

$("flip-button").addEventListener("click", () => {
    flipped = !flipped;
    renderBoard();
    playSound("select");
});

$("undo-button").addEventListener("click", undoMove);

function startGame() {
    initAudio();

    if (typeof Chess === "undefined") {
        alert(
            "The chess rules library did not load. " +
            "Connect to the internet, refresh the page, and try again."
        );
        return;
    }

    clearTimeout(aiTimer);

    chess = new Chess();
    selectedSquare = null;
    legalTargets = [];
    flipped = false;
    aiThinking = false;

    gameMode = $("mode-select").value;
    humanColor = $("color-select").value;
    difficulty = $("difficulty-select").value;

    $("setup-panel").hidden = true;
    $("game-panel").hidden = false;

    if (gameMode === "computer") {
        $("player-name").textContent =
            humanColor === "w" ? "WHITE" : "BLACK";
        $("opponent-name").textContent =
            humanColor === "w" ? "BLACK" : "WHITE";

        $("player-label").textContent = "YOU";
        $("opponent-label").textContent = "COMPUTER";

        flipped = humanColor === "b";
    } else {
        $("player-name").textContent = "WHITE";
        $("opponent-name").textContent = "BLACK";

        $("player-label").textContent = "PLAYER 1";
        $("opponent-label").textContent = "PLAYER 2";
    }

    try {
    renderBoard();

    console.log(
        "Squares created:",
        boardElement.children.length
    );

    if (boardElement.children.length !== 64) {
        alert(
            "Board error: Only " +
            boardElement.children.length +
            " squares were created."
        );
    }
} catch (error) {
    console.error("VOID CHESS board error:", error);

    alert(
        "Board error: " + error.message +
        "\nPlease tell me this error."
    );
}

updateInterface();
playSound("select");

    if (gameMode === "computer" && humanColor === "b") {
        scheduleComputerMove();
    }
}

/* =========================================
   CHESSBOARD RENDERING
   ========================================= */

function renderBoard() {
  console.log("Rendering chessboard");
console.log("Board element:", boardElement);
console.log("Chess instance:", chess);
    if (!chess) return;

    boardElement.innerHTML = "";

    const board = chess.board();

    for (let visualRow = 0; visualRow < 8; visualRow++) {
        for (let visualCol = 0; visualCol < 8; visualCol++) {
            const row = flipped ? 7 - visualRow : visualRow;
            const col = flipped ? 7 - visualCol : visualCol;

            const squareName = files[col] + (8 - row);
            const piece = board[row][col];

            const square = document.createElement("button");
            square.type = "button";
            square.className = "square";

            const isLight = (row + col) % 2 === 0;
            square.classList.add(isLight ? "light" : "dark");

            square.dataset.square = squareName;
            square.setAttribute(
                "aria-label",
                squareName + (piece
                    ? ", " + pieceName(piece)
                    : ", empty")
            );

            if (selectedSquare === squareName) {
                square.classList.add("selected");
            }

            const lastMove = chess.history({ verbose: true }).slice(-1)[0];

            if (lastMove &&
                (lastMove.from === squareName ||
                 lastMove.to === squareName)) {
                square.classList.add("last-move");
            }

            if (legalTargets.some(move => move.to === squareName)) {
                const capture = legalTargets.some(
                    move => move.to === squareName &&
                        (move.captured || move.flags.includes("e"))
                );

                square.classList.add(capture ? "capture" : "legal");
            }

            if (
                piece &&
                piece.type === "k" &&
                piece.color === chess.turn() &&
                chess.in_check()
            ) {
                square.classList.add("in-check");
            }

            if (piece) {
                const span = document.createElement("span");
                span.className =
                    "piece " +
                    (piece.color === "w"
                        ? "white-piece"
                        : "black-piece");

                span.textContent =
                    PIECES[piece.color + piece.type];

                square.appendChild(span);
            }

            if (visualCol === 0) {
                const rankLabel = document.createElement("span");
                rankLabel.className = "coord";
                rankLabel.textContent = 8 - row;
                square.appendChild(rankLabel);
            }

            if (visualRow === 7) {
                const fileLabel = document.createElement("span");
                fileLabel.className = "coord";
                fileLabel.style.left = "auto";
                fileLabel.style.right = "3px";
                fileLabel.style.top = "auto";
                fileLabel.style.bottom = "2px";
                fileLabel.textContent = files[col];
                square.appendChild(fileLabel);
            }

            square.addEventListener("click", () => {
                handleSquareClick(squareName);
            });

            boardElement.appendChild(square);
        }
    }
}

function pieceName(piece) {
    const names = {
        p: "pawn",
        n: "knight",
        b: "bishop",
        r: "rook",
        q: "queen",
        k: "king"
    };

    return (piece.color === "w" ? "White " : "Black ") +
        names[piece.type];
}

/* =========================================
   PLAYER INPUT
   ========================================= */

function handleSquareClick(square) {
    if (!chess || chess.game_over() || aiThinking) return;

    if (
        gameMode === "computer" &&
        chess.turn() !== humanColor
    ) {
        return;
    }

    const piece = chess.get(square);

    if (selectedSquare) {
        const possible = legalTargets.filter(
            move => move.to === square
        );

        if (possible.length > 0) {
            makePlayerMove(selectedSquare, square);
            return;
        }
    }

    if (piece && piece.color === chess.turn()) {
        selectedSquare = square;
        legalTargets = chess.moves({
            square: square,
            verbose: true
        });

        playSound("select");
        renderBoard();
        return;
    }

    selectedSquare = null;
    legalTargets = [];
    renderBoard();
}

function makePlayerMove(from, to) {
    const options = chess.moves({
        square: from,
        verbose: true
    }).filter(move => move.to === to);

    if (!options.length) return;

    let promotion = "q";

    if (options.some(move => move.promotion)) {
        const answer = prompt(
            "Promote pawn to: Q = Queen, R = Rook, B = Bishop, N = Knight",
            "q"
        );

        const choice = (answer || "q").toLowerCase();

        promotion = ["q", "r", "b", "n"].includes(choice)
            ? choice
            : "q";
    }

    const move = chess.move({
        from: from,
        to: to,
        promotion: promotion
    });

    selectedSquare = null;
    legalTargets = [];

    if (!move) {
        renderBoard();
        return;
    }

    afterMove(move);

    if (
        gameMode === "computer" &&
        !chess.game_over() &&
        chess.turn() !== humanColor
    ) {
        scheduleComputerMove();
    }
}

/* =========================================
   MOVE RESULTS AND STATUS
   ========================================= */

function afterMove(move) {
    if (move.flags.includes("k") || move.flags.includes("q")) {
        playSound("castle");
    } else if (move.promotion) {
        playSound("promote");
    } else if (move.captured) {
        playSound("capture");
    } else {
        playSound("move");
    }

    if (!chess.game_over() && chess.in_check()) {
        playSound("check");
    }

    renderBoard();
    updateInterface();
}

function updateInterface() {
    if (!chess) return;

    updateMoveHistory();
    updateCapturedPieces();

    const status = $("game-status");
    const detail = $("status-detail");
    const light = $("status-light");

    light.classList.remove("warning");

    if (chess.in_checkmate()) {
        status.textContent = "CHECKMATE";
        detail.textContent =
            (chess.turn() === "w" ? "Black" : "White") +
            " wins the match.";
        light.classList.add("warning");
        playSound("win");
        return;
    }

    if (chess.in_stalemate()) {
        status.textContent = "STALEMATE";
        detail.textContent = "The game ends in a draw.";
        playSound("draw");
        return;
    }

    if (chess.in_draw()) {
        status.textContent = "DRAW";
        detail.textContent =
            "Draw by repetition, material, or move rule.";
        playSound("draw");
        return;
    }

    if (chess.in_check()) {
        status.textContent = "KING IN CHECK";
        detail.textContent = "Your king must be protected.";
        light.classList.add("warning");
    } else {
        status.textContent = "SYSTEM ACTIVE";
        detail.textContent = "Legal moves only. Plan ahead.";
    }

    if (aiThinking) {
        detail.textContent = "Computer is calculating...";
        return;
    }

    const turnName = chess.turn() === "w" ? "White" : "Black";

    if (gameMode === "computer") {
        detail.textContent =
            chess.turn() === humanColor
                ? "Your turn — " + turnName + " to move."
                : "Computer's turn — " + turnName + " to move.";
    } else {
        detail.textContent = turnName + " to move.";
    }
}

function updateMoveHistory() {
    const history = chess.history();

    if (!history.length) {
        moveHistoryElement.innerHTML =
            '<p class="muted">Moves will appear here.</p>';
        return;
    }

    moveHistoryElement.innerHTML = "";

    for (let i = 0; i < history.length; i += 2) {
        const row = document.createElement("div");
        row.className = "move-row";

        const number = document.createElement("span");
        number.className = "move-number";
        number.textContent = (Math.floor(i / 2) + 1) + ".";

        const white = document.createElement("span");
        white.className = "move-san";
        white.textContent = history[i];

        const black = document.createElement("span");
        black.className = "move-san";
        black.textContent = history[i + 1] || "";

        row.append(number, white, black);
        moveHistoryElement.appendChild(row);
    }

    moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
}

function updateCapturedPieces() {
    const history = chess.history({ verbose: true });

    const capturedByWhite = [];
    const capturedByBlack = [];

    history.forEach(move => {
        if (!move.captured) return;

        const capturedSymbol =
            PIECES[(move.color === "w" ? "b" : "w") + move.captured];

        if (move.color === "w") {
            capturedByWhite.push(capturedSymbol);
        } else {
            capturedByBlack.push(capturedSymbol);
        }
    });

    $("player-captured").textContent =
        capturedByWhite.join(" ");

    $("opponent-captured").textContent =
        capturedByBlack.join(" ");
}

/* =========================================
   COMPUTER OPPONENT
   ========================================= */

function scheduleComputerMove() {
    if (chess.game_over()) return;

    aiThinking = true;
    updateInterface();

    aiTimer = setTimeout(() => {
        if (!chess || chess.game_over()) {
            aiThinking = false;
            return;
        }

        const move = chooseComputerMove();

        if (move) {
            const played = chess.move({
                from: move.from,
                to: move.to,
                promotion: move.promotion || "q"
            });

            if (played) afterMove(played);
        }

        aiThinking = false;
        renderBoard();
        updateInterface();
    }, 350);
}

function chooseComputerMove() {
    const moves = chess.moves({ verbose: true });

    if (!moves.length) return null;

    if (difficulty === "easy") {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    const depth = difficulty === "medium" ? 2 : 3;
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of shuffle(moves)) {
        chess.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion || "q"
        });

        const score = -minimax(depth - 1, -Infinity, Infinity);

        chess.undo();

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }

    return bestMoves[
        Math.floor(Math.random() * bestMoves.length)
    ];
}

function minimax(depth, alpha, beta) {
    if (chess.in_checkmate()) return -100000 - depth;
    if (chess.in_draw() || chess.in_stalemate()) return 0;

    if (depth <= 0) return evaluatePosition();

    const moves = shuffle(chess.moves({ verbose: true }));

    let bestScore = -Infinity;

    for (const move of moves) {
        chess.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion || "q"
        });

        const score = -minimax(depth - 1, -beta, -alpha);

        chess.undo();

        bestScore = Math.max(bestScore, score);
        alpha = Math.max(alpha, score);

        if (alpha >= beta) break;
    }

    return bestScore;
}

function evaluatePosition() {
    const board = chess.board();
    let score = 0;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            let value = PIECE_VALUES[piece.type];

            // Mild central-square preference.
            const centerDistance =
                Math.abs(3.5 - col) + Math.abs(3.5 - row);

            if (piece.type !== "k") {
                value += Math.round((7 - centerDistance) * 3);
            }

            score += piece.color === chess.turn()
                ? value
                : -value;
        }
    }

    return score;
}

function shuffle(array) {
    const result = array.slice();

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

/* =========================================
   UNDO
   ========================================= */

function undoMove() {
    if (!chess || aiThinking) return;

    clearTimeout(aiTimer);

    const firstUndo = chess.undo();

    if (!firstUndo) return;

    if (gameMode === "computer" && chess.history().length > 0) {
        if (chess.turn() !== humanColor) {
            chess.undo();
        }
    }

    selectedSquare = null;
    legalTargets = [];

    playSound("undo");
    renderBoard();
    updateInterface();
}

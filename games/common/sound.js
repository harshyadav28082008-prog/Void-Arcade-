
let audioContext = null;
let engineOscillator = null;
let engineGain = null;
let engineFilter = null;

function initAudio() {
    if (audioContext) {
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
        return;
    }

    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;

    audioContext = new AudioEngine();

    engineOscillator = audioContext.createOscillator();
    engineFilter = audioContext.createBiquadFilter();
    engineGain = audioContext.createGain();

    engineOscillator.type = "sawtooth";
    engineOscillator.frequency.value = 55;

    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 180;

    engineGain.gain.value = 0;

    engineOscillator.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audioContext.destination);
    engineOscillator.start();
}

function playTone(frequency, duration, type = "sine", volume = 0.12) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
}

function playSound(type) {
    initAudio();
    if (!audioContext) return;

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    switch (type) {
        case "click":
            playTone(650, 0.07, "sine", 0.07);
            break;

        case "launch":
            playTone(75, 0.7, "sawtooth", 0.16);
            setTimeout(() => playTone(110, 0.5, "sawtooth", 0.10), 180);
            break;

        case "orbit":
            playTone(440, 0.18, "triangle");
            setTimeout(() => playTone(660, 0.25, "triangle"), 150);
            setTimeout(() => playTone(880, 0.35, "sine"), 300);
            break;

        case "arrival":
            playTone(520, 0.18, "sine");
            setTimeout(() => playTone(390, 0.25, "sine"), 180);
            break;

        case "collect":
            playTone(520, 0.18, "triangle");
            setTimeout(() => playTone(780, 0.25, "triangle"), 170);
            setTimeout(() => playTone(1040, 0.35, "sine"), 340);
            break;

        case "gameOver":
            playTone(240, 0.35, "triangle");
            setTimeout(() => playTone(160, 0.55, "triangle"), 300);
            setTimeout(() => playTone(90, 0.75, "sine"), 650);
            break;
    }
}

function updateEngineSound() {
    if (!audioContext || !engineGain || !engineOscillator) return;

    const flyingWithEngine =
        !state.paused &&
        state.fuel > 0 &&
        state.throttle > 0 &&
        (state.phase === "ascent" ||
         state.phase === "approach" ||
         state.phase === "landing");

    const throttle = state.throttle / 100;
    const targetVolume = flyingWithEngine
        ? 0.025 + throttle * 0.12
        : 0;

    engineGain.gain.setTargetAtTime(
        targetVolume,
        audioContext.currentTime,
        0.12
    );

    engineOscillator.frequency.setTargetAtTime(
        45 + throttle * 90,
        audioContext.currentTime,
        0.1
    );

    engineFilter.frequency.setTargetAtTime(
        100 + throttle * 450,
        audioContext.currentTime,
        0.1
    );
}

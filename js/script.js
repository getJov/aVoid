const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const backgroundCanvas = document.getElementById("voidField");
const backgroundCtx = backgroundCanvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const statusOverlay = document.getElementById("statusOverlay");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const soundButton = document.getElementById("soundButton");
const avatarPreview = document.getElementById("avatarPreview");
const avatarUpload = document.getElementById("avatarUpload");
const avatarUrl = document.getElementById("avatarUrl");
const applyAvatarUrl = document.getElementById("applyAvatarUrl");
const resetAvatar = document.getElementById("resetAvatar");
const avatarMessage = document.getElementById("avatarMessage");
const defaultPlayerIcon = document.getElementById("defaultPlayerIcon");
const obstacleIcons = [
    document.getElementById("appCodm"),
    document.getElementById("appFacebook"),
    document.getElementById("appInstagram"),
    document.getElementById("appMobileLegends"),
    document.getElementById("appMessenger"),
    document.getElementById("appTiktok"),
    document.getElementById("appTelegram"),
    document.getElementById("appTwitterX"),
    document.getElementById("appYoutube"),
    document.getElementById("appChrome"),
];

const theme = {
    voidTop: "#030712",
    voidMid: "#07111c",
    voidBottom: "#0c0618",
    cyan: "#29e3ff",
    green: "#6dff9d",
    amber: "#f7c35f",
    danger: "#ff4f6d",
    panel: "#0b1017",
    line: "rgba(41, 227, 255, 0.34)",
};

const groundY = 248;
const playerSize = 52;
const maxDelta = 32;

let animationFrame = null;
let backgroundFrame = null;
let lastTime = 0;
let avatarObjectUrl = "";
let audioContext = null;
let ambienceGain = null;
let ambienceOscillators = [];

const audioState = {
    muted: localStorage.getItem("avoidMuted") === "true",
    ambienceRunning: false,
};

const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
};

const state = {
    running: false,
    gameOver: false,
    score: 0,
    best: Number(localStorage.getItem("avoidBestScore")) || 0,
    speed: 330,
    spawnTimer: 0,
    nextSpawn: 900,
    obstacles: [],
    player: {
        x: 96,
        y: groundY - playerSize,
        vy: 0,
        width: playerSize,
        height: playerSize,
        grounded: true,
        image: defaultPlayerIcon,
    },
};

bestValue.textContent = String(state.best);
syncSoundButton();

function createAudioContext() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;

        audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
}

function syncSoundButton() {
    soundButton.textContent = audioState.muted ? "Sound Off" : "Sound On";
    soundButton.setAttribute("aria-pressed", String(!audioState.muted));
}

function setMuted(muted) {
    audioState.muted = muted;
    localStorage.setItem("avoidMuted", String(muted));
    syncSoundButton();

    if (muted) {
        stopAmbience();
    } else if (state.running) {
        startAmbience();
    }
}

function startAmbience() {
    if (audioState.muted || audioState.ambienceRunning) return;

    const audio = createAudioContext();
    if (!audio) return;

    ambienceGain = audio.createGain();
    ambienceGain.gain.setValueAtTime(0.0001, audio.currentTime);
    ambienceGain.gain.exponentialRampToValueAtTime(0.035, audio.currentTime + 0.6);
    ambienceGain.connect(audio.destination);

    ambienceOscillators = [55, 82.5].map((frequency, index) => {
        const oscillator = audio.createOscillator();
        const filter = audio.createBiquadFilter();
        const gain = audio.createGain();

        oscillator.type = index === 0 ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(index === 0 ? 260 : 180, audio.currentTime);
        gain.gain.setValueAtTime(index === 0 ? 0.7 : 0.22, audio.currentTime);

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(ambienceGain);
        oscillator.start();

        return oscillator;
    });

    audioState.ambienceRunning = true;
}

function stopAmbience() {
    if (!audioState.ambienceRunning || !audioContext) return;

    const stopAt = audioContext.currentTime + 0.18;
    if (ambienceGain) {
        ambienceGain.gain.cancelScheduledValues(audioContext.currentTime);
        ambienceGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.06);
    }

    ambienceOscillators.forEach((oscillator) => {
        oscillator.stop(stopAt);
    });

    ambienceOscillators = [];
    ambienceGain = null;
    audioState.ambienceRunning = false;
}

function playTone({ frequency, endFrequency, duration, type, volume }) {
    if (audioState.muted) return;

    const audio = createAudioContext();
    if (!audio) return;

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
}

function playJumpSound() {
    playTone({
        frequency: 220,
        endFrequency: 680,
        duration: 0.16,
        type: "square",
        volume: 0.055,
    });
}

function playFailSound() {
    playTone({
        frequency: 180,
        endFrequency: 42,
        duration: 0.34,
        type: "sawtooth",
        volume: 0.075,
    });
}

function resetGame() {
    state.running = false;
    state.gameOver = false;
    state.score = 0;
    state.speed = 330;
    state.spawnTimer = 0;
    state.nextSpawn = 760;
    state.obstacles = [];
    state.player.y = groundY - state.player.height;
    state.player.vy = 0;
    state.player.grounded = true;
    updateScore();
    setOverlay("a-void.exe", "Press start, space, or tap to resist the void.", false);
    draw();
}

function startGame() {
    if (state.gameOver) resetGame();
    if (state.running) return;

    state.running = true;
    startAmbience();
    setOverlay("", "", true);
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(loop);
}

function restartGame() {
    cancelAnimationFrame(animationFrame);
    resetGame();
    startGame();
}

function loop(now) {
    const delta = Math.min(now - lastTime, maxDelta);
    lastTime = now;

    update(delta);
    draw();

    if (state.running) {
        animationFrame = requestAnimationFrame(loop);
    }
}

function update(delta) {
    const dt = delta / 1000;

    state.score += dt * 12;
    state.speed = Math.min(520, 330 + state.score * 1.8);
    updateScore();
    updatePlayer(dt);
    updateObstacles(delta, dt);
}

function updatePlayer(dt) {
    const gravity = 1780;
    state.player.vy += gravity * dt;
    state.player.y += state.player.vy * dt;

    const floor = groundY - state.player.height;
    if (state.player.y >= floor) {
        state.player.y = floor;
        state.player.vy = 0;
        state.player.grounded = true;
    }
}

function updateObstacles(delta, dt) {
    state.spawnTimer += delta;
    if (state.spawnTimer >= state.nextSpawn) {
        spawnObstacle();
        state.spawnTimer = 0;
        state.nextSpawn = 780 + Math.random() * 520;
    }

    state.obstacles.forEach((obstacle) => {
        obstacle.x -= state.speed * dt;
    });

    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);

    const playerBox = getPlayerBox();
    const hit = state.obstacles.some((obstacle) => intersects(playerBox, getObstacleBox(obstacle)));
    if (hit) endGame();
}

function spawnObstacle() {
    const image = obstacleIcons[Math.floor(Math.random() * obstacleIcons.length)];
    const size = 48 + Math.floor(Math.random() * 14);
    state.obstacles.push({
        x: canvas.width + 24,
        y: groundY - size,
        width: size,
        height: size,
        image,
    });
}

function jump() {
    if (!state.running) {
        startGame();
        playJumpSound();
        return;
    }

    if (!state.player.grounded || state.gameOver) return;

    state.player.vy = -720;
    state.player.grounded = false;
    playJumpSound();
}

function endGame() {
    state.running = false;
    state.gameOver = true;
    cancelAnimationFrame(animationFrame);
    stopAmbience();
    playFailSound();

    const finalScore = Math.floor(state.score);
    if (finalScore > state.best) {
        state.best = finalScore;
        localStorage.setItem("avoidBestScore", String(state.best));
        bestValue.textContent = String(state.best);
    }

    setOverlay("VOID CONTACT", "Restart or jump to resist again.", false);
}

function draw() {
    drawBackground();
    drawGround();
    drawObstacles();
    drawPlayer();
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, theme.voidTop);
    gradient.addColorStop(0.58, theme.voidMid);
    gradient.addColorStop(1, theme.voidBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pulse = Math.sin(state.score / 8) * 0.04 + 0.12;
    const voidGlow = ctx.createRadialGradient(650, 154, 30, 650, 154, 420);
    voidGlow.addColorStop(0, `rgba(139, 109, 255, ${pulse})`);
    voidGlow.addColorStop(0.48, "rgba(41, 227, 255, 0.08)");
    voidGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = voidGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.strokeStyle = "rgba(41, 227, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 45) {
        ctx.beginPath();
        ctx.moveTo(x, 42);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 52; y <= canvas.height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(109, 255, 157, 0.86)";
    ctx.font = "700 13px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.fillText("FOCUS SIGNAL", 22, 62);
    ctx.fillStyle = "rgba(247, 195, 95, 0.86)";
    ctx.fillText("DISTRACTION INBOUND", canvas.width - 186, 62);
}

function drawGround() {
    ctx.strokeStyle = theme.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 1);
    ctx.lineTo(canvas.width, groundY + 1);
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = "rgba(41, 227, 255, 0.18)";
    ctx.lineWidth = 1;
    for (let x = -120; x < canvas.width + 120; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, groundY + 1);
        ctx.lineTo(x + 78, canvas.height);
        ctx.stroke();
    }
    for (let y = groundY + 18; y < canvas.height; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawPlayer() {
    const { x, y, width, height, image } = state.player;
    ctx.save();
    ctx.shadowColor = "rgba(41, 227, 255, 0.6)";
    ctx.shadowBlur = 18;
    roundedImage(image, x, y, width, height, 12);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.green;
    ctx.lineWidth = 3;
    roundRect(x - 2, y - 2, width + 4, height + 4, 14);
    ctx.stroke();
    ctx.strokeStyle = "rgba(41, 227, 255, 0.32)";
    ctx.lineWidth = 1;
    roundRect(x - 7, y - 7, width + 14, height + 14, 18);
    ctx.stroke();
    ctx.restore();
}

function drawObstacles() {
    state.obstacles.forEach((obstacle) => {
        ctx.save();
        ctx.shadowColor = "rgba(255, 79, 109, 0.45)";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = "rgba(255, 79, 109, 0.72)";
        ctx.lineWidth = 2;
        roundRect(obstacle.x - 5, obstacle.y - 5, obstacle.width + 10, obstacle.height + 10, 14);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (obstacle.image.complete && obstacle.image.naturalWidth !== 0) {
            ctx.drawImage(obstacle.image, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        } else {
            ctx.fillStyle = theme.panel;
            roundRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 10);
            ctx.fill();
        }

        ctx.restore();
    });
}

function roundedImage(image, x, y, width, height, radius) {
    ctx.save();
    roundRect(x, y, width, height, radius);
    ctx.clip();

    if (image.complete && image.naturalWidth !== 0) {
        ctx.drawImage(image, x, y, width, height);
    } else {
        ctx.fillStyle = "#191d23";
        ctx.fillRect(x, y, width, height);
    }

    ctx.restore();
}

function roundRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function getPlayerBox() {
    return {
        x: state.player.x + 9,
        y: state.player.y + 9,
        width: state.player.width - 18,
        height: state.player.height - 16,
    };
}

function getObstacleBox(obstacle) {
    return {
        x: obstacle.x + 10,
        y: obstacle.y + 10,
        width: obstacle.width - 20,
        height: obstacle.height - 16,
    };
}

function intersects(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function resizeBackgroundCanvas() {
    const ratio = window.devicePixelRatio || 1;
    backgroundCanvas.width = Math.floor(window.innerWidth * ratio);
    backgroundCanvas.height = Math.floor(window.innerHeight * ratio);
    backgroundCanvas.style.width = `${window.innerWidth}px`;
    backgroundCanvas.style.height = `${window.innerHeight}px`;
    backgroundCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function bendPoint(x, y, strength = 1) {
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const distance = Math.hypot(dx, dy) || 1;
    const radius = 260;

    if (distance > radius) return { x, y };

    const falloff = (1 - distance / radius) ** 2;
    const pull = 72 * falloff * strength;
    const swirl = 34 * falloff * strength;
    const nx = dx / distance;
    const ny = dy / distance;

    return {
        x: x - nx * pull + -ny * swirl,
        y: y - ny * pull + nx * swirl,
    };
}

function drawBentLine(points, alpha) {
    backgroundCtx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) {
            backgroundCtx.moveTo(point.x, point.y);
        } else {
            backgroundCtx.lineTo(point.x, point.y);
        }
    });
    backgroundCtx.strokeStyle = `rgba(41, 227, 255, ${alpha})`;
    backgroundCtx.stroke();
}

function drawVoidField() {
    pointer.x += (pointer.targetX - pointer.x) * 0.14;
    pointer.y += (pointer.targetY - pointer.y) * 0.14;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const spacing = 42;
    const segment = 14;

    backgroundCtx.clearRect(0, 0, width, height);

    const baseGlow = backgroundCtx.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        420
    );
    baseGlow.addColorStop(0, "rgba(0, 0, 0, 0.78)");
    baseGlow.addColorStop(0.12, "rgba(1, 3, 8, 0.62)");
    baseGlow.addColorStop(0.34, "rgba(41, 227, 255, 0.07)");
    baseGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    backgroundCtx.fillStyle = baseGlow;
    backgroundCtx.fillRect(0, 0, width, height);

    backgroundCtx.lineWidth = 1;

    for (let y = -spacing; y <= height + spacing; y += spacing) {
        const points = [];
        for (let x = -spacing; x <= width + spacing; x += segment) {
            points.push(bendPoint(x, y, 1));
        }
        drawBentLine(points, 0.075);
    }

    for (let x = -spacing; x <= width + spacing; x += spacing) {
        const points = [];
        for (let y = -spacing; y <= height + spacing; y += segment) {
            points.push(bendPoint(x, y, 0.92));
        }
        drawBentLine(points, 0.068);
    }

    backgroundFrame = requestAnimationFrame(drawVoidField);
}

function updateScore() {
    scoreValue.textContent = String(Math.floor(state.score));
}

function setOverlay(title, text, hidden) {
    statusTitle.textContent = title;
    statusText.textContent = text;
    statusOverlay.classList.toggle("is-hidden", hidden);
}

function setAvatarMessage(text, type) {
    avatarMessage.textContent = text;
    avatarMessage.classList.toggle("is-error", type === "error");
    avatarMessage.classList.toggle("is-success", type === "success");
}

function useAvatarImage(src, successMessage) {
    const image = new Image();
    image.onload = () => {
        state.player.image = image;
        avatarPreview.src = src;
        setAvatarMessage(successMessage, "success");
        draw();
    };
    image.onerror = () => {
        useDefaultAvatar("Avatar could not load. Default icon active.", "error");
    };
    image.src = src;
}

function useDefaultAvatar(message = "Default icon active.", type = "") {
    state.player.image = defaultPlayerIcon;
    avatarPreview.src = defaultPlayerIcon.src;
    setAvatarMessage(message, type);
    draw();
}

function releaseAvatarObjectUrl() {
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = "";
}

avatarUpload.addEventListener("change", () => {
    const file = avatarUpload.files && avatarUpload.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        useDefaultAvatar("Choose an image file. Default icon active.", "error");
        return;
    }

    releaseAvatarObjectUrl();
    avatarObjectUrl = URL.createObjectURL(file);
    useAvatarImage(avatarObjectUrl, "Uploaded avatar active.");
});

applyAvatarUrl.addEventListener("click", () => {
    const value = avatarUrl.value.trim();
    if (!value) {
        useDefaultAvatar("No URL provided. Default icon active.", "");
        return;
    }

    releaseAvatarObjectUrl();
    useAvatarImage(value, "URL avatar active when the browser allows it.");
});

resetAvatar.addEventListener("click", () => {
    releaseAvatarObjectUrl();
    avatarUpload.value = "";
    avatarUrl.value = "";
    useDefaultAvatar();
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restartGame);
soundButton.addEventListener("click", () => {
    setMuted(!audioState.muted);
});
canvas.addEventListener("pointerdown", jump);

document.addEventListener("pointermove", (event) => {
    const pullX = event.clientX + (window.innerWidth / 2 - event.clientX) * 0.08;
    const pullY = event.clientY + (window.innerHeight / 2 - event.clientY) * 0.08;

    pointer.targetX = event.clientX;
    pointer.targetY = event.clientY;
    document.body.style.setProperty("--cursor-x", `${event.clientX}px`);
    document.body.style.setProperty("--cursor-y", `${event.clientY}px`);
    document.body.style.setProperty("--cursor-pull-x", `${pullX}px`);
    document.body.style.setProperty("--cursor-pull-y", `${pullY}px`);
});

window.addEventListener("resize", resizeBackgroundCanvas);

document.addEventListener("keydown", (event) => {
    const jumpKeys = ["Space", "ArrowUp", "KeyW"];
    if (!jumpKeys.includes(event.code)) return;

    event.preventDefault();
    jump();
});

window.addEventListener("load", () => {
    resizeBackgroundCanvas();
    cancelAnimationFrame(backgroundFrame);
    backgroundFrame = requestAnimationFrame(drawVoidField);
    resetGame();
});

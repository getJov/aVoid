const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const statusOverlay = document.getElementById("statusOverlay");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const avatarPreview = document.getElementById("avatarPreview");
const avatarUpload = document.getElementById("avatarUpload");
const avatarUrl = document.getElementById("avatarUrl");
const applyAvatarUrl = document.getElementById("applyAvatarUrl");
const resetAvatar = document.getElementById("resetAvatar");
const avatarMessage = document.getElementById("avatarMessage");
const defaultPlayerIcon = document.getElementById("defaultPlayerIcon");
const obstacleSheet = document.getElementById("obstacleSheet");

const groundY = 248;
const playerSize = 52;
const maxDelta = 32;
const obstacleFrames = [
    { sx: 0, sy: 0 },
    { sx: 96, sy: 0 },
    { sx: 192, sy: 0 },
    { sx: 288, sy: 0 },
    { sx: 384, sy: 0 },
    { sx: 480, sy: 0 },
];

let animationFrame = null;
let lastTime = 0;
let avatarObjectUrl = "";

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
    setOverlay("Ready", "Press start, space, or tap the board.", false);
    draw();
}

function startGame() {
    if (state.gameOver) resetGame();
    if (state.running) return;

    state.running = true;
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
    const frame = obstacleFrames[Math.floor(Math.random() * obstacleFrames.length)];
    const size = 48 + Math.floor(Math.random() * 14);
    state.obstacles.push({
        x: canvas.width + 24,
        y: groundY - size,
        width: size,
        height: size,
        frame,
    });
}

function jump() {
    if (!state.running) {
        startGame();
        return;
    }

    if (!state.player.grounded || state.gameOver) return;

    state.player.vy = -720;
    state.player.grounded = false;
}

function endGame() {
    state.running = false;
    state.gameOver = true;
    cancelAnimationFrame(animationFrame);

    const finalScore = Math.floor(state.score);
    if (finalScore > state.best) {
        state.best = finalScore;
        localStorage.setItem("avoidBestScore", String(state.best));
        bestValue.textContent = String(state.best);
    }

    setOverlay("Game Over", "Restart or jump to run again.", false);
}

function draw() {
    drawBackground();
    drawGround();
    drawObstacles();
    drawPlayer();
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#edf6fb");
    gradient.addColorStop(1, "#cfdce3");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(22, 196, 220, 0.18)";
    ctx.fillRect(0, 60, canvas.width, 3);
    ctx.fillStyle = "rgba(255, 190, 73, 0.18)";
    ctx.fillRect(0, 92, canvas.width, 2);
}

function drawGround() {
    ctx.strokeStyle = "#222832";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 1);
    ctx.lineTo(canvas.width, groundY + 1);
    ctx.stroke();

    ctx.fillStyle = "rgba(34, 40, 50, 0.16)";
    for (let x = -40; x < canvas.width; x += 42) {
        ctx.fillRect(x, groundY + 14, 24, 3);
    }
}

function drawPlayer() {
    const { x, y, width, height, image } = state.player;
    ctx.save();
    roundedImage(image, x, y, width, height, 12);
    ctx.strokeStyle = "#16c4dc";
    ctx.lineWidth = 3;
    roundRect(x - 2, y - 2, width + 4, height + 4, 14);
    ctx.stroke();
    ctx.restore();
}

function drawObstacles() {
    state.obstacles.forEach((obstacle) => {
        ctx.drawImage(
            obstacleSheet,
            obstacle.frame.sx,
            obstacle.frame.sy,
            96,
            96,
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height
        );
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
canvas.addEventListener("pointerdown", jump);

document.addEventListener("keydown", (event) => {
    const jumpKeys = ["Space", "ArrowUp", "KeyW"];
    if (!jumpKeys.includes(event.code)) return;

    event.preventDefault();
    jump();
});

window.addEventListener("load", resetGame);

const optionCountInput = document.getElementById("option-count");
const createOptionsBtn = document.getElementById("create-options");
const optionsList = document.getElementById("options-list");
const startBtn = document.getElementById("start-race");
const resetBtn = document.getElementById("reset-race");
const busLayer = document.getElementById("bus-layer");
const result = document.getElementById("result");

const BUS_COLORS = [
  "#f4b400",
  "#f57c00",
  "#e53935",
  "#43a047",
  "#1e88e5",
  "#8e24aa",
  "#00acc1",
  "#f06292",
  "#7cb342",
  "#5c6bc0",
];

const RACE_STATE = {
  idle: "idle",
  running: "running",
  finished: "finished",
};

let buses = [];
let raceState = RACE_STATE.idle;
let animationId = null;
const raceAudio = new Audio("carrera-de-buses.mp3");
raceAudio.preload = "auto";
raceAudio.volume = 0.9;
let raceStartTime = 0;
let raceDurationMs = 8000;
let winnerIndex = null;

function createOptionInputs(count) {
  optionsList.innerHTML = "";
  const safeCount = Math.max(2, Math.min(20, count));

  for (let i = 0; i < safeCount; i += 1) {
    const card = document.createElement("div");
    card.className = "option-card";

    const label = document.createElement("label");
    label.textContent = `Opción ${i + 1}`;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Nombre opción ${i + 1}`;
    input.value = `Opción ${i + 1}`;

    card.appendChild(label);
    card.appendChild(input);
    optionsList.appendChild(card);
  }
}

function buildBuses(options) {
  busLayer.innerHTML = "";
  buses = options.map((name, index) => {
    const bus = document.createElement("div");
    bus.className = "bus";
    bus.style.setProperty("--bus-color", BUS_COLORS[index % BUS_COLORS.length]);

    const body = document.createElement("div");
    body.className = "bus-body";

    const windows = document.createElement("div");
    windows.className = "bus-windows";
    for (let i = 0; i < 5; i += 1) {
      const window = document.createElement("span");
      windows.appendChild(window);
    }

    const nameEl = document.createElement("div");
    nameEl.className = "bus-name";
    nameEl.textContent = buildRepeatingName(name);

    body.appendChild(windows);
    body.appendChild(nameEl);

    const nose = document.createElement("div");
    nose.className = "bus-nose";

    const wheelBack = document.createElement("div");
    wheelBack.className = "bus-wheel back";

    const wheelFront = document.createElement("div");
    wheelFront.className = "bus-wheel front";

    bus.appendChild(body);
    bus.appendChild(nose);
    bus.appendChild(wheelBack);
    bus.appendChild(wheelFront);

    busLayer.appendChild(bus);

    return {
      name,
      element: bus,
      x: 0,
      y: 0,
      lane: index,
    };
  });
}

function buildRepeatingName(name) {
  const clean = name.trim() || "Opción";
  let text = clean;
  while (text.length < 26) {
    text += ` · ${clean}`;
  }
  return text.toUpperCase();
}

function getTrackMetrics() {
  const track = busLayer.getBoundingClientRect();
  const finishLine = document.querySelector(".finish-line").getBoundingClientRect();
  const busWidth = buses[0]?.element?.offsetWidth || 180;
  const startX = 90;
  const finishX = finishLine.left - track.left - busWidth - 10;

  return {
    trackHeight: track.height,
    startX,
    finishX: Math.max(startX + 120, finishX),
  };
}

function positionBusesByRank() {
  const { trackHeight } = getTrackMetrics();
  const laneCount = buses.length;
  const laneGap = trackHeight / (laneCount + 1);

  buses.forEach((bus) => {
    const targetY = laneGap * (bus.rank + 1) - 40;
    bus.y += (targetY - bus.y) * 0.15;
    bus.element.style.transform = `translate3d(${bus.x}px, ${bus.y}px, 0)`;
  });
}

function computeRanks() {
  const sorted = [...buses].sort((a, b) => b.x - a.x);
  sorted.forEach((bus, index) => {
    bus.rank = index;
  });
}

function raceStep() {
  if (raceState !== RACE_STATE.running) {
    return;
  }

  const now = performance.now();
  const progressTime = Math.min(Math.max((now - raceStartTime) / raceDurationMs, 0), 1);
  const { startX, finishX } = getTrackMetrics();

  buses.forEach((bus) => {
    const wobble =
      bus.wobbleAmp *
      Math.sin(2 * Math.PI * (bus.wobbleFreq * progressTime + bus.wobblePhase)) *
      (1 - progressTime);
    const surge =
      bus.surgeAmp *
      Math.exp(-Math.pow((progressTime - bus.surgeTime) / bus.surgeWidth, 2)) *
      (1 - progressTime);
    const progress = Math.min(
      Math.max(progressTime * bus.finalFactor + wobble + surge, 0),
      bus.finalFactor
    );
    bus.x = startX + (finishX - startX) * progress;
  });

  computeRanks();
  positionBusesByRank();

  if (progressTime >= 1) {
    raceState = RACE_STATE.finished;
    const winner = buses[winnerIndex] || buses[0];
    if (winner) {
      winner.x = finishX;
      result.textContent = `Ganador: ${winner.name}`;
    }
    cancelAnimationFrame(animationId);
    animationId = null;
    return;
  }

  animationId = requestAnimationFrame(raceStep);
}

function resetRace() {
  raceState = RACE_STATE.idle;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  stopRaceAudio();
  result.textContent = "Listo para comenzar.";
  const { startX } = getTrackMetrics();
  buses.forEach((bus, index) => {
    bus.x = startX;
    bus.rank = index;
  });
  positionBusesByRank();
}

function getOptions() {
  const inputs = Array.from(optionsList.querySelectorAll("input"));
  return inputs.map((input, index) => input.value.trim() || `Opción ${index + 1}`);
}

function stopRaceAudio() {
  raceAudio.pause();
  raceAudio.currentTime = 0;
}

function getRaceDuration() {
  return new Promise((resolve) => {
    if (Number.isFinite(raceAudio.duration) && raceAudio.duration > 0) {
      resolve(raceAudio.duration);
      return;
    }

    const handleLoaded = () => {
      cleanup();
      resolve(raceAudio.duration || 8);
    };

    const handleError = () => {
      cleanup();
      resolve(8);
    };

    const cleanup = () => {
      raceAudio.removeEventListener("loadedmetadata", handleLoaded);
      raceAudio.removeEventListener("error", handleError);
    };

    raceAudio.addEventListener("loadedmetadata", handleLoaded, { once: true });
    raceAudio.addEventListener("error", handleError, { once: true });
  });
}

function assignRaceProfiles() {
  winnerIndex = Math.floor(Math.random() * buses.length);
  buses.forEach((bus, index) => {
    bus.finalFactor = index === winnerIndex ? 1 : 0.9 + Math.random() * 0.08;
    bus.wobbleAmp = 0.04 + Math.random() * 0.05;
    bus.wobbleFreq = 1 + Math.random() * 2.5;
    bus.wobblePhase = Math.random();
    bus.surgeTime = 0.2 + Math.random() * 0.6;
    bus.surgeAmp = 0.03 + Math.random() * 0.06;
    bus.surgeWidth = 0.08 + Math.random() * 0.12;
  });
}

async function startRace() {
  if (raceState === RACE_STATE.running) {
    return;
  }
  const options = getOptions();
  buildBuses(options);
  resetRace();
  assignRaceProfiles();
  raceState = RACE_STATE.running;
  result.textContent = "¡Arrancan los motores!";
  raceDurationMs = (await getRaceDuration()) * 1000;
  try {
    raceAudio.currentTime = 0;
    await raceAudio.play();
  } catch (error) {
    // If autoplay is blocked, the race still runs.
  }
  raceStartTime = performance.now();
  animationId = requestAnimationFrame(raceStep);
}

createOptionsBtn.addEventListener("click", () => {
  const count = Number(optionCountInput.value);
  createOptionInputs(count);
  const options = getOptions();
  buildBuses(options);
  resetRace();
});

startBtn.addEventListener("click", startRace);
resetBtn.addEventListener("click", resetRace);

window.addEventListener("resize", () => {
  if (buses.length) {
    resetRace();
  }
});

createOptionInputs(Number(optionCountInput.value));
buildBuses(getOptions());
resetRace();

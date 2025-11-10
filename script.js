// script.js
// Updated: passwords, lock logic, main-switch restrictions, security light, energy bars & totals.

// ---------- CONFIG ----------
const ROOM_CONFIG = {
  sitting: { title: "Sitting Room", devices: ["light", "fan", "ac"] },
  dining: { title: "Dining Room", devices: ["light", "fan", "ac"] },
  study: { title: "Study", devices: ["light", "fan", "ac"] },
  hallway: { title: "Hallway", devices: ["light"] },
  kitchen: { title: "Kitchen", devices: ["light"] },
  veranda: { title: "Veranda", devices: ["light"] },
};

// Passwords (client-side demo)
const ROOM_PASSWORDS = {
  sitting: "sit2025",
  dining: "din2025",
  study: "std2025",
  hallway: "hal2025",
  kitchen: "kit2025",
  veranda: "ver2025",
};
const MASTER_PASSWORD = "smart";

// Power ratings (Watts)
const POWER = {
  light: 20,
  fan: 60,
  ac: 1200,
  security_light: 40,
};

// Maximum for energy bar scaling (choose a number >= possible peaks)
const ENERGY_MAX_W = 2000;

// In-memory state
const state = {};
Object.keys(ROOM_CONFIG).forEach((r) => {
  state[r] = { main: false, unlocked: false };
  ROOM_CONFIG[r].devices.forEach((d) => (state[r][d] = false));
});
let securityOn = false;

// ---------- HELPERS ----------
function cardForRoom(roomKey) {
  return document.querySelector(`.room-card[data-room="${roomKey}"]`);
}
function show(el) {
  if (el) el.classList.remove("hidden");
}
function hide(el) {
  if (el) el.classList.add("hidden");
}

// Transient message shown on card (for main-switch block or other notices)
function showRoomMessage(room, text, duration = 2000) {
  const card = cardForRoom(room);
  if (!card) return;
  let msg = card.querySelector(".room-msg");
  if (!msg) {
    msg = document.createElement("div");
    msg.className = "room-msg";
    msg.style.cssText = "color:#b91c1c;font-weight:700;margin-top:6px";
    card.appendChild(msg);
  }
  msg.textContent = text;
  msg.style.opacity = "1";
  setTimeout(() => {
    if (msg) msg.style.opacity = "0";
  }, duration);
}

// Update visuals (light glow, fan spin, ac puffs) for a room
function updateCardVisuals(roomKey) {
  const card = cardForRoom(roomKey);
  if (!card) return;
  const s = state[roomKey];

  const vLights = card.querySelectorAll(".card-visual");
  const vLight = vLights[0];
  const vFan = vLights[1];
  const vAc = vLights[2];

  if (vLight) {
    if (s.light) vLight.classList.add("light-on");
    else vLight.classList.remove("light-on");
  }
  if (vFan) {
    if (s.fan) vFan.classList.add("fan-on");
    else vFan.classList.remove("fan-on");
  }
  if (vAc) {
    if (s.ac) vAc.classList.add("ac-on");
    else vAc.classList.remove("ac-on");
  }
}

// Compute energy for a room (Watts)
function computeRoomEnergy(roomKey) {
  if (!ROOM_CONFIG[roomKey]) return 0;
  let total = 0;
  ROOM_CONFIG[roomKey].devices.forEach((dev) => {
    if (state[roomKey][dev]) total += POWER[dev] || 0;
  });
  return total;
}

// Update energy UI for a room
function updateRoomEnergyUI(roomKey) {
  const card = cardForRoom(roomKey);
  if (!card) return;
  const watts = computeRoomEnergy(roomKey);
  const pct = Math.min(100, Math.round((watts / ENERGY_MAX_W) * 100));
  const fill = card.querySelector(".energy-fill");
  const wattsEl = card.querySelector(".energy-watts");
  if (fill) fill.style.width = pct + "%";
  if (wattsEl) wattsEl.textContent = `${watts}W`;
}

// Update system total energy UI
function updateSystemEnergyUI() {
  let total = securityOn ? POWER.security_light : 0;
  Object.keys(ROOM_CONFIG).forEach((r) => (total += computeRoomEnergy(r)));
  const pct = Math.min(100, Math.round((total / ENERGY_MAX_W) * 100));
  const sysFill = document.getElementById("system-energy-fill");
  const sysWatts = document.getElementById("system-energy-watts");
  if (sysFill) sysFill.style.width = pct + "%";
  if (sysWatts) sysWatts.textContent = `${total}W`;
}

// Enable/disable main switch when locked/unlocked or when any appliance is on
function refreshMainSwitchState(roomKey) {
  const card = cardForRoom(roomKey);
  if (!card) return;
  const mainEl = card.querySelector(`.main-switch[data-room="${roomKey}"]`);
  if (!mainEl) return;
  // disable when locked
  if (!state[roomKey].unlocked) {
    mainEl.disabled = true;
    mainEl.title = "Unlock room to use main switch";
    return;
  }
  // allow turning OFF always; prevent turning ON if any device is already ON
  const anyDeviceOn = ROOM_CONFIG[roomKey].devices.some(
    (d) => state[roomKey][d]
  );
  // main switch can be enabled to toggle OFF or set ON only when all devices are OFF
  mainEl.disabled = false;
  mainEl.title = "";
  // If any device is ON, we keep it enabled but when user attempts to set checked=true we block in handler
}

// Lock the room UI (show lock box, hide controls, disable main)
function lockRoomUI(roomKey) {
  const card = cardForRoom(roomKey);
  if (!card) return;
  state[roomKey].unlocked = false;
  const lockBox = card.querySelector(".lock-box");
  const controls = card.querySelector(".controls-inline");
  const mainEl = card.querySelector(`.main-switch[data-room="${roomKey}"]`);
  hide(controls);
  if (lockBox) show(lockBox);
  if (mainEl) {
    mainEl.checked = false;
    mainEl.disabled = true;
  }
  // ensure all device toggles are unchecked and disabled
  card.querySelectorAll(".device-toggle").forEach((dt) => {
    dt.checked = false;
    dt.disabled = true;
  });
  // reset visuals & energy
  ROOM_CONFIG[roomKey].devices.forEach((dev) => (state[roomKey][dev] = false));
  state[roomKey].main = false;
  updateCardVisuals(roomKey);
  updateRoomEnergyUI(roomKey);
  updateSystemEnergyUI();
}

// Unlock room UI (hide lock box, show controls, enable main)
function unlockRoom(roomKey) {
  const card = cardForRoom(roomKey);
  if (!card) return;
  state[roomKey].unlocked = true;
  const lockBox = card.querySelector(".lock-box");
  const controls = card.querySelector(".controls-inline");
  if (lockBox) hide(lockBox);
  if (controls) show(controls);
  // enable device toggles and main only after unlocking
  card.querySelectorAll(".device-toggle").forEach((dt) => {
    dt.disabled = false;
  });
  const mainEl = card.querySelector(`.main-switch[data-room="${roomKey}"]`);
  if (mainEl) {
    mainEl.disabled = false;
    mainEl.checked = !!state[roomKey].main;
  }
  // update visuals & energy
  updateCardVisuals(roomKey);
  updateRoomEnergyUI(roomKey);
  updateSystemEnergyUI();
}

// Try unlock with room password or master
function tryUnlock(roomKey, attempt) {
  if (attempt === MASTER_PASSWORD) {
    // unlock all rooms
    Object.keys(ROOM_CONFIG).forEach((r) => unlockRoom(r));
    return true;
  }
  if (attempt === ROOM_PASSWORDS[roomKey]) {
    unlockRoom(roomKey);
    return true;
  } else {
    const card = cardForRoom(roomKey);
    if (!card) return false;
    const error = card.querySelector(".lock-error");
    if (error) {
      error.textContent = "Incorrect password.";
      show(error);
      setTimeout(() => {
        hide(error);
      }, 2200);
    }
    return false;
  }
}

// ---------- INIT & EVENT HOOKS ----------
function initRoomsPage() {
  // If no room cards present, exit
  if (!document.querySelector(".room-card")) return;

  // Initially lock all UIs
  Object.keys(ROOM_CONFIG).forEach((r) => lockRoomUI(r));

  // Security toggle
  const secToggle = document.getElementById("security-toggle");
  const secVisual = document.getElementById("security-visual");
  if (secToggle) {
    secToggle.checked = securityOn;
    secToggle.addEventListener("change", (e) => {
      securityOn = !!e.target.checked;
      if (secVisual) {
        if (securityOn) secVisual.classList.add("on");
        else secVisual.classList.remove("on");
      }
      updateSystemEnergyUI();
    });
  }

  // Unlock buttons
  document.querySelectorAll(".unlock-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const room = btn.getAttribute("data-room");
      const card = cardForRoom(room);
      if (!card) return;
      const input = card.querySelector(".lock-input");
      const attempt = input ? input.value.trim() : "";
      tryUnlock(room, attempt);
      if (input) input.value = "";
      // initialize controls after unlock
      setTimeout(() => initRoomControls(room), 80);
    });
  });

  // Enter key in password field
  document.querySelectorAll(".lock-input").forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const card = inp.closest(".room-card");
        const room = card.getAttribute("data-room");
        const btn = card.querySelector(".unlock-btn");
        if (btn) btn.click();
      }
    });
  });

  // Initialize controls for all rooms (listeners set but will be disabled until unlocked)
  Object.keys(ROOM_CONFIG).forEach((r) => initRoomControls(r));

  // Double-click to toggle light (only when unlocked)
  document.querySelectorAll(".room-card").forEach((card) => {
    const room = card.getAttribute("data-room");
    card.addEventListener("dblclick", () => {
      if (!state[room].unlocked) return;
      if (!ROOM_CONFIG[room].devices.includes("light")) return;
      state[room].light = !state[room].light;
      const dt = card.querySelector(
        `.device-toggle[data-device="light"][data-room="${room}"]`
      );
      if (dt) {
        dt.checked = !!state[room].light;
      }
      // main switch should remain unaffected (spec per request)
      const anyOn = ROOM_CONFIG[room].devices.some((d) => state[room][d]);
      state[room].main = anyOn;
      const mainEl = card.querySelector(`.main-switch[data-room="${room}"]`);
      if (mainEl) mainEl.checked = anyOn && state[room].main;
      updateCardVisuals(room);
      updateRoomEnergyUI(room);
      updateSystemEnergyUI();
    });
  });

  // Ensure UI shows correct energy at start
  updateSystemEnergyUI();
}

// Attach main/device handlers for a specific room (called at init and after unlock)
function initRoomControls(room) {
  const card = cardForRoom(room);
  if (!card) return;

  // MAIN switch handler
  const mainEl = card.querySelector(`.main-switch[data-room="${room}"]`);
  if (mainEl && !mainEl._bound) {
    mainEl._bound = true;
    mainEl.addEventListener("change", (e) => {
      // If room locked, prevent operation
      if (!state[room].unlocked) {
        e.preventDefault();
        mainEl.checked = false;
        showRoomMessage(room, "Room locked. Unlock to use main switch.");
        mainEl.disabled = true;
        return;
      }

      const turningOn = e.target.checked;
      // If turning ON but there is any appliance already ON, block (per requirement)
      const anyDeviceOn = ROOM_CONFIG[room].devices.some((d) => state[room][d]);
      if (turningOn && anyDeviceOn) {
        // revert
        e.preventDefault();
        mainEl.checked = false;
        showRoomMessage(
          room,
          "Cannot turn main ON: some appliance already ON."
        );
        return;
      }

      // If turning OFF => turn all devices OFF
      if (!turningOn) {
        ROOM_CONFIG[room].devices.forEach((dev) => (state[room][dev] = false));
        // update device toggles
        card.querySelectorAll(".device-toggle").forEach((dt) => {
          dt.checked = false;
        });
        state[room].main = false;
        updateCardVisuals(room);
        updateRoomEnergyUI(room);
        updateSystemEnergyUI();
        return;
      }

      // If turning ON and allowed (no devices on) -> set all devices ON as per original behavior?
      // Per previous behavior main switch toggles everything in that room => set devices ON
      ROOM_CONFIG[room].devices.forEach((dev) => (state[room][dev] = true));
      state[room].main = true;
      card.querySelectorAll(".device-toggle").forEach((dt) => {
        if (dt.getAttribute("data-room") === room) {
          dt.checked = true;
        }
      });
      updateCardVisuals(room);
      updateRoomEnergyUI(room);
      updateSystemEnergyUI();
    });
  }

  // DEVICE toggles handlers
  card.querySelectorAll(".device-toggle").forEach((el) => {
    // ensure disabled state reflects lock
    el.disabled = !state[room].unlocked;
    if (el._bound) return;
    el._bound = true;
    el.addEventListener("change", (e) => {
      // Prevent device change while locked (extra safety)
      if (!state[room].unlocked) {
        e.preventDefault();
        el.checked = false;
        showRoomMessage(room, "Room locked. Unlock to change devices.");
        return;
      }
      const device = el.getAttribute("data-device");
      state[room][device] = !!e.target.checked;
      // Main switch should NOT automatically turn ON when a device is toggled on (per request)
      // But we should update main switch state to reflect "anyOn" only if main was already on?
      // Per requirement: "main switch should not turn on when any appliance is turned on" - so do NOT change main to true here.
      const anyOn = ROOM_CONFIG[room].devices.some((d) => state[room][d]);
      // do not auto-set main true; but keep main false unless explicitly set by user
      // keep main state as-is unless it's false and user sets main on later
      // update main check to reflect if main is false but all devices are off and are turned on by main later
      const mainElLocal = card.querySelector(
        `.main-switch[data-room="${room}"]`
      );
      if (mainElLocal) {
        // Keep mainElLocal.checked as state[room].main (no auto-enable)
        mainElLocal.checked = !!state[room].main;
      }
      updateCardVisuals(room);
      updateRoomEnergyUI(room);
      updateSystemEnergyUI();
    });
  });

  // Refresh main state (enable/disable)
  refreshMainSwitchState(room);
}

// ---------- UTILITY: unlock all with master from any lock input ----------
function attachMasterUnlockShortcuts() {
  // If user types master password in any lock input and presses Enter -> unlock all
  document.querySelectorAll(".lock-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      // no op; keep for future
    });
  });
}

// ---------- START ----------
document.addEventListener("DOMContentLoaded", () => {
  initRoomsPage();
  attachMasterUnlockShortcuts();
});

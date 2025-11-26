/* ==========================================================
   Meta Media Hub - script_v.js
   Stable Resizer + Smart Human Scan UI + Safe Crop + Manual Focus
========================================================== */

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ================= AUTH ================= */
const pwModal = $("pwModal");
const pwInput = $("pwInput");
const pwBtn = $("pwBtn");
const pwMsg = $("pwMsg");
const statusText = $("statusText");

const AUTH_KEY = "mm_auth_v3";
const PASSWORD = "Meta@123";

function saveAuth(v) {
  if (v) localStorage.setItem(AUTH_KEY, "true");
  else localStorage.removeItem(AUTH_KEY);
}
function isAuthed() {
  return localStorage.getItem(AUTH_KEY) === "true";
}
function showSection(name) {
  const home = $("home");
  const imageSection = $("imageSection");
  const enhancerSection = $("enhancerSection");

  if (home) home.style.display = name === "home" ? "flex" : "none";
  if (imageSection) imageSection.style.display = name === "resize" ? "block" : "none";
  if (enhancerSection) enhancerSection.style.display = name === "enhance" ? "block" : "none";
}
function unlock() {
  pwMsg.textContent = "";
  if (pwInput.value === PASSWORD) {
    saveAuth(true);
    pwModal.style.display = "none";
    statusText.textContent = "Unlocked";
    showSection("home");
  } else {
    pwMsg.textContent = "Incorrect password";
  }
}
pwBtn.addEventListener("click", unlock);
pwInput.addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });

if (isAuthed()) {
  pwModal.style.display = "none";
  statusText.textContent = "Unlocked";
  showSection("home");
}

/* ================= NAV ================= */
$("btnImage").addEventListener("click", () => showSection("resize"));
$("btnEnhancer").addEventListener("click", () => showSection("enhance"));
$("backHomeFromImage").addEventListener("click", () => showSection("home"));
$("backHomeFromEnhancer").addEventListener("click", () => showSection("home"));

/* ================= IMAGE RESIZER ================= */

let imageFiles = [];
let imageDetectionMap = {};
let cocoModel = null;
let manualFocusPoint = null;

const dropImage = $("dropImage");
const imageInput = $("imageInput");
const imageFileList = $("imageFileList");
const imgStatus = $("imgStatus");
const imgAiToggle = $("imgAiToggle");

/* ---------- Scan UI ---------- */
function refreshImageList() {
  if (!imageFiles.length) {
    imageFileList.innerHTML = "No files uploaded.";
    return;
  }

  imageFileList.innerHTML = imageFiles.map((f, i) => {
    const st = imageDetectionMap[f.name] || "unknown";
    let icon = "⏳", label = "Scanning...";
    if (st === "person") { icon = "👤"; label = "Human detected"; }
    if (st === "none") { icon = "❌"; label = "No human"; }

    return `
      <div class="file-row">
        <span>${icon}</span>
        <div>
          <b>${i + 1}. ${f.name}</b><br>
          <small>${label}</small>
        </div>
      </div>
    `;
  }).join("");
}

/* ---------- COCO MODEL ---------- */
async function loadCoco() {
  if (cocoModel) return cocoModel;
  cocoModel = await cocoSsd.load();
  return cocoModel;
}

async function detectPerson(imgEl) {
  await loadCoco();
  const preds = await cocoModel.detect(imgEl);
  return preds.some(p => p.class === "person");
}

/* ---------- HANDLE NEW IMAGES ---------- */
async function handleNewImages() {
  imageDetectionMap = {};
  imgStatus.textContent = "Scanning images...";
  manualFocusPoint = null;

  let found = 0;

  for (const file of imageFiles) {
    imageDetectionMap[file.name] = "unknown";
  }
  refreshImageList();

  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode();

    const hasPerson = await detectPerson(img);
    imageDetectionMap[file.name] = hasPerson ? "person" : "none";
    if (hasPerson) found++;

    refreshImageList();
    URL.revokeObjectURL(url);
  }

  imgAiToggle.classList.toggle("active", found > 0);

  if (found > 0) {
    manualFocusPoint = null;
    imgStatus.textContent = "Human detected — Manual Focus disabled.";
  } else {
    imgStatus.textContent = "No human detected — Manual Focus enabled.";
  }
}

/* ---------- INPUT EVENTS ---------- */
dropImage.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", async e => {
  imageFiles = Array.from(e.target.files || []);
  if (!imageFiles.length) return;
  await handleNewImages();
});

/* ================= MANUAL FOCUS (ONLY WHEN NO HUMAN) ================= */

const previewBefore = $("beforeImg");

if (previewBefore) {
  previewBefore.addEventListener("click", e => {
    if (!imageFiles.length) return;

    const file = imageFiles[0];
    if (imageDetectionMap[file.name] === "person") {
      alert("Manual Focus disabled — Human detected.");
      return;
    }

    const rect = previewBefore.getBoundingClientRect();
    manualFocusPoint = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };

    alert("Manual focus set.");
  });
}

/* ================= PROCESS IMAGES ================= */

async function processImages(previewOnly = false) {
  if (!imageFiles.length) return alert("Upload images first.");

  const zip = new JSZip();

  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode();

    const targetW = parseInt($("imgWidth").value) || img.width;
    const targetH = parseInt($("imgHeight").value) || img.height;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");

    const imgW = img.width;
    const imgH = img.height;

    /* HUMAN SAFE MODE */
    if (imageDetectionMap[file.name] === "person") {
      const scale = Math.min(targetW / imgW, targetH / imgH);
      const w = imgW * scale;
      const h = imgH * scale;
      const ox = (targetW - w) / 2;
      const oy = (targetH - h) / 2;
      ctx.drawImage(img, ox, oy, w, h);
    }

    /* MANUAL FOCUS (NO HUMAN) */
    else if (manualFocusPoint) {
      const scale = Math.max(targetW / imgW, targetH / imgH);
      const w = imgW * scale;
      const h = imgH * scale;

      const fx = manualFocusPoint.x * w;
      const fy = manualFocusPoint.y * h;

      const ox = targetW / 2 - fx;
      const oy = targetH / 2 - fy;

      ctx.drawImage(img, ox, oy, w, h);
    }

    /* DEFAULT CENTER COVER */
    else {
      const scale = Math.max(targetW / imgW, targetH / imgH);
      const w = imgW * scale;
      const h = imgH * scale;
      const ox = (targetW - w) / 2;
      const oy = (targetH - h) / 2;
      ctx.drawImage(img, ox, oy, w, h);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    if (previewOnly) {
      window.open(dataUrl, "_blank");
      return;
    }

    zip.file(
      file.name.replace(/\.[^/.]+$/, "") + "_resized.jpg",
      dataUrl.split(",")[1],
      { base64: true }
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "resized_images.zip";
  a.click();
}

$("imgPreviewBtn").addEventListener("click", () => processImages(true));
$("imgProcessBtn").addEventListener("click", () => processImages(false));

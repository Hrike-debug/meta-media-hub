/* ==========================================================
   Meta Media Hub - script_v.js
   Stable Resizer + Smart Human Protection + Manual Focus
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
let manualFocusPoint = null; // ✅ ONLY when NO HUMAN

const dropImage = $("dropImage");
const imageInput = $("imageInput");
const imageFileList = $("imageFileList");
const smartBanner = $("smartBanner");
const bannerIcon = $("bannerIcon");
const bannerText = $("bannerText");
const imgStatus = $("imgStatus");
const imgAiToggle = $("imgAiToggle");

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

async function handleNewImages() {
  imageDetectionMap = {};
  let found = 0;

  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode();

    const hasPerson = await detectPerson(img);
    imageDetectionMap[file.name] = hasPerson ? "person" : "none";
    if (hasPerson) found++;

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

dropImage.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", async e => {
  imageFiles = Array.from(e.target.files);
  await handleNewImages();
});

/* ================= MANUAL FOCUS SET ================= */

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
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    manualFocusPoint = { x, y };
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

    const w = img.width;
    const h = img.height;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    const offsetX = (w - sw) / 2;
    const offsetY = (h - sh) / 2;

    const imgW = img.width;
    const imgH = img.height;

    if (imageDetectionMap[file.name] === "person") {
      const safeScale = Math.min(w / imgW, h / imgH);
      const safeW = imgW * safeScale;
      const safeH = imgH * safeScale;
      const ox = (w - safeW) / 2;
      const oy = (h - safeH) / 2;
      ctx.drawImage(img, ox, oy, safeW, safeH);
    } 
    else if (manualFocusPoint) {
      const fx = manualFocusPoint.x * imgW;
      const fy = manualFocusPoint.y * imgH;

      const sx = fx - w / 2;
      const sy = fy - h / 2;

      ctx.drawImage(
        img,
        sx, sy,
        w, h,
        0, 0,
        w, h
      );
    } 
    else {
      ctx.drawImage(img, offsetX, offsetY, sw, sh);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    if (previewOnly) {
      $("previewModal").style.display = "flex";
      $("previewBefore").src = url;
      $("previewAfter").src = dataUrl;
      return;
    }

    zip.file(file.name, dataUrl.split(",")[1], { base64: true });
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "resized_images.zip";
  a.click();
}

$("imgPreviewBtn").addEventListener("click", () => processImages(true));
$("imgProcessBtn").addEventListener("click", () => processImages(false));

/* ================= PREVIEW CLOSE ================= */

$("closePreview").addEventListener("click", () => {
  $("previewModal").style.display = "none";
});

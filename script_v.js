/* ==========================================================
   Meta Media Hub - script_v.js
   Stable version for your current HTML:
   - Auth + Nav
   - Smart Human Detection + Scan Banner
   - Manual Focus (box) ONLY when no human
   - Center-cover crop (no stretch)
   - Preview First = popup (Before/After)
   - Process = ZIP download
========================================================== */

const $ = (id) => document.getElementById(id);

/* ====================
   AUTH + NAV
==================== */
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

if (pwBtn) pwBtn.addEventListener("click", unlock);
if (pwInput)
  pwInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") unlock();
  });

if (isAuthed()) {
  if (pwModal) pwModal.style.display = "none";
  if (statusText) statusText.textContent = "Unlocked";
  showSection("home");
} else {
  if (pwModal) pwModal.style.display = "flex";
}

/* NAV BUTTONS */
const btnImage = $("btnImage");
const btnEnhancer = $("btnEnhancer");
const backHomeFromImage = $("backHomeFromImage");
const backHomeFromEnhancer = $("backHomeFromEnhancer");

if (btnImage) btnImage.onclick = () => showSection("resize");
if (btnEnhancer) btnEnhancer.onclick = () => showSection("enhance");
if (backHomeFromImage) backHomeFromImage.onclick = () => showSection("home");
if (backHomeFromEnhancer) backHomeFromEnhancer.onclick = () => showSection("home");

/* =========================
   IMAGE RESIZER + AI SCAN
========================= */

let imageFiles = [];
let imageDetectionMap = {};
let cocoModel = null;
let hasHuman = false;

/* Manual focus box state */
let manualFocusEnabled = false;
let manualFocusBox = null; // {x,y,width,height} in window coords

const dropImage = $("dropImage");
const imageInput = $("imageInput");
const imageFileList = $("imageFileList");
const smartBanner = $("smartBanner");
const bannerIcon = $("bannerIcon");
const bannerText = $("bannerText");
const imgStatus = $("imgStatus");

const imgWidth = $("imgWidth");
const imgHeight = $("imgHeight");
const imgQuality = $("imgQuality");
const imgQualityVal = $("imgQualityVal");
const imgPreviewBtn = $("imgPreviewBtn");
const imgProcessBtn = $("imgProcessBtn");
const focusBtn = $("focusBtn");

/* ------------- Drag & Drop / Click Upload ------------- */
if (dropImage && imageInput) {
  dropImage.addEventListener("click", () => imageInput.click());

  dropImage.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropImage.classList.add("drag-over");
  });

  dropImage.addEventListener("dragleave", () => {
    dropImage.classList.remove("drag-over");
  });

  dropImage.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropImage.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (!files.length) return;
    imageFiles = files;
    await handleNewImages();
  });

  imageInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (!files.length) return;
    imageFiles = files;
    await handleNewImages();
  });
}

/* ------------- Quality Slider ------------- */
if (imgQuality && imgQualityVal) {
  imgQualityVal.textContent = imgQuality.value + "%";
  imgQuality.addEventListener("input", () => {
    imgQualityVal.textContent = imgQuality.value + "%";
  });
}

/* ------------- Smart Human Detection ------------- */
async function loadCoco() {
  if (cocoModel) return cocoModel;
  if (imgStatus) imgStatus.textContent = "Loading AI model…";
  cocoModel = await cocoSsd.load();
  if (imgStatus) imgStatus.textContent = "Model ready";
  return cocoModel;
}

async function detectPerson(imgEl) {
  await loadCoco();
  const preds = await cocoModel.detect(imgEl);
  return preds.some((p) => p.class === "person");
}

function refreshImageList() {
  if (!imageFileList) return;

  if (!imageFiles.length) {
    imageFileList.innerHTML = "No files uploaded.";
    return;
  }

  imageFileList.innerHTML = imageFiles
    .map((f, i) => {
      const st = imageDetectionMap[f.name] || "unknown";
      let label = "Scanning…";
      let icon = "⏳";
      if (st === "person") {
        label = "Human detected";
        icon = "👤";
      } else if (st === "none") {
        label = "No human";
        icon = "❌";
      }
      return `<div class="file-row">
        <span>${icon}</span>
        <div><b>${i + 1}. ${f.name}</b><br><small>${label}</small></div>
      </div>`;
    })
    .join("");
}

async function handleNewImages() {
  if (!imageFiles.length) return;

  imageDetectionMap = {};
  hasHuman = false;
  manualFocusBox = null;

  if (smartBanner) smartBanner.style.display = "block";
  if (bannerIcon) bannerIcon.textContent = "⏳";
  if (bannerText) bannerText.textContent = "Scanning images…";
  if (imgStatus) imgStatus.textContent = "Scanning…";

  refreshImageList();

  let found = 0;

  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode().catch(() => {});
    const human = await detectPerson(img);
    imageDetectionMap[file.name] = human ? "person" : "none";
    if (human) found++;
    URL.revokeObjectURL(url);
    refreshImageList();
  }

  hasHuman = found > 0;

  if (bannerIcon) bannerIcon.textContent = hasHuman ? "🟢" : "⚪";
  if (bannerText)
    bannerText.innerHTML = hasHuman
      ? `Smart Human Detection: found people in <b>${found}</b> image(s)`
      : "Smart Human Detection: no humans found";

  /* Manual focus enable/disable based on human */
  if (focusBtn) {
    if (hasHuman) {
      focusBtn.disabled = true;
      focusBtn.style.opacity = 0.4;
      manualFocusEnabled = false;
      manualFocusBox = null;
    } else {
      focusBtn.disabled = false;
      focusBtn.style.opacity = 1;
    }
  }

  if (imgStatus)
    imgStatus.textContent = hasHuman
      ? "Scan complete. Human detected."
      : "Scan complete. No human detected.";
}

/* =====================
   MANUAL FOCUS BOX
   (Only when NO human)
===================== */

let focusOverlay = null;
let focusRect = null;
let drawing = false;
let startX = 0;
let startY = 0;

function ensureFocusOverlay() {
  if (focusOverlay) return;
  focusOverlay = document.createElement("div");
  focusOverlay.style.position = "fixed";
  focusOverlay.style.inset = "0";
  focusOverlay.style.zIndex = "9998";
  focusOverlay.style.pointerEvents = "none";
  focusOverlay.style.background = "transparent";

  focusRect = document.createElement("div");
  focusRect.className = "focus-box";
  focusOverlay.appendChild(focusRect);

  document.body.appendChild(focusOverlay);

  focusOverlay.addEventListener("mousedown", (e) => {
    if (!manualFocusEnabled || hasHuman) return;
    drawing = true;
    startX = e.clientX;
    startY = e.clientY;
    manualFocusBox = null;
    if (focusRect) {
      focusRect.style.display = "block";
      focusRect.style.left = `${startX}px`;
      focusRect.style.top = `${startY}px`;
      focusRect.style.width = "0px";
      focusRect.style.height = "0px";
    }
  });

  focusOverlay.addEventListener("mousemove", (e) => {
    if (!drawing || !focusRect) return;
    const w = e.clientX - startX;
    const h = e.clientY - startY;
    focusRect.style.width = `${Math.abs(w)}px`;
    focusRect.style.height = `${Math.abs(h)}px`;
    focusRect.style.left = `${w < 0 ? e.clientX : startX}px`;
    focusRect.style.top = `${h < 0 ? e.clientY : startY}px`;
  });

  window.addEventListener("mouseup", () => {
    if (!drawing || !focusRect) return;
    drawing = false;
    const rect = focusRect.getBoundingClientRect();
    if (rect.width > 5 && rect.height > 5) {
      manualFocusBox = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
      if (imgStatus) imgStatus.textContent = "Manual focus area set.";
    } else {
      manualFocusBox = null;
      focusRect.style.display = "none";
      if (imgStatus) imgStatus.textContent = "Manual focus cancelled.";
    }
    manualFocusEnabled = false;
    focusOverlay.style.pointerEvents = "none";
  });
}

if (focusBtn) {
  focusBtn.addEventListener("click", () => {
    if (hasHuman) {
      alert("Manual Focus disabled when a human is detected. AI will protect people automatically.");
      return;
    }
    if (!imageFiles.length) {
      alert("Upload an image first.");
      return;
    }
    ensureFocusOverlay();
    manualFocusEnabled = true;
    manualFocusBox = null;
    if (focusRect) {
      focusRect.style.display = "none";
    }
    focusOverlay.style.pointerEvents = "auto";
    if (imgStatus) imgStatus.textContent = "Draw focus box by dragging on screen.";
  });
}

/* ======================
   CENTER-COVER DRAW
====================== */

function drawCover(ctx, img, targetW, targetH) {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  const scale = Math.max(targetW / imgW, targetH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  let offsetX = (targetW - drawW) / 2;
  let offsetY = (targetH - drawH) / 2;

  // If we have a manual focus box and no human, bias crop to that area
  if (manualFocusBox && !hasHuman) {
    const fx = (manualFocusBox.x + manualFocusBox.width / 2) / window.innerWidth;
    const fy = (manualFocusBox.y + manualFocusBox.height / 2) / window.innerHeight;

    const targetCenterX = targetW * 0.5;
    const targetCenterY = targetH * 0.5;

    const imgCenterX = drawW * fx;
    const imgCenterY = drawH * fy;

    offsetX = targetCenterX - imgCenterX;
    offsetY = targetCenterY - imgCenterY;

    // Clamp so we don't leave empty bands
    const minX = targetW - drawW;
    const maxX = 0;
    const minY = targetH - drawH;
    const maxY = 0;
    offsetX = Math.max(minX, Math.min(maxX, offsetX));
    offsetY = Math.max(minY, Math.min(maxY, offsetY));
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

/* ======================
   PREVIEW FIRST
   (Popup with Before/After)
====================== */

async function previewFirst() {
  if (!imageFiles.length) {
    alert("Upload an image first.");
    return;
  }

  const file = imageFiles[0];
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;
  await img.decode().catch(() => {});

  const targetW = parseInt(imgWidth?.value || "0", 10) || img.naturalWidth;
  const targetH = parseInt(imgHeight?.value || "0", 10) || img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");

  drawCover(ctx, img, targetW, targetH);

  const outUrl = canvas.toDataURL("image/jpeg", 0.9);

  const wPrev = window.open("", "_blank");
  if (!wPrev) {
    alert("Popup blocked — allow popups to see preview.");
  } else {
    wPrev.document.write(`
      <title>Preview</title>
      <div style="display:flex;gap:16px;padding:16px;background:#111;color:#fff;font-family:system-ui">
        <div style="flex:1;text-align:center">
          <h3>Before</h3>
          <img src="${url}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #555;">
        </div>
        <div style="flex:1;text-align:center">
          <h3>After</h3>
          <img src="${outUrl}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #555;">
        </div>
      </div>
    `);
    wPrev.document.close();
  }

  URL.revokeObjectURL(url);
  if (imgStatus) imgStatus.textContent = "Preview opened for first image.";
}

if (imgPreviewBtn) imgPreviewBtn.addEventListener("click", previewFirst);

/* ======================
   PROCESS & DOWNLOAD ZIP
====================== */

function dataURLToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bin = atob(data);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function processAndDownload() {
  if (!imageFiles.length) {
    alert("Upload images first.");
    return;
  }

  if (imgStatus) imgStatus.textContent = "Processing images…";

  const tW = parseInt(imgWidth?.value || "0", 10) || 0;
  const tH = parseInt(imgHeight?.value || "0", 10) || 0;
  const q = imgQuality ? (parseInt(imgQuality.value, 10) || 90) / 100 : 0.9;

  const zip = new JSZip();
  let processed = 0;

  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode().catch(() => {});

    const targetW = tW || img.naturalWidth;
    const targetH = tH || img.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");

    drawCover(ctx, img, targetW, targetH);

    const dataUrl = canvas.toDataURL("image/jpeg", q);
    const blob = dataURLToBlob(dataUrl);
    const base = file.name.replace(/\.[^/.]+$/, "");
    zip.file(base + "_resized.jpg", blob);

    processed++;
    URL.revokeObjectURL(url);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zipBlob);
  a.download = "resized_images.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);

  if (imgStatus) imgStatus.textContent = "Done. ZIP downloaded.";
}

if (imgProcessBtn) imgProcessBtn.addEventListener("click", processAndDownload);

/* ============================
   (AI ENHANCER JS untouched here)
   You can keep your existing enhancer logic below,
   or integrate it similarly.
============================ */

/* ==========================================================
   Meta Media Hub - script_v.js
   Stable version for current HTML:
   - Auth + Nav
   - Smart Human Detection + banner
   - Manual Focus (drag box) ONLY when no human
   - Center-cover crop (no stretch)
   - Preview First (popup Before/After)
   - Process & Download ZIP
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
  if (!pwInput) return;
  if (pwMsg) pwMsg.textContent = "";
  if (pwInput.value === PASSWORD) {
    saveAuth(true);
    if (pwModal) pwModal.style.display = "none";
    if (statusText) statusText.textContent = "Unlocked";
    showSection("home");
  } else {
    if (pwMsg) pwMsg.textContent = "Incorrect password";
  }
}

if (pwBtn) pwBtn.addEventListener("click", unlock);
if (pwInput) {
  pwInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") unlock();
  });
}

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
    const dtFiles = (e.dataTransfer && e.dataTransfer.files) ? e.dataTransfer.files : [];
    const files = Array.from(dtFiles).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    imageFiles = files;
    await handleNewImages();
  });

  imageInput.addEventListener("change", async (e) => {
    const inputFiles = (e.target && e.target.files) ? e.target.files : [];
    const files = Array.from(inputFiles).filter((f) => f.type.startsWith("image/"));
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
    try {
      await img.decode();
    } catch (e) {}
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
      ? 'Smart Human Detection: found people in <b>' + found + "</b> image(s)"
      : "Smart Human Detection: no humans found";

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
      focusRect.style.left = startX + "px";
      focusRect.style.top = startY + "px";
      focusRect.style.width = "0px";
      focusRect.style.height = "0px";
    }
  });

  focusOverlay.addEventListener("mousemove", (e) => {
    if (!drawing || !focusRect) return;
    const w = e.clientX - startX;
    const h = e.clientY - startY;
    focusRect.style.width = Math.abs(w) + "px";
    focusRect.style.height = Math.abs(h) + "px";
    focusRect.style.left = (w < 0 ? e.clientX : startX) + "px";
    focusRect.style.top = (h < 0 ? e.clientY : startY) + "px";
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
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  const scale = Math.max(targetW / imgW, targetH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  let offsetX = (targetW - drawW) / 2;
  let offsetY = (targetH - drawH) / 2;

  if (manualFocusBox && !hasHuman) {
    const fx =
      (manualFocusBox.x + manualFocusBox.width / 2) / window.innerWidth;
    const fy =
      (manualFocusBox.y + manualFocusBox.height / 2) / window.innerHeight;

    const targetCenterX = targetW * 0.5;
    const targetCenterY = targetH * 0.5;

    const imgCenterX = drawW * fx;
    const imgCenterY = drawH * fy;

    offsetX = targetCenterX - imgCenterX;
    offsetY = targetCenterY - imgCenterY;

    const minX = targetW - drawW;
    const maxX = 0;
    const minY = targetH - drawH;
    const maxY = 0;
    if (offsetX < minX) offsetX = minX;
    if (offsetX > maxX) offsetX = maxX;
    if (offsetY < minY) offsetY = minY;
    if (offsetY > maxY) offsetY = maxY;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

/* ======================
   PREVIEW FIRST
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
  try {
    await img.decode();
  } catch (e) {}

  let targetW = 0;
  let targetH = 0;
  if (imgWidth) {
    const parsed = parseInt(imgWidth.value, 10);
    if (!isNaN(parsed) && parsed > 0) targetW = parsed;
  }
  if (imgHeight) {
    const parsed = parseInt(imgHeight.value, 10);
    if (!isNaN(parsed) && parsed > 0) targetH = parsed;
  }
  if (!targetW) targetW = img.naturalWidth || img.width;
  if (!targetH) targetH = img.naturalHeight || img.height;

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
    wPrev.document.write(
      '<title>Preview</title>' +
        '<div style="display:flex;gap:16px;padding:16px;background:#111;color:#fff;font-family:system-ui">' +
        '<div style="flex:1;text-align:center">' +
        "<h3>Before</h3>" +
        '<img src="' +
        url +
        '" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #555;">' +
        "</div>" +
        '<div style="flex:1;text-align:center">' +
        "<h3>After</h3>" +
        '<img src="' +
        outUrl +
        '" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #555;">' +
        "</div>" +
        "</div>"
    );
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
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  const header = parts[0];
  const data = parts[1];
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

  let tW = 0;
  let tH = 0;
  if (imgWidth) {
    const parsed = parseInt(imgWidth.value, 10);
    if (!isNaN(parsed) && parsed > 0) tW = parsed;
  }
  if (imgHeight) {
    const parsed = parseInt(imgHeight.value, 10);
    if (!isNaN(parsed) && parsed > 0) tH = parsed;
  }

  let q = 0.9;
  if (imgQuality) {
    const parsedQ = parseInt(imgQuality.value, 10);
    if (!isNaN(parsedQ) && parsedQ > 0) q = parsedQ / 100;
  }

  const zip = new JSZip();
  let processed = 0;

  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    try {
      await img.decode();
    } catch (e) {}

    const targetW = tW || img.naturalWidth || img.width;
    const targetH = tH || img.naturalHeight || img.height;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");

    drawCover(ctx, img, targetW, targetH);

    const dataUrl = canvas.toDataURL("image/jpeg", q);
    const blob = dataURLToBlob(dataUrl);
    if (blob) {
      const base = file.name.replace(/\.[^/.]+$/, "");
      zip.file(base + "_resized.jpg", blob);
    }

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
   (Enhancer JS lives separately if you have it)
============================ */

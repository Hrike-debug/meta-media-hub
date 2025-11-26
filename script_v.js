/* ==========================================================
   Meta Media Hub - script_v.js
   Preview OK + Smart Human OK + Human Protection OK
   Conditional Manual Focus (ONLY when NO HUMAN)
========================================================== */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ====================
   AUTH + SECTION LOGIC
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
  } else pwMsg.textContent = "Incorrect password";
}

pwBtn.addEventListener("click", unlock);
pwInput.addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });

if (isAuthed()) {
  pwModal.style.display = "none";
  statusText.textContent = "Unlocked";
  showSection("home");
}

/* ====================
   NAVIGATION
==================== */
$("btnImage").addEventListener("click", () => showSection("resize"));
$("btnEnhancer").addEventListener("click", () => showSection("enhance"));
$("backHomeFromImage").addEventListener("click", () => showSection("home"));
$("backHomeFromEnhancer").addEventListener("click", () => showSection("home"));

/* =========================
   IMAGE RESIZER + SMART HUMAN
========================= */

let imageFiles = [];
let cocoModel = null;
let imageDetectionMap = {};
let manualFocusPoint = null; // ✅ NEW

const dropImage = $("dropImage");
const imageInput = $("imageInput");
const imageFileList = $("imageFileList");
const imgWidth = $("imgWidth");
const imgHeight = $("imgHeight");
const imgQuality = $("imgQuality");
const imgQualityVal = $("imgQualityVal");
const imgPreviewBtn = $("imgPreviewBtn");
const imgProcessBtn = $("imgProcessBtn");
const focusBtn = $("focusBtn");
const imgStatus = $("imgStatus");
const imgProgress = $("imgProgress");

const smartBanner = $("smartBanner");
const bannerIcon = $("bannerIcon");
const bannerText = $("bannerText");
const imgAiToggle = $("imgAiToggle");

dropImage.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", async e => {
  imageFiles = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
  manualFocusPoint = null; // reset
  await handleNewImages();
});

function refreshImageList() {
  if (!imageFiles.length) {
    imageFileList.innerHTML = "No files uploaded.";
    smartBanner && (smartBanner.style.display = "none");
    return;
  }

  imageFileList.innerHTML = imageFiles.map((f, i) => {
    const st = imageDetectionMap[f.name] || "unknown";
    let icon = "⏳";
    let label = "Scanning…";
    if (st === "person") { icon = "👤"; label = "Human found"; }
    if (st === "none") { icon = "❌"; label = "No person"; }

    return `
      <div class="file-row">
        <span>${icon}</span>
        <div><b>${i + 1}. ${f.name}</b><br><small>${label}</small></div>
      </div>`;
  }).join("");
}

imgQualityVal.textContent = imgQuality.value + "%";
imgQuality.addEventListener("input", () => {
  imgQualityVal.textContent = imgQuality.value + "%";
});

/* ===== SMART HUMAN DETECTION ===== */

async function loadCoco() {
  if (cocoModel) return cocoModel;
  imgStatus.textContent = "Loading AI model…";
  cocoModel = await cocoSsd.load();
  imgStatus.textContent = "Model ready";
  return cocoModel;
}

async function detectPerson(imgEl) {
  await loadCoco();
  const preds = await cocoModel.detect(imgEl);
  return preds.some(p => p.class === "person");
}

async function handleNewImages() {
  imageDetectionMap = {};
  refreshImageList();

  if (!imageFiles.length) return;

  smartBanner && (smartBanner.style.display = "flex");
  bannerIcon && (bannerIcon.textContent = "⏳");
  bannerText && (bannerText.textContent = "Scanning images…");
  imgStatus.textContent = "Scanning…";

  let found = 0;

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

  bannerIcon && (bannerIcon.textContent = found ? "🟢" : "⚪");
  bannerText && (bannerText.innerHTML = found
    ? `Smart Human Detection: <b>${found}</b> image(s)`
    : `No people detected.`);
  imgAiToggle && imgAiToggle.classList.toggle("active", found > 0);
  imgStatus.textContent = "Scan complete.";
}

/* =========================
   MANUAL FOCUS (CONDITIONAL)
========================= */

focusBtn.addEventListener("click", () => {
  const anyHuman = imageFiles.some(f => imageDetectionMap[f.name] === "person");

  if (anyHuman) {
    alert("Manual Focus disabled because Human is detected.");
    return;
  }

  alert("Click on Preview image to set focus point.");
});

const previewBefore = $("previewBefore");
if (previewBefore) {
  previewBefore.addEventListener("click", (e) => {
    const rect = previewBefore.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    manualFocusPoint = { x, y };
    alert("Manual focus point set.");
  });
}

/* =========================
   RESIZE + PREVIEW (HUMAN SAFE)
========================= */

async function processImages(previewOnly = false) {
  if (!imageFiles.length) return alert("Upload images first");

  const tW = parseInt(imgWidth.value || "0");
  const tH = parseInt(imgHeight.value || "0");
  const q = (parseInt(imgQuality.value || "90")) / 100;

  const zip = new JSZip();
  let processed = 0;

  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = tW || img.naturalWidth;
    canvas.height = tH || img.naturalHeight;
    const ctx = canvas.getContext("2d");

    const hasHuman = imageDetectionMap[file.name] === "person";

    let scale;
    if (hasHuman) {
      // ✅ CONTAIN (HUMAN SAFE)
      scale = Math.min(
        canvas.width / img.naturalWidth,
        canvas.height / img.naturalHeight
      );
    } else {
      // ✅ COVER (MANUAL FOCUS ENABLED)
      scale = Math.max(
        canvas.width / img.naturalWidth,
        canvas.height / img.naturalHeight
      );
    }

    const scaledW = img.naturalWidth * scale;
    const scaledH = img.naturalHeight * scale;

    let offsetX = (canvas.width - scaledW) / 2;
    let offsetY = (canvas.height - scaledH) / 2;

    // ✅ APPLY MANUAL FOCUS ONLY IF NO HUMAN
    if (!hasHuman && manualFocusPoint) {
      offsetX = canvas.width / 2 - scaledW * manualFocusPoint.x;
      offsetY = canvas.height / 2 - scaledH * manualFocusPoint.y;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

    const dataUrl = canvas.toDataURL("image/jpeg", q);

    if (previewOnly) {
      previewBefore.src = url;
      $("previewAfter").src = dataUrl;
      $("previewModal").classList.add("active");
      imgStatus.textContent = "Preview opened.";
      return;
    }

    zip.file(file.name.replace(/\..+$/, "") + "_resized.jpg", dataURLToBlob(dataUrl));
    processed++;
    imgProgress.style.width = ((processed / imageFiles.length) * 100) + "%";
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "resized_images.zip";
  a.click();
  imgStatus.textContent = "Done.";
}

imgProcessBtn.addEventListener("click", () => processImages(false));
imgPreviewBtn.addEventListener("click", () => processImages(true));

function dataURLToBlob(dataUrl) {
  const bin = atob(dataUrl.split(",")[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: "image/jpeg" });
}

/* ============================
   FULLSCREEN PREVIEW MODAL
============================ */

const previewModal = $("previewModal");
const previewAfter = $("previewAfter");
const closePreview = $("closePreview");

closePreview.addEventListener("click", () => previewModal.classList.remove("active"));
previewModal.addEventListener("click", e => {
  if (e.target === previewModal) previewModal.classList.remove("active");
});

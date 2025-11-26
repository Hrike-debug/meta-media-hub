/* ==========================================================
   Meta Media Hub - script_v.js
   (LOCKED BASELINE + OPTION 1 PREVIEW PATCH)
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
pwInput.addEventListener("keydown", e => {
  if (e.key === "Enter") unlock();
});

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
   IMAGE RESIZER
========================= */

let imageFiles = [];
let cocoModel = null;

const dropImage = $("dropImage");
const imageInput = $("imageInput");
const imageFileList = $("imageFileList");
const imgWidth = $("imgWidth");
const imgHeight = $("imgHeight");
const imgQuality = $("imgQuality");
const imgQualityVal = $("imgQualityVal");
const imgPreviewBtn = $("imgPreviewBtn");
const imgProcessBtn = $("imgProcessBtn");
const imgStatus = $("imgStatus");
const imgProgress = $("imgProgress");

dropImage.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", e => {
  imageFiles = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
  refreshImageList();
});

function refreshImageList() {
  if (!imageFiles.length) {
    imageFileList.innerHTML = "No files uploaded.";
    return;
  }
  imageFileList.innerHTML = imageFiles.map(f => `<div>${f.name}</div>`).join("");
}

imgQualityVal.textContent = imgQuality.value + "%";
imgQuality.addEventListener("input", () => {
  imgQualityVal.textContent = imgQuality.value + "%";
});

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

    /* ✅ CENTER COVER SCALE (NO STRETCH) */
    const scale = Math.max(
      canvas.width / img.naturalWidth,
      canvas.height / img.naturalHeight
    );

    const scaledW = img.naturalWidth * scale;
    const scaledH = img.naturalHeight * scale;

    const offsetX = (canvas.width - scaledW) / 2;
    const offsetY = (canvas.height - scaledH) / 2;

    ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

    const dataUrl = canvas.toDataURL("image/jpeg", q);

    if (previewOnly) {
      previewBefore.src = url;
      previewAfter.src = dataUrl;
      previewModal.classList.add("active");
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
   AI ENHANCER PREVIEW PATCH
============================ */

const enhanceCanvas = document.createElement("canvas");
const enhanceCtx = enhanceCanvas.getContext("2d");
let lastEnhanceUrl = null;

const dropEnhance = $("dropEnhance");
const enhanceInput = $("enhanceInput");
const enhPreviewBtn = $("enhPreviewBtn");

dropEnhance.addEventListener("click", () => enhanceInput.click());

enhanceInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  enhanceCanvas.width = img.width;
  enhanceCanvas.height = img.height;
  enhanceCtx.drawImage(img, 0, 0);
  lastEnhanceUrl = url;
});

enhPreviewBtn.addEventListener("click", () => {
  if (!enhanceCanvas.width) return alert("Upload image first");
  previewBefore.src = lastEnhanceUrl;
  previewAfter.src = enhanceCanvas.toDataURL("image/jpeg", 0.92);
  previewModal.classList.add("active");
});

/* ============================
   FULLSCREEN PREVIEW MODAL
============================ */

const previewModal = $("previewModal");
const previewBefore = $("previewBefore");
const previewAfter = $("previewAfter");
const closePreview = $("closePreview");

closePreview.addEventListener("click", () => {
  previewModal.classList.remove("active");
});
previewModal.addEventListener("click", e => {
  if (e.target === previewModal)
    previewModal.classList.remove("active");
});

/* ==========================================================
   Meta Media Hub - script_v.js
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

if (isAuthed()) {
  pwModal.style.display = "none";
  statusText.textContent = "Unlocked";
  showSection("home");
}

/* ====================
   THEME
   ==================== */
const themeBtn = $("themeBtn");
const themeModal = $("themeModal");
const closeTheme = $("closeTheme");
const THEME_SAVE_KEY = "mm_theme_choice";

function applyThemeClass(key) {
  const bodies = document.body.className.split(" ").filter(Boolean);
  const filtered = bodies.filter((c) => !c.startsWith("theme-"));
  filtered.push("theme-" + key);
  document.body.className = filtered.join(" ");
  localStorage.setItem(THEME_SAVE_KEY, key);
}

themeBtn.addEventListener("click", () => (themeModal.style.display = "flex"));
closeTheme.addEventListener("click", () => (themeModal.style.display = "none"));

document.querySelectorAll(".theme-card").forEach((card) => {
  card.addEventListener("click", () => {
    applyThemeClass(card.dataset.theme);
    themeModal.style.display = "none";
  });
});

applyThemeClass(localStorage.getItem(THEME_SAVE_KEY) || "flaming-orange");

/* =========================
   IMAGE RESIZER
   ========================= */

let imageFiles = [];
let manualFocusEnabled = false;

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
const imgProgress = $("imgProgress");
const imgStatus = $("imgStatus");

dropImage.addEventListener("click", () => imageInput.click());
dropImage.addEventListener("drop", (e) => {
  e.preventDefault();
  imageFiles = [...e.dataTransfer.files];
  imageFileList.textContent = `${imageFiles.length} file(s) loaded`;
});

imageInput.addEventListener("change", (e) => {
  imageFiles = [...e.target.files];
  imageFileList.textContent = `${imageFiles.length} file(s) loaded`;
});

imgQuality.addEventListener("input", () => {
  imgQualityVal.textContent = imgQuality.value + "%";
});

/* ✅ MANUAL FOCUS TOGGLE (FIXED) */
focusBtn.addEventListener("click", () => {
  manualFocusEnabled = !manualFocusEnabled;
  focusBtn.classList.toggle("active", manualFocusEnabled);
  imgStatus.textContent = manualFocusEnabled
    ? "Manual Focus: Center crop enabled"
    : "Manual Focus: Off";
});

/* ✅ SAFE CENTER CROP LOGIC */
function drawWithManualFocus(ctx, img, w, h) {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const side = Math.min(srcW, srcH);

  const sx = (srcW - side) / 2;
  const sy = (srcH - side) / 2;

  ctx.drawImage(img, sx, sy, side, side, 0, 0, w, h);
}

async function processImages(previewOnly = false) {
  if (!imageFiles.length) {
    alert("Upload images first.");
    return;
  }

  const zip = new JSZip();
  const q = imgQuality.value / 100;
  const tW = parseInt(imgWidth.value || 0);
  const tH = parseInt(imgHeight.value || 0);

  for (let i = 0; i < imageFiles.length; i++) {
    const img = new Image();
    img.src = URL.createObjectURL(imageFiles[i]);
    await img.decode();

    const w = tW || img.naturalWidth;
    const h = tH || img.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    if (manualFocusEnabled) {
      drawWithManualFocus(ctx, img, w, h);
    } else {
      ctx.drawImage(img, 0, 0, w, h);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", q);

    if (previewOnly) {
      const wPrev = window.open("");
      wPrev.document.write(`<img src="${dataUrl}" style="max-width:100%">`);
      return;
    }

    zip.file(`img_${i + 1}.jpg`, dataUrl.split(",")[1], { base64: true });
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "manual_focus_images.zip";
  a.click();

  imgStatus.textContent = "Manual focus processing complete.";
}

imgProcessBtn.addEventListener("click", () => processImages(false));
imgPreviewBtn.addEventListener("click", () => processImages(true));

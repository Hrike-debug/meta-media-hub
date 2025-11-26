/* ==========================================================
   Meta Media Hub - script_v.js
   - Auth / Sections
   - Theme modal
   - Image Resizer (scan + resize + ZIP)
   - AI Enhancer (Upscale, Sharpen-Pro, Denoise, HDR, OCR)
   - Privacy Blur (programmatic stub – no drawing)
   - Preview & Download
   All operations run in-browser. No server calls.
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

  if (home) home.classList.toggle("active", name === "home");
  if (imageSection) imageSection.classList.toggle("active", name === "resize");
  if (enhancerSection) enhancerSection.classList.toggle("active", name === "enhance");
}

function unlock() {
  if (!pwInput) return;
  pwMsg.textContent = "";
  if (pwInput.value === PASSWORD) {
    saveAuth(true);
    if (pwModal) pwModal.style.display = "none";
    if (statusText) statusText.textContent = "Unlocked";
    showSection("home");
    pwInput.value = "";
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

/* ====================
   THEME MODAL
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
  try {
    localStorage.setItem(THEME_SAVE_KEY, key);
  } catch (e) {}
}

if (themeBtn)
  themeBtn.addEventListener("click", () => {
    if (themeModal) themeModal.style.display = "flex";
  });
if (closeTheme)
  closeTheme.addEventListener("click", () => {
    if (themeModal) themeModal.style.display = "none";
  });

document.querySelectorAll(".theme-card").forEach((card) => {
  card.addEventListener("click", () => {
    const t = card.getAttribute("data-theme");
    if (!t) return;
    applyThemeClass(t);
    if (themeModal) themeModal.style.display = "none";
  });
});

const savedTheme = localStorage.getItem(THEME_SAVE_KEY) || "flaming-orange";
applyThemeClass(savedTheme);

/* ====================
   NAVIGATION
   ==================== */
const btnImage = $("btnImage");
const btnEnhancer = $("btnEnhancer");
const backHomeFromImage = $("backHomeFromImage");
const backHomeFromEnhancer = $("backHomeFromEnhancer");

if (btnImage) btnImage.addEventListener("click", () => showSection("resize"));
if (btnEnhancer) btnEnhancer.addEventListener("click", () => showSection("enhance"));
if (backHomeFromImage) backHomeFromImage.addEventListener("click", () => showSection("home"));
if (backHomeFromEnhancer) backHomeFromEnhancer.addEventListener("click", () => showSection("home"));

/* =========================
   IMAGE RESIZER (scan + ZIP)
   ========================= */

let imageFiles = [];
let imageDetectionMap = {};
let cocoModel = null;

const dropImage = $("dropImage");
const imageInput = $("imageInput");
const imageFileList = $("imageFileList");
const smartBanner = $("smartBanner");
const bannerIcon = $("bannerIcon");
const bannerText = $("bannerText");
const imgWidth = $("imgWidth");
const imgHeight = $("imgHeight");
const imgQuality = $("imgQuality");
const imgQualityVal = $("imgQualityVal");
const imgAiToggle = $("imgAiToggle");
const imgPreviewBtn = $("imgPreviewBtn");
const imgProcessBtn = $("imgProcessBtn");
const focusBtn = $("focusBtn");
const imgProgress = $("imgProgress");
const imgStatus = $("imgStatus");

async function loadCoco() {
  if (cocoModel) return cocoModel;
  if (imgStatus) imgStatus.textContent = "Loading model…";
  try {
    cocoModel = await cocoSsd.load();
    if (imgStatus) imgStatus.textContent = "Model ready";
    return cocoModel;
  } catch (e) {
    console.warn("Coco load failed", e);
    if (imgStatus) imgStatus.textContent = "Model failed";
    return null;
  }
}

async function detectPerson(imgEl) {
  try {
    await loadCoco();
    if (!cocoModel) return false;
    const preds = await cocoModel.detect(imgEl);
    return preds.some((p) => p.class === "person");
  } catch (e) {
    console.warn("detectPerson error", e);
    return false;
  }
}

function refreshImageList() {
  if (!imageFileList) return;
  if (!imageFiles.length) {
    imageFileList.innerHTML = "No files uploaded.";
    if (smartBanner) smartBanner.style.display = "none";
    return;
  }
  imageFileList.innerHTML = imageFiles
    .map((f, i) => {
      const st = imageDetectionMap[f.name] || "unknown";
      let icon = "⏳",
        label = "Scanning...";
      if (st === "person") {
        icon = "👤";
        label = "Human found";
      }
      if (st === "none") {
        icon = "❌";
        label = "No person";
      }
      return `<div class="file-row"><span>${icon}</span><div><b>${
        i + 1
      }. ${f.name}</b><br><small>${label} — ${Math.round(
        f.size / 1024
      )} KB</small></div></div>`;
    })
    .join("");
}

async function handleNewImages(files) {
  imageFiles = files;
  imageDetectionMap = {};
  imageFiles.forEach((f) => (imageDetectionMap[f.name] = "unknown"));
  refreshImageList();

  if (!imageFiles.length) return;

  if (smartBanner) {
    smartBanner.style.display = "flex";
    smartBanner.classList.add("off");
  }
  if (bannerText) bannerText.textContent = "Scanning images…";
  if (imgStatus) imgStatus.textContent = "Scanning images…";

  let found = 0;
  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    try {
      await img.decode();
    } catch (e) {}
    const hasPerson = await detectPerson(img);
    imageDetectionMap[file.name] = hasPerson ? "person" : "none";
    if (hasPerson) found++;
    refreshImageList();
    URL.revokeObjectURL(url);
  }

  if (bannerIcon) bannerIcon.textContent = found ? "🟢" : "⚪";
  if (bannerText)
    bannerText.innerHTML = found
      ? `Smart Human Detection: found people in <b>${found}</b> of ${imageFiles.length} image(s).`
      : `Smart Human Detection: no people found.`;
  if (imgAiToggle) imgAiToggle.classList.toggle("active", found > 0);
  if (smartBanner) smartBanner.classList.remove("off");
  if (imgStatus) imgStatus.textContent = "Scan complete.";
}

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
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) await handleNewImages(files);
  });

  imageInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) await handleNewImages(files);
  });
}

if (imgQuality && imgQualityVal) {
  imgQualityVal.textContent = imgQuality.value + "%";
  imgQuality.addEventListener("input", () => {
    imgQualityVal.textContent = imgQuality.value + "%";
  });
}

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

async function processImages(previewOnly = false) {
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
    let w = img.naturalWidth;
    let h = img.naturalHeight;

    if (tW && tH) {
      w = tW;
      h = tH;
    } else if (tW) {
      w = tW;
      h = Math.round(img.naturalHeight * (tW / img.naturalWidth));
    } else if (tH) {
      h = tH;
      w = Math.round(img.naturalWidth * (tH / img.naturalHeight));
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", q);

    if (previewOnly) {
      const wPrev = window.open("");
      if (!wPrev) {
        alert("Popup blocked — allow popups to preview.");
      } else {
        wPrev.document.write(
          `<title>Preview</title><img src="${dataUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`
        );
        wPrev.document.close();
      }
      URL.revokeObjectURL(url);
      if (imgStatus) imgStatus.textContent = "Preview opened for first image.";
      return;
    }

    const blob = dataURLToBlob(dataUrl);
    const base = file.name.replace(/\.[^/.]+$/, "");
    zip.file(base + "_resized.jpg", blob);

    processed++;
    if (imgProgress) imgProgress.style.width =
      ((processed / imageFiles.length) * 100).toFixed(1) + "%";
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

if (imgProcessBtn) {
  imgProcessBtn.addEventListener("click", () => processImages(false));
}
/* ============================
   IMAGE RESIZER FULLSCREEN PREVIEW
   ============================ */

const imgPreviewModal = document.getElementById("imgPreviewModal");
const closeImgPreview = document.getElementById("closeImgPreview");
const previewBeforeImg = document.getElementById("previewBeforeImg");
const previewAfterImg = document.getElementById("previewAfterImg");

if (imgPreviewBtn) {
  imgPreviewBtn.addEventListener("click", async () => {

    if (!imageFiles.length) {
      alert("Upload images first.");
      return;
    }

    const file = imageFiles[0]; // preview only first image (as before)
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode().catch(() => {});

    const tW = parseInt(imgWidth?.value || "0", 10) || img.naturalWidth;
    const tH = parseInt(imgHeight?.value || "0", 10) || img.naturalHeight;
    const q = imgQuality ? (parseInt(imgQuality.value, 10) || 90) / 100 : 0.9;

    const canvas = document.createElement("canvas");
    canvas.width = tW;
    canvas.height = tH;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, tW, tH);

    const afterUrl = canvas.toDataURL("image/jpeg", q);

    // Load modal images
    previewBeforeImg.src = url;
    previewAfterImg.src = afterUrl;

    if (imgPreviewModal) imgPreviewModal.style.display = "flex";

  });
}

if (closeImgPreview) {
  closeImgPreview.addEventListener("click", () => {
    if (imgPreviewModal) imgPreviewModal.style.display = "none";
  });
}

if (focusBtn) {
  focusBtn.addEventListener("click", () => {
    alert(
      "Manual focus cropping is not implemented in this simplified version."
    );
  });
}

/* ============================
   AI ENHANCER SECTION
   ============================ */

let enhanceFiles = [];
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx = enhanceCanvas.getContext("2d");
let currentEnhFile = null;

const dropEnhance = $("dropEnhance");
const enhanceInput = $("enhanceInput");
const enhFileInfo = $("enhFileInfo");
const enhQuality = $("enhQuality");
const enhQualityVal = $("enhQualityVal");
const enhRunBtn = $("enhRunBtn");
const enhPreviewBtn = $("enhPreviewBtn");
const enhOCR = $("enhOCR");
const enhHDR = $("enhHDR");
const enhDenoise = $("enhDenoise");
const enhUpscale2x = $("enhUpscale2x");
const enhUpscale4x = $("enhUpscale4x");
const enhFaceEnhance = $("enhFaceEnhance");
const enhHide = $("enhHide");
const hideAreaBtn = $("hideAreaBtn");
const enhStatus = $("enhStatus");

const previewArea = $("previewArea");
const beforeImg = $("beforeImg");
const afterImg = $("afterImg");

// privacy blur state (no manual drawing now)
let hideRectEnh = null;
let imageNaturalW = 0,
  imageNaturalH = 0;

if (enhQuality && enhQualityVal) {
  enhQualityVal.textContent = enhQuality.value + "%";
  enhQuality.addEventListener("input", () => {
    enhQualityVal.textContent = enhQuality.value + "%";
  });
}

if (dropEnhance && enhanceInput) {
  dropEnhance.addEventListener("click", () => enhanceInput.click());
  dropEnhance.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropEnhance.classList.add("drag-over");
  });
  dropEnhance.addEventListener("dragleave", () => {
    dropEnhance.classList.remove("drag-over");
  });
  dropEnhance.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropEnhance.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files[0]) await loadEnhImage(files[0]);
  });

  enhanceInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files[0]) await loadEnhImage(files[0]);
  });
}

async function loadEnhImage(file) {
  if (!file) return;
  currentEnhFile = file;
  enhanceFiles = [file];

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {}

  imageNaturalW = img.naturalWidth;
  imageNaturalH = img.naturalHeight;

  enhanceCanvas.width = imageNaturalW;
  enhanceCanvas.height = imageNaturalH;
  enhanceCtx.clearRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
  enhanceCtx.drawImage(img, 0, 0, imageNaturalW, imageNaturalH);

  if (beforeImg) beforeImg.src = url;
  if (afterImg)
    afterImg.src = enhanceCanvas.toDataURL(
      "image/jpeg",
      (parseInt(enhQuality?.value || "92", 10) || 92) / 100
    );

  if (enhFileInfo)
    enhFileInfo.textContent = `${file.name} — ${imageNaturalW}×${imageNaturalH}px`;
  if (enhStatus) enhStatus.textContent = "Image loaded. Choose options.";

  hideRectEnh = null;
  URL.revokeObjectURL(url);
}

/* ===========================
   IMAGE PROCESSING FUNCTIONS
   =========================== */

function applyOCRBoost(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    const avg = (r + g + b) / 3;
    const boost = avg > 128 ? 1.06 : 1.18;
    d[i] = clamp(Math.round(r * boost), 0, 255);
    d[i + 1] = clamp(Math.round(g * boost), 0, 255);
    d[i + 2] = clamp(Math.round(b * boost), 0, 255);
  }
  return imageData;
}

function toneChannel(v) {
  if (v < 90) return clamp(Math.round(v * 1.28), 0, 255);
  if (v > 200) return clamp(Math.round(v * 0.9), 0, 255);
  return v;
}
function applyHDRToneMap(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = toneChannel(d[i]);
    d[i + 1] = toneChannel(d[i + 1]);
    d[i + 2] = toneChannel(d[i + 2]);
  }
  return imageData;
}

function boxBlur(imgData, radius) {
  const w = imgData.width,
    h = imgData.height;
  const out = new ImageData(w, h);
  const a = imgData.data,
    b = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        bv = 0,
        cnt = 0;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(h - 1, y + radius); yy++) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(w - 1, x + radius); xx++) {
          const idx = (yy * w + xx) * 4;
          r += a[idx];
          g += a[idx + 1];
          bv += a[idx + 2];
          cnt++;
        }
      }
      const id = (y * w + x) * 4;
      b[id] = Math.round(r / cnt);
      b[id + 1] = Math.round(g / cnt);
      b[id + 2] = Math.round(bv / cnt);
      b[id + 3] = a[id + 3];
    }
  }
  return out;
}

function applyDenoise(imageData) {
  const tmp = boxBlur(imageData, 1);
  const tmp2 = boxBlur(tmp, 1);
  return tmp2;
}

function applySharpen(imageData, amount = 0.6) {
  const blurred = boxBlur(imageData, 1);
  const w = imageData.width,
    h = imageData.height;
  const src = imageData.data,
    blur = blurred.data;
  const out = new ImageData(w, h);
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const val = src[i + c] + amount * (src[i + c] - blur[i + c]);
      dst[i + c] = clamp(Math.round(val), 0, 255);
    }
    dst[i + 3] = src[i + 3];
  }
  return out;
}

function upscaleCanvas(srcCanvas, factor) {
  const dst = document.createElement("canvas");
  dst.width = Math.round(srcCanvas.width * factor);
  dst.height = Math.round(srcCanvas.height * factor);
  const ctx = dst.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(srcCanvas, 0, 0, dst.width, dst.height);
  return dst;
}

function gaussianBlur(imgData, w, h) {
  const weights = [0.1201, 0.2339, 0.292, 0.2339, 0.1201];
  const half = 2;
  const src = imgData.data;
  const tmp = new Uint8ClampedArray(src.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let k = -half; k <= half; k++) {
        const px = Math.min(w - 1, Math.max(0, x + k));
        const idx = (y * w + px) * 4;
        const wgt = weights[k + half];
        r += src[idx] * wgt;
        g += src[idx + 1] * wgt;
        b += src[idx + 2] * wgt;
        a += src[idx + 3] * wgt;
      }
      const id = (y * w + x) * 4;
      tmp[id] = r;
      tmp[id + 1] = g;
      tmp[id + 2] = b;
      tmp[id + 3] = a;
    }
  }

  const out = new ImageData(w, h);
  const outd = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let k = -half; k <= half; k++) {
        const py = Math.min(h - 1, Math.max(0, y + k));
        const idx = (py * w + x) * 4;
        const wgt = weights[k + half];
        r += tmp[idx] * wgt;
        g += tmp[idx + 1] * wgt;
        b += tmp[idx + 2] * wgt;
        a += tmp[idx + 3] * wgt;
      }
      const id = (y * w + x) * 4;
      outd[id] = Math.round(r);
      outd[id + 1] = Math.round(g);
      outd[id + 2] = Math.round(b);
      outd[id + 3] = Math.round(a);
    }
  }
  return out;
}

function blurRegionOnCanvas(ctx, box, passes = 7) {
  if (!box || box.width <= 0 || box.height <= 0) return;
  const imgData = ctx.getImageData(box.x, box.y, box.width, box.height);
  let tmp = imgData;
  for (let i = 0; i < passes; i++) {
    tmp = gaussianBlur(tmp, box.width, box.height);
  }
  ctx.putImageData(tmp, box.x, box.y);
}

/* =================
   ENHANCE RUN / PREVIEW
   ================= */

if (enhRunBtn) {
  enhRunBtn.addEventListener("click", async () => {
    if (!enhanceCanvas.width) {
      alert("Upload an image first!");
      return;
    }
    if (enhStatus) enhStatus.textContent = "Processing…";

    let workCanvas = document.createElement("canvas");
    workCanvas.width = enhanceCanvas.width;
    workCanvas.height = enhanceCanvas.height;
    const wctx = workCanvas.getContext("2d");
    wctx.drawImage(enhanceCanvas, 0, 0);

    if (enhUpscale4x && enhUpscale4x.checked) {
      workCanvas = upscaleCanvas(workCanvas, 4);
    } else if (enhUpscale2x && enhUpscale2x.checked) {
      workCanvas = upscaleCanvas(workCanvas, 2);
    }

    const wctx2 = workCanvas.getContext("2d");
    let id = wctx2.getImageData(0, 0, workCanvas.width, workCanvas.height);

    if (enhDenoise && enhDenoise.checked) {
      id = applyDenoise(id);
    }
    if (enhFaceEnhance && enhFaceEnhance.checked) {
      id = applySharpen(id, 0.9);
    }
    if (enhOCR && enhOCR.checked) {
      id = applyOCRBoost(id);
    }
    if (enhHDR && enhHDR.checked) {
      id = applyHDRToneMap(id);
    }
    if (!(enhFaceEnhance && enhFaceEnhance.checked)) {
      id = applySharpen(id, 0.6);
    }

    wctx2.putImageData(id, 0, 0);

    if (enhHide && enhHide.checked && hideRectEnh) {
      const factor = workCanvas.width / enhanceCanvas.width;
      const box = {
        x: Math.round(hideRectEnh.x * factor),
        y: Math.round(hideRectEnh.y * factor),
        width: Math.round(hideRectEnh.width * factor),
        height: Math.round(hideRectEnh.height * factor),
      };
      blurRegionOnCanvas(wctx2, box, 8);
    }

    const q = enhQuality
      ? (parseInt(enhQuality.value, 10) || 92) / 100
      : 0.92;
    const outDataUrl = workCanvas.toDataURL("image/jpeg", q);

    enhanceCanvas.width = workCanvas.width;
    enhanceCanvas.height = workCanvas.height;
    enhanceCtx.setTransform(1, 0, 0, 1, 0, 0);
    enhanceCtx.clearRect(0, 0, enhanceCanvas.width, enhanceCanvas.height);
    enhanceCtx.drawImage(workCanvas, 0, 0);

    if (afterImg) afterImg.src = outDataUrl;
    if (enhStatus) enhStatus.textContent = "Enhancement complete. Download will start.";

    downloadDataUrl(
      outDataUrl,
      `enhanced_${
        currentEnhFile
          ? currentEnhFile.name.replace(/\.[^/.]+$/, "")
          : Date.now()
      }.jpg`
    );
  });
}

if (enhPreviewBtn) {
  enhPreviewBtn.addEventListener("click", () => {
    if (!enhanceCanvas.width) {
      alert("Upload an image first!");
      return;
    }
    const url = enhanceCanvas.toDataURL(
      "image/jpeg",
      (parseInt(enhQuality?.value || "92", 10) || 92) / 100
    );
    const w = window.open("");
    if (!w) {
      alert("Popup blocked — allow popups to preview.");
      return;
    }
    const html = `<title>Preview</title><img src="${url}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`;
    w.document.write(html);
    w.document.close();
  });
}

/* Hide area button (no annotation now) */
if (hideAreaBtn) {
  hideAreaBtn.addEventListener("click", () => {
    alert(
      "Manual hide area selection was removed with annotation. Privacy blur is disabled in this version."
    );
    if (enhHide) enhHide.checked = false;
    hideRectEnh = null;
  });
}

/* ============================
   Utility: download dataURL
   ============================ */
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}


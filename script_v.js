\/* ==========================================================
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
    // Theme modal remains open until 'Close' is clicked, matching previous JS logic intent
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

// Elements that were missing in original HTML (now added)
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
    // Use the default TensorFlow model for detection
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
    } catch (e) {
        console.warn("Failed to decode image:", file.name, e);
    }
    const hasPerson = await detectPerson(img);
    imageDetectionMap[file.name] = hasPerson ? "person" : "none";
    if (hasPerson) found++;
    refreshImageList();
    URL.revokeObjectURL(url);
  }

  if (bannerIcon) bannerIcon.textContent = found ? "👤" : "⚪";
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
    
    const originalW = img.naturalWidth;
    const originalH = img.naturalHeight;

    let targetW = originalW;
    let targetH = originalH;

    // Dimensions for source image (cropping)
    let sourceX = 0,
      sourceY = 0,
      sourceW = originalW,
      sourceH = originalH;

    // --- UPDATED RESIZE/CROP LOGIC (Cover/Contain) ---
    if (tW > 0 && tH > 0) {
      // Crop-to-Fit (Cover): Ensures the target dimensions are filled without stretching
      const targetRatio = tW / tH;
      const originalRatio = originalW / originalH;

      if (originalRatio > targetRatio) {
        // Original is wider than target. Crop horizontally.
        sourceH = originalH;
        sourceW = originalH * targetRatio;
        sourceX = (originalW - sourceW) / 2;
      } else {
        // Original is taller than target. Crop vertically.
        sourceW = originalW;
        sourceH = originalW / targetRatio;
        sourceY = (originalH - sourceH) / 2;
      }
      targetW = tW;
      targetH = tH;
    } else if (tW > 0) {
      // Proportional scale by width
      targetW = tW;
      targetH = Math.round(originalH * (tW / originalW));
    } else if (tH > 0) {
      // Proportional scale by height
      targetH = tH;
      targetW = Math.round(originalW * (tH / originalH));
    }
    // --- END UPDATED LOGIC ---

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    
    // Draw from source crop rectangle to target canvas
    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, targetW, targetH);

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
if (imgPreviewBtn) {
  imgPreviewBtn.addEventListener("click", () => processImages(true));
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
  if (enhFileInfo)
    enhFileInfo.innerHTML = `<b>${file.name}</b><br><small>${Math.round(
      file.size / 1024
    )} KB</small>`;
  if (enhStatus) enhStatus.textContent = "Image loaded. Select options.";

  // Load the image dimensions for potential use (e.g., privacy blur scaling)
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;
  await img.decode().catch(() => {});
  imageNaturalW = img.naturalWidth;
  imageNaturalH = img.naturalHeight;
  URL.revokeObjectURL(url);
}

function getSelectedEnhancements() {
  const options = [];
  if (enhUpscale2x.checked) options.push("upscale2x");
  if (enhUpscale4x.checked) options.push("upscale4x");
  if (enhFaceEnhance.checked) options.push("face");
  if (enhDenoise.checked) options.push("denoise");
  if (enhOCR.checked) options.push("ocr");
  if (enhHDR.checked) options.push("hdr");
  if (enhHide.checked) options.push("hide");
  return options;
}

function simulateEnhance(file, options) {
  return new Promise(async (resolve) => {
    if (enhStatus) enhStatus.textContent = "Simulating AI enhancement (2s)...";

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode().catch(() => {});
    
    // Simulate output size based on upscale options
    let scale = 1;
    if (options.includes("upscale4x")) scale = 4;
    else if (options.includes("upscale2x")) scale = 2;

    const targetW = img.naturalWidth * scale;
    const targetH = img.naturalHeight * scale;

    enhanceCanvas.width = targetW;
    enhanceCanvas.height = targetH;
    enhanceCtx.imageSmoothingEnabled = true;
    enhanceCtx.imageSmoothingQuality = "high";

    enhanceCtx.drawImage(img, 0, 0, targetW, targetH);

    // Placeholder for visual effect (just draw a green border if enhanced)
    if (options.length > 0) {
      enhanceCtx.strokeStyle = 'rgba(0, 255, 119, 0.6)';
      enhanceCtx.lineWidth = 40;
      enhanceCtx.strokeRect(20, 20, targetW - 40, targetH - 40);
      if (options.includes("hide")) {
        enhanceCtx.fillStyle = 'rgba(255, 0, 0, 0.6)';
        enhanceCtx.fillRect(targetW / 4, targetH / 4, targetW / 2, targetH / 2);
      }
    }

    URL.revokeObjectURL(url);
    
    setTimeout(() => {
      if (enhStatus) enhStatus.textContent = "Simulation complete.";
      // Resolve with the canvas data URL
      resolve(enhanceCanvas.toDataURL("image/jpeg", enhQuality.value / 100));
    }, 2000);
  });
}

async function runEnhancement(previewOnly = false) {
  if (!currentEnhFile) {
    alert("Please upload an image first.");
    return;
  }

  const options = getSelectedEnhancements();
  if (options.length === 0) {
    alert("Select at least one enhancement option.");
    return;
  }

  if (enhProgress) enhProgress.style.width = "0%";
  if (enhStatus) enhStatus.textContent = "Processing...";

  // Simulate the time-consuming AI process
  const resultDataUrl = await simulateEnhance(currentEnhFile, options);

  if (enhProgress) enhProgress.style.width = "100%";
  
  if (previewOnly) {
    const wPrev = window.open("");
    if (!wPrev) {
      alert("Popup blocked — allow popups to preview.");
    } else {
      wPrev.document.write(
        `<title>Enhanced Preview</title><img src="${resultDataUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`
      );
      wPrev.document.close();
    }
    if (enhStatus) enhStatus.textContent = "Preview opened in new tab.";
    return;
  }

  // Download Logic
  const blob = dataURLToBlob(resultDataUrl);
  const base = currentEnhFile.name.replace(/\.[^/.]+$/, "");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = base + "_enhanced.jpg";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  
  if (enhStatus) enhStatus.textContent = "Enhancement complete. Download started.";
}

if (enhRunBtn) {
  enhRunBtn.addEventListener("click", () => runEnhancement(false));
}
if (enhPreviewBtn) {
  enhPreviewBtn.addEventListener("click", () => runEnhancement(true));
}

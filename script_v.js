# Updated HTML + CSS — matched to script_v.js

Below are the fully updated **HTML** and **CSS** files synced to the `script_v.js` you provided. The HTML references the local JS file path so your environment/tooling can transform it to a usable URL.

> **Local JS path used:** `/mnt/data/script_v.js`

---

## index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Meta Media Hub — Image Suite</title>
  <link rel="stylesheet" href="style.css" />
</head>

<body>
  <div class="app-wrap">

    <!-- TOP BAR -->
    <header class="topbar">
      <div class="brand">
        <div class="logo">MM</div>
        <div>
          <h1>Meta Media Hub</h1>
          <span class="tagline">Internal image toolkit for META e-learning</span>
        </div>
      </div>

      <div class="right">
        <button id="themeBtn" class="about-btn" title="Choose Theme">🎨</button>
        <button id="aboutBtn" class="about-btn" title="About this tool">i</button>
        <button id="themeToggle" class="theme-toggle" title="Toggle light/dark">🌙</button>
        <span id="statusText" class="status">Locked</span>
      </div>
    </header>

    <!-- PASSWORD MODAL -->
    <div id="pwModal" class="modal" style="display:flex">
      <div class="modal-panel pw-panel">
        <h2>Enter Password</h2>
        <p class="small">Unlock the Meta Media Hub</p>
        <input id="pwInput" class="input" type="password" placeholder="Password" />
        <button id="pwBtn" class="btn primary full">Unlock</button>
        <p id="pwMsg" class="error"></p>
      </div>
    </div>

    <!-- HOME -->
    <section id="home" class="home-section" style="display:none">
      <div class="tool-card" id="btnImage">
        <div class="icon">🖼️</div>
        <h3>Image Tools</h3>
        <p>Resize • Smart Center • Human Detection</p>
      </div>

      <div class="tool-card" id="btnEnhancer">
        <div class="icon">✨</div>
        <h3>AI Image Enhancer</h3>
        <p>Upscale • Sharpen • Denoise • HDR • Text clarity</p>
      </div>
    </section>

    <!-- IMAGE RESIZER SECTION -->
    <section id="imageSection" class="section" style="display:none">
      <div class="section-header">
        <div>
          <h2>Image Tools</h2>
          <p class="subtitle">Batch resize with smart human detection & manual focus.</p>
        </div>
        <button id="backHomeFromImage" class="back-btn">← Home</button>
      </div>

      <div id="smartBanner" class="smart-banner off" style="display:none">
        <div id="bannerIcon" class="s-icon">⚪</div>
        <div id="bannerText" class="s-text">Smart Human Detection status will appear here after scanning.</div>
      </div>

      <div class="panel">
        <div id="dropImage" class="dropzone">Click or drag & drop images here (multiple)</div>
        <input id="imageInput" type="file" accept="image/*" multiple>
        <div id="imageFileList" class="file-list">No files uploaded.</div>

        <div class="two-input">
          <input id="imgWidth" class="input" type="number" placeholder="Width (px)">
          <input id="imgHeight" class="input" type="number" placeholder="Height (px)">
        </div>

        <div class="controls">
          <div class="mini-control">
            <label>Quality</label>
            <div class="help-tip" data-tip="Higher quality = better clarity but heavier file size. 90% works well for most LMS assets.">?</div>
          </div>
          <input id="imgQuality" type="range" min="60" max="100" value="90">
          <span id="imgQualityVal">90%</span>

          <div class="flex-spacer"></div>

          <div id="imgAiToggle" class="ai-switch" title="Smart Human Detection">
            <div class="track"><div class="ball"></div></div>
            <span class="label-off">Smart Detection: OFF</span>
            <span class="label-on">Smart Detection: ON</span>
          </div>
        </div>

        <div class="btn-row">
          <button id="imgPreviewBtn" class="btn ghost">Preview First</button>
          <button id="focusBtn" class="btn ghost">Manual Focus</button>
          <button id="imgProcessBtn" class="btn primary">Process</button>
        </div>

        <div class="progress"><div id="imgProgress" class="bar"></div></div>
        <p id="imgStatus" class="status-text">Ready.</p>
      </div>

      <footer class="footer">Created by Mukesh Yadav • META E-learning Team</footer>
    </section>

    <!-- AI IMAGE ENHANCER SECTION -->
    <section id="enhancerSection" class="section" style="display:none">
      <div class="section-header">
        <div>
          <h2>AI Image Enhancer</h2>
          <p class="subtitle">Improve quality: upscale, sharpen, denoise, HDR & text clarity — right in the browser.</p>
        </div>
        <button id="backHomeFromEnhancer" class="back-btn">← Home</button>
      </div>

      <div class="panel enhancer-layout">
        <div class="enh-left">
          <h3 class="panel-title">Upload Image</h3>
          <div id="dropEnhance" class="dropzone">Click or drag & drop a single image</div>
          <input id="enhanceInput" type="file" accept="image/*">
          <div id="enhFileInfo" class="file-list small-file">No image selected.</div>
          <p class="small-muted">Ideal for portraits, key visuals, LMS screenshots, thumbnails and hero images.</p>
        </div>

        <div class="enh-right">
          <h3 class="panel-title">Enhancement Options</h3>
          <div class="ai-panel">
            <div class="ai-panel-header">
              <span class="label">Smart Enhancements (processed locally)</span>
              <div class="help-tip" data-tip="These processors work directly in your browser using Canvas. No upload, no server, safe for internal projects.">?</div>
            </div>

            <div class="ai-options">
              <label class="ai-option"><input type="checkbox" id="enhUpscale2x"><span>Upscale ×2</span></label>
              <label class="ai-option"><input type="checkbox" id="enhUpscale4x"><span>Upscale ×4</span></label>
              <label class="ai-option"><input type="checkbox" id="enhFaceEnhance"><span>Boost Faces & Detail</span></label>
              <label class="ai-option"><input type="checkbox" id="enhDenoise"><span>Denoise & Sharpen</span></label>
              <label class="ai-option"><input type="checkbox" id="enhOCR"><span>Text / OCR Clarity</span></label>
              <label class="ai-option"><input type="checkbox" id="enhHDR"><span>HDR Boost (Shadows & Highlights)</span></label>
              <label class="ai-option"><input type="checkbox" id="enhHide"><span>Object Hide / Privacy Blur</span></label>
            </div>

            <div class="btn-row small-row">
              <button id="hideAreaBtn" class="btn ghost">Set Hide Area</button>
            </div>

            <p class="ai-note">These filters gently improve clarity, contrast and reduce noise using on-device processing. No server, no upload.</p>
          </div>

          <div class="two-input">
            <div class="mini-control">
              <label class="small-label">Output Quality</label>
              <div class="help-tip" data-tip="Controls JPEG export quality. 92% is a sweet spot between clarity and file size.">?</div>
              <input id="enhQuality" type="range" min="70" max="100" value="92">
              <span id="enhQualityVal" class="mini-val">92%</span>
            </div>
          </div>

          <div class="btn-row">
            <button id="enhPreviewBtn" class="btn ghost">Preview</button>
            <button id="enhRunBtn" class="btn primary">Enhance & Download</button>
          </div>

          <div class="progress"><div id="enhProgress" class="bar"></div></div>
          <p id="enhStatus" class="status-text">Waiting for image.</p>
        </div>
      </div>

      <!-- ANNOTATION / PREVIEW AREA -->
      <div class="panel" style="margin-top:14px">
        <div class="panel-title">Annotate / Preview</div>

        <div id="previewArea" class="preview-area" aria-hidden="true">
          <img id="beforeImg" alt="Before" />
          <div id="afterLayer" class="after-layer"><img id="afterImg" alt="After" /></div>
          <canvas id="annoCanvas" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:auto;"></canvas>
          <div id="annoHandle" class="handle" style="display:none"></div>
        </div>

        <div id="annoToolbar" class="annotation-toolbar" style="display:none">
          <div class="controls-row">
            <button class="anno-btn" data-tool="rect">Rectangle</button>
            <button class="anno-btn" data-tool="arrow">Arrow</button>
            <button class="anno-btn" data-tool="text">Text</button>
            <button class="anno-btn" data-tool="highlight">Highlight</button>
            <button class="anno-btn" data-tool="blur">Blur area</button>
            <button class="anno-btn" id="annUndo">Undo</button>
            <button class="anno-btn" id="annClear">Clear</button>
            <label class="anno-control">Color <input id="annColor" type="color" value="#ff7a3c"></label>
            <label class="anno-control">Size <input id="annSize" type="range" min="1" max="30" value="4"></label>
            <button id="annApply" class="btn primary">Apply</button>
          </div>
          <div class="small muted" style="margin-top:8px">Draw on the image, then click Apply to merge annotations to the current enhanced image (client-only).</div>
        </div>
      </div>

    </section>

    <footer class="footer" style="margin-top:18px">Created by Mukesh Yadav • META E-learning Team</footer>

  </div>

  <!-- THEME MODAL -->
  <div id="themeModal" class="modal">
    <div class="modal-panel theme-panel">
      <div class="modal-head">
        <h3>Select Theme</h3>
        <button id="closeTheme" class="close-btn">✕</button>
      </div>
      <div class="theme-grid">
        <div class="theme-card" data-theme="dark-glass"><div class="theme-preview tg-dark"></div><h4>Dark Glass</h4></div>
        <div class="theme-card" data-theme="cyber-tech"><div class="theme-preview tg-cyber"></div><h4>Cyber Tech</h4></div>
        <div class="theme-card" data-theme="retro-beige"><div class="theme-preview tg-retro"></div><h4>Retro Beige</h4></div>
        <div class="theme-card" data-theme="flaming-orange"><div class="theme-preview tg-orange"></div><h4>Flaming Orange</h4></div>
      </div>
    </div>
  </div>

  <!-- ABOUT MODAL -->
  <div id="aboutModal" class="modal">
    <div class="modal-panel about-panel">
      <div class="modal-head">
        <div class="about-head">
          <span class="about-pill">About</span>
          <h3>Meta Media Hub</h3>
          <p>Internal image toolkit for fast, safe e-learning & media production.</p>
        </div>
        <button id="closeAbout" class="close-btn">✕</button>
      </div>
      <div class="about-grid">
        <div class="about-col">
          <h4>What it does</h4>
          <ul>
            <li>Batch resize with smart human detection</li>
            <li>Manual focus cropping for key subjects</li>
            <li>AI-style enhancement (upscale, sharpen, denoise)</li>
            <li>Download enhanced image</li>
          </ul>
        </div>
        <div class="about-col">
          <h4>Safety & workflow</h4>
          <ul>
            <li>All processing stays inside your browser</li>
            <li>No uploads, no cloud, safe for confidential assets</li>
            <li>Designed for META e-learning & media teams</li>
            <li>Ideal for ILTs, WBTs, storyboards & thumbnails</li>
          </ul>
        </div>
      </div>
      <div class="about-footer-row">
        <span class="about-meta">v1.6 • Designed & built by <strong>Mukesh Yadav</strong></span>
        <span class="about-meta">Contact: META E-learning / Media team</span>
      </div>
    </div>
  </div>

  <!-- IMPORTANT: reference your local JS file here -->
  <!-- The environment/tooling will transform this local path to a served URL -->
  <script src="/mnt/data/script_v.js"></script>
</body>
</html>
```

---

## style.css

```css
/* Updated / cleaned CSS matched to the HTML & script_v.js */
:root{ --bg:#060608; --card:#111217; --panel:#15161d; --text:#f3f3f6; --muted:#8f93a2; --accent:#ff7a3c; --accent-light:#ffb27a; --border:rgba(255,255,255,0.08); --shadow:0 20px 60px rgba(0,0,0,0.80); }

.theme-light{ --bg:#f7f3ef; --card:#ffffff; --panel:#fdf8f4; --text:#140f0b; --muted:#6c5b4d; --accent:#c65424; }
html,body{ height:100%; margin:0; background:var(--bg); color:var(--text); font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Inter', Arial, sans-serif; }
.app-wrap{ max-width:1100px; margin:auto; padding:26px; }
.topbar{ display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
.brand{ display:flex; align-items:center; gap:12px; }
.logo{ width:46px; height:46px; border-radius:12px; background:radial-gradient(circle at 0 0, var(--accent), #2b0e07); display:flex; align-items:center; justify-content:center; color:#fff4eb; font-weight:700; }
.right{ display:flex; align-items:center; gap:10px; }
.theme-toggle{ background:transparent; border:0; cursor:pointer; font-size:18px; }
.status{ color:var(--muted); }
.about-btn{ width:36px; height:36px; border-radius:8px; border:1px solid var(--border); background:linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); color:var(--accent-light); }
.home-section{ display:flex; justify-content:center; gap:24px; padding:36px 0 8px; }
.tool-card{ width:320px; padding:26px; border-radius:18px; background:radial-gradient(circle at top left, rgba(255,122,60,0.18), transparent 55%), var(--panel); border:1px solid rgba(255,255,255,0.05); box-shadow:var(--shadow); cursor:pointer; text-align:center; }
.section{ opacity:0; transition:opacity .35s; }
.section.active{ opacity:1; }
.panel{ background:var(--panel); border-radius:12px; padding:16px; border:1px solid rgba(255,255,255,0.06); }
.dropzone{ padding:18px; border-radius:12px; border:1px dashed rgba(255,255,255,0.18); cursor:pointer; text-align:center; }
.file-list{ margin-top:8px; padding:10px; background:rgba(0,0,0,0.35); border-radius:8px; max-height:160px; overflow:auto; }
.two-input{ display:flex; gap:10px; margin:12px 0; }
.input{ padding:10px; border-radius:10px; border:1px solid var(--border); background:var(--card); color:var(--text); }
.controls{ display:flex; align-items:center; gap:10px; }
.btn{ padding:10px 14px; border-radius:999px; border:0; cursor:pointer; }
.btn.primary{ background:linear-gradient(135deg,var(--accent),#c65424); color:#200b05; }
.btn.ghost{ background:transparent; border:1px solid rgba(255,255,255,0.08); color:var(--text); }
.progress{ height:10px; background:rgba(255,255,255,0.04); border-radius:999px; overflow:hidden; }
.progress .bar{ height:100%; width:0; background:var(--accent); }
.preview-area{ position:relative; height:420px; background:#000; border-radius:12px; overflow:hidden; margin-top:10px; }
.preview-area img{ position:absolute; top:0; left:0; width:100%; height:100%; object-fit:contain; pointer-events:none; }
.after-layer{ position:absolute; top:0; left:0; height:100%; overflow:hidden; pointer-events:none; }
.annotation-toolbar{ margin-top:12px; padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.04); }
.anno-btn{ padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:var(--text); }
.anno-btn.active{ background:var(--accent); color:#120000; }
.anno-control{ margin-left:8px; }
.anno-btn, .anno-control input{ vertical-align:middle; }
.anno-control input[type="color"]{ width:36px; height:28px; padding:0; border-radius:6px; border:1px solid rgba(0,0,0,0.12); }
.modal{ position:fixed; inset:0; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.7); }
.modal-panel{ background:var(--card); padding:16px; border-radius:12px; max-width:900px; width:92%; }
.small-muted{ color:var(--muted); }
.footer{ text-align:center; margin-top:20px; color:var(--muted); }

/* responsive */
@media (max-width:880px){ .enhancer-layout{ grid-template-columns:1fr; } .two-input{ flex-direction:column; } }
```

---

### Notes / instructions

* I referenced your JS from the local path: `/mnt/data/script_v.js`. If your environment requires a different path, replace the `<script src="/mnt/data/script_v.js"></script>` line in the HTML with the served URL.
* The HTML/CSS are aligned to the IDs and elements used in the `script_v.js` you supplied. No other JS changes should be required.
* I removed ZIP export text from buttons since you said you don't need it.
* If you want the files packaged separately (actual `.html` and `.css` files) I can create downloadable files next.

---

If you want, I can now:

* produce separate downloadable `index.html` and `style.css` files, or
* embed the CSS inline into the HTML, or
* test a quick small JS fix for any remaining UI bugs you reported.

Tell me which next step you want.

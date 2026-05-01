// Constantes configuration
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const OCEANOS_AI_URL = "/OceanOS/api/ai.php";
const OCEANOS_GROQ_URL = "/OceanOS/api/groq.php";
const OCEANOS_NAUTIPOST_URL = "/OceanOS/api/nautipost.php";
const MAX_HISTORY = 20;
const HISTORY_THUMB_MAX_WIDTH = 520;
const HISTORY_THUMB_QUALITY = 0.72;

// Configurations par réseau
const NETWORKS_CONF = {
  linkedin: {
    name: "LinkedIn",
    limit: 3000,
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .78 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .78 23.2 0 22.22 0z"/></svg>`,
    prompt: "Génère un post LinkedIn (Max 3000 caractères). Style Professionnel B2B, accroche forte, appel à l'action. 3 à 5 hashtags pertinents maximum."
  },
  facebook: {
    name: "Facebook",
    limit: 2000,
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.07C24 5.44 18.63 0 12 0S0 5.44 0 12.07C0 18.06 4.39 23.03 10.13 23.93v-8.39H7.08v-3.47h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95H15.83c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.39C19.61 23.03 24 18.06 24 12.07z"/></svg>`,
    prompt: "Génère un post Facebook (Max 2000 caractères). Style Convivial, storytelling, émotionnel, centré sur la communauté ou les plaisanciers. 3 à 4 hashtags."
  },
  instagram: {
    name: "Instagram",
    limit: 2200,
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#E1306C"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92 1.27-.06 1.65-.07 4.85-.07zm0-2.16C8.74 0 8.33.01 7.05.07 2.69.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.36-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.69 21.31.27 16.95.07 15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1012 18.16 6.16 6.16 0 0012 5.84zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"/></svg>`,
    prompt: "Génère un post Instagram (Max 2200 caractères). Style Lifestyle nautique, très visuel, emojis marins fréquents (⚓⛵🌊). 15 à 20 hashtags pertinents en bas."
  },
  twitter: {
    name: "X / Twitter",
    limit: 280,
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24H16.17l-4.71-6.23-5.4 6.23H2.74l7.73-8.83L1.25 2.25H8.08l4.26 5.63 5.91-5.63zm-1.16 17.52h1.83L7.08 4.13H5.12z"/></svg>`,
    prompt: "Génère un tweet (Max 280 caractères, strict !). Style ultra concis, percutant, direct au but. 1 à 2 hashtags courts."
  }
};

// État de l'application
let state = {
  apiKey: "",
  image: null,
  history: []
};

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[NautiPost] Stockage local ignore (${key}):`, error.message || error);
    return false;
  }
}

function safeLocalStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {}
}

function readLocalHistory() {
  try {
    const history = JSON.parse(localStorage.getItem("nautipost_history") || "[]");
    return Array.isArray(history) ? history : [];
  } catch (error) {
    safeLocalStorageRemove("nautipost_history");
    return [];
  }
}

function persistLocalHistory(history) {
  const slimHistory = (Array.isArray(history) ? history : [])
    .slice(0, MAX_HISTORY)
    .map(item => ({
      ...item,
      image: item.thumbnail || item.image || "",
    }));

  if (safeLocalStorageSet("nautipost_history", JSON.stringify(slimHistory))) {
    return true;
  }

  const textOnlyHistory = slimHistory.map(item => ({ ...item, image: "" }));
  return safeLocalStorageSet("nautipost_history", JSON.stringify(textOnlyHistory));
}

// DOM Elements
const DOM = {
  // Theme
  btnTheme: document.getElementById('btn-theme'),
  iconSun: document.getElementById('icon-sun'),
  iconMoon: document.getElementById('icon-moon'),
  
  // Modals
  modalSettings: document.getElementById('modal-settings'),
  modalHistory: document.getElementById('modal-history'),
  btnSettings: document.getElementById('btn-settings'),
  btnHistory: document.getElementById('btn-history'),
  
  // Settings
  inputApiKey: document.getElementById('input-api-key'),
  btnToggleKey: document.getElementById('btn-toggle-key'),
  iconEye: document.getElementById('icon-eye'),
  iconEyeOff: document.getElementById('icon-eye-off'),
  btnSaveKey: document.getElementById('btn-save-key'),
  keyStatus: document.getElementById('key-status'),
  
  // History
  historyList: document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
  btnClearHistory: document.getElementById('btn-clear-history'),
  
  // Form elements
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  dropPlaceholder: document.getElementById('drop-placeholder'),
  dropPreview: document.getElementById('drop-preview'),
  previewImg: document.getElementById('preview-img'),
  btnRemoveImg: document.getElementById('btn-remove-image'),
  inputInfo: document.getElementById('input-product-info'),
  btnGenerate: document.getElementById('btn-generate'),
  apiKeyWarning: document.getElementById('api-key-warning'),
  formWarning: document.getElementById('form-warning'),
  
  // Studio
  toggleStudio: document.getElementById('toggle-studio'),
  studioOptions: document.getElementById('studio-options'),
  inputStudioHook: document.getElementById('input-studio-hook'),
  
  genText: document.getElementById('gen-text'),
  genIcon: document.getElementById('gen-icon'),
  genLoader: document.getElementById('gen-loader'),
  
  // Results
  resultsEmpty: document.getElementById('results-empty'),
  resultsContainer: document.getElementById('results-container'),
  
  // Toast
  toast: document.getElementById('toast')
};

// --- INITIALISATION ---
function init() {
  themeInit();
  eventsInit();
  updateUIState();
  renderHistory();
  void loadOceanOSAiSettings();
  void loadNautiPostHistory();
}

async function loadNautiPostHistory() {
  try {
    const response = await fetch(OCEANOS_NAUTIPOST_URL, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || payload.error || "Historique OceanOS indisponible.");
    }
    state.history = await normalizeHistoryForDevice(payload.history);
    persistLocalHistory(state.history);
  } catch (error) {
    state.history = await normalizeHistoryForDevice(readLocalHistory());
  }
  renderHistory();
}

async function loadOceanOSAiSettings() {
  try {
    const response = await fetch(OCEANOS_AI_URL, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || payload.error || "Configuration OceanOS indisponible.");
    }
    state.apiKey = payload?.settings?.hasApiKey ? "oceanos" : "";
    DOM.inputApiKey.value = payload?.settings?.hasApiKey ? "Geree dans OceanOS" : "";
    DOM.inputApiKey.disabled = true;
    DOM.btnToggleKey.disabled = true;
    DOM.btnSaveKey.textContent = "Ouvrir la configuration OceanOS";
    DOM.keyStatus.textContent = payload?.settings?.hasApiKey
      ? `Cle OceanOS active - modele ${payload.settings.model}`
      : "Aucune cle Groq configuree dans OceanOS.";
    DOM.keyStatus.classList.remove("hidden");
  } catch (error) {
    state.apiKey = "";
    DOM.inputApiKey.value = "";
    DOM.inputApiKey.disabled = true;
    DOM.btnToggleKey.disabled = true;
    DOM.btnSaveKey.textContent = "Ouvrir la configuration OceanOS";
    DOM.keyStatus.textContent = error.message || "Configuration OceanOS indisponible.";
    DOM.keyStatus.classList.remove("hidden");
  }
  updateUIState();
}

// --- THEME THEME THEME ---
function themeInit() {
  const savedTheme = localStorage.getItem('nautipost_theme') || 
                    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);
  
  DOM.btnTheme.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    safeLocalStorageSet('nautipost_theme', newTheme);
    updateThemeIcons(newTheme);
  });
}

function updateThemeIcons(theme) {
  if (theme === 'dark') {
    DOM.iconSun.style.display = 'none';
    DOM.iconMoon.style.display = 'block';
  } else {
    DOM.iconSun.style.display = 'block';
    DOM.iconMoon.style.display = 'none';
  }
}

// --- GESTION DES EVENEMENTS ---
function eventsInit() {
  // Modals (Ouverture / Fermeture)
  DOM.btnSettings.addEventListener('click', () => DOM.modalSettings.classList.remove('hidden'));
  DOM.btnHistory.addEventListener('click', () => DOM.modalHistory.classList.remove('hidden'));
  
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal-overlay').classList.add('hidden');
    });
  });
  
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  // Studio Toggle
  DOM.toggleStudio.addEventListener('change', (e) => {
    DOM.studioOptions.classList.toggle('hidden', !e.target.checked);
  });

  // Settings action
  DOM.btnToggleKey.addEventListener('click', () => {
    const type = DOM.inputApiKey.type === 'password' ? 'text' : 'password';
    DOM.inputApiKey.type = type;
    if (type === 'text') {
      DOM.iconEye.style.display = 'none';
      DOM.iconEyeOff.style.display = 'block';
    } else {
      DOM.iconEye.style.display = 'block';
      DOM.iconEyeOff.style.display = 'none';
    }
  });

  DOM.btnSaveKey.addEventListener('click', () => {
    window.location.href = "/OceanOS/#ia";
  });

  // Image Drag & Drop
  DOM.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.dropZone.classList.add('dragover');
  });
  
  DOM.dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    DOM.dropZone.classList.remove('dragover');
  });
  
  DOM.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImage(e.dataTransfer.files[0]);
    }
  });
  
  DOM.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImage(e.target.files[0]);
    }
  });

  DOM.btnRemoveImg.addEventListener('click', (e) => {
    e.stopPropagation();
    state.image = null;
    DOM.fileInput.value = "";
    DOM.dropPreview.classList.add('hidden');
    DOM.dropPlaceholder.classList.remove('hidden');
    updateUIState();
  });

  // Historique action
  DOM.btnClearHistory.addEventListener('click', () => {
    if (confirm("Voulez-vous vraiment supprimer tout l'historique ?")) {
      state.history = [];
      safeLocalStorageRemove("nautipost_history");
      void clearNautiPostHistory();
      renderHistory();
      showToast("Historique vidé");
    }
  });

  // Validation formulaire & réseaux
  document.querySelectorAll('input[name="network"]').forEach(cb => {
    cb.addEventListener('change', updateUIState);
  });

  // Génération
  DOM.btnGenerate.addEventListener('click', handleGenerate);
}

// --- LOGIQUE IMAGE ---
function handleImage(file) {
  // Verif type
  if (!file.type.match(/image\/(jpeg|png|webp)/)) {
    showToast("Format invalide. JPG, PNG ou WEBP attendu.");
    return;
  }
  
  // Verif taille (10Mo)
  if (file.size > 10 * 1024 * 1024) {
    showToast("Fichier trop volumineux (Max 10 Mo).");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    state.image = {
      base64: e.target.result,
      type: file.type
    };
    DOM.previewImg.src = e.target.result;
    DOM.dropPlaceholder.classList.add('hidden');
    DOM.dropPreview.classList.remove('hidden');
    updateUIState();
  };
  reader.readAsDataURL(file);
}

function createHistoryThumbnail(base64Image) {
  return new Promise((resolve) => {
    if (!base64Image) {
      resolve("");
      return;
    }

    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, HISTORY_THUMB_MAX_WIDTH / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', HISTORY_THUMB_QUALITY));
    };
    img.onerror = () => resolve("");
    img.src = base64Image;
  });
}

async function normalizeHistoryForDevice(history) {
  const items = (Array.isArray(history) ? history : []).slice(0, MAX_HISTORY);
  return Promise.all(items.map(async (item) => {
    const image = item.thumbnail || item.image || "";
    if (image && image.length > 280000) {
      return { ...item, image: await createHistoryThumbnail(image) };
    }
    return { ...item, image };
  }));
}

// --- LOGIQUE UI ---
function updateUIState() {
  const hasKey = !!state.apiKey;
  const hasImage = !!state.image;
  const selectedNetworks = document.querySelectorAll('input[name="network"]:checked').length;
  
  // Header Warnings
  DOM.apiKeyWarning.classList.toggle('hidden', hasKey);
  
  // Disable / Enable Generate
  if (!hasKey || !hasImage || selectedNetworks === 0) {
    DOM.btnGenerate.disabled = true;
    DOM.formWarning.classList.toggle('hidden', selectedNetworks > 0 || !hasKey);
    if (!hasImage && hasKey) {
        DOM.formWarning.textContent = "⚠️ Veuillez sélectionner une image produit.";
        DOM.formWarning.classList.remove('hidden');
    } else if (selectedNetworks === 0 && hasImage && hasKey) {
        DOM.formWarning.textContent = "⚠️ Veuillez sélectionner au moins un réseau.";
        DOM.formWarning.classList.remove('hidden');
    } else {
        DOM.formWarning.classList.add('hidden');
    }
  } else {
    DOM.btnGenerate.disabled = false;
    DOM.formWarning.classList.add('hidden');
  }
}

function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.remove('hidden');
  setTimeout(() => DOM.toast.classList.add('hidden'), 3000);
}

function setLoading(isLoading) {
  DOM.btnGenerate.disabled = isLoading;
  DOM.genIcon.classList.toggle('hidden', isLoading);
  DOM.genLoader.classList.toggle('hidden', !isLoading);
  DOM.genText.textContent = isLoading ? "Génération via IA en cours..." : "Générer les publications";
  
  // Lock config while loading
  DOM.dropZone.style.pointerEvents = isLoading ? 'none' : 'auto';
  DOM.inputInfo.disabled = isLoading;
  document.querySelectorAll('input[name="tone"], input[name="network"]').forEach(el => el.disabled = isLoading);
}

// --- MOTEUR DE GÉNÉRATION API ---
async function handleGenerate() {
  if (!state.apiKey) return showToast("Cle Groq manquante dans OceanOS");
  if (!state.image) return showToast("Image manquante");
  
  const selectedNetworks = Array.from(document.querySelectorAll('input[name="network"]:checked')).map(el => el.value);
  const selectedTone = document.querySelector('input[name="tone"]:checked').value;
  const productInfo = DOM.inputInfo.value.trim();
  
  const isStudioEnabled = DOM.toggleStudio.checked;
  const studioStyle = document.querySelector('input[name="studio_style"]:checked')?.value || 'bandeau';
  const customHook = DOM.inputStudioHook.value.trim();
  
  setLoading(true);
  DOM.resultsEmpty.classList.add('hidden');
  DOM.resultsContainer.classList.remove('hidden');
  DOM.resultsContainer.innerHTML = ''; // reset results
  
  // Extract base64 parts
  const base64Data = state.image.base64.split(',')[1];
  const mediaType = state.image.type;

  // On lance en parallèle
  const promises = selectedNetworks.map(network => 
    generateForNetwork(network, NETWORKS_CONF[network], selectedTone, productInfo, base64Data, mediaType, isStudioEnabled, studioStyle, customHook)
  );

  try {
    await Promise.allSettled(promises);
    showToast("Génération terminée !");
  } catch (err) {
    console.error(err);
    showToast("Une erreur critique est survenue.");
  } finally {
    setLoading(false);
    renderHistory(); // Refresh history panel
  }
}

async function generateForNetwork(networkId, config, tone, productInfo, b64Data, mediaType, isStudio, studioStyle, customHook) {
  // Créer la carte de résultat avec skeleton loading
  const cardId = `result-${networkId}`;
  DOM.resultsContainer.insertAdjacentHTML('beforeend', `
    <div id="${cardId}" class="result-card">
      <div class="result-header">
        <div class="result-network">${config.icon} ${config.name}</div>
        <div class="char-count">Génération...</div>
      </div>
      <div class="result-body" style="color:var(--text-muted); font-style:italic;">
        L'IA rédige votre contenu... ⏳
      </div>
    </div>
  `);

  const infoStr = productInfo ? `\nInformations supplémentaires du produit:\n${productInfo}` : "";
  let studioPrompt = "";
  if (isStudio && !customHook) {
    // Demander le HOOK uniquement si on a pas déjà l'accroche custom !
    studioPrompt = `\n\nINSTRUCTION CAPITALE: Tu dois OBLIGATOIREMENT commencer TOUTE ta réponse par la balise [HOOK: suivie d'une très courte accroche de 2 à 4 mots max] puis un saut de ligne. Exemple: [HOOK: Nouveauté 389€]. Ensuite, écris la publication.`;
  }

  const promptText = `En tant qu'expert marketing spécialisé dans l'accastillage nautique et l'équipement de bateaux, ta mission est de créer la publication parfaite.
${config.prompt}
Ton ciblé : ${tone}.
Analyses la photo jointe et intègres-y ses détails de manière fluide. ${infoStr}${studioPrompt}

IMPORTANT: Ne réponds qu'avec le texte final prêt à être publié, sans aucun texte d'introduction ni de conclusion, ni de guillemets autour de tout le post.`;

  try {
    const response = await fetch(OCEANOS_GROQ_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: `data:${mediaType};base64,${b64Data}` } }
          ]
        }],
        max_tokens: 1024
      })
    });

    const payload = await response.json();

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || payload.error || "Erreur API");
    }

    const data = payload.data;
    let generatedText = data.choices[0].message.content.trim();
    let hookText = customHook || null;

    if (isStudio) {
      if (!customHook) {
        // Obtenir le HOOK généré par l'IA
        const hookMatch = generatedText.match(/\[HOOK:\s*(.*?)\]/i);
        if (hookMatch) {
          hookText = hookMatch[1].trim();
          generatedText = generatedText.replace(hookMatch[0], '').trim();
        } else {
          hookText = "Exclu NautiPost"; // Fallback robuste
        }
      } else {
        // Eviter une hallucination rare de l'IA qui crache un [HOOK:]
        generatedText = generatedText.replace(/\[HOOK:\s*.*?\]/ig, '').trim(); 
      }
    }
    
    // Genérer l'image retravaillée
    let finalImageUrl = null;
    if (isStudio && hookText) {
      finalImageUrl = await createPromoImage(state.image.base64, hookText, studioStyle);
    }

    showResult(cardId, networkId, config, generatedText, finalImageUrl);
    void saveToHistory(networkId, generatedText, finalImageUrl || state.image.base64);

  } catch (error) {
    console.error(`Erreur ${config.name}:`, error);
    document.getElementById(cardId).querySelector('.result-body').innerHTML = 
      `<span style="color:var(--danger)">❌ Échec de la génération : ${error.message}</span>`;
    document.getElementById(cardId).querySelector('.char-count').textContent = "Erreur";
  }
}

function showResult(cardId, networkId, config, text, finalImageUrl) {
  const card = document.getElementById(cardId);
  const count = text.length;
  const isTooLong = count > config.limit;
  
  card.querySelector('.result-body').textContent = text;
  card.querySelector('.char-count').innerHTML = `
    <span class="${isTooLong ? 'error' : ''}">${count}</span> / ${config.limit}
  `;
  
  // Injecter l'image studio si elle existe
  if (finalImageUrl) {
    card.insertAdjacentHTML('beforeend', `
      <div class="result-studio-container">
        <img src="${finalImageUrl}" alt="Visuel Généré" class="result-studio-img" />
        <a href="${finalImageUrl}" download="NautiPost-${networkId}.jpg" class="btn-download">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Télécharger l'image pour ${config.name}
        </a>
      </div>
    `);
  }

  // Injecter le bouton de copie
  card.insertAdjacentHTML('beforeend', `
    <div class="result-actions">
      <button class="btn-outline btn-copy" data-text="${encodeURIComponent(text)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Copier le texte
      </button>
    </div>
  `);

  card.querySelector('.btn-copy').addEventListener('click', function() {
    copyToClipboard(decodeURIComponent(this.dataset.text), this);
  });
}

// --- LOGIQUE CANVAS POUR RETOUCHE PHOTO ---
function createPromoImage(base64Image, text, style) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Limiter la taille pour raisons de perf et poids
      const maxW = 1080;
      let w = img.width;
      let h = img.height;
      if (w > maxW) {
        h = h * (maxW / w);
        w = maxW;
      }
      canvas.width = w;
      canvas.height = h;
      
      // Dessin de l'image de base
      ctx.drawImage(img, 0, 0, w, h);
      
      const isBanner = style === 'bandeau';
      
      if (isBanner) {
        const bannerHeight = canvas.height * 0.15; 
        const bannerY = canvas.height - bannerHeight;
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, bannerY, canvas.width, bannerHeight);
        
        // Texte central max largeur
        ctx.font = `bold ${bannerHeight * 0.45}px Inter, sans-serif`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text.toUpperCase(), canvas.width / 2, bannerY + bannerHeight / 2, canvas.width - 40);
      } else {
        // Pastille (Macaron)
        const radius = Math.min(canvas.width, canvas.height) * 0.15;
        const cx = canvas.width - radius - 30; // 30px padding right
        const cy = radius + 30; // 30px padding top
        
        // Ombre portée pour faire "pop"
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444'; // Rouge promo
        ctx.fill();
        ctx.shadowColor = 'transparent'; // reset
        
        // Cercle interne déco
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.9, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = `bold ${radius * 0.35}px Inter, sans-serif`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text.toUpperCase(), cx, cy, radius * 1.8);
      }
      
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = base64Image;
  });
}

function copyToClipboard(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btnElement.innerHTML;
    btnElement.classList.add('copied');
    btnElement.innerHTML = `✅ Copié`;
    setTimeout(() => {
      btnElement.classList.remove('copied');
      btnElement.innerHTML = originalText;
    }, 2000);
  }).catch(err => {
    showToast("Erreur lors de la copie.");
  });
}

// --- HISTORIQUE ---
async function clearNautiPostHistory() {
  try {
    await fetch(OCEANOS_NAUTIPOST_URL, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {}
}

async function saveToHistory(networkId, text, imgBase64) {
  const thumbnail = await createHistoryThumbnail(imgBase64);
  const item = {
    id: Date.now() + Math.random(),
    date: new Date().toISOString(),
    network: networkId,
    text: text,
    image: thumbnail
  };
  
  state.history.unshift(item);
  if (state.history.length > MAX_HISTORY) {
    state.history.pop();
  }
  
  persistLocalHistory(state.history);
  renderHistory();
  void saveNautiPostHistoryItem(item);
}

async function saveNautiPostHistoryItem(item) {
  try {
    const response = await fetch(OCEANOS_NAUTIPOST_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
    const payload = await response.json();
    if (response.ok && payload.ok !== false && Array.isArray(payload.history)) {
      state.history = await normalizeHistoryForDevice(payload.history);
      persistLocalHistory(state.history);
      renderHistory();
    }
  } catch (error) {}
}

function renderHistory() {
  DOM.historyList.innerHTML = '';
  
  if (state.history.length === 0) {
    DOM.historyList.classList.add('hidden');
    DOM.historyEmpty.classList.remove('hidden');
    DOM.btnClearHistory.classList.add('hidden');
    return;
  }
  
  DOM.historyList.classList.remove('hidden');
  DOM.historyEmpty.classList.add('hidden');
  DOM.btnClearHistory.classList.remove('hidden');
  
  state.history.forEach(item => {
    const dateObj = new Date(item.date);
    const dateStr = dateObj.toLocaleDateString('fr-FR') + ' ' + dateObj.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
    const conf = NETWORKS_CONF[item.network] || { name: item.network, icon: '' };
    
    // Create miniature version of image to save DOM size (though it's still heavy in memory)
    const imgHtml = item.image ? `<img class="history-img" src="${item.image}" alt="Mini" />` : '';

    const html = `
      <div class="history-item">
        ${imgHtml}
        <div class="history-content">
          <div class="history-meta">
            <span style="font-weight:600; display:flex; gap:0.25rem; align-items:center;">
              <span style="display:inline-block; width:14px; height:14px;">${conf.icon}</span> ${conf.name}
            </span>
            <span>${dateStr}</span>
          </div>
          <div class="history-text">${item.text}</div>
          <div class="history-actions">
            <button class="btn-sm btn-copy-hist" data-text="${encodeURIComponent(item.text)}">Copier</button>
            <button class="btn-sm btn-reuse" data-img="${item.image ? '1':'0'}" data-index="${state.history.indexOf(item)}">Réutiliser la photo</button>
          </div>
        </div>
      </div>
    `;
    DOM.historyList.insertAdjacentHTML('beforeend', html);
  });

  // Attach events
  DOM.historyList.querySelectorAll('.btn-copy-hist').forEach(btn => {
    btn.addEventListener('click', function() {
      copyToClipboard(decodeURIComponent(this.dataset.text), this);
    });
  });

  DOM.historyList.querySelectorAll('.btn-reuse').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.dataset.index;
      const historyItem = state.history[idx];
      if (historyItem.image) {
        state.image = { base64: historyItem.image, type: "image/jpeg" }; // Approximation
        DOM.previewImg.src = historyItem.image;
        DOM.dropPlaceholder.classList.add('hidden');
        DOM.dropPreview.classList.remove('hidden');
        updateUIState();
        DOM.modalHistory.classList.add('hidden');
        showToast("Image rechargée !");
      }
    });
  });
}

// Start
document.addEventListener('DOMContentLoaded', init);


const screen = document.getElementById('screen');
const progress = document.getElementById('progress');

const BRAND_MODELS = {"PEUGEOT": ["108", "208", "308", "2008", "3008", "508", "Partner", "Expert", "Boxer"], "CITROËN": ["C1", "C3", "C4", "C5", "Berlingo", "Jumpy", "Jumper", "DS3"], "RENAULT": ["Clio", "Mégane", "Captur", "Scénic", "Twingo", "Kangoo", "Trafic", "Master"], "VOLKSWAGEN": ["Polo", "Golf", "Passat", "Tiguan", "Touran", "Transporter"], "AUDI": ["A1", "A3", "A4", "A6", "Q2", "Q3", "Q5"], "BMW": ["Série 1", "Série 3", "Série 5", "X1", "X3", "X5"], "MERCEDES": ["Classe A", "Classe B", "Classe C", "Classe E", "GLA", "GLC", "Vito", "Sprinter"], "FORD": ["Fiesta", "Focus", "Puma", "Kuga", "Transit", "Tourneo"], "OPEL": ["Corsa", "Astra", "Mokka", "Insignia", "Vivaro"], "TOYOTA": ["Yaris", "Corolla", "C-HR", "RAV4", "Proace"], "NISSAN": ["Micra", "Qashqai", "Juke", "X-Trail", "NV200"], "HYUNDAI": ["i10", "i20", "i30", "Tucson", "Kona"], "KIA": ["Picanto", "Rio", "Ceed", "Sportage", "Niro"], "SKODA": ["Fabia", "Octavia", "Superb", "Kodiaq", "Kamiq"], "SEAT": ["Ibiza", "Leon", "Arona", "Ateca"], "FIAT": ["500", "Panda", "Tipo", "Ducato"], "TESLA": ["Model 3", "Model Y", "Model S", "Model X"], "AUTRE": []};

const data = {
  vehicule: { immat:'', km:'', marque:'', modele:'', mecano:'' },
  controles: { points100_done:false, photo_points100:null },
  or_a5: { photo:null, ocr_items:[] },
  bl: { photos:[], lines:[], required:false }
};

const steps = [
  'immat','km','marque','modele','mecano',
  'points100','photo_points100',
  'photo_a5','ocr_a5',
  'pieces_question','photo_bl','ocr_bl','match_a5_bl',
  'recap'
];
let stepIndex = 0;

function setProgress() {
  progress.textContent = `Étape ${stepIndex+1}/${steps.length}`;
}

function showError(msg) {
  const el = document.createElement('div');
  el.className = 'error';
  el.textContent = msg;
  screen.appendChild(el);
}

function next() {
  stepIndex = Math.min(stepIndex + 1, steps.length - 1);
  render();
}
function back() {
  stepIndex = Math.max(stepIndex - 1, 0);
  render();
}

function renderCard(innerHtml) {
  screen.innerHTML = `<div class="card">${innerHtml}</div>`;
}

function normalizeImmat(v) {
  return (v||'').toUpperCase().replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');
}

function render() {
  setProgress();
  const step = steps[stepIndex];

  if(step === 'immat') {
    renderCard(`
      <h2>Immatriculation (obligatoire)</h2>
      <label>Immat</label>
      <input id="immat" placeholder="AB-123-CD" value="${data.vehicule.immat}"/>
      <div class="small">Astuce : tu peux coller directement le texte.</div>
      <div class="actions">
        <button class="secondary" onclick="resetAll()">Nouveau dossier</button>
        <button onclick="saveImmat()">Suivant</button>
      </div>
    `);
  } 
  else if(step === 'km') {
    renderCard(`
      <h2>Kilométrage (obligatoire)</h2>
      <label>KM</label>
      <input id="km" type="number" placeholder="128450" value="${data.vehicule.km}"/>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="saveKm()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'marque') {
    const brandOptions = Object.keys(BRAND_MODELS).map(b => `<option value="${b}">${b}</option>`).join('');
    renderCard(`
      <h2>Marque (obligatoire)</h2>
      <label>Choisir la marque</label>
      <select id="marque" onchange="onBrandChange()">
        <option value="">— Sélectionner —</option>
        ${brandOptions}
      </select>
      <div id="marqueAutreWrap" style="display:none;margin-top:10px">
        <label>Marque (autre)</label>
        <input id="marqueAutre" placeholder="Ex: Dacia, Volvo..." />
      </div>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="saveBrand()">Suivant</button>
      </div>
    `);

    const sel = document.getElementById('marque');
    sel.value = (data.vehicule.marque && BRAND_MODELS[data.vehicule.marque] !== undefined) ? data.vehicule.marque : (data.vehicule.marque ? 'AUTRE' : '');
    if(sel.value === 'AUTRE') {
      document.getElementById('marqueAutreWrap').style.display='block';
      document.getElementById('marqueAutre').value = data.vehicule.marque;
    }
  }
  else if(step === 'modele') {
    const brand = (data.vehicule.marque||'').toUpperCase();
    const models = BRAND_MODELS[brand] || [];
    const modelOptions = models.map(m => `<option value="${m}">${m}</option>`).join('');
    const useDropdown = models.length > 0 && brand !== 'AUTRE';

    renderCard(`
      <h2>Modèle (obligatoire)</h2>
      <div class="small">Marque : <b>${data.vehicule.marque || '—'}</b></div>

      ${useDropdown ? `
        <label>Choisir le modèle</label>
        <select id="modele">
          <option value="">— Sélectionner —</option>
          ${modelOptions}
        </select>
      ` : `
        <label>Modèle</label>
        <input id="modeleTxt" placeholder="Ex: Classe A, Duster..." value="${data.vehicule.modele}"/>
      `}

      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="saveModel(${useDropdown})">Suivant</button>
      </div>
    `);

    if(useDropdown) {
      document.getElementById('modele').value = data.vehicule.modele || '';
    }
  }
  else if(step === 'mecano') {
    renderCard(`
      <h2>Mécano (obligatoire)</h2>
      <button onclick="setMecano('SYLVAIN')">SYLVAIN</button>
      <button class="secondary" onclick="askOtherMecano()">AUTRE</button>
      <div class="small">Choix obligatoire (traçabilité).</div>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="validateMecano()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'points100') {
    renderCard(`
      <h2>100 points de contrôle</h2>
      <div class="small">V1.1.1 : bouton + photo (archive). Détail point par point plus tard.</div>
      <button onclick="mark100()">✅ 100 points effectués (0,50 h)</button>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="goIf100()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'photo_points100') {
    renderCard(`
      <h2>Photo fiche 100 points</h2>
      <button onclick="photoPlaceholder('100 points')">📸 Prendre photo</button>
      <div class="small">À brancher : caméra + stockage photo.</div>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="next()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'photo_a5') {
    renderCard(`
      <h2>Photo fiche A5 (OR)</h2>
      <button onclick="photoPlaceholder('Fiche A5')">📸 Prendre photo</button>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="next()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'ocr_a5') {
    renderCard(`
      <h2>OCR A5 (validation)</h2>
      <div class="small">V1.1.1 : placeholder (OCR V1.2). Tu pourras éditer la liste.</div>
      <textarea placeholder="Ex: Triangle suspension gauche 1h\nTriangle suspension droit 1h\nPlaquettes arrière"></textarea>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="next()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'pieces_question') {
    renderCard(`
      <h2>Pièces achetées ?</h2>
      <div class="row">
        <button onclick="data.bl.required=true; next()">Oui</button>
        <button class="secondary" onclick="data.bl.required=false; skipBL()">Non</button>
      </div>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
      </div>
    `);
  }
  else if(step === 'photo_bl') {
    renderCard(`
      <h2>Photo BL fournisseur</h2>
      <button onclick="photoPlaceholder('BL fournisseur')">📸 Prendre photo</button>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="next()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'ocr_bl') {
    renderCard(`
      <h2>OCR BL (lignes détectées)</h2>
      <div class="small">V1.1.1 : placeholder (OCR V1.2). Tu pourras cocher les lignes facturables.</div>
      <textarea placeholder="Ex: Plaquettes de frein AV — 68,00 €\nBalais essuie-glace — 13,20 €"></textarea>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="next()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'match_a5_bl') {
    renderCard(`
      <h2>Correspondance A5 ↔ BL</h2>
      <div class="small">V1.1.1 : placeholder. En V1.2, l’app proposera un lien élément ↔ ligne BL.</div>
      <textarea placeholder="Ex: Plaquettes arrière = ligne BL 'PLAQUETTES...'"></textarea>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="next()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'recap') {
    renderCard(`
      <h2>Récap dossier</h2>
      <pre>${JSON.stringify(data.vehicule, null, 2)}</pre>
      <div class="small">Prochaine étape : ajout caméra + OCR BL (gros gain de temps).</div>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="resetAll()">Nouveau dossier</button>
      </div>
    `);
  }
}

// Actions
function resetAll() {
  data.vehicule = { immat:'', km:'', marque:'', modele:'', mecano:'' };
  data.controles = { points100_done:false, photo_points100:null };
  data.or_a5 = { photo:null, ocr_items:[] };
  data.bl = { photos:[], lines:[], required:false };
  stepIndex = 0;
  render();
}

function saveImmat() {
  const v = normalizeImmat(document.getElementById('immat').value);
  if(!v) return showError('Immatriculation obligatoire.');
  data.vehicule.immat = v;
  next();
}

function saveKm() {
  const v = (document.getElementById('km').value || '').trim();
  if(!v) return showError('Kilométrage obligatoire.');
  data.vehicule.km = v;
  next();
}

function onBrandChange() {
  const sel = document.getElementById('marque');
  document.getElementById('marqueAutreWrap').style.display = (sel.value === 'AUTRE') ? 'block' : 'none';
}

function saveBrand() {
  const sel = (document.getElementById('marque').value || '').trim();
  if(!sel) return showError('Marque obligatoire.');

  if(sel === 'AUTRE') {
    const other = (document.getElementById('marqueAutre').value || '').trim();
    if(!other) return showError('Merci d’indiquer la marque (autre).');
    data.vehicule.marque = other.toUpperCase();
  } else {
    data.vehicule.marque = sel;
  }
  data.vehicule.modele = '';
  next();
}

function saveModel(useDropdown) {
  let v = '';
  if(useDropdown) {
    v = (document.getElementById('modele').value || '').trim();
  } else {
    v = (document.getElementById('modeleTxt').value || '').trim();
  }
  if(!v) return showError('Modèle obligatoire.');
  data.vehicule.modele = v;
  next();
}

function setMecano(name) { data.vehicule.mecano = name; }
function askOtherMecano() {
  const n = prompt('Prénom du mécano ?');
  if(n) data.vehicule.mecano = n.trim().toUpperCase();
}
function validateMecano() {
  if(!data.vehicule.mecano) return showError('Mécano obligatoire (Sylvain / Autre).');
  next();
}

function mark100() { data.controles.points100_done = true; }
function goIf100() {
  if(!data.controles.points100_done) return showError('Merci de valider “100 points effectués”.');
  next();
}

function skipBL() {
  stepIndex = steps.indexOf('recap');
  render();
}

function photoPlaceholder(label) {
  alert('V1.1.1 : caméra à brancher (V1.2).\nTu as cliqué sur : ' + label);
}

render();

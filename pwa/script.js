let currentSelectedFile = null; // Variable pour garder le fichier audio

// ===================== Navigation entre écrans =====================
const screenHome = document.getElementById('screen-home');
const screenConfig = document.getElementById('screen-config');


// ===================== Navigation vers la lecture (Markdown) =====================
const screenRead = document.getElementById('screen-read');
const readContent = document.getElementById('read-content'); // Ton conteneur pour le texte

const readBackBtn = document.getElementById('read-back-btn');
const readFilename = document.getElementById('read-filename');

function goToHomeFromRead(){
  screenRead.classList.remove('active');
  screenHome.classList.add('active');
}

if (readBackBtn){
  readBackBtn.addEventListener('click', goToHomeFromRead);
}

const startBtn = document.getElementById('start-transcribe-btn');

startBtn.addEventListener('click', async () => {
  if (!currentSelectedFile) {
    alert("Aucun fichier audio sélectionné.");
    return;
  }

  // 1. On lit les valeurs des champs
  const contextValue = document.getElementById('context-input').value;

  // On vérifie si la classe 'checked' est présente sur chaque bouton
  const isDiarization = document.querySelector('[data-toggle="diarisation"]').classList.contains('checked');
  const isCleanup = document.querySelector('[data-toggle="cleanup"]').classList.contains('checked');

  // 2. On prépare l'objet FormData
  const formData = new FormData();
  formData.append('audio', currentSelectedFile);
  formData.append('context', contextValue);
  formData.append('diarization', isDiarization);
  formData.append('cleanup', isCleanup);

  // 3. UI : Indiquer que l'envoi est en cours
  startBtn.disabled = true;
  startBtn.textContent = "Traitement en cours...";

  try {
    // 4. Envoi au serveur Go
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData // Le navigateur gère automatiquement les en-têtes multipart/form-data
    });

    if (!response.ok) {
      throw new Error(`Erreur serveur : ${response.statusText}`);
    }

    // Le serveur Go renvoie le résultat Markdown sous forme de JSON
    const data = await response.json(); // ex: { filename: "cours.md", markdown: "# Contenu..." }

    // 5. Sauvegarde locale dans l'OPFS
    await saveMarkdownLocally(data.filename, data.markdown);

    // 6. Navigation vers l'écran de lecture
    goToRead(data.filename);

  } catch (error) {
    console.error("Erreur lors de la transcription :", error);
    alert("Échec de la transcription.");
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = "Lancer la transcription";
  }
});

async function goToRead(filename) {
  // 1. Masquer l'accueil et afficher l'écran de lecture
  screenHome.classList.remove('active');
  screenRead.classList.add('active');

  // Déterminer le nom du fichier .md (ex: "cours.mp3" -> "cours.md")
  const mdFileName = filename.replace(/\.[^/.]+$/, "") + ".md";

  // Afficher le nom propre dans l'en-tête (sans extension)
  if (readFilename) {
    readFilename.textContent = filename.replace(/\.[^/.]+$/, "");
  }
  
  // 2. Indicateur de chargement
  readContent.innerHTML = '<p class="loading">Chargement de la note...</p>';

  try {
    // 3. Accéder à l'espace de stockage local privé (OPFS)
    const root = await navigator.storage.getDirectory();
    
    // 4. Récupérer et lire le fichier .md
    const fileHandle = await root.getFileHandle(mdFileName);
    const file = await fileHandle.getFile();
    const markdownText = await file.text();

    // 5. Convertir le Markdown en HTML et l'injecter
    readContent.innerHTML = marked.parse(markdownText);

  } catch (error) {
    readContent.innerHTML = '<p class="error">Impossible de charger cette note depuis le stockage local.</p>';
    console.error("Erreur de lecture OPFS :", error);
  }
}

function goToConfig(filename) {
  const configFilename = document.getElementById('config-filename');
  if (configFilename) {
    configFilename.textContent = filename || 'fichier audio';
  }
  screenHome.classList.remove('active');
  screenConfig.classList.add('active');
}

function goToHome() {
  screenConfig.classList.remove('active');
  screenHome.classList.add('active');
}

const backBtn = document.getElementById('back-btn');
if (backBtn) {
  backBtn.addEventListener('click', goToHome);
}

// ===================== Bouton "+" / bulle de téléversement =====================
const fab = document.getElementById('fab');
const uploadBubble = document.getElementById('upload-bubble');
const uploadClose = document.getElementById('upload-close');
const fileInput = document.getElementById('file-input');

// Ouvrir la bulle d'upload
fab.addEventListener('click', () => {
  fab.classList.add('is-hidden'); // Masquer le FAB
  uploadBubble.classList.add('is-visible'); // Animer l'apparition de la bulle
});

// Fermer la bulle d'upload
function closeBubble() {
  uploadBubble.classList.remove('is-visible');
  fab.classList.remove('is-hidden');
}

uploadClose.addEventListener('click', closeBubble);

// Sélection d'un fichier audio
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) {
    currentSelectedFile = file;
    // Met à jour le nom et la taille sur l'écran de configuration
    document.getElementById('config-filename').textContent = file.name;
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    document.querySelector('.file-chip .size').textContent = `${sizeInMB} Mo`;
    closeBubble();
    goToConfig(file.name);
  }
});

// ===================== Sélection d'une transcription existante =====================
document.querySelectorAll('.entry').forEach(entry => {
  entry.addEventListener('click', () => {
    goToRead(entry.dataset.filename);
  });
});

// ===================== Cases à cocher (Accessibilité aria-checked) =====================
document.querySelectorAll('.checkbox').forEach(box => {
  box.addEventListener('click', () => {
    const isChecked = box.classList.toggle('checked');
    box.setAttribute('aria-checked', isChecked ? 'true' : 'false');
  });
});

// ===================== État vide (si la liste est vide) =====================
const homeList = document.getElementById('home-list');
const homeEmpty = document.getElementById('home-empty');

function checkEmptyState() {
  if (homeList && homeEmpty) {
    const isEmpty = homeList.children.length === 0;
    if (isEmpty) {
      homeList.setAttribute('hidden', '');
      homeEmpty.removeAttribute('hidden');
    } else {
      homeList.removeAttribute('hidden');
      homeEmpty.setAttribute('hidden', '');
    }
  }
}

// ===================== Sauvegarde locale dans l'OPFS =====================
async function saveMarkdownLocally(filename, markdownContent) {
  try {
    const root = await navigator.storage.getDirectory();
    // Force l'extension .md si elle n'y est pas
    const mdFileName = filename.replace(/\.[^/.]+$/, "") + ".md";
    
    // Crée ou écrase le fichier .md dans le stockage privé du navigateur
    const fileHandle = await root.getFileHandle(mdFileName, { create: true });
    const writable = await fileHandle.createWritable();
    
    await writable.write(markdownContent);
    await writable.close();
    
    console.log(`Fichier ${mdFileName} sauvegardé en OPFS.`);
  } catch (err) {
    console.error("Échec de la sauvegarde locale :", err);
    throw err;
  }
}

// Vérification initiale
checkEmptyState();

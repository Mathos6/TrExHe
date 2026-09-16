Voici le résumé complet de notre échange pour te servir de **feuille de route**.

**Architecture Générale du Projet**

* **Frontend :** Application mobile **Flutter** (capture/sélection de l'audio `.ogg`, `.m4a`, etc., et affichage du cours en Markdown).
* **Backend :** Serveur **Go** (performant, léger en RAM, gestionnaire d'API REST).
* **Moteur Audio :** **Whisper** (locale via `faster-whisper` / `whisper.cpp` ou API externe).
* **Moteur Texte :** **LLM** (API **Gemini Free** via Google AI Studio pour sa grande fenêtre de contexte, ou modèle local comme Mistral/Llama via Ollama).

---

**Roadmap de Développement**

**Étape 1 : Le Noyau IA & Script de Test (Python/CLI)**

* Valider la transcription avec `faster-whisper` (ou `whisper.cpp`) en injectant un `initial_prompt` (ex: liste de termes techniques de biologie/informatique) pour guider le vocabulaire.
* Connecter le texte transcrit à l'API Gemini avec un prompt de structuration imposant de conserver **tous les exemples, définitions et métaphores du prof**.
* Générer le résultat final dans un fichier `cours.md`.

**Étape 2 : Le Backend HTTP en Go**

* Créer un serveur Go léger (avec la lib standard `net/http` ou un framework comme Gin/Fiber).
* Définir une route `POST /api/transcribe` acceptant un fichier audio (`multipart/form-data`) et un paramètre de texte pour le contexte du cours.
* Valider les formats audio entrants (`.ogg`, `.m4a`, `.mp3`, `.wav`, `.mp4`).
* Faire orchestrer le traitement par Go : réception de l'audio $\rightarrow$ appel de la transcription $\rightarrow$ envoi au LLM $\rightarrow$ retour de la réponse en JSON (`{"cours": "# Titre..."}`).

**Étape 3 : Le Client Mobile Flutter**

* Créer une interface épurée avec un sélecteur de fichiers (*file picker*) pour piocher l'enregistrement audio.
* Ajouter un champ texte optionnel pour saisir le sujet du cours (utilisé comme `initial_prompt`).
* Envoyer le fichier au backend Go via une requête HTTP POST.
* Afficher le résultat avec un rendu Markdown lisible et ajouter une option pour exporter/copier le cours.

---

**Stratégie & Choix Techniques Validés**

* **Format d'entrée :** Privilégier le traitement de **fichier complet** post-cours plutôt que le streaming en direct pour éviter la complexité du *chunking* audio et de la gestion réseau à chaud.
* **Coût :** **0 €** en combinant Go, l'hébergement/exécution locale sur Debian et l'API Gemini gratuite.
* **Évolution future :** Découpage automatique des cours de 2 heures par tranches de 30 min, génération automatique de fiches de révision QCM.



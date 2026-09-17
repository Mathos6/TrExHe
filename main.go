package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

var apiKey string

func generateMarkdown(output, context string) (string, error) {
	prompt := fmt.Sprintf(`Tu es un assistant pédagogique. Voici la transcription brute d'un cours enregistre :

		---
		%s
		---

		Contexte fourni par l'étudiant : %s

		Consignes :
		1. Génère un cours structuré en Markdown propre et lisible.
		2. Utilise des titres (#, ##), des paragraphes clairs et des listes à puces.
		3. Ajoute une courte section "Résumé" au début.
		4. Corrige les fautes d'orthographe ou les hésitations de la transcription tout en restant fidèle au contenu original.
		5. Ne renvoie QUE le code Markdown, sans balises XML ni blocs de code triple-backticks.`, output, context)

	reqBody := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]string{
					{"text": prompt},
				},
			},
		},
	}
	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("erreur de sérialisation JSON : %w", err)
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=%s", apiKey)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("erreur lors de la requête Gemini : %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("erreur API Gemini (%d): %s", resp.StatusCode, string(body))
	}
	// Décodage de la réponse
	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return "", fmt.Errorf("erreur de décodage de la réponse Gemini : %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("réponse Gemini vide")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

func saveUploadedFile(r *http.Request) (string, string, error) {
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		return "", "", fmt.Errorf("impossible d'analyser le formulaire: %w", err)
	}
	file, header, err := r.FormFile("audio")
	if err != nil {
		return "", "", fmt.Errorf("fichier audio introuvable dans la requête: %w", err)
	}
	defer file.Close()

	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".tmp"
	}

	tempFile, err := os.CreateTemp("", "trexhe-upload-*"+ext)
	if err != nil {
		return "", "", fmt.Errorf("impossible de créer le fichier temporaire: %w", err)
	}
	defer tempFile.Close()

	if _, err := io.Copy(tempFile, file); err != nil {
		os.Remove(tempFile.Name())
		return "", "", fmt.Errorf("erreur lors de l'écriture sur le disque: %w", err)
	}
	return tempFile.Name(), header.Filename, nil
}

func convertToWav16k(inputPath string) (string, error) {
	wavPath := inputPath + ".wav"

	cmd := exec.Command("ffmpeg", "-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("erreur ffmpeg: %v, output: %s", err, string(output))
	}

	return wavPath, nil
}

func TranscribeAudio(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}
	tempPath, originalFilename, err := saveUploadedFile(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer os.Remove(tempPath)

	wavPath, err := convertToWav16k(tempPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Erreur lors de la conversion audio : %v", err), http.StatusInternalServerError)
		return
	}
	defer os.Remove(wavPath)

	context := r.FormValue("context")
	lang := r.FormValue("language")
	if lang == "" {
		lang = "fr" // Langue par défaut
	}

	modelPath := "./whisper.cpp/models/ggml-small.bin"
	cliPath := "./whisper.cpp/build/bin/whisper-cli"

	args := []string{
		"-m", modelPath,
		"-f", wavPath,
		"-l", lang,
		"-nt",
	}
	if context != "" {
		args = append(args, "--prompt", context)
	}

	cmd := exec.Command(cliPath, args...)
	cmd.Env = append(cmd.Environ(), "LD_LIBRARY_PATH=./whisper.cpp/build/bin")

	output, err := cmd.CombinedOutput()
	if err != nil {
		http.Error(w, fmt.Sprintf("erreur whisper: %v, output: %s", err, string(output)), http.StatusInternalServerError)
		return
	}

	markdownContent, err := generateMarkdown(string(output), context)
	if err != nil {
		http.Error(w, fmt.Sprintf("Erreur lors de la structuration Gemini : %v", err), http.StatusInternalServerError)
		return
	}

	baseName := strings.TrimSuffix(originalFilename, filepath.Ext(originalFilename))
	if baseName == "" {
		baseName = "transcription"
	}
	finalMdName := baseName + ".md"

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"filename": finalMdName,
		"markdown": markdownContent,
	})
}

func main() {
	apiKey = os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Fatal("la variable d'environnement GEMINI_API_KEY est manquante")
	}
	var addr string = ":8000"
	// Enregistrement des routes
	http.HandleFunc("/api/transcribe", TranscribeAudio)

	fs := http.FileServer(http.Dir("./pwa"))
	http.Handle("/", fs)
	log.Printf("Serveur TrExHe démarré sur http://localhost%s\n", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

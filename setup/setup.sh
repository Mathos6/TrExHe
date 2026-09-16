#!/bin/bash
set -e

# Détermine le dossier racine du projet (parent du dossier setup/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WHISPER_DIR="$ROOT_DIR/whisper.cpp"

echo "=== Installation de whisper.cpp dans $WHISPER_DIR ==="

# 1. Cloner whisper.cpp si absent à la racine du projet
if [ ! -d "$WHISPER_DIR" ]; then
    echo "Clonage de whisper.cpp..."
    git clone https://github.com/ggml-org/whisper.cpp.git "$WHISPER_DIR"
fi

# 2. Télécharger le modèle small si absent
if [ ! -f "$WHISPER_DIR/models/ggml-small.bin" ]; then
    echo "Téléchargement du modèle ggml-small.bin..."
    sh "$WHISPER_DIR/models/download-ggml-model.sh" small
fi

# 3. Compilation
echo "Compilation de whisper.cpp..."
cd "$WHISPER_DIR"
cmake -B build
cmake --build build -j --config Release

echo "=== whisper.cpp est prêt ! ==="

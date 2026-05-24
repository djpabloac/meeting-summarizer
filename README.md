# meeting-summarizer

Here's a rewritten version of your README with the packages installed, along with a workflow for 
extracting a summary (on MacOs):

**Getting Started**
---------------

To get started with this project, you'll need to install some dependencies. Here are the steps:

### Install Ollama

1. Install Ollama using Homebrew:
```bash
brew install ollama
```
2. Start the Ollama service:
```bash
brew services start ollama
```
3. Run the Ollama CLI command to extract audio features (replace `llama3:8b` with your desired 
model):
```bash
ollama run llama3:8b
```

### Install Audio Package

1. Install FFmpeg using Homebrew:
```bash
brew install ffmpeg
```

### Install Whisper C++ Model

1. Install Whisper C++ using Homebrew:
```bash
brew install whisper-cpp
```
2. Verify the installation by running the Whisper CLI command:
```bash
whisper-cli --help
```

**Workflow: Extracting a Summary**

To extract a summary from an audio file, follow these steps:

1. Prepare your audio file for processing.
2. Run Ollama to extract audio features.
3. Use FFmpeg to process and extract relevant audio segments.
4. Feed the extracted audio segments into Whisper C++ to generate a summary.

By following this workflow, you should be able to extract meaningful summaries from your audio 
files!

**To install dependencies**


```bash
bun install
```

To run:

```bash
bun run index.ts
```

Env:
```bash
WHISPER_BIN=whisper-cli
WHISPER_MODEL=/opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin
OLLAMA_MODEL=llama3:8b
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

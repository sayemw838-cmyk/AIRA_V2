# AIRA V2.3.13

AIRA is a browser-first agentic chat application with local tasks, skills, artifacts, and voice controls.

## Reply voice

Voice replies can use either the browser's built-in speech engine or OpenRouter Text-to-Speech with **Fish Audio S2.1 Pro Free** (`fish-audio/s2.1-pro-free`). Select the voice model in **Settings → Voice**, add an OpenRouter key, and optionally change the Fish Audio voice ID. The default voice ID is the one configured for the initial Fish Audio example.

OpenRouter audio is requested from `/api/v1/audio/speech` as MP3 bytes and played in memory. It is not saved to the workspace. Device speech remains available as a local fallback. Speech-to-text continues to use Groq.

## Development

Run the regression suite with:

```bash
node --test
```

# ARTEM.AI V5 TRAVELER

**Digital companion with hybrid intelligence**  
Created at RKC studio (Rat, Karas and Crab).

ARTEM.AI — an experimental AI assistant running directly in your browser. It combines lightweight local neural networks with powerful cloud APIs for a truly hybrid experience.

![ARTEM.AI V5 TRAVELER](screenshot.png)  
*— add screenshot link here if available*

## Features

- **Hybrid Mode**: local generation (trigrams) or API calls (Groq Llama 3.3 / Gemini 2.5 Flash).
- **On-the-fly Learning**: any messages (except questions) automatically expand the trigram database.
- **Reasoning Mode**: displays thinking steps before responding — full immersion.
- **Evolution Log**: records all learning events, imports, and changes.
- **Import from Artem.S**: backward compatibility with previous versions.
- **Export/Import Personality**: save and transfer your trained model.
- **API Key Encryption**: keys are stored encrypted in `localStorage`.
- **Dark Theme with Starry Sky**: atmospheric cyberpunk-style interface.

## How to Use

1. **Open `index.html`** in any modern browser (Chrome, Firefox, Edge, Safari).
2. Start typing in the input field.  
   - If the message ends with `?` — Artem will answer but won't learn.  
   - If without `?` — Artem will answer and learn new trigrams.
3. **API Configuration** (optional):
   - Go to the **Settings** tab.
   - Enable **Hybrid Mode (API)**.
   - Choose a provider (Groq or Gemini).
   - Paste your API key (it will be encrypted).
   - Optionally edit the **System Prompt**.
4. **Manual Training**:
   - **Training** tab — paste any text (articles, dialogues, books) and click **Train Artem**.
5. **Import from Artem.S**:
   - Click **Import Artem.S** on the sidebar if you have saved data from previous versions.
6. **Save Your Personality**:
   - **Save Personality** / **Load Personality** buttons let you export and restore all memory and settings.

## Technologies

- HTML5 / CSS3 (TailwindCSS for rapid styling)
- Vanilla JavaScript (ES6) without frameworks
- Storage: `localStorage`
- APIs: Groq Cloud, Google Gemini
- Fonts: Orbitron, IBM Plex Mono

## Compatibility

Works in all modern browsers with `localStorage` and `fetch` support. API functionality requires an active internet connection.

## Authors & License

**Developer:** RKC studio (Rat, Karas and Crab)  
**Year:** 2026  
**License:** MIT (see [LICENSE](LICENSE) file)

This project was created to explore hybrid interfaces and local learning approaches.  
You are free to use, modify, and distribute the code with proper attribution.

## Acknowledgments

- Groq for fast Llama inference.
- Google for Gemini API.
- The community for inspiration.

---

*ARTEM.AI V5 TRAVELER — your companion in the digital realm.*
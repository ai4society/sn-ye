# SN-YE: Surya Namaskar Yoga Explorer

[![SN-YE Website](https://img.shields.io/badge/Website-SN--YE-2563eb?style=for-the-badge)](https://ai4society.github.io/sn-ye/)
[![Repository](https://img.shields.io/badge/GitHub-ai4society%2Fsn--ye-24292f?style=for-the-badge&logo=github)](https://github.com/ai4society/sn-ye)
[![SN-YO Ontology](https://img.shields.io/badge/Ontology-SN--YO-1f6f8b?style=for-the-badge)](https://ai4society.github.io/sn-yo/)

SN-YE is the standalone explorer website for querying and explaining the Surya Namaskar Yoga Ontology. It includes predefined competency-question queries, natural-language-to-SPARQL templates, multilingual asana label support, and CYP visual grounding.

## Contents

- `index.html`: GitHub Pages entry point for the explorer.
- `explorer.html`: Same explorer page kept for compatibility with the original site route.
- `models/`: Local ontology copy used by the explorer, including `models/master.owl`.
- `images/cyp-pages/`: Common Yoga Protocol visual references used in query results.
- `css/`: Shared website styling and explorer-specific styling.
- `js/`: Ontology parser, predefined query data, natural-language planner, and explorer UI logic.

## Run Locally

Serve the folder with any static file server:

```bash
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

## Natural Language Queries

The Natural Language tab asks for a Gemini API key in the browser UI. Do not commit API keys to this repository. A local `js/education-local-config.js` file is intentionally not included.

## GitHub Pages

Push this folder to the [ai4society/sn-ye](https://github.com/ai4society/sn-ye) repository, then enable GitHub Pages from the repository root. The explorer is linked from the website badge above.

The SN-YO link in `index.html` and `explorer.html` currently points to the [SN-YO website](https://ai4society.github.io/sn-yo/).

Update that link if SN-YO is published under a different owner or repository name.

## License

This project is licensed under the MIT License.

# SN-YE: Surya Namaskar Yoga Explorer

[![SN-YE Website](https://img.shields.io/badge/Website-SN--YE-2563eb?style=for-the-badge)](https://ai4society.github.io/sn-ye/)
[![SN-YE Repository](https://img.shields.io/badge/GitHub-ai4society%2Fsn--ye-24292f?style=for-the-badge&logo=github)](https://github.com/ai4society/sn-ye)
[![SN-YO Ontology](https://img.shields.io/badge/Ontology-SN--YO-1f6f8b?style=for-the-badge)](https://purl.org/ai4s/yoga/sn-yo/ontology)
[![SN-YO Repository](https://img.shields.io/badge/GitHub-ai4society%2Fsn--yo-24292f?style=for-the-badge&logo=github)](https://github.com/ai4society/sn-yo)

SN-YE is an ontology-grounded exploration interface for the Surya Namaskar Yoga Ontology. It lets users inspect predefined competency questions, generate SPARQL from natural-language questions, view retrieved ontology facts, and connect query results to visual references from the Common Yoga Protocol.

The explorer is built as a static web application and runs directly in the browser over the local OWL knowledge graph.

## Highlights

- Provides predefined SPARQL-backed competency questions for Surya Namaskar sequences, variants, asanas, mantras, chakras, body parts, breathing patterns, safety notes, and correction guidance.
- Supports a Natural Language tab for mapping supported yoga questions to ontology-aware SPARQL templates.
- Displays generated SPARQL alongside the retrieved ontology results.
- Includes scheduled-language label selection for asana and breathing-pattern result tables and generated queries.
- Grounds pose and asana results with Common Yoga Protocol page images where available.
- Uses the SN-YO ontology as its knowledge source.

## Repository Structure

- `index.html`: Main SN-YE browser entry point.
- `explorer.html`: Explorer page retained for route compatibility.
- `models/master.owl`: Ontology file used by the explorer.
- `models/modules/`: Modular OWL files for the core model, base sequence, and variants.
- `images/cyp-pages/`: Common Yoga Protocol visual references.
- `css/`: Shared and explorer-specific styles.
- `js/ontology-graph.js`: Browser-side OWL parser and ontology data model.
- `js/explorer-data.js`: Predefined query definitions, result builders, and SPARQL templates.
- `js/explorer-ai.js`: Natural-language intent and SPARQL-template support.
- `js/explorer.js`: Explorer UI and interaction logic.

## Explore

Use the [SN-YE website](https://ai4society.github.io/sn-ye/) to run predefined and natural-language ontology queries.

The companion ontology project is [SN-YO](https://ai4society.github.io/sn-yo/), with source available at [ai4society/sn-yo](https://github.com/ai4society/sn-yo).

## Multilingual Labels

SN-YE reads multilingual `rdfs:label` values from the bundled SN-YO ontology and exposes them through the Language selector in predefined, SPARQL, and natural-language query flows. The current selector covers the 22 Indian scheduled languages listed in the Eighth Schedule of the Constitution of India, using web-standard BCP 47 / ISO 639 tags such as `hi`, `te`, `brx`, `doi`, `kok`, `sat`, and `mni`. The current tags are kept stable so website queries and language selectors continue to work consistently.

The label source is `models/label_csv and script/SN_YO_labels_combined.csv`, which is materialized into `models/modules/core.owl` and `models/master.owl`.

For asanas, the labels preserve canonical Sanskrit-derived yoga posture names across language scripts. They are intended as script-adapted display labels for pose names, not as independent descriptive translations such as "Cobra Pose" or "Mountain Pose" in every language. This reflects common yoga usage, where Sanskrit posture names are often retained and adapted to the writing system used by the target language.

Breathing-pattern labels, including `BreathingPattern`, `Inhale`, `Exhale`, and `Hold`, use short language-specific display phrases. These are ordinary language expressions rather than Sanskrit posture names. The current labels are retained for ontology querying, UI display, and future review.

References used for language scope and tagging include the [Government of India Eighth Schedule language list](https://www.education.gov.in/en/cp_languages), [ISO 639 language codes](https://www.iso.org/iso-639-language-code), [BCP 47 language tags](https://developer.mozilla.org/en-US/docs/Glossary/BCP_47_language_tag), and script resources such as the [Devanagari language documentation](https://motaitalic.github.io/devanagari-documentation/languages/bodo/bodo.html).

## Local Use

Serve the repository with any static file server:

```bash
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

## Natural Language Support

Predefined ontology queries run fully in the browser. Natural-language explanation and planning workflows use a Gemini API key supplied by the user in the browser interface.

## License

This project is licensed under the MIT License.

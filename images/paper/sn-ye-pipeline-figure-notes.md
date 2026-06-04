# SN-YE Pipeline Figure Notes

## Generated Figure

- V4-preserving ontology-corrected edit: `sn-ye-pipeline-generated-v6.png`
- Ontology-corrected regeneration draft: `sn-ye-pipeline-generated-v5.png`
- Regenerated non-stretched figure: `sn-ye-pipeline-generated-v4.png`
- Dimension-corrected figure: `sn-ye-pipeline-generated-v3-wide.png`
- Revised low-height figure: `sn-ye-pipeline-generated-v3.png`
- Preferred generated figure: `sn-ye-pipeline-generated-v2.png`
- First generated draft: `sn-ye-pipeline-generated.png`

## Image Generation Prompt

Create a corrected, paper-ready scientific educational infographic for a Semantic Web conference paper explaining the SN-YE exploration tool pipeline. It should be clean, precise, and readable at paper width. Use white and pale blue panels on `#f7f9fc`, thin `#e7edf5` borders, navy `#1e2a78` and teal `#0f6e8c` arrows, restrained shadows, 8 px rounded panels, crisp sans typography. No photorealistic people, no yoga silhouettes, no decorative blobs.

Title at top, exact text: `SN-YE Pipeline: Ontology-Grounded Surya Namaskar Exploration`

Main left-to-right pipeline:

1. Left panel title: `User question`. Chips: `Sequence`, `Breathing & safety`, `Errors & corrections`, `CYP visuals`.
2. Next panel title: `Workspace modes`. Three pill tabs: `Predefined Questions`, `Natural Language`, `SPARQL`. Add selector: `Language labels`, showing `English (UN)`.
3. Upper branch above the execution block: `Gemini planner` -> `Intent template` -> `Generated SPARQL`. Add note: `template-grounded`. Add a small caption: `LLM plans queries; ontology returns facts.`
4. Central execution block title: `Local ontology execution`. Inside: `Browser OWL parser`, `Local SELECT runner`, `SN-YO master.owl`.
5. Right panel title: `Retrieved results`. Cards: `Facts`, `Result table`, `Source SPARQL`, `CYP visual reference`, `Grounded explanation`.

Ontology graph inset below the execution block. Center node: `Pose occurrence`. Connected nodes and edge labels:

- `Pose occurrence` -> `Asana identity`, label `hasAsana`
- `Pose occurrence` -> `Variant`, label `belongsToVariant`
- `Pose occurrence` -> `Breathing Pattern`, label `hasBreathingPattern`
- `Pose occurrence` -> `Safety Note`, label `hasSafetyNote`
- `Pose occurrence` -> `Pose Error`, label `hasPossibleError`
- `Pose Error` -> `Correction Instruction`, label `hasCorrection`
- `Asana identity` -> `CYP page`, label `hasCYPPage`
- Pose sequence labels: `hasNextPose`, `repeatsPose`, `hasInversePose`

Bottom evidence strip, exact labels separated into five cells: `Base SN: 12 poses`; `Variants: 4`; `Pose 4 <-> Pose 9: inverse`; `Pose 1 <-> Pose 12: repeat`; `Pose1 -> BaseSN_Pose01 -> Pranamasana`.

Use small line icons: message-square, list-checks, languages, code, network, database, table, image/book, sparkles. Keep all text horizontal, spelled correctly, and non-overlapping. Make it look like a polished system architecture figure, not an advertisement.

## Critical Review

The v2 generated figure is visually stronger than the first draft. It correctly emphasizes the main paper claim that the LLM assists with planning and explanation, while ontology facts are returned by local OWL/SPARQL execution. The correction layer is also improved: `Pose Error` connects to `Correction Instruction` through `hasCorrection`.

Before camera-ready use, manually inspect small text after scaling to final column width. The generated graphic is suitable as a polished draft, but exact publication figures with many labels may still benefit from a deterministic vector redraw if the venue requires perfect edge-label placement.

## V3 Revision Prompt

Create a clean, polished, vector-like systems pipeline figure for SN-YE, landscape extra-wide and low-height, approximately 2.4:1 aspect ratio. Remove the top title, the separate `SN-YO Ontology (excerpt)` block, and the bottom evidence strip. Use four left-to-right sections only: `User question`, `Access modes`, `Query grounding and execution`, and `Retrieved results`.

In `Access modes`, show `Predefined questions`, `Natural language`, and `SPARQL`, plus a more visible multilingual `Language labels` area with chips `EN`, `AR`, `ZH`, `FR`, `RU`, `ES`, `HI`, `TA`, `BN`, `TE`, and `+18`, with the caption `6 UN + 22 IN`.

In the central execution panel, replace `Gemini planner` with `LLM model`. Show `LLM model -> Intent template -> SPARQL` with the note `plans query, not facts`, and separately show `Browser OWL parser -> Local SELECT runner -> SN-YO master.owl` with the note `ontology returns facts`. Integrate only a compact mini knowledge-graph motif inside the execution panel, with nodes for `Pose`, `Asana`, `Variant`, `Breathing`, `Safety`, and `Correction`.

Use a slightly more colorful but still paper-ready palette: navy, teal, amber, green, purple, and coral accents over a white/pale-blue background. Keep text crisp, readable, and non-overlapping.

## V3 Critical Review

The v3 figure satisfies the requested structural corrections: no top title, no standalone ontology excerpt block, no bottom evidence strip, a wider and lower canvas, and `LLM model` replaces `Gemini planner`. The multilingual capability is now more visible through language chips and the `6 UN + 22 IN` caption. The only remaining camera-ready caveat is that the mini graph uses shortened labels such as `hasBreathing`; if the final paper needs exact ontology predicate labels inside the figure, a deterministic vector redraw or one more targeted regeneration may be useful.

## V3-Wide Dimension Fix

`sn-ye-pipeline-generated-v3-wide.png` crops the excess vertical canvas from v3 without scaling or distorting the artwork. The corrected dimensions are `1914 x 700`, compared with the original v3 dimensions of `1914 x 822`.

## V4 Regeneration Prompt

Create a clean, polished, vector-like systems pipeline figure for SN-YE, landscape extra-wide and low-height, approximately 2.6:1 aspect ratio. The image must be natively composed in this wide aspect ratio, not cropped or stretched. Do not vertically stretch any text, icons, panels, or shapes. Typography must be normal-width, upright, proportional sans-serif, with natural letterforms. Do not use condensed, elongated, warped, squeezed, or vertically stretched fonts.

Keep four compact left-to-right sections only: `User question`, `Access modes`, `Query grounding and execution`, and `Retrieved results`. Do not include a top title, standalone ontology excerpt block, or bottom evidence strip. Replace `Gemini planner` with `LLM model`. In the retrieved results panel, remove `Source SPARQL` completely and show only `Facts`, `Result table`, `CYP visual reference`, and `Grounded explanation`.

Show multilingual support in `Access modes` using colorful chips `EN`, `AR`, `ZH`, `FR`, `RU`, `ES`, `HI`, `TA`, `BN`, `TE`, and `+18`, with the caption `6 UN + 22 IN`. In the central panel, show `LLM model -> Intent template -> SPARQL` with `plans query, not facts`, and `Browser OWL parser -> Local SELECT runner -> SN-YO master.owl` with `ontology returns facts`. Include a compact integrated graph motif with `Pose`, `Asana`, `Variant`, `Breathing`, `Safety`, and `Correction`.

## V4 Critical Review

The v4 regeneration addresses the typography issue better than the cropped v3-wide version: the text is composed normally rather than visually stretched, the figure is natively wide, and the retrieved-results column no longer includes `Source SPARQL`. It also keeps the multilingual support visible. Remaining minor caveats are normal for generated bitmap figures: exact icon semantics and tiny edge labels should be checked after final paper scaling.

## V5 Ontology Correction Prompt

Regenerate the SN-YE pipeline figure in the same overall visual style, proportions, and layout as v4. Preserve the four-panel structure, the `LLM model -> Intent template -> SPARQL` row, the browser/parser/execution row, multilingual chips, and retrieved-results cards. Replace only the bottom mini ontology graph with a correct reduced SN-YO overview.

The corrected graph centers on `Pose occurrence` as the hub. It connects `Pose occurrence -> Asana identity` with `hasAsana`, `Pose occurrence -> Variant` with `belongsToVariant`, `Pose occurrence -> Breathing Pattern` with `hasBreathingPattern`, `Pose occurrence -> Safety Note` with `hasSafetyNote`, `Pose occurrence -> Pose Error` with `hasPossibleError`, `Pose Error -> Correction Instruction` with `hasCorrection`, and `Asana identity -> CYP page` with `hasCYPPage`. Add Pose-to-Pose loop arrows for `hasNextPose`, `repeatsPose`, and `hasInversePose`. Do not draw `Asana -> Variant`, `Pose -> Correction Instruction`, `Correction -> Safety`, or a `Pose -> Asana -> Variant -> Breathing` chain.

## V5 Critical Review

The v5 draft fixes the ontology motif but changes too much of the surrounding layout and becomes taller than v4. It is useful as an ontology-structure reference, but v6 is the preferred paper figure because it preserves v4's layout.

## V6 Edit Prompt

Edit the provided v4 image. Preserve the entire figure exactly as much as possible: same canvas, same four panels, same colors, icons, typography, arrows, user question panel, access modes panel, LLM/template/SPARQL row, browser/parser/select/master.owl row, and retrieved-results panel. Modify only the mini ontology graph inside the dotted box at the bottom of the central `Query grounding and execution` panel.

Replace the graph with a hub-and-spoke structure centered on `Pose occurrence`, with nodes for `Asana identity`, `Variant`, `Breathing Pattern`, `Safety Note`, `Pose Error`, `Correction Instruction`, and `CYP page`. Use the accurate relations `hasAsana`, `belongsToVariant`, `hasBreathingPattern`, `hasSafetyNote`, `hasPossibleError`, `hasCorrection`, `hasCYPPage`, plus Pose-to-Pose loop arrows for `hasNextPose`, `repeatsPose`, and `hasInversePose`.

## V6 Critical Review

The v6 figure is the preferred corrected version. It preserves the successful v4 layout while replacing the incorrect mini graph with the accurate SN-YO hub structure: `Pose occurrence` is central; `Variant`, `Asana identity`, `Breathing Pattern`, `Safety Note`, and `Pose Error` are direct Pose-linked nodes; `Pose Error` points to `Correction Instruction`; and `Asana identity` points to `CYP page`. The figure should still be checked at final paper scale for the smallest edge labels.

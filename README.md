# desker — a desk for scientific discovery

**Vision:** Make scientific exploration easier to branch, compare, revisit, and connect—without sacrificing reproducibility.

Desker is an experimental spatial environment for computational research: an open desk for datasets, scripts, visualizations, notes, artifacts, and hypotheses. The canvas is a view into an underlying provenance-aware analysis graph, not the graph itself. Spatial proximity is not equivalent to a computational dependency.

## Current prototype

Open `index.html` in a browser. No installation required. Move cards, select and edit objects, add experimental steps, branch existing analyses, open a comparison checklist, and persist the current desk in browser localStorage.

**This is a UI-only conceptual prototype.** No FASTQ processing, R/Python execution, scientific validation, back-end storage, collaboration, automatic recomputation, or actual differential-expression comparisons are implemented.

## Example research story: mouse scRNA-seq

A researcher starts with 20 mouse single-cell RNA-seq samples (10 control, 10 condition) as FASTQs. They consider a kit-compatible Cell Ranger pipeline or an in-house alternative, choose Cell Ranger and its standard reference, then explore alignment metrics and QC reports on their desk.

Before accepting count matrices, they may independently branch to test custom trimming, alternate alignment settings, or a custom reference/index related to a promoter or transcription start site. These experiments are explicitly exploratory and must be evaluated for compatibility with the chosen pipeline.

With count matrices, one branch uses Scanpy and Scrublet in Python; another uses Seurat and DoubletFinder in R. Outputs and assumptions can be inspected side by side. Subsequent analyses include filtering, normalization, clustering, cell annotation, pseudobulk differential expression, pseudotime, and GO enrichment. These downstream studies can branch in parallel, with scientific assumptions and results retained.

Later, researchers discover one or two mislabeled/misplaced samples. Desker should support branching from the relevant QC stage, updating sample metadata and inclusion, identifying invalidated downstream artifacts, recomputing only affected steps where scientifically sound, and comparing conclusions without destroying the original analysis.

## Product requirements (target, not yet built)

1. A persistent, freely rearrangeable infinite canvas containing datasets, figures, code, outputs, and notes.
2. Typed links distinguishing *data dependency*, *scientific association*, and *visual grouping*.
3. Drag-and-drop import of analysis scripts, datasets, and files, with extensible Python, R, Bash, and other language runners.
4. Immutable execution provenance: input hashes, code versions, parameters, environment/container identifiers, tool/reference versions, output hashes, timestamps, and scientific metadata.
5. Branching and comparison of datasets, assumptions, methods, references, and analysis states; ability to revisit inconclusive branches.
6. Dependency-aware invalidation and optional recomputation, avoiding unnecessary runs while exposing cost.
7. Interactive previews and domain-specific scientific comparisons, not just file diffs.
8. Cross-language interoperability using explicitly declared input/output artifact contracts.
9. Ability to arrange multiple divergent hypotheses concurrently and revisit them weeks later.
10. Safety controls for execution: isolated jobs, explicit permissions, limits, auditability, and no arbitrary execution inside web-serving processes.

## Technical direction

- **Frontend:** spatial canvas and inspectors. Model canonical project entities separately from screen coordinates.
- **Core graph:** entities for datasets, scripts, analysis definitions, executions, artifacts, hypotheses, annotations, and environments. Directed dependency edges plus separate association/grouping edges.
- **Artifact storage:** immutable large files in object storage; database stores references, hashes, lineage, and metadata.
- **Execution:** a dedicated containerized runner or scientific HPC integration; a static/Vercel frontend is not a substitute for running Cell Ranger, Seurat, or Scanpy.
- **Incremental recomputation:** cache by content-addressed inputs, code, parameters, reference, and environment; invalidate dependent results upon upstream changes.
- **Research diffs:** scientific comparison adapters for mapping rates, detected genes, QC, cluster changes, sample assignments, DE contrasts, and pathway results.

## Focused MVP roadmap

1. **Desk** — persistent canvas, move and group objects, attach notes and reference files.
2. **Graph** — typed connections and explicit provenance records; visualize dependency and fork history.
3. **One real computation** — safely execute a small Python and R operation against demo tabular data in a separate worker; display generated outputs.
4. **Branching** — fork from a stage, change a parameter or sample set, and compare actual output.
5. **Domain adapter** — one tested mouse scRNA-seq subset workflow and scientifically meaningful comparison.

Avoid real FASTQ-scale execution, unrestricted arbitrary scripts, and a full pipeline scheduler in the first milestone.

## Agent / implementation prompt

> Build desker as an exploratory, provenance-aware scientific analysis workspace. Preserve the user's freedom to move, group, branch, and revisit datasets, scripts, plots, results, and notes on an infinite canvas. Treat visual placement as separate from scientific relationships and executable dependencies. Support a workflow involving 10-control/10-condition mouse scRNA-seq FASTQs, alternative Cell Ranger references or trimming, Scanpy/Scrublet and Seurat/DoubletFinder paths, clustering/annotation, pseudobulk, pseudotime, GO enrichment, and the later discovery of mislabeled samples. Show every affected stage, preserved branch, comparison, and provenance record. Incrementally develop a truthful functional MVP before implementing heavy compute. Ensure that UI mock results are marked as simulated; never imply real biological analyses ran without execution. Prefer safe isolated backends for any actual code execution and keep Vercel focused on the frontend/API orchestration.

### Success criterion

A researcher can ask “What changes if I revise this reference, QC decision, sample label, or analysis method?” and explore a reproducible alternative without overwriting or manually reconstructing the original work.

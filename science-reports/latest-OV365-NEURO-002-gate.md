# OV365-NEURO-002 — Oncology leakage benchmark gate (2026-10-16)

**Status: BLOCKED.** No experiment ran and no metric was produced today. This job only checks prerequisites and fails closed.

## Unmet gates (7)

- **license** — LUMIERE license conflict resolved with written evidence (Figshare tags CC0; the Scientific Data usage notes and the authors' README say non-commercial). Record the evidence string.
- **dataset_snapshot_hash** — sha256 of the locked dataset snapshot (sha256:<64 hex>)
- **patient_manifest_hash** — sha256 of the canonical patient manifest
- **partition_manifest_hash** — sha256 of the patient-level partition manifest
- **preregistration_hash** — sha256 of the frozen preregistration
- **label_escrow** — Test labels held where the experiment process cannot read them (labels are public, so this must be physical separation, not a flag)
- **kaggle_dataset_ref** — Private Kaggle dataset owner/slug holding the locked snapshot (license permitting)

## Always-on blockers (not configurable)

- The pipeline itself does not exist yet: patient identity resolver, partition engine, label escrow, temporal-leakage detector, cluster bootstrap, unseal gate. Meeting every gate above still produces no result.
- The earlier mammography audit notebook used simulated TP53, tissue-site and age variables and is **not** scheduled. TP53, TSS and genomics do not exist in CBIS-DDSM or CMMD.
- The published LUMIERE 50.96% benchmark (Matoso et al., arXiv:2504.18268) splits folds by patient-week timepoint with test-fold early stopping, so a leakage comparison (A0 vs patient-grouped) is well motivated, but the effect size is unmeasured.

Edit `data/oncology-gate.json` to record gate evidence. Hashes must be real `sha256:<64 hex>` values; placeholders are rejected.

# OPEN\_SOURCE\_STACK.md

> **Scope:** Catalog of open‑source (and model weight) dependencies PENNY leverages or may leverage, with links, licenses (SPDX where possible), swap‑outs, and notes for multi‑tenant/white‑label SaaS.

This is a living document. Pair each entry with an ADR when we lock choices. Current ADRs: ADR‑0001 (Chat base), ADR‑0002 (Vector store), ADR‑0003 (Model routing policy).

---

## Evaluation Criteria (how we pick)

* **Maintenance** (release cadence, open PRs/issues, bus factor)
* **Community** (stars, contributors, governance under a foundation when possible)
* **Modularity & APIs** (clean boundaries, JSON‑schema/tooling)
* **Security** (SBOM, CVEs, supply‑chain posture)
* **License fit** (permissive vs copyleft; SaaS restrictions; model licenses)
* **Operational maturity** (HA docs, Helm/Operator, backups)

> **Red‑flag licenses for SaaS/white‑label:** AGPL‑3.0 (copyleft across network), SSPL‑1.0, BUSL‑1.1 (source‑available, not OSI), vendor custom licenses. Prefer permissive (Apache‑2.0, MIT, BSD‑3‑Clause) or MPL‑2.0 when needed.

---

## Components Matrix

| Category                 | Project                             | Purpose                                                | Home / Docs                                                                                                          | License                                                                                       | Swap‑outs / Notes                                                                                   |
| ------------------------ | ----------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Chat / Agent Base**    | **LibreChat**                       | Multi‑provider chat UI + plugins; candidate base/fork  | [https://github.com/danny-avila/LibreChat](https://github.com/danny-avila/LibreChat)                                 | **MIT**                                                                                       | Good UX; OSS; add multi‑tenant + artifact viewer glue. Alternative: **LobeChat**.                   |
|                          | **LobeChat**                        | Modern chat framework with MCP marketplace & artifacts | [https://github.com/lobehub/lobe-chat](https://github.com/lobehub/lobe-chat)                                         | **Apache‑2.0**                                                                                | Strong UI + marketplace ideas; can cherry‑pick patterns if we fork LibreChat.                       |
| **Model Serving**        | **Ollama**                          | Local model runner/dev convenience                     | [https://github.com/ollama/ollama](https://github.com/ollama/ollama)                                                 | **MIT** (app); *models have their own licenses*                                               | Great for dev; production needs vLLM/TGI for scale.                                                 |
|                          | **vLLM**                            | High‑throughput inference server                       | [https://github.com/vllm-project/vllm](https://github.com/vllm-project/vllm)                                         | **Apache‑2.0**                                                                                | Production‑grade; tensor parallelism, paged‑attention.                                              |
|                          | **TGI** (Text Generation Inference) | Optimized inference server                             | [https://github.com/huggingface/text-generation-inference](https://github.com/huggingface/text-generation-inference) | **Apache‑2.0**                                                                                | License briefly changed in 2023; current OSS **Apache‑2.0**; keep pinned version per ADR.           |
| **Vector / Retrieval**   | **pgvector**                        | Postgres extension for vector search                   | [https://github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)                                         | **PostgreSQL**                                                                                | Default choice (simplicity, RLS compat). Alt: **Weaviate** (BSD‑3‑Clause), **Milvus** (Apache‑2.0). |
|                          | **Weaviate**                        | Vector DB                                              | [https://github.com/weaviate/weaviate](https://github.com/weaviate/weaviate)                                         | **BSD‑3‑Clause**                                                                              | Powerful hybrid search; managed options exist.                                                      |
|                          | **Milvus**                          | Vector DB                                              | [https://github.com/milvus-io/milvus](https://github.com/milvus-io/milvus)                                           | **Apache‑2.0**                                                                                | Distributed, CNCF LF AI & Data project.                                                             |
| **Datastores**           | **PostgreSQL**                      | Primary app DB (RLS)                                   | [https://www.postgresql.org](https://www.postgresql.org)                                                             | **PostgreSQL**                                                                                | Battle‑tested; long LTS.                                                                            |
|                          | **Redis**                           | Queues/cache                                           | [https://redis.io](https://redis.io)                                                                                 | **RSALv2/SSPL/AGPL** (new)                                                                    | ⚠️ License changed (no longer BSD). **Recommendation:** use **Valkey** (BSD‑3‑Clause) as drop‑in.   |
|                          | **Valkey** (Redis fork)             | Redis‑compatible cache                                 | [https://valkey.io](https://valkey.io)                                                                               | **BSD‑3‑Clause**                                                                              | Community‑governed under LF; preferred.                                                             |
|                          | **MinIO**                           | S3‑compatible object storage (artifacts)               | [https://min.io](https://min.io)                                                                                     | **AGPL‑3.0** (dual‑license)                                                                   | OK if self‑hosted and compliant; alternatives: Ceph, AWS S3, GCS.                                   |
| **Frontend / UI**        | **React**                           | SPA framework                                          | [https://react.dev](https://react.dev)                                                                               | **MIT**                                                                                       | –                                                                                                   |
|                          | **TypeScript**                      | Typed JS                                               | [https://www.typescriptlang.org](https://www.typescriptlang.org)                                                     | **Apache‑2.0**                                                                                | –                                                                                                   |
|                          | **Tailwind CSS**                    | Utility CSS                                            | [https://tailwindcss.com](https://tailwindcss.com)                                                                   | **MIT**                                                                                       | Tailwind UI (paid) is separately licensed.                                                          |
|                          | **shadcn/ui**                       | Headless UI patterns                                   | [https://ui.shadcn.com](https://ui.shadcn.com)                                                                       | **MIT**                                                                                       | Code‑copy model; audit copied code.                                                                 |
|                          | **Mermaid**                         | Diagrams in docs                                       | [https://mermaid.js.org](https://mermaid.js.org)                                                                     | **MIT**                                                                                       | –                                                                                                   |
| **API & Schema**         | **Fastify**                         | Node.js API framework                                  | [https://fastify.io](https://fastify.io)                                                                             | **MIT**                                                                                       | –                                                                                                   |
|                          | **OpenAPI Spec**                    | API contracts                                          | [https://swagger.io/specification](https://swagger.io/specification)                                                 | **Apache‑2.0** (spec)                                                                         | Drives typed SDKs, mocks, tests.                                                                    |
|                          | **Zod**                             | Runtime validation                                     | [https://github.com/colinhacks/zod](https://github.com/colinhacks/zod)                                               | **MIT**                                                                                       | –                                                                                                   |
| **Observability**        | **OpenTelemetry**                   | Tracing/metrics                                        | [https://opentelemetry.io](https://opentelemetry.io)                                                                 | **Apache‑2.0**                                                                                | Standardize traces across LLM/tool calls.                                                           |
|                          | **Jaeger**                          | Trace UI/backend                                       | [https://www.jaegertracing.io](https://www.jaegertracing.io)                                                         | **Apache‑2.0**                                                                                | –                                                                                                   |
| **Infra / DevEx**        | **Docker / Compose**                | Local/dev containers                                   | [https://www.docker.com](https://www.docker.com)                                                                     | *Varies by component*                                                                         | Use official images where possible.                                                                 |
|                          | **Kubernetes**                      | Orchestration                                          | [https://kubernetes.io](https://kubernetes.io)                                                                       | **Apache‑2.0**                                                                                | –                                                                                                   |
|                          | **Helm**                            | K8s packaging                                          | [https://helm.sh](https://helm.sh)                                                                                   | **Apache‑2.0**                                                                                | –                                                                                                   |
|                          | **Terraform**                       | IaC                                                    | [https://www.terraform.io](https://www.terraform.io)                                                                 | **BUSL‑1.1** (source‑available)                                                               | ⚠️ Not OSI. **Recommendation:** **OpenTofu** (MPL‑2.0) fork.                                        |
|                          | **OpenTofu**                        | IaC (Terraform fork)                                   | [https://opentofu.org](https://opentofu.org)                                                                         | **MPL‑2.0**                                                                                   | Drop‑in for most modules.                                                                           |
|                          | **ESLint**                          | Linting                                                | [https://eslint.org](https://eslint.org)                                                                             | **MIT**                                                                                       | –                                                                                                   |
|                          | **Prettier**                        | Formatting                                             | [https://prettier.io](https://prettier.io)                                                                           | **MIT**                                                                                       | –                                                                                                   |
|                          | **commitlint**                      | Conventional Commits                                   | [https://github.com/conventional-changelog/commitlint](https://github.com/conventional-changelog/commitlint)         | **MIT**                                                                                       | –                                                                                                   |
|                          | **Changesets**                      | Versioning/release                                     | [https://github.com/changesets/changesets](https://github.com/changesets/changesets)                                 | **MIT**                                                                                       | –                                                                                                   |
| **Testing**              | **Vitest**                          | Unit tests                                             | [https://vitest.dev](https://vitest.dev)                                                                             | **MIT**                                                                                       | –                                                                                                   |
|                          | **Jest**                            | Unit tests (alt/legacy)                                | [https://jestjs.io](https://jestjs.io)                                                                               | **MIT**                                                                                       | –                                                                                                   |
|                          | **Playwright**                      | E2E browser tests                                      | [https://playwright.dev](https://playwright.dev)                                                                     | **Apache‑2.0**                                                                                | –                                                                                                   |
|                          | **k6**                              | Load testing                                           | [https://github.com/grafana/k6](https://github.com/grafana/k6)                                                       | **AGPL‑3.0**                                                                                  | ⚠️ AGPL; alternative **Artillery** (MPL‑2.0).                                                       |
|                          | **Artillery**                       | Load testing                                           | [https://www.artillery.io](https://www.artillery.io)                                                                 | **MPL‑2.0**                                                                                   | Simpler licensing; good CI use.                                                                     |
| **(Optional) Image Gen** | **Stable Diffusion**                | Text‑to‑image                                          | [https://stability.ai](https://stability.ai)                                                                         | **CreativeML OpenRAIL‑M (weights)** / code often **MIT**                                      | Use if we add image tools; respect use‑restrictions.                                                |
|                          | **FLUX** (Black Forest Labs)        | SOTA image models                                      | [https://bfl.ai](https://bfl.ai)                                                                                     | **License varies by model** (e.g., **Non‑Commercial** for some; commercial program available) | If used, pin exact model + license and add org key policy.                                          |

> **Note on model weights:** Many LLMs and image models are released under **OpenRAIL**‑style or **Community** licenses that include **use‑based restrictions**. Treat weights as separate artifacts with their own compliance gates.

---

## License Guidance & Defaults

* **Default stance:** Prefer **Apache‑2.0**, **MIT**, **BSD‑3‑Clause**, **PostgreSQL**, **MPL‑2.0**.
* **Avoid by default:** **AGPL‑3.0** (unless isolated) for server dependencies; **SSPL‑1.0**; **BUSL‑1.1** for core runtime services.
* **Known pivots we already adopt:**

  * **Redis → Valkey (BSD‑3‑Clause)** to preserve OSS + distro friendliness.
  * **Terraform → OpenTofu (MPL‑2.0)** to avoid BUSL and keep ecosystem compatibility.
  * **k6 (AGPL‑3.0) → Artillery (MPL‑2.0)** when AGPL is a blocker for customers.
* **MinIO (AGPL‑3.0):** acceptable for self‑hosted deployments with no code distribution. For SaaS, review obligations or prefer cloud object stores.
* **Model‑weight licenses:** enforce **per‑model allowlists** and usage policy banners (e.g., OpenRAIL terms surfaced in UI before enablement).

---

## Multi‑Tenancy & White‑Label Notes

* Verify **third‑party brand and asset licenses** (fonts, icons) before shipping a new tenant theme.
* Keep a **per‑tenant SBOM** with hashes for all server images and models.
* For AGPL components (if any), ensure isolation (separate process/container), no code linking, and have legal sign‑off.

---

## ADR Hooks (to be updated as we decide)

* **ADR‑0001 – Chat base:** LibreChat (MIT) vs LobeChat (Apache‑2.0). Decision drivers: plugin model, SSR/SPA needs, artifact APIs.
* **ADR‑0002 – Vector store:** pgvector (PostgreSQL) default; Weaviate/Milvus as scale‑out paths.
* **ADR‑0003 – Model routing:** vLLM (Apache‑2.0) + TGI (Apache‑2.0) support; Ollama for local/dev.
* **ADR‑0004 – Cache:** Prefer Valkey (BSD‑3‑Clause) over Redis (post‑7.4 licensing).
* **ADR‑0005 – IaC:** Prefer OpenTofu (MPL‑2.0) over Terraform (BUSL‑1.1).

---

## Compliance Checklist (per release)

* [ ] SBOM generated (container images + Node packages + Python wheels)
* [ ] Licenses scanned and aggregated (SPDX) per component
* [ ] Model weight cards archived with license snapshots
* [ ] Transitive license review for copied UI code (shadcn/ui)
* [ ] Tenants notified of any license‑affecting changes

---

## Change Log

* **2025‑08‑21:** Initial version added to repo.

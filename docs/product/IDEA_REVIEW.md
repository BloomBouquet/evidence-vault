# Evidence Vault Product Continuity Review

Reviewed: 2026-08-27
Agent: Team 해바라기 — Idea Agent
Decision: **KEEP**

## Decision

Keep the approved `증빙함 / Evidence Vault` product premise and MVP boundaries. Do not pivot into legal-advice automation, generic cloud storage, or a generic subscription tracker.

The strongest job remains:

> 구매·구독·렌탈·환불 과정에서 나중에 필요한 사실과 파일을 문제 발생 전에 개인적으로 정리하고, 사용자가 기록한 중요한 날짜를 놓치지 않게 보여준다.

## Observed external evidence

### Korea Consumer Agency

The Korea Consumer Agency's current damage-relief filing guidance asks applicants to attach supporting material such as contract documents and receipts, written/electronic records showing that the consumer raised the issue, and screenshots or printed online records. Its detailed filing guidance also lists evidence of purchase, evidence that a refund/cancellation was requested, and evidence of the seller's refusal or non-performance among the materials used to support a claim.

Source: https://www.kca.go.kr/odr/pg/ma/pgProcssInfo2.do

The Agency also states that a relief request may be excluded when the applicant cannot substantiate the claim, including when substantiating documents are not submitted.

Source: https://www.kca.go.kr/odr/link/pg/pr/osPgReqFormW.do

### Electronic Commerce Mediation Committee

The Electronic Commerce Mediation Committee states that electronic-commerce disputes include delivery, contract, product-information, return and refund disputes. Its FAQ says supporting evidence may be attached when filing, and its procedure includes fact-finding based on the parties' claims and responses.

Sources:
- https://usr.ecmc.or.kr/mediation/faq.do
- https://usr.ecmc.or.kr/mediation/procedure.do

The Committee currently publishes a 2025 electronic-document/e-commerce dispute mediation casebook in 2026, showing that the dispute category remains operationally active rather than being a stale historical problem.

Source: https://usr.ecmc.or.kr/main.do

## Inference

The official procedures do not prove demand for this exact software product, but they do support the underlying workflow assumption: consumers benefit from being able to retrieve transaction facts, communications and supporting files when a dispute or relief process begins.

This is a stronger product boundary than "AI tells you whether you can win/refund" because the evidence-organizing workflow is useful before any individualized legal judgment and maps to materials official dispute processes actually use.

## Scope ruling

Keep:
- deadline-first dashboard using user/source-recorded meanings,
- factual transaction timeline,
- private evidence attachments,
- neutral dispute-preparation checklist,
- deterministic evidence packet export,
- official-source consumer guide.

Reject for MVP:
- individualized legal advice or legal conclusions,
- win/refund probability scoring,
- negotiation/representation on the user's behalf,
- success-fee refund recovery,
- automatic legal deadline inference presented as certain,
- public evidence feed,
- medical/health dispute evidence workflow,
- generic subscription-management expansion unrelated to evidence preparation.

## Evidence quality note

No market size, user count, conversion rate, retention, CAC, LTV or competitor-performance figure is asserted here. Those metrics are not currently measured for Evidence Vault and must not be invented. The later Data & Marketing Agent should define a measurement plan if first-party analytics are still absent.

## Rationale summary

**Assessment:** keep the product direction.

**Evidence:** official Korean consumer-relief and electronic-commerce mediation processes explicitly rely on transaction records and supporting evidence.

**Risk:** the product could drift into regulated legal-service behavior if checklist/copy/export begins making individualized legal judgments.

**Control:** preserve facts-first wording, source-labelled dates, private-by-default evidence and the existing legal-service disclaimer throughout implementation.

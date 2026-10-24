# Doctrine: lenses that generate questions

None of these proves a finding. Each suggests where to look; the repository and the running site
decide. When two sources disagree (small functions vs deep modules, DRY vs premature abstraction,
mocks vs integration realism), resolve from local forces: change frequency, cognitive load,
failure risk, user consequence, reversibility.

| Lens | Questions it raises |
|---|---|
| A Philosophy of Software Design | Does this add complexity, change amplification or unknown unknowns? Is the module deep or a shallow pass-through? Can the error be defined out of existence? |
| Refactoring (smells as triggers) | Duplicated knowledge, divergent change, shotgun surgery, feature envy, primitive obsession. A smell is a question, not a finding. |
| The Pragmatic Programmer | Who owns this piece of knowledge (DRY)? Is it orthogonal? Reversible? Programming by coincidence? |
| Working Effectively with Legacy Code | Is there a seam to test this? Characterization before change? |
| Effective TypeScript | Is a runtime boundary trusting a type? `any`/`unknown` handling, narrowing, discriminated unions. The installed compiler decides. |
| Designing Data-Intensive Applications | What is authoritative, what is derived, what is atomic, what goes stale, what happens on retry or concurrent run? |
| Release It! | Timeouts, retry amplification, resource exhaustion, cascading failure, degradation. |
| Fundamentals / Hard Parts of Software Architecture | Coupling, cohesion, trade-offs; fitness functions as automated constraints (this repo's gates are fitness functions). |
| Unit Testing (Khorikov), xUnit Test Patterns | Regression protection vs refactoring resistance; faithful doubles; does the test fail for the intended defect? |
| Design of Everyday Things, Nielsen heuristics | Signifiers, feedback, mapping, status visibility, error prevention and recovery. |
| Don't Make Me Think, Designing Interfaces | Scanability, conventions, self-evident controls, safe exploration. |
| Inclusive Components, WCAG/APG | Platform primitives first, keyboard behaviour, robust names and states. |
| Strategic Writing for UX | Action language, consequences, honest state wording, recovery paths. |
| Threat modeling, OWASP | Actors, flows, trust boundaries; STRIDE only as a search heuristic. |
| API Design Patterns | Predictability, idempotency, long-running operations, compatibility. |

Product evidence and the design authority outrank reviewer taste.

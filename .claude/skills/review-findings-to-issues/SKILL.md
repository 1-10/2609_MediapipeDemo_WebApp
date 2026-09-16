---
name: review-findings-to-issues
description: Convert selected review findings into well-scoped GitHub Issues for this migration-phase Android repository. Use this when a human has already chosen which review findings should become Issues.
---

# review-findings-to-issues

## Purpose

This skill converts review findings, code review comments, migration notes, or manually selected technical concerns into GitHub Issues that are safe and practical for implementation.

This skill does NOT perform code review.
This skill does NOT decide broad product priorities.
This skill only converts already-selected findings into well-formed Issues.

---

## Repository Context

This repository is an older Android application (Java) currently under migration toward Kotlin and modern Jetpack APIs.

Workflow rules:

- `main` is not the current implementation target
- `modernize` is the integration branch
- implementation branches are created from `modernize`
- implementation branch format:
  `future/issue-<number>-<short-description>`
- implementation PRs must target `modernize`
- Draft PRs are preferred first
- real-device testing is important

High-risk areas that usually require human review:

- keystore / signing configuration / release build settings
- AndroidManifest permissions (especially runtime permissions on Android 6+)
- network security config / cleartext traffic settings
- camera / microphone / bluetooth / location / push notification behavior
- ProGuard / R8 rules (obfuscation, shrinking)
- secrets / API keys / credentials
- Gradle build configuration changes (compileSdk, minSdk, targetSdk upgrades)
- large layout or navigation graph edits
- Java ↔ Kotlin interop changes
- device-only behavior (sensors, GPS, audio)
- background processing / WorkManager / service changes

---

## When to Use

Use this skill when:

- a reviewer subagent has already identified problems
- a human has selected one or more findings to convert into Issues
- a rough engineering note needs to become an actionable Issue
- a migration concern needs to be rewritten into an agent-safe or manual-review Issue

Do NOT use this skill when:

- you need to perform the review itself
- you need to directly implement code changes
- the user only wants discussion, not Issue creation
- the input is still too vague to isolate a concrete problem statement

---

## Core Responsibilities

For each selected finding, this skill must:

1. Rewrite it into a clear GitHub Issue
2. Reduce overly broad findings into one small implementation-oriented task
3. Split large findings into multiple Issues when necessary
4. Explicitly define:
   - problem
   - goal
   - in-scope items
   - out-of-scope items
   - acceptance criteria
   - likely affected areas
   - risk level
   - device testing requirement
5. Classify the Issue as:
   - `agent-safe`
   - `manual-review-required`
6. Prefer one Issue = one short-lived branch = one PR

---

## Strict Rules

### 1. Prefer small Issues

Do not create oversized Issues.

Bad examples:
- modernize settings screen
- fix all layout problems
- refactor networking layer

Better examples:
- fix SharedPreferences blocking main thread (commit → apply)
- remove non-existent ACCESS_COARSE_UPDATES permission from manifest
- add null guard to TCPManager.sendBytes before writing to OutputStream

### 2. Always define non-goals

Every Issue must explicitly state what should NOT be changed.

### 3. Always define acceptance criteria

Every Issue must contain concrete completion conditions.

### 4. Be conservative about risk

If a task touches high-risk areas, prefer `manual-review-required`.

### 5. Be explicit about uncertainty

If affected files, device-test need, or exact scope are uncertain, say so clearly.

### 6. Avoid hidden expansion

If the finding includes multiple distinct concerns, split them instead of bundling them.

---

## Classification Rules

### Classify as `agent-safe` when:

- scope is narrow
- likely changes are localized
- no high-risk areas are involved
- the task is realistically achievable in one branch and one PR
- device testing is limited or only precautionary
- changes are purely in Java/Kotlin logic with no manifest, Gradle, or build config involvement

### Classify as `manual-review-required` when:

- AndroidManifest permissions are added or removed
- keystore / signing / release build settings are touched
- ProGuard / R8 rules are modified
- secrets or credentials may be affected
- Gradle build config changes (SDK versions, dependencies) are large
- sensor, GPS, audio, or other device-only behavior is central
- Java ↔ Kotlin interop boundaries are changed
- the scope is ambiguous or risky

If unsure, prefer `manual-review-required`.

---

## Output Format

Output in Japanese.

For each Issue, use the following Markdown format:

## Title
[short concrete title]

## Labels
- [label]
- [label]
- [label]

## Problem
[what is wrong or missing]

## Goal
[what success looks like]

## In Scope
- ...
- ...

## Out of Scope / Non-goals
- ...
- ...

## Acceptance Criteria
- [ ] ...
- [ ] ...
- [ ] ...

## Likely Affected Areas
- ...
- ...

## Risk Level
[low / medium / high]

## Device Testing
[required / not required / unsure]

## Notes for Implementer
[extra assumptions, warnings, or clarifications]

---

## Splitting Rules

If a selected finding is too large, do NOT force it into one Issue.

Instead output:

1. A short parent summary
2. Then a numbered list of smaller Issues in the required format

When splitting:
- separate unrelated file groups
- separate risky changes from safe changes
- separate UI polish from bug fixing
- separate device-dependent validation from static code cleanup

---

## Labels Guidance

Use appropriate labels such as:

- `agent-safe`
- `manual-review-required`
- `migration`
- `needs-device-test`
- `risk-low`
- `risk-medium`
- `risk-high`

Do not add labels blindly.
Use only labels supported by the actual repository workflow when known.

---

## Branch and PR Awareness

When writing Issues, assume implementation will follow this workflow:

- branch from `modernize`
- use `future/issue-<number>-<short-description>`
- submit Draft PR to `modernize`
- require explicit device-testing note if relevant

Use this context to keep Issues implementation-friendly.

---

## Suggested Interaction Pattern

Typical usage pattern:

1. reviewer subagent outputs findings
2. human selects one or more findings
3. invoke this skill
4. this skill rewrites the selected findings into clean GitHub Issues

Example instruction to the skill:

"Use review-findings-to-issues.
Take finding #2 and finding #5 from the review output.
Convert them into GitHub Issues for this repository.
Split them if needed.
Output only ready-to-paste Issue Markdown."

---

## Quality Checklist

Before finalizing each Issue, verify:

- Is the title concrete?
- Is the problem specific?
- Is the goal testable?
- Is scope narrow enough?
- Are non-goals explicit?
- Are acceptance criteria concrete?
- Is the risk classification appropriate?
- Is device testing judged?
- Could this reasonably fit in one branch and one PR?

If not, revise the Issue before output.

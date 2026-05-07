# Safety Layer

> **This document is for engineers and operators. It describes what the safety classifier does and — more importantly — what it doesn't.**

## What the classifier does

Every user message runs through `app/safety.py::classify` before reaching the agent. Two stages:

### Stage 1: Rule-based (`_KEYWORD_RULES`)

A list of compiled regexes for explicit crisis language in English and Polish, covering:

- **Self-harm / suicidal ideation**
- **Acute medical emergency** (chest pain, stroke symptoms, breathing trouble)
- **Eating-disorder crisis** (active starvation, purging)

If any pattern matches, coaching halts immediately and the user gets the localized escalation copy from `ESCALATION_MESSAGES`.

### Stage 2: OpenAI moderation backstop

If no rule matched, the message goes to OpenAI's moderation endpoint. We escalate on `self_harm` or `violence` categories.

If moderation fails for any reason (timeout, network), **we let the message through** and log a warning. The rationale: the rule layer already caught the worst-case explicit language; failing moderation should not silently block users.

## What the classifier does NOT do

This list is more important than the previous one.

1. **It does not catch implicit or coded language.** Someone describing a method without naming the act, using metaphor, or testing the system will get past Stage 1. Stage 2 catches some of this; not all.
2. **It is not a clinical screening tool.** It is not validated against any clinical instrument (PHQ-9, EDE-Q, etc.). Do not market it as one.
3. **It does not replace clinician oversight.** A real wellness product handling vulnerable users needs a clinical advisory board, written escalation protocols, and ideally human-in-the-loop review of flagged conversations.
4. **It will produce false positives.** A user discussing a friend, recounting their own past, or asking an academic question can trip the rules. The current copy errs toward over-escalating; this is the right default but it is not free.
5. **Polish coverage is narrower than English.** The Polish patterns were written carefully but cover fewer phrasings. Expand them as you see real user data.

## Tuning rules

Add to `_KEYWORD_RULES`. Each entry is a `(re.Pattern, SafetyCategory)` tuple. Bias toward over-flagging — false positives in this domain are cheap, false negatives are not. The categories are: `self_harm`, `medical_emergency`, `eating_disorder`, `violence`.

## Escalation copy

`ESCALATION_MESSAGES` in `app/safety.py` holds the user-facing text per category and locale. Numbers shown:

- **US:** 988 (Suicide & Crisis Lifeline), 911 (general emergency)
- **EU/Poland:** 112 (general emergency), 116 123 (Polish adult crisis line), 116 111 (Polish minors crisis line), NEDA-equivalent referral via primary-care for ED

Verify these numbers in your launch jurisdictions before you go live; they change occasionally and they vary by country. The copy is in the source — it is not yet pulled from a config.

## Non-bypass guarantees

- Once a safety event fires for a message, the agent does not run for that turn. Period.
- The escalation message is persisted to the chat history with a `safety_flag` set so it's auditable.
- The user is not signed out. They can keep typing — but every subsequent message goes through the same classifier.

## What to add before launch

In rough priority order:

1. **Clinician sign-off** on the escalation copy and on which categories trigger it.
2. **A way for moderators to review flagged conversations** — at minimum a SQL query, ideally an internal dashboard.
3. **Rate limiting** on chat (someone trying to bypass the classifier with thousands of attempts).
4. **A real reranker for the safety classifier itself** — the OpenAI moderation API is good, but for high-stakes deployment, consider a fine-tuned model on your specific population.
5. **Localized resources for every market you serve.** The current copy covers US/EU/PL. Other countries need their own numbers.
6. **A do-not-coach list of topics** beyond crisis (e.g., medication dosing, pediatric nutrition, pregnancy) that are out of scope but won't trip a crisis classifier.

## Logging

The classifier logs at INFO when a rule matches and at WARNING when the moderation API fails. In production, route these to a log aggregator with alerting on rule matches so on-call humans know when crises are flowing through your system.

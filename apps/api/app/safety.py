"""Medical & mental-health safety classifier.

Two-stage detection:
1. Fast keyword/regex pre-filter for explicit crisis language (no API call).
2. OpenAI moderation API for borderline cases.

If either stage flags the message, coaching is HALTED and the user is shown
an escalation message with regional emergency resources.

Add to, do not subtract from, the keyword list — false positives are
acceptable here; false negatives are not.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Literal

from openai import AsyncOpenAI

from app.config import get_settings

log = logging.getLogger(__name__)

SafetyCategory = Literal[
    "self_harm",
    "medical_emergency",
    "eating_disorder",
    "violence",
    "none",
]

# --- Stage 1: rule-based keywords ---
# Bias toward over-flagging. Each entry is (compiled regex, category).
# Both EN and PL.

_KEYWORD_RULES: list[tuple[re.Pattern[str], SafetyCategory]] = [
    # Self-harm / suicidal ideation — EN
    (re.compile(r"\b(kill myself|suicid\w*|end my life|want to die|don'?t want to live)\b", re.I), "self_harm"),
    (re.compile(r"\b(cut(ting)? myself|self[- ]harm|hurt myself)\b", re.I), "self_harm"),
    # Self-harm — PL
    (re.compile(r"\b(zabi[ćc] si[eę]|samob[óo]jstw\w*|nie chc[eę] [żz]y[ćc])\b", re.I), "self_harm"),
    (re.compile(r"\b(skrzywdzi[ćc] si[eę]|tn[eę] si[eę])\b", re.I), "self_harm"),
    # Medical emergency — EN
    (re.compile(r"\b(chest pain|can'?t breathe|trouble breathing|heart attack|stroke)\b", re.I), "medical_emergency"),
    (re.compile(r"\b(severe dizziness|fainting|passed out|coughing blood|vomiting blood)\b", re.I), "medical_emergency"),
    # Medical emergency — PL
    (re.compile(r"\b(b[óo]l w klatce piersiowej|nie mog[eę] oddycha[ćc]|zawa[łl] serca|udar)\b", re.I), "medical_emergency"),
    (re.compile(r"\b(zemdla[łl]\w*|stracenie przytomno[śs]ci|wymiotuj[eę] krwi[ąa])\b", re.I), "medical_emergency"),
    # Eating disorders — EN
    (re.compile(r"\b(starv\w+ myself|purg\w+|made myself (throw up|vomit)|haven'?t eaten in (days|a week))\b", re.I), "eating_disorder"),
    # Eating disorders — PL
    (re.compile(r"\b(g[łl]oduj[eę] si[eę]|prowokuj[eę] wymioty|nic nie jad[łl]\w* od)\b", re.I), "eating_disorder"),
]


@dataclass(slots=True)
class SafetyResult:
    safe: bool
    category: SafetyCategory
    reason: str
    locale_message_key: str  # i18n key the frontend uses to render escalation copy


def _rule_check(text: str) -> SafetyResult | None:
    for pattern, category in _KEYWORD_RULES:
        if pattern.search(text):
            log.info("Safety rule matched: %s", category)
            return SafetyResult(
                safe=False,
                category=category,
                reason=f"matched rule for {category}",
                locale_message_key=f"safety.{category}",
            )
    return None


async def _moderation_check(client: AsyncOpenAI, text: str) -> SafetyResult | None:
    """Use OpenAI moderation as a backstop for things the rules missed."""
    settings = get_settings()
    try:
        resp = await client.moderations.create(model=settings.openai_moderation_model, input=text)
        result = resp.results[0]
    except Exception as exc:  # noqa: BLE001
        # If moderation fails, do NOT block the user — log and continue.
        log.warning("Moderation API failed: %s", exc)
        return None

    cats = result.categories
    # OpenAI moderation categories we treat as escalation-worthy
    if getattr(cats, "self_harm", False) or getattr(cats, "self-harm", False):
        return SafetyResult(
            safe=False,
            category="self_harm",
            reason="moderation: self_harm",
            locale_message_key="safety.self_harm",
        )
    if getattr(cats, "violence", False):
        return SafetyResult(
            safe=False,
            category="violence",
            reason="moderation: violence",
            locale_message_key="safety.violence",
        )
    return None


async def classify(client: AsyncOpenAI, text: str) -> SafetyResult:
    """Run both stages. Returns a SafetyResult; .safe=False means halt coaching."""
    if not text or not text.strip():
        return SafetyResult(safe=True, category="none", reason="empty", locale_message_key="")

    rule_hit = _rule_check(text)
    if rule_hit is not None:
        return rule_hit

    mod_hit = await _moderation_check(client, text)
    if mod_hit is not None:
        return mod_hit

    return SafetyResult(safe=True, category="none", reason="passed", locale_message_key="")


# Localized escalation copy. Frontend can also render its own; backend
# returns this so non-web clients get the message too.
ESCALATION_MESSAGES: dict[SafetyCategory, dict[str, str]] = {
    "self_harm": {
        "en": (
            "I'm really concerned about what you've shared. I'm not the right help for this, "
            "and I want to make sure you get to someone who is.\n\n"
            "**United States:** Call or text **988** (Suicide & Crisis Lifeline).\n"
            "**Poland:** Call **116 123** (Telefon Zaufania dla Dorosłych) or **116 111** for under 18.\n"
            "**EU-wide:** Call **112**.\n\n"
            "If you're in immediate danger, please call your local emergency number now."
        ),
        "pl": (
            "Bardzo martwi mnie to, co napisałeś. To nie jest sytuacja, w której mogę Ci właściwie "
            "pomóc — chcę, żebyś trafił do kogoś, kto potrafi.\n\n"
            "**Polska:** Zadzwoń pod **116 123** (Telefon Zaufania dla Dorosłych) lub **116 111** "
            "(dla osób poniżej 18 r.ż.).\n"
            "**Numer alarmowy:** **112**.\n\n"
            "Jeśli jesteś w bezpośrednim niebezpieczeństwie, zadzwoń teraz pod numer alarmowy."
        ),
    },
    "medical_emergency": {
        "en": (
            "What you're describing sounds like it needs medical attention right now, not a "
            "wellness conversation. **Please call your local emergency number** "
            "(911 in the US, 112 in the EU/UK) or get to an emergency room. "
            "I can't help with this — but a clinician can."
        ),
        "pl": (
            "To, co opisujesz, brzmi jak sytuacja wymagająca natychmiastowej pomocy medycznej, "
            "a nie rozmowy o wellness. **Zadzwoń pod numer alarmowy 112** lub natychmiast "
            "udaj się na SOR. Nie mogę Ci tu pomóc — ale lekarz może."
        ),
    },
    "eating_disorder": {
        "en": (
            "What you're describing sounds serious, and I'm not equipped to coach through it "
            "safely. Please reach out to a clinician.\n\n"
            "**United States:** National Alliance for Eating Disorders Helpline: **1-866-662-1235**.\n"
            "**Poland:** Ośrodek leczenia zaburzeń odżywiania — szukaj wsparcia u lekarza pierwszego kontaktu.\n\n"
            "I'll pause coaching here until you've spoken with someone qualified."
        ),
        "pl": (
            "To, co opisujesz, brzmi poważnie i nie potrafię bezpiecznie prowadzić takiego coachingu. "
            "Proszę, skontaktuj się ze specjalistą.\n\n"
            "**Polska:** Ośrodek leczenia zaburzeń odżywiania — zacznij od lekarza pierwszego kontaktu "
            "lub psychiatry.\n\n"
            "Wstrzymuję coaching do czasu, aż porozmawiasz z kimś wykwalifikowanym."
        ),
    },
    "violence": {
        "en": (
            "I can't help with this. If you or someone else is in danger, please call your "
            "local emergency number (911 in the US, 112 in the EU/UK)."
        ),
        "pl": (
            "Nie mogę z tym pomóc. Jeśli Ty lub ktoś inny jesteście w niebezpieczeństwie, "
            "zadzwoń pod numer alarmowy **112**."
        ),
    },
    "none": {"en": "", "pl": ""},
}


def escalation_text(category: SafetyCategory, locale: str) -> str:
    return ESCALATION_MESSAGES.get(category, {}).get(locale, ESCALATION_MESSAGES["self_harm"]["en"])

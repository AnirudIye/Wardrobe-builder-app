"""Daily style challenges: one shared prompt per calendar day.

Deterministic on the client-local date, so every user sees the same
challenge on the same day (the shared-reference property that makes it
comparable, like Wordle's single daily puzzle). No AI, no server state:
the list is curated here and cycles roughly monthly.
"""

from __future__ import annotations

from datetime import date
from typing import Dict

CHALLENGES = [
    {"name": "Monochrome day", "brief": "One colour family, head to toe."},
    {"name": "Texture play", "brief": "Combine two contrasting materials, like knit with leather."},
    {"name": "Oldest favourite", "brief": "Build around the oldest piece you still love."},
    {"name": "Borrowed formality", "brief": "Wear one piece a level dressier than the day needs."},
    {"name": "Third colour", "brief": "Add an accent colour you rarely reach for."},
    {"name": "Layer up", "brief": "Three visible layers, whatever the weather allows."},
    {"name": "Least worn", "brief": "Feature the piece you wear least. Give it a fair chance."},
    {"name": "Tonal neutrals", "brief": "Beige, cream, grey, brown: nothing loud today."},
    {"name": "Sharp shoulders", "brief": "Structure up top: a blazer, jacket or crisp shirt."},
    {"name": "Soft day", "brief": "Everything comfortable: knits, soft trousers, easy shoes."},
    {"name": "One pattern", "brief": "Exactly one patterned piece; keep the rest plain."},
    {"name": "Double denim", "brief": "Two denim pieces together. Own it."},
    {"name": "Tucked in", "brief": "Tuck your top in and mean it. Belt optional."},
    {"name": "Statement shoes", "brief": "Let the footwear lead. Build the outfit upward."},
    {"name": "High contrast", "brief": "Pair your lightest piece with your darkest."},
    {"name": "Weekend uniform", "brief": "Your most repeatable off-duty formula, perfected."},
    {"name": "Colour echo", "brief": "Repeat one colour in two places, like socks and top."},
    {"name": "Minimal five", "brief": "Five pieces or fewer, counting shoes and accessories."},
    {"name": "Outer layer hero", "brief": "The outerwear is the outfit. Keep everything under it quiet."},
    {"name": "Head to toe warm", "brief": "Warm tones only: rust, camel, olive, cream."},
    {"name": "Head to toe cool", "brief": "Cool tones only: navy, grey, ice blue, white."},
    {"name": "Smart casual split", "brief": "One formal half, one casual half. Blazer with sneakers counts."},
    {"name": "All black", "brief": "Black on black. Vary the textures so it reads rich, not flat."},
    {"name": "Something new", "brief": "Wear your newest piece and style it two ways in your head first."},
    {"name": "Vertical lines", "brief": "Stripes, plackets, creases: draw the eye up and down."},
    {"name": "Matching set energy", "brief": "Same colour top and bottom, set or improvised."},
    {"name": "One accessory more", "brief": "Whatever you planned, add exactly one accessory."},
    {"name": "Weather flex", "brief": "Dress perfectly for the forecast. Check it first."},
]


def challenge_for(day: date) -> Dict[str, str]:
    return CHALLENGES[day.toordinal() % len(CHALLENGES)]

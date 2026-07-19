from __future__ import annotations

from types import SimpleNamespace

from app.services.closet_score import closet_score


def g(category=None, formality=None, seasons=None):
    return SimpleNamespace(category=category, formality=formality, seasons=seasons or [])


def test_empty_closet_scores_zero():
    assert closet_score([]) == 0


def test_essential_categories_alone():
    # Two essential slots (16), no formality/seasons, depth 2/20 -> 1.
    assert closet_score([g(category="top"), g(category="bottom")]) == 17


def test_untagged_garments_count_toward_depth_only():
    assert closet_score([g(), g(), g(), g()]) == 2  # depth 4/20 * 10


def test_duplicate_categories_do_not_double_count():
    assert closet_score([g(category="top"), g(category="top")]) == 9  # 8 + depth 1


def test_full_coverage_hits_100():
    garments = [
        g("top", "casual", ["spring"]),
        g("bottom", "smart-casual", ["summer"]),
        g("footwear", "business", ["fall"]),
        g("outerwear", "formal", ["winter"]),
        g("dress", "athletic", ["summer"]),
    ]
    # Pad to 20 items for full depth.
    garments += [g("top", "casual", ["summer"]) for _ in range(15)]
    assert closet_score(garments) == 100


def test_case_insensitive_tags():
    assert closet_score([g("Top", "Casual", ["Summer"])]) == 8 + 6 + 5 + 0  # depth 1//2 = 0


def test_nonessential_category_scores_depth_only():
    assert closet_score([g(category="accessory"), g(category="accessory")]) == 1  # depth 2//2

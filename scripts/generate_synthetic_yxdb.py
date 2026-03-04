#!/usr/bin/env python3
"""Generate synthetic YXDB test data for Sigilweaver integration testing.

Requires sigilyx to be installed (available on PyPI). Run from the repo root:

    python scripts/generate_synthetic_yxdb.py

Produces 5 files in .untracked/data/ro/sigilweaver-synthetic-yxdb/:

  - titanic.yxdb       (891 rows, 12 cols - mixed int/float/string)
  - numeric_types.yxdb  (5000 rows, 5 cols - int16/32/64, float32/64)
  - mixed_types.yxdb    (1000 rows, 7 cols - id/string/float/int/bool)
  - string_heavy.yxdb   (500 rows, 6 cols - id + 5 string columns)
  - wide_50cols.yxdb    (100 rows, 51 cols - id + 50 float metrics)
"""

from __future__ import annotations

import random
import string
from pathlib import Path

# Resolve repo root relative to this script (scripts/ -> ..)
REPO_ROOT = Path(__file__).resolve().parent.parent

import polars as pl
import sigilyx as yx

OUTPUT_DIR = REPO_ROOT / ".untracked" / "data" / "ro" / "sigilweaver-synthetic-yxdb"
SEED = 42


def _rand_str(rng: random.Random, min_len: int = 3, max_len: int = 12) -> str:
    length = rng.randint(min_len, max_len)
    return "".join(rng.choices(string.ascii_letters, k=length))


def _rand_name(rng: random.Random) -> str:
    first_names = [
        "James",
        "Mary",
        "John",
        "Patricia",
        "Robert",
        "Jennifer",
        "Michael",
        "Linda",
        "William",
        "Elizabeth",
        "David",
        "Barbara",
        "Richard",
        "Susan",
        "Joseph",
        "Jessica",
        "Thomas",
        "Sarah",
        "Charles",
        "Karen",
        "Emma",
        "Liam",
        "Olivia",
        "Noah",
        "Ava",
    ]
    last_names = [
        "Smith",
        "Johnson",
        "Williams",
        "Brown",
        "Jones",
        "Garcia",
        "Miller",
        "Davis",
        "Rodriguez",
        "Martinez",
        "Hernandez",
        "Lopez",
        "Gonzalez",
        "Wilson",
        "Anderson",
        "Thomas",
        "Taylor",
        "Moore",
        "Jackson",
        "Martin",
        "Lee",
        "Perez",
        "Thompson",
        "White",
        "Harris",
    ]
    return f"{rng.choice(first_names)} {rng.choice(last_names)}"


def generate_titanic(rng: random.Random) -> pl.DataFrame:
    """891 rows, 12 columns - mimics Titanic dataset structure."""
    n = 891
    sexes = ["male", "female"]
    embarked = ["S", "C", "Q"]

    return pl.DataFrame(
        {
            "PassengerId": list(range(1, n + 1)),
            "Survived": [rng.randint(0, 1) for _ in range(n)],
            "Pclass": [rng.randint(1, 3) for _ in range(n)],
            "Name": [_rand_name(rng) for _ in range(n)],
            "Sex": [rng.choice(sexes) for _ in range(n)],
            "Age": [
                float(rng.randint(1, 80)) if rng.random() > 0.2 else None
                for _ in range(n)
            ],
            "SibSp": [rng.randint(0, 5) for _ in range(n)],
            "Parch": [rng.randint(0, 6) for _ in range(n)],
            "Ticket": [
                f"{rng.choice(['A/', 'PC ', 'STON/', ''])}{rng.randint(1000, 999999)}"
                for _ in range(n)
            ],
            "Fare": [round(rng.uniform(0, 512), 4) for _ in range(n)],
            "Cabin": [
                f"{rng.choice('ABCDEFG')}{rng.randint(1, 150)}"
                if rng.random() > 0.7
                else None
                for _ in range(n)
            ],
            "Embarked": [
                rng.choice(embarked) if rng.random() > 0.01 else None for _ in range(n)
            ],
        }
    )


def generate_numeric_types(rng: random.Random) -> pl.DataFrame:
    """5000 rows, 5 numeric columns covering Int16/32/64, Float32/64."""
    n = 5000
    return pl.DataFrame(
        {
            "int16_col": pl.Series(
                [rng.randint(-32768, 32767) for _ in range(n)], dtype=pl.Int16
            ),
            "int32_col": pl.Series(
                [rng.randint(-2_147_483_648, 2_147_483_647) for _ in range(n)],
                dtype=pl.Int32,
            ),
            "int64_col": pl.Series(
                [rng.randint(-(10**15), 10**15) for _ in range(n)], dtype=pl.Int64
            ),
            "float32_col": pl.Series(
                [rng.uniform(-1e6, 1e6) for _ in range(n)], dtype=pl.Float32
            ),
            "float64_col": pl.Series(
                [rng.uniform(-1e15, 1e15) for _ in range(n)], dtype=pl.Float64
            ),
        }
    )


def generate_mixed_types(rng: random.Random) -> pl.DataFrame:
    """1000 rows, 7 columns with mixed types including booleans."""
    n = 1000
    categories = ["Electronics", "Clothing", "Books", "Food", "Sports", "Home", "Toys"]

    return pl.DataFrame(
        {
            "id": list(range(1, n + 1)),
            "name": [f"Product {_rand_str(rng, 4, 10)}" for _ in range(n)],
            "category": [rng.choice(categories) for _ in range(n)],
            "price": [round(rng.uniform(0.99, 9999.99), 2) for _ in range(n)],
            "quantity": [rng.randint(0, 10000) for _ in range(n)],
            "in_stock": [rng.random() > 0.15 for _ in range(n)],
            "rating": [
                round(rng.uniform(1.0, 5.0), 1) if rng.random() > 0.05 else None
                for _ in range(n)
            ],
        }
    )


def generate_string_heavy(rng: random.Random) -> pl.DataFrame:
    """500 rows, 6 columns - heavy on variable-length strings."""
    n = 500
    domains = ["gmail.com", "yahoo.com", "outlook.com", "company.org", "example.net"]
    streets = [
        "Main St",
        "Oak Ave",
        "Pine Rd",
        "Elm Dr",
        "Maple Ln",
        "Cedar Blvd",
        "Birch Way",
    ]
    cities = [
        "Springfield",
        "Portland",
        "Franklin",
        "Clinton",
        "Madison",
        "Georgetown",
        "Bristol",
    ]

    first_names = [_rand_str(rng, 3, 8).capitalize() for _ in range(n)]
    last_names = [_rand_str(rng, 4, 12).capitalize() for _ in range(n)]

    return pl.DataFrame(
        {
            "id": list(range(1, n + 1)),
            "first_name": first_names,
            "last_name": last_names,
            "email": [
                f"{fn.lower()}.{ln.lower()}@{rng.choice(domains)}"
                for fn, ln in zip(first_names, last_names)
            ],
            "address": [
                f"{rng.randint(1, 9999)} {rng.choice(streets)}, {rng.choice(cities)}"
                for _ in range(n)
            ],
            "notes": [
                " ".join(_rand_str(rng, 2, 8) for _ in range(rng.randint(5, 30)))
                for _ in range(n)
            ],
        }
    )


def generate_wide_50cols(rng: random.Random) -> pl.DataFrame:
    """100 rows, 51 columns - wide dataset with 50 float metrics."""
    n = 100
    data: dict[str, list] = {"row_id": list(range(1, n + 1))}
    for i in range(50):
        data[f"metric_{i:02d}"] = [round(rng.gauss(0, 100), 6) for _ in range(n)]
    return pl.DataFrame(data)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)

    generators = {
        "titanic.yxdb": generate_titanic,
        "numeric_types.yxdb": generate_numeric_types,
        "mixed_types.yxdb": generate_mixed_types,
        "string_heavy.yxdb": generate_string_heavy,
        "wide_50cols.yxdb": generate_wide_50cols,
    }

    for filename, gen_fn in generators.items():
        path = OUTPUT_DIR / filename
        df = gen_fn(rng)
        yx.write_yxdb(str(path), df)
        print(f"  {filename}: {df.shape[0]} rows x {df.shape[1]} cols -> {path}")

    # Verify all files round-trip correctly
    print("\nVerification (read back):")
    for filename in generators:
        path = OUTPUT_DIR / filename
        df = yx.read_yxdb(str(path))
        print(f"  {filename}: {df.shape}")

    # Verify scan_yxdb (lazy) works too
    print("\nVerification (scan_yxdb):")
    for filename in generators:
        path = OUTPUT_DIR / filename
        lf = yx.scan_yxdb(str(path))
        df = lf.collect()
        print(f"  {filename}: {df.shape}")

    print("\nAll files generated and verified successfully.")


if __name__ == "__main__":
    main()

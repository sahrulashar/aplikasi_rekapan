import re
from dataclasses import dataclass
from typing import List, Optional


class ParseError(ValueError):
    pass


@dataclass
class ParsedItem:
    number: int
    value: int


@dataclass
class ParsedInput:
    raw_input: str
    numbers: List[int]
    multiplier: Optional[int]
    items: List[ParsedItem]


def normalize_input(text: str) -> str:
    if not text or not text.strip():
        raise ParseError("Input tidak boleh kosong.")

    value = text.strip().lower()
    value = re.sub(r"[^0-9x\s.,]", " ", value)
    value = value.replace(",", " ")
    value = value.replace(".", " ")
    value = re.sub(r"\s*x+\s*", "x", value)
    value = re.sub(r"\s+", " ", value).strip()

    return value


def validate_number(number: int) -> None:
    if not 0 <= number <= 99:
        raise ParseError(f"Angka {number} di luar rentang 00–99.")


def validate_value(value: int) -> None:
    if value < 1:
        raise ParseError("Nilai pengali harus minimal 1.")


def split_two_digits(number_str: str) -> List[str]:
    """
    Pecah angka panjang menjadi pasangan 2 digit.
    Contoh:
    1201 -> 12, 01
    123456 -> 12, 34, 56
    """
    if len(number_str) % 2 != 0:
        number_str = "0" + number_str

    return [
        number_str[i:i + 2]
        for i in range(0, len(number_str), 2)
    ]


def add_numbers_with_multiplier(
    items: List[ParsedItem],
    numbers: List[int],
    numbers_part: str,
    multiplier: int,
) -> None:
    validate_value(multiplier)

    number_list = []
    for chunk in numbers_part.split():
        number_list.extend(split_two_digits(chunk))

    for num_str in number_list:
        number = int(num_str)
        validate_number(number)
        items.append(ParsedItem(number=number, value=multiplier))
        numbers.append(number)


def parse_input(text: str) -> ParsedInput:
    raw = normalize_input(text)

    # Cocok untuk:
    # 71x6
    # 17x2
    # 67 76x15
    # 1201x5
    # 22 33 36 37x2 49 10 12  -> semua angka x2
    # 07x9 65x5 56 76 23 24 25 26x2 -> format campuran
    x_matches = list(re.finditer(r"x+(\d+)", raw))

    if not x_matches:
        raise ParseError(
            "Format tidak valid. Contoh: "
            "'71x6', '17x2', '67.76.x15', '1201x5', atau '22 33 36 37x2 49 10 12'."
        )

    items: List[ParsedItem] = []
    numbers: List[int] = []
    multipliers = set()

    # Kalau hanya ada satu xN, anggap xN itu berlaku untuk semua angka yang ada
    # di kiri maupun kanan. Ini penting untuk hasil OCR gambar bracket, karena
    # tulisan x2 sering terbaca di tengah baris: 22 33 36 37x2 49 10 12.
    if len(x_matches) == 1:
        multiplier = int(x_matches[0].group(1))
        multipliers.add(multiplier)
        numbers_part = re.sub(r"x+\d+", " ", raw)
        add_numbers_with_multiplier(items, numbers, numbers_part, multiplier)
    else:
        # Untuk format campuran, setiap xN berlaku pada angka tepat sebelumnya
        # sampai batas xN sebelumnya. Contoh: 07x9 65x5 56 76 23 24 25 26x2.
        start = 0
        for match in x_matches:
            numbers_part = raw[start:match.start()].strip()
            multiplier = int(match.group(1))
            if numbers_part:
                multipliers.add(multiplier)
                add_numbers_with_multiplier(items, numbers, numbers_part, multiplier)
            start = match.end()

    if not items:
        raise ParseError("Tidak ada angka valid yang bisa dibaca.")

    final_multiplier = next(iter(multipliers)) if len(multipliers) == 1 else None

    return ParsedInput(
        raw_input=raw,
        numbers=numbers,
        multiplier=final_multiplier,
        items=items,
    )

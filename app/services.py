from . import db
from .models import Cut, Entry, EntryNumber, SessionRecap, SessionManualEdit
from sqlalchemy import func
from .parser import ParsedInput
from datetime import datetime, time
from zoneinfo import ZoneInfo

def save_entry(parsed: ParsedInput, person_index: int | None = None, person_name: str | None = None) -> Entry:
    session_name, session_date = get_current_session()

    entry = Entry(
        raw_input=parsed.raw_input,
        multiplier=parsed.multiplier or 0,
        person_index=person_index,
        person_name=person_name,
    )
    db.session.add(entry)
    db.session.flush()

    for item in parsed.items:
        db.session.add(
            EntryNumber(
                entry_id=entry.id,
                number=item.number,
                value=item.value,
                remaining_value=item.value,
            )
        )

        if person_index:
            db.session.add(
                SessionRecap(
                    person_index=person_index,
                    person_name=person_name,
                    session_name=session_name,
                    session_date=session_date,
                    number=item.number,
                    value=item.value,
                )
            )

    db.session.commit()
    return entry


def _get_rows_for_number(number: int) -> list:
    return (
        EntryNumber.query
        .filter(EntryNumber.number == number)
        .order_by(EntryNumber.created_at.asc(), EntryNumber.id.asc())
        .all()
    )


def _get_active_global_cut() -> int:
    """
    Ambil hanya 1 potongan global terakhir.
    """
    last_cut = (
        Cut.query
        .filter(Cut.number == -1)
        .order_by(Cut.created_at.desc(), Cut.id.desc())
        .first()
    )
    return last_cut.cut_value if last_cut else 0


def apply_cut_all(cut_value: int, note: str = "") -> dict:
    """
    Simpan hanya 1 nilai potong global aktif.
    Jika input ulang 20, maka yang berlaku hanya 20.
    """
    if cut_value < 0:
        raise ValueError("Nilai potong tidak boleh negatif.")

    # hapus semua cut global lama
    Cut.query.filter(Cut.number == -1).delete()

    # simpan cut global baru
    db.session.add(
        Cut(
            number=-1,
            cut_value=cut_value,
            note=note or "GLOBAL CUT",
        )
    )
    db.session.commit()

    return {
        "message": f"Potong global berhasil diatur ke {cut_value}."
    }


def _person_label(entry: Entry | None) -> str:
    """Label nama untuk tooltip angka di grid."""
    if not entry:
        return "Tanpa nama"

    name = (entry.person_name or "").strip()
    if name:
        return name

    if entry.person_index:
        return f"Data {entry.person_index}"

    return "Tanpa nama"


def get_number_summary(number: int) -> dict:
    rows = _get_rows_for_number(number)

    value_details = [
        {
            "value": row.value,
            "person_index": row.entry.person_index if row.entry else None,
            "person_name": _person_label(row.entry),
        }
        for row in rows
    ]
    value_list = [row["value"] for row in value_details]
    total_in = sum(value_list)
    total_cut = _get_active_global_cut()
    total_remaining = total_in - total_cut

    return {
        "number": f"{number:02d}",
        "value_list": value_list,
        "value_details": value_details,
        "total_in": total_in,
        "total_cut": total_cut,
        "remaining": total_remaining,
    }


def get_grid_data() -> list:
    grid = []
    active_cut = _get_active_global_cut()

    totals_by_number = {n: 0 for n in range(100)}
    values_by_number = {n: [] for n in range(100)}
    value_details_by_number = {n: [] for n in range(100)}

    rows = (
        EntryNumber.query
        .join(Entry, Entry.id == EntryNumber.entry_id)
        .order_by(EntryNumber.number.asc(), EntryNumber.created_at.asc(), EntryNumber.id.asc())
        .all()
    )

    for row in rows:
        if 0 <= row.number <= 99:
            person_name = _person_label(row.entry)
            totals_by_number[row.number] += row.value
            values_by_number[row.number].append(row.value)
            value_details_by_number[row.number].append({
                "value": row.value,
                "person_index": row.entry.person_index if row.entry else None,
                "person_name": person_name,
            })

    for number in range(100):
        total_in = totals_by_number[number]
        total_remaining = total_in - active_cut

        grid.append({
            "number": f"{number:02d}",
            "value_list": values_by_number[number],
            "value_details": value_details_by_number[number],
            "total_in": total_in,
            "total_cut": active_cut,
            "remaining": total_remaining,
            "has_data": len(values_by_number[number]) > 0,
        })

    return grid


def get_dashboard_summary() -> dict:
    total_in = sum(row.value for row in EntryNumber.query.all())
    active_cut = _get_active_global_cut()

    # potong aktif berlaku untuk semua angka 00-99
    total_cut = active_cut * 100
    total_remaining = total_in - total_cut
    transaction_count = Entry.query.count()

    active_numbers = 0
    grid = get_grid_data()
    for item in grid:
        if item["remaining"] != 0:
            active_numbers += 1

    return {
        "total_in": total_in,
        "total_cut": total_cut,
        "total_remaining": total_remaining,
        "transaction_count": transaction_count,
        "active_numbers": active_numbers,
    }



def get_people_summary() -> list:
    """
    Rekap nilai per orang. Nilai tidak dibagi rata.
    Semua nilai dari satu input masuk penuh ke orang yang dipilih.
    """
    totals = {i: 0 for i in range(1, 7)}

    rows = (
        db.session.query(Entry.person_index, func.coalesce(func.sum(EntryNumber.value), 0))
        .join(EntryNumber, EntryNumber.entry_id == Entry.id)
        .filter(Entry.person_index.isnot(None))
        .group_by(Entry.person_index)
        .all()
    )

    for index, total in rows:
        if index in totals:
            totals[index] = int(total or 0)

    return [
        {"person_index": index, "total": totals[index]}
        for index in range(1, 7)
    ]

def get_recent_entries(limit: int = None) -> list:
    query = (
        Entry.query
        .order_by(Entry.created_at.desc(), Entry.id.desc())
    )

    if limit:
        query = query.limit(limit)

    entries = query.all()

    results = []
    for entry in entries:
        numbers = (
            EntryNumber.query
            .filter(EntryNumber.entry_id == entry.id)
            .order_by(EntryNumber.id.asc())
            .all()
        )

        results.append({
            "id": entry.id,
            "raw_input": entry.raw_input,
            "multiplier": entry.multiplier,
            "created_at": entry.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "person_index": entry.person_index,
            "person_name": entry.person_name,
            "items": [
                {
                    "number": item.number,
                    "value": item.value,
                }
                for item in numbers
            ],
        })

    return results


def get_recent_cuts(limit: int = 20) -> list:
    """
    Riwayat potong dihapus dari tampilan/logika.
    """
    return []


def delete_entry(entry_id: int) -> None:
    entry = Entry.query.get_or_404(entry_id)
    EntryNumber.query.filter_by(entry_id=entry.id).delete()
    db.session.delete(entry)
    db.session.commit()

def delete_all_entries() -> None:
    EntryNumber.query.delete()
    Entry.query.delete()
    Cut.query.delete()
    db.session.commit()

APP_TZ = ZoneInfo("Asia/Makassar")

def get_current_session():
    now = datetime.now(APP_TZ)
    jam = now.time()

    if time(10, 0) <= jam <= time(15, 0):
        session_name = "SDY"
        session_date = now.date()
    elif time(15, 30) <= jam <= time(19, 0):
        session_name = "SGP"
        session_date = now.date()
    elif jam >= time(20, 0):
        session_name = "HKG"
        session_date = now.date()
    elif jam <= time(0, 30):
        session_name = "HKG"
        session_date = now.date()
    else:
        session_name = "DI LUAR SESI"
        session_date = now.date()

    return session_name, session_date
def format_tanggal_indonesia(date_obj) -> str:
    hari = {
        0: "Senin",
        1: "Selasa",
        2: "Rabu",
        3: "Kamis",
        4: "Jumat",
        5: "Sabtu",
        6: "Minggu",
    }

    bulan = {
        1: "Januari",
        2: "Februari",
        3: "Maret",
        4: "April",
        5: "Mei",
        6: "Juni",
        7: "Juli",
        8: "Agustus",
        9: "September",
        10: "Oktober",
        11: "November",
        12: "Desember",
    }

    return f"{hari[date_obj.weekday()]}, {date_obj.day:02d} {bulan[date_obj.month]} {date_obj.year}"


def get_person_session_recaps(person_index: int, bonus_map: dict | None = None) -> list:
    bonus_map = bonus_map or {}

    rows = (
        db.session.query(
            SessionRecap.session_date,
            SessionRecap.session_name,
            func.coalesce(func.sum(SessionRecap.value), 0)
        )
        .filter(SessionRecap.person_index == person_index)
        .group_by(SessionRecap.session_date, SessionRecap.session_name)
        .order_by(SessionRecap.session_date.desc(), SessionRecap.session_name.asc())
        .all()
    )

    return [
        {
            "date": row[0].strftime("%Y-%m-%d"),
            "date_label": format_tanggal_indonesia(row[0]),
            "session": row[1],
            "total": int(row[2] or 0),
            "total_rp": int(row[2] or 0) * 750,
            "bonus_rp": int(bonus_map.get(row[1], 0)),
            "total_akhir": int(bonus_map.get(row[1], 0)) - (int(row[2] or 0) * 750),
        }
        for row in rows
    ]

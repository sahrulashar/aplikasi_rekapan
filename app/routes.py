from datetime import datetime
from flask import Blueprint, jsonify, render_template, request, redirect, url_for
from .parser import ParseError, parse_input
from .services import (
    apply_cut_all,
    delete_all_entries,
    delete_entry,
    get_dashboard_summary,
    get_grid_data,
    get_people_summary,
    get_recent_cuts,
    get_recent_entries,
    save_entry,
    upsert_session_manual_edit,
    delete_session_manual_edit,
)
from .services import get_person_session_recaps

PERSON_NAMES = {
    1: "Suhadi Cua",
    2: "Salmon",
    3: "Alimin Bas",
    4: "Afiq",
    5: "Bur",
    6: "Nure",
}


main_bp = Blueprint('main', __name__)


def _page_context(active_page='dashboard'):
    return {
        'active_page': active_page,
        'grid_data': get_grid_data(),
        'dashboard': get_dashboard_summary(),
        'entries': get_recent_entries(),
        'cuts': get_recent_cuts(),
        'people_summary': get_people_summary(),
    }


@main_bp.get('/')
def index():
    return render_template('index.html', **_page_context('dashboard'))


@main_bp.get('/rekapan')
def rekapan():
    return render_template('index.html', **_page_context('rekapan'))


@main_bp.get('/rekapan-nama')
def rekapan_nama():
    return render_template('index.html', **_page_context('rekapan_nama'))


@main_bp.get('/riwayat')
def riwayat():
    return render_template('index.html', **_page_context('riwayat'))


@main_bp.post('/parse')
def parse_and_save():
    payload = request.get_json(silent=True) or request.form
    raw_input = payload.get('raw_input')
    person_index_raw = payload.get('person_index')
    person_name = (payload.get('person_name') or '').strip()
    try:
        person_index = int(person_index_raw) if person_index_raw else None
        if person_index is not None and person_index not in range(1, 7):
            raise ParseError('Pilih nama orang yang valid.')
        parsed = parse_input(raw_input)
        save_entry(parsed, person_index=person_index, person_name=person_name)
    except ParseError as exc:
        return jsonify({'ok': False, 'message': str(exc)}), 400

    return jsonify({
        'ok': True,
        'message': 'Data berhasil disimpan.',
        'parsed': {
            'numbers': [f'{n:02d}' for n in parsed.numbers],
            'multiplier': parsed.multiplier,
            'raw_input': parsed.raw_input,
        },
        'dashboard': get_dashboard_summary(),
        'grid': get_grid_data(),
        'entries': get_recent_entries(),
        'cuts': get_recent_cuts(),
        'people_summary': get_people_summary(),
    })


@main_bp.post('/api/cut')
def cut_number():
    payload = request.get_json(silent=True) or request.form
    try:
        number = int(payload.get('number', ''))
        cut_value = int(payload.get('cut_value', ''))
        note = payload.get('note', '')
        summary = apply_cut(number, cut_value, note)
    except ValueError as exc:
        return jsonify({'ok': False, 'message': str(exc)}), 400

    return jsonify({
        'ok': True,
        'message': f'Angka {number:02d} berhasil dipotong {cut_value}.',
        'number_summary': summary,
        'dashboard': get_dashboard_summary(),
        'grid': get_grid_data(),
        'entries': get_recent_entries(),
        'cuts': get_recent_cuts(),
        'people_summary': get_people_summary(),
    })


@main_bp.get('/api/grid')
def api_grid():
    return jsonify({'ok': True, 'grid': get_grid_data(), 'dashboard': get_dashboard_summary()})


@main_bp.get('/api/summary')
def api_summary():
    return jsonify({
        'ok': True,
        'dashboard': get_dashboard_summary(),
        'entries': get_recent_entries(),
        'cuts': get_recent_cuts(),
        'people_summary': get_people_summary(),
    })


@main_bp.delete('/api/entries/<int:entry_id>')
def api_delete_entry(entry_id: int):
    delete_entry(entry_id)
    return jsonify({
        'ok': True,
        'message': 'Entry berhasil dihapus.',
        'dashboard': get_dashboard_summary(),
        'grid': get_grid_data(),
        'entries': get_recent_entries(),
        'cuts': get_recent_cuts(),
        'people_summary': get_people_summary(),
    })

@main_bp.post('/api/cut-all')
def cut_all():
    payload = request.get_json(silent=True) or request.form

    try:
        cut_value = int(payload.get('cut_value', ''))
        note = payload.get('note', '').strip()
        result = apply_cut_all(cut_value, note)
    except ValueError as exc:
        return jsonify({'ok': False, 'message': str(exc)}), 400

    return jsonify({
        'ok': True,
        'message': result['message'],
        'dashboard': get_dashboard_summary(),
        'grid': get_grid_data(),
        'entries': get_recent_entries(),
        'cuts': get_recent_cuts(),
        'people_summary': get_people_summary(),
    })

@main_bp.delete('/api/entries')
def api_delete_all_entries():
    delete_all_entries()
    return jsonify({
        'ok': True,
        'message': 'Semua riwayat berhasil dihapus.',
        'dashboard': get_dashboard_summary(),
        'grid': get_grid_data(),
        'entries': get_recent_entries(),
        'cuts': get_recent_cuts(),
        'people_summary': get_people_summary(),
    })


@main_bp.route('/api/session-manual', methods=['POST', 'DELETE'])
def api_session_manual():
    payload = request.get_json(silent=True) or request.form

    try:
        person_index = int(payload.get('person_index', ''))
        session_date = datetime.strptime(payload.get('date', ''), '%Y-%m-%d').date()
        session_name = (payload.get('session') or '').upper().strip()

        if request.method == 'POST':
            total = int(payload.get('total', 0) or 0)
            upsert_session_manual_edit(person_index, session_date, session_name, total)
            message = 'Rekap sesi berhasil diperbarui.'
        else:
            delete_session_manual_edit(person_index, session_date, session_name)
            message = 'Edit manual sesi berhasil dihapus.'
    except (TypeError, ValueError) as exc:
        return jsonify({'ok': False, 'message': str(exc) or 'Data sesi tidak valid.'}), 400

    return jsonify({'ok': True, 'message': message})


@main_bp.route('/data/<int:person_index>')
def person_page(person_index):
    if person_index < 1 or person_index > 6:
        return redirect(url_for('main.index'))

    recaps = get_person_session_recaps(person_index)

    person_name = request.args.get("name") or PERSON_NAMES.get(person_index, f"Data {person_index}")

    return render_template(
        'person_page.html',
        person_index=person_index,
        person_name=person_name,
        recaps=recaps
    )

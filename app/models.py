from datetime import datetime
from . import db


class Entry(db.Model):
    __tablename__ = 'entries'

    id = db.Column(db.Integer, primary_key=True)
    raw_input = db.Column(db.String(255), nullable=False)
    multiplier = db.Column(db.Integer, nullable=False)
    person_index = db.Column(db.Integer, nullable=True)
    person_name = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    numbers = db.relationship(
        'EntryNumber',
        backref='entry',
        lazy=True,
        cascade='all, delete-orphan'
    )


class EntryNumber(db.Model):
    __tablename__ = 'entry_numbers'

    id = db.Column(db.Integer, primary_key=True)
    entry_id = db.Column(db.Integer, db.ForeignKey('entries.id'), nullable=False)
    number = db.Column(db.Integer, nullable=False, index=True)
    value = db.Column(db.Integer, nullable=False)
    remaining_value = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Cut(db.Model):
    __tablename__ = 'cuts'

    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.Integer, nullable=False, index=True)
    cut_value = db.Column(db.Integer, nullable=False)
    note = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

class SessionRecap(db.Model):
    __tablename__ = 'session_recaps'

    id = db.Column(db.Integer, primary_key=True)
    person_index = db.Column(db.Integer, nullable=False, index=True)
    person_name = db.Column(db.String(100), nullable=True)
    session_name = db.Column(db.String(20), nullable=False, index=True)
    session_date = db.Column(db.Date, nullable=False, index=True)
    number = db.Column(db.Integer, nullable=False, index=True)
    value = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

class SessionManualEdit(db.Model):
    __tablename__ = 'session_manual_edits'

    id = db.Column(db.Integer, primary_key=True)
    person_index = db.Column(db.Integer, nullable=False, index=True)
    session_date = db.Column(db.Date, nullable=False, index=True)
    session_name = db.Column(db.String(20), nullable=False, index=True)
    total = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
from pathlib import Path
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app() -> Flask:
    project_root = Path(__file__).resolve().parent.parent

    app = Flask(
        __name__,
        instance_relative_config=True,
        template_folder=str(project_root / 'templates'),
        static_folder=str(project_root / 'static'),
    )
    app.config.from_object(Config)

    db.init_app(app)

    from .routes import main_bp
    app.register_blueprint(main_bp)

    with app.app_context():
        from . import models
        db.create_all()

    return app
from app import create_app
from flask import session, redirect, url_for, request, render_template
from werkzeug.security import check_password_hash
import os

app = create_app()

app.secret_key = os.getenv(
    "SECRET_KEY",
    "ganti-dengan-secret-key-yang-panjang-dan-random"
)

USER = {
    "username": "afiq",
    "password_hash": "scrypt:32768:8:1$LBJRTpDzjz5VnRwj$3799bd86870ac8603778e1407cb519133c34715316c5fb64c7872aad6baf0babe46fa412bc80a92f299d0a1c0ce1b368bdcc9bc7a9eafc4cda9aa91681929ecf"
}


@app.before_request
def require_login():
    allowed_routes = ['login', 'static']

    if request.endpoint in allowed_routes:
        return

    if 'user' not in session:
        return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if (
            username == USER["username"]
            and check_password_hash(USER["password_hash"], password)
        ):
            session['user'] = username
            return redirect(url_for('main.index'))

        return render_template(
            'login.html',
            error="Username atau password salah"
        )

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))


if __name__ == '__main__':
    app.run(debug=True)
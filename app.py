from app import create_app
from flask import session, redirect, url_for, request, render_template

app = create_app()
app.secret_key = "secret-key-kamu"

USER = {
    "username": "afiq",
    "password": "Aqswde12@"
}

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if username == USER["username"] and password == USER["password"]:
            session['user'] = username
            return redirect(url_for('main.index'))

        return render_template('login.html', error="Username atau password salah")

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))


if __name__ == '__main__':
    app.run(debug=True)
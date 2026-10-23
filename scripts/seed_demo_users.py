import sqlite3, secrets, hashlib, time

conn = sqlite3.connect('backend/app/data/users.db')
cursor = conn.cursor()

cursor.execute("UPDATE users SET role = 'authority' WHERE email = 'aswinvenkat28@gmail.com'")
print('Updated aswinvenkat28@gmail.com to authority:', cursor.rowcount)

def add_user(email, password, full_name, role):
    cursor.execute('SELECT 1 FROM users WHERE email = ?', (email,))
    if cursor.fetchone():
        cursor.execute("UPDATE users SET role = ? WHERE email = ?", (role, email))
        print(f"User {email} already exists, role updated to {role}")
        return
    user_id = secrets.token_urlsafe(16)
    salt = secrets.token_bytes(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 600_000)
    now = time.time()
    cursor.execute(
        "INSERT INTO users (id, email, full_name, role, password_salt, password_hash, created_at, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?, 'password')",
        (user_id, email, full_name, role, salt, pw_hash, now)
    )
    print(f"Added {email} with role {role}")

add_user('authority.demo@example.com', 'AuthPass123', 'Demo Authority Officer', 'authority')
add_user('uitest1@example.com', 'TestPass123', 'UI Test User', 'citizen')
add_user('elev.ui@x.com', 'StrongPass123', 'Elevate UI Test', 'authority')
add_user('t5b@x.com', 'StrongPass123', 'T Five B', 'authority')

conn.commit()
conn.close()

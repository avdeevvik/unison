import psycopg2

# Параметры подключения к БД
DB_CONFIG = {
    'host': 'db',
    'port': 5432,
    'database': 'unison',
    'user': 'unison',
    'password': 'unison'
}


def get_connection():
    return psycopg2.connect(**DB_CONFIG)


def print_header(text):
    print("\n" + "=" * 60)
    print(text)
    print("=" * 60)


# ========== CRUD ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ==========

def show_users():
    """SELECT - показать всех пользователей"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, email FROM auth_user;")
    users = cur.fetchall()
    cur.close()
    conn.close()
    
    print_header("СПИСОК ПОЛЬЗОВАТЕЛЕЙ")
    for u in users:
        print(f"ID: {u[0]} | {u[1]} | {u[2]}")


def add_user():
    """INSERT - добавить пользователя"""
    username = input("Логин: ")
    email = input("Email: ")
    password = input("Пароль: ")
    
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO auth_user (
                username, email, password, 
                is_superuser, is_staff, is_active, date_joined
            ) VALUES (%s, %s, %s, false, false, true, NOW()) 
            RETURNING id;
        """, (username, email, password))
        user_id = cur.fetchone()[0]
        conn.commit()
        print(f"Пользователь создан. ID: {user_id}")
    except Exception as e:
        conn.rollback()
        print(f"Ошибка: {e}")
    finally:
        cur.close()
        conn.close()


def update_user():
    """UPDATE - обновить пользователя"""
    user_id = input("ID пользователя: ")
    new_username = input("Новый логин: ")
    new_email = input("Новый email: ")
    
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE auth_user SET username = %s, email = %s WHERE id = %s;",
            (new_username, new_email, user_id)
        )
        conn.commit()
        print(f"Обновлено строк: {cur.rowcount}")
    except Exception as e:
        conn.rollback()
        print(f"Ошибка: {e}")
    finally:
        cur.close()
        conn.close()


def delete_user():
    """DELETE - удалить пользователя"""
    user_id = input("ID пользователя: ")
    
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM music_track WHERE user_id = %s;", (user_id,))
        songs_count = cur.fetchone()[0]
        
        confirm = input(f"Будут удалены {songs_count} треков. Удалить? (да/нет): ")
        if confirm == "да":
            cur.execute("DELETE FROM auth_user WHERE id = %s;", (user_id,))
            conn.commit()
            print(f"Удалено строк: {cur.rowcount}")
    except Exception as e:
        conn.rollback()
        print(f"Ошибка: {e}")
    finally:
        cur.close()
        conn.close()


# ========== JOIN ЗАПРОСЫ ==========

def inner_join():
    """INNER JOIN - песни + пользователи"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT t.title, u.username 
        FROM music_track t
        INNER JOIN auth_user u ON t.user_id = u.id
        LIMIT 15;
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    
    print_header("INNER JOIN: песни и их владельцы")
    for r in results:
        print(f"{r[0]} | {r[1]}")


def left_join():
    """LEFT JOIN - все песни (даже если пользователь удалён)"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT t.title, u.username 
        FROM music_track t
        LEFT JOIN auth_user u ON t.user_id = u.id
        LIMIT 15;
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    
    print_header("LEFT JOIN: все песни (даже без владельца)")
    for r in results:
        owner = r[1] if r[1] else "(пользователь удалён)"
        print(f"{r[0]} | {owner}")


def join_favorites():
    """JOIN трёх таблиц: избранное + пользователи + песни"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.username, t.title 
        FROM music_favorite f
        JOIN auth_user u ON f.user_id = u.id
        JOIN music_track t ON f.track_id = t.id
        LIMIT 20;
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    
    print_header("Избранное: пользователи и их любимые песни")
    for r in results:
        print(f"{r[0]} -> {r[1]}")


# ========== ПОДЗАПРОСЫ ==========

def subquery_users_with_favorites():
    """Подзапрос: пользователи у которых больше 2 избранных песен"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.username, (
            SELECT COUNT(*) 
            FROM music_favorite f 
            WHERE f.user_id = u.id
        ) as fav_count
        FROM auth_user u
        WHERE (
            SELECT COUNT(*) 
            FROM music_favorite f 
            WHERE f.user_id = u.id
        ) > 2;
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    
    print_header("Пользователи с >2 избранными (подзапрос)")
    for r in results:
        print(f"{r[0]} | избранных: {r[1]}")


def subquery_tracks_in_playlists():
    """Подзапрос EXISTS: песни, которые есть в плейлистах"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT t.title
        FROM music_track t
        WHERE EXISTS (
            SELECT 1 
            FROM music_playlisttrack pt 
            WHERE pt.track_id = t.id
        )
        LIMIT 15;
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    
    print_header("Песни, которые есть в плейлистах (подзапрос EXISTS)")
    for r in results:
        print(f"{r[0]}")


# ========== ФУНКЦИИ (АГРЕГАЦИЯ) ==========

def function_top_users():
    """Топ-3 пользователя по количеству песен"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.username, COUNT(t.id) as songs_count
        FROM auth_user u
        LEFT JOIN music_track t ON u.id = t.user_id
        GROUP BY u.id
        ORDER BY songs_count DESC
        LIMIT 3;
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    
    print_header("Топ-3 пользователя по количеству песен")
    for r in results:
        print(f"{r[0]} | песен: {r[1]}")


def function_recent_favorites():
    """Фильтр по дате: избранное за последние 7 дней"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.username, t.title, f.created_at
        FROM music_favorite f
        JOIN auth_user u ON f.user_id = u.id
        JOIN music_track t ON f.track_id = t.id
        WHERE f.created_at > NOW() - INTERVAL '7 days'
        ORDER BY f.created_at DESC;
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    
    print_header("Избранное за последние 7 дней")
    for r in results:
        print(f"{r[0]} -> {r[1]} ({r[2]})")


def function_missing_covers():
    """Проверка NULL: песни без обложек"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT title
        FROM music_track
        WHERE cover IS NULL OR cover = '';
    """)
    results = cur.fetchall()
    cur.close()
    conn.close()
    
    print_header("Песни без обложек")
    for r in results:
        print(f"{r[0]}")


# ========== ГЛАВНОЕ МЕНЮ ==========

def menu():
    while True:
        print("\n" + "=" * 60)
        print("УНИСОН - УПРАВЛЕНИЕ БАЗОЙ ДАННЫХ")
        print("=" * 60)
        print("\n1. SELECT - показать пользователей")
        print("2. INSERT - добавить пользователя")
        print("3. UPDATE - обновить пользователя")
        print("4. DELETE - удалить пользователя")
        print("\n5. INNER JOIN (песни + владельцы)")
        print("6. LEFT JOIN (все песни)")
        print("7. JOIN (избранное + пользователи + песни)")
        print("\n8. Подзапрос (пользователи с >2 избранными)")
        print("9. Подзапрос EXISTS (песни в плейлистах)")
        print("\n10. Топ-3 пользователя по песням (COUNT + GROUP BY)")
        print("11. Избранное за 7 дней (фильтр по дате)")
        print("12. Песни без обложки (NULL)")
        print("\n0. Выход")

        choice = input("\nВаш выбор: ")

        if choice == "1": show_users()
        elif choice == "2": add_user()
        elif choice == "3": update_user()
        elif choice == "4": delete_user()
        elif choice == "5": inner_join()
        elif choice == "6": left_join()
        elif choice == "7": join_favorites()
        elif choice == "8": subquery_users_with_favorites()
        elif choice == "9": subquery_tracks_in_playlists()
        elif choice == "10": function_top_users()
        elif choice == "11": function_recent_favorites()
        elif choice == "12": function_missing_covers()
        elif choice == "0": 
            print("До свидания!")
            break
        else:
            print("Неверный выбор")


if __name__ == "__main__":
    menu()
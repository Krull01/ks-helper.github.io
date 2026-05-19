document.addEventListener('DOMContentLoaded', () => {
    // Инициализация Firebase (если ещё не инициализирована)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();

    // === ЛОГИКА АВТОРИЗАЦИИ ===
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');
    const authError = document.getElementById('auth-error');
    const btnLogin = document.getElementById('btn-login');
    const logoutBtn = document.getElementById('logout-btn');
    const authOnlyElements = document.querySelectorAll('.auth-only');

    // Слушатель состояния авторизации
    auth.onAuthStateChanged(user => {
        if (user) {
            // Пользователь вошел
            if (loginScreen) loginScreen.style.display = 'none';
            authOnlyElements.forEach(el => {
                // Если это навигация или кнопка выхода, используем flex/inline-block, иначе block
                if (el.classList.contains('main-nav')) el.style.display = 'flex';
                else if (el.classList.contains('logout-btn')) el.style.display = 'inline-block';
                else el.style.display = 'block';
            });
            console.log("Auth: User logged in", user.email);
        } else {
            // Пользователь не вошел
            if (loginScreen) loginScreen.style.display = 'flex';
            authOnlyElements.forEach(el => el.style.display = 'none');
            console.log("Auth: No user");
        }
    });

    // Обработка формы
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.textContent = '...';
            }
            if (authError) authError.textContent = '';

            try {
                await auth.signInWithEmailAndPassword(email, password);
            } catch (error) {
                console.error("Auth error:", error);
                let msg = error.message;
                const currentLang = window.currentLang || 'ru';
                if (error.code === 'auth/wrong-password') msg = currentLang === 'ru' ? 'Неверный пароль' : 'Невірний пароль';
                if (error.code === 'auth/user-not-found') msg = currentLang === 'ru' ? 'Пользователь не найден' : 'Користувач не знайдений';
                if (authError) authError.textContent = msg;
            } finally {
                if (btnLogin) {
                    btnLogin.disabled = false;
                    const currentLang = window.currentLang || 'ru';
                    btnLogin.textContent = currentLang === 'ru' ? 'Войти' : 'Увійти';
                }
            }
        };
    }

    // Выход
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            const currentLang = window.currentLang || 'ru';
            if (confirm(currentLang === 'ru' ? 'Выйти из системы?' : 'Вийти з системи?')) {
                auth.signOut();
            }
        };
    }
});

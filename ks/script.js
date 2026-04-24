document.addEventListener('DOMContentLoaded', () => {
    // Навигация по основному меню
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Убираем active со всех кнопок
            navItems.forEach(nav => nav.classList.remove('active'));
            // Добавляем active нажатой кнопке
            item.classList.add('active');

            // Скрываем все секции
            sections.forEach(section => section.classList.remove('active'));

            // Показываем нужную секцию
            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });

    // Навигация по табам в разделе "Тарифы"
    const tabItems = document.querySelectorAll('.tab-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabItems.forEach(item => {
        item.addEventListener('click', () => {
            tabItems.forEach(tab => tab.classList.remove('active'));
            item.classList.add('active');

            tabPanes.forEach(pane => pane.classList.remove('active'));

            const tabId = item.getAttribute('data-tab');
            const targetTab = document.getElementById(tabId);
            if (targetTab) {
                targetTab.classList.add('active');
            }
        });
    });

    // Навигация по под-табам (Все разом / Просто ДИ)
    const subTabItems = document.querySelectorAll('.sub-tab-item');
    const subTabPanes = document.querySelectorAll('.sub-tab-pane');

    subTabItems.forEach(item => {
        item.addEventListener('click', () => {
            subTabItems.forEach(tab => tab.classList.remove('active'));
            item.classList.add('active');

            subTabPanes.forEach(pane => pane.classList.remove('active'));

            const subTabId = item.getAttribute('data-subtab');
            const targetSubTab = document.getElementById(subTabId);
            if (targetSubTab) {
                targetSubTab.classList.add('active');
            }
        });
    });

    // Theme Switch
    const themeBtns = document.querySelectorAll('.theme-btn');
    const toggleTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        themeBtns.forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.theme-btn[data-theme="${theme}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        localStorage.setItem('ks-helper-theme', theme);
    };

    const savedTheme = localStorage.getItem('ks-helper-theme') || 'light';
    toggleTheme(savedTheme);

    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleTheme(btn.getAttribute('data-theme'));
        });
    });


    // === ЛОГИКА ПОИСКА ДОМОВ (FIREBASE SYNC) ===
    const firebaseConfig = {
        apiKey: "AIzaSyBxzNA2Rln4BQ-AJwMi6kWvm_8dNgXu9vc",
        authDomain: "ks-helper-e24f3.firebaseapp.com",
        projectId: "ks-helper-e24f3",
        storageBucket: "ks-helper-e24f3.firebasestorage.app",
        messagingSenderId: "850409282314",
        appId: "1:850409282314:web:34399de47dc59be962f8f3",
        measurementId: "G-6BQ9FW5RR1"
    };

    // Инициализация Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const storage = firebase.storage();
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
            loginScreen.style.display = 'none';
            authOnlyElements.forEach(el => {
                // Если это навигация или кнопка выхода, используем flex/inline-block, иначе block
                if (el.classList.contains('main-nav')) el.style.display = 'flex';
                else if (el.classList.contains('logout-btn')) el.style.display = 'inline-block';
                else el.style.display = 'block';
            });
            console.log("Auth: User logged in", user.email);
        } else {
            // Пользователь не вошел
            loginScreen.style.display = 'flex';
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
            
            btnLogin.disabled = true;
            btnLogin.textContent = '...';
            authError.textContent = '';

            try {
                await auth.signInWithEmailAndPassword(email, password);
            } catch (error) {
                console.error("Auth error:", error);
                let msg = error.message;
                if (error.code === 'auth/wrong-password') msg = currentLang === 'ru' ? 'Неверный пароль' : 'Невірний пароль';
                if (error.code === 'auth/user-not-found') msg = currentLang === 'ru' ? 'Пользователь не найден' : 'Користувач не знайдений';
                authError.textContent = msg;
            } finally {
                btnLogin.disabled = false;
                btnLogin.textContent = currentLang === 'ru' ? 'Войти' : 'Увійти';
            }
        };
    }

    // Выход
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            if (confirm(currentLang === 'ru' ? 'Выйти из системы?' : 'Вийти з системи?')) {
                auth.signOut();
            }
        };
    }

    let housesData = [];
    let isDataLoading = false;
    let hasAttemptedLoading = false;
    const houseSearchInput = document.getElementById('house-search-input');
    const houseSearchBtn = document.getElementById('house-search-btn');
    const houseResults = document.getElementById('houses-results');

    // --- Хелперы для облака ---
    async function uploadFiles(files) {
        const urls = [];
        for (let file of files) {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const storageRef = storage.ref(`house_photos/${fileName}`);
            await storageRef.put(file);
            const url = await storageRef.getDownloadURL();
            urls.push(url);
        }
        return urls;
    }

    async function loadCloudComments(houseId, container) {
        container.innerHTML = '<div class="loading-spinner" style="text-align:center; padding: 10px; color: var(--text-muted);">...</div>';
        try {
            // Убираем orderBy из запроса, чтобы не требовать создания индекса в Firebase консоли
            const snapshot = await db.collection('comments')
                .where('houseId', '==', houseId)
                .get();
            
            let comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Сортируем вручную по времени (новые сверху)
            comments.sort((a, b) => {
                const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
                const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
                return timeB - timeA;
            });

            container.innerHTML = '';
            if (comments.length === 0) return;

            comments.forEach(c => {
                let photosHtml = '';
                if (c.photos && c.photos.length > 0) {
                    c.photos.forEach(p => {
                        photosHtml += `<img src="${p}" class="comment-photo" onclick="openModal('${p}')">`;
                    });
                }
                const dateStr = c.createdAt ? c.createdAt.toDate().toLocaleString() : (c.date || '');
                const itemDiv = document.createElement('div');
                itemDiv.className = 'user-comment-item';
                itemDiv.dataset.id = c.id;
                itemDiv.innerHTML = `
                    <div class="comment-actions">
                        <button class="action-btn delete" title="${currentLang === 'ru' ? 'Удалить' : 'Видалити'}">🗑️</button>
                    </div>
                    <div class="user-comment-date">${dateStr}</div>
                    <div class="user-comment-text">${c.text || ''}</div>
                    <div class="user-comment-photos">${photosHtml}</div>
                `;

                itemDiv.querySelector('.action-btn.delete').onclick = async () => {
                    if (confirm(currentLang === 'ru' ? 'Удалить этот комментарий?' : 'Видалити цей коментар?')) {
                        await db.collection('comments').doc(c.id).delete();
                        loadCloudComments(houseId, container);
                    }
                };
                container.appendChild(itemDiv);
            });
        } catch (err) {
            console.error("Comments load error:", err);
            container.innerHTML = '<p style="color:var(--ks-red); font-size: 0.8rem;">Ошибка загрузки отзывов</p>';
        }
    }

    // --- Основные функции поиска и загрузки ---
    async function loadHousesData() {
        if (housesData.length > 0 || isDataLoading) return;

        isDataLoading = true;
        houseResults.innerHTML = `<div class="empty-state"><p>${currentLang === 'ru' ? 'Загрузка данных...' : 'Завантаження данных...'}</p></div>`;

        try {
            if (window.location.protocol === 'file:') {
                throw new Error('FILE_PROTOCOL_RESTRICTION');
            }

            const response = await fetch('houses.xlsx');
            if (!response.ok) throw new Error(`HTTP_ERROR_${response.status}`);

            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            const baseHouses = parseExcelRows(jsonData);

            // Подгружаем дома из коллекции основной базы И кастомные дома
            try {
                // 1. Основная база (перенесенная из Excel)
                const cloudBaseSnapshot = await db.collection('houses_cloud').get();
                const cloudBase = cloudBaseSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

                // 2. Кастомные (новые) дома, добавленные вручную
                const customSnapshot = await db.collection('custom_houses').get();
                const customHouses = customSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

                if (cloudBase.length > 0) {
                    housesData = [...cloudBase, ...customHouses];
                } else {
                    // Если в облаке еще пусто, используем наш локальный Excel
                    housesData = [...baseHouses, ...customHouses];
                }
                
                console.log(`Sync: Loaded ${housesData.length} houses from Firestore.`);
            } catch (err) {
                console.error("Cloud sync error:", err);
                housesData = baseHouses;
            }

            hasAttemptedLoading = true;
            renderEmptyState();
        } catch (e) {
            console.error("Load error:", e);
            let errorMsg = currentLang === 'ru' ? 'Ошибка загрузки базы.' : 'Помилка завантаження бази.';
            if (e.message === 'FILE_PROTOCOL_RESTRICTION') {
                errorMsg = currentLang === 'ru' ? 'Запустите проект через локальный сервер (Live Server).' : 'Запустіть проєкт через локальний сервер.';
            }
            houseResults.innerHTML = `<div class="empty-state" style="color: var(--ks-red)"><p>${errorMsg}</p></div>`;
        } finally {
            isDataLoading = false;
        }
    }

    function parseExcelRows(rows) {
        let currentStreet = '';
        const list = [];
        for (let i = 0; i < rows.length; i++) {
            const cols = rows[i];
            if (!cols || cols.length === 0) continue; // Исправлено: не пропускаем короткие строки (улицы)
            
            const cleanCols = cols.map(c => (c === undefined || c === null) ? '' : c.toString().trim());
            
            // Если заполнена первая колонка, а вторая пустая — это название улицы
            if (cleanCols[0] && !cleanCols[1]) {
                currentStreet = cleanCols[0];
                continue;
            }

            // Если заполнена вторая колонка — это дом
            if (cleanCols[1] && cleanCols[1] !== 'Дім' && cleanCols[1] !== 'Дом' && cleanCols[1] !== '№') {
                list.push({
                    street: currentStreet,
                    house: cleanCols[1],
                    key: cleanCols[3] || '-',
                    ods: cleanCols[4] || '-',
                    comment: cleanCols[6] || '-',
                    isCustom: false
                });
            }
        }
        return list;
    }


    // --- Добавление нового дома ---
    const btnShowAddHouse = document.getElementById('btn-show-add-house');
    const addHouseForm = document.getElementById('add-house-form');
    const btnSaveNewHouse = document.getElementById('btn-save-new-house');
    const btnCancelNewHouse = document.getElementById('btn-cancel-new-house');

    if (btnShowAddHouse) {
        btnShowAddHouse.onclick = () => {
            addHouseForm.style.display = addHouseForm.style.display === 'none' ? 'block' : 'none';
        };
    }

    if (btnCancelNewHouse) {
        btnCancelNewHouse.onclick = () => {
            addHouseForm.style.display = 'none';
            clearAddHouseForm();
        };
    }

    if (btnSaveNewHouse) {
        btnSaveNewHouse.onclick = async () => {
            const street = document.getElementById('new-house-street').value.trim();
            const number = document.getElementById('new-house-number').value.trim();
            const ods = document.getElementById('new-house-ods').value.trim();
            const key = document.getElementById('new-house-key').value.trim();
            const comment = document.getElementById('new-house-comment').value.trim();

            if (!street || !number) {
                alert(currentLang === 'ru' ? 'Введите улицу и номер дома!' : 'Введіть вулицю та номер будинку!');
                return;
            }

            btnSaveNewHouse.disabled = true;
            btnSaveNewHouse.textContent = '...';

            try {
                const newHouse = {
                    street: street,
                    house: number,
                    ods: ods,
                    key: key,
                    comment: comment,
                    isCustom: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('custom_houses').add(newHouse);
                housesData.push(newHouse);
                
                alert(currentLang === 'ru' ? 'Дом успешно добавлен в общую базу!' : 'Будинок успішно доданий в загальну базу!');
                addHouseForm.style.display = 'none';
                clearAddHouseForm();
                houseSearchInput.value = `${street} ${number}`;
                searchHouses();
            } catch (err) {
                alert("Cloud save error: " + err.message);
            } finally {
                btnSaveNewHouse.disabled = false;
                btnSaveNewHouse.textContent = currentLang === 'ru' ? 'Сохранить' : 'Зберегти';
            }
        };
    }

    function clearAddHouseForm() {
        ['new-house-street', 'new-house-number', 'new-house-ods', 'new-house-key', 'new-house-comment'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    // --- Поиск и Отрисовка ---
    function searchHouses() {
        const query = houseSearchInput.value.toLowerCase().trim();
        if (!query) {
            renderEmptyState();
            return;
        }

        if (housesData.length === 0) {
            if (isDataLoading) return;
            loadHousesData().then(() => searchHouses());
            return;
        }

        const filtered = housesData.filter(item => {
            const street = (item.street || '').toLowerCase();
            const house = (item.house || '').toLowerCase();
            const fullAddr = `${street} ${house}`.trim();
            return fullAddr.includes(query) || (street.includes(query) && query.length > 3);
        });

        renderSearchResults(filtered);
    }

    function renderEmptyState() {
        const msg = currentLang === 'ru' ? 'Введите адрес для поиска.' : 'Введіть адресу для пошуку.';
        houseResults.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
    }

    function renderSearchResults(results) {
        if (results.length === 0) {
            const msg = currentLang === 'ru' ? 'Ничего не найдено' : 'Нічого не знайдено';
            houseResults.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
            return;
        }

        houseResults.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'cards-grid';
        
        results.forEach(item => {
            const houseId = `${item.street}_${item.house}`.replace(/\s+/g, '_');
            const card = document.createElement('div');
            card.className = 'card house-card';

            const labels = {
                ods: currentLang === 'ru' ? 'ОДС' : 'ОДС',
                key: currentLang === 'ru' ? 'Ключ' : 'Ключ',
                comment: currentLang === 'ru' ? 'Заметка' : 'Прим.',
                userFeedback: currentLang === 'ru' ? 'Правки и Фото' : 'Правки та Фото',
                addComment: currentLang === 'ru' ? 'Отправить' : 'Надіслати',
                placeholder: currentLang === 'ru' ? 'Комментарий сотрудников...' : 'Коментар співробітників...',
                uploadPhoto: currentLang === 'ru' ? 'Добавить фото' : 'Додати фото'
            };

            card.innerHTML = `
                <h3>${item.street}, ${item.house}</h3>
                <div class="house-info-grid">
                    <div class="info-item"><span class="info-label">${labels.ods}</span><span class="info-value">${item.ods || '-'}</span></div>
                    <div class="info-item"><span class="info-label">${labels.key}</span><span class="info-value">${item.key || '-'}</span></div>
                    <div class="info-item"><span class="info-label">${labels.comment}</span><span class="info-value">${item.comment || '-'}</span></div>
                </div>
                <div class="user-feedback" id="feedback-${houseId}">
                    <h4>${labels.userFeedback}</h4>
                    <div class="user-comments-list" id="comments-list-${houseId}"></div>
                    <div class="comment-form">
                        <textarea class="user-comment-input" placeholder="${labels.placeholder}"></textarea>
                        <div style="display: flex; gap: 10px; margin-top: 10px; align-items: stretch;">
                            <label class="photo-upload-label" style="flex: 1; margin-top: 0; display: flex; align-items: center; justify-content: center; height: 45px; background: rgba(0, 149, 217, 0.05); border: 1px dashed var(--ks-blue); cursor: pointer;">
                                <span style="font-size: 1.2rem; margin-right: 8px;">📷</span> ${labels.uploadPhoto}
                                <input type="file" multiple accept="image/*" style="display: none;" class="photo-input">
                            </label>
                            <button class="btn-add-comment" style="flex: 1; height: 45px; margin-top: 0;">${labels.addComment}</button>
                        </div>
                        <div class="photo-previews" style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px;"></div>
                    </div>
                </div>
            `;

            const commentsContainer = card.querySelector(`#comments-list-${houseId}`);
            loadCloudComments(houseId, commentsContainer);

            const addBtn = card.querySelector('.btn-add-comment');
            const textarea = card.querySelector('.user-comment-input');
            const photoInput = card.querySelector('.photo-input');
            const previewContainer = card.querySelector('.photo-previews');
            let selectedFiles = [];

            photoInput.onchange = (e) => {
                for (let file of e.target.files) {
                    selectedFiles.push(file);
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.className = 'comment-photo';
                    img.style.width = '45px';
                    img.style.height = '45px';
                    img.style.borderRadius = '4px';
                    img.style.objectFit = 'cover';
                    previewContainer.appendChild(img);
                }
            };

            addBtn.onclick = async () => {
                const text = textarea.value.trim();
                if (!text && selectedFiles.length === 0) return;

                addBtn.disabled = true;
                const originalText = addBtn.textContent;
                addBtn.textContent = '...';

                try {
                    const photoUrls = selectedFiles.length > 0 ? await uploadFiles(selectedFiles) : [];
                    await db.collection('comments').add({
                        houseId,
                        text,
                        photos: photoUrls,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    textarea.value = '';
                    selectedFiles = [];
                    previewContainer.innerHTML = '';
                    loadCloudComments(houseId, commentsContainer);
                } catch (err) {
                    alert("Error: " + err.message);
                } finally {
                    addBtn.disabled = false;
                    addBtn.textContent = originalText;
                }
            };

            grid.appendChild(card);
        });
        houseResults.appendChild(grid);
    }

    // --- Модальное окно ---
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const closeBtn = document.querySelector('.modal-close');

    window.openModal = (src) => {
        modal.style.display = 'flex';
        modalImg.src = src;
    };

    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    // --- Обработчики событий ---
    houseSearchBtn.onclick = searchHouses;
    houseSearchInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            searchHouses();
            hideSuggestions();
        }
    };

    const houseSuggestions = document.getElementById('house-suggestions');
    houseSearchInput.oninput = function(e) {
        const val = this.value.toLowerCase().trim();
        houseSuggestions.innerHTML = '';
        if (!val) { houseSuggestions.style.display = 'none'; return; }

        let suggestions = [];
        
        // Разбиваем ввод на возможную улицу и номер дома (по пробелу)
        const parts = val.split(' ');
        const inputStreet = parts[0];
        const inputHouse = parts.slice(1).join(' ');

        if (parts.length === 1) {
            // Подсказываем только уникальные улицы
            const uniqueStreets = [...new Set(housesData.map(h => h.street))];
            suggestions = uniqueStreets
                .filter(s => s.toLowerCase().includes(inputStreet))
                .slice(0, 10);
            
            suggestions.forEach(s => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = s;
                div.onclick = () => {
                    houseSearchInput.value = s + ' '; // Добавляем пробел для перехода к номерам домов
                    houseSearchInput.focus();
                    houseSearchInput.dispatchEvent(new Event('input'));
                };
                houseSuggestions.appendChild(div);
            });
        } else {
            // Подсказываем номера домов для конкретной улицы
            const streetMatches = housesData.filter(h => h.street.toLowerCase() === inputStreet);
            if (streetMatches.length > 0) {
                const houseNumbers = [...new Set(streetMatches.map(h => h.house))];
                suggestions = houseNumbers
                    .filter(n => n.toLowerCase().startsWith(inputHouse))
                    .slice(0, 15);
                
                suggestions.forEach(n => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerHTML = `<strong>${inputStreet}</strong> ${n}`;
                    div.onclick = () => {
                        houseSearchInput.value = `${streetMatches[0].street} ${n}`;
                        houseSuggestions.style.display = 'none';
                        document.getElementById('house-search-btn').click();
                    };
                    houseSuggestions.appendChild(div);
                });
            }
        }

        houseSuggestions.style.display = houseSuggestions.childElementCount > 0 ? 'block' : 'none';
    };

    function hideSuggestions() {
        if (houseSuggestions) houseSuggestions.style.display = 'none';
    }

    document.addEventListener('click', (e) => {
        if (!houseSearchInput.contains(e.target) && !houseSuggestions.contains(e.target)) {
            hideSuggestions();
        }
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.getAttribute('data-target') === 'houses-section') {
                loadHousesData();
            }
        });
    });

    if (document.querySelector('.content-section.active')?.id === 'houses-section') {
        loadHousesData();
    }
});

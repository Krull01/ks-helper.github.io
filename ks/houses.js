document.addEventListener('DOMContentLoaded', () => {
    // Инициализация Firebase (если ещё не инициализирована)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const storage = firebase.storage();

    let housesData = [];
    let isDataLoading = false;
    let hasAttemptedLoading = false;
    const houseSearchInput = document.getElementById('house-search-input');
    const houseSearchBtn = document.getElementById('house-search-btn');
    const houseResults = document.getElementById('houses-results');

    // --- Хелпер: экранирование HTML (защита от XSS) ---
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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

            const currentLang = window.currentLang || 'ru';
            comments.forEach(c => {
                let photosHtml = '';
                if (c.photos && c.photos.length > 0) {
                    c.photos.forEach(p => {
                        const safeUrl = escapeHtml(p);
                        photosHtml += `<img src="${safeUrl}" class="comment-photo" onclick="openModal('${safeUrl}')">`;
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
                    <div class="user-comment-text">${escapeHtml(c.text || '')}</div>
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
        const currentLang = window.currentLang || 'ru';
        if (houseResults) {
            houseResults.innerHTML = `<div class="empty-state"><p>${currentLang === 'ru' ? 'Загрузка данных...' : 'Завантаження даних...'}</p></div>`;
        }

        try {
            let baseHouses = [];
            try {
                const response = await fetch('houses.xlsx');
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const data = new Uint8Array(arrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    baseHouses = parseExcelRows(jsonData);
                } else {
                    console.log('houses.xlsx missing, falling back to Firebase completely');
                }
            } catch (e) {
                console.log('houses.xlsx fetch error:', e.message);
            }

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
            if (houseResults) {
                houseResults.innerHTML = `<div class="empty-state" style="color: var(--ks-red)"><p>${errorMsg}</p></div>`;
            }
        } finally {
            isDataLoading = false;
        }
    }

    function parseExcelRows(rows) {
        let currentStreet = '';
        const list = [];
        for (let i = 0; i < rows.length; i++) {
            const cols = rows[i];
            if (!cols || cols.length === 0) continue;
            
            const cleanCols = cols.map(c => (c === undefined || c === null) ? '' : c.toString().trim());
            
            if (cleanCols[0] && !cleanCols[1]) {
                currentStreet = cleanCols[0];
                continue;
            }

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
            if (addHouseForm) {
                addHouseForm.style.display = addHouseForm.style.display === 'none' ? 'block' : 'none';
            }
        };
    }

    if (btnCancelNewHouse) {
        btnCancelNewHouse.onclick = () => {
            if (addHouseForm) addHouseForm.style.display = 'none';
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

            const currentLang = window.currentLang || 'ru';
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
                if (addHouseForm) addHouseForm.style.display = 'none';
                clearAddHouseForm();
                if (houseSearchInput) {
                    houseSearchInput.value = `${street} ${number}`;
                }
                searchHouses();
            } catch (err) {
                alert("Cloud save error: " + err.message);
            } finally {
                btnSaveNewHouse.disabled = false;
                btnSaveNewHouse.textContent = currentLang === 'ru' ? 'Сохранить' : 'Зберегти';
            }
        };
    }

    const newHouseStreetInput = document.getElementById('new-house-street');
    const newHouseSuggestions = document.getElementById('new-house-suggestions');

    if (newHouseStreetInput && newHouseSuggestions) {
        newHouseStreetInput.oninput = function() {
            const val = this.value.toLowerCase().trim();
            newHouseSuggestions.innerHTML = '';
            
            if (!val) { 
                newHouseSuggestions.style.display = 'none'; 
                return; 
            }

            const uniqueStreets = [...new Set(housesData.map(h => h.street))];
            const valWords = val.split(/\s+/).filter(w => w.length > 0);
            
            const suggestions = uniqueStreets.filter(s => {
                const sLower = s.toLowerCase();
                return valWords.every(w => sLower.includes(w));
            }).slice(0, 10);
            
            suggestions.forEach(s => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = s;
                div.onclick = () => {
                    newHouseStreetInput.value = s;
                    newHouseSuggestions.style.display = 'none';
                    const numInput = document.getElementById('new-house-number');
                    if (numInput) numInput.focus();
                };
                newHouseSuggestions.appendChild(div);
            });

            newHouseSuggestions.style.display = newHouseSuggestions.childElementCount > 0 ? 'block' : 'none';
        };

        document.addEventListener('click', (e) => {
            if (!newHouseStreetInput.contains(e.target) && !newHouseSuggestions.contains(e.target)) {
                newHouseSuggestions.style.display = 'none';
            }
        });
    }

    function clearAddHouseForm() {
        ['new-house-street', 'new-house-number', 'new-house-ods', 'new-house-key', 'new-house-comment'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    // --- Поиск и Отрисовка ---
    function searchHouses() {
        if (!houseSearchInput) return;
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
        if (!houseResults) return;
        const currentLang = window.currentLang || 'ru';
        const msg = currentLang === 'ru' ? 'Введите адрес для поиска.' : 'Введіть адресу для пошуку.';
        houseResults.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
    }

    function renderSearchResults(results) {
        if (!houseResults) return;
        const currentLang = window.currentLang || 'ru';
        if (results.length === 0) {
            const msg = currentLang === 'ru' ? 'Ничего не найдено' : 'Нічого не знайдено';
            houseResults.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
            return;
        }

        houseResults.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'cards-grid';
        
        results.forEach(item => {
            const houseId = `${item.street}_${item.house}`.replace(/[^a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ0-9]/g, '_');
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
                        <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                            <label class="photo-upload-label" style="flex: 1 1 120px; min-width: 0; margin-top: 0; display: flex; align-items: center; justify-content: center; height: 45px; background: rgba(0, 149, 217, 0.05); border: 1px dashed var(--ks-blue); cursor: pointer; border-radius: 8px; box-sizing: border-box; overflow: hidden; white-space: nowrap; font-size: 0.85rem;">
                                <span style="font-size: 1.2rem; margin-right: 6px;">📷</span> ${labels.uploadPhoto}
                                <input type="file" multiple accept="image/*" style="display: none;" class="photo-input">
                            </label>
                            <button class="btn-add-comment" style="flex: 1 1 120px; min-width: 0; height: 45px; margin-top: 0; box-sizing: border-box;">${labels.addComment}</button>
                        </div>
                        <div class="photo-previews" style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px;"></div>
                    </div>
                </div>
            `;

            const commentsContainer = card.querySelector(`#comments-list-${houseId}`);
            if (commentsContainer) {
                loadCloudComments(houseId, commentsContainer);
            }

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

    // --- Обработчики событий поиска ---
    if (houseSearchBtn) houseSearchBtn.onclick = searchHouses;
    if (houseSearchInput) {
        houseSearchInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                searchHouses();
                hideSuggestions();
            }
        };
    }

    const houseSuggestions = document.getElementById('house-suggestions');
    if (houseSearchInput && houseSuggestions) {
        houseSearchInput.oninput = function(e) {
            const val = this.value.toLowerCase().trim();
            houseSuggestions.innerHTML = '';
            if (!val) { houseSuggestions.style.display = 'none'; return; }

            let suggestions = [];
            const uniqueStreets = [...new Set(housesData.map(h => h.street))];
            const sortedStreets = [...uniqueStreets].sort((a, b) => b.length - a.length);
            
            let matchedStreet = null;
            let housePart = '';

            for (let street of sortedStreets) {
                const streetLower = street.toLowerCase();
                if (val === streetLower) {
                    matchedStreet = street;
                    housePart = '';
                    break;
                } else if (val.startsWith(streetLower + ' ')) {
                    matchedStreet = street;
                    housePart = val.substring(streetLower.length + 1).trim();
                    break;
                }
            }

            const valWords = val.split(/\s+/).filter(w => w.length > 0);

            if (matchedStreet) {
                const streetHouses = housesData.filter(h => h.street === matchedStreet);
                const houseNumbers = [...new Set(streetHouses.map(h => h.house))];
                
                let filteredHouses = houseNumbers;
                if (housePart) {
                    filteredHouses = houseNumbers.filter(n => n.toLowerCase().startsWith(housePart.toLowerCase()));
                }

                filteredHouses.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
                suggestions = filteredHouses.slice(0, 15);
                
                suggestions.forEach(n => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerHTML = `<strong>${matchedStreet}</strong> ${n}`;
                    div.onclick = () => {
                        houseSearchInput.value = `${matchedStreet} ${n}`;
                        houseSuggestions.style.display = 'none';
                        if (houseSearchBtn) houseSearchBtn.click();
                    };
                    houseSuggestions.appendChild(div);
                });
            } else {
                const lastWord = valWords[valWords.length - 1] || '';
                const hasDigits = /\d/.test(lastWord);
                
                if (hasDigits && valWords.length > 1) {
                    const streetWords = valWords.slice(0, -1);
                    const possibleStreets = uniqueStreets.filter(s => {
                        const sLower = s.toLowerCase();
                        return streetWords.every(w => sLower.includes(w));
                    });

                    if (possibleStreets.length === 1) {
                        const matched = possibleStreets[0];
                        const streetHouses = housesData.filter(h => h.street === matched);
                        const houseNumbers = [...new Set(streetHouses.map(h => h.house))];
                        
                        let filteredHouses = houseNumbers.filter(n => n.toLowerCase().startsWith(lastWord.toLowerCase()));
                        filteredHouses.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
                        
                        suggestions = filteredHouses.slice(0, 15);
                        suggestions.forEach(n => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            div.innerHTML = `<strong>${matched}</strong> ${n}`;
                            div.onclick = () => {
                                houseSearchInput.value = `${matched} ${n}`;
                                houseSuggestions.style.display = 'none';
                                if (houseSearchBtn) houseSearchBtn.click();
                            };
                            houseSuggestions.appendChild(div);
                        });
                    } else {
                        suggestions = possibleStreets.slice(0, 10);
                        suggestions.forEach(s => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            div.textContent = s;
                            div.onclick = () => {
                                houseSearchInput.value = s + ' ';
                                houseSearchInput.focus();
                                houseSearchInput.dispatchEvent(new Event('input'));
                            };
                            houseSuggestions.appendChild(div);
                        });
                    }
                } else {
                    suggestions = uniqueStreets.filter(s => {
                        const sLower = s.toLowerCase();
                        return valWords.every(w => sLower.includes(w));
                    }).slice(0, 10);
                    
                    suggestions.forEach(s => {
                        const div = document.createElement('div');
                        div.className = 'suggestion-item';
                        div.textContent = s;
                        div.onclick = () => {
                            houseSearchInput.value = s + ' ';
                            houseSearchInput.focus();
                            houseSearchInput.dispatchEvent(new Event('input'));
                        };
                        houseSuggestions.appendChild(div);
                    });
                }
            }

            houseSuggestions.style.display = houseSuggestions.childElementCount > 0 ? 'block' : 'none';
        };
    }

    function hideSuggestions() {
        if (houseSuggestions) houseSuggestions.style.display = 'none';
    }

    if (houseSearchInput) {
        document.addEventListener('click', (e) => {
            if (!houseSearchInput.contains(e.target) && !houseSuggestions.contains(e.target)) {
                hideSuggestions();
            }
        });
    }

    // Триггер загрузки данных при переходе на вкладку домов
    const navItems = document.querySelectorAll('.nav-item');
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

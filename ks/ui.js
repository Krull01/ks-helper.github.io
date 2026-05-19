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

    // Навигация по под-табам (Контракт)
    const contractSubTabItems = document.querySelectorAll('.contract-sub-tab-item');
    const contractSubTabPanes = document.querySelectorAll('.contract-sub-tab-pane');

    contractSubTabItems.forEach(item => {
        item.addEventListener('click', () => {
            contractSubTabItems.forEach(tab => tab.classList.remove('active'));
            item.classList.add('active');

            contractSubTabPanes.forEach(pane => pane.classList.remove('active'));

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

    // --- Модальное окно для картинок ---
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const closeBtn = document.querySelector('.modal-close');

    window.openModal = (src) => {
        if (modal && modalImg) {
            modal.style.display = 'flex';
            modalImg.src = src;
        }
    };

    if (closeBtn) {
        closeBtn.onclick = () => {
            if (modal) modal.style.display = 'none';
        };
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

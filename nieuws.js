// Joeri Video - Nieuws Page

const CORRECT_PASSWORD = '123123';

// State
let newsItems = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadNews();
    setupEventListeners();
    setupSidebar();
    setupAdmin();
});

function setupEventListeners() {
    const addNewsBtn = document.getElementById('addNewsBtn');
    const passwordModal = document.getElementById('passwordModal');
    const newsModal = document.getElementById('newsModal');
    const passwordInput = document.getElementById('passwordInput');
    const submitPassword = document.getElementById('submitPassword');
    const cancelPassword = document.getElementById('cancelPassword');
    const passwordError = document.getElementById('passwordError');
    const closeNewsModal = document.getElementById('closeNewsModal');
    const cancelNews = document.getElementById('cancelNews');
    const submitNews = document.getElementById('submitNews');

    // Add news button
    addNewsBtn.addEventListener('click', () => {
        showModal(passwordModal);
        passwordInput.value = '';
        passwordError.textContent = '';
    });

    // Password modal
    submitPassword.addEventListener('click', () => {
        if (passwordInput.value === CORRECT_PASSWORD) {
            hideModal(passwordModal);
            showModal(newsModal);
            document.getElementById('newsTitle').value = '';
            document.getElementById('newsContent').value = '';
        } else {
            passwordError.textContent = 'Verkeerd wachtwoord';
            passwordInput.value = '';
        }
    });

    cancelPassword.addEventListener('click', () => hideModal(passwordModal));

    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitPassword.click();
    });

    // News modal
    closeNewsModal.addEventListener('click', () => hideModal(newsModal));
    cancelNews.addEventListener('click', () => hideModal(newsModal));
    submitNews.addEventListener('click', publishNews);

    // Close modals on outside click
    [passwordModal, newsModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal(modal);
        });
    });
}

function showModal(modal) {
    modal.classList.add('active');
}

function hideModal(modal) {
    modal.classList.remove('active');
}

function showLoading(text = 'Laden...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

async function publishNews() {
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();

    if (!title || !content) {
        alert('Vul een titel en inhoud in');
        return;
    }

    showLoading('Publiceren...');

    try {
        const firestore = firebase.firestore();
        await firestore.collection('news').add({
            title: title,
            content: content,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAtLocal: new Date().toISOString()
        });

        hideLoading();
        hideModal(document.getElementById('newsModal'));
        alert('Nieuws gepubliceerd!');
        loadNews();
    } catch (error) {
        console.error('Error publishing news:', error);
        hideLoading();
        alert('Fout bij publiceren: ' + error.message);
    }
}

async function loadNews() {
    try {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            renderNews([]);
            return;
        }

        const firestore = firebase.firestore();
        const snapshot = await firestore.collection('news')
            .orderBy('createdAt', 'desc')
            .get();

        newsItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderNews(newsItems);
    } catch (error) {
        console.error('Error loading news:', error);
        renderNews([]);
    }
}

function renderNews(items) {
    const newsList = document.getElementById('newsList');
    const emptyState = document.getElementById('emptyState');

    // Clear existing items
    const cards = newsList.querySelectorAll('.news-card');
    cards.forEach(card => card.remove());

    if (items.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    items.forEach(item => {
        const card = createNewsCard(item);
        newsList.appendChild(card);
    });
}

function createNewsCard(item) {
    const card = document.createElement('article');
    card.className = 'news-card';

    const date = item.createdAtLocal
        ? new Date(item.createdAtLocal).toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        : 'Onbekend';

    card.innerHTML = `
        <h2 class="news-title">${escapeHtml(item.title)}</h2>
        <p class="news-date">${date}</p>
        <div class="news-body">${escapeHtml(item.content).replace(/\n/g, '<br>')}</div>
    `;

    return card;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== SIDEBAR ====================

function setupSidebar() {
    const menuBtn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const closeSidebar = document.getElementById('closeSidebar');

    if (!menuBtn || !sidebar) return;

    menuBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
        sidebarOverlay.classList.add('active');
    });

    closeSidebar.addEventListener('click', closeSidebarMenu);
    sidebarOverlay.addEventListener('click', closeSidebarMenu);

    function closeSidebarMenu() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }
}

// ==================== ADMIN ====================

function setupAdmin() {
    const adminLink = document.getElementById('adminLink');
    const adminModal = document.getElementById('adminModal');
    const closeAdminModal = document.getElementById('closeAdminModal');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminError = document.getElementById('adminError');
    const adminLogin = document.getElementById('adminLogin');
    const adminPanel = document.getElementById('adminPanel');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    if (!adminLink || !adminModal) return;

    adminLink.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarOverlay').classList.remove('active');
        showModal(adminModal);
        adminPasswordInput.value = '';
        adminError.textContent = '';
        adminLogin.style.display = 'block';
        adminPanel.style.display = 'none';
    });

    closeAdminModal.addEventListener('click', () => hideModal(adminModal));

    adminLoginBtn.addEventListener('click', () => {
        if (adminPasswordInput.value === CORRECT_PASSWORD) {
            adminLogin.style.display = 'none';
            adminPanel.style.display = 'block';
        } else {
            adminError.textContent = 'Verkeerd wachtwoord';
            adminPasswordInput.value = '';
        }
    });

    adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminLoginBtn.click();
    });

    saveSettingsBtn.addEventListener('click', async () => {
        const siteName = document.getElementById('siteNameInput').value;
        if (!siteName) return;

        showLoading('Opslaan...');
        try {
            const firestore = firebase.firestore();
            await firestore.collection('settings').doc('site').set({ siteName }, { merge: true });
            hideLoading();
            hideModal(adminModal);
            alert('Opgeslagen!');
        } catch (error) {
            hideLoading();
            alert('Fout: ' + error.message);
        }
    });

    adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) hideModal(adminModal);
    });
}

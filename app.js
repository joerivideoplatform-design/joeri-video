// Joeri Video - Main Application

const CORRECT_PASSWORD = '123123';

// DOM Elements
const addVideoBtn = document.getElementById('addVideoBtn');
const passwordModal = document.getElementById('passwordModal');
const cameraModal = document.getElementById('cameraModal');
const playerModal = document.getElementById('playerModal');
const passwordInput = document.getElementById('passwordInput');
const submitPassword = document.getElementById('submitPassword');
const cancelPassword = document.getElementById('cancelPassword');
const passwordError = document.getElementById('passwordError');
const closeCameraModal = document.getElementById('closeCameraModal');
const closePlayerModal = document.getElementById('closePlayerModal');
const cameraPreview = document.getElementById('cameraPreview');
const recordedPreview = document.getElementById('recordedPreview');
const recordBtn = document.getElementById('recordBtn');
const switchCamera = document.getElementById('switchCamera');
const cameraLabel = document.getElementById('cameraLabel');
const recordingTime = document.getElementById('recordingTime');
const previewControls = document.getElementById('previewControls');
const videoTitle = document.getElementById('videoTitle');
const discardVideo = document.getElementById('discardVideo');
const uploadVideo = document.getElementById('uploadVideo');
const videoGrid = document.getElementById('videoGrid');
const emptyState = document.getElementById('emptyState');
const videoPlayer = document.getElementById('videoPlayer');
const playerTitle = document.getElementById('playerTitle');
const videoDate = document.getElementById('videoDate');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const searchInput = document.getElementById('searchInput');

// State
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingTimer = null;
let recordingSeconds = 0;
let useFrontCamera = true;
let recordedBlob = null;
let videos = [];
let selectedThumbnailTime = 1; // Default thumbnail at 1 second
let thumbnailGrid = null;
let selectedFilter = 'none';
let currentEditingVideo = null;

// Site settings
let siteSettings = {
    siteName: "Joeri's Video's",
    emptyStateTitle: "Nog geen video's",
    emptyStateText: "Klik op \"Voeg toe\" om je eerste video op te nemen!"
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSiteSettings();
    loadVideos();
    setupEventListeners();
    setupSidebar();
    setupAdmin();
    setupFilters();
    setupEditor();
    setupMobileSearch();
});

function setupEventListeners() {
    // Add video button
    addVideoBtn.addEventListener('click', () => {
        showModal(passwordModal);
        passwordInput.value = '';
        passwordError.textContent = '';
        passwordInput.focus();
    });

    // Password modal
    submitPassword.addEventListener('click', checkPassword);
    cancelPassword.addEventListener('click', () => hideModal(passwordModal));
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkPassword();
    });

    // Camera modal
    closeCameraModal.addEventListener('click', closeCamera);
    switchCamera.addEventListener('click', toggleCamera);
    recordBtn.addEventListener('click', toggleRecording);
    discardVideo.addEventListener('click', discardRecording);
    uploadVideo.addEventListener('click', uploadRecording);

    // Player modal
    closePlayerModal.addEventListener('click', () => {
        hideModal(playerModal);
        videoPlayer.pause();
        videoPlayer.src = '';
    });

    // Search
    searchInput.addEventListener('input', filterVideos);

    // Close modals on outside click
    [passwordModal, cameraModal, playerModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal === cameraModal) {
                    closeCamera();
                } else if (modal === playerModal) {
                    hideModal(playerModal);
                    videoPlayer.pause();
                } else {
                    hideModal(modal);
                }
            }
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
    loadingText.textContent = text;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

function checkPassword() {
    const password = passwordInput.value;
    if (password === CORRECT_PASSWORD) {
        hideModal(passwordModal);
        openCamera();
    } else {
        passwordError.textContent = 'Verkeerd wachtwoord. Probeer opnieuw.';
        passwordInput.value = '';
        passwordInput.focus();
    }
}

async function openCamera() {
    showModal(cameraModal);
    await startCamera();
}

async function startCamera() {
    try {
        // Stop any existing stream
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: useFrontCamera ? 'user' : 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        };

        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraPreview.srcObject = mediaStream;
        cameraPreview.style.display = 'block';
        recordedPreview.style.display = 'none';
        previewControls.style.display = 'none';

        cameraLabel.textContent = useFrontCamera ? 'Voorste camera' : 'Achterste camera';

        // Reset recording state
        resetRecordingState();
    } catch (error) {
        console.error('Camera error:', error);
        alert('Kan geen toegang krijgen tot de camera. Controleer of je toestemming hebt gegeven.');
        closeCamera();
    }
}

function toggleCamera() {
    if (isRecording) return;
    useFrontCamera = !useFrontCamera;
    startCamera();
}

function closeCamera() {
    hideModal(cameraModal);
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    resetRecordingState();
}

function resetRecordingState() {
    isRecording = false;
    recordedChunks = [];
    recordedBlob = null;
    recordBtn.classList.remove('recording');
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    recordingTime.style.display = 'none';
    recordingSeconds = 0;
    videoTitle.value = '';
    selectedFilter = 'none';

    // Reset filter buttons
    const filterBtns = document.querySelectorAll('#filterBar .filter-btn');
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === 'none');
    });

    // Reset filter on video elements
    const cameraPreview = document.getElementById('cameraPreview');
    const recordedPreview = document.getElementById('recordedPreview');
    const filters = ['filter-none', 'filter-grayscale', 'filter-sepia', 'filter-contrast', 'filter-warm', 'filter-cool'];
    filters.forEach(f => {
        cameraPreview.classList.remove(f);
        recordedPreview.classList.remove(f);
    });
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    recordedChunks = [];

    const options = { mimeType: 'video/webm;codecs=vp9,opus' };

    // Fallback for browsers that don't support vp9
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/mp4';
    }

    try {
        mediaRecorder = new MediaRecorder(mediaStream, options);
    } catch (e) {
        console.error('MediaRecorder error:', e);
        alert('Opnemen wordt niet ondersteund in deze browser.');
        return;
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: options.mimeType });
        showPreview();
    };

    mediaRecorder.start(1000); // Collect data every second
    isRecording = true;
    recordBtn.classList.add('recording');

    // Start timer
    recordingSeconds = 0;
    recordingTime.style.display = 'block';
    recordingTime.textContent = '00:00';
    recordingTimer = setInterval(() => {
        recordingSeconds++;
        const minutes = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
        const seconds = (recordingSeconds % 60).toString().padStart(2, '0');
        recordingTime.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    isRecording = false;
    recordBtn.classList.remove('recording');

    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}

function showPreview() {
    cameraPreview.style.display = 'none';
    recordedPreview.style.display = 'block';
    recordedPreview.src = URL.createObjectURL(recordedBlob);
    recordedPreview.controls = true;
    previewControls.style.display = 'block';
    recordingTime.style.display = 'none';

    // Stop camera stream
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Generate thumbnail options after video loads
    thumbnailGrid = document.getElementById('thumbnailGrid');
    thumbnailGrid.innerHTML = '';

    recordedPreview.onloadedmetadata = () => {
        generateThumbnails();
    };
}

function generateThumbnails() {
    const duration = recordedPreview.duration;
    const numThumbnails = Math.min(6, Math.max(3, Math.floor(duration)));

    thumbnailGrid.innerHTML = '';
    selectedThumbnailTime = 1;

    for (let i = 0; i < numThumbnails; i++) {
        const time = (duration / numThumbnails) * i + (duration / numThumbnails / 2);
        createThumbnailOption(time, i === 0);
    }
}

function createThumbnailOption(time, isSelected) {
    const option = document.createElement('div');
    option.className = 'thumbnail-option' + (isSelected ? ' selected' : '');

    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 135;
    option.appendChild(canvas);

    // Capture frame at specified time
    const tempVideo = document.createElement('video');
    tempVideo.src = recordedPreview.src;
    tempVideo.muted = true;
    tempVideo.preload = 'metadata';

    tempVideo.onloadedmetadata = () => {
        tempVideo.currentTime = time;
    };

    tempVideo.onseeked = () => {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        tempVideo.remove();
    };

    option.onclick = () => {
        document.querySelectorAll('.thumbnail-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        selectedThumbnailTime = time;
    };

    if (isSelected) {
        selectedThumbnailTime = time;
    }

    thumbnailGrid.appendChild(option);
}

function discardRecording() {
    if (confirm('Weet je zeker dat je deze video wilt verwijderen?')) {
        recordedBlob = null;
        recordedPreview.src = '';
        startCamera();
    }
}

async function uploadRecording() {
    const title = videoTitle.value.trim() || `Video ${new Date().toLocaleDateString('nl-NL')}`;

    showLoading('Video uploaden...');

    try {
        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', recordedBlob);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        formData.append('resource_type', 'video');

        const cloudinaryResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!cloudinaryResponse.ok) {
            throw new Error('Cloudinary upload mislukt');
        }

        const cloudinaryData = await cloudinaryResponse.json();
        const videoUrl = cloudinaryData.secure_url;

        // Save metadata to Firebase Firestore
        const firestore = firebase.firestore();
        const videoData = {
            title: title,
            url: videoUrl,
            cloudinaryId: cloudinaryData.public_id,
            duration: recordingSeconds,
            thumbnailTime: Math.round(selectedThumbnailTime),
            filter: selectedFilter,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAtLocal: new Date().toISOString()
        };

        await firestore.collection('videos').add(videoData);

        hideLoading();
        alert('Video is online gezet!');
        closeCamera();
        loadVideos();
    } catch (error) {
        console.error('Upload error:', error);
        hideLoading();
        alert('Er ging iets mis bij het uploaden. Probeer opnieuw.\n' + error.message);
    }
}

async function loadVideos() {
    try {
        // Check if Firebase is configured
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            console.log('Firebase niet geconfigureerd - toon lege staat');
            renderVideos([]);
            return;
        }

        const firestore = firebase.firestore();
        const snapshot = await firestore.collection('videos')
            .orderBy('createdAt', 'desc')
            .get();

        videos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderVideos(videos);
    } catch (error) {
        console.error('Load videos error:', error);
        renderVideos([]);
    }
}

function renderVideos(videosToRender) {
    // Clear grid except empty state
    const cards = videoGrid.querySelectorAll('.video-card');
    cards.forEach(card => card.remove());

    if (videosToRender.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    videosToRender.forEach(video => {
        const card = createVideoCard(video);
        videoGrid.appendChild(card);
    });
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => playVideo(video);

    const duration = formatDuration(video.duration || 0);
    const date = video.createdAtLocal
        ? new Date(video.createdAtLocal).toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        : 'Onbekend';

    // Generate Cloudinary thumbnail URL
    const thumbnailUrl = getCloudinaryThumbnail(video.url, video.thumbnailTime || 1);

    card.innerHTML = `
        <div class="video-thumbnail">
            <img src="${thumbnailUrl}" alt="${escapeHtml(video.title)}" loading="lazy" data-video-url="${video.url}" data-thumb-time="${video.thumbnailTime || 1}">
            <canvas class="thumbnail-canvas" style="display: none;"></canvas>
            <span class="video-duration">${duration}</span>
        </div>
        <div class="video-info-card">
            <div class="video-title">${escapeHtml(video.title)}</div>
            <div class="video-meta">${date}</div>
        </div>
    `;

    // Add error handler for thumbnail
    const img = card.querySelector('img');
    img.onerror = function() {
        generateVideoThumbnail(this);
    };

    return card;
}

function generateVideoThumbnail(imgElement) {
    const videoUrl = imgElement.dataset.videoUrl;
    const thumbTime = parseFloat(imgElement.dataset.thumbTime) || 1;
    const canvas = imgElement.nextElementSibling;

    const tempVideo = document.createElement('video');
    tempVideo.crossOrigin = 'anonymous';
    tempVideo.muted = true;
    tempVideo.preload = 'metadata';

    tempVideo.onloadedmetadata = () => {
        tempVideo.currentTime = Math.min(thumbTime, tempVideo.duration - 0.1);
    };

    tempVideo.onseeked = () => {
        canvas.width = 480;
        canvas.height = 270;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);

        // Hide img, show canvas
        imgElement.style.display = 'none';
        canvas.style.display = 'block';
        tempVideo.remove();
    };

    tempVideo.onerror = () => {
        // Als video ook niet laadt, toon placeholder
        imgElement.style.display = 'none';
        canvas.style.display = 'flex';
        canvas.style.alignItems = 'center';
        canvas.style.justifyContent = 'center';
        canvas.style.backgroundColor = '#2a2a2a';
        canvas.innerHTML = '<svg viewBox="0 0 24 24" width="48" height="48" fill="#666"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>';
    };

    tempVideo.src = videoUrl;
}

function getCloudinaryThumbnail(videoUrl, timeInSeconds) {
    // Convert Cloudinary video URL to thumbnail URL
    // From: https://res.cloudinary.com/cloud/video/upload/v123/id.webm
    // To:   https://res.cloudinary.com/cloud/video/upload/so_2,w_480,h_270,c_fill/v123/id.jpg

    if (!videoUrl || !videoUrl.includes('cloudinary.com')) {
        return videoUrl;
    }

    const time = Math.max(0, Math.round(timeInSeconds));

    // Insert transformation after /upload/
    const transformed = videoUrl.replace(
        '/video/upload/',
        `/video/upload/so_${time},w_480,h_270,c_fill/`
    );

    // Change extension to jpg
    return transformed.replace(/\.(webm|mp4|mov|avi)$/i, '.jpg');
}

function playVideo(video) {
    currentEditingVideo = { ...video };
    playerTitle.textContent = video.title;
    videoDate.textContent = video.createdAtLocal
        ? new Date(video.createdAtLocal).toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '';

    // Apply filter if set
    const filters = ['filter-none', 'filter-grayscale', 'filter-sepia', 'filter-contrast', 'filter-warm', 'filter-cool'];
    filters.forEach(f => videoPlayer.classList.remove(f));
    if (video.filter && video.filter !== 'none') {
        videoPlayer.classList.add(`filter-${video.filter}`);
    }

    videoPlayer.src = video.url;
    showModal(playerModal);
    videoPlayer.play();
}

function filterVideos() {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
        renderVideos(videos);
        return;
    }

    const filtered = videos.filter(video =>
        video.title.toLowerCase().includes(query)
    );
    renderVideos(filtered);
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        // Close sidebar first
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarOverlay').classList.remove('active');
        // Open admin modal
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
            loadSettingsIntoForm();
        } else {
            adminError.textContent = 'Verkeerd wachtwoord';
            adminPasswordInput.value = '';
        }
    });

    adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminLoginBtn.click();
    });

    saveSettingsBtn.addEventListener('click', saveSettings);

    adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) hideModal(adminModal);
    });
}

function loadSettingsIntoForm() {
    document.getElementById('siteNameInput').value = siteSettings.siteName;
    document.getElementById('emptyStateTitle').value = siteSettings.emptyStateTitle;
    document.getElementById('emptyStateText').value = siteSettings.emptyStateText;
}

async function loadSiteSettings() {
    try {
        if (typeof firebase === 'undefined' || !firebase.apps.length) return;

        const firestore = firebase.firestore();
        const doc = await firestore.collection('settings').doc('site').get();

        if (doc.exists) {
            siteSettings = { ...siteSettings, ...doc.data() };
            applySiteSettings();
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSettings() {
    const newSettings = {
        siteName: document.getElementById('siteNameInput').value || siteSettings.siteName,
        emptyStateTitle: document.getElementById('emptyStateTitle').value || siteSettings.emptyStateTitle,
        emptyStateText: document.getElementById('emptyStateText').value || siteSettings.emptyStateText
    };

    showLoading('Opslaan...');

    try {
        const firestore = firebase.firestore();
        await firestore.collection('settings').doc('site').set(newSettings);

        siteSettings = newSettings;
        applySiteSettings();

        hideLoading();
        hideModal(document.getElementById('adminModal'));
        alert('Instellingen opgeslagen!');
    } catch (error) {
        console.error('Error saving settings:', error);
        hideLoading();
        alert('Fout bij opslaan: ' + error.message);
    }
}

function applySiteSettings() {
    // Update site name in header
    const logoText = document.querySelector('.logo span');
    if (logoText) logoText.textContent = siteSettings.siteName;

    // Update page title
    document.title = siteSettings.siteName;

    // Update empty state
    const emptyStateH2 = document.querySelector('.empty-state h2');
    const emptyStateP = document.querySelector('.empty-state p');
    if (emptyStateH2) emptyStateH2.textContent = siteSettings.emptyStateTitle;
    if (emptyStateP) emptyStateP.textContent = siteSettings.emptyStateText;
}

// ==================== FILTERS ====================

function setupFilters() {
    const filterBar = document.getElementById('filterBar');
    if (!filterBar) return;

    const filterBtns = filterBar.querySelectorAll('.filter-btn');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedFilter = btn.dataset.filter;
            applyFilterToPreview();
        });
    });
}

function applyFilterToPreview() {
    const cameraPreview = document.getElementById('cameraPreview');
    const recordedPreview = document.getElementById('recordedPreview');

    // Remove all filter classes
    const filters = ['filter-none', 'filter-grayscale', 'filter-sepia', 'filter-contrast', 'filter-warm', 'filter-cool'];
    filters.forEach(f => {
        cameraPreview.classList.remove(f);
        recordedPreview.classList.remove(f);
    });

    // Add selected filter
    cameraPreview.classList.add(`filter-${selectedFilter}`);
    recordedPreview.classList.add(`filter-${selectedFilter}`);
}

// ==================== VIDEO EDITOR ====================

function setupEditor() {
    const editVideoBtn = document.getElementById('editVideoBtn');
    const editorModal = document.getElementById('editorModal');
    const closeEditorModal = document.getElementById('closeEditorModal');
    const saveEditorBtn = document.getElementById('saveEditorBtn');
    const deleteVideoBtn = document.getElementById('deleteVideoBtn');

    if (!editVideoBtn || !editorModal) return;

    editVideoBtn.addEventListener('click', openEditor);
    closeEditorModal.addEventListener('click', () => hideModal(editorModal));
    saveEditorBtn.addEventListener('click', saveVideoEdits);
    deleteVideoBtn.addEventListener('click', deleteVideo);

    // Editor filter buttons
    const editorFilters = editorModal.querySelectorAll('.editor-filters .filter-btn');
    editorFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            editorFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyEditorFilter(btn.dataset.filter);
        });
    });

    editorModal.addEventListener('click', (e) => {
        if (e.target === editorModal) hideModal(editorModal);
    });
}

function openEditor() {
    if (!currentEditingVideo) return;

    const editorModal = document.getElementById('editorModal');
    const editorVideo = document.getElementById('editorVideo');
    const editorTitle = document.getElementById('editorTitle');
    const editorThumbnailGrid = document.getElementById('editorThumbnailGrid');

    // Set video
    editorVideo.src = currentEditingVideo.url;
    editorTitle.value = currentEditingVideo.title;

    // Set active filter
    const editorFilters = editorModal.querySelectorAll('.editor-filters .filter-btn');
    editorFilters.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === (currentEditingVideo.filter || 'none'));
    });

    applyEditorFilter(currentEditingVideo.filter || 'none');

    // Close player modal and open editor
    hideModal(document.getElementById('playerModal'));
    videoPlayer.pause();
    showModal(editorModal);

    // Generate thumbnails after video loads
    editorVideo.onloadedmetadata = () => {
        generateEditorThumbnails();
    };
}

function generateEditorThumbnails() {
    const editorVideo = document.getElementById('editorVideo');
    const editorThumbnailGrid = document.getElementById('editorThumbnailGrid');
    const duration = editorVideo.duration;
    const numThumbnails = Math.min(6, Math.max(3, Math.floor(duration)));

    editorThumbnailGrid.innerHTML = '';

    for (let i = 0; i < numThumbnails; i++) {
        const time = (duration / numThumbnails) * i + (duration / numThumbnails / 2);
        const isSelected = Math.abs(time - (currentEditingVideo.thumbnailTime || 1)) < 1;
        createEditorThumbnailOption(time, isSelected);
    }
}

function createEditorThumbnailOption(time, isSelected) {
    const editorThumbnailGrid = document.getElementById('editorThumbnailGrid');
    const editorVideo = document.getElementById('editorVideo');

    const option = document.createElement('div');
    option.className = 'thumbnail-option' + (isSelected ? ' selected' : '');

    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 135;
    option.appendChild(canvas);

    // Capture frame
    const tempVideo = document.createElement('video');
    tempVideo.src = editorVideo.src;
    tempVideo.muted = true;
    tempVideo.crossOrigin = 'anonymous';

    tempVideo.onloadedmetadata = () => {
        tempVideo.currentTime = time;
    };

    tempVideo.onseeked = () => {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        tempVideo.remove();
    };

    option.onclick = () => {
        editorThumbnailGrid.querySelectorAll('.thumbnail-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        currentEditingVideo.newThumbnailTime = time;
    };

    if (isSelected) {
        currentEditingVideo.newThumbnailTime = time;
    }

    editorThumbnailGrid.appendChild(option);
}

function applyEditorFilter(filter) {
    const editorVideo = document.getElementById('editorVideo');
    const filters = ['filter-none', 'filter-grayscale', 'filter-sepia', 'filter-contrast', 'filter-warm', 'filter-cool'];
    filters.forEach(f => editorVideo.classList.remove(f));
    editorVideo.classList.add(`filter-${filter}`);
    currentEditingVideo.newFilter = filter;
}

async function saveVideoEdits() {
    const newTitle = document.getElementById('editorTitle').value.trim();

    if (!newTitle) {
        alert('Vul een titel in');
        return;
    }

    showLoading('Opslaan...');

    try {
        const firestore = firebase.firestore();
        const updates = {
            title: newTitle,
            thumbnailTime: Math.round(currentEditingVideo.newThumbnailTime || currentEditingVideo.thumbnailTime || 1),
            filter: currentEditingVideo.newFilter || currentEditingVideo.filter || 'none'
        };

        await firestore.collection('videos').doc(currentEditingVideo.id).update(updates);

        hideLoading();
        hideModal(document.getElementById('editorModal'));
        alert('Video bijgewerkt!');
        loadVideos();
    } catch (error) {
        console.error('Error saving:', error);
        hideLoading();
        alert('Fout bij opslaan: ' + error.message);
    }
}

async function deleteVideo() {
    if (!confirm('Weet je zeker dat je deze video wilt verwijderen?')) {
        return;
    }

    showLoading('Verwijderen...');

    try {
        const firestore = firebase.firestore();
        await firestore.collection('videos').doc(currentEditingVideo.id).delete();

        hideLoading();
        hideModal(document.getElementById('editorModal'));
        alert('Video verwijderd!');
        loadVideos();
    } catch (error) {
        console.error('Error deleting:', error);
        hideLoading();
        alert('Fout bij verwijderen: ' + error.message);
    }
}

// ==================== MOBILE SEARCH ====================

function setupMobileSearch() {
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    const mobileSearchOverlay = document.getElementById('mobileSearchOverlay');
    const mobileSearchClose = document.getElementById('mobileSearchClose');
    const mobileSearchInput = document.getElementById('mobileSearchInput');

    if (!mobileSearchBtn || !mobileSearchOverlay) return;

    mobileSearchBtn.addEventListener('click', () => {
        mobileSearchOverlay.classList.add('active');
        mobileSearchInput.focus();
    });

    mobileSearchClose.addEventListener('click', () => {
        mobileSearchOverlay.classList.remove('active');
        mobileSearchInput.value = '';
        renderVideos(videos);
    });

    mobileSearchInput.addEventListener('input', () => {
        const query = mobileSearchInput.value.toLowerCase().trim();
        if (!query) {
            renderVideos(videos);
            return;
        }
        const filtered = videos.filter(video =>
            video.title.toLowerCase().includes(query)
        );
        renderVideos(filtered);
    });
}

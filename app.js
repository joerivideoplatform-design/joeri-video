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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadVideos();
    setupEventListeners();
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
            <img src="${thumbnailUrl}" alt="${escapeHtml(video.title)}" loading="lazy">
            <span class="video-duration">${duration}</span>
        </div>
        <div class="video-info-card">
            <div class="video-title">${escapeHtml(video.title)}</div>
            <div class="video-meta">${date}</div>
        </div>
    `;

    return card;
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

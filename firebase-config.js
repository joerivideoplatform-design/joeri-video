// Configuratie voor Joeri Video

// Cloudinary configuratie (voor video opslag)
const cloudinaryConfig = {
    cloudName: "drjortkna",
    uploadPreset: "joeri-video"
};

// Firebase configuratie (voor video metadata)
const firebaseConfig = {
    apiKey: "AIzaSyDfy2lH3yQLe4WeXFOpfZTpI_oQHI9JuX4",
    authDomain: "joeri-video.firebaseapp.com",
    projectId: "joeri-video",
    storageBucket: "joeri-video.firebasestorage.app",
    messagingSenderId: "297580594794",
    appId: "1:297580594794:web:ec401706a2933bde6dac13"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
console.log('Firebase geinitialiseerd!');

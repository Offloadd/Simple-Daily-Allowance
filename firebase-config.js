// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA89BZxelKRoK64JnYtSdWUho2WUfWymII",
    authDomain: "capacity-monitor.firebaseapp.com",
    projectId: "capacity-monitor",
    storageBucket: "capacity-monitor.firebasestorage.app",
    messagingSenderId: "455641716280",
    appId: "1:455641716280:web:5848888e290e47114c78cd",
    measurementId: "G-CGR5R0D1SP"
};

// Initialize Firebase
console.log('Initializing Firebase...');
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Make globally available
window.auth = auth;
window.db = db;
window.currentUser = null;

console.log('Firebase initialized successfully');
console.log('Auth object:', auth);
console.log('DB object:', db);

// Auth state listener
auth.onAuthStateChanged(user => {
    console.log('Auth state changed:', user ? user.email : 'No user');
    if (user) {
        console.log('User authenticated:', user.email);
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';
        document.getElementById('userEmail').textContent = user.email;
        window.currentUser = user;
        
        // Load user data from Firestore
        loadUserData();
    } else {
        console.log('No user authenticated');
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('appSection').style.display = 'none';
        window.currentUser = null;
    }
});

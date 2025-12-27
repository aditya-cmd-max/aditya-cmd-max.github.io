// auth.js - Updated version with complete authentication
class ReverbitAuth {
    constructor() {
        this.firebaseConfig = {
            apiKey: "AIzaSyDE0eix0uVHuUS5P5DbuPA-SZt6pD8ob8A",
            authDomain: "reverbit11.firebaseapp.com",
            projectId: "reverbit11",
            storageBucket: "reverbit11.firebasestorage.app",
            messagingSenderId: "607495314412",
            appId: "1:607495314412:web:8c098f88b0d3b4620f7ec9",
            measurementId: "G-DMWMRM1M47"
        };
        
        this.cloudinaryConfig = {
            cloudName: 'reverbit_unsigned11',
            uploadPreset: 'reverbit_unsigned11', // Fixed: Changed from 'unsigned' to match your code
            folder: 'reverbit/user',
            apiKey: '',
            apiSecret: ''
        };
        
        this.user = null;
        this.userProfile = null;
        this.initialized = false;
        this.profilePopup = null;
        this.avatarUploadInput = null;
        
        this.init = this.init.bind(this);
        this.signInWithGoogle = this.signInWithGoogle.bind(this);
        this.logout = this.logout.bind(this);
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
    }

    async init() {
        if (this.initialized) return;
        
        try {
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            this.storage = firebase.storage();
            
            // Load Google Sign-in script
            await this.loadGoogleSignIn();
            
            // Setup auth listener
            this.setupAuthListener();
            
            // Check existing session
            await this.checkExistingSession();
            
            // Inject styles
            this.injectStyles();
            
            this.initialized = true;
            console.log('ReverbitAuth initialized successfully');
        } catch (error) {
            console.error('Auth initialization error:', error);
        }
    }

    async loadGoogleSignIn() {
        return new Promise((resolve) => {
            if (document.querySelector('script[src*="accounts.google.com"]')) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    setupAuthListener() {
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('User signed in:', user.email);
                this.user = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                };
                
                await this.loadUserProfile();
                localStorage.setItem('reverbit_user', JSON.stringify(this.user));
                
                // Update UI
                this.updateUIForSignedInUser();
            } else {
                console.log('User signed out');
                this.user = null;
                this.userProfile = null;
                localStorage.removeItem('reverbit_user');
                this.updateUIForSignedOutUser();
            }
        });
    }

    updateUIForSignedInUser() {
        // Add profile avatar to desktop nav
        this.addProfileAvatar();
        
        // Update body class for CSS targeting
        document.body.classList.add('user-signed-in');
        document.body.classList.remove('user-signed-out');
        
        // Remove sign-in button
        const signInBtn = document.getElementById('signInButton');
        if (signInBtn) signInBtn.style.display = 'none';
        
        const mobileSignInLink = document.getElementById('mobileSignInLink');
        if (mobileSignInLink) mobileSignInLink.style.display = 'none';
    }

    updateUIForSignedOutUser() {
        // Remove profile avatar
        this.removeProfileAvatar();
        this.removeProfilePopup();
        
        // Update body class
        document.body.classList.add('user-signed-out');
        document.body.classList.remove('user-signed-in');
        
        // Show sign-in button
        const signInBtn = document.getElementById('signInButton');
        if (signInBtn) signInBtn.style.display = 'inline-flex';
        
        const mobileSignInLink = document.getElementById('mobileSignInLink');
        if (mobileSignInLink) mobileSignInLink.style.display = 'flex';
    }

    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            
            const result = await this.auth.signInWithPopup(provider);
            console.log('Google sign-in successful:', result.user.email);
            return result.user;
        } catch (error) {
            console.error('Google sign-in error:', error);
            throw error;
        }
    }

    async logout() {
        try {
            await this.auth.signOut();
            localStorage.removeItem('reverbit_user');
            
            // Redirect to sign-in page
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 1000);
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }

    addProfileAvatar() {
        // Check if already exists
        if (document.querySelector('.reverbit-profile-avatar.desktop')) {
            return;
        }
        
        // Find desktop nav
        const desktopNav = document.querySelector('.desktop-nav');
        if (!desktopNav) return;
        
        // Create avatar button
        const avatarBtn = document.createElement('button');
        avatarBtn.className = 'reverbit-profile-avatar desktop';
        avatarBtn.setAttribute('aria-label', 'Profile menu');
        avatarBtn.setAttribute('title', 'Profile menu');
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        avatarImg.src = this.user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user?.displayName || 'User')}&background=4285f4&color=fff`;
        avatarImg.alt = this.user?.displayName || 'Profile';
        avatarImg.onerror = () => {
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user?.displayName || 'User')}&background=4285f4&color=fff`;
        };
        
        avatarBtn.appendChild(avatarImg);
        
        // Add click handler
        avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleProfilePopup();
        });
        
        // Insert before theme toggle button
        const themeToggle = desktopNav.querySelector('.theme-toggle');
        if (themeToggle) {
            desktopNav.insertBefore(avatarBtn, themeToggle);
        } else {
            desktopNav.appendChild(avatarBtn);
        }
    }

    removeProfileAvatar() {
        const avatars = document.querySelectorAll('.reverbit-profile-avatar');
        avatars.forEach(avatar => {
            if (avatar.parentNode) {
                avatar.parentNode.removeChild(avatar);
            }
        });
    }

    async checkExistingSession() {
        try {
            const userData = localStorage.getItem('reverbit_user');
            
            if (userData) {
                this.user = JSON.parse(userData);
                await this.loadUserProfile();
                this.updateUIForSignedInUser();
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    async loadUserProfile() {
        if (!this.user) return;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
            } else {
                // Create new user profile
                this.userProfile = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: this.user.displayName || this.user.email?.split('@')[0] || 'User',
                    photoURL: this.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user.email?.split('@')[0] || 'User')}&background=4285f4&color=fff`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    theme: 'auto'
                };
                
                await userRef.set(this.userProfile);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    createProfilePopup() {
        // Remove existing popup
        if (this.profilePopup && this.profilePopup.parentNode) {
            this.profilePopup.parentNode.removeChild(this.profilePopup);
        }
        
        // Create popup
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup';
        this.profilePopup.style.display = 'none';
        this.profilePopup.innerHTML = this.getPopupHTML();
        
        document.body.appendChild(this.profilePopup);
        this.attachPopupEventListeners();
    }

    getPopupHTML() {
        if (!this.userProfile) return '';
        
        return `
            <div class="profile-popup-container">
                <div class="profile-header">
                    <div class="profile-avatar-large">
                        <img src="${this.userProfile.photoURL}" alt="${this.userProfile.displayName}">
                    </div>
                    <div class="profile-info">
                        <div class="profile-name">${this.userProfile.displayName}</div>
                        <div class="profile-email">${this.userProfile.email}</div>
                        <button class="change-avatar-btn" id="change-avatar-btn">
                            Change profile picture
                        </button>
                    </div>
                </div>
                
                <div class="profile-divider"></div>
                
                <div class="profile-menu">
                    <a href="https://aditya-cmd-max.github.io/dashboard" class="profile-menu-item">
                        <i class="fas fa-tachometer-alt profile-menu-icon"></i>
                        <span class="profile-menu-text">Dashboard</span>
                    </a>
                    
                    <button class="profile-menu-item" id="profile-signout">
                        <i class="fas fa-sign-out-alt profile-menu-icon"></i>
                        <span class="profile-menu-text">Sign out</span>
                    </button>
                </div>
            </div>
        `;
    }

    attachPopupEventListeners() {
        if (!this.profilePopup) return;
        
        // Sign out button
        const signoutBtn = this.profilePopup.querySelector('#profile-signout');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (this.profilePopup && this.profilePopup.style.display === 'block') {
                const isPopupClick = this.profilePopup.contains(e.target);
                const isAvatarClick = document.querySelector('.reverbit-profile-avatar')?.contains(e.target);
                
                if (!isPopupClick && !isAvatarClick) {
                    this.hideProfilePopup();
                }
            }
        }, true);
    }

    toggleProfilePopup() {
        if (!this.profilePopup) {
            this.createProfilePopup();
        }
        
        if (this.profilePopup.style.display === 'block') {
            this.hideProfilePopup();
        } else {
            this.showProfilePopup();
        }
    }

    showProfilePopup() {
        if (!this.profilePopup || !this.userProfile) return;
        
        // Position popup
        const avatar = document.querySelector('.reverbit-profile-avatar.desktop');
        if (avatar) {
            const rect = avatar.getBoundingClientRect();
            this.profilePopup.style.top = (rect.bottom + 8) + 'px';
            this.profilePopup.style.right = (window.innerWidth - rect.right) + 'px';
        }
        
        this.profilePopup.style.display = 'block';
        setTimeout(() => {
            this.profilePopup.classList.add('active');
        }, 10);
    }

    hideProfilePopup() {
        if (!this.profilePopup) return;
        
        this.profilePopup.classList.remove('active');
        setTimeout(() => {
            this.profilePopup.style.display = 'none';
        }, 200);
    }

    removeProfilePopup() {
        if (this.profilePopup && this.profilePopup.parentNode) {
            this.profilePopup.parentNode.removeChild(this.profilePopup);
            this.profilePopup = null;
        }
    }

    injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) return;
        
        const styles = `
            .reverbit-profile-avatar.desktop {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid transparent;
                padding: 2px;
                background: linear-gradient(135deg, #4285f4, #34a853) border-box;
                cursor: pointer;
                transition: all 0.2s ease;
                overflow: hidden;
                margin: 0 12px;
                position: relative;
                border: none;
                background: transparent;
            }
            
            .reverbit-profile-avatar.desktop img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .reverbit-profile-avatar.desktop:hover {
                transform: scale(1.1);
            }
            
            .reverbit-profile-popup {
                position: fixed;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                min-width: 280px;
                z-index: 9999;
                border: 1px solid #ddd;
                font-family: 'Segoe UI', Arial, sans-serif;
            }
            
            .profile-popup-container {
                padding: 20px;
            }
            
            .profile-header {
                display: flex;
                gap: 15px;
                margin-bottom: 15px;
            }
            
            .profile-avatar-large {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                overflow: hidden;
                border: 3px solid #f0f0f0;
            }
            
            .profile-avatar-large img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .profile-info {
                flex: 1;
            }
            
            .profile-name {
                font-weight: 600;
                font-size: 16px;
                margin-bottom: 4px;
            }
            
            .profile-email {
                color: #666;
                font-size: 14px;
                margin-bottom: 10px;
            }
            
            .change-avatar-btn {
                background: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 12px;
                cursor: pointer;
            }
            
            .profile-divider {
                height: 1px;
                background: #eee;
                margin: 15px 0;
            }
            
            .profile-menu-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px;
                width: 100%;
                text-align: left;
                background: none;
                border: none;
                cursor: pointer;
                border-radius: 6px;
                text-decoration: none;
                color: #333;
            }
            
            .profile-menu-item:hover {
                background: #f8f9fa;
            }
            
            .dark-theme .reverbit-profile-popup {
                background: #2d2d2d;
                border-color: #444;
                color: white;
            }
            
            .dark-theme .profile-email {
                color: #aaa;
            }
            
            .dark-theme .change-avatar-btn {
                background: #444;
                border-color: #666;
                color: white;
            }
            
            .dark-theme .profile-menu-item {
                color: white;
            }
            
            .dark-theme .profile-menu-item:hover {
                background: #444;
            }
            
            .dark-theme .profile-divider {
                background: #444;
            }
            
            /* Hide elements when signed out */
            body.user-signed-out .reverbit-profile-avatar {
                display: none !important;
            }
            
            /* Show sign-in button when signed out */
            body.user-signed-out #signInButton {
                display: inline-flex !important;
            }
            
            body.user-signed-out #mobileSignInLink {
                display: flex !important;
            }
            
            /* Hide sign-in button when signed in */
            body.user-signed-in #signInButton {
                display: none !important;
            }
            
            body.user-signed-in #mobileSignInLink {
                display: none !important;
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    async uploadProfilePicture(file) {
        if (!file) return;
        
        try {
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            formData.append('cloud_name', this.cloudinaryConfig.cloudName);
            
            // Upload to Cloudinary
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/upload`,
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            if (!response.ok) throw new Error('Upload failed');
            
            const result = await response.json();
            
            // Update user profile
            if (this.user) {
                const userRef = this.db.collection('users').doc(this.user.uid);
                await userRef.update({
                    photoURL: result.secure_url,
                    updatedAt: new Date().toISOString()
                });
                
                // Update auth profile
                await this.auth.currentUser.updateProfile({
                    photoURL: result.secure_url
                });
                
                // Update local data
                this.user.photoURL = result.secure_url;
                this.userProfile.photoURL = result.secure_url;
                
                // Update avatar image
                const avatarImg = document.querySelector('.reverbit-avatar-img');
                if (avatarImg) {
                    avatarImg.src = result.secure_url;
                }
                
                // Refresh popup
                if (this.profilePopup) {
                    this.profilePopup.innerHTML = this.getPopupHTML();
                    this.attachPopupEventListeners();
                }
            }
            
            return result.secure_url;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }
}

// Create global instance
window.ReverbitAuth = new ReverbitAuth();

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    window.ReverbitAuth.init();
});

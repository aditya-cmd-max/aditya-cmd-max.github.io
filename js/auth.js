// auth.js - Fixed with working popup
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
        
        this.user = null;
        this.userProfile = null;
        this.initialized = false;
        this.profilePopup = null;
        this.profileAvatar = null;
        
        // Bind methods
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.closeProfilePopupOnClick = this.closeProfilePopupOnClick.bind(this);
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
            
            // Check for existing session
            await this.checkSession();
            this.initialized = true;
        } catch (error) {
            console.error('Auth initialization error:', error);
        }
    }

    async checkSession() {
        try {
            // Check localStorage first
            const userData = localStorage.getItem('reverbit_user');
            
            if (userData) {
                this.user = JSON.parse(userData);
                await this.loadUserProfile();
                return this.user;
            }
            
            // Check Firebase auth state
            return new Promise((resolve) => {
                this.auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        this.user = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL
                        };
                        
                        await this.loadUserProfile();
                        localStorage.setItem('reverbit_user', JSON.stringify(this.user));
                        
                        // Add profile avatar to navbar
                        this.addProfileAvatar();
                        
                        resolve(this.user);
                    } else {
                        resolve(null);
                    }
                });
            });
        } catch (error) {
            console.error('Session check error:', error);
            return null;
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
                // Create user profile if it doesn't exist
                this.userProfile = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: this.user.displayName || this.user.email?.split('@')[0] || 'User',
                    photoURL: this.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user.email?.split('@')[0] || 'User')}&background=1a73e8&color=fff`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    theme: 'default',
                    preferences: {}
                };
                
                await userRef.set(this.userProfile);
            }
            
            // Update profile avatar after loading profile
            this.updateProfileAvatar();
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    addProfileAvatar() {
        // Check if profile avatar already exists
        if (document.querySelector('.reverbit-profile-avatar')) {
            this.profileAvatar = document.querySelector('.reverbit-profile-avatar');
            return;
        }
        
        // Find header actions container
        let headerActions = document.querySelector('.header-actions');
        
        // If header actions doesn't exist, create it
        if (!headerActions) {
            const header = document.querySelector('.app-header');
            if (!header) {
                // Try to find any header
                header = document.querySelector('header, .header, nav, .navbar');
                if (!header) {
                    console.warn('No header found for profile avatar');
                    return;
                }
            }
            
            headerActions = document.createElement('div');
            headerActions.className = 'header-actions';
            header.appendChild(headerActions);
        }
        
        // Create profile avatar
        this.profileAvatar = document.createElement('button');
        this.profileAvatar.className = 'reverbit-profile-avatar';
        this.profileAvatar.innerHTML = `
            <img src="" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;">
        `;
        
        // Add click event
        this.profileAvatar.addEventListener('click', this.toggleProfilePopup);
        
        // Insert profile avatar at the beginning of header actions
        headerActions.insertBefore(this.profileAvatar, headerActions.firstChild);
        
        // Add CSS styles if not already added
        this.addStyles();
        
        // Update avatar image
        this.updateProfileAvatar();
    }

    updateProfileAvatar() {
        if (!this.profileAvatar || !this.userProfile) return;
        
        const img = this.profileAvatar.querySelector('img');
        if (img) {
            img.src = this.userProfile.photoURL || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userProfile.displayName || 'User')}&background=1a73e8&color=fff`;
            img.alt = this.userProfile.displayName || 'Profile';
        }
    }

    createProfilePopup() {
        // Remove existing popup if any
        if (this.profilePopup && this.profilePopup.parentNode) {
            this.profilePopup.parentNode.removeChild(this.profilePopup);
        }
        
        // Create profile popup element
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup';
        
        // Render popup content
        this.renderPopupContent();
        
        // Add to body
        document.body.appendChild(this.profilePopup);
        
        // Add event listeners to buttons
        setTimeout(() => {
            const editBtn = this.profilePopup.querySelector('#profile-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    window.location.href = 'https://aditya-cmd-max.github.io/dashboard';
                });
            }
            
            const logoutBtn = this.profilePopup.querySelector('#profile-logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    this.logout();
                });
            }
        }, 100);
    }

    renderPopupContent() {
        if (!this.userProfile || !this.profilePopup) return;
        
        const isDarkTheme = document.body.classList.contains('dark-theme');
        const themeClass = isDarkTheme ? 'dark-theme' : '';
        
        this.profilePopup.innerHTML = `
            <div class="profile-header ${themeClass}">
                <img src="${this.userProfile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userProfile.displayName || 'User')}&background=1a73e8&color=fff`}" 
                     alt="Profile" 
                     class="profile-picture">
                <div class="profile-info">
                    <div class="profile-name">${this.userProfile.displayName || 'User'}</div>
                    <div class="profile-email">${this.userProfile.email || ''}</div>
                </div>
                <button id="profile-edit-btn" class="profile-edit-btn" title="Edit Profile">
                    <span class="material-icons-round">edit</span>
                </button>
            </div>
            
            <div class="profile-menu ${themeClass}">
                <button class="profile-menu-item" id="profile-dashboard-btn">
                    <span class="material-icons-round">dashboard</span>
                    <span>Dashboard</span>
                </button>
                
                <button class="profile-menu-item logout" id="profile-logout-btn">
                    <span class="material-icons-round">logout</span>
                    <span>Logout</span>
                </button>
            </div>
        `;
    }

    toggleProfilePopup(event) {
        if (event) {
            event.stopPropagation();
        }
        
        // Create popup if it doesn't exist
        if (!this.profilePopup || !this.profilePopup.parentNode) {
            this.createProfilePopup();
        }
        
        const isVisible = this.profilePopup.style.display === 'block';
        
        // Close all other popups
        document.querySelectorAll('.reverbit-profile-popup').forEach(popup => {
            popup.style.display = 'none';
        });
        
        if (!isVisible) {
            // Update content before showing
            this.renderPopupContent();
            
            // Position the popup
            this.positionPopup();
            
            // Show popup
            this.profilePopup.style.display = 'block';
            
            // Add click listener to close when clicking outside
            setTimeout(() => {
                document.addEventListener('click', this.closeProfilePopupOnClick);
            }, 10);
        } else {
            this.profilePopup.style.display = 'none';
            document.removeEventListener('click', this.closeProfilePopupOnClick);
        }
    }

    positionPopup() {
        if (!this.profileAvatar || !this.profilePopup) return;
        
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        const popupWidth = 280;
        const popupHeight = 180;
        
        // Calculate position
        let left = avatarRect.right - popupWidth;
        let top = avatarRect.bottom + 10;
        
        // Ensure popup stays within viewport
        if (left < 10) left = 10;
        if (left + popupWidth > window.innerWidth) {
            left = window.innerWidth - popupWidth - 10;
        }
        
        if (top + popupHeight > window.innerHeight) {
            top = avatarRect.top - popupHeight - 10;
        }
        
        this.profilePopup.style.position = 'fixed';
        this.profilePopup.style.left = left + 'px';
        this.profilePopup.style.top = top + 'px';
        this.profilePopup.style.zIndex = '9999';
    }

    closeProfilePopupOnClick(event) {
        if (!this.profilePopup) return;
        
        const isAvatarClick = this.profileAvatar && 
                             (event.target === this.profileAvatar || 
                              this.profileAvatar.contains(event.target));
        
        const isPopupClick = this.profilePopup && 
                            (event.target === this.profilePopup || 
                             this.profilePopup.contains(event.target));
        
        if (!isAvatarClick && !isPopupClick) {
            this.profilePopup.style.display = 'none';
            document.removeEventListener('click', this.closeProfilePopupOnClick);
        }
    }

    addStyles() {
        // Check if styles already exist
        if (document.getElementById('reverbit-auth-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'reverbit-auth-styles';
        style.textContent = `
            /* Reverbit Profile Avatar */
            .reverbit-profile-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                overflow: hidden;
                border: 2px solid var(--md-primary, #1a73e8);
                cursor: pointer;
                background: none;
                padding: 0;
                margin: 0 8px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .reverbit-profile-avatar:hover {
                transform: scale(1.1);
                box-shadow: 0 2px 8px rgba(var(--md-primary-rgb, 26, 115, 232), 0.3);
            }
            
            .reverbit-profile-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            /* Reverbit Profile Popup */
            .reverbit-profile-popup {
                display: none;
                position: fixed;
                background: var(--md-surface, #ffffff);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                border: 1px solid var(--md-outline, #e0e0e0);
                padding: 16px;
                width: 280px;
                min-height: 180px;
                z-index: 9999;
                backdrop-filter: blur(10px);
                animation: reverbitPopupSlide 0.2s ease;
            }
            
            @keyframes reverbitPopupSlide {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .reverbit-profile-popup .profile-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding-bottom: 12px;
                margin-bottom: 12px;
                border-bottom: 1px solid var(--md-outline, #e0e0e0);
            }
            
            .reverbit-profile-popup .profile-picture {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid var(--md-primary, #1a73e8);
            }
            
            .reverbit-profile-popup .profile-info {
                flex: 1;
                min-width: 0;
            }
            
            .reverbit-profile-popup .profile-name {
                font-weight: 600;
                font-size: 16px;
                color: var(--md-on-surface, #202124);
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .reverbit-profile-popup .profile-email {
                font-size: 14px;
                color: var(--md-on-surface-variant, #5f6368);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .reverbit-profile-popup .profile-edit-btn {
                background: none;
                border: none;
                color: var(--md-primary, #1a73e8);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            
            .reverbit-profile-popup .profile-edit-btn:hover {
                background: var(--md-surface-variant, #f8f9fa);
            }
            
            .reverbit-profile-popup .profile-menu {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .reverbit-profile-popup .profile-menu-item {
                display: flex;
                align-items: center;
                gap: 12px;
                background: none;
                border: none;
                padding: 10px 12px;
                border-radius: 8px;
                cursor: pointer;
                color: var(--md-on-surface, #202124);
                text-align: left;
                width: 100%;
                transition: background 0.2s ease;
                font-size: 14px;
            }
            
            .reverbit-profile-popup .profile-menu-item:hover {
                background: var(--md-surface-variant, #f8f9fa);
            }
            
            .reverbit-profile-popup .profile-menu-item .material-icons-round {
                font-size: 20px;
                color: var(--md-primary, #1a73e8);
            }
            
            .reverbit-profile-popup .profile-menu-item.logout {
                color: var(--md-error, #d93025);
            }
            
            .reverbit-profile-popup .profile-menu-item.logout .material-icons-round {
                color: var(--md-error, #d93025);
            }
            
            /* Dark theme adjustments */
            .dark-theme .reverbit-profile-popup {
                background: var(--md-surface, #202124);
                border-color: var(--md-outline, #3c4043);
            }
            
            .dark-theme .reverbit-profile-popup .profile-name {
                color: var(--md-on-surface, #ffffff);
            }
            
            .dark-theme .reverbit-profile-popup .profile-email {
                color: var(--md-on-surface-variant, #e8eaed);
            }
            
            .dark-theme .reverbit-profile-popup .profile-edit-btn:hover {
                background: var(--md-surface-variant, #303134);
            }
            
            .dark-theme .reverbit-profile-popup .profile-menu-item:hover {
                background: var(--md-surface-variant, #303134);
            }
            
            /* Responsive styles */
            @media (max-width: 768px) {
                .reverbit-profile-avatar {
                    width: 36px;
                    height: 36px;
                }
                
                .reverbit-profile-popup {
                    width: calc(100vw - 32px);
                    max-width: 320px;
                    left: 50% !important;
                    transform: translateX(-50%);
                    right: auto !important;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    async updateProfile(data) {
        if (!this.user || !this.userProfile) return false;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.set({
                ...data,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            // Update local profile
            this.userProfile = { ...this.userProfile, ...data };
            this.user = { ...this.user, ...data };
            localStorage.setItem('reverbit_user', JSON.stringify(this.user));
            
            // Update avatar and popup
            this.updateProfileAvatar();
            this.renderPopupContent();
            
            return true;
        } catch (error) {
            console.error('Error updating profile:', error);
            return false;
        }
    }

    async uploadProfilePicture(file) {
        if (!this.user) return null;
        
        try {
            // Create storage reference
            const storageRef = this.storage.ref();
            const profilePicRef = storageRef.child(`profile-pictures/${this.user.uid}/${Date.now()}_${file.name}`);
            
            // Upload file
            await profilePicRef.put(file);
            
            // Get download URL
            const downloadURL = await profilePicRef.getDownloadURL();
            
            // Update user profile with new photo URL
            await this.updateProfile({
                photoURL: downloadURL,
                profilePictureUpdatedAt: new Date().toISOString()
            });
            
            // Update auth user
            await this.auth.currentUser.updateProfile({
                photoURL: downloadURL
            });
            
            return downloadURL;
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            return null;
        }
    }

    isAuthenticated() {
        return this.user !== null;
    }

    getUser() {
        return this.user;
    }

    getUserProfile() {
        return this.userProfile;
    }

    async logout() {
        try {
            await this.auth.signOut();
            localStorage.removeItem('reverbit_user');
            this.user = null;
            this.userProfile = null;
            
            // Remove profile avatar
            if (this.profileAvatar && this.profileAvatar.parentNode) {
                this.profileAvatar.parentNode.removeChild(this.profileAvatar);
            }
            
            // Remove profile popup
            if (this.profilePopup && this.profilePopup.parentNode) {
                this.profilePopup.parentNode.removeChild(this.profilePopup);
            }
            
            // Remove event listeners
            document.removeEventListener('click', this.closeProfilePopupOnClick);
            
            // Redirect to home page or reload
            window.location.href = 'https://aditya-cmd-max.github.io/';
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }

    async trackUsage(appName, minutes = 1) {
        if (!this.user) return;
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const usageRef = this.db.collection('usage').doc(this.user.uid);
            
            await usageRef.set({
                [appName]: firebase.firestore.FieldValue.increment(minutes),
                lastUsed: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            // Update streak
            await this.updateStreak();
        } catch (error) {
            console.error('Usage tracking error:', error);
        }
    }

    async updateStreak() {
        if (!this.user) return;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                const lastActive = userData.lastActive ? new Date(userData.lastActive) : null;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                if (!lastActive || lastActive.getTime() < today.getTime() - 86400000) {
                    // Reset streak if missed a day
                    await userRef.set({
                        streak: 1,
                        lastActive: new Date().toISOString()
                    }, { merge: true });
                } else if (lastActive.getTime() < today.getTime()) {
                    // Increment streak
                    await userRef.set({
                        streak: (userData.streak || 0) + 1,
                        lastActive: new Date().toISOString()
                    }, { merge: true });
                }
            }
        } catch (error) {
            console.error('Streak update error:', error);
        }
    }
}

// Create global instance
window.ReverbitAuth = new ReverbitAuth();

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.ReverbitAuth.init();
        
        const user = window.ReverbitAuth.getUser();
        if (user) {
            console.log('User authenticated:', user.displayName || user.email);
            
            // Track usage for current app
            const appName = getCurrentAppName();
            if (appName) {
                // Initial tracking
                window.ReverbitAuth.trackUsage(appName, 1);
                
                // Track every 5 minutes
                setInterval(() => {
                    window.ReverbitAuth.trackUsage(appName, 5);
                }, 5 * 60 * 1000);
            }
        } else {
            console.log('No user authenticated');
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Helper function to get current app name
function getCurrentAppName() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const title = document.title;
    
    if (pathname.includes('cloverai') || title.includes('Clover AI')) return 'cloverAI';
    if (pathname.includes('mindscribe') || title.includes('MindScribe')) return 'mindscribe';
    if (pathname.includes('peo') || title.includes('Peo')) return 'peo';
    if (pathname.includes('reverbit') || title.includes('Reverbit')) return 'reverbit';
    
    return 'unknown';
}

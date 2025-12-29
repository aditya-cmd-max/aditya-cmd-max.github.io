// auth.js - Google-style Profile Popup with Cloudinary Integration
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
        
        // Cloudinary Configuration
        this.cloudinaryConfig = {
            cloudName: 'dgy9v2ctk',          
            uploadPreset: 'reverbit_unsigned11',
            folder: 'reverbit/user'
        };
        
        this.user = null;
        this.userProfile = null;
        this.initialized = false;
        this.profilePopup = null;
        this.profileAvatar = null;
        this.avatarUploadInput = null;
        
        // Theme management
        this.currentTheme = 'auto';
        this.isDarkMode = false;
        
        // Bind methods
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.uploadProfilePicture = this.uploadProfilePicture.bind(this);
        this.handleAvatarUpload = this.handleAvatarUpload.bind(this);
        this.applyTheme = this.applyTheme.bind(this);
        this.toggleTheme = this.toggleTheme.bind(this);
    }

    async init() {
        if (this.initialized) return;
        
        try {
            console.log('Auth: Initializing...');
            
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
                console.log('Auth: Firebase initialized');
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            this.storage = firebase.storage();
            
            // Initialize Cloudinary widget
            this.initCloudinaryWidget();
            
            // Listen for auth state changes
            this.setupAuthListener();
            
            // Check existing session
            await this.checkExistingSession();
            
            // Initialize theme system
            this.initThemeSystem();
            
            // Add styles to page
            this.injectStyles();
            
            this.initialized = true;
            console.log('Auth: Initialization complete');
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.showToast('Failed to initialize authentication', 'error');
        }
    }

    // Initialize theme system
    initThemeSystem() {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('reverbit_theme');
        
        // Check for system preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme) {
            this.currentTheme = savedTheme;
        } else if (this.userProfile && this.userProfile.theme) {
            this.currentTheme = this.userProfile.theme;
        } else {
            this.currentTheme = 'auto';
        }
        
        // Apply theme immediately
        this.applyTheme();
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.applyTheme();
            }
        });
        
        // Add theme toggle button to profile popup if not already present
        this.addThemeToggleToPopup();
    }

    // Apply theme based on current settings
    applyTheme() {
        let shouldBeDark = false;
        
        switch (this.currentTheme) {
            case 'dark':
                shouldBeDark = true;
                break;
            case 'light':
                shouldBeDark = false;
                break;
            case 'auto':
            default:
                shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                break;
        }
        
        this.isDarkMode = shouldBeDark;
        
        // Apply to document
        if (shouldBeDark) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
            document.documentElement.style.setProperty('color-scheme', 'dark');
        } else {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
            document.documentElement.style.setProperty('color-scheme', 'light');
        }
        
        // Store in localStorage for immediate access
        localStorage.setItem('reverbit_theme', this.currentTheme);
        
        console.log(`Auth: Theme applied - ${this.currentTheme} (dark mode: ${shouldBeDark})`);
    }

    // Toggle theme between light/dark/auto
    async toggleTheme(theme = null) {
        if (theme) {
            this.currentTheme = theme;
        } else {
            // Cycle through themes
            const themes = ['auto', 'light', 'dark'];
            const currentIndex = themes.indexOf(this.currentTheme);
            this.currentTheme = themes[(currentIndex + 1) % themes.length];
        }
        
        // Apply theme
        this.applyTheme();
        
        // Save to user profile if logged in
        if (this.user && this.db) {
            try {
                await this.db.collection('users').doc(this.user.uid).update({
                    theme: this.currentTheme,
                    updatedAt: new Date().toISOString()
                });
                
                // Update local profile
                if (this.userProfile) {
                    this.userProfile.theme = this.currentTheme;
                }
                
                this.showToast(`Theme set to ${this.currentTheme}`, 'success');
            } catch (error) {
                console.error('Error saving theme preference:', error);
            }
        }
        
        // Update theme toggle button if popup is open
        this.updateThemeToggleButton();
    }

    // Add theme toggle to profile popup
    addThemeToggleToPopup() {
        // This will be called when creating the popup
    }

    // Update theme toggle button in popup
    updateThemeToggleButton() {
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            const iconMap = {
                'auto': 'fas fa-adjust',
                'light': 'fas fa-sun',
                'dark': 'fas fa-moon'
            };
            
            themeBtn.innerHTML = `
                <span class="profile-menu-icon">
                    <i class="${iconMap[this.currentTheme]}"></i>
                </span>
                <span class="profile-menu-text">
                    ${this.currentTheme === 'auto' ? 'Auto Theme' : 
                      this.currentTheme === 'light' ? 'Light Theme' : 'Dark Theme'}
                </span>
            `;
        }
    }

    initCloudinaryWidget() {
        if (!window.cloudinary) {
            const script = document.createElement('script');
            script.src = 'https://upload-widget.cloudinary.com/global/all.js';
            script.async = true;
            document.head.appendChild(script);
        }
    }

    setupAuthListener() {
        this.auth.onAuthStateChanged(async (user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            
            if (user) {
                this.user = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                };
                
                console.log('Auth: Loading user profile for UID:', user.uid);
                
                await this.loadUserProfile();
                
                // Store in localStorage for persistence
                localStorage.setItem('reverbit_user', JSON.stringify(this.user));
                localStorage.setItem('reverbit_user_uid', user.uid);
                
                // Apply user's theme preference
                if (this.userProfile && this.userProfile.theme) {
                    this.currentTheme = this.userProfile.theme;
                    this.applyTheme();
                }
                
                // Add or update profile avatar
                this.addOrUpdateProfileAvatar();
                
                // Track login activity
                await this.trackLogin();
                
                console.log('Auth: User fully loaded:', this.user.email);
            } else {
                console.log('Auth: User signed out');
                this.user = null;
                this.userProfile = null;
                localStorage.removeItem('reverbit_user');
                localStorage.removeItem('reverbit_user_uid');
                
                // Remove UI elements
                this.removeProfileAvatar();
                this.removeProfilePopup();
                
                // Reset to auto theme when logged out
                this.currentTheme = 'auto';
                this.applyTheme();
            }
        });
    }

    async checkExistingSession() {
        try {
            const userData = localStorage.getItem('reverbit_user');
            const userUid = localStorage.getItem('reverbit_user_uid');
            const savedTheme = localStorage.getItem('reverbit_theme');
            
            // Apply saved theme first
            if (savedTheme) {
                this.currentTheme = savedTheme;
                this.applyTheme();
            }
            
            if (userData && userUid) {
                console.log('Auth: Found existing session for UID:', userUid);
                this.user = JSON.parse(userData);
                
                try {
                    const currentUser = this.auth.currentUser;
                    if (currentUser && currentUser.uid === userUid) {
                        console.log('Auth: Session is valid, loading profile...');
                        await this.loadUserProfile();
                        
                        // Apply user's theme from profile
                        if (this.userProfile && this.userProfile.theme) {
                            this.currentTheme = this.userProfile.theme;
                            this.applyTheme();
                        }
                        
                        this.addOrUpdateProfileAvatar();
                    } else {
                        console.log('Auth: Session expired, clearing local storage');
                        localStorage.clear();
                        this.user = null;
                        this.userProfile = null;
                    }
                } catch (sessionError) {
                    console.warn('Auth: Session check failed:', sessionError);
                }
            } else {
                console.log('Auth: No existing session found');
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    async loadUserProfile() {
        if (!this.user || !this.db) {
            console.error('Cannot load profile: No user or db');
            return;
        }
        
        try {
            console.log('Auth: Loading user profile for:', this.user.uid);
            const userRef = this.db.collection('users').doc(this.user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                this.userProfile.uid = this.user.uid;
                console.log('Auth: Loaded existing user profile for:', this.user.email);
                
                // Apply user's theme preference
                if (this.userProfile.theme) {
                    this.currentTheme = this.userProfile.theme;
                    this.applyTheme();
                }
                
            } else {
                // Create default profile for new user
                console.log('Auth: Creating new user profile for:', this.user.email);
                
                const displayName = this.user.displayName || 
                                  this.user.email?.split('@')[0] || 
                                  'User';
                
                // Clean username for internal use
                const cleanDisplayName = displayName.trim().toLowerCase();
                const username = cleanDisplayName.replace(/[^a-z0-9]/g, '_').substring(0, 20);
                
                // Get current theme preference
                const savedTheme = localStorage.getItem('reverbit_theme');
                const userTheme = savedTheme || 'auto';
                
                // Create profile data
                const timestamp = new Date().toISOString();
                const profileData = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: displayName,
                    isPublic: true,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    photoURL: this.user.photoURL || 
                             `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true`,
                    username: username,
                    theme: userTheme, // Save theme preference
                    bio: '',
                    country: '',
                    gender: '',
                    showApps: true,
                    streak: 0,
                    totalLogins: 1,
                    cloudinaryImageId: null,
                    lastLogin: timestamp,
                    lastActive: timestamp
                };
                
                console.log('Auth: Creating user document with theme:', userTheme);
                
                try {
                    await userRef.set(profileData);
                    console.log('Auth: New user profile created successfully');
                    
                    this.userProfile = profileData;
                    this.currentTheme = userTheme;
                    this.applyTheme();
                    
                    localStorage.setItem('reverbit_user_profile', JSON.stringify(profileData));
                    
                } catch (createError) {
                    console.error('Error creating user document:', createError);
                    throw createError;
                }
            }
            
            if (this.profileAvatar) {
                this.updateProfileAvatar();
            }
            
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            
        } catch (error) {
            console.error('Error loading user profile:', error);
            
            const storedProfile = localStorage.getItem('reverbit_user_profile');
            if (storedProfile) {
                this.userProfile = JSON.parse(storedProfile);
            } else {
                this.userProfile = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: this.user.displayName || 'User',
                    photoURL: this.user.photoURL || `https://ui-avatars.com/api/?name=User&background=4285f4&color=fff`,
                    isPublic: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    theme: this.currentTheme
                };
            }
        }
    }

    // ... [Previous methods: addOrUpdateProfileAvatar, handleAvatarUpload, uploadProfilePicture, updateProfileAvatar, removeProfileAvatar] ...

    createProfilePopup() {
        this.removeProfilePopup();
        
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup';
        this.profilePopup.style.display = 'none';
        
        this.profilePopup.innerHTML = this.getPopupHTML();
        
        document.body.appendChild(this.profilePopup);
        
        setTimeout(() => {
            this.attachPopupEventListeners();
        }, 10);
    }

    getPopupHTML() {
        if (!this.userProfile) {
            return '<div class="profile-popup-container"><p>Loading profile...</p></div>';
        }
        
        const displayName = this.userProfile.displayName || 'User';
        const email = this.userProfile.email || '';
        const photoURL = this.userProfile.photoURL;
        const profileUrl = `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
        
        // Theme icon based on current theme
        const themeIcon = this.currentTheme === 'auto' ? 'fas fa-adjust' : 
                         this.currentTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
        const themeText = this.currentTheme === 'auto' ? 'Auto Theme' : 
                         this.currentTheme === 'light' ? 'Light Theme' : 'Dark Theme';
        
        return `
            <div class="profile-popup-container">
                <div class="profile-header">
                    <div class="profile-avatar-large" id="profile-avatar-large">
                        <img src="${photoURL}" alt="${displayName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true'">
                        <button class="avatar-upload-btn" id="avatar-upload-btn" title="Upload new profile picture">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="profile-info">
                        <div class="profile-name">${displayName}</div>
                        <div class="profile-email">${email}</div>
                        <button class="change-avatar-btn" id="change-avatar-btn">
                            Change profile picture
                        </button>
                    </div>
                </div>
                
                <div class="profile-divider"></div>
                
                <div class="profile-menu">
                    <a href="https://aditya-cmd-max.github.io/dashboard" class="profile-menu-item" id="profile-dashboard">
                        <span class="profile-menu-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                            </svg>
                        </span>
                        <span class="profile-menu-text">Dashboard</span>
                    </a>
                    
                    <a href="${profileUrl}" target="_blank" class="profile-menu-item" id="profile-public">
                        <span class="profile-menu-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </span>
                        <span class="profile-menu-text">My Profile</span>
                    </a>
                    
                    <button class="profile-menu-item" id="theme-toggle-btn">
                        <span class="profile-menu-icon">
                            <i class="${themeIcon}"></i>
                        </span>
                        <span class="profile-menu-text">${themeText}</span>
                    </button>
                    
                    <button class="profile-menu-item" id="profile-signout">
                        <span class="profile-menu-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                            </svg>
                        </span>
                        <span class="profile-menu-text">Sign out</span>
                    </button>
                </div>
                
                <div class="profile-footer">
                    <div class="privacy-link">
                        <a href="https://aditya-cmd-max.github.io/reverbit/privacy" target="_blank">Privacy Policy</a>
                        •
                        <a href="https://aditya-cmd-max.github.io/reverbit/terms" target="_blank">Terms of Service</a>
                    </div>
                </div>
            </div>
        `;
    }

    attachPopupEventListeners() {
        if (!this.profilePopup) return;
        
        // Theme toggle button
        const themeBtn = this.profilePopup.querySelector('#theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleTheme();
            });
        }
        
        // Sign out button
        const signoutBtn = this.profilePopup.querySelector('#profile-signout');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
        
        // Avatar upload buttons
        const changeAvatarBtn = this.profilePopup.querySelector('#change-avatar-btn');
        const avatarUploadBtn = this.profilePopup.querySelector('#avatar-upload-btn');
        const profileAvatarLarge = this.profilePopup.querySelector('#profile-avatar-large');
        
        if (changeAvatarBtn) {
            changeAvatarBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleAvatarUpload();
            });
        }
        
        if (avatarUploadBtn) {
            avatarUploadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleAvatarUpload();
            });
        }
        
        if (profileAvatarLarge) {
            profileAvatarLarge.addEventListener('click', (e) => {
                if (e.target === profileAvatarLarge || e.target.tagName === 'IMG') {
                    this.handleAvatarUpload();
                }
            });
        }
        
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
    }

    injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) return;
        
        const styles = `
            /* Reverbit Google-style Profile System */
            .reverbit-profile-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 2px solid transparent;
                padding: 2px;
                background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335) border-box;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
                flex-shrink: 0;
                margin: 0 8px;
                position: relative;
            }
            
            .reverbit-profile-avatar:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                border-color: rgba(66, 133, 244, 0.3);
            }
            
            .reverbit-profile-avatar:active {
                transform: scale(0.95);
            }
            
            .reverbit-avatar-img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                display: block;
                background: #f5f5f5;
                transition: opacity 0.2s ease;
            }
            
            .reverbit-profile-avatar.uploading .reverbit-avatar-img {
                opacity: 0.7;
            }
            
            .reverbit-avatar-upload-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
            }
            
            .reverbit-profile-avatar:hover .reverbit-avatar-upload-overlay {
                opacity: 1;
            }
            
            .reverbit-avatar-upload-overlay svg {
                color: white;
                width: 16px;
                height: 16px;
            }
            
            /* Profile Popup */
            .reverbit-profile-popup {
                position: fixed;
                top: 0;
                right: 0;
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 8px 32px rgba(0, 0, 0, 0.08);
                min-width: 320px;
                max-width: 360px;
                z-index: 9999;
                overflow: hidden;
                opacity: 0;
                transform: translateY(-10px);
                transition: opacity 0.2s ease, transform 0.2s ease;
                border: 1px solid #dadce0;
                font-family: 'Google Sans', 'Roboto', 'Segoe UI', Arial, sans-serif;
            }
            
            .reverbit-profile-popup.active {
                opacity: 1;
                transform: translateY(0);
            }
            
            .profile-popup-container {
                padding: 20px;
            }
            
            .profile-header {
                display: flex;
                align-items: center;
                gap: 16px;
                padding-bottom: 16px;
            }
            
            .profile-avatar-large {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                overflow: hidden;
                flex-shrink: 0;
                border: 3px solid #f5f5f5;
                background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335);
                padding: 3px;
                position: relative;
                cursor: pointer;
            }
            
            .profile-avatar-large:hover::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 50%;
            }
            
            .profile-avatar-large img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                background: #ffffff;
            }
            
            .avatar-upload-btn {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #1a73e8;
                border: 2px solid white;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.2s ease, transform 0.2s ease;
                padding: 0;
            }
            
            .profile-avatar-large:hover .avatar-upload-btn {
                opacity: 1;
                transform: scale(1);
            }
            
            .avatar-upload-btn svg {
                width: 12px;
                height: 12px;
            }
            
            .profile-info {
                flex: 1;
                min-width: 0;
            }
            
            .profile-name {
                font-size: 16px;
                font-weight: 500;
                color: #202124;
                line-height: 1.5;
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .profile-email {
                font-size: 14px;
                color: #5f6368;
                line-height: 1.4;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 8px;
            }
            
            .change-avatar-btn {
                font-size: 12px;
                color: #1a73e8;
                background: none;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s ease;
                font-weight: 500;
            }
            
            .change-avatar-btn:hover {
                background-color: #e8f0fe;
            }
            
            .profile-divider {
                height: 1px;
                background: #e8eaed;
                margin: 16px -20px;
            }
            
            .profile-menu {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .profile-menu-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border-radius: 8px;
                text-decoration: none;
                color: #202124;
                font-size: 14px;
                font-weight: 400;
                cursor: pointer;
                transition: background-color 0.2s ease;
                border: none;
                background: none;
                width: 100%;
                text-align: left;
            }
            
            .profile-menu-item:hover {
                background-color: #f8f9fa;
            }
            
            .profile-menu-item:active {
                background-color: #f1f3f4;
            }
            
            .profile-menu-icon {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #5f6368;
                flex-shrink: 0;
            }
            
            .profile-menu-text {
                flex: 1;
            }
            
            .profile-footer {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid #e8eaed;
            }
            
            .privacy-link {
                font-size: 12px;
                color: #5f6368;
                text-align: center;
            }
            
            .privacy-link a {
                color: #1a73e8;
                text-decoration: none;
                padding: 0 4px;
            }
            
            .privacy-link a:hover {
                text-decoration: underline;
            }
            
            /* Toast Notifications */
            .reverbit-toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: #202124;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                font-size: 14px;
                font-weight: 500;
                z-index: 10000;
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                max-width: 90%;
                text-align: center;
                pointer-events: none;
            }
            
            .reverbit-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            
            .reverbit-toast-success {
                background: #34a853;
            }
            
            .reverbit-toast-error {
                background: #ea4335;
            }
            
            .reverbit-toast-info {
                background: #1a73e8;
            }
            
            /* Dark theme support - ENHANCED */
            .dark-theme .reverbit-profile-popup {
                background: #202124;
                border-color: #3c4043;
            }
            
            .dark-theme .profile-name {
                color: #e8eaed;
            }
            
            .dark-theme .profile-email {
                color: #9aa0a6;
            }
            
            .dark-theme .change-avatar-btn {
                color: #8ab4f8;
            }
            
            .dark-theme .change-avatar-btn:hover {
                background-color: #2d2e31;
            }
            
            .dark-theme .profile-divider {
                background: #3c4043;
            }
            
            .dark-theme .profile-menu-item {
                color: #e8eaed;
            }
            
            .dark-theme .profile-menu-item:hover {
                background-color: #2d2e31;
            }
            
            .dark-theme .profile-menu-item:active {
                background-color: #3c4043;
            }
            
            .dark-theme .profile-menu-icon {
                color: #9aa0a6;
            }
            
            .dark-theme .profile-footer {
                border-top-color: #3c4043;
            }
            
            .dark-theme .privacy-link {
                color: #9aa0a6;
            }
            
            .dark-theme .privacy-link a {
                color: #8ab4f8;
            }
            
            .dark-theme .profile-avatar-large {
                border-color: #303134;
            }
            
            .dark-theme .profile-avatar-large img {
                background: #303134;
            }
            
            .dark-theme .avatar-upload-btn {
                background: #8ab4f8;
                border-color: #202124;
            }
            
            /* Dark theme toast */
            .dark-theme .reverbit-toast {
                background: #303134;
                color: #e8eaed;
            }
            
            /* Global dark theme overrides */
            .dark-theme {
                color-scheme: dark;
            }
            
            .dark-theme body {
                background-color: #202124 !important;
                color: #e8eaed !important;
            }
            
            /* Responsive design */
            @media (max-width: 600px) {
                .reverbit-profile-popup {
                    position: fixed;
                    top: 50% !important;
                    left: 50% !important;
                    right: auto !important;
                    transform: translate(-50%, -50%) !important;
                    width: calc(100vw - 32px);
                    max-width: 360px;
                    max-height: calc(100vh - 32px);
                    overflow-y: auto;
                }
                
                .reverbit-profile-popup.active {
                    transform: translate(-50%, -50%) !important;
                }
            }
            
            /* Upload animation */
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .reverbit-profile-avatar.uploading::after {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border: 2px solid transparent;
                border-top-color: #4285f4;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                pointer-events: none;
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    // ... [Rest of the methods remain the same with theme integration] ...

    async logout() {
        try {
            await this.auth.signOut();
            localStorage.removeItem('reverbit_user');
            localStorage.removeItem('reverbit_user_uid');
            localStorage.removeItem('reverbit_user_profile');
            
            this.removeProfileAvatar();
            this.removeProfilePopup();
            
            // Reset theme to auto on logout
            this.currentTheme = 'auto';
            this.applyTheme();
            
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 300);
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Error signing out', 'error');
            return false;
        }
    }

    // ... [Other methods remain the same] ...

    // Add global theme control functions
    getCurrentTheme() {
        return this.currentTheme;
    }

    isDarkModeActive() {
        return this.isDarkMode;
    }
}

// Create global instance
window.ReverbitAuth = new ReverbitAuth();

// Add global theme control functions
window.toggleTheme = function(theme) {
    window.ReverbitAuth.toggleTheme(theme);
};

window.getCurrentTheme = function() {
    return window.ReverbitAuth.getCurrentTheme();
};

window.isDarkModeActive = function() {
    return window.ReverbitAuth.isDarkModeActive();
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Page loaded, initializing auth and theme...');
        
        // Apply basic theme immediately to prevent flash
        const savedTheme = localStorage.getItem('reverbit_theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (savedTheme === 'auto' && systemPrefersDark)) {
            document.body.classList.add('dark-theme');
            document.documentElement.style.setProperty('color-scheme', 'dark');
        } else {
            document.body.classList.add('light-theme');
            document.documentElement.style.setProperty('color-scheme', 'light');
        }
        
        await window.ReverbitAuth.init();
        
        const user = window.ReverbitAuth.getUser();
        if (user) {
            const appName = getCurrentAppName();
            if (appName) {
                window.ReverbitAuth.trackUsage(appName, 1);
                
                setInterval(() => {
                    window.ReverbitAuth.trackUsage(appName, 5);
                }, 5 * 60 * 1000);
            }
        }
    } catch (error) {
        console.error('Auth initialization failed:', error);
    }
});

function getCurrentAppName() {
    const pathname = window.location.pathname;
    const title = document.title.toLowerCase();
    
    if (pathname.includes('cloverai') || title.includes('clover')) return 'cloverAI';
    if (pathname.includes('mindscribe') || title.includes('mindscribe')) return 'mindscribe';
    if (pathname.includes('peo') || title.includes('peo')) return 'peo';
    if (pathname.includes('reverbit') || title.includes('reverbit')) return 'reverbit';
    
    return 'other';
}

// Global theme change listener
window.addEventListener('storage', (e) => {
    if (e.key === 'reverbit_theme') {
        window.ReverbitAuth.currentTheme = e.newValue || 'auto';
        window.ReverbitAuth.applyTheme();
    }
});

console.log('Reverbit Auth loaded with enhanced theme support');

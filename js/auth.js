// auth.js - Enhanced Google-style Profile Popup with Mobile Support
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
        this.mobileProfileAvatar = null;
        this.avatarUploadInput = null;
        
        // Bind methods
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.uploadProfilePicture = this.uploadProfilePicture.bind(this);
        this.handleAvatarUpload = this.handleAvatarUpload.bind(this);
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
            
            // Initialize Cloudinary widget
            this.initCloudinaryWidget();
            
            // Listen for auth state changes
            this.setupAuthListener();
            
            // Check existing session
            await this.checkExistingSession();
            
            // Add styles to page
            this.injectStyles();
            
            this.initialized = true;
        } catch (error) {
            console.error('Auth initialization error:', error);
        }
    }

    initCloudinaryWidget() {
        // Load Cloudinary widget script if not already loaded
        if (!window.cloudinary) {
            const script = document.createElement('script');
            script.src = 'https://upload-widget.cloudinary.com/global/all.js';
            script.async = true;
            document.head.appendChild(script);
        }
    }

    setupAuthListener() {
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
                
                // Add or update profile avatars for both desktop and mobile
                this.addOrUpdateProfileAvatars();
                
                // Track login activity
                await this.trackLogin();
            } else {
                this.user = null;
                this.userProfile = null;
                localStorage.removeItem('reverbit_user');
                
                // Remove UI elements
                this.removeProfileAvatars();
                this.removeProfilePopup();
            }
        });
    }

    async checkExistingSession() {
        try {
            const userData = localStorage.getItem('reverbit_user');
            
            if (userData) {
                this.user = JSON.parse(userData);
                await this.loadUserProfile();
                this.addOrUpdateProfileAvatars();
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    async loadUserProfile() {
        if (!this.user || !this.db) return;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                console.log('Loaded existing user profile');
                
            } else {
                // Create default profile for new user
                console.log('Creating new user profile...');
                const displayName = this.user.displayName || 
                                  this.user.email?.split('@')[0] || 
                                  'User';
                
                // Generate a simple username
                const username = this.generateSimpleUsername(displayName, this.user.email);
                
                this.userProfile = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: displayName,
                    username: username,
                    photoURL: this.user.photoURL || 
                             `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff`,
                    isPublic: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    theme: 'auto',
                    preferences: {},
                    cloudinaryImageId: null,
                    bio: '',
                    country: '',
                    gender: '',
                    showApps: true,
                    streak: 0,
                    lastActive: new Date().toISOString()
                };
                
                await userRef.set(this.userProfile);
                console.log('New user profile created with username:', username);
            }
            
            // Update avatars if they exist
            this.updateProfileAvatars();
            
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    addOrUpdateProfileAvatars() {
        // Desktop avatar
        this.addOrUpdateDesktopAvatar();
        
        // Mobile avatar
        this.addOrUpdateMobileAvatar();
    }

    addOrUpdateDesktopAvatar() {
        const desktopNav = document.querySelector('.desktop-nav');
        if (!desktopNav) return;
        
        // Remove existing avatar if present
        const existingDesktopAvatar = document.getElementById('desktopProfileAvatar');
        if (existingDesktopAvatar) {
            existingDesktopAvatar.remove();
        }
        
        // Create container for desktop avatar
        const desktopAvatarContainer = document.createElement('div');
        desktopAvatarContainer.id = 'desktopProfileAvatar';
        desktopAvatarContainer.className = 'reverbit-profile-avatar-container';
        
        // Create the avatar button
        this.profileAvatar = this.createAvatarButton();
        desktopAvatarContainer.appendChild(this.profileAvatar);
        
        // Insert into desktop nav before theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            desktopNav.insertBefore(desktopAvatarContainer, themeToggle);
        } else {
            desktopNav.appendChild(desktopAvatarContainer);
        }
        
        // Update avatar image
        this.updateAvatarImage(this.profileAvatar);
    }

    addOrUpdateMobileAvatar() {
        // Check if we're on mobile (or should always show mobile avatar)
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        if (!mobileMenuBtn) return;
        
        // Find or create mobile avatar container
        let mobileAvatarContainer = document.getElementById('mobileProfileAvatarContainer');
        
        if (!mobileAvatarContainer) {
            mobileAvatarContainer = document.createElement('div');
            mobileAvatarContainer.id = 'mobileProfileAvatarContainer';
            mobileAvatarContainer.className = 'reverbit-mobile-avatar-container';
            
            // Insert into navbar (right side of hamburger)
            const floatingNavbar = document.querySelector('.floating-navbar');
            if (floatingNavbar) {
                floatingNavbar.appendChild(mobileAvatarContainer);
            }
        } else {
            // Clear existing content
            mobileAvatarContainer.innerHTML = '';
        }
        
        // Create the mobile avatar button (identical to desktop)
        this.mobileProfileAvatar = this.createAvatarButton();
        this.mobileProfileAvatar.className += ' mobile-visible';
        mobileAvatarContainer.appendChild(this.mobileProfileAvatar);
        
        // Update avatar image
        this.updateAvatarImage(this.mobileProfileAvatar);
    }

    createAvatarButton() {
        const avatarButton = document.createElement('button');
        avatarButton.className = 'reverbit-profile-avatar';
        avatarButton.setAttribute('aria-label', 'User profile menu');
        avatarButton.setAttribute('title', 'Profile menu');
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        avatarButton.appendChild(avatarImg);
        
        // Add click handler for popup
        avatarButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleProfilePopup();
        });
        
        // Add double click handler for quick upload
        avatarButton.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.handleAvatarUpload();
        });
        
        return avatarButton;
    }

    updateProfileAvatars() {
        if (this.profileAvatar) {
            this.updateAvatarImage(this.profileAvatar);
        }
        if (this.mobileProfileAvatar) {
            this.updateAvatarImage(this.mobileProfileAvatar);
        }
    }

    updateAvatarImage(avatarElement) {
        if (!avatarElement || !this.userProfile) return;
        
        const avatarImg = avatarElement.querySelector('.reverbit-avatar-img');
        if (avatarImg) {
            const photoURL = this.userProfile.photoURL || 
                           `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userProfile.displayName || 'User')}&background=4285f4&color=fff`;
            
            avatarImg.src = photoURL + (photoURL.includes('?') ? '&' : '?') + 't=' + Date.now();
            avatarImg.alt = this.userProfile.displayName || 'Profile';
            avatarImg.onerror = function() {
                const displayName = this.userProfile?.displayName || 'User';
                const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4285f4&color=fff`;
            }.bind(this);
        }
    }

    removeProfileAvatars() {
        // Remove desktop avatar
        const desktopAvatarContainer = document.getElementById('desktopProfileAvatar');
        if (desktopAvatarContainer) {
            desktopAvatarContainer.remove();
        }
        this.profileAvatar = null;
        
        // Remove mobile avatar container
        const mobileAvatarContainer = document.getElementById('mobileProfileAvatarContainer');
        if (mobileAvatarContainer) {
            mobileAvatarContainer.remove();
        }
        this.mobileProfileAvatar = null;
        
        // Remove file input
        if (this.avatarUploadInput && this.avatarUploadInput.parentNode) {
            this.avatarUploadInput.parentNode.removeChild(this.avatarUploadInput);
            this.avatarUploadInput = null;
        }
    }

    // ... (rest of the methods: uploadProfilePicture, createProfilePopup, getPopupHTML, 
    // attachPopupEventListeners, toggleProfilePopup, showProfilePopup, hideProfilePopup, 
    // handleClickOutside, removeProfilePopup, showToast, logout, etc. 
    // These remain exactly the same as in the previous version)
    // Only the getPopupHTML method needs to be the enhanced version with animated gradient

    getPopupHTML() {
        if (!this.userProfile) return '';
        
        const displayName = this.userProfile.displayName || 'User';
        const email = this.userProfile.email || '';
        const photoURL = this.userProfile.photoURL;
        const username = this.userProfile.username || this.generateSimpleUsername(displayName, email);
        const profileUrl = `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
        
        // Create greeting
        const greeting = this.getGreeting();
        
        return `
            <div class="profile-popup-container">
                <div class="profile-header">
                    <div class="profile-info">
                        <div class="profile-greeting">${greeting}</div>
                        <div class="profile-name">
                            <span class="animated-gradient-text">${displayName}</span>
                            <span class="profile-exclamation">!</span>
                        </div>
                        <div class="profile-email">${email}</div>
                    </div>
                    <div class="profile-avatar-large" id="profile-avatar-large">
                        <img src="${photoURL}" alt="${displayName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff'">
                        <button class="avatar-upload-btn" id="avatar-upload-btn" title="Upload new profile picture">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="profile-divider"></div>
                
                <div class="profile-menu">
                    <a href="https://aditya-cmd-max.github.io/dashboard" class="profile-menu-item" id="profile-dashboard">
                        <span class="profile-menu-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </span>
                        <span class="profile-menu-text">Manage your Reverbit Account</span>
                    </a>
                    
                    <a href="${profileUrl}" target="_blank" class="profile-menu-item" id="profile-public">
                        <span class="profile-menu-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM7.07 18.28c.43-.9 3.05-1.78 4.93-1.78s4.51.88 4.93 1.78C15.57 19.36 13.86 20 12 20s-3.57-.64-4.93-1.72zm11.29-1.45c-1.43-1.74-4.9-2.33-6.36-2.33s-4.93.59-6.36 2.33C4.62 15.49 4 13.82 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8c0 1.82-.62 3.49-1.64 4.83zM12 6c-1.94 0-3.5 1.56-3.5 3.5S10.06 13 12 13s3.5-1.56 3.5-3.5S13.94 6 12 6zm0 5c-.83 0-1.5-.67-1.5-1.5S11.17 8 12 8s1.5.67 1.5 1.5S12.83 11 12 11z"/>
                            </svg>
                        </span>
                        <span class="profile-menu-text">View Profile</span>
                    </a>
                    
                    <div class="profile-divider"></div>
                    
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

    injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) return;
        
        const styles = `
            /* Enhanced Google-style Profile System */
            .reverbit-profile-avatar {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: 2px solid transparent;
                padding: 2px;
                background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335) border-box;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
                flex-shrink: 0;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .reverbit-profile-avatar:hover {
                transform: scale(1.15);
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                border-color: rgba(66, 133, 244, 0.5);
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
                transition: opacity 0.3s ease;
            }
            
            /* Enhanced Profile Popup */
            .reverbit-profile-popup {
                position: fixed;
                top: 0;
                right: 0;
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.1);
                min-width: 400px;
                max-width: 440px;
                z-index: 10001;
                overflow: hidden;
                opacity: 0;
                transform: translateY(-20px) scale(0.95);
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                            transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid #e0e0e0;
                font-family: 'Google Sans', 'Roboto', 'Segoe UI', Arial, sans-serif;
            }
            
            .reverbit-profile-popup.active {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            
            .profile-popup-container {
                padding: 32px;
            }
            
            .profile-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 24px;
                padding-bottom: 28px;
                position: relative;
            }
            
            .profile-info {
                flex: 1;
                min-width: 0;
            }
            
            .profile-greeting {
                font-size: 20px;
                color: #5f6368;
                margin-bottom: 12px;
                font-weight: 400;
                letter-spacing: 0.2px;
            }
            
            .profile-name {
                font-size: 32px;
                font-weight: 500;
                color: #202124;
                line-height: 1.2;
                margin-bottom: 8px;
                display: flex;
                align-items: baseline;
                gap: 6px;
            }
            
            .animated-gradient-text {
                background: linear-gradient(90deg, #4285f4, #34a853, #fbbc05, #ea4335, #4285f4);
                background-size: 400% 400%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: gradientMove 8s ease infinite;
                font-weight: 600;
            }
            
            @keyframes gradientMove {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            .profile-exclamation {
                font-size: 32px;
                color: #4285f4;
                font-weight: 600;
            }
            
            .profile-email {
                font-size: 16px;
                color: #5f6368;
                line-height: 1.4;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .profile-avatar-large {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                overflow: hidden;
                border: 3px solid #4285f4;
                position: relative;
                cursor: pointer;
                flex-shrink: 0;
                background: #ffffff;
                transition: all 0.3s ease;
            }
            
            .profile-avatar-large:hover {
                transform: scale(1.1);
                box-shadow: 0 8px 24px rgba(66, 133, 244, 0.3);
            }
            
            .profile-avatar-large img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .avatar-upload-btn {
                position: absolute;
                bottom: -6px;
                right: -6px;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: #4285f4;
                border: 3px solid #ffffff;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.3s ease, transform 0.3s ease;
                padding: 0;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            .profile-avatar-large:hover .avatar-upload-btn {
                opacity: 1;
                transform: scale(1.1);
            }
            
            .avatar-upload-btn svg {
                width: 18px;
                height: 18px;
            }
            
            .profile-divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
                margin: 24px 0;
            }
            
            .profile-menu {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            
            .profile-menu-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px 20px;
                border-radius: 12px;
                text-decoration: none;
                color: #202124;
                font-size: 16px;
                font-weight: 400;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                border: none;
                background: none;
                width: 100%;
                text-align: left;
                position: relative;
                overflow: hidden;
            }
            
            .profile-menu-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(66, 133, 244, 0.1), transparent);
                transform: translateX(-100%);
                transition: transform 0.3s ease;
            }
            
            .profile-menu-item:hover::before {
                transform: translateX(100%);
            }
            
            .profile-menu-item:hover {
                background-color: #f8f9fa;
                transform: translateX(4px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .profile-menu-item:active {
                background-color: #f1f3f4;
                transform: translateX(2px);
            }
            
            .profile-menu-icon {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #5f6368;
                flex-shrink: 0;
                transition: color 0.3s ease;
            }
            
            .profile-menu-item:hover .profile-menu-icon {
                color: #4285f4;
            }
            
            .profile-menu-text {
                flex: 1;
                font-weight: 500;
            }
            
            .profile-footer {
                margin-top: 24px;
                padding-top: 24px;
                border-top: 1px solid #e0e0e0;
            }
            
            .privacy-link {
                font-size: 14px;
                color: #5f6368;
                text-align: center;
                display: flex;
                justify-content: center;
                gap: 16px;
                align-items: center;
            }
            
            .privacy-link a {
                color: #4285f4;
                text-decoration: none;
                font-weight: 500;
                transition: all 0.3s ease;
                padding: 6px 12px;
                border-radius: 8px;
            }
            
            .privacy-link a:hover {
                background: #e8f0fe;
                color: #1a73e8;
                text-decoration: none;
            }
            
            /* Mobile Avatar Container */
            .reverbit-mobile-avatar-container {
                display: flex;
                align-items: center;
                margin-left: auto;
                margin-right: 12px;
            }
            
            /* Hide mobile avatar on desktop, show on mobile */
            .reverbit-profile-avatar.mobile-visible {
                display: none;
            }
            
            /* Show mobile avatar and hide desktop avatar on mobile */
            @media (max-width: 1024px) {
                .reverbit-profile-avatar-container {
                    display: none !important;
                }
                
                .reverbit-profile-avatar.mobile-visible {
                    display: flex !important;
                }
                
                .reverbit-mobile-avatar-container {
                    order: 2;
                    margin-left: auto;
                    margin-right: 12px;
                }
                
                .mobile-menu-btn {
                    order: 3;
                }
                
                /* Mobile popup adjustments */
                .reverbit-profile-popup {
                    position: fixed;
                    top: 50% !important;
                    left: 50% !important;
                    right: auto !important;
                    bottom: auto !important;
                    transform: translate(-50%, -50%) scale(0.95) !important;
                    width: calc(100vw - 40px);
                    max-width: 420px;
                    max-height: calc(100vh - 40px);
                    overflow-y: auto;
                }
                
                .reverbit-profile-popup.active {
                    transform: translate(-50%, -50%) scale(1) !important;
                }
                
                .profile-popup-container {
                    padding: 24px;
                }
                
                .profile-header {
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    gap: 20px;
                }
                
                .profile-name {
                    font-size: 28px;
                }
                
                .profile-exclamation {
                    font-size: 28px;
                }
                
                .profile-avatar-large {
                    width: 72px;
                    height: 72px;
                }
            }
            
            @media (max-width: 480px) {
                .profile-name {
                    font-size: 24px;
                }
                
                .profile-exclamation {
                    font-size: 24px;
                }
                
                .profile-greeting {
                    font-size: 18px;
                }
                
                .profile-popup-container {
                    padding: 20px;
                }
            }
            
            /* Dark theme support */
            @media (prefers-color-scheme: dark) {
                .reverbit-profile-popup {
                    background: #202124;
                    border-color: #3c4043;
                    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
                }
                
                .profile-greeting,
                .profile-email {
                    color: #9aa0a6;
                }
                
                .profile-name {
                    color: #e8eaed;
                }
                
                .profile-divider {
                    background: linear-gradient(90deg, transparent, #3c4043, transparent);
                }
                
                .profile-menu-item {
                    color: #e8eaed;
                }
                
                .profile-menu-item:hover {
                    background-color: #2d2e31;
                }
                
                .profile-menu-item:active {
                    background-color: #3c4043;
                }
                
                .profile-menu-icon {
                    color: #9aa0a6;
                }
                
                .profile-avatar-large {
                    border-color: #4285f4;
                    background: #2d2e31;
                }
                
                .avatar-upload-btn {
                    background: #4285f4;
                    border-color: #202124;
                }
                
                .privacy-link {
                    color: #9aa0a6;
                }
                
                .privacy-link a {
                    color: #8ab4f8;
                }
                
                .privacy-link a:hover {
                    background: #2d2e31;
                    color: #aecbfa;
                }
                
                .profile-footer {
                    border-top-color: #3c4043;
                }
            }
            
            /* Dark theme class support */
            .dark-theme .reverbit-profile-popup {
                background: #202124;
                border-color: #3c4043;
                box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
            }
            
            .dark-theme .profile-greeting,
            .dark-theme .profile-email {
                color: #9aa0a6;
            }
            
            .dark-theme .profile-name {
                color: #e8eaed;
            }
            
            .dark-theme .profile-divider {
                background: linear-gradient(90deg, transparent, #3c4043, transparent);
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
            
            .dark-theme .profile-avatar-large {
                border-color: #4285f4;
                background: #2d2e31;
            }
            
            .dark-theme .avatar-upload-btn {
                background: #4285f4;
                border-color: #202124;
            }
            
            .dark-theme .privacy-link {
                color: #9aa0a6;
            }
            
            .dark-theme .privacy-link a {
                color: #8ab4f8;
            }
            
            .dark-theme .privacy-link a:hover {
                background: #2d2e31;
                color: #aecbfa;
            }
            
            .dark-theme .profile-footer {
                border-top-color: #3c4043;
            }
            
            /* Animation for avatar loading */
            @keyframes avatarPulse {
                0% { opacity: 0.5; }
                50% { opacity: 1; }
                100% { opacity: 0.5; }
            }
            
            .reverbit-profile-avatar.loading .reverbit-avatar-img {
                animation: avatarPulse 1.5s ease-in-out infinite;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
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
            
            /* Toast Notifications */
            .reverbit-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: #202124;
                color: white;
                padding: 16px 24px;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                font-size: 15px;
                font-weight: 500;
                z-index: 10000;
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                max-width: 90%;
                text-align: center;
                pointer-events: none;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .reverbit-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            
            .reverbit-toast-success {
                background: linear-gradient(90deg, #34a853, #0d8a72);
            }
            
            .reverbit-toast-error {
                background: linear-gradient(90deg, #ea4335, #d23b2f);
            }
            
            .reverbit-toast-info {
                background: linear-gradient(90deg, #1a73e8, #4285f4);
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    async logout() {
        try {
            await this.auth.signOut();
            localStorage.removeItem('reverbit_user');
            
            // Remove UI elements
            this.removeProfileAvatars();
            this.removeProfilePopup();
            
            // Redirect to home page
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 300);
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }

    // ... (rest of the methods remain the same)
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
            
            await this.updateStreak();
        } catch (error) {
            console.error('Usage tracking error:', error);
        }
    }

    generateSimpleUsername(displayName, email) {
        if (displayName && displayName.trim()) {
            let username = displayName.toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .replace(/\s+/g, '_');
            
            if (username.length >= 3) {
                return username.substring(0, 20);
            }
        }
        
        if (email) {
            const emailUsername = email.split('@')[0];
            let username = emailUsername.toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .replace(/\./g, '_');
            
            if (username.length >= 3) {
                return username.substring(0, 20);
            }
        }
        
        return `user${Date.now().toString().slice(-6)}`;
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
}

// Create global instance
window.ReverbitAuth = new ReverbitAuth();

// Auto-initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.ReverbitAuth.init();
        
        const user = window.ReverbitAuth.getUser();
        if (user) {
            // Track usage for current app
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

window.viewPublicProfile = async function() {
    if (!window.ReverbitAuth) {
        console.error('Auth system not available');
        return;
    }
    
    const link = await window.ReverbitAuth.generateProfileLink();
    if (link) {
        window.open(link, '_blank');
    } else {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ea4335;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
        `;
        toast.textContent = 'Please sign in first';
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }
};

window.debugUserProfile = async function() {
    console.log('=== DEBUG USER PROFILE ===');
    
    if (!window.ReverbitAuth) {
        console.error('Auth system not available');
        return;
    }
    
    const user = window.ReverbitAuth.getUser();
    console.log('Current user:', user);
    
    const profile = window.ReverbitAuth.getUserProfile();
    console.log('User profile:', profile);
    
    const username = window.ReverbitAuth.getUserUsername();
    console.log('User username:', username);
    
    if (user) {
        const profileLink = await window.ReverbitAuth.generateProfileLink();
        console.log('Profile link:', profileLink);
    }
    
    console.log('=== END DEBUG ===');
};

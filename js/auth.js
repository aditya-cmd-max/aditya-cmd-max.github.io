// auth.js - Fixed Profile Avatar System
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
            cloudName: 'dgy9v2ctk',          
            uploadPreset: 'reverbit_unsigned11',
            folder: 'reverbit/user'
        };
        
        this.user = null;
        this.userProfile = null;
        this.initialized = false;
        this.profilePopup = null;
        this.desktopAvatar = null;
        this.mobileAvatar = null;
        this.avatarUploadInput = null;
        
        // Bind methods
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.uploadProfilePicture = this.uploadProfilePicture.bind(this);
        this.handleAvatarUpload = this.handleAvatarUpload.bind(this);
        this.updateAvatarUI = this.updateAvatarUI.bind(this);
        this.createDesktopAvatar = this.createDesktopAvatar.bind(this);
        this.createMobileAvatar = this.createMobileAvatar.bind(this);
        this.removeAllAvatars = this.removeAllAvatars.bind(this);
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
                
                // Update UI
                this.updateAvatarUI();
                
                // Add body class for styling
                document.body.classList.add('user-signed-in');
                
                // Track login activity
                await this.trackLogin();
            } else {
                this.user = null;
                this.userProfile = null;
                localStorage.removeItem('reverbit_user');
                
                // Remove UI elements
                this.removeAllAvatars();
                this.removeProfilePopup();
                
                // Remove body class
                document.body.classList.remove('user-signed-in');
            }
        });
    }

    async checkExistingSession() {
        try {
            const userData = localStorage.getItem('reverbit_user');
            
            if (userData) {
                this.user = JSON.parse(userData);
                await this.loadUserProfile();
                this.updateAvatarUI();
                document.body.classList.add('user-signed-in');
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
            } else {
                const displayName = this.user.displayName || 
                                  this.user.email?.split('@')[0] || 
                                  'User';
                
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
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    // SIMPLIFIED AVATAR CREATION - NO DUPLICATES
    updateAvatarUI() {
        // First, remove ALL existing avatars
        this.removeAllAvatars();
        
        // Create fresh avatars
        this.createDesktopAvatar();
        this.createMobileAvatar();
    }

    createDesktopAvatar() {
        // Get desktop nav
        const desktopNav = document.querySelector('.desktop-nav');
        if (!desktopNav) return;
        
        // Create avatar button
        this.desktopAvatar = document.createElement('button');
        this.desktopAvatar.className = 'reverbit-profile-avatar desktop';
        this.desktopAvatar.setAttribute('aria-label', 'User profile menu');
        this.desktopAvatar.setAttribute('title', 'Profile menu');
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        this.updateAvatarImage(avatarImg);
        this.desktopAvatar.appendChild(avatarImg);
        
        // Add click handler
        this.desktopAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleProfilePopup();
        });
        
        // Find position to insert (before sign in button or theme toggle)
        const signInButton = desktopNav.querySelector('#signInButton');
        const themeToggle = desktopNav.querySelector('.theme-toggle');
        
        if (signInButton) {
            desktopNav.insertBefore(this.desktopAvatar, signInButton);
        } else if (themeToggle) {
            desktopNav.insertBefore(this.desktopAvatar, themeToggle);
        } else {
            desktopNav.appendChild(this.desktopAvatar);
        }
    }

    createMobileAvatar() {
        const floatingNavbar = document.querySelector('.floating-navbar');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        
        if (!floatingNavbar || !mobileMenuBtn) return;
        
        // Create mobile avatar button
        this.mobileAvatar = document.createElement('button');
        this.mobileAvatar.className = 'reverbit-profile-avatar mobile';
        this.mobileAvatar.setAttribute('aria-label', 'User profile menu');
        this.mobileAvatar.setAttribute('title', 'Profile menu');
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        this.updateAvatarImage(avatarImg);
        this.mobileAvatar.appendChild(avatarImg);
        
        // Add click handler
        this.mobileAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleProfilePopup();
        });
        
        // Insert before mobile menu button
        floatingNavbar.insertBefore(this.mobileAvatar, mobileMenuBtn);
    }

    // COMPLETE AVATAR REMOVAL
    removeAllAvatars() {
        // Remove ALL profile avatars from the DOM
        const allProfileAvatars = document.querySelectorAll('.reverbit-profile-avatar, #mobileProfileAvatar, [id*="avatar"], [class*="avatar"][class*="profile"]');
        allProfileAvatars.forEach(avatar => {
            if (avatar.parentNode && 
                (avatar.parentNode.classList.contains('desktop-nav') || 
                 avatar.parentNode.classList.contains('floating-navbar') ||
                 avatar.parentNode.id === 'mobileProfileAvatar' ||
                 avatar.classList.contains('reverbit-profile-avatar'))) {
                avatar.parentNode.removeChild(avatar);
            }
        });
        
        // Reset references
        this.desktopAvatar = null;
        this.mobileAvatar = null;
    }

    updateAvatarImage(avatarImg) {
        if (!this.userProfile) return;
        
        const photoURL = this.userProfile.photoURL || 
                       `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userProfile.displayName || 'User')}&background=4285f4&color=fff`;
        
        avatarImg.src = photoURL + (photoURL.includes('?') ? '&' : '?') + 't=' + Date.now();
        avatarImg.alt = this.userProfile.displayName || 'Profile';
        
        avatarImg.onerror = () => {
            const displayName = this.userProfile?.displayName || 'User';
            const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4285f4&color=fff`;
        };
    }

    async handleAvatarUpload() {
        if (!this.user) return;
        
        if (!this.avatarUploadInput) {
            this.avatarUploadInput = document.createElement('input');
            this.avatarUploadInput.type = 'file';
            this.avatarUploadInput.accept = 'image/*';
            this.avatarUploadInput.style.display = 'none';
            this.avatarUploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.uploadProfilePicture(file);
                }
                this.avatarUploadInput.value = '';
            });
            document.body.appendChild(this.avatarUploadInput);
        }
        
        this.avatarUploadInput.click();
    }

    async uploadProfilePicture(file) {
        if (!this.user || !file) return;
        
        try {
            if (this.desktopAvatar) this.desktopAvatar.classList.add('uploading');
            if (this.mobileAvatar) this.mobileAvatar.classList.add('uploading');
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            formData.append('cloud_name', this.cloudinaryConfig.cloudName);
            formData.append('folder', this.cloudinaryConfig.folder);
            
            const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/upload`;
            
            const response = await fetch(cloudinaryUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
            
            const result = await response.json();
            const photoURL = result.secure_url;
            const cloudinaryImageId = result.public_id;
            
            // Update Firebase user profile
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.update({
                photoURL: photoURL,
                cloudinaryImageId: cloudinaryImageId,
                updatedAt: new Date().toISOString()
            });
            
            // Update Firebase auth profile
            await this.auth.currentUser.updateProfile({
                photoURL: photoURL
            });
            
            // Update local user data
            this.user.photoURL = photoURL;
            this.userProfile.photoURL = photoURL;
            this.userProfile.cloudinaryImageId = cloudinaryImageId;
            
            // Update UI
            this.updateAvatarUI();
            
            this.showToast('Profile picture updated successfully!', 'success');
            
            // Refresh profile popup if open
            if (this.profilePopup && this.profilePopup.style.display === 'block') {
                this.profilePopup.innerHTML = this.getPopupHTML();
                this.attachPopupEventListeners();
            }
            
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            this.showToast('Failed to upload profile picture. Please try again.', 'error');
        } finally {
            if (this.desktopAvatar) this.desktopAvatar.classList.remove('uploading');
            if (this.mobileAvatar) this.mobileAvatar.classList.remove('uploading');
        }
    }

    // SIMPLIFIED POPUP METHODS
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
        if (!this.userProfile) return '';
        
        const displayName = this.userProfile.displayName || 'User';
        const email = this.userProfile.email || '';
        const photoURL = this.userProfile.photoURL;
        const profileUrl = `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
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
        
        // Avatar upload buttons
        const avatarUploadBtn = this.profilePopup.querySelector('#avatar-upload-btn');
        const profileAvatarLarge = this.profilePopup.querySelector('#profile-avatar-large');
        
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
        
        // Close popup when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
    }

    toggleProfilePopup() {
        if (!this.profilePopup) {
            this.createProfilePopup();
        }
        
        const isVisible = this.profilePopup.style.display === 'block';
        
        if (isVisible) {
            this.hideProfilePopup();
        } else {
            this.showProfilePopup();
        }
    }

    showProfilePopup() {
        if (!this.profilePopup) return;
        
        this.profilePopup.innerHTML = this.getPopupHTML();
        this.attachPopupEventListeners();
        
        if (window.innerWidth <= 768) {
            this.profilePopup.style.top = '50%';
            this.profilePopup.style.left = '50%';
            this.profilePopup.style.transform = 'translate(-50%, -50%)';
        } else {
            const avatar = this.desktopAvatar || this.mobileAvatar;
            if (avatar) {
                const avatarRect = avatar.getBoundingClientRect();
                const popupRect = this.profilePopup.getBoundingClientRect();
                
                let top = avatarRect.bottom + 8;
                let right = window.innerWidth - avatarRect.right;
                
                if (top + popupRect.height > window.innerHeight) {
                    top = avatarRect.top - popupRect.height - 8;
                }
                
                if (right - popupRect.width < 0) {
                    right = 8;
                }
                
                this.profilePopup.style.top = `${top}px`;
                this.profilePopup.style.right = `${right}px`;
                this.profilePopup.style.transform = 'none';
            }
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

    handleClickOutside(event) {
        if (!this.profilePopup) return;
        
        const isPopupClick = this.profilePopup.contains(event.target);
        const isDesktopAvatarClick = this.desktopAvatar && this.desktopAvatar.contains(event.target);
        const isMobileAvatarClick = this.mobileAvatar && this.mobileAvatar.contains(event.target);
        
        if (!isPopupClick && !isDesktopAvatarClick && !isMobileAvatarClick) {
            this.hideProfilePopup();
        }
    }

    removeProfilePopup() {
        if (this.profilePopup && this.profilePopup.parentNode) {
            this.profilePopup.parentNode.removeChild(this.profilePopup);
            this.profilePopup = null;
        }
        document.removeEventListener('click', this.handleClickOutside);
    }

    showToast(message, type = 'info') {
        const existingToast = document.querySelector('.reverbit-toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `reverbit-toast reverbit-toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    }

    injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) return;
        
        const styles = `
            /* SIMPLIFIED AVATAR STYLES */
            .reverbit-profile-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid transparent;
                padding: 2px;
                background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335) border-box;
                cursor: pointer;
                transition: all 0.3s ease;
                overflow: hidden;
                flex-shrink: 0;
                margin: 0 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .reverbit-profile-avatar.desktop {
                margin: 0 8px;
            }
            
            .reverbit-profile-avatar.mobile {
                display: none;
                margin: 0 8px;
            }
            
            body.user-signed-in .reverbit-profile-avatar.mobile {
                display: flex;
            }
            
            .reverbit-profile-avatar:hover {
                transform: scale(1.1);
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            }
            
            .reverbit-avatar-img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                display: block;
            }
            
            /* Mobile adjustments */
            @media (max-width: 1024px) {
                .reverbit-profile-avatar.desktop {
                    display: none;
                }
                
                .reverbit-profile-avatar.mobile {
                    display: none;
                }
                
                body.user-signed-in .reverbit-profile-avatar.mobile {
                    display: flex;
                }
                
                .floating-navbar {
                    justify-content: space-between;
                }
                
                .nav-brand { order: 1; flex-grow: 1; }
                .reverbit-profile-avatar.mobile { order: 2; }
                #mobileMenuBtn { order: 3; }
            }
            
            @media (max-width: 768px) {
                .reverbit-profile-avatar.mobile {
                    width: 36px;
                    height: 36px;
                }
            }
            
            /* Popup styles remain the same as before */
            .reverbit-profile-popup {
                position: fixed;
                top: 0;
                right: 0;
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 16px 48px rgba(0, 0, 0, 0.08);
                min-width: 380px;
                max-width: 420px;
                z-index: 9999;
                overflow: hidden;
                opacity: 0;
                transform: translateY(-20px) scale(0.95);
                transition: opacity 0.3s ease, transform 0.3s ease;
                border: 1px solid #e0e0e0;
                font-family: 'Google Sans', 'Roboto', 'Segoe UI', Arial, sans-serif;
            }
            
            .reverbit-profile-popup.active {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            
            /* Toast styles */
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
                transition: all 0.4s ease;
                max-width: 90%;
                text-align: center;
                pointer-events: none;
            }
            
            .reverbit-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
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
            
            this.removeAllAvatars();
            this.removeProfilePopup();
            document.body.classList.remove('user-signed-in');
            
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 300);
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }

    // Other methods remain the same...
    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    generateSimpleUsername(displayName, email) {
        if (displayName && displayName.trim()) {
            let username = displayName.toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .replace(/\s+/g, '_');
            if (username.length >= 3) return username.substring(0, 20);
        }
        
        if (email) {
            const emailUsername = email.split('@')[0];
            let username = emailUsername.toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .replace(/\./g, '_');
            if (username.length >= 3) return username.substring(0, 20);
        }
        
        return `user${Date.now().toString().slice(-6)}`;
    }

    async trackLogin() {
        if (!this.user || !this.db) return;
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.update({
                lastLogin: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error tracking login:', error);
        }
    }
}

// Create global instance
window.ReverbitAuth = new ReverbitAuth();

// Simplified initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
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
    if (pathname.includes('cloverai')) return 'cloverAI';
    if (pathname.includes('mindscribe')) return 'mindscribe';
    if (pathname.includes('peo')) return 'peo';
    if (pathname.includes('reverbit')) return 'reverbit';
    return 'other';
}

// Helper functions
window.viewPublicProfile = async function() {
    if (!window.ReverbitAuth) return;
    const link = await window.ReverbitAuth.generateProfileLink();
    if (link) window.open(link, '_blank');
    else window.ReverbitAuth.showToast('Please sign in first', 'error');
};

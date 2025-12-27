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
        this.appsPopup = null;
        this.profileAvatar = null;
        this.appsButton = null;
        this.avatarUploadInput = null;
        
        // Bind methods
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.toggleAppsPopup = this.toggleAppsPopup.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleAppsClickOutside = this.handleAppsClickOutside.bind(this);
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
            
            // Initialize apps menu
            this.initAppsMenu();
            
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
                
                // Add or update profile avatar AND apps button
                this.addOrUpdateProfileAvatar();
                this.addAppsButtonToHeader();
                
                // Track login activity
                await this.trackLogin();
            } else {
                this.user = null;
                this.userProfile = null;
                localStorage.removeItem('reverbit_user');
                
                // Remove UI elements
                this.removeProfileAvatar();
                this.removeProfilePopup();
                this.removeAppsButton();
                this.removeAppsPopup();
            }
        });
    }

    async checkExistingSession() {
        try {
            const userData = localStorage.getItem('reverbit_user');
            
            if (userData) {
                this.user = JSON.parse(userData);
                await this.loadUserProfile();
                this.addOrUpdateProfileAvatar();
                this.addAppsButtonToHeader();
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
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
                    isPublic: true, // Default to public profile
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
            
            // Update avatar if exists
            if (this.profileAvatar) {
                this.updateProfileAvatar();
            }
            
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    // Simple username generator (no handle system)
    generateSimpleUsername(displayName, email) {
        if (displayName && displayName.trim()) {
            // Clean the display name
            let username = displayName.toLowerCase()
                .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
                .replace(/\s+/g, '_');    // Replace spaces with underscores
            
            // Ensure minimum length
            if (username.length >= 3) {
                return username.substring(0, 20);
            }
        }
        
        // Use email username as fallback
        if (email) {
            const emailUsername = email.split('@')[0];
            let username = emailUsername.toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .replace(/\./g, '_');
            
            // Ensure minimum length
            if (username.length >= 3) {
                return username.substring(0, 20);
            }
        }
        
        // Fallback to generic
        return `user${Date.now().toString().slice(-6)}`;
    }

    // Add greeting method
    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    addOrUpdateProfileAvatar() {
        // Check if already exists
        if (document.querySelector('.reverbit-profile-avatar')) {
            this.profileAvatar = document.querySelector('.reverbit-profile-avatar');
            this.updateProfileAvatar();
            return;
        }
        
        // Find header actions container
        let headerActions = document.querySelector('.header-actions');
        
        if (!headerActions) {
            // Try to find/create header
            const header = document.querySelector('.app-header, header, .header, nav.navbar');
            if (!header) {
                console.warn('No header found for profile avatar');
                return;
            }
            
            headerActions = document.createElement('div');
            headerActions.className = 'header-actions';
            header.appendChild(headerActions);
        }
        
        // Create profile avatar button
        this.profileAvatar = document.createElement('button');
        this.profileAvatar.className = 'reverbit-profile-avatar';
        this.profileAvatar.setAttribute('aria-label', 'User profile menu');
        this.profileAvatar.setAttribute('title', 'Profile menu');
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        this.profileAvatar.appendChild(avatarImg);
        
        // Create upload overlay
        const uploadOverlay = document.createElement('div');
        uploadOverlay.className = 'reverbit-avatar-upload-overlay';
        uploadOverlay.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
        `;
        this.profileAvatar.appendChild(uploadOverlay);
        
        // Add click handler for popup
        this.profileAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleProfilePopup();
        });
        
        // Add double click handler for quick upload
        this.profileAvatar.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.handleAvatarUpload();
        });
        
        // Insert into header actions
        headerActions.appendChild(this.profileAvatar);
        
        // Create hidden file input for avatar upload
        this.avatarUploadInput = document.createElement('input');
        this.avatarUploadInput.type = 'file';
        this.avatarUploadInput.accept = 'image/*';
        this.avatarUploadInput.style.display = 'none';
        this.avatarUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.uploadProfilePicture(file);
            }
        });
        document.body.appendChild(this.avatarUploadInput);
        
        // Update avatar image
        this.updateProfileAvatar();
    }

    async handleAvatarUpload() {
        if (!this.avatarUploadInput) return;
        this.avatarUploadInput.click();
    }

    async uploadProfilePicture(file) {
        if (!this.user || !file) return;
        
        try {
            // Show loading state
            this.profileAvatar.classList.add('uploading');
            
            // Create form data for Cloudinary upload
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            formData.append('cloud_name', this.cloudinaryConfig.cloudName);
            formData.append('folder', this.cloudinaryConfig.folder);
            formData.append('use_filename', 'true');
            formData.append('overwrite', 'false');
            formData.append('unique_filename', 'false');
            
            // Upload to Cloudinary
            const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/upload`;
            
            const response = await fetch(cloudinaryUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Cloudinary upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Update user profile with Cloudinary URL
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
            this.updateProfileAvatar();
            
            // Show success message
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
            this.profileAvatar.classList.remove('uploading');
        }
    }

    updateProfileAvatar() {
        if (!this.profileAvatar || !this.userProfile) return;
        
        const avatarImg = this.profileAvatar.querySelector('.reverbit-avatar-img');
        if (avatarImg) {
            // Add cache busting parameter to prevent caching
            const photoURL = this.userProfile.photoURL || 
                           `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userProfile.displayName || 'User')}&background=4285f4&color=fff`;
            
            avatarImg.src = photoURL + (photoURL.includes('?') ? '&' : '?') + 't=' + Date.now();
            avatarImg.alt = this.userProfile.displayName || 'Profile';
            avatarImg.onerror = function() {
                // Fallback to UI Avatars if image fails to load
                const displayName = this.userProfile?.displayName || 'User';
                const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4285f4&color=fff`;
            }.bind(this);
        }
    }

    removeProfileAvatar() {
        if (this.profileAvatar && this.profileAvatar.parentNode) {
            this.profileAvatar.parentNode.removeChild(this.profileAvatar);
            this.profileAvatar = null;
        }
        
        if (this.avatarUploadInput && this.avatarUploadInput.parentNode) {
            this.avatarUploadInput.parentNode.removeChild(this.avatarUploadInput);
            this.avatarUploadInput = null;
        }
    }

    createProfilePopup() {
        // Remove existing popup
        this.removeProfilePopup();
        
        // Create popup container
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup';
        this.profilePopup.style.display = 'none';
        
        // Create popup content
        this.profilePopup.innerHTML = this.getPopupHTML();
        
        // Add to body
        document.body.appendChild(this.profilePopup);
        
        // Add event listeners
        setTimeout(() => {
            this.attachPopupEventListeners();
        }, 10);
    }

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
                        <div class="profile-name">${displayName}</div>
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
                </div>
                
                <div class="profile-divider"></div>
                
                <div class="profile-menu">
                    <div class="profile-footer-info">
                        <div class="profile-brand">Reverbit</div>
                        <div class="profile-footer-email">${email}</div>
                    </div>
                    
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
        if (!this.profilePopup || !this.profileAvatar) return;
        
        // Close apps popup if open
        if (this.appsPopup && this.appsPopup.style.display === 'block') {
            this.hideAppsPopup();
        }
        
        // Update popup content
        this.profilePopup.innerHTML = this.getPopupHTML();
        this.attachPopupEventListeners();
        
        // Position popup
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        const popupRect = this.profilePopup.getBoundingClientRect();
        
        let top = avatarRect.bottom + 8;
        let right = window.innerWidth - avatarRect.right;
        
        // Adjust if goes off screen
        if (top + popupRect.height > window.innerHeight) {
            top = avatarRect.top - popupRect.height - 8;
        }
        
        if (right - popupRect.width < 0) {
            right = 8;
        }
        
        this.profilePopup.style.top = `${top}px`;
        this.profilePopup.style.right = `${right}px`;
        this.profilePopup.style.display = 'block';
        
        // Add active class for animation
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
        if (!this.profilePopup || !this.profileAvatar) return;
        
        const isPopupClick = this.profilePopup.contains(event.target);
        const isAvatarClick = this.profileAvatar.contains(event.target);
        
        if (!isPopupClick && !isAvatarClick) {
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

    // Apps Menu Methods
    initAppsMenu() {
        this.appsButton = document.createElement('button');
        this.appsButton.className = 'reverbit-apps-button';
        this.appsButton.setAttribute('aria-label', 'Reverbit apps menu');
        this.appsButton.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 12c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-6 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4-8c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-4 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
            </svg>
        `;
        
        this.appsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleAppsPopup();
        });
        
        // Add to header actions when available
        this.addAppsButtonToHeader();
    }

    addAppsButtonToHeader() {
        // Try to add to existing header actions
        setTimeout(() => {
            const headerActions = document.querySelector('.header-actions');
            if (headerActions && this.appsButton && !headerActions.contains(this.appsButton)) {
                // Insert before profile avatar if it exists
                const profileAvatar = headerActions.querySelector('.reverbit-profile-avatar');
                if (profileAvatar) {
                    headerActions.insertBefore(this.appsButton, profileAvatar);
                } else {
                    headerActions.appendChild(this.appsButton);
                }
            }
        }, 100);
    }

    createAppsPopup() {
        // Remove existing popup
        this.removeAppsPopup();
        
        // Create popup container
        this.appsPopup = document.createElement('div');
        this.appsPopup.className = 'reverbit-apps-popup';
        this.appsPopup.style.display = 'none';
        
        // Create popup content
        this.appsPopup.innerHTML = this.getAppsPopupHTML();
        
        // Add to body
        document.body.appendChild(this.appsPopup);
        
        // Add event listeners
        setTimeout(() => {
            this.attachAppsPopupEventListeners();
        }, 10);
    }

    getAppsPopupHTML() {
        const apps = [
            {
                name: 'Clover AI',
                icon: 'https://aditya-cmd-max.github.io/clover.png',
                url: 'https://aditya-cmd-max.github.io/cloverai/chat',
                color: '#4285F4'
            },
            {
                name: 'SkyCast',
                icon: 'https://aditya-cmd-max.github.io/skycast.png',
                url: 'https://aditya-cmd-max.github.io/exonovaweather/app',
                color: '#34A853'
            },
            {
                name: 'PopOut Pro',
                icon: 'https://aditya-cmd-max.github.io/popout.png',
                url: 'https://aditya-cmd-max.github.io/popout/app.html',
                color: '#FBBC05'
            },
            {
                name: 'Peo-TTS',
                icon: 'https://aditya-cmd-max.github.io/peo.png',
                url: 'https://aditya-cmd-max.github.io/Peo/app',
                color: '#EA4335'
            },
            {
                name: 'Mindscribe',
                icon: 'https://aditya-cmd-max.github.io/mindscribe.png',
                url: 'https://aditya-cmd-max.github.io/mindscribe/app',
                color: '#4285F4'
            },
            {
                name: 'Clover Studio',
                icon: 'https://aditya-cmd-max.github.io/cloverstudio.png',
                url: 'https://aditya-cmd-max.github.io/clover/app',
                color: '#34A853'
            }
        ];
        
        return `
            <div class="apps-popup-container">
                <div class="apps-popup-header">
                    <h3 class="apps-popup-title">Reverbit Apps</h3>
                </div>
                
                <div class="apps-grid">
                    ${apps.map(app => `
                        <a href="${app.url}" class="app-item" target="_blank">
                            <div class="app-icon" style="background: ${app.color}">
                                <img src="${app.icon}" alt="${app.name}" onerror="this.style.display='none'; this.parentElement.innerHTML='<span>${app.name.charAt(0)}</span>';">
                            </div>
                            <span class="app-name">${app.name}</span>
                        </a>
                    `).join('')}
                </div>
                
                <div class="apps-footer">
                    <a href="https://aditya-cmd-max.github.io/reverbit/ecosystem" class="all-apps-link">
                        All Reverbit tools
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                        </svg>
                    </a>
                </div>
            </div>
        `;
    }

    toggleAppsPopup() {
        if (!this.appsPopup) {
            this.createAppsPopup();
        }
        
        const isVisible = this.appsPopup.style.display === 'block';
        
        if (isVisible) {
            this.hideAppsPopup();
        } else {
            this.showAppsPopup();
        }
    }

    showAppsPopup() {
        if (!this.appsPopup || !this.appsButton) return;
        
        // Close profile popup if open
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.hideProfilePopup();
        }
        
        // Update popup content
        this.appsPopup.innerHTML = this.getAppsPopupHTML();
        this.attachAppsPopupEventListeners();
        
        // Position popup
        const buttonRect = this.appsButton.getBoundingClientRect();
        const popupRect = this.appsPopup.getBoundingClientRect();
        
        let top = buttonRect.bottom + 8;
        let right = window.innerWidth - buttonRect.right;
        
        // Adjust if goes off screen
        if (top + popupRect.height > window.innerHeight) {
            top = buttonRect.top - popupRect.height - 8;
        }
        
        if (right - popupRect.width < 0) {
            right = 8;
        }
        
        this.appsPopup.style.top = `${top}px`;
        this.appsPopup.style.right = `${right}px`;
        this.appsPopup.style.display = 'block';
        
        // Add active class for animation
        setTimeout(() => {
            this.appsPopup.classList.add('active');
        }, 10);
    }

    hideAppsPopup() {
        if (!this.appsPopup) return;
        
        this.appsPopup.classList.remove('active');
        setTimeout(() => {
            this.appsPopup.style.display = 'none';
        }, 200);
    }

    removeAppsPopup() {
        if (this.appsPopup && this.appsPopup.parentNode) {
            this.appsPopup.parentNode.removeChild(this.appsPopup);
            this.appsPopup = null;
        }
        document.removeEventListener('click', this.handleAppsClickOutside);
    }

    removeAppsButton() {
        if (this.appsButton && this.appsButton.parentNode) {
            this.appsButton.parentNode.removeChild(this.appsButton);
        }
    }

    handleAppsClickOutside(event) {
        if (!this.appsPopup || !this.appsButton) return;
        
        const isPopupClick = this.appsPopup.contains(event.target);
        const isButtonClick = this.appsButton.contains(event.target);
        
        if (!isPopupClick && !isButtonClick) {
            this.hideAppsPopup();
        }
    }

    attachAppsPopupEventListeners() {
        if (!this.appsPopup) return;
        
        // Close popup when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.handleAppsClickOutside.bind(this));
        }, 100);
    }

    showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.reverbit-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `reverbit-toast reverbit-toast-${type}`;
        toast.textContent = message;
        
        // Add to DOM
        document.body.appendChild(toast);
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
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
            
            /* Apps Menu Button */
            .reverbit-apps-button {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: none;
                background: transparent;
                color: var(--md-on-surface);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                margin: 0 4px;
            }
            
            .reverbit-apps-button:hover {
                background: var(--md-surface-variant);
                transform: scale(1.1);
            }
            
            .reverbit-apps-button:active {
                transform: scale(0.95);
            }
            
            .reverbit-apps-button svg {
                width: 24px;
                height: 24px;
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
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
                padding-bottom: 16px;
            }
            
            .profile-info {
                flex: 1;
                min-width: 0;
            }
            
            .profile-greeting {
                font-size: 14px;
                color: #5f6368;
                margin-bottom: 4px;
            }
            
            .profile-name {
                font-size: 16px;
                font-weight: 500;
                color: #202124;
                line-height: 1.5;
                margin-bottom: 2px;
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
            }
            
            .profile-avatar-large {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                overflow: hidden;
                flex-shrink: 0;
                border: 2px solid #dadce0;
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
                background: rgba(0, 0, 0, 0.1);
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
            
            .profile-footer-info {
                padding: 12px 16px;
                border-bottom: 1px solid #e8eaed;
                margin: 0 -20px 8px;
            }
            
            .profile-brand {
                font-family: var(--md-font-logo);
                font-weight: 700;
                color: #202124;
                font-size: 16px;
            }
            
            .profile-footer-email {
                font-size: 13px;
                color: #5f6368;
                margin-top: 4px;
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
            
            /* Apps Popup */
            .reverbit-apps-popup {
                position: fixed;
                top: 0;
                right: 0;
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1);
                min-width: 320px;
                max-width: 400px;
                z-index: 9998;
                overflow: hidden;
                opacity: 0;
                transform: translateY(-10px);
                transition: opacity 0.2s ease, transform 0.2s ease;
                border: 1px solid #dadce0;
                font-family: 'Google Sans', 'Roboto', 'Segoe UI', Arial, sans-serif;
            }
            
            .reverbit-apps-popup.active {
                opacity: 1;
                transform: translateY(0);
            }
            
            .apps-popup-container {
                padding: 16px;
            }
            
            .apps-popup-header {
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid #e8eaed;
            }
            
            .apps-popup-title {
                font-size: 16px;
                font-weight: 600;
                color: #202124;
                margin: 0;
            }
            
            .apps-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .app-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-decoration: none;
                padding: 12px;
                border-radius: 8px;
                transition: all 0.2s ease;
            }
            
            .app-item:hover {
                background: #f8f9fa;
                transform: translateY(-2px);
            }
            
            .app-icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .app-icon img {
                width: 32px;
                height: 32px;
                object-fit: contain;
            }
            
            .app-icon span {
                color: white;
                font-weight: 600;
                font-size: 18px;
            }
            
            .app-name {
                font-size: 12px;
                color: #202124;
                text-align: center;
                font-weight: 500;
                line-height: 1.3;
            }
            
            .apps-footer {
                border-top: 1px solid #e8eaed;
                padding-top: 12px;
            }
            
            .all-apps-link {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                color: #1a73e8;
                text-decoration: none;
                font-size: 14px;
                font-weight: 500;
                padding: 8px;
                border-radius: 8px;
                transition: all 0.2s ease;
            }
            
            .all-apps-link:hover {
                background: #e8f0fe;
            }
            
            .all-apps-link svg {
                transition: transform 0.2s ease;
            }
            
            .all-apps-link:hover svg {
                transform: translateX(4px);
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
            
            /* Dark theme support */
            @media (prefers-color-scheme: dark) {
                .reverbit-profile-popup,
                .reverbit-apps-popup {
                    background: #202124;
                    border-color: #3c4043;
                }
                
                .profile-greeting,
                .profile-email,
                .profile-footer-email,
                .apps-popup-title,
                .app-name,
                .all-apps-link {
                    color: #9aa0a6;
                }
                
                .profile-name,
                .profile-brand {
                    color: #e8eaed;
                }
                
                .profile-divider,
                .apps-popup-header,
                .apps-footer {
                    border-color: #3c4043;
                }
                
                .profile-menu-item {
                    color: #e8eaed;
                }
                
                .profile-menu-item:hover,
                .app-item:hover {
                    background-color: #2d2e31;
                }
                
                .profile-menu-item:active {
                    background-color: #3c4043;
                }
                
                .profile-menu-icon,
                .reverbit-apps-button {
                    color: #9aa0a6;
                }
                
                .reverbit-apps-button:hover {
                    background-color: #2d2e31;
                }
                
                .profile-avatar-large {
                    border-color: #3c4043;
                }
                
                .avatar-upload-btn {
                    background: #8ab4f8;
                    border-color: #202124;
                }
                
                .all-apps-link:hover {
                    background: #2d2e31;
                }
                
                .profile-footer-info {
                    border-bottom-color: #3c4043;
                }
            }
            
            /* Dark theme class support */
            .dark-theme .reverbit-profile-popup,
            .dark-theme .reverbit-apps-popup {
                background: #202124;
                border-color: #3c4043;
            }
            
            .dark-theme .profile-greeting,
            .dark-theme .profile-email,
            .dark-theme .profile-footer-email,
            .dark-theme .apps-popup-title,
            .dark-theme .app-name,
            .dark-theme .all-apps-link {
                color: #9aa0a6;
            }
            
            .dark-theme .profile-name,
            .dark-theme .profile-brand {
                color: #e8eaed;
            }
            
            .dark-theme .profile-divider,
            .dark-theme .apps-popup-header,
            .dark-theme .apps-footer {
                border-color: #3c4043;
            }
            
            .dark-theme .profile-menu-item {
                color: #e8eaed;
            }
            
            .dark-theme .profile-menu-item:hover,
            .dark-theme .app-item:hover {
                background-color: #2d2e31;
            }
            
            .dark-theme .profile-menu-item:active {
                background-color: #3c4043;
            }
            
            .dark-theme .profile-menu-icon,
            .dark-theme .reverbit-apps-button {
                color: #9aa0a6;
            }
            
            .dark-theme .reverbit-apps-button:hover {
                background-color: #2d2e31;
            }
            
            .dark-theme .profile-avatar-large {
                border-color: #3c4043;
            }
            
            .dark-theme .avatar-upload-btn {
                background: #8ab4f8;
                border-color: #202124;
            }
            
            .dark-theme .all-apps-link:hover {
                background: #2d2e31;
            }
            
            .dark-theme .profile-footer-info {
                border-bottom-color: #3c4043;
            }
            
            /* Responsive design */
            @media (max-width: 768px) {
                .apps-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .reverbit-profile-popup,
                .reverbit-apps-popup {
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
                
                .reverbit-profile-popup.active,
                .reverbit-apps-popup.active {
                    transform: translate(-50%, -50%) !important;
                }
                
                .reverbit-apps-popup {
                    max-width: 400px;
                }
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
            this.removeProfileAvatar();
            this.removeProfilePopup();
            this.removeAppsButton();
            this.removeAppsPopup();
            
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
                    await userRef.update({
                        streak: 1,
                        lastActive: new Date().toISOString()
                    });
                } else if (lastActive.getTime() < today.getTime()) {
                    await userRef.update({
                        streak: (userData.streak || 0) + 1,
                        lastActive: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error('Streak update error:', error);
        }
    }

    // Generate profile link using user ID
    async generateProfileLink() {
        if (!this.user) {
            await this.loadUserProfile();
        }
        
        if (this.user) {
            return `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
        }
        
        return null;
    }

    // Get user username
    getUserUsername() {
        return this.userProfile?.username || null;
    }

    // Get user profile data
    getUserProfileData() {
        return this.userProfile;
    }

    // Update user profile
    async updateUserProfile(updates) {
        if (!this.user || !this.db) return false;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            
            await userRef.update({
                ...updates,
                updatedAt: new Date().toISOString()
            });
            
            // Reload profile
            await this.loadUserProfile();
            
            return true;
        } catch (error) {
            console.error('Error updating user profile:', error);
            return false;
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

// Helper function to view public profile
window.viewPublicProfile = async function() {
    if (!window.ReverbitAuth) {
        console.error('Auth system not available');
        return;
    }
    
    const link = await window.ReverbitAuth.generateProfileLink();
    if (link) {
        window.open(link, '_blank');
    } else {
        // Show toast if user not logged in
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

// Debug function
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

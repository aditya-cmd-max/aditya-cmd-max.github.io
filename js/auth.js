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
        this.authListeners = [];
        
        // Bind methods
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.uploadProfilePicture = this.uploadProfilePicture.bind(this);
        this.handleAvatarUpload = this.handleAvatarUpload.bind(this);
        this.logout = this.logout.bind(this);
    }

    async init() {
        if (this.initialized) {
            console.log('Auth: Already initialized');
            return;
        }
        
        try {
            console.log('Auth: Initializing...');
            
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
                console.log('Auth: Firebase initialized');
            } else {
                console.log('Auth: Firebase already initialized');
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            this.storage = firebase.storage();
            
            // Enable offline persistence for better UX
            try {
                await this.db.enablePersistence({ synchronizeTabs: true });
                console.log('Auth: Firestore persistence enabled');
            } catch (persistenceError) {
                console.warn('Auth: Firestore persistence not supported:', persistenceError);
            }
            
            // Initialize Cloudinary widget
            this.initCloudinaryWidget();
            
            // Listen for auth state changes
            this.setupAuthListener();
            
            // Check existing session
            await this.checkExistingSession();
            
            // Add styles to page
            this.injectStyles();
            
            this.initialized = true;
            console.log('Auth: Initialization complete');
            
            // Notify listeners
            this.notifyAuthListeners();
            
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.showToast('Failed to initialize authentication system', 'error');
        }
    }

    // Add listener for auth state changes
    addAuthListener(callback) {
        this.authListeners.push(callback);
        // Call immediately with current state
        if (this.initialized) {
            callback(this.user, this.userProfile);
        }
    }

    // Remove listener
    removeAuthListener(callback) {
        const index = this.authListeners.indexOf(callback);
        if (index > -1) {
            this.authListeners.splice(index, 1);
        }
    }

    // Notify all listeners
    notifyAuthListeners() {
        this.authListeners.forEach(callback => {
            try {
                callback(this.user, this.userProfile);
            } catch (error) {
                console.error('Auth listener error:', error);
            }
        });
    }

    initCloudinaryWidget() {
        // Load Cloudinary widget script if not already loaded
        if (!window.cloudinary) {
            const script = document.createElement('script');
            script.src = 'https://upload-widget.cloudinary.com/global/all.js';
            script.async = true;
            script.onload = () => console.log('Auth: Cloudinary widget loaded');
            script.onerror = (error) => console.error('Auth: Failed to load Cloudinary widget:', error);
            document.head.appendChild(script);
        } else {
            console.log('Auth: Cloudinary already loaded');
        }
    }

    setupAuthListener() {
        this.auth.onAuthStateChanged(async (user) => {
            console.log('Auth state changed:', user ? `User logged in (${user.email})` : 'No user');
            
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
                localStorage.setItem('reverbit_user_email', user.email);
                
                // Add or update profile avatar
                this.addOrUpdateProfileAvatar();
                
                // Track login activity
                await this.trackLogin();
                
                console.log('Auth: User fully loaded:', this.user.email);
                
                // Show welcome message for new users
                if (this.userProfile && this.userProfile.createdAt) {
                    const createdAt = new Date(this.userProfile.createdAt);
                    const now = new Date();
                    const diffHours = (now - createdAt) / (1000 * 60 * 60);
                    if (diffHours < 1) { // User created less than 1 hour ago
                        this.showToast(`Welcome to Reverbit, ${this.userProfile.displayName}!`, 'success');
                    }
                }
            } else {
                console.log('Auth: User signed out');
                this.user = null;
                this.userProfile = null;
                localStorage.removeItem('reverbit_user');
                localStorage.removeItem('reverbit_user_uid');
                localStorage.removeItem('reverbit_user_email');
                
                // Remove UI elements
                this.removeProfileAvatar();
                this.removeProfilePopup();
            }
            
            // Notify listeners
            this.notifyAuthListeners();
        });
    }

    async checkExistingSession() {
        try {
            const userData = localStorage.getItem('reverbit_user');
            const userUid = localStorage.getItem('reverbit_user_uid');
            
            if (userData && userUid) {
                console.log('Auth: Found existing session for UID:', userUid);
                this.user = JSON.parse(userData);
                
                // Verify the session is still valid
                try {
                    const currentUser = this.auth.currentUser;
                    if (currentUser && currentUser.uid === userUid) {
                        console.log('Auth: Session is valid, loading profile...');
                        await this.loadUserProfile();
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
            // Clear corrupted data
            localStorage.clear();
        }
    }

    async trackLogin() {
        if (!this.user || !this.db) {
            console.warn('Cannot track login: No user or db');
            return;
        }
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            const updateData = {
                lastLogin: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            };
            
            // Use set with merge to ensure document exists
            await userRef.set(updateData, { merge: true });
            
            console.log('Auth: Login tracked successfully');
        } catch (error) {
            console.error('Error tracking login:', error);
            // Don't show toast for tracking errors to avoid bothering users
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
                this.userProfile.uid = this.user.uid; // Ensure UID is included
                console.log('Auth: Loaded existing user profile for:', this.user.email);
                
            } else {
                // Create default profile for new user
                console.log('Auth: Creating new user profile for:', this.user.email);
                
                const displayName = this.user.displayName || 
                                  this.user.email?.split('@')[0] || 
                                  'User';
                
                // Clean username for internal use
                const cleanDisplayName = displayName.trim().toLowerCase();
                const username = cleanDisplayName.replace(/[^a-z0-9]/g, '_').substring(0, 20);
                
                this.userProfile = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: displayName,
                    username: username, // Internal use only
                    photoURL: this.user.photoURL || 
                             `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true`,
                    isPublic: true, // Default to public profile
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    lastActive: new Date().toISOString(),
                    theme: 'auto',
                    preferences: {},
                    cloudinaryImageId: null,
                    bio: '',
                    country: '',
                    gender: '',
                    showApps: true,
                    streak: 0,
                    totalLogins: 1
                };
                
                console.log('Auth: Creating user document with data:', this.userProfile);
                
                try {
                    // Use set() instead of add() to ensure we use the UID as document ID
                    await userRef.set(this.userProfile);
                    console.log('Auth: New user profile created successfully for:', this.user.email);
                    
                    // Store profile in localStorage for immediate access
                    localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
                    
                } catch (createError) {
                    console.error('Error creating user document:', createError);
                    
                    // Try alternative approach with add() if set() fails
                    try {
                        console.log('Auth: Trying alternative profile creation...');
                        await this.db.collection('users').add({
                            ...this.userProfile,
                            uid: this.user.uid
                        });
                        console.log('Auth: Profile created via add()');
                    } catch (altError) {
                        console.error('Alternative profile creation also failed:', altError);
                        throw altError;
                    }
                }
            }
            
            // Update avatar if exists
            if (this.profileAvatar) {
                this.updateProfileAvatar();
            }
            
            // Store updated profile in localStorage
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            
        } catch (error) {
            console.error('Error loading user profile:', error);
            
            // Create a minimal fallback profile from localStorage
            const storedProfile = localStorage.getItem('reverbit_user_profile');
            if (storedProfile) {
                this.userProfile = JSON.parse(storedProfile);
                console.log('Auth: Using cached profile from localStorage');
            } else {
                this.userProfile = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: this.user.displayName || 'User',
                    photoURL: this.user.photoURL || `https://ui-avatars.com/api/?name=User&background=4285f4&color=fff`,
                    isPublic: true,
                    createdAt: new Date().toISOString()
                };
                console.log('Auth: Created minimal fallback profile');
            }
            
            this.showToast('Profile loaded with limited functionality', 'info');
        }
    }

    addOrUpdateProfileAvatar() {
        // Check if already exists
        if (document.querySelector('.reverbit-profile-avatar')) {
            this.profileAvatar = document.querySelector('.reverbit-profile-avatar');
            this.updateProfileAvatar();
            console.log('Auth: Updated existing profile avatar');
            return;
        }
        
        // Find header actions container
        let headerActions = document.querySelector('.header-actions');
        
        if (!headerActions) {
            // Try to find/create header
            const header = document.querySelector('.app-header, header, .header, nav.navbar');
            if (!header) {
                // Create a header if none exists
                header = document.createElement('div');
                header.className = 'reverbit-auth-header';
                header.style.cssText = `
                    position: fixed;
                    top: 0;
                    right: 0;
                    padding: 16px;
                    z-index: 1000;
                `;
                document.body.appendChild(header);
                console.log('Auth: Created header for avatar');
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
        
        // Add hover effects
        this.profileAvatar.addEventListener('mouseenter', () => {
            this.profileAvatar.style.transform = 'scale(1.05)';
        });
        
        this.profileAvatar.addEventListener('mouseleave', () => {
            this.profileAvatar.style.transform = 'scale(1)';
        });
        
        // Insert at the beginning of header actions
        headerActions.insertBefore(this.profileAvatar, headerActions.firstChild);
        
        // Create hidden file input for avatar upload
        this.avatarUploadInput = document.createElement('input');
        this.avatarUploadInput.type = 'file';
        this.avatarUploadInput.accept = 'image/*';
        this.avatarUploadInput.style.display = 'none';
        this.avatarUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    this.showToast('Image size should be less than 5MB', 'error');
                    return;
                }
                
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    this.showToast('Please select an image file', 'error');
                    return;
                }
                
                await this.uploadProfilePicture(file);
            }
            // Reset input
            e.target.value = '';
        });
        document.body.appendChild(this.avatarUploadInput);
        
        // Update avatar image
        this.updateProfileAvatar();
        
        console.log('Auth: Profile avatar added to page');
    }

    async handleAvatarUpload() {
        if (!this.avatarUploadInput) {
            console.error('Avatar upload input not found');
            return;
        }
        
        if (!this.user) {
            this.showToast('Please sign in to upload profile picture', 'error');
            return;
        }
        
        this.avatarUploadInput.click();
    }

    async uploadProfilePicture(file) {
        if (!this.user || !file) {
            console.error('Cannot upload: No user or file');
            return;
        }
        
        try {
            // Show loading state
            this.profileAvatar.classList.add('uploading');
            this.showToast('Uploading profile picture...', 'info');
            
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
            
            console.log('Auth: Uploading to Cloudinary...');
            const response = await fetch(cloudinaryUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Cloudinary upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Auth: Cloudinary upload successful:', result);
            
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
            if (this.userProfile) {
                this.userProfile.photoURL = photoURL;
                this.userProfile.cloudinaryImageId = cloudinaryImageId;
                this.userProfile.updatedAt = new Date().toISOString();
            }
            
            // Update localStorage
            localStorage.setItem('reverbit_user', JSON.stringify(this.user));
            if (this.userProfile) {
                localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            }
            
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
        if (!this.profileAvatar || !this.userProfile) {
            console.warn('Cannot update avatar: No avatar element or profile');
            return;
        }
        
        const avatarImg = this.profileAvatar.querySelector('.reverbit-avatar-img');
        if (avatarImg) {
            const displayName = this.userProfile.displayName || 'User';
            let photoURL = this.userProfile.photoURL || 
                         `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true`;
            
            // Add cache busting parameter to prevent caching
            photoURL += (photoURL.includes('?') ? '&' : '?') + 't=' + Date.now();
            
            avatarImg.src = photoURL;
            avatarImg.alt = displayName;
            avatarImg.title = displayName;
            
            // Set fallback on error
            avatarImg.onerror = () => {
                console.warn('Avatar image failed to load, using fallback');
                const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4285f4&color=fff&bold=true`;
            };
            
            console.log('Auth: Avatar updated with:', photoURL);
        }
    }

    removeProfileAvatar() {
        if (this.profileAvatar && this.profileAvatar.parentNode) {
            this.profileAvatar.parentNode.removeChild(this.profileAvatar);
            this.profileAvatar = null;
            console.log('Auth: Profile avatar removed');
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
        
        console.log('Auth: Profile popup created');
        
        // Add event listeners
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
        if (!this.profilePopup) {
            console.error('Cannot attach listeners: No popup');
            return;
        }
        
        // Sign out button
        const signoutBtn = this.profilePopup.querySelector('#profile-signout');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
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
                e.stopPropagation();
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
                    e.stopPropagation();
                    this.handleAvatarUpload();
                }
            });
        }
        
        // Close popup when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
        
        console.log('Auth: Popup event listeners attached');
    }

    toggleProfilePopup() {
        if (!this.user) {
            this.showToast('Please sign in to access profile', 'info');
            return;
        }
        
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
        if (!this.profilePopup || !this.profileAvatar) {
            console.error('Cannot show popup: No popup or avatar');
            return;
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
        
        console.log('Auth: Profile popup shown');
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
        
        // Add close button for important messages
        if (type === 'error' || type === 'warning') {
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                margin-left: 10px;
            `;
            closeBtn.onclick = () => toast.remove();
            toast.appendChild(closeBtn);
        }
        
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
        }, type === 'error' ? 5000 : 3000);
    }

    injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) {
            console.log('Auth: Styles already injected');
            return;
        }
        
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
                z-index: 1000;
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
                display: flex;
                align-items: center;
                justify-content: center;
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
            
            .reverbit-toast-warning {
                background: #fbbc05;
                color: #202124;
            }
            
            /* Dark theme support */
            @media (prefers-color-scheme: dark) {
                .reverbit-profile-popup {
                    background: #202124;
                    border-color: #3c4043;
                }
                
                .profile-name {
                    color: #e8eaed;
                }
                
                .profile-email {
                    color: #9aa0a6;
                }
                
                .change-avatar-btn {
                    color: #8ab4f8;
                }
                
                .change-avatar-btn:hover {
                    background-color: #2d2e31;
                }
                
                .profile-divider {
                    background: #3c4043;
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
                
                .profile-footer {
                    border-top-color: #3c4043;
                }
                
                .privacy-link {
                    color: #9aa0a6;
                }
                
                .privacy-link a {
                    color: #8ab4f8;
                }
                
                .profile-avatar-large {
                    border-color: #303134;
                }
                
                .profile-avatar-large img {
                    background: #303134;
                }
                
                .avatar-upload-btn {
                    background: #8ab4f8;
                    border-color: #202124;
                }
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
                
                .profile-header {
                    flex-direction: column;
                    text-align: center;
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
            
            /* Auth header for when no header exists */
            .reverbit-auth-header {
                position: fixed !important;
                top: 0 !important;
                right: 0 !important;
                padding: 16px !important;
                z-index: 1000 !important;
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
        
        console.log('Auth: Styles injected');
    }

    async logout() {
        try {
            console.log('Auth: Logging out...');
            
            // Update last active before logging out
            if (this.user && this.db) {
                try {
                    const userRef = this.db.collection('users').doc(this.user.uid);
                    await userRef.update({
                        lastActive: new Date().toISOString()
                    });
                } catch (updateError) {
                    console.warn('Failed to update last active:', updateError);
                }
            }
            
            await this.auth.signOut();
            
            // Clear all local storage
            localStorage.removeItem('reverbit_user');
            localStorage.removeItem('reverbit_user_uid');
            localStorage.removeItem('reverbit_user_email');
            localStorage.removeItem('reverbit_user_profile');
            
            // Remove UI elements
            this.removeProfileAvatar();
            this.removeProfilePopup();
            
            console.log('Auth: Logout successful');
            
            // Redirect to signin page
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 300);
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Error signing out. Please try again.', 'error');
            return false;
        }
    }

    async trackUsage(appName, minutes = 1) {
        if (!this.user) {
            console.warn('Cannot track usage: No user');
            return;
        }
        
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
                
                let streak = userData.streak || 0;
                
                if (!lastActive) {
                    streak = 1;
                } else if (lastActive.getTime() < today.getTime() - 86400000) {
                    streak = 1;
                } else if (lastActive.getTime() < today.getTime()) {
                    streak = (userData.streak || 0) + 1;
                }
                
                await userRef.update({
                    streak: streak,
                    lastActive: new Date().toISOString()
                });
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

    // Get user username (internal use only)
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
            
            this.showToast('Profile updated successfully!', 'success');
            return true;
        } catch (error) {
            console.error('Error updating user profile:', error);
            this.showToast('Failed to update profile', 'error');
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

    // Debug method to get current auth state
    async getProfileDebugInfo() {
        return {
            user: this.user,
            profile: this.userProfile,
            isAuthenticated: this.isAuthenticated(),
            uid: this.user?.uid,
            dbInitialized: !!this.db,
            authInitialized: !!this.auth
        };
    }
}

// Create global instance
window.ReverbitAuth = new ReverbitAuth();

// Add debug function to window
window.debugAuth = async function() {
    console.log('=== AUTH DEBUG INFO ===');
    const info = await window.ReverbitAuth.getProfileDebugInfo();
    console.log('Auth state:', info);
    console.log('Local storage:', {
        uid: localStorage.getItem('reverbit_user_uid'),
        email: localStorage.getItem('reverbit_user_email'),
        user: localStorage.getItem('reverbit_user'),
        profile: localStorage.getItem('reverbit_user_profile')
    });
    console.log('Current URL:', window.location.href);
    console.log('=== END DEBUG ===');
    
    // Try to load profile directly if we have UID
    if (info.uid && window.ReverbitAuth.db) {
        try {
            const userDoc = await window.ReverbitAuth.db.collection('users').doc(info.uid).get();
            console.log('Direct Firestore load:', userDoc.exists ? 'EXISTS' : 'NOT FOUND');
            if (userDoc.exists) {
                console.log('Firestore data:', userDoc.data());
            }
        } catch (error) {
            console.error('Direct Firestore load error:', error);
        }
    }
};

// Add profile link helper
window.getMyProfileLink = async function() {
    const link = await window.ReverbitAuth.generateProfileLink();
    if (link) {
        return link;
    }
    return 'https://aditya-cmd-max.github.io/signin';
};

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Page loaded, initializing auth...');
        await window.ReverbitAuth.init();
        
        const user = window.ReverbitAuth.getUser();
        if (user) {
            console.log('User found on page load:', user.email);
            
            // Track usage for current app
            const appName = getCurrentAppName();
            if (appName) {
                window.ReverbitAuth.trackUsage(appName, 1);
                
                // Track every 5 minutes if user stays on page
                const usageInterval = setInterval(() => {
                    if (!window.ReverbitAuth.isAuthenticated()) {
                        clearInterval(usageInterval);
                        return;
                    }
                    window.ReverbitAuth.trackUsage(appName, 5);
                }, 5 * 60 * 1000);
                
                // Clear interval on page unload
                window.addEventListener('beforeunload', () => {
                    clearInterval(usageInterval);
                });
            }
        } else {
            console.log('No user found on page load');
        }
    } catch (error) {
        console.error('Auth initialization failed:', error);
        window.ReverbitAuth.showToast('Failed to initialize authentication', 'error');
    }
});

// Helper function to get current app name
function getCurrentAppName() {
    const pathname = window.location.pathname;
    const title = document.title.toLowerCase();
    const hostname = window.location.hostname;
    
    if (pathname.includes('cloverai') || title.includes('clover') || hostname.includes('clover')) return 'cloverAI';
    if (pathname.includes('mindscribe') || title.includes('mindscribe') || hostname.includes('mindscribe')) return 'mindscribe';
    if (pathname.includes('peo') || title.includes('peo') || hostname.includes('peo')) return 'peo';
    if (pathname.includes('reverbit') || title.includes('reverbit') || hostname.includes('reverbit')) return 'reverbit';
    
    return 'other';
}

// Helper function to view public profile
window.viewPublicProfile = async function() {
    if (!window.ReverbitAuth) {
        console.error('Auth system not available');
        window.ReverbitAuth.showToast('Authentication system not available', 'error');
        return;
    }
    
    const link = await window.ReverbitAuth.generateProfileLink();
    if (link) {
        window.open(link, '_blank');
    } else {
        window.ReverbitAuth.showToast('Please sign in to view your profile', 'info');
    }
};

// Make auth instance globally accessible
window.auth = window.ReverbitAuth;

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
                
                // Add or update profile avatar
                this.addOrUpdateProfileAvatar();
                
                // Track login activity
                await this.trackLogin();
            } else {
                this.user = null;
                this.userProfile = null;
                localStorage.removeItem('reverbit_user');
                
                // Remove profile avatar if exists
                this.removeProfileAvatar();
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
                this.addOrUpdateProfileAvatar();
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
                
                // Check if user has a handle, if not create one
                if (!this.userProfile.handle) {
                    console.log('User has no handle, creating one...');
                    const handle = await this.createUserHandle(
                        this.user.uid,
                        this.user.email,
                        this.user.displayName || this.user.email?.split('@')[0] || 'User'
                    );
                    
                    if (handle) {
                        this.userProfile.handle = handle;
                        this.userProfile.lowercaseHandle = handle.toLowerCase();
                        
                        // Update the user document with the new handle
                        await userRef.update({
                            handle: handle,
                            lowercaseHandle: handle.toLowerCase(),
                            updatedAt: new Date().toISOString()
                        });
                        
                        console.log('Created handle for user:', handle);
                    }
                }
                
            } else {
                // Create default profile for new user
                console.log('Creating new user profile...');
                const displayName = this.user.displayName || 
                                  this.user.email?.split('@')[0] || 
                                  'User';
                
                // Create a handle for the new user
                const handle = await this.createUserHandle(
                    this.user.uid,
                    this.user.email,
                    displayName
                );
                
                this.userProfile = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: displayName,
                    handle: handle,
                    lowercaseHandle: handle ? handle.toLowerCase() : null,
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
                    showApps: true
                };
                
                await userRef.set(this.userProfile);
                console.log('New user profile created with handle:', handle);
            }
            
            // Update avatar if exists
            if (this.profileAvatar) {
                this.updateProfileAvatar();
            }
            
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    // NEW: Create user handle automatically
    async createUserHandle(userId, email, displayName) {
        try {
            console.log('Creating handle for user:', userId);
            
            // Generate a handle from email or displayName
            let handle = this.generateHandleFromEmail(email, displayName);
            console.log('Generated handle:', handle);
            
            // Check if handle system is available
            if (!window.ReverbitHandleSystem) {
                console.error('Handle system not available');
                return null;
            }
            
            // Initialize handle system if needed
            const handleSystem = window.ReverbitHandleSystem;
            if (!handleSystem.db && this.db) {
                handleSystem.db = this.db;
            }
            
            // Check if handle is available
            const availability = await handleSystem.isHandleAvailable(handle);
            
            // If not available, try variations
            if (!availability.available) {
                console.log('Handle not available, trying variations...');
                let counter = 1;
                let newHandle;
                
                do {
                    newHandle = `${handle}${counter}`;
                    const newAvailability = await handleSystem.isHandleAvailable(newHandle);
                    if (newAvailability.available) {
                        handle = newHandle;
                        break;
                    }
                    counter++;
                } while (counter <= 10);
                
                // If still not available, use userId
                if (counter > 10) {
                    handle = `user${userId.substring(0, 8)}`;
                    console.log('Using fallback handle:', handle);
                }
            }
            
            // Claim the handle
            const result = await handleSystem.claimHandle(userId, handle, displayName);
            
            if (result.success) {
                console.log('Successfully created handle:', handle);
                return handle;
            } else {
                console.error('Failed to claim handle:', result.error);
                return null;
            }
            
        } catch (error) {
            console.error('Error creating user handle:', error);
            return null;
        }
    }

    generateHandleFromEmail(email, displayName) {
        // Try to use displayName first
        if (displayName && displayName.trim()) {
            // Clean the display name
            let handle = displayName.toLowerCase()
                .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
                .replace(/\s+/g, '_');    // Replace spaces with underscores
            
            // Ensure minimum length
            if (handle.length >= 3) {
                return handle.substring(0, 20); // Limit to 20 chars
            }
        }
        
        // Use email username as fallback
        if (email) {
            const username = email.split('@')[0];
            let handle = username.toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .replace(/\./g, '_');
            
            // Ensure minimum length
            if (handle.length >= 3) {
                return handle.substring(0, 20);
            }
        }
        
        // Fallback to generic
        return `user${Date.now().toString().slice(-6)}`;
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
        const handle = this.userProfile.handle || 'No handle set';
        
        return `
            <div class="profile-popup-container">
                <div class="profile-header">
                    <div class="profile-avatar-large" id="profile-avatar-large">
                        <img src="${photoURL}" alt="${displayName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff'">
                        <button class="avatar-upload-btn" id="avatar-upload-btn" title="Upload new profile picture">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="profile-info">
                        <div class="profile-name">${displayName}</div>
                        <div class="profile-handle">@${handle}</div>
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
                    
                    ${handle !== 'No handle set' ? `
                    <a href="https://aditya-cmd-max.github.io/profile/#@${handle}" target="_blank" class="profile-menu-item" id="profile-public">
                        <span class="profile-menu-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </span>
                        <span class="profile-menu-text">View Public Profile</span>
                    </a>
                    ` : ''}
                    
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
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .profile-handle {
                font-size: 14px;
                color: #1a73e8;
                font-weight: 500;
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
            
            /* Dark theme support */
            @media (prefers-color-scheme: dark) {
                .reverbit-profile-popup {
                    background: #202124;
                    border-color: #3c4043;
                }
                
                .profile-name {
                    color: #e8eaed;
                }
                
                .profile-handle {
                    color: #8ab4f8;
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
            
            /* Dark theme class support */
            .dark-theme .reverbit-profile-popup {
                background: #202124;
                border-color: #3c4043;
            }
            
            .dark-theme .profile-name {
                color: #e8eaed;
            }
            
            .dark-theme .profile-handle {
                color: #8ab4f8;
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
                    await userRef.set({
                        streak: 1,
                        lastActive: new Date().toISOString()
                    }, { merge: true });
                } else if (lastActive.getTime() < today.getTime()) {
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

    // NEW: Generate profile link
    async generateProfileLink() {
        if (!this.userProfile) {
            await this.loadUserProfile();
        }
        
        if (this.userProfile && this.userProfile.handle) {
            return `https://aditya-cmd-max.github.io/profile/#@${this.userProfile.handle}`;
        }
        
        return null;
    }

    // NEW: Get user handle
    getUserHandle() {
        return this.userProfile?.handle || null;
    }

    // NEW: Get user profile data
    getUserProfileData() {
        return this.userProfile;
    }

    // NEW: Update user profile
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

// NEW: Helper function to view public profile
window.viewPublicProfile = async function() {
    if (!window.ReverbitAuth) {
        console.error('Auth system not available');
        return;
    }
    
    const link = await window.ReverbitAuth.generateProfileLink();
    if (link) {
        window.open(link, '_blank');
    } else {
        // Show toast if handle not set
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
        toast.textContent = 'Please set up your profile handle first';
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }
};

// NEW: Debug function to check handles
window.debugUserHandle = async function() {
    console.log('=== DEBUG USER HANDLE ===');
    
    if (!window.ReverbitAuth) {
        console.error('Auth system not available');
        return;
    }
    
    const user = window.ReverbitAuth.getUser();
    console.log('Current user:', user);
    
    const profile = window.ReverbitAuth.getUserProfile();
    console.log('User profile:', profile);
    
    const handle = window.ReverbitAuth.getUserHandle();
    console.log('User handle:', handle);
    
    if (handle) {
        const profileLink = await window.ReverbitAuth.generateProfileLink();
        console.log('Profile link:', profileLink);
        
        // Test if handle exists in Firestore
        if (window.ReverbitHandleSystem && window.ReverbitHandleSystem.db) {
            const result = await window.ReverbitHandleSystem.getUserByHandle(handle);
            console.log('Handle system check:', result);
        }
    }
    
    console.log('=== END DEBUG ===');
};

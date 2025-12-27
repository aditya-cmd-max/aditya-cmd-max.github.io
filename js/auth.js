// auth.js - Enhanced Google-style Profile Popup with Unified Mobile/Desktop Support
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
        this.cleanupDuplicateAvatars = this.cleanupDuplicateAvatars.bind(this);
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
            
            // Clean up any duplicate avatars
            this.cleanupDuplicateAvatars();
            
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
                this.removeAvatars();
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
            
        } catch (error) {
            console.error('Error loading user profile:', error);
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

    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    updateAvatarUI() {
        // Create desktop avatar
        this.createDesktopAvatar();
        
        // Create mobile avatar
        this.createMobileAvatar();
    }

    createDesktopAvatar() {
        console.log('Creating desktop avatar...');
        
        // Remove existing desktop avatar
        if (this.desktopAvatar && this.desktopAvatar.parentNode) {
            this.desktopAvatar.parentNode.removeChild(this.desktopAvatar);
            this.desktopAvatar = null;
        }
        
        // Clean up any duplicate avatars first
        this.cleanupDuplicateAvatars();
        
        // Find desktop nav
        let desktopNav = document.querySelector('.desktop-nav');
        
        if (!desktopNav) {
            console.warn('Desktop navigation not found');
            return;
        }
        
        // Check if avatar already exists in the nav
        const existingAvatar = desktopNav.querySelector('.reverbit-profile-avatar.desktop');
        if (existingAvatar) {
            console.log('Desktop avatar already exists, reusing it');
            this.desktopAvatar = existingAvatar;
            
            // Update the avatar image
            const avatarImg = this.desktopAvatar.querySelector('.reverbit-avatar-img');
            if (avatarImg) {
                this.updateAvatarImage(avatarImg);
            } else {
                // Create new avatar image
                const newAvatarImg = document.createElement('img');
                newAvatarImg.className = 'reverbit-avatar-img';
                this.updateAvatarImage(newAvatarImg);
                this.desktopAvatar.innerHTML = '';
                this.desktopAvatar.appendChild(newAvatarImg);
            }
            
            return;
        }
        
        // Create new desktop avatar button
        this.desktopAvatar = document.createElement('button');
        this.desktopAvatar.className = 'reverbit-profile-avatar desktop';
        this.desktopAvatar.setAttribute('aria-label', 'User profile menu');
        this.desktopAvatar.setAttribute('title', 'Profile menu');
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        this.updateAvatarImage(avatarImg);
        this.desktopAvatar.appendChild(avatarImg);
        
        // Add click handler for popup
        this.desktopAvatar.addEventListener('click', (e) => {
            console.log('Desktop avatar clicked!');
            e.stopPropagation();
            e.preventDefault();
            this.toggleProfilePopup();
        });
        
        // Add double click handler for quick upload
        this.desktopAvatar.addEventListener('dblclick', (e) => {
            console.log('Desktop avatar double clicked!');
            e.stopPropagation();
            e.preventDefault();
            this.handleAvatarUpload();
        });
        
        // Find the correct position to insert the avatar
        // Should be placed before sign in button, after nav links
        const signInButton = desktopNav.querySelector('#signInButton');
        const themeToggle = desktopNav.querySelector('.theme-toggle');
        
        if (signInButton) {
            // Insert before sign in button
            desktopNav.insertBefore(this.desktopAvatar, signInButton);
            console.log('Desktop avatar inserted before sign in button');
        } else if (themeToggle) {
            // Insert before theme toggle
            desktopNav.insertBefore(this.desktopAvatar, themeToggle);
            console.log('Desktop avatar inserted before theme toggle');
        } else {
            // Fallback: append to end
            desktopNav.appendChild(this.desktopAvatar);
            console.log('Desktop avatar appended to nav');
        }
        
        console.log('Desktop avatar created successfully');
    }

    createMobileAvatar() {
        console.log('Creating mobile avatar...');
        
        // Clean up any duplicate avatars first
        this.cleanupDuplicateAvatars();
        
        // Get or create mobile avatar container
        let mobileAvatarContainer = document.getElementById('mobileProfileAvatar');
        
        // Remove existing mobile avatar if it exists but isn't ours
        if (mobileAvatarContainer && mobileAvatarContainer !== this.mobileAvatar) {
            if (mobileAvatarContainer.parentNode) {
                mobileAvatarContainer.parentNode.removeChild(mobileAvatarContainer);
            }
            mobileAvatarContainer = null;
        }
        
        if (!mobileAvatarContainer) {
            // Create mobile avatar button
            mobileAvatarContainer = document.createElement('button');
            mobileAvatarContainer.id = 'mobileProfileAvatar';
            mobileAvatarContainer.className = 'reverbit-profile-avatar mobile';
            mobileAvatarContainer.setAttribute('aria-label', 'User profile menu');
            mobileAvatarContainer.setAttribute('title', 'Profile menu');
            mobileAvatarContainer.style.display = 'none';
            
            // Insert into navbar (before mobile menu button)
            const mobileMenuBtn = document.getElementById('mobileMenuBtn');
            const floatingNavbar = document.querySelector('.floating-navbar');
            
            if (mobileMenuBtn && floatingNavbar) {
                // Insert before mobile menu button
                floatingNavbar.insertBefore(mobileAvatarContainer, mobileMenuBtn);
                console.log('Mobile avatar inserted before menu button');
            } else {
                console.warn('Mobile menu button or navbar not found');
                return;
            }
        }
        
        // Update content
        mobileAvatarContainer.innerHTML = '';
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        this.updateAvatarImage(avatarImg);
        mobileAvatarContainer.appendChild(avatarImg);
        
        // Add click handler for popup
        mobileAvatarContainer.addEventListener('click', (e) => {
            console.log('Mobile avatar clicked!');
            e.stopPropagation();
            e.preventDefault();
            this.toggleProfilePopup();
        });
        
        // Add double click handler for quick upload
        mobileAvatarContainer.addEventListener('dblclick', (e) => {
            console.log('Mobile avatar double clicked!');
            e.stopPropagation();
            e.preventDefault();
            this.handleAvatarUpload();
        });
        
        // Show the avatar
        mobileAvatarContainer.style.display = 'flex';
        this.mobileAvatar = mobileAvatarContainer;
        
        console.log('Mobile avatar created successfully');
    }

    cleanupDuplicateAvatars() {
        console.log('Cleaning up duplicate avatars...');
        
        // Remove any duplicate desktop avatars
        const desktopAvatars = document.querySelectorAll('.reverbit-profile-avatar.desktop');
        if (desktopAvatars.length > 1) {
            console.log(`Found ${desktopAvatars.length} desktop avatars, keeping only the first`);
            for (let i = 1; i < desktopAvatars.length; i++) {
                if (desktopAvatars[i] !== this.desktopAvatar && desktopAvatars[i].parentNode) {
                    desktopAvatars[i].parentNode.removeChild(desktopAvatars[i]);
                }
            }
        }
        
        // Remove any duplicate mobile avatars
        const mobileAvatars = document.querySelectorAll('.reverbit-profile-avatar.mobile, #mobileProfileAvatar');
        if (mobileAvatars.length > 1) {
            console.log(`Found ${mobileAvatars.length} mobile avatars, keeping only the first`);
            for (let i = 1; i < mobileAvatars.length; i++) {
                if (mobileAvatars[i] !== this.mobileAvatar && mobileAvatars[i].parentNode) {
                    mobileAvatars[i].parentNode.removeChild(mobileAvatars[i]);
                }
            }
        }
        
        // Hide the profile avatar container if it exists
        const profileContainer = document.getElementById('profileAvatarContainer');
        if (profileContainer) {
            profileContainer.style.display = 'none';
            console.log('Hidden profile avatar container');
        }
        
        // Remove any other profile avatars not created by this class
        const allAvatars = document.querySelectorAll('[class*="avatar"], [id*="avatar"], [id*="Avatar"]');
        allAvatars.forEach(avatar => {
            if (!avatar.classList.contains('reverbit-profile-avatar') && 
                avatar.id !== 'mobileProfileAvatar' &&
                !avatar.classList.contains('reverbit-avatar-img') &&
                !avatar.classList.contains('profile-avatar-large') &&
                avatar.parentNode && 
                (avatar.parentNode.classList.contains('desktop-nav') || 
                 avatar.parentNode.classList.contains('floating-navbar'))) {
                console.log('Removing non-Reverbit avatar:', avatar);
                avatar.parentNode.removeChild(avatar);
            }
        });
    }

    updateAvatarImage(avatarImg) {
        if (!this.userProfile) return;
        
        const photoURL = this.userProfile.photoURL || 
                       `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userProfile.displayName || 'User')}&background=4285f4&color=fff`;
        
        avatarImg.src = photoURL + (photoURL.includes('?') ? '&' : '?') + 't=' + Date.now();
        avatarImg.alt = this.userProfile.displayName || 'Profile';
        
        avatarImg.onerror = function() {
            const displayName = this.userProfile?.displayName || 'User';
            const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4285f4&color=fff`;
            
            // If still fails, use fallback
            avatarImg.onerror = function() {
                avatarImg.style.display = 'none';
                const parent = avatarImg.parentElement;
                if (parent) {
                    parent.textContent = initials;
                    parent.style.background = 'linear-gradient(135deg, #4285f4, #34a853)';
                    parent.style.color = '#FFFFFF';
                    parent.style.display = 'flex';
                    parent.style.alignItems = 'center';
                    parent.style.justifyContent = 'center';
                    parent.style.fontWeight = '600';
                }
            };
        }.bind(this);
    }

    removeAvatars() {
        console.log('Removing avatars...');
        
        // Remove desktop avatar
        if (this.desktopAvatar && this.desktopAvatar.parentNode) {
            this.desktopAvatar.parentNode.removeChild(this.desktopAvatar);
            this.desktopAvatar = null;
        }
        
        // Remove mobile avatar
        if (this.mobileAvatar && this.mobileAvatar.parentNode) {
            this.mobileAvatar.parentNode.removeChild(this.mobileAvatar);
            this.mobileAvatar = null;
        }
        
        // Also remove any other avatars that might exist
        const desktopAvatars = document.querySelectorAll('.reverbit-profile-avatar.desktop');
        desktopAvatars.forEach(avatar => {
            if (avatar.parentNode) {
                avatar.parentNode.removeChild(avatar);
            }
        });
        
        const mobileAvatars = document.querySelectorAll('.reverbit-profile-avatar.mobile, #mobileProfileAvatar');
        mobileAvatars.forEach(avatar => {
            if (avatar.parentNode) {
                avatar.parentNode.removeChild(avatar);
            }
        });
        
        // Remove file input
        if (this.avatarUploadInput && this.avatarUploadInput.parentNode) {
            this.avatarUploadInput.parentNode.removeChild(this.avatarUploadInput);
            this.avatarUploadInput = null;
        }
        
        console.log('Avatars removed');
    }

    async handleAvatarUpload() {
        if (!this.user) {
            console.log('No user logged in, cannot upload avatar');
            return;
        }
        
        if (!this.avatarUploadInput) {
            // Create file input if it doesn't exist
            this.avatarUploadInput = document.createElement('input');
            this.avatarUploadInput.type = 'file';
            this.avatarUploadInput.accept = 'image/*';
            this.avatarUploadInput.style.display = 'none';
            this.avatarUploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.uploadProfilePicture(file);
                }
                // Reset the input so the same file can be selected again
                this.avatarUploadInput.value = '';
            });
            document.body.appendChild(this.avatarUploadInput);
        }
        
        console.log('Opening file picker for avatar upload');
        this.avatarUploadInput.click();
    }

    async uploadProfilePicture(file) {
        if (!this.user || !file) {
            console.log('No user or file selected');
            return;
        }
        
        try {
            console.log('Starting profile picture upload...');
            
            // Show loading state
            if (this.desktopAvatar) this.desktopAvatar.classList.add('uploading');
            if (this.mobileAvatar) this.mobileAvatar.classList.add('uploading');
            
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
            
            console.log('Uploading to Cloudinary...');
            const response = await fetch(cloudinaryUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Cloudinary upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Cloudinary upload successful:', result);
            
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
            this.updateAvatarUI();
            
            // Show success message
            this.showToast('Profile picture updated successfully!', 'success');
            
            // Refresh profile popup if open
            if (this.profilePopup && this.profilePopup.style.display === 'block') {
                this.profilePopup.innerHTML = this.getPopupHTML();
                this.attachPopupEventListeners();
            }
            
            console.log('Profile picture update complete');
            
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            this.showToast('Failed to upload profile picture. Please try again.', 'error');
        } finally {
            if (this.desktopAvatar) this.desktopAvatar.classList.remove('uploading');
            if (this.mobileAvatar) this.mobileAvatar.classList.remove('uploading');
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
        
        console.log('Attaching popup event listeners...');
        
        // Sign out button
        const signoutBtn = this.profilePopup.querySelector('#profile-signout');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Sign out clicked');
                this.logout();
            });
        }
        
        // Avatar upload buttons
        const avatarUploadBtn = this.profilePopup.querySelector('#avatar-upload-btn');
        const profileAvatarLarge = this.profilePopup.querySelector('#profile-avatar-large');
        
        if (avatarUploadBtn) {
            avatarUploadBtn.addEventListener('click', (e) => {
                console.log('Popup avatar upload button clicked');
                e.stopPropagation();
                e.preventDefault();
                this.handleAvatarUpload();
            });
        }
        
        if (profileAvatarLarge) {
            profileAvatarLarge.addEventListener('click', (e) => {
                if (e.target === profileAvatarLarge || e.target.tagName === 'IMG') {
                    console.log('Popup avatar image clicked');
                    e.stopPropagation();
                    e.preventDefault();
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
        console.log('Toggling profile popup...');
        
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
        
        console.log('Showing profile popup');
        
        // Update popup content
        this.profilePopup.innerHTML = this.getPopupHTML();
        this.attachPopupEventListeners();
        
        // Position popup based on device
        if (window.innerWidth <= 768) {
            // Mobile positioning - center on screen
            this.profilePopup.style.top = '50%';
            this.profilePopup.style.left = '50%';
            this.profilePopup.style.transform = 'translate(-50%, -50%)';
            this.profilePopup.style.right = 'auto';
            console.log('Mobile popup positioning');
        } else {
            // Desktop positioning - position relative to avatar
            const avatar = this.desktopAvatar || this.mobileAvatar;
            if (avatar) {
                const avatarRect = avatar.getBoundingClientRect();
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
                this.profilePopup.style.transform = 'none';
                this.profilePopup.style.left = 'auto';
                console.log('Desktop popup positioned at:', top, right);
            }
        }
        
        this.profilePopup.style.display = 'block';
        
        // Add active class for animation
        setTimeout(() => {
            this.profilePopup.classList.add('active');
        }, 10);
    }

    hideProfilePopup() {
        if (!this.profilePopup) return;
        
        console.log('Hiding profile popup');
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
            console.log('Clicked outside popup, hiding it');
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
        console.log(`Showing toast: ${message} (${type})`);
        
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
            /* Enhanced Google-style Profile System - Unified for Mobile/Desktop */
            
            /* Base avatar styles */
            .reverbit-profile-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid transparent;
                padding: 2px;
                background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335) border-box;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
                flex-shrink: 0;
                margin: 0 12px;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .reverbit-profile-avatar.desktop {
                order: 5; /* Place after nav links, before sign in button */
            }
            
            .reverbit-profile-avatar.mobile {
                margin: 0 12px;
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
            
            .reverbit-profile-avatar.uploading .reverbit-avatar-img {
                opacity: 0.7;
            }
            
            /* Hide duplicate avatars */
            .reverbit-profile-avatar.desktop ~ .reverbit-profile-avatar.desktop {
                display: none !important;
            }
            
            #mobileProfileAvatar ~ #mobileProfileAvatar {
                display: none !important;
            }
            
            /* Mobile avatar positioning */
            @media (max-width: 1024px) {
                .reverbit-profile-avatar.mobile {
                    display: none;
                }
                
                body.user-signed-in .reverbit-profile-avatar.mobile {
                    display: flex !important;
                }
                
                /* Adjust navbar layout for mobile */
                .floating-navbar {
                    justify-content: space-between;
                }
                
                /* Order of elements in mobile navbar */
                .nav-brand {
                    order: 1;
                    flex-grow: 1;
                }
                
                #mobileProfileAvatar {
                    order: 2;
                }
                
                #mobileMenuBtn {
                    order: 3;
                }
            }
            
            @media (max-width: 768px) {
                .reverbit-profile-avatar.mobile {
                    width: 36px;
                    height: 36px;
                    margin: 0 8px;
                }
            }
            
            @media (max-width: 480px) {
                .reverbit-profile-avatar.mobile {
                    width: 32px;
                    height: 32px;
                    margin: 0 6px;
                }
            }
            
            /* Enhanced Profile Popup */
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
                padding: 28px;
            }
            
            .profile-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 20px;
                padding-bottom: 24px;
                position: relative;
            }
            
            .profile-info {
                flex: 1;
                min-width: 0;
            }
            
            .profile-greeting {
                font-size: 18px;
                color: #5f6368;
                margin-bottom: 8px;
                font-weight: 400;
                letter-spacing: 0.2px;
            }
            
            .profile-name {
                font-size: 28px;
                font-weight: 500;
                color: #202124;
                line-height: 1.3;
                margin-bottom: 4px;
                display: flex;
                align-items: baseline;
                gap: 4px;
            }
            
            .animated-gradient-text {
                background: linear-gradient(90deg, #4285f4, #34a853, #fbbc05, #ea4335, #4285f4);
                background-size: 400% 400%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: gradientMove 8s ease infinite;
            }
            
            @keyframes gradientMove {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            .profile-exclamation {
                font-size: 28px;
                color: #4285f4;
                font-weight: 600;
            }
            
            .profile-email {
                font-size: 15px;
                color: #5f6368;
                line-height: 1.4;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .profile-avatar-large {
                width: 72px;
                height: 72px;
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
                box-shadow: 0 6px 20px rgba(66, 133, 244, 0.3);
            }
            
            .profile-avatar-large img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .avatar-upload-btn {
                position: absolute;
                bottom: -4px;
                right: -4px;
                width: 32px;
                height: 32px;
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
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }
            
            .profile-avatar-large:hover .avatar-upload-btn {
                opacity: 1;
                transform: scale(1.1);
            }
            
            .avatar-upload-btn svg {
                width: 16px;
                height: 16px;
            }
            
            .profile-divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
                margin: 20px 0;
            }
            
            .profile-menu {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .profile-menu-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 14px 16px;
                border-radius: 12px;
                text-decoration: none;
                color: #202124;
                font-size: 15px;
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
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
            }
            
            .privacy-link {
                font-size: 13px;
                color: #5f6368;
                text-align: center;
                display: flex;
                justify-content: center;
                gap: 12px;
                align-items: center;
            }
            
            .privacy-link a {
                color: #4285f4;
                text-decoration: none;
                font-weight: 500;
                transition: all 0.3s ease;
                padding: 4px 8px;
                border-radius: 6px;
            }
            
            .privacy-link a:hover {
                background: #e8f0fe;
                color: #1a73e8;
                text-decoration: none;
            }
            
            /* Mobile popup adjustments */
            @media (max-width: 768px) {
                .reverbit-profile-popup {
                    position: fixed;
                    top: 50% !important;
                    left: 50% !important;
                    right: auto !important;
                    bottom: auto !important;
                    transform: translate(-50%, -50%) scale(0.95) !important;
                    width: calc(100vw - 40px);
                    max-width: 400px;
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
                    gap: 16px;
                }
                
                .profile-name {
                    font-size: 24px;
                }
                
                .profile-avatar-large {
                    width: 64px;
                    height: 64px;
                }
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
            
            /* Dark theme support */
            @media (prefers-color-scheme: dark) {
                .reverbit-profile-popup {
                    background: #202124;
                    border-color: #3c4043;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
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
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
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
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    async logout() {
        try {
            console.log('Logging out...');
            await this.auth.signOut();
            localStorage.removeItem('reverbit_user');
            
            // Remove UI elements
            this.removeAvatars();
            this.removeProfilePopup();
            
            // Remove body class
            document.body.classList.remove('user-signed-in');
            
            // Show toast message
            this.showToast('Signed out successfully', 'success');
            
            // Redirect to home page after a short delay
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 1500);
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Error signing out. Please try again.', 'error');
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

    async generateProfileLink() {
        if (!this.user) {
            await this.loadUserProfile();
        }
        
        if (this.user) {
            return `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
        }
        
        return null;
    }

    getUserUsername() {
        return this.userProfile?.username || null;
    }

    getUserProfileData() {
        return this.userProfile;
    }

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

// Auto-initialize with better error handling
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing ReverbitAuth...');
        
        // Wait for Firebase to be available
        if (typeof firebase === 'undefined') {
            console.error('Firebase not loaded yet, retrying...');
            setTimeout(() => {
                window.ReverbitAuth.init();
            }, 1000);
            return;
        }
        
        await window.ReverbitAuth.init();
        
        const user = window.ReverbitAuth.getUser();
        if (user) {
            console.log('User is signed in:', user.email);
            
            // Track usage for current app
            const appName = getCurrentAppName();
            if (appName) {
                window.ReverbitAuth.trackUsage(appName, 1);
                
                // Update usage every 5 minutes
                setInterval(() => {
                    window.ReverbitAuth.trackUsage(appName, 5);
                }, 5 * 60 * 1000);
            }
        } else {
            console.log('No user signed in');
        }
    } catch (error) {
        console.error('Auth initialization failed:', error);
        
        // Try to initialize again after a delay
        setTimeout(() => {
            window.ReverbitAuth.init();
        }, 2000);
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
        this.showToast('Auth system not available', 'error');
        return;
    }
    
    const link = await window.ReverbitAuth.generateProfileLink();
    if (link) {
        window.open(link, '_blank');
    } else {
        window.ReverbitAuth.showToast('Please sign in first', 'error');
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

// Add global cleanup function
window.cleanupReverbitAvatars = function() {
    if (window.ReverbitAuth && window.ReverbitAuth.cleanupDuplicateAvatars) {
        window.ReverbitAuth.cleanupDuplicateAvatars();
    }
};

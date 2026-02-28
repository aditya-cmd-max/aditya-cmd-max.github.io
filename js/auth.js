// auth.js - Advanced Google-style Profile System with Dark Mode & Cloudinary
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
        this.profileAvatar = null;
        this.avatarUploadInput = null;
        this.currentTheme = 'auto';
        this.isDarkMode = false;
        this.authListeners = [];
        this.profileObservers = [];
        this.themeObserver = null;
        
        // Performance tracking
        this.lastUpdate = 0;
        this.updateInterval = null;
        
        // Bind methods
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.uploadProfilePicture = this.uploadProfilePicture.bind(this);
        this.handleAvatarUpload = this.handleAvatarUpload.bind(this);
        this.applyTheme = this.applyTheme.bind(this);
        this.toggleTheme = this.toggleTheme.bind(this);
        this.logout = this.logout.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
    }

    async init() {
        if (this.initialized) {
            console.log('Auth: Already initialized');
            return;
        }
        
        try {
            console.log('Auth: Initializing advanced system...');
            
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
                console.log('Auth: Firebase initialized');
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            this.storage = firebase.storage();
            
            // Enable Firestore persistence
            try {
                await this.db.enablePersistence({ synchronizeTabs: true });
                console.log('Auth: Firestore persistence enabled');
            } catch (persistenceError) {
                console.warn('Auth: Firestore persistence not supported:', persistenceError);
            }
            
            // Initialize Cloudinary
            this.initCloudinaryWidget();
            
            // Setup auth listener
            this.setupAuthListener();
            
            // Check existing session
            await this.checkExistingSession();
            
            // Initialize theme system
            this.initThemeSystem();
            
            // Add styles
            this.injectStyles();
            
            // Setup visibility change listener
            this.setupVisibilityListener();
            
            // Setup periodic updates
            this.setupPeriodicUpdates();
            
            this.initialized = true;
            console.log('Auth: Advanced initialization complete');
            
            // Notify listeners
            this.notifyAuthListeners();
            
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.showToast('Failed to initialize authentication system', 'error');
        }
    }

    // ================= THEME MANAGEMENT =================
    detectPageTheme() {
        // Check for common theme indicators
        const checks = [
            // Body classes
            () => document.body.classList.contains('dark-mode'),
            () => document.body.classList.contains('dark-theme'),
            () => document.body.classList.contains('dark'),
            
            // HTML element attributes
            () => document.documentElement.getAttribute('data-theme') === 'dark',
            () => document.documentElement.classList.contains('dark'),
            
            // CSS custom properties
            () => getComputedStyle(document.documentElement).getPropertyValue('--theme') === 'dark',
            
            // Meta theme-color
            () => {
                const metaTheme = document.querySelector('meta[name="theme-color"]');
                if (metaTheme) {
                    const color = metaTheme.getAttribute('content');
                    return color && color.toLowerCase().includes('dark');
                }
                return false;
            },
            
            // Background color analysis
            () => {
                const bgColor = getComputedStyle(document.body).backgroundColor;
                const rgb = bgColor.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
                    return brightness < 128;
                }
                return false;
            }
        ];
        
        for (const check of checks) {
            try {
                if (check()) {
                    return 'dark';
                }
            } catch (e) {
                // Continue checking
            }
        }
        
        return 'light';
    }

    initThemeSystem() {
        console.log('Auth: Initializing theme system...');
        
        // Detect page theme first
        const pageTheme = this.detectPageTheme();
        const savedTheme = localStorage.getItem('reverbit_theme');
        
        if (pageTheme) {
            this.currentTheme = pageTheme;
            console.log('Auth: Detected page theme:', pageTheme);
        } else if (savedTheme) {
            this.currentTheme = savedTheme;
            console.log('Auth: Using saved theme:', savedTheme);
        } else if (this.userProfile && this.userProfile.theme) {
            this.currentTheme = this.userProfile.theme;
            console.log('Auth: Using profile theme:', this.userProfile.theme);
        } else {
            this.currentTheme = 'auto';
            console.log('Auth: Using auto theme detection');
        }
        
        // Apply theme immediately to prevent flash
        this.applyTheme();
        
        // Listen for page theme changes
        this.setupThemeObserver();
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                console.log('Auth: System theme changed, updating...');
                this.applyTheme();
            }
        });
        
        console.log('Auth: Theme system initialized with:', this.currentTheme);
    }

    setupThemeObserver() {
        // Create a MutationObserver to watch for theme class changes
        this.themeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme')) {
                    const newTheme = this.detectPageTheme();
                    if (newTheme && newTheme !== this.currentTheme) {
                        this.currentTheme = newTheme;
                        this.applyTheme();
                        console.log('Auth: Detected theme change:', newTheme);
                    }
                }
            });
        });
        
        // Start observing body and html element
        const config = { attributes: true, attributeFilter: ['class', 'data-theme'] };
        this.themeObserver.observe(document.body, config);
        this.themeObserver.observe(document.documentElement, config);
    }

    applyTheme() {
        // Check if page already has theme classes
        const pageTheme = this.detectPageTheme();
        
        if (pageTheme === 'dark') {
            this.currentTheme = 'dark';
            this.isDarkMode = true;
        } else if (pageTheme === 'light') {
            this.currentTheme = 'light';
            this.isDarkMode = false;
        } else {
            // Fall back to saved preference or auto detection
            switch (this.currentTheme) {
                case 'dark':
                    this.isDarkMode = true;
                    break;
                case 'light':
                    this.isDarkMode = false;
                    break;
                case 'auto':
                default:
                    this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    break;
            }
        }
        
        // Store preference
        localStorage.setItem('reverbit_theme', this.currentTheme);
        localStorage.setItem('reverbit_dark_mode', this.isDarkMode.toString());
        
        // Update popup if open
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.updatePopupTheme();
        }
        
        // Notify observers
        this.notifyThemeObservers();
        
        console.log('Auth: Theme applied -', this.currentTheme, '(dark:', this.isDarkMode, ')');
    }

    async toggleTheme(theme = null) {
        if (theme) {
            this.currentTheme = theme;
        }
        
        // Apply the theme
        this.applyTheme();
        
        // Save to user profile if logged in
        if (this.user && this.db) {
            try {
                await this.db.collection('users').doc(this.user.uid).update({
                    theme: this.currentTheme,
                    updatedAt: new Date().toISOString()
                });
                
                if (this.userProfile) {
                    this.userProfile.theme = this.currentTheme;
                    localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
                }
                
                this.showToast(`Theme set to ${this.currentTheme}`, 'success');
            } catch (error) {
                console.error('Error saving theme preference:', error);
            }
        }
        
        // Update popup if open
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.updatePopupTheme();
        }
    }

    updatePopupTheme() {
        if (this.profilePopup) {
            // Recreate popup with updated theme
            const wasVisible = this.profilePopup.style.display === 'block';
            this.removeProfilePopup();
            
            if (wasVisible) {
                setTimeout(() => {
                    this.createProfilePopup();
                    this.showProfilePopup();
                }, 10);
            }
        }
    }

    notifyThemeObservers() {
        this.profileObservers.forEach(observer => {
            if (observer.onThemeChange) {
                try {
                    observer.onThemeChange(this.currentTheme, this.isDarkMode);
                } catch (error) {
                    console.error('Theme observer error:', error);
                }
            }
        });
    }

    // ================= AUTH LISTENERS =================
    addAuthListener(callback) {
        if (typeof callback === 'function') {
            this.authListeners.push(callback);
            if (this.initialized) {
                callback(this.user, this.userProfile);
            }
        }
    }

    removeAuthListener(callback) {
        const index = this.authListeners.indexOf(callback);
        if (index > -1) {
            this.authListeners.splice(index, 1);
        }
    }

    addProfileObserver(observer) {
        if (observer && typeof observer === 'object') {
            this.profileObservers.push(observer);
        }
    }

    notifyAuthListeners() {
        this.authListeners.forEach(callback => {
            try {
                callback(this.user, this.userProfile);
            } catch (error) {
                console.error('Auth listener error:', error);
            }
        });
    }

    // ================= CLOUDINARY =================
    initCloudinaryWidget() {
        if (!window.cloudinary) {
            console.log('Auth: Loading Cloudinary widget...');
            const script = document.createElement('script');
            script.src = 'https://upload-widget.cloudinary.com/global/all.js';
            script.async = true;
            script.onload = () => console.log('Auth: Cloudinary widget loaded');
            script.onerror = (error) => console.error('Auth: Failed to load Cloudinary:', error);
            document.head.appendChild(script);
        }
    }

    // ================= AUTH STATE MANAGEMENT =================
    setupAuthListener() {
        console.log('Auth: Setting up auth state listener...');
        
        this.auth.onAuthStateChanged(async (user) => {
            console.log('Auth: Auth state changed -', user ? 'User logged in' : 'User logged out');
            
            if (user) {
                this.user = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email?.split('@')[0] || 'User',
                    photoURL: user.photoURL,
                    emailVerified: user.emailVerified,
                    providerId: user.providerId,
                    metadata: {
                        creationTime: user.metadata.creationTime,
                        lastSignInTime: user.metadata.lastSignInTime
                    }
                };
                
                console.log('Auth: Loading profile for UID:', user.uid);
                
                try {
                    await this.loadUserProfile();
                    
                    // Store in localStorage
                    localStorage.setItem('reverbit_user', JSON.stringify(this.user));
                    localStorage.setItem('reverbit_user_uid', user.uid);
                    localStorage.setItem('reverbit_user_email', user.email);
                    
                    // Apply user's theme
                    if (this.userProfile?.theme) {
                        this.currentTheme = this.userProfile.theme;
                        this.applyTheme();
                    }
                    
                    // Add profile avatar to UI
                    this.addOrUpdateProfileAvatar();
                    
                    // Track login
                    await this.trackLogin();
                    
                    // Update last active
                    await this.updateLastActive();
                    
                    console.log('Auth: User fully loaded:', this.user.email);
                    
                    // Show welcome for new users
                    this.showWelcomeMessage();
                    
                } catch (profileError) {
                    console.error('Auth: Profile loading failed:', profileError);
                    this.showToast('Failed to load user profile', 'error');
                }
                
            } else {
                console.log('Auth: User signed out');
                this.user = null;
                this.userProfile = null;
                
                // Clear localStorage
                localStorage.removeItem('reverbit_user');
                localStorage.removeItem('reverbit_user_uid');
                localStorage.removeItem('reverbit_user_email');
                localStorage.removeItem('reverbit_user_profile');
                
                // Remove UI elements
                this.removeProfileAvatar();
                this.removeProfilePopup();
                
                // Reset theme to auto
                this.currentTheme = 'auto';
                this.applyTheme();
            }
            
            // Notify listeners
            this.notifyAuthListeners();
            
            // Notify profile observers
            this.profileObservers.forEach(observer => {
                if (observer.onAuthStateChange) {
                    try {
                        observer.onAuthStateChange(this.user, this.userProfile);
                    } catch (error) {
                        console.error('Profile observer error:', error);
                    }
                }
            });
        });
    }

    async checkExistingSession() {
        try {
            const userData = localStorage.getItem('reverbit_user');
            const userUid = localStorage.getItem('reverbit_user_uid');
            const savedTheme = localStorage.getItem('reverbit_theme');
            
            // Apply saved theme immediately
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
                        console.log('Auth: Session valid, loading profile...');
                        await this.loadUserProfile();
                        
                        if (this.userProfile?.theme) {
                            this.currentTheme = this.userProfile.theme;
                            this.applyTheme();
                        }
                        
                        this.addOrUpdateProfileAvatar();
                    } else {
                        console.log('Auth: Session expired, clearing...');
                        this.clearSession();
                    }
                } catch (sessionError) {
                    console.warn('Auth: Session check failed:', sessionError);
                    this.clearSession();
                }
            } else {
                console.log('Auth: No existing session found');
            }
        } catch (error) {
            console.error('Session check error:', error);
            this.clearSession();
        }
    }

    clearSession() {
        localStorage.clear();
        this.user = null;
        this.userProfile = null;
        this.removeProfileAvatar();
        this.removeProfilePopup();
    }

    // ================= PROFILE MANAGEMENT =================
    async loadUserProfile() {
        if (!this.user || !this.db) {
            console.error('Auth: Cannot load profile - no user or db');
            return;
        }
        
        try {
            console.log('Auth: Loading profile from Firestore...');
            const userRef = this.db.collection('users').doc(this.user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                this.userProfile.uid = this.user.uid;
                console.log('Auth: Loaded existing profile for:', this.user.email);
                
                // Ensure all required fields exist
                this.ensureProfileFields();
                
            } else {
                console.log('Auth: Creating new profile for:', this.user.email);
                await this.createNewProfile(userRef);
            }
            
            // Cache in localStorage
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            
            // Update UI if avatar exists
            if (this.profileAvatar) {
                this.updateProfileAvatar();
            }
            
            // Notify profile observers
            this.profileObservers.forEach(observer => {
                if (observer.onProfileLoad) {
                    try {
                        observer.onProfileLoad(this.userProfile);
                    } catch (error) {
                        console.error('Profile load observer error:', error);
                    }
                }
            });
            
        } catch (error) {
            console.error('Auth: Profile loading error:', error);
            await this.handleProfileError(error);
        }
    }

    async createNewProfile(userRef) {
        const displayName = this.user.displayName || 
                          this.user.email?.split('@')[0] || 
                          'User';
        
        const username = this.generateUsername(displayName, this.user.email);
        const timestamp = new Date().toISOString();
        
        this.userProfile = {
            uid: this.user.uid,
            email: this.user.email,
            displayName: displayName,
            username: username,
            photoURL: this.user.photoURL || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true&size=256`,
            isPublic: true,
            createdAt: timestamp,
            updatedAt: timestamp,
            theme: this.currentTheme,
            bio: '',
            country: '',
            gender: '',
            showApps: true,
            streak: 0,
            totalLogins: 1,
            cloudinaryImageId: null,
            lastLogin: timestamp,
            lastActive: timestamp,
            preferences: {
                notifications: true,
                emailUpdates: true,
                autoSave: true
            }
        };
        
        console.log('Auth: Creating profile with data:', this.userProfile);
        
        try {
            await userRef.set(this.userProfile);
            console.log('Auth: Profile created successfully');
            
            // Show welcome message
            this.showToast(`Welcome to Reverbit, ${displayName}!`, 'success');
            
        } catch (createError) {
            console.error('Auth: Profile creation failed:', createError);
            throw createError;
        }
    }

    ensureProfileFields() {
        const defaults = {
            theme: 'auto',
            bio: '',
            country: '',
            gender: '',
            showApps: true,
            streak: 0,
            totalLogins: this.userProfile.totalLogins || 1,
            preferences: this.userProfile.preferences || {
                notifications: true,
                emailUpdates: true,
                autoSave: true
            }
        };
        
        let updated = false;
        for (const [key, value] of Object.entries(defaults)) {
            if (this.userProfile[key] === undefined) {
                this.userProfile[key] = value;
                updated = true;
            }
        }
        
        if (updated) {
            console.log('Auth: Added missing profile fields');
            this.saveProfileUpdate();
        }
    }

    generateUsername(displayName, email) {
        let base = displayName.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 15);
        
        if (base.length < 3) {
            base = email?.split('@')[0]?.toLowerCase() || 'user';
        }
        
        // Add random suffix to ensure uniqueness
        const suffix = Math.random().toString(36).substring(2, 6);
        return `${base}_${suffix}`;
    }

    async handleProfileError(error) {
        console.error('Auth: Profile error handler activated');
        
        // Try to load from localStorage
        const storedProfile = localStorage.getItem('reverbit_user_profile');
        if (storedProfile) {
            this.userProfile = JSON.parse(storedProfile);
            console.log('Auth: Loaded profile from localStorage cache');
            return;
        }
        
        // Create minimal fallback profile
        this.userProfile = {
            uid: this.user.uid,
            email: this.user.email,
            displayName: this.user.displayName || 'User',
            photoURL: this.user.photoURL || `https://ui-avatars.com/api/?name=User&background=4285f4&color=fff&bold=true`,
            isPublic: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            theme: this.currentTheme
        };
        
        console.log('Auth: Created fallback profile');
        
        // Try to save later
        setTimeout(async () => {
            try {
                await this.db.collection('users').doc(this.user.uid).set(this.userProfile, { merge: true });
                console.log('Auth: Fallback profile saved to Firestore');
            } catch (saveError) {
                console.error('Auth: Failed to save fallback profile:', saveError);
            }
        }, 5000);
    }

    async saveProfileUpdate() {
        if (!this.user || !this.db || !this.userProfile) return;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.update({
                ...this.userProfile,
                updatedAt: new Date().toISOString()
            });
            console.log('Auth: Profile updated in Firestore');
        } catch (error) {
            console.error('Auth: Failed to update profile:', error);
        }
    }

    // ================= VERIFICATION HELPERS =================
    getVerificationLevel() {
        if (!this.userProfile?.verified) return 'none';
        
        // Check for premium verification
        if (this.userProfile.verifiedLevel === 'premium' || this.userProfile.premiumVerified) {
            return 'premium';
        }
        
        // Check for admin verification
        if (this.userProfile.verifiedBy === 'admin' || this.userProfile.verifiedBy === 'adityajha1104@gmail.com') {
            return 'basic';
        }
        
        return this.userProfile.verifiedLevel || 'basic';
    }

    isVerified() {
        return this.getVerificationLevel() !== 'none';
    }

    getVerificationBadgeHTML(level = null) {
        const verificationLevel = level || this.getVerificationLevel();
        
        if (verificationLevel === 'none') return '';
        
        const isPremium = verificationLevel === 'premium';
        const icon = isPremium ? 'crown' : 'check-circle';
        const text = isPremium ? 'Premium Verified' : 'Verified';
        const colorClass = isPremium ? 'premium' : '';
        
        return `
            <div class="verified-badge-popup ${colorClass}" title="${isPremium ? 'Premium Verified Account' : 'Verified Account'}">
                <i class="fas fa-${icon}"></i>
                ${text}
            </div>
        `;
    }

    getAvatarBadgeHTML() {
        const verificationLevel = this.getVerificationLevel();
        
        if (verificationLevel === 'none') return '';
        
        const isPremium = verificationLevel === 'premium';
        const icon = isPremium ? 'crown' : 'check';
        const colorClass = isPremium ? 'premium' : '';
        
        return `
            <div class="avatar-verified-badge ${colorClass}" title="${isPremium ? 'Premium Verified Account' : 'Verified Account'}">
                <i class="fas fa-${icon}"></i>
            </div>
        `;
    }

    // ================= PROFILE AVATAR UI =================
    addOrUpdateProfileAvatar() {
        console.log('Auth: Managing profile avatar UI...');
        
        // Check if avatar already exists
        const existingAvatar = document.querySelector('.reverbit-profile-avatar');
        if (existingAvatar) {
            this.profileAvatar = existingAvatar;
            this.updateProfileAvatar();
            console.log('Auth: Updated existing avatar');
            return;
        }
        
        // Find or create header actions container
        let headerActions = document.querySelector('.header-actions');
        
        if (!headerActions) {
            console.log('Auth: Creating header actions container...');
            
            // Look for existing header
            const header = document.querySelector('.app-header, header, .header, nav.navbar, [role="banner"]');
            
            if (header) {
                headerActions = document.createElement('div');
                headerActions.className = 'header-actions';
                header.appendChild(headerActions);
            } else {
                // Create floating header
                this.createFloatingHeader();
                headerActions = document.querySelector('.reverbit-floating-header .header-actions');
            }
        }
        
        // Create avatar button
        this.createAvatarButton(headerActions);
        
        // Create file input for uploads
        this.createAvatarUploadInput();
        
        console.log('Auth: Avatar UI setup complete');
    }

    createFloatingHeader() {
        console.log('Auth: Creating floating header...');
        
        // Remove existing floating header
        const existingFloating = document.querySelector('.reverbit-floating-header');
        if (existingFloating) {
            existingFloating.remove();
        }
        
        // Create new floating header
        const floatingHeader = document.createElement('div');
        floatingHeader.className = 'reverbit-floating-header';
        floatingHeader.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 9998;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 12px;
            background: ${this.isDarkMode ? 'rgba(32, 33, 36, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
            backdrop-filter: blur(10px);
            border-radius: 12px;
            border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        `;
        
        const headerActions = document.createElement('div');
        headerActions.className = 'header-actions';
        headerActions.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        floatingHeader.appendChild(headerActions);
        document.body.appendChild(floatingHeader);
        
        // Add hover effects
        floatingHeader.addEventListener('mouseenter', () => {
            floatingHeader.style.transform = 'translateY(2px)';
            floatingHeader.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
        });
        
        floatingHeader.addEventListener('mouseleave', () => {
            floatingHeader.style.transform = 'translateY(0)';
            floatingHeader.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.1)';
        });
        
        console.log('Auth: Floating header created');
    }

    createAvatarButton(container) {
        this.profileAvatar = document.createElement('button');
        this.profileAvatar.className = 'reverbit-profile-avatar';
        this.profileAvatar.setAttribute('aria-label', 'User profile menu');
        this.profileAvatar.setAttribute('title', 'Profile menu');
        this.profileAvatar.setAttribute('role', 'button');
        this.profileAvatar.setAttribute('tabindex', '0');
        
        // Create avatar image container
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'reverbit-avatar-container';
        avatarContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
        `;
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        avatarImg.alt = 'Profile avatar';
        avatarImg.loading = 'lazy';
        
        // Create verification badge (if verified)
        if (this.isVerified()) {
            avatarContainer.innerHTML += this.getAvatarBadgeHTML();
        }
        
        // Create upload overlay
        const uploadOverlay = document.createElement('div');
        uploadOverlay.className = 'reverbit-avatar-upload-overlay';
        uploadOverlay.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            <span class="upload-text">Upload</span>
        `;
        
        // Create loading spinner
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'reverbit-avatar-loading';
        loadingSpinner.innerHTML = `
            <div class="spinner"></div>
        `;
        loadingSpinner.style.display = 'none';
        
        // Assemble avatar
        avatarContainer.appendChild(avatarImg);
        this.profileAvatar.appendChild(avatarContainer);
        this.profileAvatar.appendChild(uploadOverlay);
        this.profileAvatar.appendChild(loadingSpinner);
        
        // Add event listeners
        this.profileAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleProfilePopup();
        });
        
        this.profileAvatar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleProfilePopup();
            }
        });
        
        this.profileAvatar.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.handleAvatarUpload();
        });
        
        // Add hover effects
        this.profileAvatar.addEventListener('mouseenter', () => {
            this.profileAvatar.style.transform = 'scale(1.05)';
            uploadOverlay.style.opacity = '1';
        });
        
        this.profileAvatar.addEventListener('mouseleave', () => {
            this.profileAvatar.style.transform = 'scale(1)';
            uploadOverlay.style.opacity = '0';
        });
        
        // Add context menu for advanced options
        this.profileAvatar.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showAvatarContextMenu(e);
        });
        
        // Insert into container
        if (container.firstChild) {
            container.insertBefore(this.profileAvatar, container.firstChild);
        } else {
            container.appendChild(this.profileAvatar);
        }
        
        // Update avatar image
        this.updateProfileAvatar();
        
        console.log('Auth: Avatar button created');
    }

    createAvatarUploadInput() {
        // Remove existing input
        if (this.avatarUploadInput && this.avatarUploadInput.parentNode) {
            this.avatarUploadInput.parentNode.removeChild(this.avatarUploadInput);
        }
        
        this.avatarUploadInput = document.createElement('input');
        this.avatarUploadInput.type = 'file';
        this.avatarUploadInput.accept = 'image/*';
        this.avatarUploadInput.capture = 'user';
        this.avatarUploadInput.style.cssText = `
            position: absolute;
            opacity: 0;
            width: 1px;
            height: 1px;
            pointer-events: none;
        `;
        
        this.avatarUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.uploadProfilePicture(file);
            }
            e.target.value = '';
        });
        
        document.body.appendChild(this.avatarUploadInput);
    }

    updateProfileAvatar() {
        if (!this.profileAvatar || !this.userProfile) {
            console.warn('Auth: Cannot update avatar - missing elements');
            return;
        }
        
        const avatarImg = this.profileAvatar.querySelector('.reverbit-avatar-img');
        if (!avatarImg) return;
        
        const displayName = this.userProfile.displayName || 'User';
        let photoURL = this.userProfile.photoURL || 
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true&size=256`;
        
        // Add cache busting
        const cacheBuster = `t=${Date.now()}`;
        photoURL += (photoURL.includes('?') ? '&' : '?') + cacheBuster;
        
        // Set image source
        avatarImg.src = photoURL;
        avatarImg.alt = `${displayName}'s profile picture`;
        
        // Handle loading
        avatarImg.onload = () => {
            console.log('Auth: Avatar image loaded');
            this.profileAvatar.classList.remove('loading');
        };
        
        avatarImg.onerror = () => {
            console.warn('Auth: Avatar image failed to load, using fallback');
            const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4285f4&color=fff&bold=true`;
            this.profileAvatar.classList.remove('loading');
        };
        
        // Show loading state
        this.profileAvatar.classList.add('loading');
        
        // Update verification badge
        this.updateAvatarVerificationBadge();
        
        console.log('Auth: Avatar updated');
    }

    updateAvatarVerificationBadge() {
        const avatarContainer = this.profileAvatar.querySelector('.reverbit-avatar-container');
        if (!avatarContainer) return;
        
        // Remove existing badge
        const existingBadge = avatarContainer.querySelector('.avatar-verified-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Add new badge if verified
        if (this.isVerified()) {
            avatarContainer.innerHTML += this.getAvatarBadgeHTML();
        }
    }

    showAvatarContextMenu(event) {
        event.preventDefault();
        
        // Remove existing context menu
        const existingMenu = document.querySelector('.avatar-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'avatar-context-menu';
        contextMenu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            background: ${this.isDarkMode ? '#202124' : '#ffffff'};
            border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10001;
            min-width: 180px;
            overflow: hidden;
        `;
        
        const menuItems = [
            { icon: 'fa-upload', text: 'Upload Photo', action: () => this.handleAvatarUpload() },
            { icon: 'fa-camera', text: 'Take Photo', action: () => this.takePhoto() },
            { icon: 'fa-user-circle', text: 'View Profile', action: () => this.viewProfile() },
            { icon: 'fa-sign-out-alt', text: 'Sign Out', action: () => this.logout() }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('button');
            menuItem.className = 'context-menu-item';
            menuItem.style.cssText = `
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
                padding: 10px 16px;
                border: none;
                background: none;
                color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                font-family: inherit;
                font-size: 14px;
                text-align: left;
                cursor: pointer;
                transition: background-color 0.2s ease;
            `;
            
            menuItem.innerHTML = `
                <i class="fas ${item.icon}" style="width: 16px; height: 16px;"></i>
                <span>${item.text}</span>
            `;
            
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                contextMenu.remove();
            });
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.backgroundColor = this.isDarkMode ? '#2d2e31' : '#f8f9fa';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.backgroundColor = 'transparent';
            });
            
            contextMenu.appendChild(menuItem);
        });
        
        document.body.appendChild(contextMenu);
        
        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
        
        // Adjust position if near edge
        setTimeout(() => {
            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
            }
        }, 0);
    }

    // ================= PROFILE POPUP =================
    createProfilePopup() {
        console.log('Auth: Creating profile popup...');
        
        // Remove existing popup
        this.removeProfilePopup();
        
        // Create popup container
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup';
        this.profilePopup.setAttribute('role', 'dialog');
        this.profilePopup.setAttribute('aria-label', 'Profile menu');
        this.profilePopup.setAttribute('aria-modal', 'true');
        this.profilePopup.style.cssText = `
            display: none;
            opacity: 0;
            transform: scale(0.95);
            transition: opacity 0.2s ease, transform 0.2s ease;
        `;
        
        // Create popup content
        this.profilePopup.innerHTML = this.getPopupHTML();
        
        // Add to body
        document.body.appendChild(this.profilePopup);
        
        // Add event listeners
        setTimeout(() => {
            this.attachPopupEventListeners();
        }, 10);
        
        console.log('Auth: Profile popup created');
    }

    getPopupHTML() {
        if (!this.userProfile) {
            return `
                <div class="profile-popup-container">
                    <div class="profile-loading">
                        <div class="loading-spinner"></div>
                        <p>Loading profile...</p>
                    </div>
                </div>
            `;
        }
        
        const displayName = this.userProfile.displayName || 'User';
        const email = this.userProfile.email || '';
        const photoURL = this.userProfile.photoURL;
        const profileUrl = `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
        
        // Verification status
        const verificationLevel = this.getVerificationLevel();
        const isVerified = verificationLevel !== 'none';
        const verificationBadge = isVerified ? this.getVerificationBadgeHTML() : '';
        
        // Streak display
        const streak = this.userProfile.streak || 0;
        const streakDisplay = streak > 0 ? `<span class="streak-badge">${streak} day${streak !== 1 ? 's' : ''}</span>` : '';
        
        // Verified status text
        const verifiedStatus = isVerified ? 
            (verificationLevel === 'premium' ? 
                '<span class="verified-status premium">Premium Verified</span>' : 
                '<span class="verified-status">Verified</span>') : 
            '';
        
        return `
            <div class="profile-popup-container">
                <div class="profile-header">
                    <div class="profile-avatar-large" id="profile-avatar-large" role="button" tabindex="0" aria-label="Upload profile picture">
                        <div class="avatar-container">
                            <img src="${photoURL}" alt="${displayName}" 
                                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true'">
                            ${this.getAvatarBadgeHTML()}
                            ${streakDisplay}
                        </div>
                        <button class="avatar-upload-btn" id="avatar-upload-btn" title="Upload new profile picture">
                            <i class="fas fa-camera"></i>
                        </button>
                    </div>
                    <div class="profile-info">
                        <div class="profile-name-container">
                            <div class="profile-name">${displayName}</div>
                            ${verificationBadge}
                        </div>
                        <div class="profile-email">${email}</div>
                        <div class="profile-meta">
                            ${verifiedStatus}
                            <span class="meta-item">
                                <i class="fas fa-calendar"></i>
                                Joined ${this.formatDate(this.userProfile.createdAt)}
                            </span>
                            <span class="meta-item">
                                <i class="fas fa-clock"></i>
                                Last active ${this.formatRelativeTime(this.userProfile.lastActive)}
                            </span>
                        </div>
                        <button class="change-avatar-btn" id="change-avatar-btn">
                            <i class="fas fa-edit"></i>
                            Change profile picture
                        </button>
                    </div>
                </div>
                
                <div class="profile-divider"></div>
                
                <div class="profile-menu">
                    <a href="https://aditya-cmd-max.github.io/dashboard" class="profile-menu-item" id="profile-dashboard">
                        <span class="profile-menu-icon">
                            <i class="fas fa-tachometer-alt"></i>
                        </span>
                        <span class="profile-menu-text">Dashboard</span>
                        <span class="menu-arrow">›</span>
                    </a>
                    
                    <a href="${profileUrl}" target="_blank" class="profile-menu-item" id="profile-public">
                        <span class="profile-menu-icon">
                            <i class="fas fa-user"></i>
                        </span>
                        <span class="profile-menu-text">My Profile</span>
                        <span class="menu-arrow">›</span>
                    </a>
                    
                    ${isVerified ? `
                    <a href="${profileUrl}#verification" target="_blank" class="profile-menu-item" id="profile-verification">
                        <span class="profile-menu-icon">
                            <i class="fas fa-shield-alt"></i>
                        </span>
                        <span class="profile-menu-text">Verification</span>
                        <span class="menu-arrow">›</span>
                    </a>
                    ` : ''}
                    
                    <button class="profile-menu-item" id="settings-btn">
                        <span class="profile-menu-icon">
                            <i class="fas fa-cog"></i>
                        </span>
                        <span class="profile-menu-text">Settings</span>
                        <span class="menu-arrow">›</span>
                    </button>
                    
                    <div class="profile-divider"></div>
                    
                    <button class="profile-menu-item" id="profile-signout">
                        <span class="profile-menu-icon">
                            <i class="fas fa-sign-out-alt"></i>
                        </span>
                        <span class="profile-menu-text">Sign out</span>
                        <span class="menu-arrow">›</span>
                    </button>
                </div>
                
                <div class="profile-footer">
                    <div class="profile-stats">
                        <div class="stat-item">
                            <div class="stat-number">${this.userProfile.totalLogins || 1}</div>
                            <div class="stat-label">Logins</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${streak}</div>
                            <div class="stat-label">Streak</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${this.getMemberDays()}</div>
                            <div class="stat-label">Days</div>
                        </div>
                    </div>
                    <div class="privacy-link">
                        <a href="https://aditya-cmd-max.github.io/reverbit/privacy" target="_blank">Privacy</a>
                        •
                        <a href="https://aditya-cmd-max.github.io/reverbit/terms" target="_blank">Terms</a>
                        •
                        <a href="https://aditya-cmd-max.github.io/reverbit/help" target="_blank">Help</a>
                    </div>
                </div>
            </div>
        `;
    }

    attachPopupEventListeners() {
        if (!this.profilePopup) return;
        
        // Sign out
        const signoutBtn = this.profilePopup.querySelector('#profile-signout');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
        
        // Settings
        const settingsBtn = this.profilePopup.querySelector('#settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.open('https://aditya-cmd-max.github.io/dashboard#settings', '_blank');
            });
        }
        
        // Avatar upload buttons
        const changeAvatarBtn = this.profilePopup.querySelector('#change-avatar-btn');
        const avatarUploadBtn = this.profilePopup.querySelector('#avatar-upload-btn');
        const profileAvatarLarge = this.profilePopup.querySelector('#profile-avatar-large');
        
        const handleUpload = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleAvatarUpload();
        };
        
        if (changeAvatarBtn) changeAvatarBtn.addEventListener('click', handleUpload);
        if (avatarUploadBtn) avatarUploadBtn.addEventListener('click', handleUpload);
        if (profileAvatarLarge) profileAvatarLarge.addEventListener('click', handleUpload);
        
        // Keyboard navigation
        this.profilePopup.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideProfilePopup();
            }
        });
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
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
            console.error('Auth: Cannot show popup - missing elements');
            return;
        }
        
        // Update content
        this.profilePopup.innerHTML = this.getPopupHTML();
        this.attachPopupEventListeners();
        
        // Force a reflow to get accurate popup dimensions
        this.profilePopup.style.display = 'block';
        this.profilePopup.style.visibility = 'hidden';
        this.profilePopup.style.opacity = '0';
        
        // Get dimensions
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        const popupRect = this.profilePopup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Default position: below and aligned to left of avatar
        let top = avatarRect.bottom + 8;
        let left = avatarRect.left;
        
        // Calculate available space
        const spaceBelow = viewportHeight - avatarRect.bottom - 16;
        const spaceAbove = avatarRect.top - 16;
        const spaceRight = viewportWidth - avatarRect.right - 16;
        const spaceLeft = avatarRect.left - 16;
        
        console.log('Positioning debug:', {
            avatarRect,
            popupRect,
            viewportWidth,
            viewportHeight,
            spaceBelow,
            spaceAbove,
            spaceRight,
            spaceLeft
        });
        
        // ===== FIXED POSITIONING LOGIC =====
        
        // 1. Check if popup would go off the right edge
        if (left + popupRect.width > viewportWidth) {
            // Try to position from the right edge of the avatar
            left = avatarRect.right - popupRect.width;
            
            // If that still goes off left edge, position at right edge of viewport
            if (left < 16) {
                left = viewportWidth - popupRect.width - 16;
            }
        }
        
        // 2. Check if popup would go off the left edge
        if (left < 16) {
            left = 16;
        }
        
        // 3. Vertical positioning - check if enough space below
        if (spaceBelow < popupRect.height) {
            // Not enough space below, try above
            if (spaceAbove >= popupRect.height) {
                top = avatarRect.top - popupRect.height - 8;
            } else {
                // Not enough space above either, position at bottom of viewport
                top = viewportHeight - popupRect.height - 16;
            }
        }
        
        // 4. Ensure final position is within bounds
        left = Math.max(16, Math.min(left, viewportWidth - popupRect.width - 16));
        top = Math.max(16, Math.min(top, viewportHeight - popupRect.height - 16));
        
        console.log('Final position:', { top, left });
        
        // Apply position
        this.profilePopup.style.top = `${top}px`;
        this.profilePopup.style.left = `${left}px`;
        this.profilePopup.style.visibility = 'visible';
        
        // Animate in
        setTimeout(() => {
            this.profilePopup.style.opacity = '1';
            this.profilePopup.style.transform = 'scale(1)';
            
            // Focus first interactive element for accessibility
            const firstButton = this.profilePopup.querySelector('button, a');
            if (firstButton) firstButton.focus();
        }, 10);
        
        // Add backdrop
        this.addPopupBackdrop();
        
        console.log('Auth: Profile popup shown at', { top, left });
    }

    hideProfilePopup() {
        if (!this.profilePopup) return;
        
        // Animate out
        this.profilePopup.style.opacity = '0';
        this.profilePopup.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            this.profilePopup.style.display = 'none';
            this.removePopupBackdrop();
        }, 200);
    }

    addPopupBackdrop() {
        if (document.querySelector('.popup-backdrop')) return;
        
        const backdrop = document.createElement('div');
        backdrop.className = 'popup-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(2px);
            z-index: 9997;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        
        backdrop.addEventListener('click', () => this.hideProfilePopup());
        
        document.body.appendChild(backdrop);
        
        setTimeout(() => {
            backdrop.style.opacity = '1';
        }, 10);
    }

    removePopupBackdrop() {
        const backdrop = document.querySelector('.popup-backdrop');
        if (backdrop) {
            backdrop.style.opacity = '0';
            setTimeout(() => {
                if (backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
            }, 200);
        }
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
        
        this.removePopupBackdrop();
        document.removeEventListener('click', this.handleClickOutside);
    }

    // ================= AVATAR UPLOAD =================
    async handleAvatarUpload() {
        if (!this.avatarUploadInput) {
            console.error('Auth: Upload input not found');
            return;
        }
        
        if (!this.user) {
            this.showToast('Please sign in to upload photos', 'info');
            return;
        }
        
        this.avatarUploadInput.click();
    }

    async takePhoto() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showToast('Camera access not supported', 'error');
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            // Create camera interface
            this.showCameraInterface(stream);
            
        } catch (error) {
            console.error('Camera error:', error);
            this.showToast('Camera access denied', 'error');
        }
    }

    showCameraInterface(stream) {
        // Create camera modal
        const cameraModal = document.createElement('div');
        cameraModal.className = 'camera-modal';
        cameraModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 10002;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;
        
        const video = document.createElement('video');
        video.autoplay = true;
        video.style.cssText = `
            width: 90%;
            max-width: 500px;
            border-radius: 12px;
            background: #000;
        `;
        
        const controls = document.createElement('div');
        controls.style.cssText = `
            margin-top: 20px;
            display: flex;
            gap: 16px;
        `;
        
        const captureBtn = document.createElement('button');
        captureBtn.innerHTML = '<i class="fas fa-camera"></i> Take Photo';
        captureBtn.style.cssText = `
            padding: 12px 24px;
            background: #1a73e8;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 12px 24px;
            background: #5f6368;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        `;
        
        // Set video stream
        video.srcObject = stream;
        
        // Capture photo
        captureBtn.addEventListener('click', () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
                    await this.uploadProfilePicture(file);
                }
                
                // Cleanup
                stream.getTracks().forEach(track => track.stop());
                cameraModal.remove();
            }, 'image/jpeg', 0.9);
        });
        
        cancelBtn.addEventListener('click', () => {
            stream.getTracks().forEach(track => track.stop());
            cameraModal.remove();
        });
        
        controls.appendChild(captureBtn);
        controls.appendChild(cancelBtn);
        cameraModal.appendChild(video);
        cameraModal.appendChild(controls);
        document.body.appendChild(cameraModal);
    }

    async uploadProfilePicture(file) {
        if (!this.user || !file) {
            console.error('Auth: Cannot upload - no user or file');
            return;
        }
        
        // Validate file
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('Image must be less than 10MB', 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error');
            return;
        }
        
        try {
            // Show uploading state
            this.showUploadingState(true);
            this.showToast('Uploading profile picture...', 'info');
            
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            formData.append('cloud_name', this.cloudinaryConfig.cloudName);
            formData.append('folder', this.cloudinaryConfig.folder);
            
            // Upload to Cloudinary
            const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/upload`;
            
            console.log('Auth: Uploading to Cloudinary...');
            const response = await fetch(cloudinaryUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Auth: Cloudinary upload successful:', result);
            
            // Update user profile
            const photoURL = result.secure_url;
            const cloudinaryImageId = result.public_id;
            
            // Update Firestore
            await this.db.collection('users').doc(this.user.uid).update({
                photoURL: photoURL,
                cloudinaryImageId: cloudinaryImageId,
                updatedAt: new Date().toISOString()
            });
            
            // Update auth profile
            await this.auth.currentUser.updateProfile({ photoURL });
            
            // Update local data
            this.user.photoURL = photoURL;
            this.userProfile.photoURL = photoURL;
            this.userProfile.cloudinaryImageId = cloudinaryImageId;
            this.userProfile.updatedAt = new Date().toISOString();
            
            // Update localStorage
            localStorage.setItem('reverbit_user', JSON.stringify(this.user));
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            
            // Update UI
            this.updateProfileAvatar();
            
            // Refresh popup if open
            if (this.profilePopup && this.profilePopup.style.display === 'block') {
                this.profilePopup.innerHTML = this.getPopupHTML();
                this.attachPopupEventListeners();
            }
            
            this.showToast('Profile picture updated!', 'success');
            
        } catch (error) {
            console.error('Auth: Upload failed:', error);
            this.showToast('Failed to upload picture', 'error');
        } finally {
            this.showUploadingState(false);
        }
    }

    showUploadingState(show) {
        if (!this.profileAvatar) return;
        
        const loadingSpinner = this.profileAvatar.querySelector('.reverbit-avatar-loading');
        if (loadingSpinner) {
            loadingSpinner.style.display = show ? 'block' : 'none';
        }
        
        if (show) {
            this.profileAvatar.classList.add('uploading');
        } else {
            this.profileAvatar.classList.remove('uploading');
        }
    }

    // ================= ACTIVITY TRACKING =================
    async trackLogin() {
        if (!this.user || !this.db) return;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.update({
                lastLogin: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                totalLogins: firebase.firestore.FieldValue.increment(1)
            });
            
            // Update local profile
            if (this.userProfile) {
                this.userProfile.lastLogin = new Date().toISOString();
                this.userProfile.totalLogins = (this.userProfile.totalLogins || 0) + 1;
            }
            
        } catch (error) {
            console.error('Auth: Login tracking error:', error);
        }
    }

    async updateLastActive() {
        if (!this.user || !this.db) return;
        
        try {
            const now = new Date().toISOString();
            await this.db.collection('users').doc(this.user.uid).update({
                lastActive: now,
                updatedAt: now
            });
            
            if (this.userProfile) {
                this.userProfile.lastActive = now;
            }
            
        } catch (error) {
            console.error('Auth: Last active update error:', error);
        }
    }

    async updateStreak() {
        if (!this.user || !this.db) return;
        
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
                } else {
                    const lastActiveDate = new Date(lastActive);
                    lastActiveDate.setHours(0, 0, 0, 0);
                    
                    const diffDays = Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 1) {
                        streak += 1;
                    } else if (diffDays > 1) {
                        streak = 1;
                    }
                }
                
                await userRef.update({
                    streak: streak,
                    lastActive: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                this.userProfile.streak = streak;
            }
        } catch (error) {
            console.error('Auth: Streak update error:', error);
        }
    }

    // ================= UTILITIES =================
    formatDate(dateString) {
        if (!dateString) return 'Recently';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    formatRelativeTime(dateString) {
        if (!dateString) return 'Recently';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        
        return this.formatDate(dateString);
    }

    getMemberDays() {
        if (!this.userProfile?.createdAt) return '0';
        
        const joinDate = new Date(this.userProfile.createdAt);
        const today = new Date();
        const diffTime = Math.abs(today - joinDate);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    viewProfile() {
        if (this.user) {
            window.open(`https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`, '_blank');
        }
    }

    showWelcomeMessage() {
        if (!this.userProfile) return;
        
        const createdAt = new Date(this.userProfile.createdAt);
        const now = new Date();
        const diffHours = (now - createdAt) / (1000 * 60 * 60);
        
        if (diffHours < 24) {
            setTimeout(() => {
                this.showToast(`Welcome to Reverbit, ${this.userProfile.displayName}!`, 'success');
            }, 1000);
        }
    }

    // ================= VISIBILITY & PERIODIC UPDATES =================
    setupVisibilityListener() {
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        
        // Also track window focus
        window.addEventListener('focus', () => this.onWindowFocus());
        window.addEventListener('blur', () => this.onWindowBlur());
    }

    onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            console.log('Auth: Page became visible');
            this.onWindowFocus();
        } else {
            console.log('Auth: Page hidden');
            this.onWindowBlur();
        }
    }

    onWindowFocus() {
        if (this.user) {
            this.updateLastActive();
            this.updateStreak();
        }
    }

    onWindowBlur() {
        // Clean up any ongoing processes
    }

    setupPeriodicUpdates() {
        // Update every 5 minutes if user is active
        this.updateInterval = setInterval(() => {
            if (this.user && document.visibilityState === 'visible') {
                this.updateLastActive();
            }
        }, 5 * 60 * 1000);
        
        // Track usage every 10 minutes
        setInterval(() => {
            if (this.user) {
                const appName = getCurrentAppName();
                if (appName) {
                    this.trackUsage(appName, 10);
                }
            }
        }, 10 * 60 * 1000);
    }

    async trackUsage(appName, minutes) {
        if (!this.user || !this.db) return;
        
        try {
            const usageRef = this.db.collection('usage').doc(this.user.uid);
            await usageRef.set({
                [appName]: firebase.firestore.FieldValue.increment(minutes),
                lastUsed: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('Auth: Usage tracking error:', error);
        }
    }

    // ================= LOGOUT =================
    async logout() {
        try {
            console.log('Auth: Logging out...');
            
            // Update last active before logout
            await this.updateLastActive();
            
            // Sign out from Firebase
            await this.auth.signOut();
            
            // Clear local data
            this.clearSession();
            
            // Clear intervals
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            
            // Clean up theme observer
            if (this.themeObserver) {
                this.themeObserver.disconnect();
            }
            
            // Redirect to signin
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 300);
            
            this.showToast('Signed out successfully', 'success');
            return true;
            
        } catch (error) {
            console.error('Auth: Logout error:', error);
            this.showToast('Error signing out', 'error');
            return false;
        }
    }

    // ================= TOAST NOTIFICATIONS =================
    showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.reverbit-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.className = `reverbit-toast reverbit-toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="toast-icon fas ${type === 'success' ? 'fa-check-circle' : 
                                           type === 'error' ? 'fa-exclamation-circle' : 
                                           type === 'warning' ? 'fa-exclamation-triangle' : 
                                           'fa-info-circle'}"></i>
                <span class="toast-message">${message}</span>
                <button class="toast-close" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add styles if not already added
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .reverbit-toast {
                    position: fixed;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%) translateY(100px);
                    background: #202124;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    z-index: 10003;
                    opacity: 0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    max-width: 90%;
                    width: max-content;
                    min-width: 300px;
                    pointer-events: none;
                }
                
                .reverbit-toast.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                    pointer-events: all;
                }
                
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .toast-icon {
                    font-size: 18px;
                }
                
                .toast-message {
                    flex: 1;
                    font-size: 14px;
                    font-weight: 500;
                }
                
                .toast-close {
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.7);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: color 0.2s ease;
                }
                
                .toast-close:hover {
                    color: white;
                }
                
                .reverbit-toast-success {
                    background: #34a853;
                }
                
                .reverbit-toast-error {
                    background: #ea4335;
                }
                
                .reverbit-toast-warning {
                    background: #fbbc05;
                    color: #202124;
                }
                
                .reverbit-toast-info {
                    background: #1a73e8;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add close button event
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            });
        }
        
        document.body.appendChild(toast);
        
        // Show
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Auto-hide
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, type === 'error' ? 5000 : 3000);
    }

    // ================= STYLES INJECTION =================
    injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) {
            console.log('Auth: Styles already injected');
            return;
        }
        
        const styles = `
            /* Reverbit Advanced Auth System Styles */
            
            /* Profile Avatar */
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
                margin: 0;
                position: relative;
                display: block;
                outline: none;
            }
            
            .reverbit-profile-avatar:hover {
                transform: scale(1.1);
                box-shadow: 0 4px 20px rgba(66, 133, 244, 0.3);
                border-color: rgba(66, 133, 244, 0.5);
            }
            
            .reverbit-profile-avatar:focus-visible {
                outline: 2px solid #4285f4;
                outline-offset: 2px;
            }
            
            .reverbit-profile-avatar.loading .reverbit-avatar-img {
                opacity: 0.5;
            }
            
            .reverbit-profile-avatar.uploading {
                position: relative;
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
                animation: avatar-spin 1s linear infinite;
                pointer-events: none;
            }
            
            .reverbit-avatar-container {
                position: relative;
                width: 100%;
                height: 100%;
            }
            
            .reverbit-avatar-img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                display: block;
                background: linear-gradient(135deg, #f5f5f5, #e8eaed);
                transition: opacity 0.3s ease;
            }
            
            /* Avatar Verification Badge */
            .avatar-verified-badge {
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                z-index: 2;
                font-size: 8px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                animation: verified-pulse 2s infinite;
            }
            
            .dark-theme .avatar-verified-badge {
                border-color: #202124;
            }
            
            .avatar-verified-badge.premium {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #000;
            }
            
            @keyframes verified-pulse {
                0%, 100% { 
                    opacity: 0.9;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                }
                50% { 
                    opacity: 1;
                    box-shadow: 0 0 12px rgba(26, 115, 232, 0.4);
                }
            }
            
            .reverbit-avatar-upload-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
                color: white;
                font-size: 10px;
                text-align: center;
                padding: 4px;
            }
            
            .reverbit-avatar-upload-overlay svg {
                width: 12px;
                height: 12px;
                margin-bottom: 2px;
            }
            
            .reverbit-avatar-upload-overlay .upload-text {
                font-size: 8px;
                font-weight: 600;
                line-height: 1;
            }
            
            .reverbit-avatar-loading {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .reverbit-avatar-loading .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: avatar-spin 1s linear infinite;
            }
            
            @keyframes avatar-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Profile Popup */
            .reverbit-profile-popup {
                position: fixed;
                top: 0;
                left: 0;
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 16px 48px rgba(0, 0, 0, 0.08);
                min-width: 340px;
                max-width: 380px;
                z-index: 9999;
                overflow: hidden;
                opacity: 0;
                transform: scale(0.95);
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                            transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid #dadce0;
                font-family: 'Google Sans', 'Roboto', 'Segoe UI', Arial, sans-serif;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .profile-popup-container {
                padding: 24px;
            }
            
            .profile-header {
                display: flex;
                align-items: flex-start;
                gap: 20px;
                padding-bottom: 20px;
            }
            
            .profile-avatar-large {
                position: relative;
                width: 80px;
                height: 80px;
                flex-shrink: 0;
            }
            
            .profile-avatar-large .avatar-container {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                overflow: hidden;
                border: 4px solid #f5f5f5;
                background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335);
                padding: 4px;
                position: relative;
                cursor: pointer;
            }
            
            .profile-avatar-large:hover .avatar-upload-btn {
                opacity: 1;
                transform: scale(1);
            }
            
            .profile-avatar-large img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                background: #ffffff;
                transition: transform 0.3s ease;
            }
            
            .profile-avatar-large:hover img {
                transform: scale(1.05);
            }
            
            .avatar-upload-btn {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #1a73e8;
                border: 2px solid white;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                opacity: 0;
                transition: all 0.3s ease;
                padding: 0;
                font-size: 12px;
                z-index: 3;
            }
            
            .streak-badge {
                position: absolute;
                top: -8px;
                right: -8px;
                background: #fbbc05;
                color: #202124;
                font-size: 10px;
                font-weight: 700;
                padding: 3px 6px;
                border-radius: 10px;
                border: 2px solid white;
                z-index: 2;
            }
            
            .profile-info {
                flex: 1;
                min-width: 0;
            }
            
            .profile-name-container {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 4px;
            }
            
            .profile-name {
                font-size: 18px;
                font-weight: 600;
                color: #202124;
                line-height: 1.4;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* Popup Verification Badge */
            .verified-badge-popup {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                color: white;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);
                animation: verified-pulse 2s infinite;
                white-space: nowrap;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .verified-badge-popup i {
                font-size: 9px;
            }
            
            .verified-badge-popup.premium {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #000;
                box-shadow: 0 2px 6px rgba(255, 215, 0, 0.3);
            }
            
            .profile-email {
                font-size: 14px;
                color: #5f6368;
                line-height: 1.4;
                margin-bottom: 8px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .profile-meta {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 12px;
                font-size: 12px;
                color: #5f6368;
            }
            
            .verified-status {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: #0d8a72;
                font-weight: 600;
                font-size: 11px;
                background: rgba(13, 138, 114, 0.1);
                padding: 2px 6px;
                border-radius: 8px;
                margin-bottom: 4px;
            }
            
            .verified-status.premium {
                color: #FFA500;
                background: rgba(255, 215, 0, 0.1);
            }
            
            .meta-item {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .meta-item i {
                width: 12px;
                height: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .change-avatar-btn {
                font-size: 13px;
                color: #1a73e8;
                background: #e8f0fe;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            
            .change-avatar-btn:hover {
                background: #d2e3fc;
                transform: translateY(-1px);
            }
            
            .profile-divider {
                height: 1px;
                background: #e8eaed;
                margin: 20px -24px;
            }
            
            .profile-menu {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .profile-menu-item {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 12px 16px;
                border-radius: 10px;
                text-decoration: none;
                color: #202124;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                border: none;
                background: none;
                width: 100%;
                text-align: left;
                position: relative;
            }
            
            .profile-menu-item:hover {
                background: #f8f9fa;
                transform: translateX(4px);
            }
            
            .profile-menu-item:active {
                background: #f1f3f4;
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
            
            .menu-arrow {
                color: #9aa0a6;
                font-size: 16px;
                opacity: 0.7;
            }
            
            .profile-footer {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e8eaed;
            }
            
            .profile-stats {
                display: flex;
                justify-content: space-around;
                margin-bottom: 16px;
            }
            
            .stat-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }
            
            .stat-number {
                font-size: 20px;
                font-weight: 700;
                color: #1a73e8;
                line-height: 1;
            }
            
            .stat-label {
                font-size: 11px;
                color: #5f6368;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .privacy-link {
                font-size: 12px;
                color: #5f6368;
                text-align: center;
                display: flex;
                justify-content: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .privacy-link a {
                color: #1a73e8;
                text-decoration: none;
                transition: color 0.2s ease;
            }
            
            .privacy-link a:hover {
                text-decoration: underline;
            }
            
            .profile-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px;
                gap: 16px;
            }
            
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #e8eaed;
                border-top-color: #1a73e8;
                border-radius: 50%;
                animation: avatar-spin 1s linear infinite;
            }
            
            /* Dark Theme */
            .dark-theme .reverbit-profile-popup {
                background: #202124;
                border-color: #3c4043;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }
            
            .dark-theme .profile-name {
                color: #e8eaed;
            }
            
            .dark-theme .profile-email {
                color: #9aa0a6;
            }
            
            .dark-theme .profile-meta {
                color: #9aa0a6;
            }
            
            .dark-theme .change-avatar-btn {
                color: #8ab4f8;
                background: #2d2e31;
            }
            
            .dark-theme .change-avatar-btn:hover {
                background: #3c4043;
            }
            
            .dark-theme .profile-divider {
                background: #3c4043;
            }
            
            .dark-theme .profile-menu-item {
                color: #e8eaed;
            }
            
            .dark-theme .profile-menu-item:hover {
                background: #2d2e31;
            }
            
            .dark-theme .profile-menu-item:active {
                background: #3c4043;
            }
            
            .dark-theme .profile-menu-icon {
                color: #9aa0a6;
            }
            
            .dark-theme .menu-arrow {
                color: #9aa0a6;
            }
            
            .dark-theme .profile-footer {
                border-top-color: #3c4043;
            }
            
            .dark-theme .stat-number {
                color: #8ab4f8;
            }
            
            .dark-theme .stat-label {
                color: #9aa0a6;
            }
            
            .dark-theme .privacy-link {
                color: #9aa0a6;
            }
            
            .dark-theme .privacy-link a {
                color: #8ab4f8;
            }
            
            .dark-theme .profile-avatar-large .avatar-container {
                border-color: #303134;
            }
            
            .dark-theme .avatar-upload-btn {
                background: #8ab4f8;
                border-color: #202124;
            }
            
            .dark-theme .streak-badge {
                border-color: #202124;
            }
            
            /* Responsive */
            @media (max-width: 640px) {
                .reverbit-profile-popup {
                    position: fixed;
                    top: 50% !important;
                    left: 50% !important;
                    right: auto !important;
                    transform: translate(-50%, -50%) scale(0.95) !important;
                    width: calc(100vw - 40px);
                    max-width: 400px;
                    max-height: 80vh;
                }
                
                .reverbit-profile-popup.active {
                    transform: translate(-50%, -50%) scale(1) !important;
                }
                
                .profile-header {
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }
                
                .profile-info {
                    text-align: center;
                }
                
                .reverbit-floating-header {
                    top: 8px;
                    right: 8px;
                    padding: 6px 10px;
                }
            }
            
            /* Floating Header */
            .reverbit-floating-header {
                position: fixed;
                top: 16px;
                right: 16px;
                z-index: 9998;
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 12px;
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(10px);
                border-radius: 12px;
                border: 1px solid #dadce0;
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
                transition: all 0.3s ease;
            }
            
            .dark-theme .reverbit-floating-header {
                background: rgba(32, 33, 36, 0.9);
                border-color: #3c4043;
            }
            
            /* Context Menu */
            .avatar-context-menu {
                position: fixed;
                background: #ffffff;
                border: 1px solid #dadce0;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10001;
                min-width: 180px;
                overflow: hidden;
                animation: menu-fade-in 0.2s ease;
            }
            
            @keyframes menu-fade-in {
                from {
                    opacity: 0;
                    transform: scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            .dark-theme .avatar-context-menu {
                background: #202124;
                border-color: #3c4043;
            }
            
            .context-menu-item {
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
                padding: 10px 16px;
                border: none;
                background: none;
                color: #202124;
                font-family: inherit;
                font-size: 14px;
                text-align: left;
                cursor: pointer;
                transition: background-color 0.2s ease;
            }
            
            .dark-theme .context-menu-item {
                color: #e8eaed;
            }
            
            .context-menu-item:hover {
                background: #f8f9fa;
            }
            
            .dark-theme .context-menu-item:hover {
                background: #2d2e31;
            }
            
            /* Popup Backdrop */
            .popup-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.4);
                backdrop-filter: blur(2px);
                z-index: 9997;
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            
            /* Camera Modal */
            .camera-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                z-index: 10002;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            
            /* Accessibility */
            .reverbit-profile-avatar:focus-visible,
            .profile-menu-item:focus-visible,
            .change-avatar-btn:focus-visible {
                outline: 2px solid #1a73e8;
                outline-offset: 2px;
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
        
        console.log('Auth: Advanced styles injected');
    }

    // ================= PUBLIC API =================
    isAuthenticated() {
        return this.user !== null;
    }

    getUser() {
        return this.user;
    }

    getUserProfile() {
        return this.userProfile;
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    isDarkModeActive() {
        return this.isDarkMode;
    }

    async updateUserProfile(updates) {
        if (!this.user || !this.db) return false;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.update({
                ...updates,
                updatedAt: new Date().toISOString()
            });
            
            // Update local profile
            Object.assign(this.userProfile, updates, { updatedAt: new Date().toISOString() });
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            
            return true;
        } catch (error) {
            console.error('Auth: Profile update error:', error);
            return false;
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
}

// ================= GLOBAL INSTANCE & FUNCTIONS =================
window.ReverbitAuth = new ReverbitAuth();

// Debug functions
window.debugAuth = async function() {
    console.log('=== AUTH DEBUG ===');
    console.log('User:', window.ReverbitAuth.getUser());
    console.log('Profile:', window.ReverbitAuth.getUserProfile());
    console.log('Theme:', window.ReverbitAuth.getCurrentTheme());
    console.log('Dark Mode:', window.ReverbitAuth.isDarkModeActive());
    console.log('Local Storage:', {
        uid: localStorage.getItem('reverbit_user_uid'),
        theme: localStorage.getItem('reverbit_theme'),
        darkMode: localStorage.getItem('reverbit_dark_mode')
    });
    console.log('=== END DEBUG ===');
};

window.viewPublicProfile = async function() {
    const link = await window.ReverbitAuth.generateProfileLink();
    if (link) {
        window.open(link, '_blank');
    } else {
        window.ReverbitAuth.showToast('Please sign in first', 'info');
    }
};

// App name detection
function getCurrentAppName() {
    const pathname = window.location.pathname;
    const hostname = window.location.hostname;
    const title = document.title.toLowerCase();
    
    if (pathname.includes('cloverai') || hostname.includes('clover') || title.includes('clover')) return 'cloverAI';
    if (pathname.includes('mindscribe') || hostname.includes('mindscribe') || title.includes('mindscribe')) return 'mindscribe';
    if (pathname.includes('peo') || hostname.includes('peo') || title.includes('peo')) return 'peo';
    if (pathname.includes('reverbit') || hostname.includes('reverbit') || title.includes('reverbit')) return 'reverbit';
    
    // Try to get from page content
    const h1 = document.querySelector('h1');
    if (h1) {
        const text = h1.textContent.toLowerCase();
        if (text.includes('clover')) return 'cloverAI';
        if (text.includes('mindscribe')) return 'mindscribe';
        if (text.includes('peo')) return 'peo';
        if (text.includes('reverbit')) return 'reverbit';
    }
    
    return 'other';
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Reverbit Auth: Page loaded, initializing...');
        
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
        
        // Initialize auth system
        await window.ReverbitAuth.init();
        
        // Start usage tracking if user is logged in
        const user = window.ReverbitAuth.getUser();
        if (user) {
            const appName = getCurrentAppName();
            if (appName) {
                // Initial tracking
                window.ReverbitAuth.trackUsage(appName, 1);
                
                // Periodic tracking
                setInterval(() => {
                    if (window.ReverbitAuth.isAuthenticated()) {
                        window.ReverbitAuth.trackUsage(appName, 5);
                    }
                }, 5 * 60 * 1000);
            }
        }
        
        console.log('Reverbit Auth: Initialization complete');
        
    } catch (error) {// auth.js - Enhanced Professional Google-style Profile System with Verification Badges
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
        this.profileAvatar = null;
        this.avatarUploadInput = null;
        this.currentTheme = 'auto';
        this.isDarkMode = false;
        this.authListeners = [];
        this.profileObservers = [];
        this.themeObserver = null;
        
        // Performance tracking
        this.lastUpdate = 0;
        this.updateInterval = null;
        
        // Bind methods
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.uploadProfilePicture = this.uploadProfilePicture.bind(this);
        this.handleAvatarUpload = this.handleAvatarUpload.bind(this);
        this.applyTheme = this.applyTheme.bind(this);
        this.toggleTheme = this.toggleTheme.bind(this);
        this.logout = this.logout.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
    }

    async init() {
        if (this.initialized) {
            console.log('Auth: Already initialized');
            return;
        }
        
        try {
            console.log('Auth: Initializing advanced system...');
            
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
                console.log('Auth: Firebase initialized');
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            this.storage = firebase.storage();
            
            // Enable Firestore persistence
            try {
                await this.db.enablePersistence({ synchronizeTabs: true });
                console.log('Auth: Firestore persistence enabled');
            } catch (persistenceError) {
                console.warn('Auth: Firestore persistence not supported:', persistenceError);
            }
            
            // Initialize Cloudinary
            this.initCloudinaryWidget();
            
            // Setup auth listener
            this.setupAuthListener();
            
            // Check existing session
            await this.checkExistingSession();
            
            // Initialize theme system
            this.initThemeSystem();
            
            // Add styles
            this.injectEnhancedStyles();
            
            // Setup visibility change listener
            this.setupVisibilityListener();
            
            // Setup periodic updates
            this.setupPeriodicUpdates();
            
            this.initialized = true;
            console.log('Auth: Advanced initialization complete');
            
            // Notify listeners
            this.notifyAuthListeners();
            
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.showEnhancedToast('Failed to initialize authentication system', 'error');
        }
    }

    // ================= VERIFICATION HELPERS =================
    getVerificationLevel() {
        if (!this.userProfile?.verified) return 'none';
        
        // Check for premium verification
        if (this.userProfile.verifiedLevel === 'premium' || this.userProfile.premiumVerified) {
            return 'premium';
        }
        
        // Check for admin verification
        if (this.userProfile.verifiedBy === 'admin' || this.userProfile.verifiedBy === 'adityajha1104@gmail.com') {
            return 'basic';
        }
        
        return this.userProfile.verifiedLevel || 'basic';
    }

    isVerified() {
        return this.getVerificationLevel() !== 'none';
    }

    getVerificationBadgeHTML(level = null, size = 'medium') {
        const verificationLevel = level || this.getVerificationLevel();
        
        if (verificationLevel === 'none') return '';
        
        const isPremium = verificationLevel === 'premium';
        
        // Size classes
        const sizeClass = {
            small: 'badge-small',
            medium: 'badge-medium',
            large: 'badge-large'
        }[size] || 'badge-medium';
        
        const icon = isPremium ? 'crown' : 'check-circle';
        const iconClass = isPremium ? 'fas fa-crown' : 'fas fa-check-circle';
        const text = isPremium ? 'Premium Verified' : 'Verified';
        const colorClass = isPremium ? 'premium-badge' : 'verified-badge';
        
        return `
            <div class="verification-badge ${colorClass} ${sizeClass}" 
                 title="${isPremium ? 'Premium Verified Account' : 'Verified Account'}"
                 role="img"
                 aria-label="${text}">
                <i class="${iconClass}"></i>
                ${size !== 'small' ? `<span class="badge-text">${text}</span>` : ''}
            </div>
        `;
    }

    getAvatarBadgeHTML() {
        const verificationLevel = this.getVerificationLevel();
        
        if (verificationLevel === 'none') return '';
        
        const isPremium = verificationLevel === 'premium';
        const icon = isPremium ? 'fa-crown' : 'fa-check';
        const colorClass = isPremium ? 'avatar-badge-premium' : 'avatar-badge-verified';
        
        return `
            <div class="avatar-verification-badge ${colorClass}" 
                 title="${isPremium ? 'Premium Verified Account' : 'Verified Account'}">
                <i class="fas ${icon}"></i>
            </div>
        `;
    }

    getNameWithBadges(displayName, includeCrown = true) {
        const level = this.getVerificationLevel();
        if (level === 'none') return displayName;
        
        const isPremium = level === 'premium';
        let badges = '';
        
        if (isPremium && includeCrown) {
            badges += '<i class="fas fa-crown name-badge crown-badge" title="Premium Verified"></i>';
        }
        if (this.isVerified()) {
            badges += '<i class="fas fa-check-circle name-badge verified-badge" title="Verified Account"></i>';
        }
        
        return `
            <span class="name-with-badges">
                <span class="display-name">${displayName}</span>
                ${badges}
            </span>
        `;
    }

    // ================= ENHANCED PROFILE POPUP =================
    createEnhancedProfilePopup() {
        console.log('Auth: Creating enhanced profile popup...');
        
        // Remove existing popup
        this.removeProfilePopup();
        
        // Create popup container with glass morphism effect
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup enhanced-popup';
        this.profilePopup.setAttribute('role', 'dialog');
        this.profilePopup.setAttribute('aria-label', 'Profile menu');
        this.profilePopup.setAttribute('aria-modal', 'true');
        this.profilePopup.style.cssText = `
            display: none;
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                        transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        // Create popup content with enhanced design
        this.profilePopup.innerHTML = this.getEnhancedPopupHTML();
        
        // Add to body
        document.body.appendChild(this.profilePopup);
        
        // Add event listeners
        setTimeout(() => {
            this.attachEnhancedPopupEventListeners();
        }, 10);
        
        console.log('Auth: Enhanced profile popup created');
    }

    getEnhancedPopupHTML() {
        if (!this.userProfile) {
            return this.getLoadingPopupHTML();
        }
        
        const displayName = this.userProfile.displayName || 'User';
        const email = this.userProfile.email || '';
        const photoURL = this.userProfile.photoURL;
        const profileUrl = `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
        
        // Verification status
        const verificationLevel = this.getVerificationLevel();
        const isVerified = verificationLevel !== 'none';
        const isPremium = verificationLevel === 'premium';
        
        // Get name with badges
        const nameWithBadges = this.getNameWithBadges(displayName);
        
        // Streak display
        const streak = this.userProfile.streak || 0;
        
        // Member since
        const memberSince = this.formatJoinDate(this.userProfile.createdAt);
        
        // Stats
        const totalLogins = this.userProfile.totalLogins || 1;
        const memberDays = this.getMemberDays();
        
        return `
            <div class="enhanced-popup-container">
                <!-- Header with gradient background -->
                <div class="popup-header ${isPremium ? 'premium-header' : ''}">
                    <div class="header-bg-pattern"></div>
                    
                    <!-- Close button -->
                    <button class="popup-close-btn" id="popup-close" aria-label="Close">
                        <i class="fas fa-times"></i>
                    </button>
                    
                    <!-- Avatar section -->
                    <div class="popup-avatar-section">
                        <div class="avatar-wrapper" id="profile-avatar-large">
                            <div class="avatar-ring ${isPremium ? 'premium-ring' : 'verified-ring'}"></div>
                            <div class="avatar-image-container">
                                <img src="${photoURL}" alt="${displayName}" class="avatar-image"
                                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true&size=200'">
                                ${this.getAvatarBadgeHTML()}
                            </div>
                            <button class="avatar-edit-btn" id="avatar-edit-btn" title="Change profile picture">
                                <i class="fas fa-camera"></i>
                            </button>
                        </div>
                        
                        <!-- Streak indicator -->
                        ${streak > 0 ? `
                        <div class="streak-indicator" title="${streak} day streak">
                            <i class="fas fa-fire"></i>
                            <span class="streak-count">${streak}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- User info -->
                    <div class="popup-user-info">
                        <div class="name-section">
                            ${nameWithBadges}
                        </div>
                        <div class="email-section">
                            <i class="fas fa-envelope"></i>
                            <span>${email}</span>
                        </div>
                        <div class="member-info">
                            <i class="fas fa-calendar-alt"></i>
                            <span>Member since ${memberSince}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Stats cards -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-sign-in-alt"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${totalLogins}</div>
                            <div class="stat-label">Logins</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-fire"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${streak}</div>
                            <div class="stat-label">Day Streak</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value">${memberDays}</div>
                            <div class="stat-label">Days Active</div>
                        </div>
                    </div>
                </div>
                
                <!-- Verification badge display (if verified) -->
                ${isVerified ? `
                <div class="verification-section">
                    <div class="verification-header">
                        <i class="fas fa-shield-alt"></i>
                        <span>Account Verification</span>
                    </div>
                    <div class="verification-badge-container">
                        ${this.getVerificationBadgeHTML(verificationLevel, 'large')}
                        ${isPremium ? `
                        <div class="premium-features">
                            <span class="premium-tag">Premium Features</span>
                            <ul class="premium-list">
                                <li><i class="fas fa-check"></i> Priority Support</li>
                                <li><i class="fas fa-check"></i> Exclusive Content</li>
                                <li><i class="fas fa-check"></i> Early Access</li>
                            </ul>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
                
                <!-- Quick actions -->
                <div class="quick-actions">
                    <button class="action-btn" id="quick-dashboard" data-url="https://aditya-cmd-max.github.io/dashboard">
                        <i class="fas fa-tachometer-alt"></i>
                        <span>Dashboard</span>
                    </button>
                    
                    <button class="action-btn" id="quick-profile" data-url="${profileUrl}">
                        <i class="fas fa-user-circle"></i>
                        <span>Profile</span>
                    </button>
                    
                    <button class="action-btn" id="quick-settings" data-url="https://aditya-cmd-max.github.io/dashboard#settings">
                        <i class="fas fa-cog"></i>
                        <span>Settings</span>
                    </button>
                </div>
                
                <!-- Menu items -->
                <div class="popup-menu">
                    <div class="menu-group">
                        <button class="menu-item" id="menu-account">
                            <i class="fas fa-id-card"></i>
                            <span>Account Settings</span>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        
                        <button class="menu-item" id="menu-privacy">
                            <i class="fas fa-lock"></i>
                            <span>Privacy & Security</span>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        
                        <button class="menu-item" id="menu-notifications">
                            <i class="fas fa-bell"></i>
                            <span>Notifications</span>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        
                        <button class="menu-item" id="menu-appearance" onclick="this.dispatchEvent(new CustomEvent('toggleTheme'))">
                            <i class="fas fa-palette"></i>
                            <span>Appearance</span>
                            <span class="menu-badge">${this.currentTheme}</span>
                        </button>
                    </div>
                    
                    <div class="menu-group">
                        <button class="menu-item" id="menu-help">
                            <i class="fas fa-question-circle"></i>
                            <span>Help & Support</span>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        
                        <button class="menu-item" id="menu-feedback">
                            <i class="fas fa-comment"></i>
                            <span>Send Feedback</span>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="popup-footer">
                    <button class="signout-btn" id="profile-signout">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Sign out</span>
                    </button>
                    
                    <div class="footer-links">
                        <a href="https://aditya-cmd-max.github.io/reverbit/privacy" target="_blank">Privacy</a>
                        <span class="dot">•</span>
                        <a href="https://aditya-cmd-max.github.io/reverbit/terms" target="_blank">Terms</a>
                        <span class="dot">•</span>
                        <a href="https://aditya-cmd-max.github.io/reverbit/help" target="_blank">Help</a>
                    </div>
                    
                    <div class="app-version">Reverbit v2.0</div>
                </div>
            </div>
        `;
    }

    getLoadingPopupHTML() {
        return `
            <div class="enhanced-popup-container loading-state">
                <div class="loading-spinner-container">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading profile...</div>
                </div>
            </div>
        `;
    }

    attachEnhancedPopupEventListeners() {
        if (!this.profilePopup) return;
        
        // Close button
        const closeBtn = this.profilePopup.querySelector('#popup-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hideProfilePopup();
            });
        }
        
        // Sign out
        const signoutBtn = this.profilePopup.querySelector('#profile-signout');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.logout();
            });
        }
        
        // Avatar upload
        const avatarEditBtn = this.profilePopup.querySelector('#avatar-edit-btn');
        const profileAvatarLarge = this.profilePopup.querySelector('#profile-avatar-large');
        
        const handleUpload = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleAvatarUpload();
        };
        
        if (avatarEditBtn) avatarEditBtn.addEventListener('click', handleUpload);
        if (profileAvatarLarge) profileAvatarLarge.addEventListener('click', handleUpload);
        
        // Quick action buttons
        const quickActions = ['dashboard', 'profile', 'settings'];
        quickActions.forEach(action => {
            const btn = this.profilePopup.querySelector(`#quick-${action}`);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const url = btn.dataset.url;
                    if (url) window.open(url, '_blank');
                });
            }
        });
        
        // Menu items
        const menuItems = ['account', 'privacy', 'notifications', 'help', 'feedback'];
        menuItems.forEach(item => {
            const menuBtn = this.profilePopup.querySelector(`#menu-${item}`);
            if (menuBtn) {
                menuBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showEnhancedToast(`${item} settings coming soon`, 'info');
                });
            }
        });
        
        // Appearance/Theme toggle
        const appearanceBtn = this.profilePopup.querySelector('#menu-appearance');
        if (appearanceBtn) {
            appearanceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const themes = ['light', 'dark', 'auto'];
                const currentIndex = themes.indexOf(this.currentTheme);
                const nextTheme = themes[(currentIndex + 1) % themes.length];
                this.toggleTheme(nextTheme);
                
                // Update badge text
                const badge = appearanceBtn.querySelector('.menu-badge');
                if (badge) badge.textContent = nextTheme;
            });
            
            appearanceBtn.addEventListener('toggleTheme', () => {
                const themes = ['light', 'dark', 'auto'];
                const currentIndex = themes.indexOf(this.currentTheme);
                const nextTheme = themes[(currentIndex + 1) % themes.length];
                this.toggleTheme(nextTheme);
            });
        }
        
        // Keyboard navigation
        this.profilePopup.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideProfilePopup();
            }
        });
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
    }

    // ================= ENHANCED AVATAR BUTTON =================
    createEnhancedAvatarButton(container) {
        this.profileAvatar = document.createElement('button');
        this.profileAvatar.className = 'reverbit-profile-avatar enhanced-avatar';
        this.profileAvatar.setAttribute('aria-label', 'User profile menu');
        this.profileAvatar.setAttribute('title', 'Profile menu');
        this.profileAvatar.setAttribute('role', 'button');
        this.profileAvatar.setAttribute('tabindex', '0');
        
        // Create avatar container with rings
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'enhanced-avatar-container';
        
        // Status ring (pulsing for verified users)
        const statusRing = document.createElement('div');
        statusRing.className = `avatar-status-ring ${this.isVerified() ? (this.getVerificationLevel() === 'premium' ? 'premium-ring' : 'verified-ring') : ''}`;
        
        // Avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'enhanced-avatar-img';
        avatarImg.alt = 'Profile avatar';
        avatarImg.loading = 'lazy';
        
        // Verification badge (if verified)
        if (this.isVerified()) {
            avatarContainer.innerHTML += this.getAvatarBadgeHTML();
        }
        
        // Online indicator (simulated)
        const onlineIndicator = document.createElement('div');
        onlineIndicator.className = 'online-indicator';
        onlineIndicator.innerHTML = '<span class="pulse"></span>';
        
        // Upload overlay (shown on hover)
        const uploadOverlay = document.createElement('div');
        uploadOverlay.className = 'enhanced-upload-overlay';
        uploadOverlay.innerHTML = `
            <i class="fas fa-camera"></i>
            <span>Upload</span>
        `;
        
        // Loading spinner
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'enhanced-avatar-loading';
        loadingSpinner.innerHTML = '<div class="spinner"></div>';
        loadingSpinner.style.display = 'none';
        
        // Assemble avatar
        avatarContainer.appendChild(statusRing);
        avatarContainer.appendChild(avatarImg);
        avatarContainer.appendChild(onlineIndicator);
        this.profileAvatar.appendChild(avatarContainer);
        this.profileAvatar.appendChild(uploadOverlay);
        this.profileAvatar.appendChild(loadingSpinner);
        
        // Add event listeners
        this.profileAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleEnhancedProfilePopup();
        });
        
        this.profileAvatar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleEnhancedProfilePopup();
            }
        });
        
        this.profileAvatar.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.handleAvatarUpload();
        });
        
        // Hover effects
        this.profileAvatar.addEventListener('mouseenter', () => {
            this.profileAvatar.style.transform = 'scale(1.05)';
            uploadOverlay.style.opacity = '1';
            uploadOverlay.style.transform = 'translateY(0)';
        });
        
        this.profileAvatar.addEventListener('mouseleave', () => {
            this.profileAvatar.style.transform = 'scale(1)';
            uploadOverlay.style.opacity = '0';
            uploadOverlay.style.transform = 'translateY(10px)';
        });
        
        // Context menu
        this.profileAvatar.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showEnhancedContextMenu(e);
        });
        
        // Insert into container
        if (container.firstChild) {
            container.insertBefore(this.profileAvatar, container.firstChild);
        } else {
            container.appendChild(this.profileAvatar);
        }
        
        // Update avatar image
        this.updateEnhancedAvatar();
        
        console.log('Auth: Enhanced avatar button created');
    }

    updateEnhancedAvatar() {
        if (!this.profileAvatar || !this.userProfile) {
            console.warn('Auth: Cannot update avatar - missing elements');
            return;
        }
        
        const avatarImg = this.profileAvatar.querySelector('.enhanced-avatar-img');
        if (!avatarImg) return;
        
        const displayName = this.userProfile.displayName || 'User';
        let photoURL = this.userProfile.photoURL || 
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true&size=256`;
        
        // Add cache busting
        const cacheBuster = `t=${Date.now()}`;
        photoURL += (photoURL.includes('?') ? '&' : '?') + cacheBuster;
        
        // Set image source
        avatarImg.src = photoURL;
        avatarImg.alt = `${displayName}'s profile picture`;
        
        // Handle loading
        avatarImg.onload = () => {
            this.profileAvatar.classList.remove('loading');
        };
        
        avatarImg.onerror = () => {
            console.warn('Auth: Avatar image failed to load, using fallback');
            const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4285f4&color=fff&bold=true`;
            this.profileAvatar.classList.remove('loading');
        };
        
        // Show loading state
        this.profileAvatar.classList.add('loading');
        
        // Update verification badge and rings
        this.updateAvatarVerificationStatus();
    }

    updateAvatarVerificationStatus() {
        const avatarContainer = this.profileAvatar.querySelector('.enhanced-avatar-container');
        if (!avatarContainer) return;
        
        // Update status ring
        const statusRing = avatarContainer.querySelector('.avatar-status-ring');
        if (statusRing) {
            const level = this.getVerificationLevel();
            statusRing.className = 'avatar-status-ring';
            if (level !== 'none') {
                statusRing.classList.add(level === 'premium' ? 'premium-ring' : 'verified-ring');
            }
        }
        
        // Update verification badge
        const existingBadge = avatarContainer.querySelector('.avatar-verification-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        if (this.isVerified()) {
            avatarContainer.innerHTML += this.getAvatarBadgeHTML();
        }
    }

    toggleEnhancedProfilePopup() {
        if (!this.user) {
            this.showEnhancedToast('Please sign in to access profile', 'info');
            return;
        }
        
        if (!this.profilePopup) {
            this.createEnhancedProfilePopup();
        }
        
        const isVisible = this.profilePopup.style.display === 'block';
        
        if (isVisible) {
            this.hideProfilePopup();
        } else {
            this.showEnhancedProfilePopup();
        }
    }

    showEnhancedProfilePopup() {
        if (!this.profilePopup || !this.profileAvatar) {
            console.error('Auth: Cannot show popup - missing elements');
            return;
        }
        
        // Update content
        this.profilePopup.innerHTML = this.getEnhancedPopupHTML();
        this.attachEnhancedPopupEventListeners();
        
        // Force a reflow to get accurate popup dimensions
        this.profilePopup.style.display = 'block';
        this.profilePopup.style.visibility = 'hidden';
        this.profilePopup.style.opacity = '0';
        
        // Get dimensions
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        const popupRect = this.profilePopup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Smart positioning
        let top, left;
        
        // Default: position below avatar
        top = avatarRect.bottom + 12;
        left = avatarRect.left - (popupRect.width / 2) + (avatarRect.width / 2);
        
        // Adjust horizontal position to keep popup in viewport
        if (left + popupRect.width > viewportWidth - 20) {
            left = viewportWidth - popupRect.width - 20;
        }
        if (left < 20) {
            left = 20;
        }
        
        // Check vertical space
        if (top + popupRect.height > viewportHeight - 20) {
            // Not enough space below, position above
            top = avatarRect.top - popupRect.height - 12;
            
            // If still not enough space, position at top with offset
            if (top < 20) {
                top = 20;
            }
        }
        
        // Apply position
        this.profilePopup.style.top = `${top}px`;
        this.profilePopup.style.left = `${left}px`;
        this.profilePopup.style.visibility = 'visible';
        
        // Add arrow pointing to avatar
        this.addPopupArrow(avatarRect, top, left);
        
        // Animate in
        setTimeout(() => {
            this.profilePopup.style.opacity = '1';
            this.profilePopup.style.transform = 'scale(1) translateY(0)';
            
            // Focus first interactive element
            const firstButton = this.profilePopup.querySelector('button, a');
            if (firstButton) firstButton.focus();
        }, 10);
        
        // Add backdrop
        this.addEnhancedPopupBackdrop();
        
        console.log('Auth: Enhanced profile popup shown');
    }

    addPopupArrow(avatarRect, popupTop, popupLeft) {
        // Remove existing arrow
        const existingArrow = this.profilePopup.querySelector('.popup-arrow');
        if (existingArrow) {
            existingArrow.remove();
        }
        
        // Create arrow
        const arrow = document.createElement('div');
        arrow.className = 'popup-arrow';
        
        // Position arrow based on popup position relative to avatar
        const arrowTop = avatarRect.bottom - popupTop - 6; // 6px offset for arrow tip
        
        arrow.style.cssText = `
            position: absolute;
            top: ${arrowTop}px;
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
            width: 12px;
            height: 12px;
            background: ${this.isDarkMode ? '#202124' : '#ffffff'};
            border-left: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            border-top: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            z-index: -1;
        `;
        
        this.profilePopup.appendChild(arrow);
    }

    addEnhancedPopupBackdrop() {
        if (document.querySelector('.popup-enhanced-backdrop')) return;
        
        const backdrop = document.createElement('div');
        backdrop.className = 'popup-enhanced-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.3);
            backdrop-filter: blur(4px);
            z-index: 9997;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        
        backdrop.addEventListener('click', () => this.hideProfilePopup());
        
        document.body.appendChild(backdrop);
        
        setTimeout(() => {
            backdrop.style.opacity = '1';
        }, 10);
    }

    showEnhancedContextMenu(event) {
        event.preventDefault();
        
        // Remove existing context menu
        const existingMenu = document.querySelector('.enhanced-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create enhanced context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'enhanced-context-menu';
        contextMenu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            background: ${this.isDarkMode ? '#202124' : '#ffffff'};
            border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            z-index: 10001;
            min-width: 220px;
            overflow: hidden;
            backdrop-filter: blur(10px);
            animation: context-menu-appear 0.2s ease;
        `;
        
        const menuItems = [
            { icon: 'fa-camera', text: 'Upload Photo', action: () => this.handleAvatarUpload() },
            { icon: 'fa-crown', text: 'View Profile', action: () => this.viewProfile() },
            { icon: 'fa-shield-alt', text: 'Verification Status', action: () => this.showVerificationInfo() },
            { icon: 'fa-palette', text: 'Theme: ' + this.currentTheme, action: () => this.cycleTheme() },
            { divider: true },
            { icon: 'fa-sign-out-alt', text: 'Sign Out', action: () => this.logout(), danger: true }
        ];
        
        menuItems.forEach(item => {
            if (item.divider) {
                const divider = document.createElement('hr');
                divider.style.cssText = `
                    margin: 8px 0;
                    border: none;
                    border-top: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
                `;
                contextMenu.appendChild(divider);
                return;
            }
            
            const menuItem = document.createElement('button');
            menuItem.className = 'context-menu-item';
            menuItem.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                width: 100%;
                padding: 12px 16px;
                border: none;
                background: none;
                color: ${item.danger ? '#ea4335' : (this.isDarkMode ? '#e8eaed' : '#202124')};
                font-family: inherit;
                font-size: 14px;
                text-align: left;
                cursor: pointer;
                transition: background-color 0.2s ease;
            `;
            
            menuItem.innerHTML = `
                <i class="fas ${item.icon}" style="width: 16px; text-align: center;"></i>
                <span style="flex: 1;">${item.text}</span>
                ${item.shortcut ? `<span style="color: #9aa0a6; font-size: 12px;">${item.shortcut}</span>` : ''}
            `;
            
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                contextMenu.remove();
            });
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.backgroundColor = this.isDarkMode ? '#2d2e31' : '#f8f9fa';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.backgroundColor = 'transparent';
            });
            
            contextMenu.appendChild(menuItem);
        });
        
        document.body.appendChild(contextMenu);
        
        // Position adjustment
        setTimeout(() => {
            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
            }
        }, 0);
        
        // Close on click outside
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    // ================= ENHANCED UTILITIES =================
    showVerificationInfo() {
        const level = this.getVerificationLevel();
        const isVerified = level !== 'none';
        
        if (!isVerified) {
            this.showEnhancedToast('Your account is not verified', 'info');
            return;
        }
        
        const message = level === 'premium' 
            ? 'You have a Premium Verified account with all features unlocked! ✨' 
            : 'Your account is verified. Upgrade to Premium for additional benefits!';
        
        this.showEnhancedToast(message, 'success', 5000);
    }

    cycleTheme() {
        const themes = ['light', 'dark', 'auto'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        this.toggleTheme(nextTheme);
        this.showEnhancedToast(`Theme set to ${nextTheme}`, 'success');
    }

    formatJoinDate(dateString) {
        if (!dateString) return 'Recently';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    // ================= ENHANCED TOAST NOTIFICATIONS =================
    showEnhancedToast(message, type = 'info', duration = 3000) {
        // Remove existing toast
        const existingToast = document.querySelector('.reverbit-enhanced-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create enhanced toast
        const toast = document.createElement('div');
        toast.className = `reverbit-enhanced-toast toast-${type}`;
        
        // Icons based on type
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        // Progress bar animation
        const progressBar = duration > 0 ? `
            <div class="toast-progress">
                <div class="toast-progress-bar" style="animation: toast-progress ${duration}ms linear;"></div>
            </div>
        ` : '';
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">
                    <i class="fas ${icons[type]}"></i>
                </div>
                <div class="toast-message">${message}</div>
                <button class="toast-dismiss" aria-label="Dismiss">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            ${progressBar}
        `;
        
        // Add styles if not already present
        this.addToastStyles();
        
        // Add to document
        document.body.appendChild(toast);
        
        // Show animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Dismiss handler
        const dismissBtn = toast.querySelector('.toast-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            });
        }
        
        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            }, duration);
        }
    }

    addToastStyles() {
        if (document.getElementById('toast-enhanced-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'toast-enhanced-styles';
        style.textContent = `
            .reverbit-enhanced-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: ${this.isDarkMode ? '#202124' : '#ffffff'};
                color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                padding: 0;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                z-index: 10003;
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                max-width: 90%;
                width: max-content;
                min-width: 320px;
                pointer-events: none;
                overflow: hidden;
                border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            }
            
            .reverbit-enhanced-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
                pointer-events: all;
            }
            
            .toast-content {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px;
            }
            
            .toast-icon {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
            }
            
            .toast-success .toast-icon { color: #34a853; }
            .toast-error .toast-icon { color: #ea4335; }
            .toast-warning .toast-icon { color: #fbbc05; }
            .toast-info .toast-icon { color: #1a73e8; }
            
            .toast-message {
                flex: 1;
                font-size: 14px;
                font-weight: 500;
            }
            
            .toast-dismiss {
                background: none;
                border: none;
                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s ease;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .toast-dismiss:hover {
                background: ${this.isDarkMode ? '#2d2e31' : '#f1f3f4'};
                color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
            }
            
            .toast-progress {
                height: 3px;
                background: ${this.isDarkMode ? '#3c4043' : '#e8eaed'};
            }
            
            .toast-progress-bar {
                height: 100%;
                background: ${this.isDarkMode ? '#8ab4f8' : '#1a73e8'};
                width: 100%;
                transform-origin: left;
                animation: toast-progress linear forwards;
            }
            
            @keyframes toast-progress {
                from { transform: scaleX(1); }
                to { transform: scaleX(0); }
            }
        `;
        
        document.head.appendChild(style);
    }

    // ================= ENHANCED STYLES INJECTION =================
    injectEnhancedStyles() {
        if (document.getElementById('reverbit-enhanced-styles')) {
            console.log('Auth: Enhanced styles already injected');
            return;
        }
        
        const styles = `
            /* Reverbit Enhanced Auth System Styles */
            
            /* ===== Enhanced Avatar ===== */
            .enhanced-avatar {
                position: relative;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: visible;
                margin: 0;
                padding: 0;
                background: none;
                border: none;
                outline: none;
            }
            
            .enhanced-avatar-container {
                position: relative;
                width: 100%;
                height: 100%;
                border-radius: 50%;
            }
            
            .avatar-status-ring {
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border-radius: 50%;
                border: 2px solid transparent;
                transition: all 0.3s ease;
                z-index: 1;
            }
            
            .avatar-status-ring.verified-ring {
                border-color: #1a73e8;
                box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
                animation: ring-pulse 2s infinite;
            }
            
            .avatar-status-ring.premium-ring {
                border-color: #FFD700;
                box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.2);
                background: linear-gradient(45deg, #FFD700, #FFA500);
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                padding: 2px;
            }
            
            .enhanced-avatar-img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                display: block;
                background: linear-gradient(135deg, #f5f5f5, #e8eaed);
                transition: transform 0.3s ease;
                z-index: 2;
                position: relative;
            }
            
            .online-indicator {
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 12px;
                height: 12px;
                background: #34a853;
                border-radius: 50%;
                border: 2px solid ${this.isDarkMode ? '#202124' : '#ffffff'};
                z-index: 3;
            }
            
            .online-indicator .pulse {
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border-radius: 50%;
                background: #34a853;
                opacity: 0.5;
                animation: pulse 2s infinite;
            }
            
            .avatar-verification-badge {
                position: absolute;
                bottom: -4px;
                right: -4px;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid ${this.isDarkMode ? '#202124' : '#ffffff'};
                z-index: 4;
                font-size: 10px;
            }
            
            .avatar-verification-badge.avatar-badge-verified {
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                color: white;
            }
            
            .avatar-verification-badge.avatar-badge-premium {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #000;
            }
            
            .enhanced-upload-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s ease;
                pointer-events: none;
                color: white;
                font-size: 10px;
                gap: 2px;
                z-index: 5;
            }
            
            .enhanced-upload-overlay i {
                font-size: 14px;
            }
            
            .enhanced-upload-overlay span {
                font-size: 9px;
                font-weight: 600;
            }
            
            .enhanced-avatar-loading {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 6;
            }
            
            /* ===== Enhanced Popup ===== */
            .enhanced-popup {
                background: ${this.isDarkMode ? '#202124' : '#ffffff'};
                border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
                border-radius: 24px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 10px 30px rgba(0, 0, 0, 0.1);
                min-width: 380px;
                max-width: 420px;
                backdrop-filter: blur(10px);
                font-family: 'Google Sans', 'Roboto', sans-serif;
            }
            
            .enhanced-popup-container {
                position: relative;
                overflow: hidden;
            }
            
            .popup-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 24px;
                position: relative;
                color: white;
            }
            
            .popup-header.premium-header {
                background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            }
            
            .header-bg-pattern {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><path d="M30 0L60 30L30 60L0 30L30 0Z" fill="rgba(255,255,255,0.05)"/></svg>');
                opacity: 0.1;
            }
            
            .popup-close-btn {
                position: absolute;
                top: 16px;
                right: 16px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                z-index: 2;
                backdrop-filter: blur(4px);
            }
            
            .popup-close-btn:hover {
                background: rgba(255,255,255,0.3);
                transform: scale(1.1);
            }
            
            .popup-avatar-section {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                margin-bottom: 16px;
                position: relative;
                z-index: 2;
            }
            
            .avatar-wrapper {
                position: relative;
                width: 80px;
                height: 80px;
                cursor: pointer;
            }
            
            .avatar-ring {
                position: absolute;
                top: -3px;
                left: -3px;
                right: -3px;
                bottom: -3px;
                border-radius: 50%;
                border: 3px solid rgba(255,255,255,0.5);
                transition: all 0.3s ease;
            }
            
            .avatar-ring.verified-ring {
                border-color: #ffffff;
                box-shadow: 0 0 20px rgba(255,255,255,0.5);
            }
            
            .avatar-ring.premium-ring {
                border-color: #FFD700;
                box-shadow: 0 0 20px #FFD700;
            }
            
            .avatar-image-container {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                overflow: hidden;
                position: relative;
            }
            
            .avatar-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            
            .avatar-wrapper:hover .avatar-image {
                transform: scale(1.1);
            }
            
            .avatar-edit-btn {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #ffffff;
                border: none;
                color: #1a73e8;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                opacity: 0;
                transform: scale(0.8);
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                z-index: 3;
            }
            
            .avatar-wrapper:hover .avatar-edit-btn {
                opacity: 1;
                transform: scale(1);
            }
            
            .avatar-edit-btn:hover {
                background: #1a73e8;
                color: white;
                transform: scale(1.1);
            }
            
            .streak-indicator {
                background: rgba(255,255,255,0.2);
                backdrop-filter: blur(4px);
                padding: 8px 12px;
                border-radius: 30px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
            }
            
            .streak-indicator i {
                color: #fbbc05;
            }
            
            .popup-user-info {
                position: relative;
                z-index: 2;
            }
            
            .name-section {
                margin-bottom: 8px;
            }
            
            .name-with-badges {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .display-name {
                font-size: 20px;
                font-weight: 600;
            }
            
            .name-badge {
                font-size: 18px;
            }
            
            .name-badge.verified-badge {
                color: #1a73e8;
            }
            
            .name-badge.crown-badge {
                color: #FFD700;
            }
            
            .email-section {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                opacity: 0.9;
                margin-bottom: 6px;
            }
            
            .email-section i {
                font-size: 12px;
            }
            
            .member-info {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                opacity: 0.8;
            }
            
            /* Stats Grid */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                padding: 20px 24px;
                background: ${this.isDarkMode ? '#2d2e31' : '#f8f9fa'};
            }
            
            .stat-card {
                background: ${this.isDarkMode ? '#202124' : '#ffffff'};
                border-radius: 12px;
                padding: 12px;
                display: flex;
                align-items: center;
                gap: 12px;
                border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            }
            
            .stat-icon {
                width: 36px;
                height: 36px;
                border-radius: 10px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 16px;
            }
            
            .stat-content {
                flex: 1;
            }
            
            .stat-value {
                font-size: 18px;
                font-weight: 700;
                color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                line-height: 1.2;
            }
            
            .stat-label {
                font-size: 11px;
                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            
            /* Verification Section */
            .verification-section {
                padding: 20px 24px;
                border-bottom: 1px solid ${this.isDarkMode ? '#3c4043' : '#e8eaed'};
            }
            
            .verification-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 16px;
                color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                font-weight: 600;
            }
            
            .verification-badge-container {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }
            
            .verification-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                border-radius: 20px;
            }
            
            .verification-badge.verified-badge {
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                color: white;
                padding: 6px 12px;
            }
            
            .verification-badge.premium-badge {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #000;
                padding: 6px 12px;
            }
            
            .verification-badge.badge-large {
                padding: 8px 16px;
                font-size: 14px;
            }
            
            .verification-badge.badge-large i {
                font-size: 16px;
            }
            
            .premium-features {
                flex: 1;
            }
            
            .premium-tag {
                display: inline-block;
                background: ${this.isDarkMode ? '#2d2e31' : '#f8f9fa'};
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                margin-bottom: 8px;
            }
            
            .premium-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .premium-list li {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                margin-bottom: 4px;
                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
            }
            
            .premium-list li i {
                color: #34a853;
                font-size: 10px;
            }
            
            /* Quick Actions */
            .quick-actions {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                padding: 20px 24px;
            }
            
            .action-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 12px;
                background: none;
                border: none;
                border-radius: 12px;
                color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .action-btn i {
                font-size: 20px;
                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                transition: all 0.2s ease;
            }
            
            .action-btn span {
                font-size: 12px;
                font-weight: 500;
            }
            
            .action-btn:hover {
                background: ${this.isDarkMode ? '#2d2e31' : '#f8f9fa'};
            }
            
            .action-btn:hover i {
                color: #1a73e8;
                transform: scale(1.1);
            }
            
            /* Popup Menu */
            .popup-menu {
                padding: 0 24px 20px;
            }
            
            .menu-group {
                margin-bottom: 16px;
            }
            
            .menu-item {
                display: flex;
                align-items: center;
                gap: 12px;
                width: 100%;
                padding: 12px 16px;
                border: none;
                background: none;
                border-radius: 10px;
                color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 14px;
            }
            
            .menu-item i:first-child {
                width: 20px;
                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
            }
            
            .menu-item span {
                flex: 1;
                text-align: left;
            }
            
            .menu-item i:last-child {
                font-size: 12px;
                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                opacity: 0.5;
            }
            
            .menu-item:hover {
                background: ${this.isDarkMode ? '#2d2e31' : '#f8f9fa'};
            }
            
            .menu-item:hover i:last-child {
                opacity: 1;
                transform: translateX(4px);
            }
            
            .menu-badge {
                background: ${this.isDarkMode ? '#3c4043' : '#e8eaed'};
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                text-transform: capitalize;
            }
            
            /* Popup Footer */
            .popup-footer {
                padding: 16px 24px;
                background: ${this.isDarkMode ? '#2d2e31' : '#f8f9fa'};
                border-top: 1px solid ${this.isDarkMode ? '#3c4043' : '#e8eaed'};
                text-align: center;
            }
            
            .signout-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: 100%;
                padding: 12px;
                background: ${this.isDarkMode ? '#3c4043' : '#ea4335'};
                border: none;
                border-radius: 10px;
                color: white;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 600;
                margin-bottom: 16px;
            }
            
            .signout-btn:hover {
                background: ${this.isDarkMode ? '#5f6368' : '#d93025'};
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(234, 67, 53, 0.3);
            }
            
            .footer-links {
                display: flex;
                justify-content: center;
                gap: 8px;
                margin-bottom: 8px;
                font-size: 12px;
            }
            
            .footer-links a {
                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                text-decoration: none;
                transition: color 0.2s ease;
            }
            
            .footer-links a:hover {
                color: #1a73e8;
            }
            
            .footer-links .dot {
                color: ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            }
            
            .app-version {
                font-size: 10px;
                color: ${this.isDarkMode ? '#5f6368' : '#9aa0a6'};
            }
            
            /* Loading State */
            .loading-state {
                min-height: 200px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .loading-spinner-container {
                text-align: center;
            }
            
            .loading-spinner {
                width: 48px;
                height: 48px;
                border: 3px solid ${this.isDarkMode ? '#3c4043' : '#e8eaed'};
                border-top-color: #1a73e8;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 16px;
            }
            
            .loading-text {
                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                font-size: 14px;
            }
            
            /* Animations */
            @keyframes ring-pulse {
                0% { box-shadow: 0 0 0 0 rgba(26, 115, 232, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(26, 115, 232, 0); }
                100% { box-shadow: 0 0 0 0 rgba(26, 115, 232, 0); }
            }
            
            @keyframes pulse {
                0% { transform: scale(1); opacity: 0.5; }
                70% { transform: scale(2); opacity: 0; }
                100% { transform: scale(1); opacity: 0; }
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes context-menu-appear {
                from {
                    opacity: 0;
                    transform: scale(0.95) translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            /* Dark Theme Adjustments */
            .dark-theme .stats-grid {
                background: #202124;
            }
            
            .dark-theme .stat-card {
                background: #2d2e31;
            }
            
            .dark-theme .premium-tag {
                background: #3c4043;
            }
            
            /* Responsive */
            @media (max-width: 480px) {
                .enhanced-popup {
                    min-width: 320px;
                }
                
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                
                .quick-actions {
                    grid-template-columns: 1fr;
                }
                
                .action-btn {
                    flex-direction: row;
                    justify-content: center;
                }
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-enhanced-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
        
        console.log('Auth: Enhanced styles injected');
    }

    // ================= OVERRIDE EXISTING METHODS =================
    addOrUpdateProfileAvatar() {
        console.log('Auth: Managing enhanced profile avatar UI...');
        
        // Check if avatar already exists
        const existingAvatar = document.querySelector('.reverbit-profile-avatar.enhanced-avatar');
        if (existingAvatar) {
            this.profileAvatar = existingAvatar;
            this.updateEnhancedAvatar();
            console.log('Auth: Updated existing enhanced avatar');
            return;
        }
        
        // Find or create header actions container
        let headerActions = document.querySelector('.header-actions');
        
        if (!headerActions) {
            console.log('Auth: Creating header actions container...');
            
            // Look for existing header
            const header = document.querySelector('.app-header, header, .header, nav.navbar, [role="banner"]');
            
            if (header) {
                headerActions = document.createElement('div');
                headerActions.className = 'header-actions';
                header.appendChild(headerActions);
            } else {
                // Create floating header
                this.createEnhancedFloatingHeader();
                headerActions = document.querySelector('.reverbit-enhanced-floating-header .header-actions');
            }
        }
        
        // Create enhanced avatar button
        this.createEnhancedAvatarButton(headerActions);
        
        // Create file input for uploads
        this.createAvatarUploadInput();
        
        console.log('Auth: Enhanced avatar UI setup complete');
    }

    createEnhancedFloatingHeader() {
        console.log('Auth: Creating enhanced floating header...');
        
        // Remove existing floating header
        const existingFloating = document.querySelector('.reverbit-enhanced-floating-header');
        if (existingFloating) {
            existingFloating.remove();
        }
        
        // Create enhanced floating header with glass morphism
        const floatingHeader = document.createElement('div');
        floatingHeader.className = 'reverbit-enhanced-floating-header';
        floatingHeader.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9998;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px;
            background: ${this.isDarkMode ? 'rgba(32, 33, 36, 0.7)' : 'rgba(255, 255, 255, 0.7)'};
            backdrop-filter: blur(12px);
            border-radius: 50px;
            border: 1px solid ${this.isDarkMode ? 'rgba(60, 64, 67, 0.3)' : 'rgba(218, 220, 224, 0.3)'};
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            transition: all 0.3s ease;
        `;
        
        const headerActions = document.createElement('div');
        headerActions.className = 'header-actions';
        headerActions.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        floatingHeader.appendChild(headerActions);
        document.body.appendChild(floatingHeader);
        
        // Hover effect
        floatingHeader.addEventListener('mouseenter', () => {
            floatingHeader.style.transform = 'translateY(-2px)';
            floatingHeader.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.12)';
            floatingHeader.style.background = this.isDarkMode ? 'rgba(32, 33, 36, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        });
        
        floatingHeader.addEventListener('mouseleave', () => {
            floatingHeader.style.transform = 'translateY(0)';
            floatingHeader.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
            floatingHeader.style.background = this.isDarkMode ? 'rgba(32, 33, 36, 0.7)' : 'rgba(255, 255, 255, 0.7)';
        });
        
        console.log('Auth: Enhanced floating header created');
    }

    // Override the showToast method to use enhanced version
    showToast(message, type = 'info') {
        this.showEnhancedToast(message, type);
    }

    // ================= UPDATE EXISTING METHODS TO USE ENHANCED VERSIONS =================
    toggleProfilePopup() {
        this.toggleEnhancedProfilePopup();
    }

    createProfilePopup() {
        this.createEnhancedProfilePopup();
    }

    showProfilePopup() {
        this.showEnhancedProfilePopup();
    }

    addPopupBackdrop() {
        this.addEnhancedPopupBackdrop();
    }

    // Keep all other logic exactly the same as original
    // ... (rest of the methods remain unchanged)
}

// Add enhanced debug function
window.debugEnhancedAuth = async function() {
    console.log('=== ENHANCED AUTH DEBUG ===');
    console.log('User:', window.ReverbitAuth.getUser());
    console.log('Profile:', window.ReverbitAuth.getUserProfile());
    console.log('Verification Level:', window.ReverbitAuth.getVerificationLevel());
    console.log('Is Verified:', window.ReverbitAuth.isVerified());
    console.log('Theme:', window.ReverbitAuth.getCurrentTheme());
    console.log('Dark Mode:', window.ReverbitAuth.isDarkModeActive());
    console.log('Local Storage:', {
        uid: localStorage.getItem('reverbit_user_uid'),
        theme: localStorage.getItem('reverbit_theme'),
        darkMode: localStorage.getItem('reverbit_dark_mode'),
        profile: localStorage.getItem('reverbit_user_profile')
    });
    console.log('=== END DEBUG ===');
};

// Export the enhanced class
window.ReverbitAuth = new ReverbitAuth();
        console.error('Reverbit Auth: Initialization failed:', error);
        window.ReverbitAuth.showToast('Authentication system failed to initialize', 'error');
    }
});

// Global storage listener for theme changes
window.addEventListener('storage', (e) => {
    if (e.key === 'reverbit_theme') {
        window.ReverbitAuth.currentTheme = e.newValue || 'auto';
        window.ReverbitAuth.applyTheme();
    }
});

// Make auth globally accessible
window.auth = window.ReverbitAuth;

console.log('Reverbit Advanced Auth System loaded successfully');

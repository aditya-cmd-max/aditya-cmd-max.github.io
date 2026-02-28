// auth.js - Enhanced Google-style Profile System with Dark Mode & Cloudinary
// Based on your WORKING code - ONLY adding UI/UX improvements

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
            
            // Add styles (ENHANCED UI/UX ONLY)
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
            this.showToast('Failed to initialize authentication system', 'error');
        }
    }

    // ================= THEME MANAGEMENT (ENHANCED UI/UX) =================
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

    applyTheme() {
        // Determine actual theme
        if (this.currentTheme === 'auto') {
            this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
            this.isDarkMode = this.currentTheme === 'dark';
        }
        
        // Store preference
        localStorage.setItem('reverbit_theme', this.currentTheme);
        localStorage.setItem('reverbit_dark_mode', this.isDarkMode.toString());
        
        // Update popup if open with animation
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            // Add theme transition animation
            this.profilePopup.style.transition = 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease';
            this.updatePopupTheme();
            setTimeout(() => {
                if (this.profilePopup) this.profilePopup.style.transition = '';
            }, 300);
        }
        
        // Notify observers
        this.notifyThemeObservers();
        
        console.log('Auth: Theme applied -', this.currentTheme, '(dark:', this.isDarkMode, ')');
    }

    async toggleTheme(theme = null) {
        if (theme) {
            this.currentTheme = theme;
        } else {
            // Cycle through themes: light -> dark -> auto
            const themes = ['light', 'dark', 'auto'];
            const currentIndex = themes.indexOf(this.currentTheme);
            this.currentTheme = themes[(currentIndex + 1) % themes.length];
        }
        
        // Apply with animation
        document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
        this.applyTheme();
        
        setTimeout(() => {
            document.documentElement.style.transition = '';
        }, 300);
        
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
        
        // Update popup if open with animation
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.updatePopupTheme();
        }
    }

    updatePopupTheme() {
        if (this.profilePopup) {
            // Just update the theme class, don't recreate
            if (this.isDarkMode) {
                this.profilePopup.classList.add('dark-theme-popup');
            } else {
                this.profilePopup.classList.remove('dark-theme-popup');
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

    // ================= PROFILE AVATAR UI (ENHANCED) =================
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
        
        // Create avatar button with enhanced UI
        this.createEnhancedAvatarButton(headerActions);
        
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
        
        // Create new floating header with enhanced styling
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
            border-radius: 40px;
            border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            animation: headerSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;
        
        // Add keyframes for animation if not already present
        if (!document.getElementById('auth-animations')) {
            const style = document.createElement('style');
            style.id = 'auth-animations';
            style.textContent = `
                @keyframes headerSlideIn {
                    0% {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.9);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                @keyframes popupScaleIn {
                    0% {
                        opacity: 0;
                        transform: scale(0.9) translateY(-10px);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                
                @keyframes avatarPulse {
                    0%, 100% {
                        box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4);
                    }
                    70% {
                        box-shadow: 0 0 0 10px rgba(66, 133, 244, 0);
                    }
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes shimmer {
                    0% {
                        background-position: -1000px 0;
                    }
                    100% {
                        background-position: 1000px 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
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
            floatingHeader.style.transform = 'translateY(-2px)';
            floatingHeader.style.boxShadow = '0 8px 28px rgba(0, 0, 0, 0.15)';
        });
        
        floatingHeader.addEventListener('mouseleave', () => {
            floatingHeader.style.transform = 'translateY(0)';
            floatingHeader.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        });
        
        console.log('Auth: Floating header created');
    }

    createEnhancedAvatarButton(container) {
        this.profileAvatar = document.createElement('button');
        this.profileAvatar.className = 'reverbit-profile-avatar';
        this.profileAvatar.setAttribute('aria-label', 'User profile menu');
        this.profileAvatar.setAttribute('title', 'Profile menu');
        this.profileAvatar.setAttribute('role', 'button');
        this.profileAvatar.setAttribute('tabindex', '0');
        
        // Create avatar container with enhanced styling
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'reverbit-avatar-container';
        avatarContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            overflow: hidden;
        `;
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        avatarImg.alt = 'Profile avatar';
        avatarImg.loading = 'lazy';
        avatarImg.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s ease;
        `;
        
        // Create verification badge (if verified) - with animation
        const badgeHTML = this.isVerified() ? this.getAvatarBadgeHTML() : '';
        
        // Create upload overlay with enhanced animation
        const uploadOverlay = document.createElement('div');
        uploadOverlay.className = 'reverbit-avatar-upload-overlay';
        uploadOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(2px);
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease, backdrop-filter 0.3s ease;
            pointer-events: none;
            color: white;
            font-size: 12px;
            text-align: center;
            padding: 4px;
        `;
        uploadOverlay.innerHTML = `
            <i class="fas fa-camera" style="font-size: 16px; margin-bottom: 2px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></i>
            <span class="upload-text" style="font-size: 10px; font-weight: 600; letter-spacing: 0.5px;">Upload</span>
        `;
        
        // Create loading spinner
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'reverbit-avatar-loading';
        loadingSpinner.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(2px);
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10;
        `;
        loadingSpinner.innerHTML = `
            <div class="spinner" style="
                width: 24px;
                height: 24px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            "></div>
        `;
        
        // Assemble avatar
        avatarContainer.appendChild(avatarImg);
        this.profileAvatar.appendChild(avatarContainer);
        if (badgeHTML) {
            const badgeDiv = document.createElement('div');
            badgeDiv.innerHTML = badgeHTML;
            this.profileAvatar.appendChild(badgeDiv.firstChild);
        }
        this.profileAvatar.appendChild(uploadOverlay);
        this.profileAvatar.appendChild(loadingSpinner);
        
        // Add enhanced event listeners
        this.profileAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Add click animation
            this.profileAvatar.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.profileAvatar.style.transform = '';
            }, 150);
            
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
        
        // Enhanced hover effects
        this.profileAvatar.addEventListener('mouseenter', () => {
            this.profileAvatar.style.transform = 'scale(1.05)';
            this.profileAvatar.style.boxShadow = '0 4px 20px rgba(66, 133, 244, 0.3)';
            uploadOverlay.style.opacity = '1';
            uploadOverlay.style.backdropFilter = 'blur(4px)';
        });
        
        this.profileAvatar.addEventListener('mouseleave', () => {
            this.profileAvatar.style.transform = 'scale(1)';
            this.profileAvatar.style.boxShadow = '';
            uploadOverlay.style.opacity = '0';
            uploadOverlay.style.backdropFilter = 'blur(2px)';
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
        
        console.log('Auth: Enhanced avatar button created');
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
        
        // Handle loading with animation
        avatarImg.onload = () => {
            console.log('Auth: Avatar image loaded');
            this.profileAvatar.classList.remove('loading');
            this.profileAvatar.classList.add('loaded');
            
            // Add subtle fade-in animation
            avatarImg.style.animation = 'none';
            avatarImg.offsetHeight; // Trigger reflow
            avatarImg.style.animation = 'fadeIn 0.3s ease';
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
        // Remove existing badge
        const existingBadge = this.profileAvatar.querySelector('.avatar-verified-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Add new badge if verified with animation
        if (this.isVerified()) {
            const badge = document.createElement('div');
            badge.className = `avatar-verified-badge ${this.getVerificationLevel() === 'premium' ? 'premium' : ''}`;
            badge.style.cssText = `
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                z-index: 3;
                font-size: 10px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                animation: verifiedPulse 2s infinite;
            `;
            badge.innerHTML = `<i class="fas fa-${this.getVerificationLevel() === 'premium' ? 'crown' : 'check'}"></i>`;
            
            // Add keyframes if not present
            if (!document.getElementById('verified-pulse-keyframes')) {
                const style = document.createElement('style');
                style.id = 'verified-pulse-keyframes';
                style.textContent = `
                    @keyframes verifiedPulse {
                        0%, 100% {
                            transform: scale(1);
                            box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);
                        }
                        50% {
                            transform: scale(1.1);
                            box-shadow: 0 4px 12px rgba(26, 115, 232, 0.5);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            this.profileAvatar.appendChild(badge);
        }
    }

    showAvatarContextMenu(event) {
        event.preventDefault();
        
        // Remove existing context menu
        const existingMenu = document.querySelector('.avatar-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu with enhanced styling
        const contextMenu = document.createElement('div');
        contextMenu.className = 'avatar-context-menu';
        contextMenu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            background: ${this.isDarkMode ? '#202124' : '#ffffff'};
            border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            z-index: 10001;
            min-width: 200px;
            overflow: hidden;
            animation: contextMenuIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;
        
        // Add keyframes if not present
        if (!document.getElementById('context-menu-keyframes')) {
            const style = document.createElement('style');
            style.id = 'context-menu-keyframes';
            style.textContent = `
                @keyframes contextMenuIn {
                    0% {
                        opacity: 0;
                        transform: scale(0.9) translateY(-10px);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        const menuItems = [
            { icon: 'fa-camera', text: 'Upload Photo', action: () => this.handleAvatarUpload() },
            { icon: 'fa-user-circle', text: 'View Profile', action: () => this.viewProfile() },
            { icon: 'fa-cog', text: 'Settings', action: () => this.showSettings() },
            { icon: 'fa-sign-out-alt', text: 'Sign Out', action: () => this.logout(), danger: true }
        ];
        
        menuItems.forEach(item => {
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
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
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
                menuItem.style.transform = 'translateX(4px)';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.backgroundColor = 'transparent';
                menuItem.style.transform = 'translateX(0)';
            });
            
            contextMenu.appendChild(menuItem);
        });
        
        document.body.appendChild(contextMenu);
        
        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.animation = 'contextMenuOut 0.2s ease';
                setTimeout(() => {
                    contextMenu.remove();
                }, 150);
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

    // ================= PROFILE POPUP (ENHANCED UI/UX) =================
    createProfilePopup() {
        console.log('Auth: Creating enhanced profile popup...');
        
        // Remove existing popup
        this.removeProfilePopup();
        
        // Create popup container
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = `reverbit-profile-popup ${this.isDarkMode ? 'dark-theme-popup' : ''}`;
        this.profilePopup.setAttribute('role', 'dialog');
        this.profilePopup.setAttribute('aria-label', 'Profile menu');
        this.profilePopup.setAttribute('aria-modal', 'true');
        this.profilePopup.style.cssText = `
            display: none;
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                        transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                        background-color 0.3s ease,
                        border-color 0.3s ease,
                        box-shadow 0.3s ease;
        `;
        
        // Create popup content
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
            return `
                <div class="profile-popup-container" style="padding: 24px;">
                    <div class="profile-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; min-height: 200px;">
                        <div class="loading-spinner" style="
                            width: 48px;
                            height: 48px;
                            border: 3px solid rgba(66, 133, 244, 0.1);
                            border-top-color: #1a73e8;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                        "></div>
                        <p style="color: var(--md-on-surface-variant, #5f6368);">Loading profile...</p>
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
        const streakDisplay = streak > 0 ? `<span class="streak-badge" style="
            background: linear-gradient(135deg, #fbbc05, #ff9800);
            color: #202124;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            animation: streakGlow 2s infinite;
        ">🔥 ${streak} day${streak !== 1 ? 's' : ''}</span>` : '';
        
        // Verified status text
        const verifiedStatus = isVerified ? 
            (verificationLevel === 'premium' ? 
                '<span class="verified-status premium" style="color: #FFA500; background: rgba(255, 215, 0, 0.1);">Premium Verified</span>' : 
                '<span class="verified-status" style="color: #0d8a72; background: rgba(13, 138, 114, 0.1);">Verified</span>') : 
            '';
        
        // Get member days
        const memberDays = this.getMemberDays();
        
        return `
            <div class="profile-popup-container" style="padding: 24px;">
                <!-- Animated header gradient -->
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 100px;
                    background: linear-gradient(135deg, #1a73e8, #0d8a72, #ea4335, #fbbc05);
                    background-size: 300% 300%;
                    animation: gradientShift 8s ease infinite;
                    border-radius: 24px 24px 0 0;
                    opacity: 0.1;
                    pointer-events: none;
                "></div>
                
                <div class="profile-header" style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 24px; position: relative;">
                    <div class="profile-avatar-large" id="profile-avatar-large" role="button" tabindex="0" aria-label="Upload profile picture" style="position: relative; width: 100px; height: 100px; flex-shrink: 0; cursor: pointer;">
                        <div class="avatar-container" style="
                            width: 100%;
                            height: 100%;
                            border-radius: 50%;
                            overflow: hidden;
                            border: 4px solid transparent;
                            background: linear-gradient(135deg, #1a73e8, #0d8a72, #ea4335) border-box;
                            -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
                            mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
                            -webkit-mask-composite: xor;
                            mask-composite: exclude;
                            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
                            transition: transform 0.3s ease, box-shadow 0.3s ease;
                        ">
                            <img src="${photoURL}" alt="${displayName}" style="
                                width: 100%;
                                height: 100%;
                                object-fit: cover;
                                transition: transform 0.3s ease;
                            " onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true'">
                            ${this.getAvatarBadgeHTML()}
                        </div>
                        ${streakDisplay}
                        <button class="avatar-upload-btn" id="avatar-upload-btn" title="Upload new profile picture" style="
                            position: absolute;
                            bottom: 0;
                            right: 0;
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            border: 2px solid white;
                            background: linear-gradient(135deg, #1a73e8, #0d8a72);
                            color: white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            opacity: 0;
                            transform: scale(0.8);
                            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                            z-index: 3;
                        ">
                            <i class="fas fa-camera"></i>
                        </button>
                    </div>
                    <div class="profile-info" style="flex: 1;">
                        <div class="profile-name-container" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                            <div class="profile-name" style="
                                font-family: 'Google Sans', 'Segoe UI', Arial, sans-serif;
                                font-size: 22px;
                                font-weight: 600;
                                color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                                line-height: 1.3;
                            ">${displayName}</div>
                            ${verificationBadge}
                        </div>
                        <div class="profile-email" style="
                            font-size: 14px;
                            color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                            margin-bottom: 8px;
                            word-break: break-word;
                        ">${email}</div>
                        <div class="profile-meta" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
                            ${verifiedStatus}
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};">
                                <i class="fas fa-calendar" style="width: 14px;"></i>
                                <span>Joined ${this.formatDate(this.userProfile.createdAt)}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};">
                                <i class="fas fa-clock" style="width: 14px;"></i>
                                <span>Last active ${this.formatRelativeTime(this.userProfile.lastActive)}</span>
                            </div>
                        </div>
                        <button class="change-avatar-btn" id="change-avatar-btn" style="
                            font-size: 13px;
                            color: #1a73e8;
                            background: #e8f0fe;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 30px;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            font-weight: 500;
                            display: inline-flex;
                            align-items: center;
                            gap: 8px;
                        ">
                            <i class="fas fa-edit"></i>
                            Change profile picture
                        </button>
                    </div>
                </div>
                
                <div class="profile-divider" style="
                    height: 1px;
                    background: ${this.isDarkMode ? '#3c4043' : '#e8eaed'};
                    margin: 20px -24px;
                "></div>
                
                <div class="profile-menu" style="display: flex; flex-direction: column; gap: 4px;">
                    <a href="https://aditya-cmd-max.github.io/dashboard" class="profile-menu-item" id="profile-dashboard" style="
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 12px 16px;
                        border-radius: 30px;
                        text-decoration: none;
                        color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        background: ${this.isDarkMode ? 'transparent' : 'transparent'};
                        width: 100%;
                        text-align: left;
                        position: relative;
                    ">
                        <span class="profile-menu-icon" style="
                            width: 36px;
                            height: 36px;
                            border-radius: 12px;
                            background: linear-gradient(135deg, rgba(66, 133, 244, 0.1), rgba(13, 138, 114, 0.1));
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #1a73e8;
                        ">
                            <i class="fas fa-tachometer-alt"></i>
                        </span>
                        <span class="profile-menu-text">Dashboard</span>
                        <span class="menu-arrow" style="
                            color: ${this.isDarkMode ? '#9aa0a6' : '#9aa0a6'};
                            font-size: 18px;
                            opacity: 0.7;
                            margin-left: auto;
                        ">›</span>
                    </a>
                    
                    <a href="${profileUrl}" target="_blank" class="profile-menu-item" id="profile-public" style="
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 12px 16px;
                        border-radius: 30px;
                        text-decoration: none;
                        color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        width: 100%;
                        text-align: left;
                    ">
                        <span class="profile-menu-icon" style="
                            width: 36px;
                            height: 36px;
                            border-radius: 12px;
                            background: linear-gradient(135deg, rgba(66, 133, 244, 0.1), rgba(13, 138, 114, 0.1));
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #1a73e8;
                        ">
                            <i class="fas fa-user"></i>
                        </span>
                        <span class="profile-menu-text">My Profile</span>
                        <span class="menu-arrow" style="
                            color: ${this.isDarkMode ? '#9aa0a6' : '#9aa0a6'};
                            font-size: 18px;
                            opacity: 0.7;
                            margin-left: auto;
                        ">›</span>
                    </a>
                    
                    ${isVerified ? `
                    <a href="${profileUrl}#verification" target="_blank" class="profile-menu-item" id="profile-verification" style="
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 12px 16px;
                        border-radius: 30px;
                        text-decoration: none;
                        color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        width: 100%;
                        text-align: left;
                    ">
                        <span class="profile-menu-icon" style="
                            width: 36px;
                            height: 36px;
                            border-radius: 12px;
                            background: linear-gradient(135deg, rgba(66, 133, 244, 0.1), rgba(13, 138, 114, 0.1));
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #1a73e8;
                        ">
                            <i class="fas fa-shield-alt"></i>
                        </span>
                        <span class="profile-menu-text">Verification</span>
                        <span class="menu-arrow" style="
                            color: ${this.isDarkMode ? '#9aa0a6' : '#9aa0a6'};
                            font-size: 18px;
                            opacity: 0.7;
                            margin-left: auto;
                        ">›</span>
                    </a>
                    ` : ''}
                    
                    <button class="profile-menu-item" id="settings-btn" style="
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 12px 16px;
                        border-radius: 30px;
                        border: none;
                        background: transparent;
                        color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        width: 100%;
                        text-align: left;
                    ">
                        <span class="profile-menu-icon" style="
                            width: 36px;
                            height: 36px;
                            border-radius: 12px;
                            background: linear-gradient(135deg, rgba(66, 133, 244, 0.1), rgba(13, 138, 114, 0.1));
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #1a73e8;
                        ">
                            <i class="fas fa-cog"></i>
                        </span>
                        <span class="profile-menu-text">Settings</span>
                        <span class="menu-arrow" style="
                            color: ${this.isDarkMode ? '#9aa0a6' : '#9aa0a6'};
                            font-size: 18px;
                            opacity: 0.7;
                            margin-left: auto;
                        ">›</span>
                    </button>
                    
                    <div class="profile-divider" style="
                        height: 1px;
                        background: ${this.isDarkMode ? '#3c4043' : '#e8eaed'};
                        margin: 12px 0;
                    "></div>
                    
                    <button class="profile-menu-item" id="profile-signout" style="
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 12px 16px;
                        border-radius: 30px;
                        border: none;
                        background: transparent;
                        color: #ea4335;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        width: 100%;
                        text-align: left;
                    ">
                        <span class="profile-menu-icon" style="
                            width: 36px;
                            height: 36px;
                            border-radius: 12px;
                            background: rgba(234, 67, 53, 0.1);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #ea4335;
                        ">
                            <i class="fas fa-sign-out-alt"></i>
                        </span>
                        <span class="profile-menu-text">Sign out</span>
                        <span class="menu-arrow" style="
                            color: #ea4335;
                            font-size: 18px;
                            opacity: 0.7;
                            margin-left: auto;
                        ">›</span>
                    </button>
                </div>
                
                <div class="profile-footer" style="
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px solid ${this.isDarkMode ? '#3c4043' : '#e8eaed'};
                ">
                    <div class="profile-stats" style="
                        display: flex;
                        justify-content: space-around;
                        margin-bottom: 16px;
                    ">
                        <div class="stat-item" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <div class="stat-number" style="
                                font-size: 22px;
                                font-weight: 700;
                                color: #1a73e8;
                                line-height: 1;
                            ">${memberDays}</div>
                            <div class="stat-label" style="
                                font-size: 11px;
                                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                            ">Days</div>
                        </div>
                        <div class="stat-item" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <div class="stat-number" style="
                                font-size: 22px;
                                font-weight: 700;
                                color: #1a73e8;
                                line-height: 1;
                            ">${streak}</div>
                            <div class="stat-label" style="
                                font-size: 11px;
                                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                            ">Streak</div>
                        </div>
                        <div class="stat-item" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <div class="stat-number" style="
                                font-size: 22px;
                                font-weight: 700;
                                color: #1a73e8;
                                line-height: 1;
                            ">${this.userProfile.totalLogins || 1}</div>
                            <div class="stat-label" style="
                                font-size: 11px;
                                color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                            ">Logins</div>
                        </div>
                    </div>
                    <div class="privacy-link" style="
                        font-size: 12px;
                        color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                        text-align: center;
                        display: flex;
                        justify-content: center;
                        gap: 12px;
                    ">
                        <a href="https://aditya-cmd-max.github.io/reverbit/privacy" target="_blank" style="color: #1a73e8; text-decoration: none;">Privacy</a>
                        <span>•</span>
                        <a href="https://aditya-cmd-max.github.io/reverbit/terms" target="_blank" style="color: #1a73e8; text-decoration: none;">Terms</a>
                        <span>•</span>
                        <a href="https://aditya-cmd-max.github.io/reverbit/help" target="_blank" style="color: #1a73e8; text-decoration: none;">Help</a>
                    </div>
                </div>
            </div>
        `;
    }

    attachEnhancedPopupEventListeners() {
        if (!this.profilePopup) return;
        
        // Sign out
        const signoutBtn = this.profilePopup.querySelector('#profile-signout');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Add click animation
                signoutBtn.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    signoutBtn.style.transform = '';
                }, 150);
                this.logout();
            });
            
            signoutBtn.addEventListener('mouseenter', () => {
                signoutBtn.style.backgroundColor = 'rgba(234, 67, 53, 0.05)';
            });
            
            signoutBtn.addEventListener('mouseleave', () => {
                signoutBtn.style.backgroundColor = 'transparent';
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
        
        if (changeAvatarBtn) {
            changeAvatarBtn.addEventListener('click', handleUpload);
            changeAvatarBtn.addEventListener('mouseenter', () => {
                changeAvatarBtn.style.backgroundColor = '#d2e3fc';
                changeAvatarBtn.style.transform = 'translateY(-2px)';
                changeAvatarBtn.style.boxShadow = '0 4px 12px rgba(26, 115, 232, 0.2)';
            });
            changeAvatarBtn.addEventListener('mouseleave', () => {
                changeAvatarBtn.style.backgroundColor = '#e8f0fe';
                changeAvatarBtn.style.transform = 'translateY(0)';
                changeAvatarBtn.style.boxShadow = 'none';
            });
        }
        
        if (avatarUploadBtn) {
            avatarUploadBtn.addEventListener('click', handleUpload);
            
            // Show/hide upload button on avatar hover
            const avatarLarge = this.profilePopup.querySelector('#profile-avatar-large');
            if (avatarLarge) {
                avatarLarge.addEventListener('mouseenter', () => {
                    avatarUploadBtn.style.opacity = '1';
                    avatarUploadBtn.style.transform = 'scale(1)';
                });
                avatarLarge.addEventListener('mouseleave', () => {
                    avatarUploadBtn.style.opacity = '0';
                    avatarUploadBtn.style.transform = 'scale(0.8)';
                });
            }
        }
        
        if (profileAvatarLarge) {
            profileAvatarLarge.addEventListener('click', handleUpload);
        }
        
        // Add hover effects for menu items
        const menuItems = this.profilePopup.querySelectorAll('.profile-menu-item');
        menuItems.forEach(item => {
            if (item.id !== 'profile-signout') {
                item.addEventListener('mouseenter', () => {
                    item.style.backgroundColor = this.isDarkMode ? '#2d2e31' : '#f8f9fa';
                    item.style.transform = 'translateX(4px)';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = 'transparent';
                    item.style.transform = 'translateX(0)';
                });
            }
        });
        
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
            this.profilePopup.style.transform = 'scale(1) translateY(0)';
            
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
        this.profilePopup.style.transform = 'scale(0.95) translateY(-10px)';
        
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

    removeProfileAvatar() {
        if (this.profileAvatar && this.profileAvatar.parentNode) {
            this.profileAvatar.parentNode.removeChild(this.profileAvatar);
            this.profileAvatar = null;
        }
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
            border-radius: 30px;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
        `;
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 12px 24px;
            background: #5f6368;
            color: white;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
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
                this.profilePopup.innerHTML = this.getEnhancedPopupHTML();
                this.attachEnhancedPopupEventListeners();
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
            loadingSpinner.style.display = show ? 'flex' : 'none';
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

    showSettings() {
        window.open('https://aditya-cmd-max.github.io/dashboard#settings', '_blank');
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
            
            // Remove theme observer
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

    // ================= ENHANCED TOAST NOTIFICATIONS =================
    showToast(message, type = 'info', duration = 3000) {
        // Remove existing toast
        const existingToast = document.querySelector('.reverbit-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.className = `reverbit-toast reverbit-toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: ${this.isDarkMode ? '#202124' : '#ffffff'};
            color: ${this.isDarkMode ? '#e8eaed' : '#202124'};
            padding: 12px 24px;
            border-radius: 100px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10003;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            max-width: 90%;
            width: max-content;
            min-width: 300px;
            pointer-events: none;
            border: 1px solid ${type === 'success' ? '#34a853' : 
                                 type === 'error' ? '#ea4335' : 
                                 type === 'warning' ? '#fbbc05' : 
                                 '#1a73e8'};
        `;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas ${icons[type] || icons.info}" style="
                    color: ${type === 'success' ? '#34a853' : 
                            type === 'error' ? '#ea4335' : 
                            type === 'warning' ? '#fbbc05' : 
                            '#1a73e8'};
                    font-size: 18px;
                "></i>
                <span style="flex: 1; font-size: 14px; font-weight: 500;">${message}</span>
                <button class="toast-close" style="
                    background: none;
                    border: none;
                    color: ${this.isDarkMode ? '#9aa0a6' : '#5f6368'};
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    pointer-events: all;
                " aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.style.transform = 'translateX(-50%) translateY(100px)';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        });
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.backgroundColor = this.isDarkMode ? '#2d2e31' : '#f8f9fa';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.backgroundColor = 'transparent';
        });
        
        document.body.appendChild(toast);
        
        // Show
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);
        
        // Auto-hide
        if (duration > 0) {
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(100px)';
                toast.style.opacity = '0';
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            }, duration);
        }
    }

    // ================= ENHANCED STYLES INJECTION =================
    injectEnhancedStyles() {
        if (document.getElementById('reverbit-auth-styles')) {
            console.log('Auth: Styles already injected');
            return;
        }
        
        const styles = `
            /* Reverbit Advanced Auth System - Enhanced UI/UX Styles */
            
            /* Profile Avatar - Enhanced */
            .reverbit-profile-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid transparent;
                padding: 2px;
                background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335) border-box;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                overflow: hidden;
                flex-shrink: 0;
                margin: 0;
                position: relative;
                display: block;
                outline: none;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .reverbit-profile-avatar:hover {
                transform: scale(1.1) rotate(3deg);
                box-shadow: 0 4px 20px rgba(66, 133, 244, 0.3);
            }
            
            .reverbit-profile-avatar:active {
                transform: scale(0.95);
            }
            
            .reverbit-profile-avatar:focus-visible {
                outline: 2px solid #4285f4;
                outline-offset: 2px;
            }
            
            .reverbit-profile-avatar.loading .reverbit-avatar-img {
                opacity: 0.5;
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
                transition: transform 0.3s ease;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .reverbit-profile-avatar:hover .reverbit-avatar-img {
                transform: scale(1.1);
            }
            
            /* Avatar Verification Badge - Enhanced */
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
                z-index: 3;
                font-size: 8px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                animation: verifiedPulse 2s infinite;
            }
            
            .dark-theme .avatar-verified-badge {
                border-color: #202124;
            }
            
            .avatar-verified-badge.premium {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #000;
            }
            
            @keyframes verifiedPulse {
                0%, 100% {
                    transform: scale(1);
                    box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);
                }
                50% {
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(26, 115, 232, 0.5);
                }
            }
            
            /* Avatar Upload Overlay - Enhanced */
            .reverbit-avatar-upload-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(2px);
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease, backdrop-filter 0.3s ease;
                pointer-events: none;
                color: white;
                font-size: 10px;
                text-align: center;
                padding: 4px;
            }
            
            .reverbit-profile-avatar:hover .reverbit-avatar-upload-overlay {
                opacity: 1;
                backdrop-filter: blur(4px);
            }
            
            .reverbit-avatar-upload-overlay i {
                font-size: 14px;
                margin-bottom: 2px;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            }
            
            .reverbit-avatar-upload-overlay .upload-text {
                font-size: 8px;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            
            /* Avatar Loading Spinner */
            .reverbit-avatar-loading {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(2px);
                border-radius: 50%;
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10;
            }
            
            .reverbit-avatar-loading .spinner {
                width: 24px;
                height: 24px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Floating Header - Enhanced */
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
                border-radius: 40px;
                border: 1px solid #dadce0;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                animation: headerSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .dark-theme .reverbit-floating-header {
                background: rgba(32, 33, 36, 0.9);
                border-color: #3c4043;
            }
            
            @keyframes headerSlideIn {
                0% {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.9);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            .reverbit-floating-header:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 28px rgba(0, 0, 0, 0.15);
            }
            
            /* Profile Popup - Enhanced */
            .reverbit-profile-popup {
                position: fixed;
                background: #ffffff;
                border-radius: 24px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 16px 48px rgba(0, 0, 0, 0.08);
                min-width: 340px;
                max-width: 380px;
                z-index: 9999;
                overflow: hidden;
                border: 1px solid #dadce0;
                font-family: 'Google Sans', 'Roboto', 'Segoe UI', Arial, sans-serif;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .dark-theme .reverbit-profile-popup {
                background: #202124;
                border-color: #3c4043;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }
            
            .reverbit-profile-popup.dark-theme-popup {
                background: #202124;
                border-color: #3c4043;
            }
            
            @keyframes gradientShift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            
            @keyframes streakGlow {
                0%, 100% { box-shadow: 0 2px 8px rgba(251, 188, 5, 0.2); }
                50% { box-shadow: 0 4px 16px rgba(251, 188, 5, 0.4); }
            }
            
            /* Profile Avatar Large - Enhanced */
            .profile-avatar-large:hover .avatar-container {
                transform: scale(1.05);
                box-shadow: 0 6px 24px rgba(0,0,0,0.2);
            }
            
            .profile-avatar-large:hover .avatar-upload-btn {
                opacity: 1;
                transform: scale(1);
            }
            
            .profile-avatar-large .avatar-container:hover img {
                transform: scale(1.1);
            }
            
            /* Menu Items - Enhanced */
            .profile-menu-item {
                transition: all 0.2s ease;
            }
            
            .profile-menu-item:hover {
                background: #f8f9fa;
                transform: translateX(4px);
            }
            
            .dark-theme .profile-menu-item:hover {
                background: #2d2e31;
            }
            
            .profile-menu-item:hover .profile-menu-icon {
                transform: rotate(5deg) scale(1.1);
            }
            
            .profile-menu-item:hover .menu-arrow {
                transform: translateX(5px);
                opacity: 1;
            }
            
            .profile-menu-item:active {
                transform: scale(0.98);
            }
            
            /* Change Avatar Button - Enhanced */
            .change-avatar-btn {
                transition: all 0.2s ease;
            }
            
            .change-avatar-btn:hover {
                background: #d2e3fc;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(26, 115, 232, 0.2);
            }
            
            .dark-theme .change-avatar-btn {
                color: #8ab4f8;
                background: #2d2e31;
            }
            
            .dark-theme .change-avatar-btn:hover {
                background: #3c4043;
            }
            
            /* Verified Badge - Enhanced */
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
                animation: verifiedPulse 2s infinite;
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
            
            /* Context Menu - Enhanced */
            .avatar-context-menu {
                position: fixed;
                background: #ffffff;
                border: 1px solid #dadce0;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                z-index: 10001;
                min-width: 200px;
                overflow: hidden;
                animation: contextMenuIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .dark-theme .avatar-context-menu {
                background: #202124;
                border-color: #3c4043;
            }
            
            @keyframes contextMenuIn {
                0% {
                    opacity: 0;
                    transform: scale(0.9) translateY(-10px);
                }
                100% {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            .context-menu-item {
                display: flex;
                align-items: center;
                gap: 12px;
                width: 100%;
                padding: 12px 16px;
                border: none;
                background: none;
                color: #202124;
                font-family: inherit;
                font-size: 14px;
                text-align: left;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .dark-theme .context-menu-item {
                color: #e8eaed;
            }
            
            .context-menu-item:hover {
                background: #f8f9fa;
                transform: translateX(4px);
            }
            
            .dark-theme .context-menu-item:hover {
                background: #2d2e31;
            }
            
            /* Toast Notifications - Enhanced */
            .reverbit-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: #ffffff;
                color: #202124;
                padding: 12px 24px;
                border-radius: 100px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10003;
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                max-width: 90%;
                width: max-content;
                min-width: 300px;
                border: 1px solid transparent;
            }
            
            .dark-theme .reverbit-toast {
                background: #202124;
                color: #e8eaed;
            }
            
            .reverbit-toast.reverbit-toast-success {
                border-color: #34a853;
            }
            
            .reverbit-toast.reverbit-toast-error {
                border-color: #ea4335;
            }
            
            .reverbit-toast.reverbit-toast-warning {
                border-color: #fbbc05;
            }
            
            .reverbit-toast.reverbit-toast-info {
                border-color: #1a73e8;
            }
            
            .reverbit-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            
            .toast-close {
                transition: all 0.2s ease;
            }
            
            .toast-close:hover {
                background: rgba(0,0,0,0.05);
                transform: rotate(90deg);
            }
            
            .dark-theme .toast-close:hover {
                background: rgba(255,255,255,0.1);
            }
            
            /* Popup Backdrop - Enhanced */
            .popup-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.4);
                backdrop-filter: blur(4px);
                z-index: 9997;
                opacity: 0;
                transition: opacity 0.2s ease;
            }
            
            /* Responsive */
            @media (max-width: 640px) {
                .reverbit-profile-popup {
                    position: fixed;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) scale(0.95) !important;
                    width: calc(100vw - 40px);
                    min-width: auto;
                    max-width: 400px;
                    max-height: 80vh;
                }
                
                .reverbit-profile-popup[style*="display: block"] {
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
                
                .profile-name-container {
                    justify-content: center;
                }
                
                .profile-meta {
                    align-items: center;
                }
                
                .reverbit-floating-header {
                    top: 8px;
                    right: 8px;
                    padding: 6px 10px;
                }
            }
            
            /* Reduced Motion */
            @media (prefers-reduced-motion: reduce) {
                *,
                *::before,
                *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
        
        console.log('Auth: Enhanced styles injected');
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
        
    } catch (error) {
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

console.log('Reverbit Advanced Auth System v2.0 - Enhanced UI/UX loaded successfully');
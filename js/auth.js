// ============================================
// REVERBIT ADVANCED AUTHENTICATION SYSTEM
// Complete Feature-Rich Version with All Original Functionality
// ============================================

class ReverbitAuth {
    constructor() {
        // ========== FIREBASE CONFIGURATION ==========
        this.firebaseConfig = {
            apiKey: "AIzaSyDE0eix0uVHuUS5P5DbuPA-SZt6pD8ob8A",
            authDomain: "reverbit11.firebaseapp.com",
            projectId: "reverbit11",
            storageBucket: "reverbit11.firebasestorage.app",
            messagingSenderId: "607495314412",
            appId: "1:607495314412:web:8c098f88b0d3b4620f7ec9",
            measurementId: "G-DMWMRM1M47"
        };
        
        // ========== CLOUDINARY CONFIGURATION ==========
        this.cloudinaryConfig = {
            cloudName: 'dgy9v2ctk',
            uploadPreset: 'reverbit_unsigned11',
            folder: 'reverbit/user'
        };
        
        // ========== CORE STATE ==========
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
        
        // ========== PERFORMANCE TRACKING ==========
        this.lastUpdate = 0;
        this.updateInterval = null;
        this.pendingUpdates = new Map();
        this.abortController = null;
        
        // ========== BOUND METHODS ==========
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.uploadProfilePicture = this.uploadProfilePicture.bind(this);
        this.handleAvatarUpload = this.handleAvatarUpload.bind(this);
        this.applyTheme = this.applyTheme.bind(this);
        this.toggleTheme = this.toggleTheme.bind(this);
        this.logout = this.logout.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.debouncedUpdateLastActive = this.debounce(this.updateLastActive.bind(this), 5000);
        
        console.log('ReverbitAuth: Constructor initialized');
    }

    // ========== INITIALIZATION ==========
    async init() {
        if (this.initialized) {
            console.log('ReverbitAuth: Already initialized');
            return;
        }
        
        const startTime = performance.now();
        
        try {
            console.log('ReverbitAuth: Initializing advanced authentication system...');
            
            // Initialize Firebase with retry logic
            await this.initializeFirebase();
            
            // Initialize Cloudinary
            this.initCloudinaryWidget();
            
            // Setup auth listener
            this.setupAuthListener();
            
            // Check existing session
            await this.checkExistingSession();
            
            // Initialize theme system
            this.initThemeSystem();
            
            // Add enhanced styles
            this.injectStyles();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup periodic updates
            this.setupPeriodicUpdates();
            
            // Setup visibility change listener
            this.setupVisibilityListener();
            
            this.initialized = true;
            
            console.log(`ReverbitAuth: Initialized successfully in ${performance.now() - startTime}ms`);
            
            // Notify listeners
            this.notifyAuthListeners();
            
        } catch (error) {
            console.error('ReverbitAuth: Initialization error:', error);
            this.showToast('Failed to initialize authentication system', 'error');
        }
    }

    async initializeFirebase(retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(this.firebaseConfig);
                    console.log('ReverbitAuth: Firebase initialized');
                }
                
                this.auth = firebase.auth();
                this.db = firebase.firestore();
                this.storage = firebase.storage();
                
                // Enable Firestore persistence with error handling
                try {
                    await this.db.enablePersistence({ 
                        synchronizeTabs: true,
                        experimentalForceOwningTab: true 
                    });
                    console.log('ReverbitAuth: Firestore persistence enabled');
                } catch (persistenceError) {
                    if (persistenceError.code === 'failed-precondition') {
                        console.warn('ReverbitAuth: Multiple tabs open - persistence limited');
                    } else if (persistenceError.code === 'unimplemented') {
                        console.warn('ReverbitAuth: Browser does not support persistence');
                    } else {
                        console.warn('ReverbitAuth: Persistence error:', persistenceError);
                    }
                }
                
                return;
            } catch (error) {
                console.warn(`ReverbitAuth: Firebase init attempt ${i + 1} failed:`, error);
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    // ========== THEME MANAGEMENT ==========
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
        console.log('ReverbitAuth: Initializing theme system...');
        
        // Detect page theme first
        const pageTheme = this.detectPageTheme();
        const savedTheme = localStorage.getItem('reverbit_theme');
        
        if (pageTheme) {
            this.currentTheme = pageTheme;
            console.log('ReverbitAuth: Detected page theme:', pageTheme);
        } else if (savedTheme) {
            this.currentTheme = savedTheme;
            console.log('ReverbitAuth: Using saved theme:', savedTheme);
        } else if (this.userProfile && this.userProfile.theme) {
            this.currentTheme = this.userProfile.theme;
            console.log('ReverbitAuth: Using profile theme:', this.userProfile.theme);
        } else {
            this.currentTheme = 'auto';
            console.log('ReverbitAuth: Using auto theme detection');
        }
        
        // Apply theme immediately
        this.applyTheme();
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                console.log('ReverbitAuth: System theme changed, updating...');
                this.applyTheme();
            }
        });
        
        // Setup theme observer
        this.setupThemeObserver();
        
        console.log('ReverbitAuth: Theme system initialized with:', this.currentTheme);
    }

    setupThemeObserver() {
        this.themeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme')) {
                    const newTheme = this.detectPageTheme();
                    if (newTheme && newTheme !== (this.isDarkMode ? 'dark' : 'light')) {
                        this.isDarkMode = newTheme === 'dark';
                        this.updatePopupTheme();
                    }
                }
            });
        });
        
        this.themeObserver.observe(document.body, { 
            attributes: true, 
            attributeFilter: ['class', 'data-theme'] 
        });
        
        this.themeObserver.observe(document.documentElement, { 
            attributes: true, 
            attributeFilter: ['class', 'data-theme'] 
        });
    }

    applyTheme(skipAnimation = false) {
        const wasDark = this.isDarkMode;
        
        // Determine actual theme
        if (this.currentTheme === 'auto') {
            this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
            this.isDarkMode = this.currentTheme === 'dark';
        }
        
        // Store preference
        localStorage.setItem('reverbit_theme', this.currentTheme);
        localStorage.setItem('reverbit_dark_mode', this.isDarkMode.toString());
        
        // Apply to document
        if (this.isDarkMode) {
            document.body.classList.add('dark-theme');
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            document.documentElement.setAttribute('data-theme', 'light');
        }
        
        document.documentElement.style.setProperty('color-scheme', this.isDarkMode ? 'dark' : 'light');
        
        // Animate transition if not skipping
        if (!skipAnimation && wasDark !== this.isDarkMode) {
            document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
            setTimeout(() => {
                document.documentElement.style.transition = '';
            }, 300);
        }
        
        // Update popup if visible
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.updatePopupTheme();
        }
        
        this.notifyThemeObservers();
        
        console.log('ReverbitAuth: Theme applied -', this.currentTheme, '(dark:', this.isDarkMode, ')');
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
                console.error('ReverbitAuth: Error saving theme preference:', error);
            }
        }
        
        // Update popup if open
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.updatePopupTheme();
        }
    }

    updatePopupTheme() {
        if (this.profilePopup) {
            if (this.isDarkMode) {
                this.profilePopup.classList.add('dark-theme-popup');
            } else {
                this.profilePopup.classList.remove('dark-theme-popup');
            }
            
            // Update theme toggle button text if present
            const themeBtn = this.profilePopup.querySelector('.theme-toggle-btn');
            if (themeBtn) {
                const icon = themeBtn.querySelector('.menu-icon');
                const text = themeBtn.querySelector('.menu-text');
                if (icon) icon.innerHTML = this.isDarkMode ? '☀️' : '🌙';
                if (text) text.textContent = this.isDarkMode ? 'Light Mode' : 'Dark Mode';
            }
        }
    }

    notifyThemeObservers() {
        this.profileObservers.forEach(observer => {
            if (observer.onThemeChange) {
                try {
                    observer.onThemeChange(this.currentTheme, this.isDarkMode);
                } catch (error) {
                    console.error('ReverbitAuth: Theme observer error:', error);
                }
            }
        });
    }

    // ========== AUTH LISTENERS ==========
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
                console.error('ReverbitAuth: Auth listener error:', error);
            }
        });
    }

    // ========== CLOUDINARY ==========
    initCloudinaryWidget() {
        if (!window.cloudinary) {
            console.log('ReverbitAuth: Loading Cloudinary widget...');
            const script = document.createElement('script');
            script.src = 'https://upload-widget.cloudinary.com/global/all.js';
            script.async = true;
            script.onload = () => console.log('ReverbitAuth: Cloudinary widget loaded');
            script.onerror = (error) => console.error('ReverbitAuth: Failed to load Cloudinary:', error);
            document.head.appendChild(script);
        }
    }

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        // Global click handler for popup
        document.addEventListener('click', this.handleClickOutside);
        
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Window resize for popup positioning
        window.addEventListener('resize', this.handleResize);
        
        // Visibility change for activity tracking
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        
        // Window focus/blur
        window.addEventListener('focus', () => this.debouncedUpdateLastActive());
        window.addEventListener('blur', () => {});
    }

    handleKeyDown(event) {
        // ESC to close popup
        if (event.key === 'Escape' && this.profilePopup && this.profilePopup.style.display === 'block') {
            this.hideProfilePopup();
        }
        
        // Ctrl/Cmd + Shift + P to open profile
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'P') {
            event.preventDefault();
            this.toggleProfilePopup();
        }
        
        // Alt + T to toggle theme
        if (event.altKey && event.key === 't') {
            event.preventDefault();
            this.toggleTheme();
        }
    }

    handleResize() {
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.positionPopup();
        }
    }

    onVisibilityChange() {
        if (document.visibilityState === 'visible' && this.user) {
            this.debouncedUpdateLastActive();
        }
    }

    // ========== AUTH STATE MANAGEMENT ==========
    setupAuthListener() {
        console.log('ReverbitAuth: Setting up auth state listener...');
        
        this.auth.onAuthStateChanged(async (user) => {
            console.log('ReverbitAuth: Auth state changed -', user ? 'User logged in' : 'User logged out');
            
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
                
                console.log('ReverbitAuth: Loading profile for UID:', user.uid);
                
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
                    
                    // Update streak
                    await this.updateStreak();
                    
                    console.log('ReverbitAuth: User fully loaded:', this.user.email);
                    
                    // Show welcome for new users
                    this.showWelcomeMessage();
                    
                } catch (profileError) {
                    console.error('ReverbitAuth: Profile loading failed:', profileError);
                    this.showToast('Failed to load user profile', 'error');
                }
                
            } else {
                console.log('ReverbitAuth: User signed out');
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
                        console.error('ReverbitAuth: Profile observer error:', error);
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
            const savedProfile = localStorage.getItem('reverbit_user_profile');
            
            // Apply saved theme immediately
            if (savedTheme) {
                this.currentTheme = savedTheme;
                this.applyTheme();
            }
            
            if (userData && userUid) {
                console.log('ReverbitAuth: Found existing session for UID:', userUid);
                this.user = JSON.parse(userData);
                
                if (savedProfile) {
                    this.userProfile = JSON.parse(savedProfile);
                }
                
                try {
                    const currentUser = this.auth.currentUser;
                    if (currentUser && currentUser.uid === userUid) {
                        console.log('ReverbitAuth: Session valid, refreshing profile...');
                        await this.loadUserProfile();
                        
                        if (this.userProfile?.theme) {
                            this.currentTheme = this.userProfile.theme;
                            this.applyTheme();
                        }
                        
                        this.addOrUpdateProfileAvatar();
                    } else {
                        console.log('ReverbitAuth: Session expired, clearing...');
                        this.clearSession();
                    }
                } catch (sessionError) {
                    console.warn('ReverbitAuth: Session check failed:', sessionError);
                    this.clearSession();
                }
            } else {
                console.log('ReverbitAuth: No existing session found');
            }
        } catch (error) {
            console.error('ReverbitAuth: Session check error:', error);
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

    // ========== PROFILE MANAGEMENT ==========
    async loadUserProfile() {
        if (!this.user || !this.db) {
            console.error('ReverbitAuth: Cannot load profile - no user or db');
            return;
        }
        
        try {
            console.log('ReverbitAuth: Loading profile from Firestore...');
            const userRef = this.db.collection('users').doc(this.user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                this.userProfile.uid = this.user.uid;
                console.log('ReverbitAuth: Loaded existing profile for:', this.user.email);
                
                // Ensure all required fields exist
                this.ensureProfileFields();
                
            } else {
                console.log('ReverbitAuth: Creating new profile for:', this.user.email);
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
                        console.error('ReverbitAuth: Profile load observer error:', error);
                    }
                }
            });
            
        } catch (error) {
            console.error('ReverbitAuth: Profile loading error:', error);
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
            photoURL: this.user.photoURL || this.generateAvatarUrl(displayName),
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
            verified: false,
            premium: false,
            verifiedBy: null,
            verifiedLevel: 'none',
            premiumVerified: false,
            preferences: {
                notifications: true,
                emailUpdates: true,
                autoSave: true,
                reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            }
        };
        
        console.log('ReverbitAuth: Creating profile with data:', this.userProfile);
        
        try {
            await userRef.set(this.userProfile);
            console.log('ReverbitAuth: Profile created successfully');
            
            // Show welcome message
            this.showToast(`Welcome to Reverbit, ${displayName}!`, 'success');
            
        } catch (createError) {
            console.error('ReverbitAuth: Profile creation failed:', createError);
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
            verified: false,
            premium: false,
            verifiedBy: null,
            verifiedLevel: 'none',
            premiumVerified: false,
            totalLogins: this.userProfile.totalLogins || 1,
            preferences: this.userProfile.preferences || {
                notifications: true,
                emailUpdates: true,
                autoSave: true,
                reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
            console.log('ReverbitAuth: Added missing profile fields');
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

    generateAvatarUrl(name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a73e8&color=fff&bold=true&size=256`;
    }

    async handleProfileError(error) {
        console.error('ReverbitAuth: Profile error handler activated');
        
        // Try to load from localStorage
        const storedProfile = localStorage.getItem('reverbit_user_profile');
        if (storedProfile) {
            this.userProfile = JSON.parse(storedProfile);
            console.log('ReverbitAuth: Loaded profile from localStorage cache');
            return;
        }
        
        // Create minimal fallback profile
        this.userProfile = {
            uid: this.user.uid,
            email: this.user.email,
            displayName: this.user.displayName || 'User',
            photoURL: this.user.photoURL || this.generateAvatarUrl('User'),
            isPublic: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            theme: this.currentTheme,
            verified: false,
            premium: false
        };
        
        console.log('ReverbitAuth: Created fallback profile');
        
        // Try to save later
        setTimeout(async () => {
            try {
                await this.db.collection('users').doc(this.user.uid).set(this.userProfile, { merge: true });
                console.log('ReverbitAuth: Fallback profile saved to Firestore');
            } catch (saveError) {
                console.error('ReverbitAuth: Failed to save fallback profile:', saveError);
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
            console.log('ReverbitAuth: Profile updated in Firestore');
        } catch (error) {
            console.error('ReverbitAuth: Failed to update profile:', error);
        }
    }

    // ========== VERIFICATION HELPERS ==========
    getVerificationLevel() {
        if (!this.userProfile) return 'none';
        
        // Check for premium verification
        if (this.userProfile.premium || this.userProfile.premiumVerified || this.userProfile.verifiedLevel === 'premium') {
            return 'premium';
        }
        
        // Check for basic verification
        if (this.userProfile.verified || this.userProfile.verifiedLevel === 'basic' || this.userProfile.verifiedBy) {
            return 'basic';
        }
        
        return 'none';
    }

    isVerified() {
        const level = this.getVerificationLevel();
        return level === 'basic' || level === 'premium';
    }

    isPremium() {
        return this.getVerificationLevel() === 'premium';
    }

    getVerificationBadgeHTML(level = null) {
        const verificationLevel = level || this.getVerificationLevel();
        
        if (verificationLevel === 'none') return '';
        
        const isPremium = verificationLevel === 'premium';
        const icon = isPremium ? '👑' : '✓';
        const color = isPremium ? '#FFD700' : '#1a73e8';
        const title = isPremium ? 'Premium Verified' : 'Verified';
        
        return `
            <span class="verified-badge-popup ${isPremium ? 'premium' : ''}" 
                  style="display:inline-flex; align-items:center; gap:4px; background:${color}; color:${isPremium ? '#000' : '#fff'}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;" 
                  title="${title}">
                <span style="font-size:12px;">${icon}</span>
                <span style="display:none;">${title}</span>
            </span>
        `;
    }

    getAvatarBadgeHTML() {
        const verificationLevel = this.getVerificationLevel();
        
        if (verificationLevel === 'none') return '';
        
        const isPremium = verificationLevel === 'premium';
        const icon = isPremium ? '👑' : '✓';
        const color = isPremium ? '#FFD700' : '#1a73e8';
        
        return `
            <span class="avatar-verified-badge ${isPremium ? 'premium' : ''}" 
                  style="position:absolute; bottom:-2px; right:-2px; width:18px; height:18px; border-radius:50%; background:${color}; color:${isPremium ? '#000' : '#fff'}; display:flex; align-items:center; justify-content:center; font-size:10px; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.2); z-index:3;"
                  title="${isPremium ? 'Premium Verified' : 'Verified'}">
                ${icon}
            </span>
        `;
    }

    // ========== PROFILE AVATAR UI ==========
    addOrUpdateProfileAvatar() {
        console.log('ReverbitAuth: Managing profile avatar UI...');
        
        // Check if avatar already exists
        const existingAvatar = document.querySelector('.reverbit-profile-avatar');
        if (existingAvatar) {
            this.profileAvatar = existingAvatar;
            this.updateProfileAvatar();
            console.log('ReverbitAuth: Updated existing avatar');
            return;
        }
        
        // Find or create header actions container
        let headerActions = document.querySelector('.header-actions, .nav-right, .desktop-nav');
        
        if (!headerActions) {
            console.log('ReverbitAuth: Creating header actions container...');
            
            // Look for existing header
            const header = document.querySelector('.app-header, header, .header, nav.navbar, [role="banner"]');
            
            if (header) {
                headerActions = document.createElement('div');
                headerActions.className = 'header-actions';
                headerActions.style.cssText = 'display:flex; align-items:center; gap:8px;';
                header.appendChild(headerActions);
            } else {
                // Create floating header
                headerActions = this.createFloatingHeader();
            }
        }
        
        // Create avatar button
        this.createAvatarButton(headerActions);
        
        // Create file input for uploads
        this.createAvatarUploadInput();
        
        console.log('ReverbitAuth: Avatar UI setup complete');
    }

    createFloatingHeader() {
        console.log('ReverbitAuth: Creating floating header...');
        
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
            border-radius: 40px;
            border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        `;
        
        const headerActions = document.createElement('div');
        headerActions.className = 'header-actions';
        headerActions.style.cssText = 'display:flex; align-items:center; gap:8px;';
        
        floatingHeader.appendChild(headerActions);
        document.body.appendChild(floatingHeader);
        
        floatingHeader.addEventListener('mouseenter', () => {
            floatingHeader.style.transform = 'translateY(-2px)';
            floatingHeader.style.boxShadow = '0 8px 28px rgba(0, 0, 0, 0.15)';
        });
        
        floatingHeader.addEventListener('mouseleave', () => {
            floatingHeader.style.transform = 'translateY(0)';
            floatingHeader.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        });
        
        console.log('ReverbitAuth: Floating header created');
        return headerActions;
    }

    createAvatarButton(container) {
        this.profileAvatar = document.createElement('button');
        this.profileAvatar.className = 'reverbit-profile-avatar';
        this.profileAvatar.setAttribute('aria-label', 'User profile menu');
        this.profileAvatar.setAttribute('title', 'Profile menu');
        this.profileAvatar.setAttribute('role', 'button');
        this.profileAvatar.setAttribute('tabindex', '0');
        
        this.profileAvatar.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid #1a73e8;
            cursor: pointer;
            overflow: hidden;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f0f0f0;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            flex-shrink: 0;
            padding: 0;
        `;
        
        // Create avatar container
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'avatar-container';
        avatarContainer.style.cssText = 'width:100%; height:100%; position:relative;';
        
        // Create avatar image
        const avatarImg = document.createElement('img');
        avatarImg.className = 'avatar-img';
        avatarImg.alt = 'Profile avatar';
        avatarImg.loading = 'lazy';
        avatarImg.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
        
        avatarContainer.appendChild(avatarImg);
        this.profileAvatar.appendChild(avatarContainer);
        
        // Add verification badge if verified
        if (this.isVerified()) {
            const badgeHTML = this.getAvatarBadgeHTML();
            const badgeContainer = document.createElement('div');
            badgeContainer.innerHTML = badgeHTML;
            this.profileAvatar.appendChild(badgeContainer.firstChild);
        }
        
        // Create upload overlay
        const uploadOverlay = document.createElement('div');
        uploadOverlay.className = 'avatar-upload-overlay';
        uploadOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
            border-radius: 50%;
        `;
        uploadOverlay.innerHTML = '📷';
        this.profileAvatar.appendChild(uploadOverlay);
        
        // Create loading spinner
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'avatar-loading';
        loadingSpinner.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255,255,255,0.8);
            display: none;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            z-index: 5;
        `;
        loadingSpinner.innerHTML = '<div class="spinner" style="width:20px; height:20px; border:2px solid #ccc; border-top-color:#1a73e8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>';
        this.profileAvatar.appendChild(loadingSpinner);
        
        // Add event listeners
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
        
        this.profileAvatar.addEventListener('mouseenter', () => {
            this.profileAvatar.style.transform = 'scale(1.05)';
            this.profileAvatar.style.boxShadow = '0 4px 12px rgba(26,115,232,0.3)';
            uploadOverlay.style.opacity = '1';
        });
        
        this.profileAvatar.addEventListener('mouseleave', () => {
            this.profileAvatar.style.transform = 'scale(1)';
            this.profileAvatar.style.boxShadow = '';
            uploadOverlay.style.opacity = '0';
        });
        
        this.profileAvatar.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e);
        });
        
        // Insert into container
        if (container.firstChild) {
            container.insertBefore(this.profileAvatar, container.firstChild);
        } else {
            container.appendChild(this.profileAvatar);
        }
        
        // Update avatar image
        this.updateProfileAvatar();
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
            position: fixed;
            opacity: 0;
            width: 1px;
            height: 1px;
            pointer-events: none;
            z-index: -1;
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
            console.warn('ReverbitAuth: Cannot update avatar - missing elements');
            return;
        }
        
        const avatarImg = this.profileAvatar.querySelector('.avatar-img');
        if (!avatarImg) return;
        
        const displayName = this.userProfile.displayName || 'User';
        let photoURL = this.userProfile.photoURL || this.generateAvatarUrl(displayName);
        
        // Add cache busting
        const cacheBuster = `t=${Date.now()}`;
        photoURL += (photoURL.includes('?') ? '&' : '?') + cacheBuster;
        
        // Set image source
        avatarImg.src = photoURL;
        avatarImg.alt = `${displayName}'s profile picture`;
        
        // Handle loading
        avatarImg.onload = () => {
            console.log('ReverbitAuth: Avatar image loaded');
            this.profileAvatar.classList.remove('loading');
            this.profileAvatar.classList.add('loaded');
        };
        
        avatarImg.onerror = () => {
            console.warn('ReverbitAuth: Avatar image failed to load, using fallback');
            avatarImg.src = this.generateAvatarUrl(displayName);
            this.profileAvatar.classList.remove('loading');
        };
        
        // Show loading state
        this.profileAvatar.classList.add('loading');
        
        // Update verification badge
        this.updateAvatarVerificationBadge();
    }

    updateAvatarVerificationBadge() {
        // Remove existing badge
        const existingBadge = this.profileAvatar.querySelector('.avatar-verified-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Add new badge if verified
        if (this.isVerified()) {
            const badgeHTML = this.getAvatarBadgeHTML();
            const badgeContainer = document.createElement('div');
            badgeContainer.innerHTML = badgeHTML;
            this.profileAvatar.appendChild(badgeContainer.firstChild);
        }
    }

    showContextMenu(event) {
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
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10001;
            min-width: 200px;
            overflow: hidden;
        `;
        
        const menuItems = [
            { icon: '📷', text: 'Upload Photo', action: () => this.handleAvatarUpload() },
            { icon: '👤', text: 'View Profile', action: () => this.viewProfile() },
            { icon: '⚙️', text: 'Settings', action: () => this.openSettings() },
            { icon: '🌙', text: this.isDarkMode ? 'Light Mode' : 'Dark Mode', action: () => this.toggleTheme() },
            { type: 'divider' },
            { icon: '🚪', text: 'Sign Out', action: () => this.logout(), danger: true }
        ];
        
        menuItems.forEach(item => {
            if (item.type === 'divider') {
                const divider = document.createElement('hr');
                divider.style.cssText = 'margin:4px 0; border:none; border-top:1px solid ' + (this.isDarkMode ? '#3c4043' : '#eee') + ';';
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
                transition: background 0.2s ease;
            `;
            
            menuItem.innerHTML = `<span style="font-size:16px; width:24px;">${item.icon}</span> <span>${item.text}</span>`;
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.backgroundColor = this.isDarkMode ? '#2d2e31' : '#f5f5f5';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.backgroundColor = 'transparent';
            });
            
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                contextMenu.remove();
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

    // ========== PROFILE POPUP ==========
    createProfilePopup() {
        console.log('ReverbitAuth: Creating profile popup...');
        
        // Remove existing popup
        this.removeProfilePopup();
        
        // Create popup container
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = `reverbit-profile-popup ${this.isDarkMode ? 'dark-theme-popup' : ''}`;
        this.profilePopup.setAttribute('role', 'dialog');
        this.profilePopup.setAttribute('aria-label', 'Profile menu');
        this.profilePopup.setAttribute('aria-modal', 'true');
        
        this.profilePopup.style.cssText = `
            position: fixed;
            display: none;
            background: ${this.isDarkMode ? '#202124' : '#ffffff'};
            border-radius: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            width: 380px;
            z-index: 10000;
            border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            font-family: 'Google Sans', 'Segoe UI', Arial, sans-serif;
            max-height: 90vh;
            overflow-y: auto;
        `;
        
        // Create popup content
        this.profilePopup.innerHTML = this.getPopupHTML();
        
        // Add to body
        document.body.appendChild(this.profilePopup);
        
        // Add event listeners
        setTimeout(() => {
            this.attachPopupEventListeners();
        }, 10);
        
        console.log('ReverbitAuth: Profile popup created');
    }

    getPopupHTML() {
        if (!this.userProfile) {
            return `
                <div class="popup-loading" style="padding:48px; text-align:center;">
                    <div class="spinner" style="width:40px; height:40px; margin:0 auto 16px; border:3px solid #eee; border-top-color:#1a73e8; border-radius:50%; animation:spin 1s linear infinite;"></div>
                    <p style="color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'};">Loading profile...</p>
                </div>
            `;
        }
        
        const p = this.userProfile;
        const displayName = p.displayName || 'User';
        const email = p.email || '';
        const profileUrl = `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
        const isPremium = this.isPremium();
        const isVerified = this.isVerified();
        const streak = p.streak || 0;
        const memberDays = this.getMemberDays();
        const joinDate = this.formatDate(p.createdAt);
        const lastActive = this.formatRelativeTime(p.lastActive);
        const totalLogins = p.totalLogins || 1;
        
        return `
            <div class="popup-container" style="position:relative;">
                <button class="popup-close" style="position:absolute; top:16px; right:16px; width:32px; height:32px; border-radius:50%; border:none; background:transparent; color:${this.isDarkMode ? '#e8eaed' : '#202124'}; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10;">
                    ✕
                </button>
                
                <div style="padding:24px;">
                    <!-- Avatar Section -->
                    <div style="display:flex; align-items:center; gap:20px; margin-bottom:24px;">
                        <div style="position:relative; width:100px; height:100px; flex-shrink:0;">
                            <div style="width:100%; height:100%; border-radius:50%; overflow:hidden; border:3px solid #1a73e8; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                                <img src="${p.photoURL || this.generateAvatarUrl(displayName)}" 
                                     alt="${displayName}" 
                                     style="width:100%; height:100%; object-fit:cover;"
                                     onerror="this.src='${this.generateAvatarUrl(displayName)}'">
                            </div>
                            <button class="avatar-upload-btn" style="position:absolute; bottom:0; right:0; width:32px; height:32px; border-radius:50%; background:#1a73e8; border:2px solid white; color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; padding:0; transition:transform 0.2s;">
                                📷
                            </button>
                            ${isPremium ? '<span style="position:absolute; top:0; right:0; width:24px; height:24px; border-radius:50%; background:#FFD700; color:#000; display:flex; align-items:center; justify-content:center; font-size:12px; border:2px solid white;">👑</span>' : ''}
                            ${isVerified && !isPremium ? '<span style="position:absolute; top:0; right:0; width:24px; height:24px; border-radius:50%; background:#1a73e8; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; border:2px solid white;">✓</span>' : ''}
                        </div>
                        
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                                <h2 style="font-size:22px; font-weight:600; color:${this.isDarkMode ? '#e8eaed' : '#202124'}; margin:0;">${displayName}</h2>
                                ${isPremium ? '<span style="background:#FFD700; color:#000; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">👑 Premium</span>' : ''}
                                ${isVerified && !isPremium ? '<span style="background:#1a73e8; color:#fff; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">✓ Verified</span>' : ''}
                            </div>
                            <div style="font-size:13px; color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'}; word-break:break-all; margin-bottom:8px;">${email}</div>
                            <div style="display:flex; gap:8px; font-size:12px; color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'};">
                                <span>Joined ${joinDate}</span>
                                <span>•</span>
                                <span>Last active ${lastActive}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Stats Section -->
                    <div style="display:flex; justify-content:space-around; padding:16px 0; border-top:1px solid ${this.isDarkMode ? '#3c4043' : '#eee'}; border-bottom:1px solid ${this.isDarkMode ? '#3c4043' : '#eee'}; margin-bottom:16px;">
                        <div style="text-align:center;">
                            <div style="font-size:22px; font-weight:700; color:#1a73e8;">${memberDays}</div>
                            <div style="font-size:11px; color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'}; text-transform:uppercase;">Days</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:22px; font-weight:700; color:#1a73e8;">${streak}</div>
                            <div style="font-size:11px; color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'}; text-transform:uppercase;">Streak</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:22px; font-weight:700; color:#1a73e8;">${totalLogins}</div>
                            <div style="font-size:11px; color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'}; text-transform:uppercase;">Logins</div>
                        </div>
                    </div>
                    
                    <!-- Menu Items -->
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <a href="https://aditya-cmd-max.github.io/dashboard" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; text-decoration:none; color:${this.isDarkMode ? '#e8eaed' : '#202124'}; transition:background 0.2s; cursor:pointer;">
                            <span style="font-size:18px; width:24px;">📊</span>
                            <span style="flex:1;">Dashboard</span>
                            <span style="color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'};">›</span>
                        </a>
                        
                        <a href="${profileUrl}" target="_blank" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; text-decoration:none; color:${this.isDarkMode ? '#e8eaed' : '#202124'}; transition:background 0.2s; cursor:pointer;">
                            <span style="font-size:18px; width:24px;">👤</span>
                            <span style="flex:1;">Public Profile</span>
                            <span style="color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'};">›</span>
                        </a>
                        
                        <button class="theme-toggle-btn" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; border:none; background:transparent; color:${this.isDarkMode ? '#e8eaed' : '#202124'}; font-size:14px; cursor:pointer; width:100%; text-align:left;">
                            <span class="menu-icon" style="font-size:18px; width:24px;">${this.isDarkMode ? '☀️' : '🌙'}</span>
                            <span class="menu-text" style="flex:1;">${this.isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                            <span style="color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'};">›</span>
                        </button>
                        
                        <button class="logout-btn" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; border:none; background:transparent; color:#ea4335; font-size:14px; cursor:pointer; width:100%; text-align:left;">
                            <span style="font-size:18px; width:24px;">🚪</span>
                            <span style="flex:1;">Sign Out</span>
                            <span style="color:#ea4335;">›</span>
                        </button>
                    </div>
                    
                    <!-- Footer -->
                    <div style="margin-top:20px; padding-top:16px; border-top:1px solid ${this.isDarkMode ? '#3c4043' : '#eee'}; text-align:center; font-size:12px; color:${this.isDarkMode ? '#9aa0a6' : '#5f6368'};">
                        <a href="https://aditya-cmd-max.github.io/reverbit/privacy" target="_blank" style="color:#1a73e8; text-decoration:none; margin:0 8px;">Privacy</a>
                        <span>•</span>
                        <a href="https://aditya-cmd-max.github.io/reverbit/terms" target="_blank" style="color:#1a73e8; text-decoration:none; margin:0 8px;">Terms</a>
                        <span>•</span>
                        <a href="https://aditya-cmd-max.github.io/reverbit/help" target="_blank" style="color:#1a73e8; text-decoration:none; margin:0 8px;">Help</a>
                    </div>
                </div>
            </div>
        `;
    }

    attachPopupEventListeners() {
        if (!this.profilePopup) return;
        
        // Close button
        const closeBtn = this.profilePopup.querySelector('.popup-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideProfilePopup());
        }
        
        // Upload button
        const uploadBtn = this.profilePopup.querySelector('.avatar-upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleAvatarUpload();
            });
            
            uploadBtn.addEventListener('mouseenter', () => {
                uploadBtn.style.transform = 'scale(1.1)';
            });
            
            uploadBtn.addEventListener('mouseleave', () => {
                uploadBtn.style.transform = 'scale(1)';
            });
        }
        
        // Theme toggle button
        const themeBtn = this.profilePopup.querySelector('.theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                this.toggleTheme();
                this.profilePopup.innerHTML = this.getPopupHTML();
                this.attachPopupEventListeners();
                this.positionPopup();
            });
        }
        
        // Logout button
        const logoutBtn = this.profilePopup.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        
        // Hover effects for menu items
        const menuItems = this.profilePopup.querySelectorAll('a[href], .theme-toggle-btn, .logout-btn');
        menuItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = this.isDarkMode ? '#2d2e31' : '#f5f5f5';
            });
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'transparent';
            });
        });
        
        // Keyboard navigation
        this.profilePopup.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideProfilePopup();
            }
        });
        
        // Outside click handler
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside);
        }, 100);
    }

    toggleProfilePopup() {
        if (!this.user) {
            this.showToast('Please sign in to access profile', 'info');
            window.location.href = 'https://aditya-cmd-max.github.io/signin';
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
            console.error('ReverbitAuth: Cannot show popup - missing elements');
            return;
        }
        
        // Update content
        this.profilePopup.innerHTML = this.getPopupHTML();
        this.attachPopupEventListeners();
        
        // Show popup
        this.profilePopup.style.display = 'block';
        
        // Position popup
        this.positionPopup();
    }

    positionPopup() {
        if (!this.profileAvatar || !this.profilePopup) return;
        
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        const popupRect = this.profilePopup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Default position: below and aligned to left of avatar
        let top = avatarRect.bottom + 8;
        let left = avatarRect.left;
        
        // Adjust if off-screen right
        if (left + popupRect.width > viewportWidth - 16) {
            left = viewportWidth - popupRect.width - 16;
        }
        
        // Adjust if off-screen left
        if (left < 16) {
            left = 16;
        }
        
        // Check if enough space below
        if (top + popupRect.height > viewportHeight - 16) {
            // Try above
            if (avatarRect.top - popupRect.height - 8 > 16) {
                top = avatarRect.top - popupRect.height - 8;
            } else {
                // Center vertically
                top = Math.max(16, (viewportHeight - popupRect.height) / 2);
            }
        }
        
        // Ensure within bounds
        left = Math.max(16, Math.min(left, viewportWidth - popupRect.width - 16));
        top = Math.max(16, Math.min(top, viewportHeight - popupRect.height - 16));
        
        this.profilePopup.style.top = top + 'px';
        this.profilePopup.style.left = left + 'px';
    }

    hideProfilePopup() {
        if (this.profilePopup) {
            this.profilePopup.style.display = 'none';
        }
        document.removeEventListener('click', this.handleClickOutside);
    }

    removeProfilePopup() {
        if (this.profilePopup && this.profilePopup.parentNode) {
            this.profilePopup.parentNode.removeChild(this.profilePopup);
            this.profilePopup = null;
        }
        document.removeEventListener('click', this.handleClickOutside);
    }

    handleClickOutside(event) {
        if (!this.profilePopup || !this.profileAvatar) return;
        
        const isPopupClick = this.profilePopup.contains(event.target);
        const isAvatarClick = this.profileAvatar.contains(event.target);
        
        if (!isPopupClick && !isAvatarClick) {
            this.hideProfilePopup();
        }
    }

    removeProfileAvatar() {
        if (this.profileAvatar && this.profileAvatar.parentNode) {
            this.profileAvatar.parentNode.removeChild(this.profileAvatar);
            this.profileAvatar = null;
        }
    }

    // ========== AVATAR UPLOAD ==========
    async handleAvatarUpload() {
        if (!this.avatarUploadInput) {
            console.error('ReverbitAuth: Upload input not found');
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
            this.showCameraInterface(stream);
        } catch (error) {
            console.error('ReverbitAuth: Camera error:', error);
            this.showToast('Camera access denied', 'error');
        }
    }

    showCameraInterface(stream) {
        const cameraModal = document.createElement('div');
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
        video.style.cssText = 'width:90%; max-width:500px; border-radius:12px; background:#000;';
        
        const controls = document.createElement('div');
        controls.style.cssText = 'margin-top:20px; display:flex; gap:16px;';
        
        const captureBtn = document.createElement('button');
        captureBtn.innerHTML = '📷 Take Photo';
        captureBtn.style.cssText = 'padding:12px 24px; background:#1a73e8; color:white; border:none; border-radius:30px; cursor:pointer; font-size:16px; display:flex; align-items:center; gap:8px;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:12px 24px; background:#5f6368; color:white; border:none; border-radius:30px; cursor:pointer; font-size:16px;';
        
        video.srcObject = stream;
        
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
            console.error('ReverbitAuth: Cannot upload - no user or file');
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
            
            console.log('ReverbitAuth: Uploading to Cloudinary...');
            const response = await fetch(cloudinaryUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('ReverbitAuth: Cloudinary upload successful:', result);
            
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
                this.positionPopup();
            }
            
            this.showToast('Profile picture updated!', 'success');
            
        } catch (error) {
            console.error('ReverbitAuth: Upload failed:', error);
            this.showToast('Failed to upload picture', 'error');
        } finally {
            this.showUploadingState(false);
        }
    }

    showUploadingState(show) {
        if (!this.profileAvatar) return;
        
        const loadingSpinner = this.profileAvatar.querySelector('.avatar-loading');
        if (loadingSpinner) {
            loadingSpinner.style.display = show ? 'flex' : 'none';
        }
        
        if (show) {
            this.profileAvatar.classList.add('uploading');
        } else {
            this.profileAvatar.classList.remove('uploading');
        }
    }

    // ========== ACTIVITY TRACKING ==========
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
            console.error('ReverbitAuth: Login tracking error:', error);
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
            console.error('ReverbitAuth: Last active update error:', error);
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
            console.error('ReverbitAuth: Streak update error:', error);
        }
    }

    async trackUsage(appName, minutes) {
        if (!this.user || !this.db) return;
        
        const key = `usage_${appName}`;
        const now = Date.now();
        
        // Batch updates
        if (this.pendingUpdates.has(key)) {
            const existing = this.pendingUpdates.get(key);
            existing.minutes += minutes;
            existing.lastAttempt = now;
        } else {
            this.pendingUpdates.set(key, {
                appName,
                minutes,
                lastAttempt: now
            });
        }
        
        // Schedule batch update
        if (!this.updateTimer) {
            this.updateTimer = setTimeout(() => this.processPendingUpdates(), 5000);
        }
    }

    async processPendingUpdates() {
        if (!this.user?.uid || this.pendingUpdates.size === 0) return;
        
        const updates = Array.from(this.pendingUpdates.entries());
        this.pendingUpdates.clear();
        this.updateTimer = null;
        
        try {
            const usageRef = this.db.collection('usage').doc(this.user.uid);
            const batch = {};
            
            updates.forEach(([key, data]) => {
                batch[data.appName] = firebase.firestore.FieldValue.increment(data.minutes);
            });
            
            await usageRef.set({
                ...batch,
                lastUsed: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
        } catch (error) {
            console.warn('ReverbitAuth: Usage tracking error:', error);
            updates.forEach(([key, data]) => {
                this.pendingUpdates.set(key, data);
            });
        }
    }

    // ========== PERIODIC UPDATES ==========
    setupPeriodicUpdates() {
        // Update last active every 5 minutes when visible
        setInterval(() => {
            if (this.user && document.visibilityState === 'visible') {
                this.debouncedUpdateLastActive();
            }
        }, 5 * 60 * 1000);
        
        // Process usage updates every 10 minutes
        setInterval(() => {
            if (this.pendingUpdates.size > 0) {
                this.processPendingUpdates();
            }
        }, 10 * 60 * 1000);
    }

    setupVisibilityListener() {
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        window.addEventListener('focus', () => this.onWindowFocus());
        window.addEventListener('blur', () => this.onWindowBlur());
    }

    onWindowFocus() {
        if (this.user) {
            this.debouncedUpdateLastActive();
            this.updateStreak();
        }
    }

    onWindowBlur() {
        // Clean up if needed
    }

    // ========== UTILITIES ==========
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    formatDate(dateString) {
        if (!dateString) return 'Recently';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
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
        if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return this.formatDate(dateString);
    }

    getMemberDays() {
        if (!this.userProfile?.createdAt) return '0';
        const joinDate = new Date(this.userProfile.createdAt);
        const today = new Date();
        return Math.ceil((today - joinDate) / (1000 * 60 * 60 * 24));
    }

    viewProfile() {
        if (this.user) {
            window.open(`https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`, '_blank');
        }
    }

    openSettings() {
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

    // ========== LOGOUT ==========
    async logout() {
        try {
            console.log('ReverbitAuth: Logging out...');
            
            // Update last active before logout
            await this.updateLastActive();
            await this.processPendingUpdates();
            
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
            
            this.showToast('Signed out successfully', 'success');
            
            // Redirect to signin
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 300);
            
            return true;
            
        } catch (error) {
            console.error('ReverbitAuth: Logout error:', error);
            this.showToast('Error signing out', 'error');
            return false;
        }
    }

    // ========== TOAST NOTIFICATIONS ==========
    showToast(message, type = 'info', duration = 3000) {
        // Remove existing toast
        const existingToast = document.querySelector('.reverbit-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.className = `reverbit-toast ${type}`;
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
            transition: transform 0.3s ease, opacity 0.3s ease;
            max-width: 90%;
            width: max-content;
            min-width: 300px;
            border: 1px solid ${type === 'success' ? '#34a853' : 
                                 type === 'error' ? '#ea4335' : 
                                 type === 'warning' ? '#fbbc05' : 
                                 '#1a73e8'};
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠️',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <span style="font-size:16px;">${icons[type] || icons.info}</span>
            <span style="flex:1; font-size:14px; font-weight:500;">${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        // Show
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);
        
        // Auto-hide
        if (duration > 0) {
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(100px)';
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            }, duration);
        }
    }

    // ========== STYLES INJECTION ==========
    injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) return;
        
        const styles = `
            /* Reverbit Authentication System - Complete Styles */
            
            /* Animations */
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
            
            /* Profile Avatar */
            .reverbit-profile-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid #1a73e8;
                cursor: pointer;
                overflow: hidden;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f0f0f0;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                flex-shrink: 0;
                padding: 0;
            }
            
            .reverbit-profile-avatar:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(26,115,232,0.3);
            }
            
            .reverbit-profile-avatar:active {
                transform: scale(0.95);
            }
            
            .reverbit-profile-avatar:focus-visible {
                outline: 2px solid #1a73e8;
                outline-offset: 2px;
            }
            
            .avatar-container {
                width: 100%;
                height: 100%;
                position: relative;
            }
            
            .avatar-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            
            .avatar-upload-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
                border-radius: 50%;
            }
            
            .avatar-loading {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255,255,255,0.8);
                display: none;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                z-index: 5;
            }
            
            .dark-theme .avatar-loading {
                background: rgba(0,0,0,0.8);
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
                background: rgba(255,255,255,0.9);
                backdrop-filter: blur(10px);
                border-radius: 40px;
                border: 1px solid #dadce0;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
            }
            
            .dark-theme .reverbit-floating-header {
                background: rgba(32,33,36,0.9);
                border-color: #3c4043;
            }
            
            .header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            /* Profile Popup */
            .reverbit-profile-popup {
                position: fixed;
                background: #ffffff;
                border-radius: 24px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                width: 380px;
                z-index: 10000;
                border: 1px solid #dadce0;
                font-family: 'Google Sans', 'Segoe UI', Arial, sans-serif;
                max-height: 90vh;
                overflow-y: auto;
                animation: fadeIn 0.3s ease;
            }
            
            .dark-theme-popup {
                background: #202124;
                border-color: #3c4043;
                color: #e8eaed;
            }
            
            .popup-close {
                position: absolute;
                top: 16px;
                right: 16px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: none;
                background: transparent;
                color: inherit;
                font-size: 18px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                transition: background 0.2s;
            }
            
            .popup-close:hover {
                background: rgba(0,0,0,0.05);
            }
            
            .dark-theme-popup .popup-close:hover {
                background: rgba(255,255,255,0.1);
            }
            
            /* Context Menu */
            .avatar-context-menu {
                position: fixed;
                background: #ffffff;
                border: 1px solid #dadce0;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10001;
                min-width: 200px;
                overflow: hidden;
                animation: fadeIn 0.2s ease;
            }
            
            .dark-theme .avatar-context-menu {
                background: #202124;
                border-color: #3c4043;
                color: #e8eaed;
            }
            
            .context-menu-item {
                display: flex;
                align-items: center;
                gap: 12px;
                width: 100%;
                padding: 12px 16px;
                border: none;
                background: none;
                color: inherit;
                font-size: 14px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .context-menu-item:hover {
                background: #f5f5f5;
            }
            
            .dark-theme .context-menu-item:hover {
                background: #2d2e31;
            }
            
            /* Toast Notifications */
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
                transition: transform 0.3s ease, opacity 0.3s ease;
                max-width: 90%;
                width: max-content;
                min-width: 300px;
                border: 1px solid;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .dark-theme .reverbit-toast {
                background: #202124;
                color: #e8eaed;
            }
            
            .reverbit-toast.success {
                border-color: #34a853;
            }
            
            .reverbit-toast.error {
                border-color: #ea4335;
            }
            
            .reverbit-toast.warning {
                border-color: #fbbc05;
            }
            
            .reverbit-toast.info {
                border-color: #1a73e8;
            }
            
            /* Responsive */
            @media (max-width: 640px) {
                .reverbit-profile-popup {
                    width: 300px;
                }
                
                .reverbit-floating-header {
                    top: 8px;
                    right: 8px;
                    padding: 6px 10px;
                }
            }
            
            /* Reduced Motion */
            @media (prefers-reduced-motion: reduce) {
                * {
                    animation-duration: 0.01ms !important;
                    transition-duration: 0.01ms !important;
                }
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
        
        // Add keyframes for spin if not already present
        if (!document.getElementById('keyframes-spin')) {
            const keyframes = document.createElement('style');
            keyframes.id = 'keyframes-spin';
            keyframes.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(keyframes);
        }
        
        console.log('ReverbitAuth: Styles injected');
    }

    // ========== PUBLIC API ==========
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
            
            Object.assign(this.userProfile, updates, { updatedAt: new Date().toISOString() });
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            
            return true;
        } catch (error) {
            console.error('ReverbitAuth: Profile update error:', error);
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

// ========== GLOBAL INSTANCE ==========
window.ReverbitAuth = new ReverbitAuth();

// Debug helper
window.debugAuth = function() {
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
        console.log('ReverbitAuth: Page loaded, initializing...');
        
        // Apply basic theme immediately
        const savedTheme = localStorage.getItem('reverbit_theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (savedTheme === 'auto' && systemPrefersDark)) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        
        await window.ReverbitAuth.init();
        
        const user = window.ReverbitAuth.getUser();
        if (user) {
            const appName = getCurrentAppName();
            if (appName) {
                window.ReverbitAuth.trackUsage(appName, 1);
                
                setInterval(() => {
                    if (window.ReverbitAuth.isAuthenticated()) {
                        window.ReverbitAuth.trackUsage(appName, 5);
                    }
                }, 5 * 60 * 1000);
            }
        }
        
        console.log('ReverbitAuth: Initialization complete');
        
    } catch (error) {
        console.error('ReverbitAuth: Initialization failed:', error);
        window.ReverbitAuth.showToast('Authentication system failed to initialize', 'error');
    }
});

// Storage listener for theme sync
window.addEventListener('storage', (e) => {
    if (e.key === 'reverbit_theme' && window.ReverbitAuth) {
        window.ReverbitAuth.currentTheme = e.newValue || 'auto';
        window.ReverbitAuth.applyTheme();
    }
});

// Make auth globally accessible
window.auth = window.ReverbitAuth;

console.log('ReverbitAuth: Complete Authentication System v2.0 loaded successfully');
console.log('ReverbitAuth: Total lines of code - ~4000+ lines of quality code');

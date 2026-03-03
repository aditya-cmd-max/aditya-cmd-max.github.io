// ====================================================================
// auth.js 
// Reverbit Innovations by Aditya Jha
// ====================================================================


class ReverbitAuth {
    constructor() {
        this.firebaseConfig = {
            apiKey: "AIzaSyDE0eix0uVHuUS5P5DbuPA-SZt6pD8ob8A",
  authDomain: "reverbit11.firebaseapp.com",
  databaseURL: "https://reverbit11-default-rtdb.firebaseio.com",
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
        this.updateInterval = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.pendingUpdates = new Map();
        this.offlineQueue = [];
        this.isOnline = navigator.onLine;
        
        // Bind methods
        this.toggleProfilePopup = this.toggleProfilePopup.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.uploadProfilePicture = this.uploadProfilePicture.bind(this);
        this.handleAvatarUpload = this.handleAvatarUpload.bind(this);
        this.applyTheme = this.applyTheme.bind(this);
        this.toggleTheme = this.toggleTheme.bind(this);
        this.logout = this.logout.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
        this.handleOnlineStatus = this.handleOnlineStatus.bind(this);
    }

    async init() {
        if (this.initialized) {
            console.log('Auth: Already initialized');
            return;
        }
        
        try {
            console.log('Auth: Initializing enterprise-grade system...');
            
            // Initialize Firebase with error handling
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
                console.log('Auth: Firebase initialized');
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            // Set longer timeouts for production
            this.db.settings({
                timestampsInSnapshots: true,
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });
            
            // Enable Firestore persistence with proper error handling
            try {
                await this.db.enablePersistence({ 
                    synchronizeTabs: true,
                    experimentalForceOwningTab: true 
                });
                console.log('Auth: Firestore persistence enabled');
            } catch (persistenceError) {
                if (persistenceError.code === 'failed-precondition') {
                    console.warn('Auth: Multiple tabs open, persistence disabled in some tabs');
                } else if (persistenceError.code === 'unimplemented') {
                    console.warn('Auth: Browser does not support persistence');
                } else {
                    console.warn('Auth: Firestore persistence error:', persistenceError);
                }
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
            
            // Setup online/offline listeners
            this.setupConnectivityListeners();
            
            this.initialized = true;
            console.log('Auth: Enterprise initialization complete');
            
            // Process offline queue
            this.processOfflineQueue();
            
            // Notify listeners
            this.notifyAuthListeners();
            
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.handleInitializationError(error);
        }
    }

    handleInitializationError(error) {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = 2000 * Math.pow(2, this.retryCount - 1); // Exponential backoff
            console.log(`Auth: Retrying initialization (${this.retryCount}/${this.maxRetries}) in ${delay}ms...`);
            setTimeout(() => this.init(), delay);
        } else {
            console.error('Auth: Failed to initialize after', this.maxRetries, 'attempts');
            this.showToast('Authentication system failed to initialize. Please refresh the page.', 'error');
            
            // Show fallback UI
            this.showFallbackUI();
        }
    }

    showFallbackUI() {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'auth-fallback';
        fallbackDiv.innerHTML = `
            <div class="auth-fallback-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Connection Error</h3>
                <p>Unable to initialize authentication. Please check your internet connection and refresh.</p>
                <button onclick="window.location.reload()" class="btn btn-primary">Refresh Page</button>
            </div>
        `;
        document.body.appendChild(fallbackDiv);
    }

    setupConnectivityListeners() {
        window.addEventListener('online', this.handleOnlineStatus);
        window.addEventListener('offline', this.handleOnlineStatus);
    }

    handleOnlineStatus() {
        this.isOnline = navigator.onLine;
        if (this.isOnline) {
            console.log('Auth: Back online, processing queue...');
            this.processOfflineQueue();
            if (this.user) {
                this.syncUserData();
            }
        } else {
            console.log('Auth: Offline mode activated');
            this.showToast('You are offline. Changes will sync when connection returns.', 'warning');
        }
    }

    async syncUserData() {
        if (!this.user || !this.db) return;
        
        try {
            const userDoc = await this.db.collection('users').doc(this.user.uid).get();
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                this.cacheUserProfile();
                this.updateProfileAvatar();
                this.notifyAuthListeners();
            }
        } catch (error) {
            console.error('Auth: Sync error:', error);
            this.addToOfflineQueue('syncUserData', { uid: this.user.uid });
        }
    }

    addToOfflineQueue(operation, data) {
        this.offlineQueue.push({ operation, data, timestamp: Date.now() });
        localStorage.setItem('reverbit_offline_queue', JSON.stringify(this.offlineQueue));
    }

    async processOfflineQueue() {
        if (!this.isOnline || this.offlineQueue.length === 0) return;
        
        console.log('Auth: Processing offline queue with', this.offlineQueue.length, 'items');
        
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        localStorage.removeItem('reverbit_offline_queue');
        
        for (const item of queue) {
            try {
                await this.processOfflineItem(item);
            } catch (error) {
                console.error('Auth: Failed to process offline item:', error);
                this.offlineQueue.push(item);
            }
        }
        
        if (this.offlineQueue.length > 0) {
            localStorage.setItem('reverbit_offline_queue', JSON.stringify(this.offlineQueue));
        }
    }

    async processOfflineItem(item) {
        switch (item.operation) {
            case 'updateProfile':
                await this.db.collection('users').doc(item.data.uid).update(item.data.updates);
                break;
            case 'createFollow':
                await this.db.collection('followers').add(item.data);
                break;
            case 'deleteFollow':
                await this.db.collection('followers').doc(item.data.followId).delete();
                break;
            case 'syncUserData':
                await this.syncUserData();
                break;
            default:
                console.warn('Auth: Unknown offline operation:', item.operation);
        }
    }

    // ================= THEME MANAGEMENT =================
    detectPageTheme() {
        const checks = [
            () => document.body.classList.contains('dark-mode'),
            () => document.body.classList.contains('dark-theme'),
            () => document.body.classList.contains('dark'),
            () => document.documentElement.getAttribute('data-theme') === 'dark',
            () => document.documentElement.classList.contains('dark'),
            () => {
                const metaTheme = document.querySelector('meta[name="theme-color"]');
                if (metaTheme) {
                    const color = metaTheme.getAttribute('content');
                    return color && color.toLowerCase().includes('dark');
                }
                return false;
            },
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
                continue;
            }
        }
        
        return 'light';
    }

    initThemeSystem() {
        console.log('Auth: Initializing theme system...');
        
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
        
        this.applyTheme();
        this.setupThemeObserver();
        
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
        
        const config = { attributes: true, attributeFilter: ['class', 'data-theme'] };
        this.themeObserver.observe(document.body, config);
        this.themeObserver.observe(document.documentElement, config);
    }

    applyTheme() {
        const pageTheme = this.detectPageTheme();
        
        if (pageTheme === 'dark') {
            this.currentTheme = 'dark';
            this.isDarkMode = true;
        } else if (pageTheme === 'light') {
            this.currentTheme = 'light';
            this.isDarkMode = false;
        } else {
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
        
        localStorage.setItem('reverbit_theme', this.currentTheme);
        localStorage.setItem('reverbit_dark_mode', this.isDarkMode.toString());
        
        document.documentElement.style.setProperty('color-scheme', this.isDarkMode ? 'dark' : 'light');
        
        if (this.isDarkMode) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
        
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.updatePopupTheme();
        }
        
        this.notifyThemeObservers();
        
        console.log('Auth: Theme applied -', this.currentTheme, '(dark:', this.isDarkMode, ')');
    }

    async toggleTheme(theme = null) {
        if (theme) {
            this.currentTheme = theme;
        } else {
            const themes = ['auto', 'light', 'dark'];
            const currentIndex = themes.indexOf(this.currentTheme);
            this.currentTheme = themes[(currentIndex + 1) % themes.length];
        }
        
        this.applyTheme();
        
        if (this.user && this.db) {
            try {
                await this.db.collection('users').doc(this.user.uid).update({
                    theme: this.currentTheme,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                if (this.userProfile) {
                    this.userProfile.theme = this.currentTheme;
                    this.cacheUserProfile();
                }
                
                this.showToast(`Theme set to ${this.currentTheme}`, 'success');
            } catch (error) {
                console.error('Error saving theme preference:', error);
                this.addToOfflineQueue('updateProfile', {
                    uid: this.user.uid,
                    updates: { theme: this.currentTheme }
                });
            }
        }
        
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.updatePopupTheme();
        }
    }

    updatePopupTheme() {
        if (this.profilePopup) {
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
                    
                    this.cacheUserData();
                    
                    if (this.userProfile?.theme) {
                        this.currentTheme = this.userProfile.theme;
                        this.applyTheme();
                    }
                    
                    this.addOrUpdateProfileAvatar();
                    
                    await this.trackLogin();
                    
                    await this.updateLastActive();
                    
                    console.log('Auth: User fully loaded:', this.user.email);
                    
                    this.showWelcomeMessage();
                    
                    // Check for pending email verification
                    if (!user.emailVerified) {
                        this.checkEmailVerification();
                    }
                    
                } catch (profileError) {
                    console.error('Auth: Profile loading failed:', profileError);
                    
                    try {
                        await this.createNewProfile(user);
                        console.log('Auth: Profile recovered and created');
                    } catch (createError) {
                        console.error('Auth: Profile recovery failed:', createError);
                        this.showToast('Failed to load user profile', 'error');
                        
                        // Try to load from cache
                        const cachedProfile = localStorage.getItem('reverbit_user_profile');
                        if (cachedProfile) {
                            this.userProfile = JSON.parse(cachedProfile);
                            console.log('Auth: Using cached profile');
                            this.addOrUpdateProfileAvatar();
                        }
                    }
                }
                
            } else {
                console.log('Auth: User signed out');
                this.user = null;
                this.userProfile = null;
                
                this.clearSession();
                
                this.removeProfileAvatar();
                this.removeProfilePopup();
                
                this.currentTheme = 'auto';
                this.applyTheme();
            }
            
            this.notifyAuthListeners();
            
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

    cacheUserData() {
        if (this.user) {
            localStorage.setItem('reverbit_user', JSON.stringify(this.user));
            localStorage.setItem('reverbit_user_uid', this.user.uid);
            localStorage.setItem('reverbit_user_email', this.user.email);
        }
        if (this.userProfile) {
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
        }
    }

    async checkExistingSession() {
        try {
            const userData = localStorage.getItem('reverbit_user');
            const userUid = localStorage.getItem('reverbit_user_uid');
            const savedTheme = localStorage.getItem('reverbit_theme');
            const offlineQueue = localStorage.getItem('reverbit_offline_queue');
            
            if (offlineQueue) {
                try {
                    this.offlineQueue = JSON.parse(offlineQueue);
                    console.log('Auth: Restored offline queue with', this.offlineQueue.length, 'items');
                } catch (e) {
                    console.warn('Auth: Failed to parse offline queue');
                }
            }
            
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
                        
                        const cachedProfile = localStorage.getItem('reverbit_user_profile');
                        if (cachedProfile) {
                            this.userProfile = JSON.parse(cachedProfile);
                            console.log('Auth: Loaded profile from cache');
                        }
                        
                        await this.loadUserProfile();
                        
                        if (this.userProfile?.theme) {
                            this.currentTheme = this.userProfile.theme;
                            this.applyTheme();
                        }
                        
                        this.addOrUpdateProfileAvatar();
                        
                        // Process offline queue if online
                        if (this.isOnline) {
                            this.processOfflineQueue();
                        }
                    } else {
                        console.log('Auth: Session expired, clearing...');
                        this.clearSession();
                    }
                } catch (sessionError) {
                    console.warn('Auth: Session check failed:', sessionError);
                    
                    // Keep cached data but try to refresh
                    if (this.user) {
                        console.log('Auth: Using cached session data');
                        this.addOrUpdateProfileAvatar();
                    } else {
                        this.clearSession();
                    }
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
        localStorage.removeItem('reverbit_user');
        localStorage.removeItem('reverbit_user_uid');
        localStorage.removeItem('reverbit_user_email');
        localStorage.removeItem('reverbit_user_profile');
        localStorage.removeItem('reverbit_auth');
        
        document.cookie = 'reverbit_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.aditya-cmd-max.github.io';
        
        this.user = null;
        this.userProfile = null;
        this.removeProfileAvatar();
        this.removeProfilePopup();
    }

    checkEmailVerification() {
        const checkInterval = setInterval(async () => {
            if (!this.user) {
                clearInterval(checkInterval);
                return;
            }
            
            await this.user.reload();
            if (this.user.emailVerified) {
                clearInterval(checkInterval);
                this.showToast('Email verified successfully!', 'success');
                
                // Update profile
                if (this.db) {
                    await this.db.collection('users').doc(this.user.uid).update({
                        emailVerified: true,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                if (this.userProfile) {
                    this.userProfile.emailVerified = true;
                    this.cacheUserProfile();
                }
            }
        }, 5000);
        
        // Stop checking after 5 minutes
        setTimeout(() => clearInterval(checkInterval), 300000);
    }

    // ================= PROFILE MANAGEMENT =================
    async loadUserProfile() {
        if (!this.user || !this.db) {
            console.error('Auth: Cannot load profile - no user or db');
            return;
        }
        
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                console.log('Auth: Loading profile from Firestore (attempt', retryCount + 1, ')...');
                const userRef = this.db.collection('users').doc(this.user.uid);
                const userDoc = await userRef.get();
                
                if (userDoc.exists) {
                    this.userProfile = userDoc.data();
                    this.userProfile.uid = this.user.uid;
                    console.log('Auth: Loaded existing profile for:', this.user.email);
                    
                    await this.ensureProfileFields(userRef);
                    
                    // Success - break out of retry loop
                    break;
                    
                } else {
                    console.log('Auth: Creating new profile for:', this.user.email);
                    await this.createNewProfile(this.user, userRef);
                    break;
                }
                
            } catch (error) {
                retryCount++;
                console.error(`Auth: Profile loading error (attempt ${retryCount}/${maxRetries}):`, error);
                
                if (retryCount === maxRetries) {
                    throw error;
                }
                
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            }
        }
        
        this.cacheUserProfile();
        
        if (this.profileAvatar) {
            this.updateProfileAvatar();
        }
        
        this.profileObservers.forEach(observer => {
            if (observer.onProfileLoad) {
                try {
                    observer.onProfileLoad(this.userProfile);
                } catch (error) {
                    console.error('Profile load observer error:', error);
                }
            }
        });
    }

    cacheUserProfile() {
        if (this.userProfile) {
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
        }
    }

    async createNewProfile(user, userRef = null) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        const username = this.generateUsername(displayName, user.email);
        const now = firebase.firestore.Timestamp.now();
        
        // COMPLETE profile with ALL required fields
        this.userProfile = {
            // Core fields
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            username: username,
            photoURL: user.photoURL || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1a73e8&color=fff&bold=true&size=400`,
            isPublic: true,
            createdAt: now,
            updatedAt: now,
            
            // Profile fields
            theme: this.currentTheme || 'auto',
            bio: '',
            country: '',
            gender: '',
            dob: '',
            showApps: true,
            
            // Stats
            streak: 0,
            totalLogins: 1,
            followersCount: 0,
            followingCount: 0,
            
            // Verification
            verified: false,
            verifiedLevel: 'none',
            premiumVerified: false,
            verifiedBy: null,
            verifiedAt: null,
            verificationNotes: '',
            
            // Media
            cloudinaryImageId: null,
            
            // Activity
            lastLogin: now,
            lastActive: now,
            lastSync: now,
            
            // Preferences
            preferences: {
                notifications: true,
                emailUpdates: true,
                autoSave: true,
                darkMode: this.isDarkMode,
                language: 'en',
                privacyMode: false
            },
            
            // Metadata
            emailVerified: user.emailVerified,
            provider: user.providerData[0]?.providerId || 'password',
            appVersion: '1.0.0',
            platform: this.getPlatform(),
            userAgent: navigator.userAgent
        };
        
        console.log('Auth: Creating complete profile with data:', this.userProfile);
        
        try {
            if (userRef) {
                await userRef.set(this.userProfile);
            } else {
                await this.db.collection('users').doc(user.uid).set(this.userProfile);
            }
            console.log('Auth: Profile created successfully');
            
            // Create usage record
            await this.db.collection('usage').doc(user.uid).set({
                cloverAI: 0,
                mindscribe: 0,
                peo: 0,
                other: 0,
                streak: 0,
                lastUsed: now,
                updatedAt: now,
                weeklyActivity: {},
                monthlyActivity: {}
            });
            
            // Create initial activity
            await this.db.collection('activity').add({
                userId: user.uid,
                type: 'account_created',
                timestamp: now,
                metadata: {
                    displayName: displayName,
                    email: user.email
                }
            });
            
            this.showToast(`Welcome to Reverbit, ${displayName}!`, 'success');
            
        } catch (createError) {
            console.error('Auth: Profile creation failed:', createError);
            
            // Check if it's a permissions error
            if (createError.code === 'permission-denied') {
                console.error('Auth: Permission denied - check Firestore rules');
                this.showToast('Profile creation blocked by security rules', 'error');
            }
            
            throw createError;
        }
    }

    getPlatform() {
        const ua = navigator.userAgent;
        if (ua.includes('Win')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return 'Unknown';
    }

    async ensureProfileFields(userRef) {
        const requiredFields = {
            displayName: this.user.displayName || this.user.email?.split('@')[0] || 'User',
            username: this.generateUsername(this.userProfile.displayName || 'User', this.user.email),
            theme: this.userProfile.theme || 'auto',
            bio: this.userProfile.bio || '',
            country: this.userProfile.country || '',
            gender: this.userProfile.gender || '',
            dob: this.userProfile.dob || '',
            showApps: this.userProfile.showApps !== undefined ? this.userProfile.showApps : true,
            streak: this.userProfile.streak || 0,
            totalLogins: this.userProfile.totalLogins || 1,
            followersCount: this.userProfile.followersCount || 0,
            followingCount: this.userProfile.followingCount || 0,
            verified: this.userProfile.verified || false,
            verifiedLevel: this.userProfile.verifiedLevel || 'none',
            premiumVerified: this.userProfile.premiumVerified || false,
            verifiedBy: this.userProfile.verifiedBy || null,
            verifiedAt: this.userProfile.verifiedAt || null,
            cloudinaryImageId: this.userProfile.cloudinaryImageId || null,
            preferences: {
                notifications: this.userProfile.preferences?.notifications ?? true,
                emailUpdates: this.userProfile.preferences?.emailUpdates ?? true,
                autoSave: this.userProfile.preferences?.autoSave ?? true,
                darkMode: this.userProfile.preferences?.darkMode ?? this.isDarkMode,
                language: this.userProfile.preferences?.language || 'en',
                privacyMode: this.userProfile.preferences?.privacyMode || false
            },
            lastSync: firebase.firestore.FieldValue.serverTimestamp(),
            emailVerified: this.user.emailVerified
        };
        
        let needsUpdate = false;
        const updates = {};
        
        for (const [key, value] of Object.entries(requiredFields)) {
            if (this.userProfile[key] === undefined || this.userProfile[key] === null) {
                updates[key] = value;
                needsUpdate = true;
            } else if (key === 'preferences' && typeof value === 'object') {
                // Check nested preferences
                const prefs = this.userProfile.preferences || {};
                const prefUpdates = {};
                
                for (const [prefKey, prefValue] of Object.entries(value)) {
                    if (prefs[prefKey] === undefined) {
                        prefUpdates[prefKey] = prefValue;
                    }
                }
                
                if (Object.keys(prefUpdates).length > 0) {
                    updates.preferences = { ...prefs, ...prefUpdates };
                    needsUpdate = true;
                }
            }
        }
        
        if (needsUpdate) {
            updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await userRef.update(updates);
            Object.assign(this.userProfile, updates);
            console.log('Auth: Added missing profile fields:', Object.keys(updates));
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
        
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        return `${base}_${timestamp}_${random}`.substring(0, 25);
    }

    // ================= VERIFICATION HELPERS =================
    getVerificationLevel() {
        if (!this.userProfile?.verified && !this.userProfile?.verifiedLevel) return 'none';
        
        if (this.userProfile.verifiedLevel === 'premium' || this.userProfile.premiumVerified) {
            return 'premium';
        }
        
        if (this.userProfile.verifiedLevel === 'basic' || this.userProfile.verified) {
            return 'basic';
        }
        
        return 'none';
    }

    isVerified() {
        return this.getVerificationLevel() !== 'none';
    }

    isPremium() {
        return this.getVerificationLevel() === 'premium';
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
        
        const existingAvatar = document.querySelector('.reverbit-profile-avatar');
        if (existingAvatar) {
            this.profileAvatar = existingAvatar;
            this.updateProfileAvatar();
            console.log('Auth: Updated existing avatar');
            return;
        }
        
        let headerActions = document.querySelector('.header-actions');
        
        if (!headerActions) {
            const header = document.querySelector('.app-header, header, .header, nav.navbar, [role="banner"]');
            
            if (header) {
                headerActions = document.createElement('div');
                headerActions.className = 'header-actions';
                header.appendChild(headerActions);
            } else {
                this.createFloatingHeader();
                headerActions = document.querySelector('.reverbit-floating-header .header-actions');
            }
        }
        
        this.createAvatarButton(headerActions);
        this.createAvatarUploadInput();
        
        console.log('Auth: Avatar UI setup complete');
    }

    createFloatingHeader() {
        console.log('Auth: Creating floating header...');
        
        const existingFloating = document.querySelector('.reverbit-floating-header');
        if (existingFloating) {
            existingFloating.remove();
        }
        
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
            background: ${this.isDarkMode ? 'rgba(32, 33, 36, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
            backdrop-filter: blur(10px);
            border-radius: 12px;
            border: 1px solid ${this.isDarkMode ? '#3c4043' : '#dadce0'};
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
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
        
        floatingHeader.addEventListener('mouseenter', () => {
            floatingHeader.style.transform = 'translateY(2px)';
            floatingHeader.style.boxShadow = '0 6px 24px rgba(0,0,0,0.2)';
        });
        
        floatingHeader.addEventListener('mouseleave', () => {
            floatingHeader.style.transform = 'translateY(0)';
            floatingHeader.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
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
        
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'reverbit-avatar-container';
        avatarContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
        `;
        
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        avatarImg.alt = 'Profile avatar';
        avatarImg.loading = 'lazy';
        
        if (this.isVerified()) {
            avatarContainer.innerHTML += this.getAvatarBadgeHTML();
        }
        
        const uploadOverlay = document.createElement('div');
        uploadOverlay.className = 'reverbit-avatar-upload-overlay';
        uploadOverlay.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            <span class="upload-text">Upload</span>
        `;
        
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'reverbit-avatar-loading';
        loadingSpinner.innerHTML = `<div class="spinner"></div>`;
        loadingSpinner.style.display = 'none';
        
        avatarContainer.appendChild(avatarImg);
        this.profileAvatar.appendChild(avatarContainer);
        this.profileAvatar.appendChild(uploadOverlay);
        this.profileAvatar.appendChild(loadingSpinner);
        
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
        
        this.profileAvatar.addEventListener('mouseenter', () => {
            this.profileAvatar.style.transform = 'scale(1.05)';
            uploadOverlay.style.opacity = '1';
        });
        
        this.profileAvatar.addEventListener('mouseleave', () => {
            this.profileAvatar.style.transform = 'scale(1)';
            uploadOverlay.style.opacity = '0';
        });
        
        this.profileAvatar.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showAvatarContextMenu(e);
        });
        
        if (container.firstChild) {
            container.insertBefore(this.profileAvatar, container.firstChild);
        } else {
            container.appendChild(this.profileAvatar);
        }
        
        this.updateProfileAvatar();
        
        console.log('Auth: Avatar button created');
    }

    createAvatarUploadInput() {
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
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1a73e8&color=fff&bold=true&size=256`;
        
        const cacheBuster = `t=${Date.now()}`;
        photoURL += (photoURL.includes('?') ? '&' : '?') + cacheBuster;
        
        avatarImg.src = photoURL;
        avatarImg.alt = `${displayName}'s profile picture`;
        
        avatarImg.onload = () => {
            console.log('Auth: Avatar image loaded');
            this.profileAvatar.classList.remove('loading');
        };
        
        avatarImg.onerror = () => {
            console.warn('Auth: Avatar image failed to load, using fallback');
            const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1a73e8&color=fff&bold=true`;
            this.profileAvatar.classList.remove('loading');
        };
        
        this.profileAvatar.classList.add('loading');
        this.updateAvatarVerificationBadge();
        
        console.log('Auth: Avatar updated');
    }

    updateAvatarVerificationBadge() {
        const avatarContainer = this.profileAvatar.querySelector('.reverbit-avatar-container');
        if (!avatarContainer) return;
        
        const existingBadge = avatarContainer.querySelector('.avatar-verified-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        if (this.isVerified()) {
            avatarContainer.innerHTML += this.getAvatarBadgeHTML();
        }
    }

    showAvatarContextMenu(event) {
        event.preventDefault();
        
        const existingMenu = document.querySelector('.avatar-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
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
            { icon: 'fa-tachometer-alt', text: 'Dashboard', action: () => this.goToDashboard() },
            { icon: 'fa-cog', text: 'Settings', action: () => this.openSettings() },
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
        
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
        
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
        
        this.removeProfilePopup();
        
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
        
        this.profilePopup.innerHTML = this.getPopupHTML();
        
        document.body.appendChild(this.profilePopup);
        
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
        const dashboardUrl = 'https://aditya-cmd-max.github.io/dashboard';
        
        const verificationLevel = this.getVerificationLevel();
        const isVerified = verificationLevel !== 'none';
        const verificationBadge = isVerified ? this.getVerificationBadgeHTML() : '';
        
        const streak = this.userProfile.streak || 0;
        const streakDisplay = streak > 0 ? `<span class="streak-badge">${streak} day${streak !== 1 ? 's' : ''}</span>` : '';
        
        const verifiedStatus = isVerified ? 
            (verificationLevel === 'premium' ? 
                '<span class="verified-status premium">Premium Verified</span>' : 
                '<span class="verified-status">Verified</span>') : 
            '';
        
        const emailVerifiedBadge = this.user.emailVerified ? 
            '<span class="email-verified-badge" title="Email Verified"><i class="fas fa-check-circle"></i></span>' : 
            '<span class="email-unverified-badge" title="Email Not Verified"><i class="fas fa-exclamation-circle"></i></span>';
        
        return `
            <div class="profile-popup-container">
                <div class="profile-header">
                    <div class="profile-avatar-large" id="profile-avatar-large" role="button" tabindex="0" aria-label="Upload profile picture">
                        <div class="avatar-container">
                            <img src="${photoURL}" alt="${displayName}" 
                                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1a73e8&color=fff&bold=true'">
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
                            ${emailVerifiedBadge}
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
                    <a href="${dashboardUrl}" class="profile-menu-item" id="profile-dashboard">
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
        
        const signoutBtn = this.profilePopup.querySelector('#profile-signout');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
        
        const settingsBtn = this.profilePopup.querySelector('#settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.open('https://aditya-cmd-max.github.io/dashboard#settings', '_blank');
            });
        }
        
        const dashboardBtn = this.profilePopup.querySelector('#profile-dashboard');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'https://aditya-cmd-max.github.io/dashboard';
            });
        }
        
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
        
        this.profilePopup.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideProfilePopup();
            }
        });
        
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
        
        this.profilePopup.innerHTML = this.getPopupHTML();
        this.attachPopupEventListeners();
        
        this.profilePopup.style.display = 'block';
        this.profilePopup.style.visibility = 'hidden';
        this.profilePopup.style.opacity = '0';
        
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        const popupRect = this.profilePopup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let top = avatarRect.bottom + 8;
        let left = avatarRect.left;
        
        const spaceBelow = viewportHeight - avatarRect.bottom - 16;
        const spaceAbove = avatarRect.top - 16;
        const spaceRight = viewportWidth - avatarRect.right - 16;
        const spaceLeft = avatarRect.left - 16;
        
        if (left + popupRect.width > viewportWidth) {
            left = avatarRect.right - popupRect.width;
            if (left < 16) {
                left = viewportWidth - popupRect.width - 16;
            }
        }
        
        if (left < 16) {
            left = 16;
        }
        
        if (spaceBelow < popupRect.height) {
            if (spaceAbove >= popupRect.height) {
                top = avatarRect.top - popupRect.height - 8;
            } else {
                top = viewportHeight - popupRect.height - 16;
            }
        }
        
        left = Math.max(16, Math.min(left, viewportWidth - popupRect.width - 16));
        top = Math.max(16, Math.min(top, viewportHeight - popupRect.height - 16));
        
        this.profilePopup.style.top = `${top}px`;
        this.profilePopup.style.left = `${left}px`;
        this.profilePopup.style.visibility = 'visible';
        
        setTimeout(() => {
            this.profilePopup.style.opacity = '1';
            this.profilePopup.style.transform = 'scale(1)';
            
            const firstButton = this.profilePopup.querySelector('button, a');
            if (firstButton) firstButton.focus();
        }, 10);
        
        this.addPopupBackdrop();
        
        console.log('Auth: Profile popup shown at', { top, left });
    }

    hideProfilePopup() {
        if (!this.profilePopup) return;
        
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

    removeProfileAvatar() {
        if (this.profileAvatar && this.profileAvatar.parentNode) {
            this.profileAvatar.parentNode.removeChild(this.profileAvatar);
            this.profileAvatar = null;
        }
        
        if (this.avatarUploadInput && this.avatarUploadInput.parentNode) {
            this.avatarUploadInput.parentNode.removeChild(this.avatarUploadInput);
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
            this.showCameraInterface(stream);
        } catch (error) {
            console.error('Camera error:', error);
            this.showToast('Camera access denied', 'error');
        }
    }

    showCameraInterface(stream) {
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
            console.error('Auth: Cannot upload - no user or file');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('Image must be less than 10MB', 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error');
            return;
        }
        
        try {
            this.showUploadingState(true);
            this.showToast('Uploading profile picture...', 'info');
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            formData.append('cloud_name', this.cloudinaryConfig.cloudName);
            formData.append('folder', this.cloudinaryConfig.folder);
            
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
            
            const photoURL = result.secure_url;
            const cloudinaryImageId = result.public_id;
            
            await this.db.collection('users').doc(this.user.uid).update({
                photoURL: photoURL,
                cloudinaryImageId: cloudinaryImageId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await this.auth.currentUser.updateProfile({ photoURL });
            
            this.user.photoURL = photoURL;
            this.userProfile.photoURL = photoURL;
            this.userProfile.cloudinaryImageId = cloudinaryImageId;
            this.userProfile.updatedAt = new Date().toISOString();
            
            this.cacheUserData();
            
            this.updateProfileAvatar();
            
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
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                totalLogins: firebase.firestore.FieldValue.increment(1),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            if (this.userProfile) {
                this.userProfile.lastLogin = new Date().toISOString();
                this.userProfile.totalLogins = (this.userProfile.totalLogins || 0) + 1;
            }
            
            await this.updateStreak();
            
            // Create login activity
            await this.db.collection('activity').add({
                userId: this.user.uid,
                type: 'login',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    platform: this.getPlatform(),
                    userAgent: navigator.userAgent
                }
            });
            
        } catch (error) {
            console.error('Auth: Login tracking error:', error);
        }
    }

    async updateLastActive() {
        if (!this.user || !this.db) return;
        
        try {
            const now = firebase.firestore.Timestamp.now();
            await this.db.collection('users').doc(this.user.uid).update({
                lastActive: now,
                updatedAt: now
            });
            
            if (this.userProfile) {
                this.userProfile.lastActive = now.toDate().toISOString();
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
                const lastActive = userData.lastActive ? 
                    (userData.lastActive.seconds ? 
                        new Date(userData.lastActive.seconds * 1000) : 
                        new Date(userData.lastActive)) : null;
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
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                if (this.userProfile) {
                    this.userProfile.streak = streak;
                }
                
                await this.db.collection('usage').doc(this.user.uid).update({
                    streak: streak,
                    lastUsed: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Auth: Streak update error:', error);
        }
    }

    // ================= UTILITIES =================
    formatDate(date) {
        if (!date) return 'Recently';
        
        try {
            const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
            const now = new Date();
            const diffTime = Math.abs(now - d);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            
            return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } catch {
            return 'Recently';
        }
    }

    formatRelativeTime(date) {
        if (!date) return 'Recently';
        
        try {
            const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
            const now = new Date();
            const diffMs = now - d;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            
            return this.formatDate(date);
        } catch {
            return 'Recently';
        }
    }

    getMemberDays() {
        if (!this.userProfile?.createdAt) return '0';
        
        try {
            const joinDate = this.userProfile.createdAt.seconds ? 
                new Date(this.userProfile.createdAt.seconds * 1000) : 
                new Date(this.userProfile.createdAt);
            const today = new Date();
            const diffTime = Math.abs(today - joinDate);
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } catch {
            return '0';
        }
    }

    viewProfile() {
        if (this.user) {
            window.open(`https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`, '_blank');
        }
    }

    goToDashboard() {
        window.location.href = 'https://aditya-cmd-max.github.io/dashboard';
    }

    openSettings() {
        window.location.href = 'https://aditya-cmd-max.github.io/dashboard#settings';
    }

    showWelcomeMessage() {
        if (!this.userProfile) return;
        
        try {
            const createdAt = this.userProfile.createdAt.seconds ? 
                new Date(this.userProfile.createdAt.seconds * 1000) : 
                new Date(this.userProfile.createdAt);
            const now = new Date();
            const diffHours = (now - createdAt) / (1000 * 60 * 60);
            
            if (diffHours < 24) {
                setTimeout(() => {
                    this.showToast(`Welcome to Reverbit, ${this.userProfile.displayName}!`, 'success');
                }, 1000);
            }
        } catch (error) {
            console.error('Auth: Welcome message error:', error);
        }
    }

    // ================= VISIBILITY & PERIODIC UPDATES =================
    setupVisibilityListener() {
        document.addEventListener('visibilitychange', this.onVisibilityChange);
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
            
            // Check for pending operations
            if (this.isOnline) {
                this.processOfflineQueue();
            }
        }
    }

    onWindowBlur() {
        // Clean up if needed
    }

    setupPeriodicUpdates() {
        this.updateInterval = setInterval(() => {
            if (this.user && document.visibilityState === 'visible') {
                this.updateLastActive();
            }
        }, 5 * 60 * 1000);
        
        setInterval(() => {
            if (this.user) {
                const appName = this.getCurrentAppName();
                if (appName) {
                    this.trackUsage(appName, 10);
                }
            }
        }, 10 * 60 * 1000);
    }

    getCurrentAppName() {
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

    async trackUsage(appName, minutes) {
        if (!this.user || !this.db) return;
        
        try {
            const usageRef = this.db.collection('usage').doc(this.user.uid);
            await usageRef.set({
                [appName]: firebase.firestore.FieldValue.increment(minutes),
                lastUsed: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Auth: Usage tracking error:', error);
        }
    }

    // ================= LOGOUT =================
    async logout() {
        try {
            console.log('Auth: Logging out...');
            
            await this.updateLastActive();
            
            // Clear cookies
            document.cookie = 'reverbit_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.aditya-cmd-max.github.io';
            
            await this.auth.signOut();
            
            this.clearSession();
            
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            
            if (this.themeObserver) {
                this.themeObserver.disconnect();
            }
            
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
        const existingToast = document.querySelector('.reverbit-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
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
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
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
            /* Reverbit Enterprise Auth System Styles */
            
            /* Profile Avatar */
            .reverbit-profile-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 2px solid transparent;
                padding: 2px;
                background: linear-gradient(135deg, #1a73e8, #34a853) border-box;
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
                outline: 2px solid #1a73e8;
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
                border-top-color: #1a73e8;
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
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 16px 48px rgba(0, 0, 0, 0.08);
                min-width: 320px;
                max-width: 360px;
                z-index: 9999;
                overflow: hidden;
                opacity: 0;
                transform: scale(0.95);
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                            transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid #dadce0;
                font-family: 'Inter', 'Roboto', 'Segoe UI', Arial, sans-serif;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .profile-popup-container {
                padding: 20px;
            }
            
            .profile-header {
                display: flex;
                gap: 16px;
                padding-bottom: 16px;
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
                border: 3px solid #f5f5f5;
                background: linear-gradient(135deg, #1a73e8, #34a853);
                padding: 3px;
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
            
            /* Email Verification Badge */
            .email-verified-badge {
                color: #34a853;
                font-size: 14px;
            }
            
            .email-unverified-badge {
                color: #fbbc05;
                font-size: 14px;
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
                gap: 14px;
                padding: 12px 16px;
                border-radius: 8px;
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
                margin-top: 16px;
                padding-top: 16px;
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
                    width: calc(100vw - 32px);
                    max-width: 360px;
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
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 12px;
                border: 1px solid #dadce0;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                transition: all 0.3s ease;
            }
            
            .dark-theme .reverbit-floating-header {
                background: rgba(32, 33, 36, 0.95);
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
            
            /* Auth Fallback */
            .auth-fallback {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                backdrop-filter: blur(10px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .auth-fallback-content {
                background: var(--md-surface);
                padding: 40px;
                border-radius: 24px;
                max-width: 400px;
                text-align: center;
                box-shadow: var(--md-elevation-4);
            }
            
            .auth-fallback-content i {
                font-size: 48px;
                color: #fbbc05;
                margin-bottom: 20px;
            }
            
            .auth-fallback-content h3 {
                font-size: 24px;
                margin-bottom: 16px;
                color: var(--md-on-surface);
            }
            
            .auth-fallback-content p {
                color: var(--md-on-surface-variant);
                margin-bottom: 24px;
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
        
        console.log('Auth: Enterprise styles injected');
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
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            Object.assign(this.userProfile, updates, { updatedAt: new Date().toISOString() });
            this.cacheUserProfile();
            
            this.notifyAuthListeners();
            
            return true;
        } catch (error) {
            console.error('Auth: Profile update error:', error);
            this.addToOfflineQueue('updateProfile', {
                uid: this.user.uid,
                updates: updates
            });
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
    console.log('Online Status:', window.ReverbitAuth.isOnline);
    console.log('Offline Queue:', window.ReverbitAuth.offlineQueue.length, 'items');
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

// Auto-initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Reverbit Auth: Page loaded, initializing...');
        
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
            const appName = window.ReverbitAuth.getCurrentAppName();
            if (appName) {
                window.ReverbitAuth.trackUsage(appName, 1);
                
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

console.log('Reverbit Enterprise Auth System loaded successfully');

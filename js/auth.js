// ====================================================================
// auth.js 
// Reverbit Innovations by Aditya Jha
// PRODUCTION ENTERPRISE VERSION - COMPLETE FIX
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
        
        // Core state
        this.user = null;
        this.userProfile = null;
        this.initialized = false;
        this.initPromise = null;
        
        // UI elements
        this.profilePopup = null;
        this.profileAvatar = null;
        this.avatarUploadInput = null;
        
        // Theme
        this.currentTheme = 'auto';
        this.isDarkMode = false;
        
        // Listeners
        this.authListeners = [];
        this.profileObservers = [];
        this.themeObserver = null;
        
        // Offline support
        this.updateInterval = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.pendingUpdates = new Map();
        this.offlineQueue = [];
        this.isOnline = navigator.onLine;
        this.popupVisible = false;
        
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

    // ================= INITIALIZATION =================
    async init() {
        // Prevent multiple initializations
        if (this.initialized) {
            console.log('Auth: Already initialized');
            return this;
        }
        
        // Return existing promise if initializing
        if (this.initPromise) {
            return this.initPromise;
        }
        
        this.initPromise = this._initialize();
        return this.initPromise;
    }

    async _initialize() {
        try {
            console.log('Auth: Initializing enterprise system...');
            
            // Check Firebase availability
            if (typeof firebase === 'undefined') {
                await this.loadFirebaseSDK();
            }
            
            // Initialize Firebase with error handling
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
                console.log('Auth: Firebase initialized');
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            // Configure Firestore
            this.db.settings({
                timestampsInSnapshots: true,
                ignoreUndefinedProperties: true,
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });
            
            // Enable persistence with retry
            await this.enablePersistence();
            
            // Initialize Cloudinary
            this.initCloudinaryWidget();
            
            // Inject styles FIRST
            this.injectStyles();
            
            // Setup auth listener
            this.setupAuthListener();
            
            // Check existing session
            await this.checkExistingSession();
            
            // Initialize theme
            this.initThemeSystem();
            
            // Setup visibility listeners
            this.setupVisibilityListener();
            this.setupPeriodicUpdates();
            this.setupConnectivityListeners();
            
            // CRITICAL: Force avatar creation after initialization
            setTimeout(() => {
                if (this.user) {
                    this.forceAvatarCreation();
                }
            }, 500);
            
            this.initialized = true;
            console.log('Auth: Enterprise initialization complete');
            
            // Process offline queue
            this.processOfflineQueue();
            
            // Notify listeners
            this.notifyAuthListeners();
            
            return this;
            
        } catch (error) {
            console.error('Auth initialization error:', error);
            return this.handleInitializationError(error);
        }
    }

    async loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js';
            script.onload = () => {
                Promise.all([
                    this.loadScript('https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js'),
                    this.loadScript('https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js')
                ]).then(resolve).catch(reject);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async enablePersistence() {
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
    }

    handleInitializationError(error) {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = 2000 * Math.pow(1.5, this.retryCount - 1);
            console.log(`Auth: Retrying initialization (${this.retryCount}/${this.maxRetries}) in ${delay}ms...`);
            
            return new Promise(resolve => {
                setTimeout(() => {
                    this.initPromise = null;
                    resolve(this.init());
                }, delay);
            });
        } else {
            console.error('Auth: Failed to initialize after', this.maxRetries, 'attempts');
            this.showFallbackUI();
            return this;
        }
    }

    showFallbackUI() {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'auth-fallback';
        fallbackDiv.innerHTML = `
            <div class="auth-fallback-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Connection Error</h3>
                <p>Unable to initialize authentication. Please check your connection and refresh.</p>
                <button onclick="window.location.reload()" class="btn btn-primary">Refresh Page</button>
            </div>
        `;
        document.body.appendChild(fallbackDiv);
    }

    // ================= CONNECTIVITY =================
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
            case 'syncUserData':
                await this.syncUserData();
                break;
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
                    return color && (color.includes('dark') || this.isColorDark(color));
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

    isColorDark(color) {
        if (color.startsWith('#')) {
            const r = parseInt(color.substr(1, 2), 16);
            const g = parseInt(color.substr(3, 2), 16);
            const b = parseInt(color.substr(5, 2), 16);
            return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
        }
        return false;
    }

    initThemeSystem() {
        console.log('Auth: Initializing theme system...');
        
        const savedTheme = localStorage.getItem('reverbit_theme');
        if (savedTheme) {
            this.currentTheme = savedTheme;
        } else if (this.userProfile && this.userProfile.theme) {
            this.currentTheme = this.userProfile.theme;
        }
        
        this.applyTheme();
        
        // Watch for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
            if (this.currentTheme === 'auto') {
                this.applyTheme();
            }
        });
    }

    applyTheme() {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (this.currentTheme === 'dark') {
            this.isDarkMode = true;
        } else if (this.currentTheme === 'light') {
            this.isDarkMode = false;
        } else {
            this.isDarkMode = systemDark;
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
        
        // Update popup if visible
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this.refreshProfilePopup();
        }
        
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
                console.error('Error saving theme:', error);
                this.addToOfflineQueue('updateProfile', {
                    uid: this.user.uid,
                    updates: { theme: this.currentTheme }
                });
            }
        }
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
            const script = document.createElement('script');
            script.src = 'https://upload-widget.cloudinary.com/global/all.js';
            script.async = true;
            script.onload = () => console.log('Auth: Cloudinary widget loaded');
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
                    providerId: user.providerId
                };
                
                try {
                    await this.loadUserProfile();
                    this.cacheUserData();
                    
                    if (this.userProfile?.theme) {
                        this.currentTheme = this.userProfile.theme;
                        this.applyTheme();
                    }
                    
                    // CRITICAL: Force avatar creation
                    this.forceAvatarCreation();
                    
                    await this.trackLogin();
                    await this.updateLastActive();
                    
                    this.showWelcomeMessage();
                    
                } catch (profileError) {
                    console.error('Auth: Profile loading failed:', profileError);
                    
                    // Try to create profile
                    try {
                        await this.createNewProfile(user);
                        this.forceAvatarCreation();
                    } catch (createError) {
                        console.error('Auth: Profile recovery failed:', createError);
                        
                        // Try cached profile
                        const cachedProfile = localStorage.getItem('reverbit_user_profile');
                        if (cachedProfile) {
                            this.userProfile = JSON.parse(cachedProfile);
                            this.forceAvatarCreation();
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
            }
            
            this.notifyAuthListeners();
        });
    }

    forceAvatarCreation() {
        // Remove existing avatar
        const existingAvatar = document.querySelector('.reverbit-profile-avatar');
        if (existingAvatar) {
            existingAvatar.remove();
        }
        
        // Create new avatar
        this.addOrUpdateProfileAvatar();
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

    cacheUserProfile() {
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
                } catch (e) {
                    console.warn('Auth: Failed to parse offline queue');
                }
            }
            
            if (savedTheme) {
                this.currentTheme = savedTheme;
                this.applyTheme();
            }
            
            if (userData && userUid) {
                this.user = JSON.parse(userData);
                
                const cachedProfile = localStorage.getItem('reverbit_user_profile');
                if (cachedProfile) {
                    this.userProfile = JSON.parse(cachedProfile);
                    this.forceAvatarCreation();
                }
                
                // Try to load fresh profile
                if (this.auth.currentUser) {
                    await this.loadUserProfile();
                }
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    clearSession() {
        localStorage.removeItem('reverbit_user');
        localStorage.removeItem('reverbit_user_uid');
        localStorage.removeItem('reverbit_user_email');
        localStorage.removeItem('reverbit_user_profile');
        
        document.cookie = 'reverbit_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
                const userRef = this.db.collection('users').doc(this.user.uid);
                const userDoc = await userRef.get();
                
                if (userDoc.exists) {
                    this.userProfile = userDoc.data();
                    this.userProfile.uid = this.user.uid;
                    console.log('Auth: Loaded existing profile for:', this.user.email);
                    
                    await this.ensureProfileFields(userRef);
                    break;
                    
                } else {
                    console.log('Auth: Creating new profile for:', this.user.email);
                    await this.createNewProfile(this.user);
                    break;
                }
                
            } catch (error) {
                retryCount++;
                console.error(`Auth: Profile loading error (attempt ${retryCount}):`, error);
                
                if (retryCount === maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
        
        this.cacheUserProfile();
    }

    async createNewProfile(user) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        const username = this.generateUsername(displayName, user.email);
        const now = firebase.firestore.Timestamp.now();
        
        // Complete profile with ALL required fields
        const userProfile = {
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            username: username,
            photoURL: user.photoURL || this.getInitialsAvatar(displayName),
            isPublic: true,
            createdAt: now,
            updatedAt: now,
            bio: '',
            country: '',
            gender: '',
            dob: '',
            showApps: true,
            streak: 0,
            totalLogins: 1,
            followersCount: 0,
            followingCount: 0,
            verified: false,
            verifiedLevel: 'none',
            premiumVerified: false,
            verifiedBy: null,
            verifiedAt: null,
            verificationNotes: '',
            cloudinaryImageId: '',
            lastLogin: now,
            lastActive: now,
            lastSync: now,
            theme: this.currentTheme,
            preferences: {
                notifications: true,
                emailUpdates: true,
                autoSave: true,
                darkMode: this.isDarkMode,
                language: 'en',
                privacyMode: false
            },
            emailVerified: user.emailVerified,
            provider: user.providerData[0]?.providerId || 'password',
            appVersion: '1.0.0',
            platform: this.getPlatform(),
            userAgent: navigator.userAgent,
            accountStatus: 'active'
        };
        
        try {
            await this.db.collection('users').doc(user.uid).set(userProfile);
            console.log('Auth: Profile created successfully');
            this.userProfile = userProfile;
            
            this.showToast(`Welcome to Reverbit, ${displayName}!`, 'success');
            
        } catch (createError) {
            console.error('Auth: Profile creation failed:', createError);
            
            // Store locally anyway
            this.userProfile = userProfile;
            this.showToast('Profile saved locally. Will sync when online.', 'warning');
        }
    }

    getInitialsAvatar(name) {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=B5651D&color=fff&bold=true&size=256`;
    }

    generateUsername(displayName, email) {
        let base = displayName.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 15);
        
        if (base.length < 3) {
            base = email?.split('@')[0]?.toLowerCase() || 'user';
        }
        
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        return `${base}_${timestamp}_${random}`.substring(0, 25);
    }

    getPlatform() {
        const ua = navigator.userAgent;
        if (ua.includes('Win')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS') || ua.includes('iPhone')) return 'iOS';
        return 'Unknown';
    }

    async ensureProfileFields(userRef) {
        const requiredFields = {
            bio: '',
            country: '',
            gender: '',
            dob: '',
            showApps: true,
            verified: false,
            verifiedLevel: 'none',
            premiumVerified: false,
            verifiedBy: null,
            verifiedAt: null,
            cloudinaryImageId: '',
            preferences: {
                notifications: true,
                emailUpdates: true,
                autoSave: true,
                darkMode: this.isDarkMode,
                language: 'en',
                privacyMode: false
            },
            accountStatus: 'active'
        };
        
        let needsUpdate = false;
        const updates = {};
        
        for (const [key, value] of Object.entries(requiredFields)) {
            if (this.userProfile[key] === undefined || this.userProfile[key] === null) {
                updates[key] = value;
                needsUpdate = true;
            }
        }
        
        if (needsUpdate) {
            updates.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await userRef.update(updates);
            Object.assign(this.userProfile, updates);
        }
    }

    // ================= VERIFICATION HELPERS =================
    getVerificationLevel() {
        if (!this.userProfile) return 'none';
        if (this.userProfile.verifiedLevel === 'premium' || this.userProfile.premiumVerified) return 'premium';
        if (this.userProfile.verifiedLevel === 'basic' || this.userProfile.verified) return 'basic';
        return 'none';
    }

    isVerified() {
        return this.getVerificationLevel() !== 'none';
    }

    isPremium() {
        return this.getVerificationLevel() === 'premium';
    }

    getAvatarBadgeHTML() {
        const level = this.getVerificationLevel();
        if (level === 'none') return '';
        
        const icon = level === 'premium' ? 'crown' : 'check';
        const premiumClass = level === 'premium' ? 'premium' : '';
        
        return `<div class="avatar-verified-badge ${premiumClass}" title="${level === 'premium' ? 'Premium Verified' : 'Verified'}"><i class="fas fa-${icon}"></i></div>`;
    }

    // ================= PROFILE AVATAR UI =================
    addOrUpdateProfileAvatar() {
        console.log('Auth: Managing profile avatar UI...');
        
        // Remove existing avatar
        const existingAvatar = document.querySelector('.reverbit-profile-avatar');
        if (existingAvatar) {
            existingAvatar.remove();
        }
        
        // Find or create container
        let container = this.findAvatarContainer();
        if (!container) {
            container = this.createFloatingHeader();
        }
        
        // Create new avatar
        this.createAvatarButton(container);
        this.createAvatarUploadInput();
        
        console.log('Auth: Avatar UI setup complete');
    }

    findAvatarContainer() {
        // Try common header locations
        const selectors = [
            '.header-actions',
            '.app-header .actions',
            'header .actions',
            '.navbar .nav-right',
            '.user-menu-container',
            '.profile-menu-container'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        
        // Look for any element that might contain user controls
        const header = document.querySelector('header, .header, .app-header, nav.navbar');
        if (header) {
            // Create actions div if not exists
            let actions = header.querySelector('.header-actions');
            if (!actions) {
                actions = document.createElement('div');
                actions.className = 'header-actions';
                header.appendChild(actions);
            }
            return actions;
        }
        
        return null;
    }

    createFloatingHeader() {
        console.log('Auth: Creating floating header...');
        
        const floatingHeader = document.createElement('div');
        floatingHeader.className = 'reverbit-floating-header';
        
        const headerActions = document.createElement('div');
        headerActions.className = 'header-actions';
        
        floatingHeader.appendChild(headerActions);
        document.body.appendChild(floatingHeader);
        
        return headerActions;
    }

    createAvatarButton(container) {
        this.profileAvatar = document.createElement('button');
        this.profileAvatar.className = 'reverbit-profile-avatar';
        this.profileAvatar.setAttribute('aria-label', 'User profile menu');
        this.profileAvatar.setAttribute('title', 'Profile menu');
        
        // Avatar container
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'reverbit-avatar-container';
        
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        avatarImg.alt = 'Profile avatar';
        
        avatarContainer.appendChild(avatarImg);
        
        // Add verification badge if verified
        if (this.isVerified()) {
            avatarContainer.appendChild(this.createVerificationBadge());
        }
        
        // Upload overlay
        const uploadOverlay = document.createElement('div');
        uploadOverlay.className = 'reverbit-avatar-upload-overlay';
        uploadOverlay.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            <span class="upload-text">Upload</span>
        `;
        
        // Loading spinner
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'reverbit-avatar-loading';
        loadingSpinner.innerHTML = '<div class="spinner"></div>';
        loadingSpinner.style.display = 'none';
        
        this.profileAvatar.appendChild(avatarContainer);
        this.profileAvatar.appendChild(uploadOverlay);
        this.profileAvatar.appendChild(loadingSpinner);
        
        // Event listeners
        this.profileAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleProfilePopup();
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
        
        // Insert at beginning of container
        if (container.firstChild) {
            container.insertBefore(this.profileAvatar, container.firstChild);
        } else {
            container.appendChild(this.profileAvatar);
        }
        
        // Set image source
        this.updateProfileAvatar();
    }

    createVerificationBadge() {
        const level = this.getVerificationLevel();
        const badge = document.createElement('div');
        badge.className = `avatar-verified-badge ${level === 'premium' ? 'premium' : ''}`;
        badge.innerHTML = `<i class="fas fa-${level === 'premium' ? 'crown' : 'check'}"></i>`;
        return badge;
    }

    createAvatarUploadInput() {
        if (this.avatarUploadInput && this.avatarUploadInput.parentNode) {
            this.avatarUploadInput.parentNode.removeChild(this.avatarUploadInput);
        }
        
        this.avatarUploadInput = document.createElement('input');
        this.avatarUploadInput.type = 'file';
        this.avatarUploadInput.accept = 'image/*';
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
        let photoURL = this.userProfile.photoURL;
        
        // Ensure valid photo URL
        if (!photoURL || photoURL.includes('undefined') || photoURL.includes('null')) {
            photoURL = this.getInitialsAvatar(displayName);
        }
        
        // Add cache buster
        const cacheBuster = `t=${Date.now()}`;
        photoURL += (photoURL.includes('?') ? '&' : '?') + cacheBuster;
        
        avatarImg.src = photoURL;
        avatarImg.alt = `${displayName}'s profile picture`;
        
        // Handle load/error
        avatarImg.onload = () => {
            this.profileAvatar.classList.remove('loading');
        };
        
        avatarImg.onerror = () => {
            console.warn('Auth: Avatar failed to load, using fallback');
            const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            avatarImg.src = this.getInitialsAvatar(initials);
            this.profileAvatar.classList.remove('loading');
        };
        
        this.profileAvatar.classList.add('loading');
        
        // Update verification badge
        this.updateAvatarVerificationBadge();
    }

    updateAvatarVerificationBadge() {
        const avatarContainer = this.profileAvatar.querySelector('.reverbit-avatar-container');
        if (!avatarContainer) return;
        
        const existingBadge = avatarContainer.querySelector('.avatar-verified-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        if (this.isVerified()) {
            avatarContainer.appendChild(this.createVerificationBadge());
        }
    }

    // ================= PROFILE POPUP =================
    createProfilePopup() {
        console.log('Auth: Creating profile popup...');
        
        this.removeProfilePopup();
        
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup';
        this.profilePopup.setAttribute('role', 'dialog');
        this.profilePopup.setAttribute('aria-modal', 'true');
        
        this.updatePopupContent();
        
        document.body.appendChild(this.profilePopup);
        
        // Position initially off-screen for measurement
        this.profilePopup.style.visibility = 'hidden';
        this.profilePopup.style.display = 'block';
        
        return this.profilePopup;
    }

    updatePopupContent() {
        if (!this.profilePopup) return;
        
        if (!this.userProfile) {
            this.profilePopup.innerHTML = `
                <div class="profile-popup-container">
                    <div class="profile-loading">
                        <div class="loading-spinner"></div>
                        <p>Loading profile...</p>
                    </div>
                </div>
            `;
            return;
        }
        
        const displayName = this.userProfile.displayName || 'User';
        const email = this.userProfile.email || '';
        const photoURL = this.userProfile.photoURL || this.getInitialsAvatar(displayName);
        const profileUrl = `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
        const dashboardUrl = 'https://aditya-cmd-max.github.io/dashboard';
        
        const level = this.getVerificationLevel();
        const isVerified = level !== 'none';
        const streak = this.userProfile.streak || 0;
        
        this.profilePopup.innerHTML = `
            <div class="profile-popup-container">
                <div class="profile-header">
                    <div class="profile-avatar-large" id="profile-avatar-large">
                        <div class="avatar-container">
                            <img src="${photoURL}" alt="${displayName}" 
                                 onerror="this.src='${this.getInitialsAvatar(displayName)}'">
                            ${this.getAvatarBadgeHTML()}
                            ${streak > 0 ? `<span class="streak-badge">${streak}</span>` : ''}
                        </div>
                        <button class="avatar-upload-btn" id="avatar-upload-btn">
                            <i class="fas fa-camera"></i>
                        </button>
                    </div>
                    <div class="profile-info">
                        <div class="profile-name-container">
                            <div class="profile-name">${displayName}</div>
                            ${this.user.emailVerified ? 
                                '<span class="email-verified-badge" title="Email Verified"><i class="fas fa-check-circle"></i></span>' : 
                                '<span class="email-unverified-badge" title="Email Not Verified"><i class="fas fa-exclamation-circle"></i></span>'}
                        </div>
                        <div class="profile-email">${email}</div>
                        <div class="profile-meta">
                            ${isVerified ? `
                                <span class="verified-status ${level === 'premium' ? 'premium' : ''}">
                                    <i class="fas fa-${level === 'premium' ? 'crown' : 'check-circle'}"></i>
                                    ${level === 'premium' ? 'Premium Verified' : 'Verified'}
                                </span>
                            ` : ''}
                            <span class="meta-item">
                                <i class="fas fa-calendar"></i>
                                Joined ${this.formatDate(this.userProfile.createdAt)}
                            </span>
                        </div>
                        <button class="change-avatar-btn" id="change-avatar-btn">
                            <i class="fas fa-edit"></i> Change photo
                        </button>
                    </div>
                </div>
                
                <div class="profile-divider"></div>
                
                <div class="profile-menu">
                    <a href="${dashboardUrl}" class="profile-menu-item" target="_blank">
                        <span class="profile-menu-icon"><i class="fas fa-tachometer-alt"></i></span>
                        <span class="profile-menu-text">Dashboard</span>
                        <span class="menu-arrow">›</span>
                    </a>
                    
                    <a href="${profileUrl}" target="_blank" class="profile-menu-item">
                        <span class="profile-menu-icon"><i class="fas fa-user"></i></span>
                        <span class="profile-menu-text">Public Profile</span>
                        <span class="menu-arrow">›</span>
                    </a>
                    
                    <button class="profile-menu-item" id="settings-btn">
                        <span class="profile-menu-icon"><i class="fas fa-cog"></i></span>
                        <span class="profile-menu-text">Settings</span>
                        <span class="menu-arrow">›</span>
                    </button>
                    
                    <div class="profile-divider"></div>
                    
                    <button class="profile-menu-item" id="profile-signout">
                        <span class="profile-menu-icon"><i class="fas fa-sign-out-alt"></i></span>
                        <span class="profile-menu-text">Sign Out</span>
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
                </div>
            </div>
        `;
        
        // Attach event listeners
        this.attachPopupEventListeners();
    }

    refreshProfilePopup() {
        if (this.profilePopup && this.popupVisible) {
            this.updatePopupContent();
            this.positionPopup();
        }
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
                this.hideProfilePopup();
            });
        }
        
        const uploadHandlers = [
            this.profilePopup.querySelector('#change-avatar-btn'),
            this.profilePopup.querySelector('#avatar-upload-btn'),
            this.profilePopup.querySelector('#profile-avatar-large')
        ];
        
        uploadHandlers.forEach(el => {
            if (el) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleAvatarUpload();
                });
            }
        });
    }

    toggleProfilePopup() {
        if (!this.user) {
            this.showToast('Please sign in to access profile', 'info');
            return;
        }
        
        if (!this.profilePopup) {
            this.createProfilePopup();
        }
        
        if (this.popupVisible) {
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
        this.updatePopupContent();
        
        // Show and position
        this.profilePopup.style.display = 'block';
        this.profilePopup.style.visibility = 'hidden';
        this.profilePopup.style.opacity = '0';
        
        this.positionPopup();
        
        this.profilePopup.style.visibility = 'visible';
        setTimeout(() => {
            this.profilePopup.style.opacity = '1';
            this.profilePopup.style.transform = 'scale(1)';
            this.popupVisible = true;
        }, 10);
        
        this.addPopupBackdrop();
        document.addEventListener('click', this.handleClickOutside);
    }

    positionPopup() {
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        const popupRect = this.profilePopup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let top, left;
        
        if (viewportWidth <= 640) {
            // Center on mobile
            top = (viewportHeight - popupRect.height) / 2;
            left = (viewportWidth - popupRect.width) / 2;
        } else {
            // Position near avatar
            top = avatarRect.bottom + 8;
            left = avatarRect.left;
            
            // Adjust if off-screen
            if (left + popupRect.width > viewportWidth) {
                left = avatarRect.right - popupRect.width;
            }
            if (left < 8) left = 8;
            
            if (top + popupRect.height > viewportHeight) {
                top = avatarRect.top - popupRect.height - 8;
            }
            if (top < 8) top = 8;
        }
        
        this.profilePopup.style.top = `${top}px`;
        this.profilePopup.style.left = `${left}px`;
    }

    hideProfilePopup() {
        if (!this.profilePopup) return;
        
        this.profilePopup.style.opacity = '0';
        this.profilePopup.style.transform = 'scale(0.95)';
        this.popupVisible = false;
        
        setTimeout(() => {
            this.profilePopup.style.display = 'none';
        }, 200);
        
        this.removePopupBackdrop();
        document.removeEventListener('click', this.handleClickOutside);
    }

    addPopupBackdrop() {
        if (document.querySelector('.popup-backdrop')) return;
        
        const backdrop = document.createElement('div');
        backdrop.className = 'popup-backdrop';
        backdrop.addEventListener('click', () => this.hideProfilePopup());
        document.body.appendChild(backdrop);
    }

    removePopupBackdrop() {
        const backdrop = document.querySelector('.popup-backdrop');
        if (backdrop) backdrop.remove();
    }

    handleClickOutside(event) {
        if (!this.profilePopup || !this.profileAvatar || !this.popupVisible) return;
        
        const isPopup = this.profilePopup.contains(event.target);
        const isAvatar = this.profileAvatar.contains(event.target);
        
        if (!isPopup && !isAvatar) {
            this.hideProfilePopup();
        }
    }

    removeProfilePopup() {
        if (this.profilePopup) {
            this.profilePopup.remove();
            this.profilePopup = null;
        }
        this.removePopupBackdrop();
        document.removeEventListener('click', this.handleClickOutside);
        this.popupVisible = false;
    }

    removeProfileAvatar() {
        if (this.profileAvatar) {
            this.profileAvatar.remove();
            this.profileAvatar = null;
        }
        if (this.avatarUploadInput) {
            this.avatarUploadInput.remove();
        }
    }

    // ================= AVATAR UPLOAD =================
    async handleAvatarUpload() {
        if (!this.user) {
            this.showToast('Please sign in to upload photos', 'info');
            return;
        }
        
        if (this.avatarUploadInput) {
            this.avatarUploadInput.click();
        }
    }

    async uploadProfilePicture(file) {
        if (!this.user || !file) return;
        
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
            this.showToast('Uploading...', 'info');
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            formData.append('cloud_name', this.cloudinaryConfig.cloudName);
            formData.append('folder', this.cloudinaryConfig.folder);
            
            const response = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Upload failed');
            
            const result = await response.json();
            const photoURL = result.secure_url;
            
            // Update Firebase
            await this.db.collection('users').doc(this.user.uid).update({
                photoURL: photoURL,
                cloudinaryImageId: result.public_id,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update local
            this.user.photoURL = photoURL;
            this.userProfile.photoURL = photoURL;
            this.userProfile.cloudinaryImageId = result.public_id;
            
            this.cacheUserData();
            this.updateProfileAvatar();
            this.refreshProfilePopup();
            
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
    }

    // ================= ACTIVITY TRACKING =================
    async trackLogin() {
        if (!this.user || !this.db) return;
        
        try {
            await this.db.collection('users').doc(this.user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                totalLogins: firebase.firestore.FieldValue.increment(1)
            });
            
            await this.updateStreak();
            
        } catch (error) {
            console.error('Auth: Login tracking error:', error);
        }
    }

    async updateLastActive() {
        if (!this.user || !this.db) return;
        
        try {
            await this.db.collection('users').doc(this.user.uid).update({
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Auth: Last active update error:', error);
        }
    }

    async updateStreak() {
        if (!this.user || !this.db) return;
        
        try {
            const userDoc = await this.db.collection('users').doc(this.user.uid).get();
            if (!userDoc.exists) return;
            
            const userData = userDoc.data();
            const lastActive = userData.lastActive?.toDate?.() || new Date();
            const today = new Date();
            
            today.setHours(0, 0, 0, 0);
            lastActive.setHours(0, 0, 0, 0);
            
            const diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
            let streak = userData.streak || 0;
            
            if (diffDays === 1) {
                streak += 1;
            } else if (diffDays > 1) {
                streak = 1;
            }
            
            await this.db.collection('users').doc(this.user.uid).update({ streak });
            
            if (this.userProfile) {
                this.userProfile.streak = streak;
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
            const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } catch {
            return 'Recently';
        }
    }

    getMemberDays() {
        if (!this.userProfile?.createdAt) return 0;
        
        try {
            const joinDate = this.userProfile.createdAt.seconds ? 
                new Date(this.userProfile.createdAt.seconds * 1000) : 
                new Date(this.userProfile.createdAt);
            const today = new Date();
            return Math.ceil((today - joinDate) / (1000 * 60 * 60 * 24));
        } catch {
            return 0;
        }
    }

    showWelcomeMessage() {
        if (!this.userProfile) return;
        
        try {
            const createdAt = this.userProfile.createdAt?.seconds ? 
                new Date(this.userProfile.createdAt.seconds * 1000) : 
                new Date(this.userProfile.createdAt);
            const diffHours = (new Date() - createdAt) / (1000 * 60 * 60);
            
            if (diffHours < 24) {
                setTimeout(() => {
                    this.showToast(`Welcome, ${this.userProfile.displayName}!`, 'success');
                }, 1000);
            }
        } catch (error) {
            console.error('Auth: Welcome message error:', error);
        }
    }

    // ================= VISIBILITY =================
    setupVisibilityListener() {
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        window.addEventListener('focus', () => this.onWindowFocus());
        window.addEventListener('blur', () => this.onWindowBlur());
    }

    onVisibilityChange() {
        if (document.visibilityState === 'visible' && this.user) {
            this.updateLastActive();
        }
    }

    onWindowFocus() {
        if (this.user) {
            this.updateLastActive();
            if (this.isOnline) {
                this.processOfflineQueue();
            }
        }
    }

    onWindowBlur() {
        // Nothing needed
    }

    setupPeriodicUpdates() {
        this.updateInterval = setInterval(() => {
            if (this.user && document.visibilityState === 'visible') {
                this.updateLastActive();
            }
        }, 5 * 60 * 1000);
    }

    // ================= LOGOUT =================
    async logout() {
        try {
            console.log('Auth: Logging out...');
            
            await this.updateLastActive();
            await this.auth.signOut();
            
            this.clearSession();
            this.removeProfileAvatar();
            this.removeProfilePopup();
            
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            
            this.showToast('Signed out successfully', 'success');
            
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 300);
            
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
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `reverbit-toast reverbit-toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="toast-icon fas ${type === 'success' ? 'fa-check-circle' : 
                                           type === 'error' ? 'fa-exclamation-circle' : 
                                           type === 'warning' ? 'fa-exclamation-triangle' : 
                                           'fa-info-circle'}"></i>
                <span class="toast-message">${message}</span>
                <button class="toast-close"><i class="fas fa-times"></i></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        
        toast.querySelector('.toast-close')?.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ================= STYLES INJECTION =================
    injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) return;
        
        const styles = `
            /* Profile Avatar */
            .reverbit-profile-avatar {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: 2px solid transparent;
                padding: 2px;
                background: linear-gradient(135deg, #B5651D, #2A9D8F) border-box;
                cursor: pointer;
                transition: all 0.3s ease;
                overflow: hidden;
                flex-shrink: 0;
                position: relative;
                display: block;
                outline: none;
                margin: 0;
            }
            
            .reverbit-profile-avatar:hover {
                transform: scale(1.1);
                box-shadow: 0 4px 20px rgba(181, 101, 29, 0.3);
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
                background: #f5f5f5;
            }
            
            .avatar-verified-badge {
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: linear-gradient(135deg, #B5651D, #2A9D8F);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
                z-index: 2;
                font-size: 10px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            }
            
            .dark-theme .avatar-verified-badge {
                border-color: #1A1208;
            }
            
            .avatar-verified-badge.premium {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #000;
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
                pointer-events: none;
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
                background: #F5EDD6;
                border-radius: 28px;
                box-shadow: 0 8px 32px rgba(26, 18, 8, 0.12);
                min-width: 340px;
                max-width: 380px;
                z-index: 10000;
                overflow: hidden;
                opacity: 0;
                transform: scale(0.95);
                transition: opacity 0.3s ease, transform 0.3s ease;
                border: 1px solid rgba(181, 101, 29, 0.3);
                font-family: 'Outfit', sans-serif;
                max-height: 85vh;
                overflow-y: auto;
            }
            
            .dark-theme .reverbit-profile-popup {
                background: #1A1208;
                border-color: rgba(205, 139, 69, 0.3);
            }
            
            .profile-popup-container {
                padding: 24px;
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
                border: 3px solid #F5EDD6;
                background: linear-gradient(135deg, #B5651D, #2A9D8F);
                padding: 3px;
                position: relative;
                cursor: pointer;
            }
            
            .dark-theme .profile-avatar-large .avatar-container {
                border-color: #1A1208;
            }
            
            .profile-avatar-large img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .avatar-upload-btn {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #B5651D;
                border: 2px solid #F5EDD6;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                opacity: 0;
                transition: all 0.3s ease;
                z-index: 3;
            }
            
            .dark-theme .avatar-upload-btn {
                border-color: #1A1208;
            }
            
            .profile-avatar-large:hover .avatar-upload-btn {
                opacity: 1;
            }
            
            .streak-badge {
                position: absolute;
                top: -8px;
                right: -8px;
                background: #C0392B;
                color: white;
                font-size: 10px;
                font-weight: 700;
                padding: 3px 6px;
                border-radius: 10px;
                border: 2px solid #F5EDD6;
                z-index: 2;
            }
            
            .dark-theme .streak-badge {
                border-color: #1A1208;
            }
            
            .profile-info {
                flex: 1;
            }
            
            .profile-name-container {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 4px;
            }
            
            .profile-name {
                font-size: 18px;
                font-weight: 600;
                color: #1A1208;
                line-height: 1.4;
            }
            
            .dark-theme .profile-name {
                color: #F5EDD6;
            }
            
            .email-verified-badge {
                color: #2A9D8F;
                font-size: 14px;
            }
            
            .email-unverified-badge {
                color: #C0392B;
                font-size: 14px;
            }
            
            .profile-email {
                font-size: 14px;
                color: #2D2010;
                margin-bottom: 8px;
            }
            
            .dark-theme .profile-email {
                color: #D4C49A;
            }
            
            .profile-meta {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 12px;
                font-size: 12px;
                color: #2D2010;
            }
            
            .dark-theme .profile-meta {
                color: #D4C49A;
            }
            
            .verified-status {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: #2A9D8F;
                font-weight: 600;
                font-size: 11px;
                background: rgba(42, 157, 143, 0.1);
                padding: 2px 6px;
                border-radius: 8px;
                width: fit-content;
            }
            
            .verified-status.premium {
                color: #FFA500;
                background: rgba(255, 165, 0, 0.1);
            }
            
            .meta-item {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .change-avatar-btn {
                font-size: 13px;
                color: #B5651D;
                background: #EDE0C0;
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
            
            .dark-theme .change-avatar-btn {
                color: #F5EDD6;
                background: #2D2010;
            }
            
            .change-avatar-btn:hover {
                background: #CD8B45;
                color: white;
            }
            
            .profile-divider {
                height: 1px;
                background: rgba(181, 101, 29, 0.2);
                margin: 16px -24px;
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
                border-radius: 20px;
                text-decoration: none;
                color: #1A1208;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                border: none;
                background: none;
                width: 100%;
                text-align: left;
            }
            
            .dark-theme .profile-menu-item {
                color: #F5EDD6;
            }
            
            .profile-menu-item:hover {
                background: #EDE0C0;
            }
            
            .dark-theme .profile-menu-item:hover {
                background: #2D2010;
            }
            
            .profile-menu-icon {
                width: 20px;
                color: #B5651D;
            }
            
            .menu-arrow {
                color: #B5651D;
                font-size: 16px;
                opacity: 0.7;
            }
            
            .profile-footer {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid rgba(181, 101, 29, 0.2);
            }
            
            .profile-stats {
                display: flex;
                justify-content: space-around;
            }
            
            .stat-item {
                text-align: center;
            }
            
            .stat-number {
                font-size: 20px;
                font-weight: 700;
                color: #B5651D;
                line-height: 1;
            }
            
            .stat-label {
                font-size: 11px;
                color: #2D2010;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .dark-theme .stat-label {
                color: #D4C49A;
            }
            
            .profile-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 40px;
                gap: 16px;
            }
            
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #EDE0C0;
                border-top-color: #B5651D;
                border-radius: 50%;
                animation: avatar-spin 1s linear infinite;
            }
            
            .dark-theme .loading-spinner {
                border-color: #2D2010;
                border-top-color: #CD8B45;
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
                background: rgba(245, 237, 214, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                border: 1px solid rgba(181, 101, 29, 0.2);
                box-shadow: 0 4px 20px rgba(26, 18, 8, 0.15);
                transition: all 0.3s ease;
            }
            
            .dark-theme .reverbit-floating-header {
                background: rgba(26, 18, 8, 0.95);
                border-color: rgba(205, 139, 69, 0.2);
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
            }
            
            /* Toast */
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
                transition: all 0.3s ease;
                min-width: 300px;
                max-width: 90%;
            }
            
            .reverbit-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            
            .toast-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: rgba(255,255,255,0.7);
                cursor: pointer;
                padding: 4px;
            }
            
            .reverbit-toast-success { background: #34a853; }
            .reverbit-toast-error { background: #ea4335; }
            .reverbit-toast-warning { background: #fbbc05; color: #202124; }
            .reverbit-toast-info { background: #1a73e8; }
            
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
                background: #F5EDD6;
                padding: 40px;
                border-radius: 36px;
                max-width: 400px;
                text-align: center;
            }
            
            .dark-theme .auth-fallback-content {
                background: #1A1208;
            }
            
            .auth-fallback-content i {
                font-size: 48px;
                color: #C0392B;
                margin-bottom: 20px;
            }
            
            .auth-fallback-content h3 {
                font-size: 24px;
                margin-bottom: 16px;
                color: #1A1208;
            }
            
            .dark-theme .auth-fallback-content h3 {
                color: #F5EDD6;
            }
            
            .auth-fallback-content p {
                color: #2D2010;
                margin-bottom: 24px;
            }
            
            .dark-theme .auth-fallback-content p {
                color: #D4C49A;
            }
            
            .auth-fallback-content .btn {
                padding: 12px 24px;
                background: linear-gradient(135deg, #B5651D, #2A9D8F);
                color: white;
                border: none;
                border-radius: 999px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .auth-fallback-content .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(181, 101, 29, 0.3);
            }
            
            /* Responsive */
            @media (max-width: 640px) {
                .reverbit-profile-popup {
                    position: fixed;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) scale(0.95) !important;
                    width: calc(100vw - 32px);
                    max-width: 360px;
                }
                
                .reverbit-profile-popup[style*="opacity: 1"] {
                    transform: translate(-50%, -50%) scale(1) !important;
                }
                
                .profile-header {
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }
                
                .profile-name-container {
                    justify-content: center;
                }
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
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
            await this.db.collection('users').doc(this.user.uid).update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            Object.assign(this.userProfile, updates);
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
        if (!this.user) await this.loadUserProfile();
        return this.user ? `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}` : null;
    }
}

// ================= GLOBAL INSTANCE =================
window.ReverbitAuth = new ReverbitAuth();

// Debug helper
window.debugAuth = function() {
    console.log('=== AUTH DEBUG ===');
    console.log('User:', window.ReverbitAuth.getUser());
    console.log('Profile:', window.ReverbitAuth.getUserProfile());
    console.log('Theme:', window.ReverbitAuth.getCurrentTheme());
    console.log('Dark Mode:', window.ReverbitAuth.isDarkModeActive());
    console.log('Online:', window.ReverbitAuth.isOnline);
    console.log('Queue:', window.ReverbitAuth.offlineQueue.length);
    console.log('=== END DEBUG ===');
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Reverbit Auth: Starting initialization...');
        await window.ReverbitAuth.init();
        console.log('Reverbit Auth: Ready');
        
        // Double-check avatar after a delay
        setTimeout(() => {
            if (window.ReverbitAuth.isAuthenticated() && !document.querySelector('.reverbit-profile-avatar')) {
                window.ReverbitAuth.forceAvatarCreation();
            }
        }, 1000);
        
    } catch (error) {
        console.error('Reverbit Auth: Initialization failed:', error);
    }
});

// Make auth globally accessible
window.auth = window.ReverbitAuth;

console.log('Reverbit Enterprise Auth System loaded');

// ====================================================================
// auth.js 
// Reverbit Innovations by Aditya Jha
// ENTERPRISE PRODUCTION VERSION - ALL ISSUES FIXED
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
        this.profileLoadAttempts = 0;
        this.maxProfileLoadAttempts = 3;
        
        // Toast control - FIX: Prevent duplicate/annoying toasts
        this.toastHistory = new Map();
        this.lastToastTime = 0;
        this.toastThrottle = 2000; // Minimum 2 seconds between toasts
        this.suppressedToasts = ['DATA SAVED LOCALLY', 'Profile saved locally', 'Using cached profile'];
        
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
        if (this.initialized) {
            return this;
        }
        
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
            
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            // Configure Firestore
            this.db.settings({
                timestampsInSnapshots: true,
                ignoreUndefinedProperties: true,
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });
            
            // Enable persistence
            await this.enablePersistence();
            
            // Initialize Cloudinary
            this.initCloudinaryWidget();
            
            // Inject styles
            this.injectStyles();
            
            // Setup auth listener
            this.setupAuthListener();
            
            // Check existing session
            await this.checkExistingSession();
            
            // Initialize theme
            this.initThemeSystem();
            
            // Setup listeners
            this.setupVisibilityListener();
            this.setupPeriodicUpdates();
            this.setupConnectivityListeners();
            
            // Force avatar creation
            setTimeout(() => {
                if (this.user) {
                    this.forceAvatarCreation();
                }
            }, 500);
            
            this.initialized = true;
            
            // Process offline queue silently
            this.processOfflineQueue(true);
            
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
        } catch (persistenceError) {
            if (persistenceError.code === 'failed-precondition') {
                console.warn('Auth: Multiple tabs open, persistence disabled in some tabs');
            } else if (persistenceError.code === 'unimplemented') {
                console.warn('Auth: Browser does not support persistence');
            }
        }
    }

    handleInitializationError(error) {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = 2000 * Math.pow(1.5, this.retryCount - 1);
            
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
            this.processOfflineQueue();
            if (this.user) {
                this.syncUserData();
            }
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

    async processOfflineQueue(silent = false) {
        if (!this.isOnline || this.offlineQueue.length === 0) return;
        
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

    // ================= TOAST CONTROL - FIXED =================
    showToast(message, type = 'info', important = false) {
        // Suppress annoying local storage messages
        if (!important && this.suppressedToasts.some(s => message.includes(s))) {
            return;
        }
        
        // Throttle toasts
        const now = Date.now();
        if (now - this.lastToastTime < this.toastThrottle && !important) {
            return;
        }
        
        // Check for duplicate toasts
        const toastKey = `${message}-${type}`;
        if (this.toastHistory.has(toastKey)) {
            const lastShown = this.toastHistory.get(toastKey);
            if (now - lastShown < 10000) { // 10 second cooldown for same message
                return;
            }
        }
        
        this.toastHistory.set(toastKey, now);
        this.lastToastTime = now;
        
        // Clean up old toast history
        if (this.toastHistory.size > 50) {
            const oldest = now - 60000; // 1 minute
            for (const [key, time] of this.toastHistory.entries()) {
                if (time < oldest) {
                    this.toastHistory.delete(key);
                }
            }
        }
        
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
        }, type === 'error' ? 5000 : 3000);
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
        const pageTheme = this.detectPageTheme();
        const savedTheme = localStorage.getItem('reverbit_theme');
        
        if (pageTheme && !savedTheme) {
            this.currentTheme = pageTheme;
        } else if (savedTheme) {
            this.currentTheme = savedTheme;
        } else if (this.userProfile && this.userProfile.theme) {
            this.currentTheme = this.userProfile.theme;
        } else {
            this.currentTheme = 'auto';
        }
        
        this.applyTheme();
        this.setupThemeObserver();
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.applyTheme();
            }
        });
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
                
                this.showToast(`Theme set to ${this.currentTheme}`, 'success', true);
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
        this.auth.onAuthStateChanged(async (user) => {
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
                
                try {
                    await this.loadUserProfile();
                    
                    this.cacheUserData();
                    
                    if (this.userProfile?.theme) {
                        this.currentTheme = this.userProfile.theme;
                        this.applyTheme();
                    }
                    
                    this.forceAvatarCreation();
                    
                    await this.trackLogin();
                    await this.updateLastActive();
                    
                    if (!user.emailVerified) {
                        this.checkEmailVerification();
                    }
                    
                } catch (profileError) {
                    console.error('Auth: Profile loading failed:', profileError);
                    this.profileLoadAttempts++;
                    
                    const cachedProfile = localStorage.getItem('reverbit_user_profile');
                    if (cachedProfile) {
                        try {
                            this.userProfile = JSON.parse(cachedProfile);
                            this.forceAvatarCreation();
                        } catch (e) {
                            console.error('Auth: Failed to parse cached profile');
                        }
                    }
                    
                    if (this.profileLoadAttempts <= this.maxProfileLoadAttempts) {
                        try {
                            await this.createNewProfile(user);
                            this.forceAvatarCreation();
                        } catch (createError) {
                            console.error('Auth: Profile creation failed:', createError);
                            
                            this.userProfile = {
                                uid: user.uid,
                                email: user.email,
                                displayName: user.displayName || user.email?.split('@')[0] || 'User',
                                username: this.generateUsername(user.displayName || 'User', user.email),
                                photoURL: user.photoURL || this.getInitialsAvatar(user.displayName || 'User'),
                                isPublic: true,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
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
                                cloudinaryImageId: '',
                                lastLogin: new Date().toISOString(),
                                lastActive: new Date().toISOString(),
                                lastSync: new Date().toISOString(),
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
                            
                            this.cacheUserProfile();
                            this.forceAvatarCreation();
                        }
                    }
                }
                
            } else {
                this.user = null;
                this.userProfile = null;
                this.clearSession();
                this.removeProfileAvatar();
                this.removeProfilePopup();
                this.currentTheme = 'auto';
                this.applyTheme();
            }
            
            this.notifyAuthListeners();
        });
    }

    forceAvatarCreation() {
        const existingAvatar = document.querySelector('.reverbit-profile-avatar');
        if (existingAvatar) {
            existingAvatar.remove();
        }
        
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
        
        document.cookie = 'reverbit_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
                this.showToast('Email verified successfully!', 'success', true);
                
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
        
        setTimeout(() => clearInterval(checkInterval), 300000);
    }

    // ================= PROFILE MANAGEMENT =================
    async loadUserProfile() {
        if (!this.user || !this.db) {
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
                    
                    await this.ensureProfileFields(userRef);
                    break;
                    
                } else {
                    await this.createNewProfile(this.user);
                    break;
                }
                
            } catch (error) {
                retryCount++;
                console.error(`Auth: Profile loading error (attempt ${retryCount}):`, error);
                
                if (retryCount === maxRetries) {
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
        
        this.cacheUserProfile();
    }

    async createNewProfile(user) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        const username = this.generateUsername(displayName, user.email);
        const now = firebase.firestore.Timestamp.now();
        
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
            this.userProfile = userProfile;
            
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
            
            await this.db.collection('activity').add({
                userId: user.uid,
                type: 'account_created',
                timestamp: now,
                metadata: {
                    displayName: displayName,
                    email: user.email
                }
            });
            
        } catch (createError) {
            console.error('Auth: Profile creation failed:', createError);
            
            this.userProfile = userProfile;
            this.cacheUserProfile();
            
            this.addToOfflineQueue('createProfile', {
                uid: user.uid,
                profile: userProfile
            });
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
            verificationNotes: '',
            cloudinaryImageId: '',
            preferences: {
                notifications: true,
                emailUpdates: true,
                autoSave: true,
                darkMode: this.isDarkMode,
                language: 'en',
                privacyMode: false
            },
            accountStatus: 'active',
            appVersion: '1.0.0',
            platform: this.getPlatform(),
            userAgent: navigator.userAgent
        };
        
        let needsUpdate = false;
        const updates = {};
        
        for (const [key, value] of Object.entries(requiredFields)) {
            if (this.userProfile[key] === undefined || this.userProfile[key] === null) {
                updates[key] = value;
                needsUpdate = true;
            } else if (key === 'preferences' && typeof value === 'object') {
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
        }
    }

    // ================= VERIFICATION HELPERS - FIXED =================
    getVerificationLevel() {
        if (!this.userProfile) return 'none';
        
        // Check premium verification FIRST
        if (this.userProfile.premiumVerified === true || 
            this.userProfile.verifiedLevel === 'premium') {
            return 'premium';
        }
        
        // Check basic verification
        if (this.userProfile.verified === true || 
            this.userProfile.verifiedLevel === 'basic') {
            return 'basic';
        }
        
        // Check string values (for backward compatibility)
        if (this.userProfile.premiumVerified === 'true' || 
            this.userProfile.verified === 'true') {
            return this.userProfile.premiumVerified === 'true' ? 'premium' : 'basic';
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
        const existingAvatar = document.querySelector('.reverbit-profile-avatar');
        if (existingAvatar) {
            existingAvatar.remove();
        }
        
        let headerActions = this.findAvatarContainer();
        
        if (!headerActions) {
            headerActions = this.createFloatingHeader();
        }
        
        this.createAvatarButton(headerActions);
        this.createAvatarUploadInput();
    }

    findAvatarContainer() {
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
        
        const header = document.querySelector('header, .header, .app-header, nav.navbar');
        if (header) {
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
        
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'reverbit-avatar-container';
        
        const avatarImg = document.createElement('img');
        avatarImg.className = 'reverbit-avatar-img';
        avatarImg.alt = 'Profile avatar';
        avatarImg.loading = 'lazy';
        
        avatarContainer.appendChild(avatarImg);
        
        if (this.isVerified()) {
            const badgeDiv = document.createElement('div');
            badgeDiv.className = `avatar-verified-badge ${this.getVerificationLevel() === 'premium' ? 'premium' : ''}`;
            badgeDiv.innerHTML = `<i class="fas fa-${this.getVerificationLevel() === 'premium' ? 'crown' : 'check'}"></i>`;
            avatarContainer.appendChild(badgeDiv);
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
        loadingSpinner.innerHTML = '<div class="spinner"></div>';
        loadingSpinner.style.display = 'none';
        
        this.profileAvatar.appendChild(avatarContainer);
        this.profileAvatar.appendChild(uploadOverlay);
        this.profileAvatar.appendChild(loadingSpinner);
        
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
            return;
        }
        
        const avatarImg = this.profileAvatar.querySelector('.reverbit-avatar-img');
        if (!avatarImg) return;
        
        const displayName = this.userProfile.displayName || 'User';
        let photoURL = this.userProfile.photoURL;
        
        if (!photoURL || photoURL.includes('undefined') || photoURL.includes('null')) {
            photoURL = this.getInitialsAvatar(displayName);
        }
        
        const cacheBuster = `t=${Date.now()}`;
        photoURL += (photoURL.includes('?') ? '&' : '?') + cacheBuster;
        
        avatarImg.src = photoURL;
        avatarImg.alt = `${displayName}'s profile picture`;
        
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
            const badgeDiv = document.createElement('div');
            badgeDiv.className = `avatar-verified-badge ${this.getVerificationLevel() === 'premium' ? 'premium' : ''}`;
            badgeDiv.innerHTML = `<i class="fas fa-${this.getVerificationLevel() === 'premium' ? 'crown' : 'check'}"></i>`;
            avatarContainer.appendChild(badgeDiv);
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
        
        const menuItems = [
            { icon: 'fa-upload', text: 'Upload Photo', action: () => this.handleAvatarUpload() },
            { icon: 'fa-camera', text: 'Take Photo', action: () => this.takePhoto() },
            { icon: 'fa-user-circle', text: 'View Profile', action: () => this.viewProfile() },
            { icon: 'fa-tachometer-alt', text: 'Dashboard', action: () => this.goToDashboard() },
            { icon: 'fa-cog', text: 'Settings', action: () => this.openSettings() },
            { icon: 'fa-shield-alt', text: 'Verification', action: () => this.openVerification() },
            { icon: 'fa-sign-out-alt', text: 'Sign Out', action: () => this.logout() }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('button');
            menuItem.className = 'context-menu-item';
            menuItem.innerHTML = `
                <i class="fas ${item.icon}" style="width: 16px;"></i>
                <span>${item.text}</span>
            `;
            
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                contextMenu.remove();
            });
            
            contextMenu.appendChild(menuItem);
        });
        
        document.body.appendChild(contextMenu);
        
        const rect = contextMenu.getBoundingClientRect();
        let left = event.clientX;
        let top = event.clientY;
        
        if (left + rect.width > window.innerWidth) {
            left = window.innerWidth - rect.width - 10;
        }
        if (top + rect.height > window.innerHeight) {
            top = window.innerHeight - rect.height - 10;
        }
        
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
        
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

    async takePhoto() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showToast('Camera access not supported', 'error', true);
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.showCameraInterface(stream);
        } catch (error) {
            console.error('Camera error:', error);
            this.showToast('Camera access denied', 'error', true);
        }
    }

    showCameraInterface(stream) {
        const cameraModal = document.createElement('div');
        cameraModal.className = 'camera-modal';
        
        const video = document.createElement('video');
        video.autoplay = true;
        video.srcObject = stream;
        
        const controls = document.createElement('div');
        controls.className = 'camera-controls';
        
        const captureBtn = document.createElement('button');
        captureBtn.innerHTML = '<i class="fas fa-camera"></i> Take Photo';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        
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

    // ================= PROFILE POPUP - FIXED =================
    createProfilePopup() {
        this.removeProfilePopup();
        
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup';
        this.profilePopup.setAttribute('role', 'dialog');
        this.profilePopup.setAttribute('aria-modal', 'true');
        
        this.updatePopupContent();
        
        document.body.appendChild(this.profilePopup);
        
        setTimeout(() => {
            this.attachPopupEventListeners();
        }, 10);
        
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
        const verificationUrl = 'https://aditya-cmd-max.github.io/verify';
        
        const verificationLevel = this.getVerificationLevel();
        const isVerified = verificationLevel !== 'none';
        const verificationBadge = this.getVerificationBadgeHTML();
        
        const streak = this.userProfile.streak || 0;
        const streakDisplay = streak > 0 ? `<span class="streak-badge">${streak} day${streak !== 1 ? 's' : ''}</span>` : '';
        
        const verifiedStatus = isVerified ? 
            (verificationLevel === 'premium' ? 
                '<span class="verified-status premium"><i class="fas fa-crown"></i> Premium Verified</span>' : 
                '<span class="verified-status"><i class="fas fa-check-circle"></i> Verified</span>') : 
            '';
        
        const emailVerifiedBadge = this.user.emailVerified ? 
            '<span class="email-verified-badge" title="Email Verified"><i class="fas fa-check-circle"></i></span>' : 
            '<span class="email-unverified-badge" title="Email Not Verified"><i class="fas fa-exclamation-circle"></i></span>';
        
        const joinDate = this.formatDate(this.userProfile.createdAt);
        const lastActive = this.formatRelativeTime(this.userProfile.lastActive);
        const memberDays = this.getMemberDays();
        
        this.profilePopup.innerHTML = `
            <div class="profile-popup-container">
                <div class="profile-header">
                    <div class="profile-avatar-large" id="profile-avatar-large">
                        <div class="avatar-container">
                            <img src="${photoURL}" alt="${displayName}" 
                                 onerror="this.src='${this.getInitialsAvatar(displayName)}'">
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
                                Joined ${joinDate}
                            </span>
                            <span class="meta-item">
                                <i class="fas fa-clock"></i>
                                Last active ${lastActive}
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
                    
                    <!-- Verification option - NOW VISIBLE TO ALL USERS (FIXED) -->
                    <a href="${verificationUrl}" target="_blank" class="profile-menu-item" id="profile-verification">
                        <span class="profile-menu-icon">
                            <i class="fas fa-shield-alt"></i>
                        </span>
                        <span class="profile-menu-text">Verification</span>
                        <span class="menu-arrow">›</span>
                    </a>
                    
                    <!-- Settings option - NOW VISIBLE TO ALL USERS (FIXED) -->
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
                            <div class="stat-number">${memberDays}</div>
                            <div class="stat-label">Days</div>
                        </div>
                    </div>
                    <div class="privacy-link">
                        <a href="https://aditya-cmd-max.github.io/privacy" target="_blank">Privacy</a>
                        •
                        <a href="https://aditya-cmd-max.github.io/terms" target="_blank">Terms</a>
                        •
                        <a href="https://aditya-cmd-max.github.io/help" target="_blank">Help</a>
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
                this.hideProfilePopup();
            });
        }
        
        const dashboardBtn = this.profilePopup.querySelector('#profile-dashboard');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'https://aditya-cmd-max.github.io/dashboard';
            });
        }
        
        const verificationBtn = this.profilePopup.querySelector('#profile-verification');
        if (verificationBtn) {
            verificationBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.open('https://aditya-cmd-max.github.io/verify', '_blank');
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
        
        this.profilePopup.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideProfilePopup();
            }
        });
    }

    toggleProfilePopup() {
        if (!this.user) {
            this.showToast('Please sign in to access profile', 'info', true);
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
            return;
        }
        
        this.updatePopupContent();
        this.attachPopupEventListeners();
        
        this.profilePopup.style.display = 'block';
        this.profilePopup.style.visibility = 'hidden';
        this.profilePopup.style.opacity = '0';
        
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        this.profilePopup.style.visibility = 'visible';
        
        this.profilePopup.offsetHeight;
        
        const popupRect = this.profilePopup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let top, left;
        
        if (viewportWidth <= 640) {
            top = (viewportHeight - popupRect.height) / 2;
            left = (viewportWidth - popupRect.width) / 2;
        } else {
            top = avatarRect.bottom + 8;
            left = avatarRect.left;
            
            const spaceBelow = viewportHeight - avatarRect.bottom - 16;
            const spaceAbove = avatarRect.top - 16;
            
            if (spaceBelow < popupRect.height) {
                if (spaceAbove >= popupRect.height) {
                    top = avatarRect.top - popupRect.height - 8;
                } else {
                    top = viewportHeight - popupRect.height - 16;
                }
            }
            
            if (left + popupRect.width > viewportWidth) {
                left = avatarRect.right - popupRect.width;
                if (left < 16) {
                    left = viewportWidth - popupRect.width - 16;
                }
            }
            
            left = Math.max(16, Math.min(left, viewportWidth - popupRect.width - 16));
        }
        
        top = Math.max(16, Math.min(top, viewportHeight - popupRect.height - 16));
        
        this.profilePopup.style.top = `${top}px`;
        this.profilePopup.style.left = `${left}px`;
        
        setTimeout(() => {
            this.profilePopup.style.opacity = '1';
            this.profilePopup.style.transform = 'scale(1)';
            this.popupVisible = true;
            
            const firstButton = this.profilePopup.querySelector('button, a');
            if (firstButton) firstButton.focus();
        }, 10);
        
        this.addPopupBackdrop();
        document.addEventListener('click', this.handleClickOutside);
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
            this.showToast('Please sign in to upload photos', 'info', true);
            return;
        }
        
        if (this.avatarUploadInput) {
            this.avatarUploadInput.click();
        }
    }

    async uploadProfilePicture(file) {
        if (!this.user || !file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('Image must be less than 10MB', 'error', true);
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error', true);
            return;
        }
        
        try {
            this.showUploadingState(true);
            this.showToast('Uploading profile picture...', 'info', true);
            
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
            
            this.cacheUserData();
            this.updateProfileAvatar();
            
            if (this.profilePopup && this.popupVisible) {
                this.updatePopupContent();
                this.attachPopupEventListeners();
            }
            
            this.showToast('Profile picture updated!', 'success', true);
            
        } catch (error) {
            console.error('Auth: Upload failed:', error);
            this.showToast('Failed to upload picture', 'error', true);
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
                totalLogins: firebase.firestore.FieldValue.increment(1),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            if (this.userProfile) {
                this.userProfile.totalLogins = (this.userProfile.totalLogins || 0) + 1;
            }
            
            await this.updateStreak();
            
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

    openVerification() {
        window.open('https://aditya-cmd-max.github.io/verify', '_blank');
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
            this.updateStreak();
        }
    }

    onWindowFocus() {
        if (this.user) {
            this.updateLastActive();
            this.updateStreak();
            
            if (this.isOnline) {
                this.processOfflineQueue(true);
            }
        }
    }

    onWindowBlur() {}

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
            await this.updateLastActive();
            
            document.cookie = 'reverbit_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            
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
            
            return true;
            
        } catch (error) {
            console.error('Auth: Logout error:', error);
            return false;
        }
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
                box-shadow: 0 4px 20px rgba(181, 101, 29, 0.3);
            }
            
            .reverbit-profile-avatar:focus-visible {
                outline: 2px solid #B5651D;
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
                border-top-color: #B5651D;
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
            
            /* Avatar Verification Badge - FIXED: Only shows for verified users */
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
                    box-shadow: 0 0 12px rgba(181, 101, 29, 0.4);
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
                box-shadow: 0 8px 32px rgba(26, 18, 8, 0.12), 0 16px 48px rgba(26, 18, 8, 0.08);
                min-width: 340px;
                max-width: 380px;
                z-index: 10000;
                overflow: hidden;
                opacity: 0;
                transform: scale(0.95);
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                            transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
            
            .profile-avatar-large:hover .avatar-upload-btn {
                opacity: 1;
                transform: scale(1);
            }
            
            .profile-avatar-large img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                background: #F5EDD6;
                transition: transform 0.3s ease;
            }
            
            .dark-theme .profile-avatar-large img {
                background: #1A1208;
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
                background: #B5651D;
                border: 2px solid #F5EDD6;
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
            
            .dark-theme .avatar-upload-btn {
                border-color: #1A1208;
            }
            
            .avatar-upload-btn:hover {
                background: #2A9D8F;
                transform: scale(1.1);
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
                color: #1A1208;
                line-height: 1.4;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-family: 'Begum', serif;
            }
            
            .dark-theme .profile-name {
                color: #F5EDD6;
            }
            
            /* Email Verification Badge */
            .email-verified-badge {
                color: #2A9D8F;
                font-size: 14px;
            }
            
            .email-unverified-badge {
                color: #C0392B;
                font-size: 14px;
            }
            
            /* Popup Verification Badge - FIXED: Only shows for verified users */
            .verified-badge-popup {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: linear-gradient(135deg, #B5651D, #2A9D8F);
                color: white;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                box-shadow: 0 2px 6px rgba(181, 101, 29, 0.3);
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
                color: #2D2010;
                line-height: 1.4;
                margin-bottom: 8px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
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
                margin-bottom: 4px;
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
            
            .meta-item i {
                width: 12px;
                height: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
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
                transform: translateY(-1px);
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
                position: relative;
            }
            
            .dark-theme .profile-menu-item {
                color: #F5EDD6;
            }
            
            .profile-menu-item:hover {
                background: #EDE0C0;
                transform: translateX(4px);
            }
            
            .dark-theme .profile-menu-item:hover {
                background: #2D2010;
            }
            
            .profile-menu-item:active {
                background: #D4C49A;
            }
            
            .profile-menu-icon {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #B5651D;
                flex-shrink: 0;
            }
            
            .profile-menu-text {
                flex: 1;
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
                color: #B5651D;
                line-height: 1;
                font-family: 'Begum', serif;
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
            
            .privacy-link {
                font-size: 12px;
                color: #2D2010;
                text-align: center;
                display: flex;
                justify-content: center;
                gap: 8px;
                flex-wrap: wrap;
                margin-top: 16px;
            }
            
            .dark-theme .privacy-link {
                color: #D4C49A;
            }
            
            .privacy-link a {
                color: #B5651D;
                text-decoration: none;
                transition: color 0.2s ease;
            }
            
            .dark-theme .privacy-link a {
                color: #CD8B45;
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
                border: 3px solid #EDE0C0;
                border-top-color: #B5651D;
                border-radius: 50%;
                animation: avatar-spin 1s linear infinite;
            }
            
            .dark-theme .loading-spinner {
                border-color: #2D2010;
                border-top-color: #CD8B45;
            }
            
            .profile-loading p {
                color: #2D2010;
            }
            
            .dark-theme .profile-loading p {
                color: #D4C49A;
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
            
            /* Context Menu */
            .avatar-context-menu {
                position: fixed;
                background: #F5EDD6;
                border: 1px solid rgba(181, 101, 29, 0.2);
                border-radius: 20px;
                box-shadow: 0 4px 20px rgba(26, 18, 8, 0.15);
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
                background: #1A1208;
                border-color: rgba(205, 139, 69, 0.2);
            }
            
            .context-menu-item {
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
                padding: 10px 16px;
                border: none;
                background: none;
                color: #1A1208;
                font-family: 'Outfit', sans-serif;
                font-size: 14px;
                text-align: left;
                cursor: pointer;
                transition: background-color 0.2s ease;
            }
            
            .dark-theme .context-menu-item {
                color: #F5EDD6;
            }
            
            .context-menu-item:hover {
                background: #EDE0C0;
            }
            
            .dark-theme .context-menu-item:hover {
                background: #2D2010;
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
            
            .popup-backdrop {
                opacity: 1;
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
            
            .camera-modal video {
                width: 90%;
                max-width: 500px;
                border-radius: 12px;
                background: #000;
            }
            
            .camera-controls {
                margin-top: 20px;
                display: flex;
                gap: 16px;
            }
            
            .camera-controls button {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .camera-controls button:first-child {
                background: #1a73e8;
                color: white;
            }
            
            .camera-controls button:last-child {
                background: #5f6368;
                color: white;
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
                background: #F5EDD6;
                padding: 40px;
                border-radius: 36px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 8px 32px rgba(26, 18, 8, 0.2);
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
                font-family: 'Begum', serif;
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
            
            /* Accessibility */
            .reverbit-profile-avatar:focus-visible,
            .profile-menu-item:focus-visible,
            .change-avatar-btn:focus-visible {
                outline: 2px solid #B5651D;
                outline-offset: 2px;
            }
            
            /* Toast Notifications - FIXED: Throttled and controlled */
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
                
                .reverbit-profile-popup[style*="opacity: 1"] {
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
                
                .reverbit-floating-header {
                    top: 8px;
                    right: 8px;
                    padding: 6px 10px;
                }
                
                .reverbit-toast {
                    min-width: 280px;
                    width: calc(100% - 32px);
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
    console.log('Verification Level:', window.ReverbitAuth.getVerificationLevel());
    console.log('Is Verified:', window.ReverbitAuth.isVerified());
    console.log('Is Premium:', window.ReverbitAuth.isPremium());
    console.log('Theme:', window.ReverbitAuth.getCurrentTheme());
    console.log('Dark Mode:', window.ReverbitAuth.isDarkModeActive());
    console.log('Online:', window.ReverbitAuth.isOnline);
    console.log('Queue:', window.ReverbitAuth.offlineQueue.length);
    console.log('Popup Visible:', window.ReverbitAuth.popupVisible);
    console.log('Avatar Element:', document.querySelector('.reverbit-profile-avatar'));
    console.log('=== END DEBUG ===');
};

window.viewPublicProfile = async function() {
    const link = await window.ReverbitAuth.generateProfileLink();
    if (link) {
        window.open(link, '_blank');
    } else {
        window.ReverbitAuth.showToast('Please sign in first', 'info', true);
    }
};

// Auto-initialize with performance optimization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await window.ReverbitAuth.init();
        } catch (error) {
            console.error('Reverbit Auth: Initialization failed:', error);
        }
    });
} else {
    // DOM already loaded
    setTimeout(async () => {
        try {
            await window.ReverbitAuth.init();
        } catch (error) {
            console.error('Reverbit Auth: Initialization failed:', error);
        }
    }, 0);
}

// Get current app name helper
window.ReverbitAuth.getCurrentAppName = function() {
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
};

window.ReverbitAuth.trackUsage = async function(appName, minutes) {
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
};

// Storage listener for theme changes
window.addEventListener('storage', (e) => {
    if (e.key === 'reverbit_theme') {
        window.ReverbitAuth.currentTheme = e.newValue || 'auto';
        window.ReverbitAuth.applyTheme();
    }
});

// Make auth globally accessible
window.auth = window.ReverbitAuth;

console.log('Reverbit Enterprise Auth System loaded successfully (All issues fixed)');

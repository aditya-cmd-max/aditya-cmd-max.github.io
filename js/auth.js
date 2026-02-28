// auth.js - Ultra Modern Google-style Profile System with Dark Mode & Cloudinary
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
        
        // Core state
        this.user = null;
        this.userProfile = null;
        this.initialized = false;
        
        // UI Elements
        this.profilePopup = null;
        this.profileAvatar = null;
        this.avatarUploadInput = null;
        this.popupBackdrop = null;
        
        // Theme state
        this.currentTheme = 'auto';
        this.isDarkMode = false;
        this.themeObserver = null;
        
        // Performance optimization
        this.cache = {
            user: null,
            profile: null,
            theme: null
        };
        this.updateInterval = null;
        this.lastUpdate = 0;
        this.pendingUpdates = new Map();
        this.abortController = null;
        
        // Event listeners
        this.authListeners = new Set();
        this.profileObservers = new Set();
        
        // Bound methods for performance
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
        this.debouncedUpdateLastActive = this.debounce(this.updateLastActive.bind(this), 5000);
        
        console.log('Auth: Constructor initialized');
    }

    // ================= INITIALIZATION =================
    async init() {
        if (this.initialized) {
            console.log('Auth: Already initialized');
            return;
        }
        
        const startTime = performance.now();
        
        try {
            console.log('Auth: Initializing advanced system...');
            
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
            
            // Add styles
            this.injectStyles();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup periodic updates
            this.setupPeriodicUpdates();
            
            this.initialized = true;
            
            console.log(`Auth: Initialized in ${performance.now() - startTime}ms`);
            
            // Notify listeners
            this.notifyAuthListeners();
            
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.showToast('Failed to initialize authentication system', 'error');
        }
    }

    async initializeFirebase(retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                if (!firebase.apps.length) {
                    await firebase.initializeApp(this.firebaseConfig);
                    console.log('Auth: Firebase initialized');
                }
                
                this.auth = firebase.auth();
                this.db = firebase.firestore();
                this.storage = firebase.storage();
                
                // Enable persistence with error handling
                try {
                    await this.db.enablePersistence({ 
                        synchronizeTabs: true,
                        experimentalForceOwningTab: true 
                    });
                    console.log('Auth: Firestore persistence enabled');
                } catch (persistenceError) {
                    if (persistenceError.code === 'failed-precondition') {
                        console.warn('Auth: Multiple tabs open - persistence limited');
                    } else if (persistenceError.code === 'unimplemented') {
                        console.warn('Auth: Browser does not support persistence');
                    } else {
                        console.warn('Auth: Persistence error:', persistenceError);
                    }
                }
                
                return;
            } catch (error) {
                console.warn(`Auth: Firebase init attempt ${i + 1} failed:`, error);
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    // ================= THEME MANAGEMENT =================
    detectPageTheme() {
        // Fast detection using cached values
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme;
        
        const bodyClasses = document.body.classList;
        if (bodyClasses.contains('dark-theme') || bodyClasses.contains('dark-mode')) return 'dark';
        if (bodyClasses.contains('light-theme') || bodyClasses.contains('light-mode')) return 'light';
        
        // Check computed style
        const bgColor = window.getComputedStyle(document.body).backgroundColor;
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            return brightness < 128 ? 'dark' : 'light';
        }
        
        // Check system preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    initThemeSystem() {
        // Detect initial theme
        const savedTheme = localStorage.getItem('reverbit_theme');
        const pageTheme = this.detectPageTheme();
        
        this.currentTheme = savedTheme || (this.userProfile?.theme) || 'auto';
        this.applyTheme(true); // Apply without animation on init
        
        // Watch for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
            if (this.currentTheme === 'auto') {
                this.applyTheme();
            }
        });
        
        // Watch for theme class changes on body
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
        document.documentElement.style.setProperty('color-scheme', this.isDarkMode ? 'dark' : 'light');
        
        // Animate transition if not skipping
        if (!skipAnimation && wasDark !== this.isDarkMode) {
            document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
            setTimeout(() => {
                document.documentElement.style.transition = '';
            }, 300);
        }
        
        // Update popup if visible
        if (this.profilePopup?.classList.contains('visible')) {
            this.updatePopupTheme();
        }
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
        if (this.user?.uid) {
            try {
                await this.db.collection('users').doc(this.user.uid).update({
                    theme: this.currentTheme,
                    updatedAt: new Date().toISOString()
                });
                
                if (this.userProfile) {
                    this.userProfile.theme = this.currentTheme;
                }
                
                this.showToast(`Theme set to ${this.currentTheme}`, 'success', 2000);
            } catch (error) {
                console.error('Error saving theme:', error);
            }
        }
    }

    // ================= EVENT LISTENERS =================
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

    handleClickOutside(event) {
        if (!this.profilePopup || !this.profilePopup.classList.contains('visible')) return;
        
        const isPopupClick = this.profilePopup.contains(event.target);
        const isAvatarClick = this.profileAvatar?.contains(event.target);
        
        if (!isPopupClick && !isAvatarClick) {
            this.hideProfilePopup();
        }
    }

    handleKeyDown(event) {
        // ESC to close popup
        if (event.key === 'Escape' && this.profilePopup?.classList.contains('visible')) {
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

    handleResize: this.debounce(() => {
        if (this.profilePopup?.classList.contains('visible')) {
            this.positionPopup();
        }
    }, 100)

    onVisibilityChange() {
        if (document.visibilityState === 'visible' && this.user) {
            this.debouncedUpdateLastActive();
        }
    }

    // ================= AUTH STATE =================
    setupAuthListener() {
        this.auth.onAuthStateChanged(async (user) => {
            const startTime = performance.now();
            
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
                
                await this.loadUserProfile();
                
                // Cache user data
                this.cache.user = { ...this.user };
                this.cache.profile = { ...this.userProfile };
                
                // Add avatar to UI
                this.addOrUpdateProfileAvatar();
                
                // Track login
                await this.trackLogin();
                
                console.log(`Auth: User loaded in ${performance.now() - startTime}ms`);
                
            } else {
                this.user = null;
                this.userProfile = null;
                this.cache = { user: null, profile: null, theme: null };
                
                // Clean up UI
                this.removeProfileAvatar();
                this.hideProfilePopup();
                this.removeFloatingHeader();
            }
            
            this.notifyAuthListeners();
        });
    }

    async checkExistingSession() {
        const cachedUser = localStorage.getItem('reverbit_user');
        const cachedProfile = localStorage.getItem('reverbit_user_profile');
        const savedTheme = localStorage.getItem('reverbit_theme');
        
        if (savedTheme) {
            this.currentTheme = savedTheme;
            this.applyTheme(true);
        }
        
        if (cachedUser && cachedProfile) {
            try {
                this.user = JSON.parse(cachedUser);
                this.userProfile = JSON.parse(cachedProfile);
                this.cache = { user: this.user, profile: this.userProfile, theme: savedTheme };
                
                // Verify session is still valid
                const currentUser = this.auth.currentUser;
                if (currentUser?.uid === this.user.uid) {
                    this.addOrUpdateProfileAvatar();
                } else {
                    this.clearSession();
                }
            } catch (error) {
                console.warn('Auth: Cache invalid, clearing');
                this.clearSession();
            }
        }
    }

    clearSession() {
        localStorage.removeItem('reverbit_user');
        localStorage.removeItem('reverbit_user_uid');
        localStorage.removeItem('reverbit_user_email');
        localStorage.removeItem('reverbit_user_profile');
        
        this.user = null;
        this.userProfile = null;
        this.cache = { user: null, profile: null, theme: null };
        
        this.removeProfileAvatar();
        this.removeFloatingHeader();
    }

    // ================= PROFILE MANAGEMENT =================
    async loadUserProfile() {
        if (!this.user?.uid || !this.db) return;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                this.userProfile.uid = this.user.uid;
                
                // Ensure required fields
                this.ensureProfileFields();
                
            } else {
                await this.createNewProfile(userRef);
            }
            
            // Cache profile
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            this.cache.profile = { ...this.userProfile };
            
        } catch (error) {
            console.error('Profile load error:', error);
            await this.createFallbackProfile();
        }
    }

    async createNewProfile(userRef) {
        const displayName = this.user.displayName || this.user.email?.split('@')[0] || 'User';
        const username = this.generateUsername(displayName);
        const timestamp = new Date().toISOString();
        
        this.userProfile = {
            uid: this.user.uid,
            email: this.user.email,
            displayName,
            username,
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
            preferences: {
                notifications: true,
                emailUpdates: true,
                autoSave: true,
                reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            }
        };
        
        await userRef.set(this.userProfile);
        this.showToast(`Welcome to Reverbit, ${displayName}!`, 'success', 3000);
    }

    async createFallbackProfile() {
        this.userProfile = {
            uid: this.user.uid,
            email: this.user.email,
            displayName: this.user.displayName || 'User',
            photoURL: this.user.photoURL || this.generateAvatarUrl(this.user.displayName || 'User'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            theme: this.currentTheme
        };
        
        localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
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
            preferences: {
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
        
        if (updated && this.user?.uid) {
            this.db.collection('users').doc(this.user.uid).update({
                ...this.userProfile,
                updatedAt: new Date().toISOString()
            }).catch(console.warn);
        }
    }

    generateUsername(displayName) {
        const base = displayName.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 15);
        
        return base.length >= 3 ? base : `user_${Math.random().toString(36).substring(2, 6)}`;
    }

    generateAvatarUrl(name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a73e8&color=fff&bold=true&size=256`;
    }

    // ================= AVATAR UI =================
    addOrUpdateProfileAvatar() {
        // Check existing
        if (this.profileAvatar && this.profileAvatar.isConnected) {
            this.updateProfileAvatar();
            return;
        }
        
        // Find or create container
        let container = document.querySelector('.header-actions, .nav-right, .profile-container');
        
        if (!container) {
            container = this.createFloatingHeader();
        }
        
        // Create avatar
        this.profileAvatar = document.createElement('button');
        this.profileAvatar.className = 'reverbit-profile-avatar';
        this.profileAvatar.setAttribute('aria-label', 'Profile menu');
        this.profileAvatar.setAttribute('title', 'Open profile menu');
        
        // Avatar content
        this.profileAvatar.innerHTML = `
            <div class="avatar-container">
                <img class="avatar-img" alt="Profile" loading="lazy">
                <div class="avatar-status ${this.isVerified() ? 'verified' : ''}">
                    ${this.isVerified() ? '<i class="fas fa-check"></i>' : ''}
                </div>
            </div>
            <div class="avatar-upload-overlay">
                <i class="fas fa-camera"></i>
                <span>Upload</span>
            </div>
            <div class="avatar-loading">
                <div class="spinner"></div>
            </div>
        `;
        
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
            this.profileAvatar.classList.add('hover');
        });
        
        this.profileAvatar.addEventListener('mouseleave', () => {
            this.profileAvatar.classList.remove('hover');
        });
        
        // Context menu
        this.profileAvatar.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e);
        });
        
        // Insert at beginning of container
        container.prepend(this.profileAvatar);
        
        // Create upload input
        this.createUploadInput();
        
        // Update image
        this.updateProfileAvatar();
    }

    createFloatingHeader() {
        // Remove existing
        this.removeFloatingHeader();
        
        const header = document.createElement('div');
        header.className = 'reverbit-floating-header';
        header.innerHTML = `
            <div class="header-actions"></div>
        `;
        
        document.body.appendChild(header);
        return header.querySelector('.header-actions');
    }

    removeFloatingHeader() {
        document.querySelectorAll('.reverbit-floating-header').forEach(el => el.remove());
    }

    createUploadInput() {
        this.avatarUploadInput?.remove();
        
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
        `;
        
        this.avatarUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) await this.uploadProfilePicture(file);
            e.target.value = '';
        });
        
        document.body.appendChild(this.avatarUploadInput);
    }

    updateProfileAvatar() {
        if (!this.profileAvatar || !this.userProfile) return;
        
        const img = this.profileAvatar.querySelector('.avatar-img');
        if (!img) return;
        
        const displayName = this.userProfile.displayName || 'User';
        const photoURL = this.userProfile.photoURL || this.generateAvatarUrl(displayName);
        
        // Add cache buster
        img.src = `${photoURL}${photoURL.includes('?') ? '&' : '?'}t=${Date.now()}`;
        img.alt = `${displayName}'s profile`;
        
        // Handle loading
        img.onload = () => {
            this.profileAvatar.classList.remove('loading');
            this.profileAvatar.classList.add('loaded');
        };
        
        img.onerror = () => {
            img.src = this.generateAvatarUrl(displayName);
            this.profileAvatar.classList.remove('loading');
        };
        
        // Update verification status
        const status = this.profileAvatar.querySelector('.avatar-status');
        if (status) {
            status.className = `avatar-status ${this.isVerified() ? 'verified' : ''}`;
            status.innerHTML = this.isVerified() ? '<i class="fas fa-check"></i>' : '';
        }
    }

    // ================= PROFILE POPUP =================
    createProfilePopup() {
        this.removeProfilePopup();
        
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup';
        this.profilePopup.setAttribute('role', 'dialog');
        this.profilePopup.setAttribute('aria-modal', 'true');
        this.profilePopup.setAttribute('aria-label', 'Profile menu');
        
        // Create backdrop
        this.popupBackdrop = document.createElement('div');
        this.popupBackdrop.className = 'popup-backdrop';
        this.popupBackdrop.addEventListener('click', () => this.hideProfilePopup());
        
        document.body.appendChild(this.popupBackdrop);
        document.body.appendChild(this.profilePopup);
    }

    getPopupHTML() {
        if (!this.userProfile) {
            return `
                <div class="popup-container">
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading profile...</p>
                    </div>
                </div>
            `;
        }
        
        const { displayName, email, photoURL, createdAt, lastActive, streak = 0, totalLogins = 1 } = this.userProfile;
        const verificationLevel = this.getVerificationLevel();
        const isVerified = verificationLevel !== 'none';
        const isPremium = verificationLevel === 'premium';
        const memberDays = this.getMemberDays();
        
        return `
            <div class="popup-container ${this.isDarkMode ? 'dark' : 'light'}">
                <!-- Header with gradient -->
                <div class="popup-header">
                    <div class="header-gradient"></div>
                    <div class="header-content">
                        <button class="close-btn" aria-label="Close" onclick="window.ReverbitAuth?.hideProfilePopup()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Profile content -->
                <div class="popup-content">
                    <!-- Avatar section -->
                    <div class="avatar-section">
                        <div class="avatar-wrapper" id="popup-avatar">
                            <div class="avatar-ring"></div>
                            <div class="avatar-image">
                                <img src="${photoURL || this.generateAvatarUrl(displayName)}" 
                                     alt="${displayName}" 
                                     onerror="this.src='${this.generateAvatarUrl(displayName)}'">
                                <div class="avatar-badge ${isPremium ? 'premium' : ''}">
                                    ${isPremium ? '<i class="fas fa-crown"></i>' : isVerified ? '<i class="fas fa-check"></i>' : ''}
                                </div>
                            </div>
                            <button class="avatar-edit-btn" title="Change photo" onclick="window.ReverbitAuth?.handleAvatarUpload()">
                                <i class="fas fa-camera"></i>
                            </button>
                        </div>
                        
                        <div class="profile-info">
                            <div class="name-section">
                                <h2 class="display-name">${displayName}</h2>
                                ${isVerified ? `
                                    <div class="verified-badge ${isPremium ? 'premium' : ''}">
                                        <i class="fas fa-${isPremium ? 'crown' : 'check-circle'}"></i>
                                        <span>${isPremium ? 'Premium Verified' : 'Verified'}</span>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="email">${email}</div>
                            
                            <div class="profile-stats">
                                <div class="stat-item">
                                    <div class="stat-value">${memberDays}</div>
                                    <div class="stat-label">Days</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${streak}</div>
                                    <div class="stat-label">Streak</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${totalLogins}</div>
                                    <div class="stat-label">Logins</div>
                                </div>
                            </div>
                            
                            <div class="profile-meta">
                                <div class="meta-item">
                                    <i class="fas fa-calendar-alt"></i>
                                    <span>Joined ${this.formatDate(createdAt)}</span>
                                </div>
                                <div class="meta-item">
                                    <i class="fas fa-clock"></i>
                                    <span>Last active ${this.formatRelativeTime(lastActive)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Menu items -->
                    <div class="menu-section">
                        <a href="https://aditya-cmd-max.github.io/dashboard" class="menu-item" target="_blank">
                            <div class="menu-icon"><i class="fas fa-tachometer-alt"></i></div>
                            <div class="menu-content">
                                <div class="menu-title">Dashboard</div>
                                <div class="menu-subtitle">Manage your account</div>
                            </div>
                            <div class="menu-arrow"><i class="fas fa-chevron-right"></i></div>
                        </a>
                        
                        <a href="https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}" class="menu-item" target="_blank">
                            <div class="menu-icon"><i class="fas fa-user"></i></div>
                            <div class="menu-content">
                                <div class="menu-title">Public Profile</div>
                                <div class="menu-subtitle">View your public page</div>
                            </div>
                            <div class="menu-arrow"><i class="fas fa-chevron-right"></i></div>
                        </a>
                        
                        <button class="menu-item" onclick="window.ReverbitAuth?.toggleTheme()">
                            <div class="menu-icon"><i class="fas fa-${this.isDarkMode ? 'sun' : 'moon'}"></i></div>
                            <div class="menu-content">
                                <div class="menu-title">Theme</div>
                                <div class="menu-subtitle">${this.currentTheme === 'auto' ? 'Auto' : this.currentTheme === 'dark' ? 'Dark' : 'Light'} mode</div>
                            </div>
                            <div class="menu-arrow theme-indicator">
                                <span class="theme-dot ${this.isDarkMode ? 'dark' : 'light'}"></span>
                            </div>
                        </button>
                        
                        <button class="menu-item" onclick="window.ReverbitAuth?.showSettings()">
                            <div class="menu-icon"><i class="fas fa-cog"></i></div>
                            <div class="menu-content">
                                <div class="menu-title">Settings</div>
                                <div class="menu-subtitle">Preferences & privacy</div>
                            </div>
                            <div class="menu-arrow"><i class="fas fa-chevron-right"></i></div>
                        </button>
                        
                        <div class="menu-divider"></div>
                        
                        <button class="menu-item logout" onclick="window.ReverbitAuth?.logout()">
                            <div class="menu-icon"><i class="fas fa-sign-out-alt"></i></div>
                            <div class="menu-content">
                                <div class="menu-title">Sign Out</div>
                                <div class="menu-subtitle">End your session</div>
                            </div>
                            <div class="menu-arrow"><i class="fas fa-chevron-right"></i></div>
                        </button>
                    </div>
                    
                    <!-- Footer -->
                    <div class="popup-footer">
                        <div class="footer-links">
                            <a href="https://aditya-cmd-max.github.io/reverbit/privacy" target="_blank">Privacy</a>
                            <span>•</span>
                            <a href="https://aditya-cmd-max.github.io/reverbit/terms" target="_blank">Terms</a>
                            <span>•</span>
                            <a href="https://aditya-cmd-max.github.io/reverbit/help" target="_blank">Help</a>
                        </div>
                        <div class="version">v2.0.0</div>
                    </div>
                </div>
            </div>
        `;
    }

    toggleProfilePopup() {
        if (!this.user) {
            this.showToast('Please sign in to access profile', 'info', 3000);
            return;
        }
        
        if (!this.profilePopup) {
            this.createProfilePopup();
        }
        
        if (this.profilePopup.classList.contains('visible')) {
            this.hideProfilePopup();
        } else {
            this.showProfilePopup();
        }
    }

    showProfilePopup() {
        // Update content
        this.profilePopup.innerHTML = this.getPopupHTML();
        
        // Position popup
        this.positionPopup();
        
        // Show with animation
        requestAnimationFrame(() => {
            this.profilePopup.classList.add('visible');
            this.popupBackdrop.classList.add('visible');
        });
        
        // Add popup-specific event listeners
        const closeBtn = this.profilePopup.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideProfilePopup());
        }
        
        // Focus first focusable element
        setTimeout(() => {
            const firstFocusable = this.profilePopup.querySelector('button, a');
            firstFocusable?.focus();
        }, 100);
    }

    hideProfilePopup() {
        if (!this.profilePopup) return;
        
        this.profilePopup.classList.remove('visible');
        this.popupBackdrop?.classList.remove('visible');
        
        setTimeout(() => {
            if (!this.profilePopup?.classList.contains('visible')) {
                this.profilePopup.style.display = 'none';
            }
        }, 300);
    }

    positionPopup() {
        if (!this.profileAvatar || !this.profilePopup) return;
        
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        const popupRect = this.profilePopup.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Calculate position
        let top = avatarRect.bottom + 8;
        let left = avatarRect.left;
        
        // Adjust if off-screen right
        if (left + popupRect.width > viewport.width - 16) {
            left = viewport.width - popupRect.width - 16;
        }
        
        // Adjust if off-screen left
        if (left < 16) {
            left = 16;
        }
        
        // Check if enough space below
        if (top + popupRect.height > viewport.height - 16) {
            // Try above
            if (avatarRect.top - popupRect.height - 8 > 16) {
                top = avatarRect.top - popupRect.height - 8;
            } else {
                // Center vertically
                top = Math.max(16, (viewport.height - popupRect.height) / 2);
            }
        }
        
        // Apply position
        this.profilePopup.style.top = `${top}px`;
        this.profilePopup.style.left = `${left}px`;
    }

    updatePopupTheme() {
        if (!this.profilePopup?.classList.contains('visible')) return;
        
        // Update theme indicator in menu
        const themeBtn = this.profilePopup.querySelector('.menu-item[onclick*="toggleTheme"]');
        if (themeBtn) {
            const icon = themeBtn.querySelector('.menu-icon i');
            const dot = themeBtn.querySelector('.theme-dot');
            const subtitle = themeBtn.querySelector('.menu-subtitle');
            
            if (icon) icon.className = `fas fa-${this.isDarkMode ? 'sun' : 'moon'}`;
            if (dot) dot.className = `theme-dot ${this.isDarkMode ? 'dark' : 'light'}`;
            if (subtitle) subtitle.textContent = this.currentTheme === 'auto' ? 'Auto' : this.isDarkMode ? 'Dark' : 'Light';
        }
    }

    removeProfilePopup() {
        this.profilePopup?.remove();
        this.popupBackdrop?.remove();
        this.profilePopup = null;
        this.popupBackdrop = null;
    }

    // ================= AVATAR UPLOAD =================
    async handleAvatarUpload() {
        if (!this.user) {
            this.showToast('Please sign in to upload photos', 'info', 3000);
            return;
        }
        
        this.avatarUploadInput?.click();
    }

    async uploadProfilePicture(file) {
        if (!file) return;
        
        // Validate
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('Image must be less than 10MB', 'error', 4000);
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error', 4000);
            return;
        }
        
        // Show loading
        this.profileAvatar?.classList.add('uploading');
        this.showToast('Uploading profile picture...', 'info', 0);
        
        try {
            // Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            formData.append('cloud_name', this.cloudinaryConfig.cloudName);
            formData.append('folder', this.cloudinaryConfig.folder);
            
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/upload`,
                { method: 'POST', body: formData }
            );
            
            if (!response.ok) throw new Error('Upload failed');
            
            const result = await response.json();
            
            // Update Firestore
            await this.db.collection('users').doc(this.user.uid).update({
                photoURL: result.secure_url,
                cloudinaryImageId: result.public_id,
                updatedAt: new Date().toISOString()
            });
            
            // Update auth profile
            await this.auth.currentUser.updateProfile({ photoURL: result.secure_url });
            
            // Update local data
            this.user.photoURL = result.secure_url;
            this.userProfile.photoURL = result.secure_url;
            this.userProfile.cloudinaryImageId = result.public_id;
            
            // Cache
            localStorage.setItem('reverbit_user', JSON.stringify(this.user));
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            
            // Update UI
            this.updateProfileAvatar();
            
            // Refresh popup if open
            if (this.profilePopup?.classList.contains('visible')) {
                this.profilePopup.innerHTML = this.getPopupHTML();
                this.positionPopup();
            }
            
            this.showToast('Profile picture updated!', 'success', 3000);
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Failed to upload picture', 'error', 4000);
        } finally {
            this.profileAvatar?.classList.remove('uploading');
        }
    }

    // ================= CONTEXT MENU =================
    showContextMenu(event) {
        const existing = document.querySelector('.avatar-context-menu');
        existing?.remove();
        
        const menu = document.createElement('div');
        menu.className = 'avatar-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            z-index: 10001;
        `;
        
        const items = [
            { icon: 'fa-camera', text: 'Upload Photo', action: () => this.handleAvatarUpload() },
            { icon: 'fa-cog', text: 'Settings', action: () => this.showSettings() },
            { icon: 'fa-sign-out-alt', text: 'Sign Out', action: () => this.logout() }
        ];
        
        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'context-menu-item';
            btn.innerHTML = `
                <i class="fas ${item.icon}"></i>
                <span>${item.text}</span>
            `;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.remove();
                item.action();
            });
            menu.appendChild(btn);
        });
        
        document.body.appendChild(menu);
        
        // Close on click outside
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 100);
        
        // Adjust position
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 8}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 8}px`;
        }
    }

    // ================= SETTINGS =================
    showSettings() {
        // This would open settings panel in dashboard
        window.open('https://aditya-cmd-max.github.io/dashboard#settings', '_blank');
    }

    // ================= VERIFICATION =================
    getVerificationLevel() {
        if (!this.userProfile?.verified) return 'none';
        
        if (this.userProfile.verifiedLevel === 'premium' || this.userProfile.premiumVerified) {
            return 'premium';
        }
        
        return this.userProfile.verifiedLevel || 'basic';
    }

    isVerified() {
        return this.getVerificationLevel() !== 'none';
    }

    // ================= ACTIVITY TRACKING =================
    async trackLogin() {
        if (!this.user?.uid) return;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.update({
                lastLogin: new Date().toISOString(),
                totalLogins: firebase.firestore.FieldValue.increment(1),
                updatedAt: new Date().toISOString()
            });
            
            if (this.userProfile) {
                this.userProfile.lastLogin = new Date().toISOString();
                this.userProfile.totalLogins = (this.userProfile.totalLogins || 0) + 1;
            }
        } catch (error) {
            console.warn('Login tracking error:', error);
        }
    }

    async updateLastActive() {
        if (!this.user?.uid || !document.hidden) return;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.update({
                lastActive: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            if (this.userProfile) {
                this.userProfile.lastActive = new Date().toISOString();
            }
        } catch (error) {
            // Silent fail - non-critical
        }
    }

    async trackUsage(appName, minutes) {
        if (!this.user?.uid || !appName) return;
        
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
            console.warn('Usage tracking error:', error);
            // Requeue failed updates
            updates.forEach(([key, data]) => {
                this.pendingUpdates.set(key, data);
            });
        }
    }

    // ================= PERIODIC UPDATES =================
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

    // ================= UTILITIES =================
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
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            year: 'numeric' 
        });
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
        return Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
    }

    // ================= NOTIFICATIONS =================
    showToast(message, type = 'info', duration = 3000) {
        const existing = document.querySelector('.reverbit-toast');
        existing?.remove();
        
        const toast = document.createElement('div');
        toast.className = `reverbit-toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${icons[type] || icons.info}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close" aria-label="Close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
        
        document.body.appendChild(toast);
        
        // Show with animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Auto hide
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }

    // ================= AUTH LISTENERS =================
    addAuthListener(callback) {
        if (typeof callback === 'function') {
            this.authListeners.add(callback);
            if (this.initialized) {
                callback(this.user, this.userProfile);
            }
        }
    }

    removeAuthListener(callback) {
        this.authListeners.delete(callback);
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

    addProfileObserver(observer) {
        if (observer && typeof observer === 'object') {
            this.profileObservers.add(observer);
        }
    }

    // ================= LOGOUT =================
    async logout() {
        try {
            await this.updateLastActive();
            await this.processPendingUpdates();
            await this.auth.signOut();
            
            this.clearSession();
            this.removeProfilePopup();
            
            this.showToast('Signed out successfully', 'success', 3000);
            
            setTimeout(() => {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            }, 300);
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Error signing out', 'error', 4000);
            return false;
        }
    }

    // ================= STYLES INJECTION =================
    injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) return;
        
        const styles = `
            /* ===== Reverbit Advanced Auth System ===== */
            
            /* Profile Avatar */
            .reverbit-profile-avatar {
                width: 42px;
                height: 42px;
                border-radius: 50%;
                border: 2px solid transparent;
                background: linear-gradient(135deg, #B5651D, #2A9D8F, #C0392B) border-box;
                -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
                mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                overflow: hidden;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .dark-theme .reverbit-profile-avatar {
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            }
            
            .reverbit-profile-avatar:hover {
                transform: scale(1.1) rotate(3deg);
                box-shadow: 0 4px 16px rgba(181, 101, 29, 0.3);
            }
            
            .reverbit-profile-avatar:active {
                transform: scale(0.95);
            }
            
            .reverbit-profile-avatar .avatar-container {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                overflow: hidden;
                position: relative;
                background: linear-gradient(135deg, #f5f5f5, #e8eaed);
            }
            
            .reverbit-profile-avatar .avatar-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            
            .reverbit-profile-avatar:hover .avatar-img {
                transform: scale(1.1);
            }
            
            .reverbit-profile-avatar .avatar-status {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #4caf50;
                border: 2px solid white;
                transition: all 0.3s ease;
                z-index: 2;
            }
            
            .dark-theme .reverbit-profile-avatar .avatar-status {
                border-color: #202124;
            }
            
            .reverbit-profile-avatar .avatar-status.verified {
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 8px;
                animation: verified-pulse 2s infinite;
            }
            
            .reverbit-profile-avatar .avatar-status.verified i {
                font-size: 8px;
            }
            
            .reverbit-profile-avatar .avatar-upload-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
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
                z-index: 3;
            }
            
            .reverbit-profile-avatar .avatar-upload-overlay i {
                font-size: 14px;
                margin-bottom: 2px;
            }
            
            .reverbit-profile-avatar.hover .avatar-upload-overlay {
                opacity: 1;
            }
            
            .reverbit-profile-avatar .avatar-loading {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                border-radius: 50%;
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 4;
                backdrop-filter: blur(2px);
            }
            
            .reverbit-profile-avatar.uploading .avatar-loading {
                display: flex;
            }
            
            .reverbit-profile-avatar .avatar-loading .spinner {
                width: 24px;
                height: 24px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            
            /* Floating Header */
            .reverbit-floating-header {
                position: fixed;
                top: 16px;
                right: 16px;
                z-index: 9998;
                display: flex;
                align-items: center;
                padding: 8px 12px;
                background: rgba(245, 237, 214, 0.85);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(181, 101, 29, 0.2);
                border-radius: 32px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
            }
            
            .dark-theme .reverbit-floating-header {
                background: rgba(26, 18, 8, 0.85);
                border-color: rgba(205, 139, 69, 0.2);
            }
            
            .reverbit-floating-header:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 24px rgba(181, 101, 29, 0.15);
            }
            
            .reverbit-floating-header .header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            /* Profile Popup */
            .reverbit-profile-popup {
                position: fixed;
                min-width: 380px;
                max-width: 420px;
                background: rgba(245, 237, 214, 0.95);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(181, 101, 29, 0.2);
                border-radius: 32px;
                box-shadow: 0 16px 48px rgba(0,0,0,0.15), 0 0 0 1px rgba(181, 101, 29, 0.1);
                z-index: 9999;
                opacity: 0;
                transform: scale(0.95) translateY(-10px);
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                            transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                pointer-events: none;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .dark-theme .reverbit-profile-popup {
                background: rgba(26, 18, 8, 0.95);
                border-color: rgba(205, 139, 69, 0.2);
                box-shadow: 0 16px 48px rgba(0,0,0,0.3);
            }
            
            .reverbit-profile-popup.visible {
                opacity: 1;
                transform: scale(1) translateY(0);
                pointer-events: all;
            }
            
            .popup-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.4);
                backdrop-filter: blur(4px);
                z-index: 9998;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            }
            
            .popup-backdrop.visible {
                opacity: 1;
                pointer-events: all;
            }
            
            .popup-container {
                padding: 0;
                position: relative;
            }
            
            .popup-header {
                position: relative;
                height: 120px;
                overflow: hidden;
                border-radius: 32px 32px 0 0;
            }
            
            .header-gradient {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #B5651D, #2A9D8F, #C0392B);
                animation: gradient-shift 8s ease infinite;
            }
            
            @keyframes gradient-shift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            
            .header-content {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                padding: 16px;
            }
            
            .close-btn {
                float: right;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: none;
                background: rgba(255,255,255,0.2);
                backdrop-filter: blur(4px);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 1px solid rgba(255,255,255,0.3);
            }
            
            .close-btn:hover {
                background: rgba(255,255,255,0.3);
                transform: rotate(90deg) scale(1.1);
            }
            
            .popup-content {
                padding: 24px;
            }
            
            /* Avatar Section */
            .avatar-section {
                display: flex;
                gap: 20px;
                margin-bottom: 24px;
            }
            
            .avatar-wrapper {
                position: relative;
                width: 100px;
                height: 100px;
                flex-shrink: 0;
            }
            
            .avatar-ring {
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                border: 2px solid transparent;
                border-radius: 50%;
                background: linear-gradient(135deg, #B5651D, #2A9D8F, #C0392B) border-box;
                -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
                mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                animation: ring-spin 8s linear infinite;
            }
            
            @keyframes ring-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .avatar-image {
                position: relative;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                overflow: hidden;
                background: linear-gradient(135deg, #f5f5f5, #e8eaed);
                box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            }
            
            .avatar-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            
            .avatar-wrapper:hover .avatar-image img {
                transform: scale(1.1);
            }
            
            .avatar-badge {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                border: 2px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                animation: badge-pulse 2s infinite;
            }
            
            .dark-theme .avatar-badge {
                border-color: #202124;
            }
            
            .avatar-badge.premium {
                background: linear-gradient(135deg, #FFD700, #FFA500);
            }
            
            @keyframes badge-pulse {
                0%, 100% { transform: scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
                50% { transform: scale(1.1); box-shadow: 0 4px 16px rgba(26,115,232,0.4); }
            }
            
            .avatar-edit-btn {
                position: absolute;
                bottom: -4px;
                right: -4px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 2px solid white;
                background: linear-gradient(135deg, #B5651D, #2A9D8F);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                z-index: 3;
                opacity: 0;
                transform: scale(0.8);
            }
            
            .avatar-wrapper:hover .avatar-edit-btn {
                opacity: 1;
                transform: scale(1);
            }
            
            .avatar-edit-btn:hover {
                transform: scale(1.15) rotate(90deg);
                box-shadow: 0 4px 12px rgba(181, 101, 29, 0.4);
            }
            
            .profile-info {
                flex: 1;
            }
            
            .name-section {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 8px;
            }
            
            .display-name {
                font-family: var(--md-font-display, 'Begum', serif);
                font-size: 1.6rem;
                font-weight: 700;
                color: var(--md-on-surface, #1A1208);
                line-height: 1.2;
            }
            
            .dark-theme .display-name {
                color: #F5EDD6;
            }
            
            .verified-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 10px;
                border-radius: 100px;
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                color: white;
                font-size: 0.8rem;
                font-weight: 600;
                box-shadow: 0 2px 8px rgba(26,115,232,0.3);
                animation: verified-pulse 2s infinite;
            }
            
            .verified-badge.premium {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #000;
            }
            
            @keyframes verified-pulse {
                0%, 100% { box-shadow: 0 2px 8px rgba(26,115,232,0.3); }
                50% { box-shadow: 0 4px 16px rgba(26,115,232,0.5); }
            }
            
            .email {
                font-size: 0.95rem;
                color: var(--md-on-surface-variant, #2D2010);
                margin-bottom: 16px;
                opacity: 0.8;
            }
            
            .dark-theme .email {
                color: #D4C49A;
            }
            
            .profile-stats {
                display: flex;
                gap: 16px;
                margin-bottom: 16px;
                padding: 12px;
                background: rgba(181, 101, 29, 0.05);
                border-radius: 24px;
            }
            
            .stat-item {
                flex: 1;
                text-align: center;
            }
            
            .stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--md-primary, #B5651D);
                line-height: 1;
            }
            
            .stat-label {
                font-size: 0.75rem;
                color: var(--md-on-surface-variant, #2D2010);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .dark-theme .stat-label {
                color: #D4C49A;
            }
            
            .profile-meta {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            
            .meta-item {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.85rem;
                color: var(--md-on-surface-variant, #2D2010);
            }
            
            .dark-theme .meta-item {
                color: #D4C49A;
            }
            
            .meta-item i {
                width: 16px;
                color: var(--md-primary, #B5651D);
            }
            
            /* Menu Section */
            .menu-section {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .menu-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 12px 16px;
                border: none;
                background: transparent;
                border-radius: 24px;
                color: var(--md-on-surface, #1A1208);
                text-decoration: none;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                width: 100%;
                text-align: left;
                position: relative;
                overflow: hidden;
            }
            
            .dark-theme .menu-item {
                color: #F5EDD6;
            }
            
            .menu-item::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(181, 101, 29, 0.1);
                transform: translate(-50%, -50%);
                transition: width 0.6s, height 0.6s;
                z-index: -1;
            }
            
            .menu-item:hover::before {
                width: 300%;
                height: 300%;
            }
            
            .menu-item:hover {
                transform: translateX(8px);
                background: rgba(181, 101, 29, 0.05);
            }
            
            .menu-item.logout:hover {
                background: rgba(192, 57, 43, 0.1);
                color: #C0392B;
            }
            
            .menu-icon {
                width: 36px;
                height: 36px;
                border-radius: 12px;
                background: linear-gradient(135deg, rgba(181, 101, 29, 0.1), rgba(42, 157, 143, 0.1));
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--md-primary, #B5651D);
                transition: all 0.3s ease;
            }
            
            .menu-item:hover .menu-icon {
                transform: rotate(5deg) scale(1.1);
            }
            
            .menu-content {
                flex: 1;
            }
            
            .menu-title {
                font-weight: 600;
                margin-bottom: 2px;
            }
            
            .menu-subtitle {
                font-size: 0.8rem;
                opacity: 0.7;
            }
            
            .menu-arrow {
                color: var(--md-primary, #B5651D);
                opacity: 0.5;
                transition: transform 0.3s ease;
            }
            
            .menu-item:hover .menu-arrow {
                transform: translateX(5px);
                opacity: 1;
            }
            
            .theme-indicator {
                display: flex;
                align-items: center;
            }
            
            .theme-dot {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                transition: all 0.3s ease;
            }
            
            .theme-dot.light {
                background: #F5EDD6;
                border: 2px solid #B5651D;
            }
            
            .theme-dot.dark {
                background: #1A1208;
                border: 2px solid #2A9D8F;
            }
            
            .menu-divider {
                height: 1px;
                background: rgba(181, 101, 29, 0.2);
                margin: 8px 0;
            }
            
            /* Footer */
            .popup-footer {
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid rgba(181, 101, 29, 0.2);
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 0.8rem;
            }
            
            .footer-links {
                display: flex;
                gap: 8px;
            }
            
            .footer-links a {
                color: var(--md-on-surface-variant, #2D2010);
                text-decoration: none;
                opacity: 0.7;
                transition: opacity 0.3s ease;
            }
            
            .dark-theme .footer-links a {
                color: #D4C49A;
            }
            
            .footer-links a:hover {
                opacity: 1;
                text-decoration: underline;
            }
            
            .version {
                opacity: 0.5;
            }
            
            /* Loading State */
            .loading-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 48px;
                gap: 16px;
            }
            
            .loading-state .spinner {
                width: 48px;
                height: 48px;
                border: 3px solid rgba(181, 101, 29, 0.1);
                border-top-color: var(--md-primary, #B5651D);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            /* Context Menu */
            .avatar-context-menu {
                position: fixed;
                background: var(--md-surface, #F5EDD6);
                border: 1px solid var(--md-outline, rgba(181,101,29,0.3));
                border-radius: 16px;
                box-shadow: var(--md-elevation-4);
                min-width: 200px;
                overflow: hidden;
                z-index: 10001;
                animation: menu-appear 0.2s ease;
            }
            
            .dark-theme .avatar-context-menu {
                background: #1A1208;
            }
            
            @keyframes menu-appear {
                from {
                    opacity: 0;
                    transform: scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
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
                color: var(--md-on-surface, #1A1208);
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .dark-theme .context-menu-item {
                color: #F5EDD6;
            }
            
            .context-menu-item:hover {
                background: rgba(181, 101, 29, 0.1);
                transform: translateX(4px);
            }
            
            /* Toast Notifications */
            .reverbit-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                min-width: 300px;
                max-width: 500px;
                background: var(--md-surface, #F5EDD6);
                border: 1px solid var(--md-outline, rgba(181,101,29,0.3));
                border-radius: 100px;
                box-shadow: var(--md-elevation-4);
                padding: 12px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                z-index: 10002;
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                backdrop-filter: blur(8px);
            }
            
            .dark-theme .reverbit-toast {
                background: #1A1208;
            }
            
            .reverbit-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
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
            
            .toast-content {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
            }
            
            .toast-content i {
                font-size: 18px;
            }
            
            .toast-close {
                background: none;
                border: none;
                color: var(--md-on-surface-variant, #2D2010);
                cursor: pointer;
                padding: 4px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            
            .dark-theme .toast-close {
                color: #D4C49A;
            }
            
            .toast-close:hover {
                background: rgba(181, 101, 29, 0.1);
                transform: rotate(90deg);
            }
            
            /* Animations */
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Responsive */
            @media (max-width: 640px) {
                .reverbit-profile-popup {
                    position: fixed;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) scale(0.95) !important;
                    width: calc(100vw - 32px);
                    min-width: auto;
                    max-height: 80vh;
                }
                
                .reverbit-profile-popup.visible {
                    transform: translate(-50%, -50%) scale(1) !important;
                }
                
                .avatar-section {
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }
                
                .profile-info {
                    text-align: center;
                }
                
                .name-section {
                    justify-content: center;
                }
                
                .profile-meta {
                    align-items: center;
                }
            }
            
            /* Accessibility */
            .reverbit-profile-avatar:focus-visible,
            .close-btn:focus-visible,
            .menu-item:focus-visible,
            .avatar-edit-btn:focus-visible {
                outline: 2px solid var(--md-primary, #B5651D);
                outline-offset: 2px;
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
        if (!this.user?.uid) return false;
        
        try {
            await this.db.collection('users').doc(this.user.uid).update({
                ...updates,
                updatedAt: new Date().toISOString()
            });
            
            Object.assign(this.userProfile, updates);
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            
            return true;
        } catch (error) {
            console.error('Profile update error:', error);
            return false;
        }
    }
}

// ================= GLOBAL INSTANCE =================
window.ReverbitAuth = new ReverbitAuth();

// Debug helper
window.debugAuth = () => {
    console.log('=== AUTH DEBUG ===');
    console.log('User:', window.ReverbitAuth.getUser());
    console.log('Profile:', window.ReverbitAuth.getUserProfile());
    console.log('Theme:', window.ReverbitAuth.getCurrentTheme());
    console.log('Dark Mode:', window.ReverbitAuth.isDarkModeActive());
    console.log('=== END DEBUG ===');
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Apply initial theme class
    const savedTheme = localStorage.getItem('reverbit_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (savedTheme === 'auto' && systemPrefersDark)) {
        document.documentElement.classList.add('dark-theme');
    }
    
    await window.ReverbitAuth.init();
});

// Storage listener for theme sync
window.addEventListener('storage', (e) => {
    if (e.key === 'reverbit_theme' && window.ReverbitAuth) {
        window.ReverbitAuth.currentTheme = e.newValue || 'auto';
        window.ReverbitAuth.applyTheme();
    }
});

console.log('Reverbit Advanced Auth System v2.0 loaded successfully');
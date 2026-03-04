// ====================================================================
// auth.js 
// Reverbit Innovations by Aditya Jha
// COMPLETE ENTERPRISE AUTHENTICATION SYSTEM
// Version: 3.0.0 - Production Ready
// ====================================================================

class ReverbitAuth {
    constructor() {
        // Firebase Configuration
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
        
        // Cloudinary Configuration
        this.cloudinaryConfig = {
            cloudName: 'dgy9v2ctk',
            uploadPreset: 'reverbit_unsigned11',
            folder: 'reverbit/user'
        };
        
        // Core State
        this.user = null;
        this.userProfile = null;
        this.initialized = false;
        this.initializationPromise = null;
        this.authReady = false;
        this.profileLoadAttempted = false;
        this.profileLoadComplete = false;
        
        // UI Elements
        this.profilePopup = null;
        this.profileAvatar = null;
        this.avatarUploadInput = null;
        this.popupVisible = false;
        
        // Theme Management
        this.currentTheme = 'auto';
        this.isDarkMode = false;
        this.themeObserver = null;
        
        // Listeners
        this.authListeners = [];
        this.profileObservers = [];
        
        // Offline Support
        this.isOnline = navigator.onLine;
        this.offlineQueue = [];
        this.pendingUpdates = new Map();
        
        // Performance Optimization
        this.updateInterval = null;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastSync = null;
        this.profileCache = null;
        
        // Bind Methods
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

    // ==================== INITIALIZATION ====================
    
    async init() {
        // Prevent multiple initializations
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        if (this.initialized) {
            console.log('Auth: Already initialized');
            return Promise.resolve();
        }
        
        this.initializationPromise = this._initialize();
        return this.initializationPromise;
    }

    async _initialize() {
        console.log('Auth: Initializing enterprise authentication system...');
        
        try {
            // Step 1: Load cached profile immediately (critical for speed)
            this._loadCachedProfile();
            
            // Step 2: Initialize Firebase in parallel
            const firebasePromise = this._initFirebase();
            
            // Step 3: Initialize UI elements in parallel
            const uiPromise = this._initUI();
            
            // Wait for Firebase initialization
            await firebasePromise;
            
            // Step 4: Set up auth listener (non-blocking)
            this._setupAuthListener();
            
            // Step 5: Initialize theme system
            this._initThemeSystem();
            
            // Step 6: Set up connectivity listeners
            this._setupConnectivityListeners();
            
            // Step 7: Set up periodic updates
            this._setupPeriodicUpdates();
            
            // Step 8: Wait for UI initialization
            await uiPromise;
            
            this.initialized = true;
            console.log('Auth: Enterprise initialization complete');
            
            // Step 9: Process offline queue
            this._processOfflineQueue();
            
            // Step 10: Notify listeners
            this._notifyAuthListeners();
            
        } catch (error) {
            console.error('Auth: Initialization error:', error);
            this._handleInitializationError(error);
        } finally {
            this.initializationPromise = null;
        }
    }

    _loadCachedProfile() {
        // CRITICAL: Load from cache immediately for instant UI
        try {
            const cachedUser = localStorage.getItem('reverbit_user');
            const cachedProfile = localStorage.getItem('reverbit_user_profile');
            
            if (cachedUser) {
                this.user = JSON.parse(cachedUser);
                console.log('Auth: Loaded user from cache:', this.user.email);
            }
            
            if (cachedProfile) {
                this.userProfile = JSON.parse(cachedProfile);
                this.profileCache = {
                    data: this.userProfile,
                    timestamp: Date.now()
                };
                console.log('Auth: Loaded profile from cache');
                
                // Show avatar immediately
                setTimeout(() => this.addOrUpdateProfileAvatar(), 10);
            }
        } catch (error) {
            console.warn('Auth: Failed to load cached profile:', error);
        }
    }

    async _initFirebase() {
        // Initialize Firebase with retry logic
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(this.firebaseConfig);
                    console.log('Auth: Firebase initialized');
                }
                
                this.auth = firebase.auth();
                this.db = firebase.firestore();
                
                // Optimize Firestore settings
                this.db.settings({
                    timestampsInSnapshots: true,
                    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
                });
                
                // Enable persistence (non-critical, don't await)
                this.db.enablePersistence({ 
                    synchronizeTabs: true,
                    experimentalForceOwningTab: true 
                }).catch(err => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Auth: Multiple tabs open, persistence disabled');
                    } else if (err.code === 'unimplemented') {
                        console.warn('Auth: Browser does not support persistence');
                    }
                });
                
                // Success
                return;
                
            } catch (error) {
                retryCount++;
                console.warn(`Auth: Firebase init attempt ${retryCount} failed:`, error);
                
                if (retryCount === maxRetries) {
                    throw new Error(`Failed to initialize Firebase after ${maxRetries} attempts`);
                }
                
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            }
        }
    }

    async _initUI() {
        // Create avatar upload input
        this._createAvatarUploadInput();
        
        // Inject styles (non-critical)
        this._injectStyles();
        
        // Initialize Cloudinary widget
        this._initCloudinaryWidget();
    }

    // ==================== AUTH STATE MANAGEMENT ====================

    _setupAuthListener() {
        console.log('Auth: Setting up auth state listener...');
        
        this.auth.onAuthStateChanged(async (user) => {
            console.log('Auth: Auth state changed -', user ? 'User logged in' : 'User logged out');
            
            if (user) {
                await this._handleUserLogin(user);
            } else {
                this._handleUserLogout();
            }
            
            this._notifyAuthListeners();
            this.authReady = true;
        });
    }

    async _handleUserLogin(user) {
        // Update user object
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
        
        // Cache user immediately
        this._cacheUserData();
        
        console.log('Auth: User authenticated:', this.user.email);
        
        // Load profile in parallel with UI updates
        this._loadUserProfile().catch(error => {
            console.error('Auth: Profile load error (handled gracefully):', error);
            this._createFallbackProfile();
        });
        
        // Show avatar immediately (from cache)
        this.addOrUpdateProfileAvatar();
        
        // Track login in background
        this._trackLogin().catch(() => {});
        
        // Update last active
        this._updateLastActive().catch(() => {});
        
        // Check email verification
        if (!user.emailVerified) {
            this._checkEmailVerification();
        }
    }

    _handleUserLogout() {
        this.user = null;
        this.userProfile = null;
        this.profileLoadComplete = false;
        this.profileLoadAttempted = false;
        
        this._clearSession();
        this.removeProfileAvatar();
        this.removeProfilePopup();
        
        this.currentTheme = 'auto';
        this.applyTheme();
    }

    async _loadUserProfile() {
        if (!this.user || !this.db) {
            throw new Error('Cannot load profile - no user or database');
        }
        
        // Prevent multiple simultaneous loads
        if (this.profileLoadAttempted) {
            console.log('Auth: Profile load already in progress');
            return;
        }
        
        this.profileLoadAttempted = true;
        
        try {
            console.log('Auth: Loading profile from Firestore...');
            
            // Set timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Profile load timeout')), 5000);
            });
            
            const profilePromise = this.db.collection('users').doc(this.user.uid).get();
            
            const userDoc = await Promise.race([profilePromise, timeoutPromise]);
            
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                this.userProfile.uid = this.user.uid;
                console.log('Auth: Loaded profile from Firestore');
                
                // Ensure all fields exist
                await this._ensureProfileFields(userDoc.ref).catch(() => {});
                
                // Update cache
                this._cacheUserProfile();
                this.profileLoadComplete = true;
                
                // Update UI
                this.updateProfileAvatar();
                
                return;
            } else {
                console.log('Auth: No profile found, creating new one');
                await this._createNewProfile(this.user);
            }
            
        } catch (error) {
            console.error('Auth: Profile load failed:', error);
            
            // If we have cached profile, use it
            if (this.userProfile) {
                console.log('Auth: Using cached profile');
                this.profileLoadComplete = true;
                return;
            }
            
            // Create fallback profile
            this._createFallbackProfile();
            
            throw error; // Re-throw for error handling
        } finally {
            this.profileLoadAttempted = false;
        }
    }

    _createFallbackProfile() {
        // Create a minimal profile in memory so UI doesn't break
        this.userProfile = {
            uid: this.user.uid,
            email: this.user.email,
            displayName: this.user.displayName,
            username: this._generateUsername(this.user.displayName || 'User', this.user.email),
            photoURL: this.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user.displayName || 'User')}&background=B5651D&color=fff&bold=true&size=400`,
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            theme: this.currentTheme || 'auto',
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
            lastLogin: new Date(),
            lastActive: new Date(),
            preferences: {
                notifications: true,
                emailUpdates: true,
                autoSave: true,
                darkMode: this.isDarkMode,
                language: 'en',
                privacyMode: false
            },
            emailVerified: this.user.emailVerified,
            provider: this.user.providerId || 'password'
        };
        
        console.log('Auth: Created fallback profile');
        this._cacheUserProfile();
        this.profileLoadComplete = true;
        
        // Try to create real profile in background
        this._createNewProfile(this.user).catch(err => {
            console.warn('Auth: Background profile creation failed:', err);
        });
    }

    async _createNewProfile(user, userRef = null) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        const username = this._generateUsername(displayName, user.email);
        const now = firebase.firestore.Timestamp.now();
        
        // Complete profile with ALL required fields
        const userProfile = {
            // Core fields
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            username: username,
            photoURL: user.photoURL || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=B5651D&color=fff&bold=true&size=400`,
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
            platform: this._getPlatform(),
            userAgent: navigator.userAgent
        };
        
        console.log('Auth: Creating profile:', displayName);
        
        // Update in-memory profile immediately
        this.userProfile = userProfile;
        this._cacheUserProfile();
        this.profileLoadComplete = true;
        
        // Update UI
        this.updateProfileAvatar();
        
        // Save to Firestore in background (don't await)
        const savePromise = userRef ? 
            userRef.set(userProfile) : 
            this.db.collection('users').doc(user.uid).set(userProfile);
        
        savePromise.then(() => {
            console.log('Auth: Profile saved to Firestore');
            
            // Create usage record
            return this.db.collection('usage').doc(user.uid).set({
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
        }).then(() => {
            console.log('Auth: Usage record created');
        }).catch(error => {
            console.warn('Auth: Background save failed:', error);
        });
        
        // Show welcome message
        setTimeout(() => {
            this.showToast(`Welcome to Reverbit, ${displayName}!`, 'success');
        }, 1000);
    }

    async _ensureProfileFields(userRef) {
        if (!this.userProfile) return;
        
        const requiredFields = {
            displayName: this.user.displayName || this.user.email?.split('@')[0] || 'User',
            username: this._generateUsername(this.userProfile.displayName || 'User', this.user.email),
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
            this._cacheUserProfile();
            console.log('Auth: Added missing fields:', Object.keys(updates));
        }
    }

    // ==================== CACHE MANAGEMENT ====================

    _cacheUserData() {
        if (this.user) {
            localStorage.setItem('reverbit_user', JSON.stringify(this.user));
            localStorage.setItem('reverbit_user_uid', this.user.uid);
            localStorage.setItem('reverbit_user_email', this.user.email);
        }
    }

    _cacheUserProfile() {
        if (this.userProfile) {
            localStorage.setItem('reverbit_user_profile', JSON.stringify(this.userProfile));
            this.profileCache = {
                data: this.userProfile,
                timestamp: Date.now()
            };
        }
    }

    _clearSession() {
        localStorage.removeItem('reverbit_user');
        localStorage.removeItem('reverbit_user_uid');
        localStorage.removeItem('reverbit_user_email');
        localStorage.removeItem('reverbit_user_profile');
        localStorage.removeItem('reverbit_auth');
        
        document.cookie = 'reverbit_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.aditya-cmd-max.github.io';
    }

    // ==================== PROFILE AVATAR UI ====================

    addOrUpdateProfileAvatar() {
        console.log('Auth: Managing profile avatar UI...');
        
        // Check if avatar already exists
        const existingAvatar = document.querySelector('.reverbit-profile-avatar');
        if (existingAvatar) {
            this.profileAvatar = existingAvatar;
            this._updateProfileAvatar();
            console.log('Auth: Updated existing avatar');
            return;
        }
        
        // Find or create header actions container
        let headerActions = this._findOrCreateHeaderActions();
        
        if (!headerActions) {
            this._createFloatingHeader();
            headerActions = document.querySelector('.reverbit-floating-header .header-actions');
        }
        
        if (headerActions) {
            this._createAvatarButton(headerActions);
            console.log('Auth: Avatar UI setup complete');
        }
    }

    _findOrCreateHeaderActions() {
        // Try to find existing header actions
        let headerActions = document.querySelector('.header-actions');
        
        if (!headerActions) {
            // Try to find common header elements
            const header = document.querySelector(
                '.app-header, header, .header, nav.navbar, [role="banner"], .top-header, .main-header'
            );
            
            if (header) {
                headerActions = document.createElement('div');
                headerActions.className = 'header-actions';
                header.appendChild(headerActions);
            }
        }
        
        return headerActions;
    }

    _createFloatingHeader() {
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
            background: ${this.isDarkMode ? 'rgba(26, 18, 8, 0.95)' : 'rgba(245, 237, 214, 0.95)'};
            backdrop-filter: blur(10px);
            border-radius: 20px;
            border: 1px solid rgba(181, 101, 29, 0.2);
            box-shadow: 0 4px 20px rgba(26, 18, 8, 0.15);
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
    }

    _createAvatarButton(container) {
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
        avatarImg.loading = 'eager'; // Critical for speed
        avatarImg.fetchPriority = 'high';
        
        avatarContainer.appendChild(avatarImg);
        
        // Add verification badge if needed
        if (this._isVerified()) {
            const badgeDiv = document.createElement('div');
            badgeDiv.className = `avatar-verified-badge ${this._getVerificationLevel() === 'premium' ? 'premium' : ''}`;
            badgeDiv.innerHTML = `<i class="fas fa-${this._getVerificationLevel() === 'premium' ? 'crown' : 'check'}"></i>`;
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
        loadingSpinner.innerHTML = `<div class="spinner"></div>`;
        loadingSpinner.style.display = 'none';
        
        this.profileAvatar.appendChild(avatarContainer);
        this.profileAvatar.appendChild(uploadOverlay);
        this.profileAvatar.appendChild(loadingSpinner);
        
        // Event handlers
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
            this._showAvatarContextMenu(e);
        });
        
        if (container.firstChild) {
            container.insertBefore(this.profileAvatar, container.firstChild);
        } else {
            container.appendChild(this.profileAvatar);
        }
        
        this._updateProfileAvatar();
    }

    _createAvatarUploadInput() {
        if (this.avatarUploadInput && this.avatarUploadInput.parentNode) {
            return;
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

    _updateProfileAvatar() {
        if (!this.profileAvatar) return;
        
        const avatarImg = this.profileAvatar.querySelector('.reverbit-avatar-img');
        if (!avatarImg) return;
        
        // Get display name with fallbacks
        const displayName = this.userProfile?.displayName || this.user?.displayName || 'User';
        
        // Get photo URL with multiple fallbacks
        let photoURL = this.userProfile?.photoURL || this.user?.photoURL;
        
        if (!photoURL || photoURL.includes('undefined') || photoURL.includes('null')) {
            photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=B5651D&color=fff&bold=true&size=256`;
        }
        
        // Add cache busting to prevent stale images
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
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=B5651D&color=fff&bold=true`;
            this.profileAvatar.classList.remove('loading');
        };
        
        this.profileAvatar.classList.add('loading');
        this._updateAvatarVerificationBadge();
    }

    _updateAvatarVerificationBadge() {
        const avatarContainer = this.profileAvatar.querySelector('.reverbit-avatar-container');
        if (!avatarContainer) return;
        
        const existingBadge = avatarContainer.querySelector('.avatar-verified-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        if (this._isVerified()) {
            const badgeDiv = document.createElement('div');
            badgeDiv.className = `avatar-verified-badge ${this._getVerificationLevel() === 'premium' ? 'premium' : ''}`;
            badgeDiv.innerHTML = `<i class="fas fa-${this._getVerificationLevel() === 'premium' ? 'crown' : 'check'}"></i>`;
            avatarContainer.appendChild(badgeDiv);
        }
    }

    // ==================== PROFILE POPUP ====================

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
            z-index: 10000;
        `;
        
        this.profilePopup.innerHTML = this._getPopupHTML();
        
        document.body.appendChild(this.profilePopup);
        
        setTimeout(() => {
            this._attachPopupEventListeners();
        }, 10);
    }

    _getPopupHTML() {
        // Get values with fallbacks
        const displayName = this.userProfile?.displayName || this.user?.displayName || 'User';
        const email = this.userProfile?.email || this.user?.email || '';
        const photoURL = this.userProfile?.photoURL || this.user?.photoURL || 
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=B5651D&color=fff&bold=true`;
        const profileUrl = `https://aditya-cmd-max.github.io/profile/?id=${this.user?.uid || ''}`;
        const dashboardUrl = 'https://aditya-cmd-max.github.io/dashboard';
        
        const verificationLevel = this._getVerificationLevel();
        const isVerified = verificationLevel !== 'none';
        const verificationBadge = isVerified ? this._getVerificationBadgeHTML() : '';
        
        const streak = this.userProfile?.streak || 0;
        const streakDisplay = streak > 0 ? `<span class="streak-badge">${streak} day${streak !== 1 ? 's' : ''}</span>` : '';
        
        const verifiedStatus = isVerified ? 
            (verificationLevel === 'premium' ? 
                '<span class="verified-status premium">Premium Verified</span>' : 
                '<span class="verified-status">Verified</span>') : 
            '';
        
        const emailVerifiedBadge = this.user?.emailVerified ? 
            '<span class="email-verified-badge" title="Email Verified"><i class="fas fa-check-circle"></i></span>' : 
            '<span class="email-unverified-badge" title="Email Not Verified"><i class="fas fa-exclamation-circle"></i></span>';
        
        return `
            <div class="profile-popup-container">
                <div class="profile-header">
                    <div class="profile-avatar-large" id="profile-avatar-large" role="button" tabindex="0" aria-label="Upload profile picture">
                        <div class="avatar-container">
                            <img src="${photoURL}" alt="${displayName}" 
                                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=B5651D&color=fff&bold=true'">
                            ${this._getAvatarBadgeHTML()}
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
                                Joined ${this._formatDate(this.userProfile?.createdAt)}
                            </span>
                            <span class="meta-item">
                                <i class="fas fa-clock"></i>
                                Last active ${this._formatRelativeTime(this.userProfile?.lastActive)}
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
                            <div class="stat-number">${this.userProfile?.totalLogins || 1}</div>
                            <div class="stat-label">Logins</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${streak}</div>
                            <div class="stat-label">Streak</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${this._getMemberDays()}</div>
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

    _attachPopupEventListeners() {
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
        
        // Refresh popup content
        this.profilePopup.innerHTML = this._getPopupHTML();
        this._attachPopupEventListeners();
        
        this.profilePopup.style.display = 'block';
        this.profilePopup.style.visibility = 'hidden';
        this.profilePopup.style.opacity = '0';
        
        const avatarRect = this.profileAvatar.getBoundingClientRect();
        this.profilePopup.style.visibility = 'visible';
        
        // Force reflow
        this.profilePopup.offsetHeight;
        
        const popupRect = this.profilePopup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let top, left;
        
        // Responsive positioning
        if (viewportWidth <= 640) {
            // Center on mobile
            top = (viewportHeight - popupRect.height) / 2;
            left = (viewportWidth - popupRect.width) / 2;
        } else {
            // Position near avatar on desktop
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
        
        // Animate in
        setTimeout(() => {
            this.profilePopup.style.opacity = '1';
            this.profilePopup.style.transform = 'scale(1)';
            this.popupVisible = true;
            
            const firstButton = this.profilePopup.querySelector('button, a');
            if (firstButton) firstButton.focus();
        }, 10);
        
        this._addPopupBackdrop();
    }

    hideProfilePopup() {
        if (!this.profilePopup) return;
        
        this.profilePopup.style.opacity = '0';
        this.profilePopup.style.transform = 'scale(0.95)';
        this.popupVisible = false;
        
        setTimeout(() => {
            this.profilePopup.style.display = 'none';
            this._removePopupBackdrop();
        }, 200);
    }

    _addPopupBackdrop() {
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

    _removePopupBackdrop() {
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
        if (!this.profilePopup || !this.profileAvatar || !this.popupVisible) return;
        
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
        
        this._removePopupBackdrop();
        document.removeEventListener('click', this.handleClickOutside);
        this.popupVisible = false;
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

    _showAvatarContextMenu(event) {
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
            background: ${this.isDarkMode ? '#1A1208' : '#F5EDD6'};
            border: 1px solid rgba(181, 101, 29, 0.2);
            border-radius: 20px;
            box-shadow: 0 4px 20px rgba(26, 18, 8, 0.15);
            z-index: 10001;
            min-width: 180px;
            overflow: hidden;
        `;
        
        const menuItems = [
            { icon: 'fa-upload', text: 'Upload Photo', action: () => this.handleAvatarUpload() },
            { icon: 'fa-camera', text: 'Take Photo', action: () => this._takePhoto() },
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
                color: ${this.isDarkMode ? '#F5EDD6' : '#1A1208'};
                font-family: 'Outfit', sans-serif;
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
                menuItem.style.backgroundColor = this.isDarkMode ? '#2D2010' : '#EDE0C0';
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
        
        // Ensure menu stays within viewport
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

    // ==================== AVATAR UPLOAD ====================

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

    async _takePhoto() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showToast('Camera access not supported', 'error');
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this._showCameraInterface(stream);
        } catch (error) {
            console.error('Camera error:', error);
            this.showToast('Camera access denied', 'error');
        }
    }

    _showCameraInterface(stream) {
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
            background: #B5651D;
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
            this._showUploadingState(true);
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
            console.log('Auth: Cloudinary upload successful');
            
            const photoURL = result.secure_url;
            const cloudinaryImageId = result.public_id;
            
            // Update in-memory profile immediately
            this.user.photoURL = photoURL;
            if (this.userProfile) {
                this.userProfile.photoURL = photoURL;
                this.userProfile.cloudinaryImageId = cloudinaryImageId;
                this.userProfile.updatedAt = new Date().toISOString();
                this._cacheUserProfile();
            }
            
            this._cacheUserData();
            this._updateProfileAvatar();
            
            // Update Firestore in background
            this.db.collection('users').doc(this.user.uid).update({
                photoURL: photoURL,
                cloudinaryImageId: cloudinaryImageId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.warn('Auth: Failed to update Firestore:', err));
            
            // Update Firebase Auth profile
            await this.auth.currentUser.updateProfile({ photoURL });
            
            // Update popup if open
            if (this.profilePopup && this.popupVisible) {
                this.profilePopup.innerHTML = this._getPopupHTML();
                this._attachPopupEventListeners();
            }
            
            this.showToast('Profile picture updated!', 'success');
            
        } catch (error) {
            console.error('Auth: Upload failed:', error);
            this.showToast('Failed to upload picture', 'error');
        } finally {
            this._showUploadingState(false);
        }
    }

    _showUploadingState(show) {
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

    // ==================== ACTIVITY TRACKING ====================

    async _trackLogin() {
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
                this._cacheUserProfile();
            }
            
            await this._updateStreak();
            
            // Create activity in background
            this.db.collection('activity').add({
                userId: this.user.uid,
                type: 'login',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    platform: this._getPlatform(),
                    userAgent: navigator.userAgent
                }
            }).catch(() => {});
            
        } catch (error) {
            console.error('Auth: Login tracking error:', error);
        }
    }

    async _updateLastActive() {
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

    async _updateStreak() {
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
                    this._cacheUserProfile();
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

    // ==================== THEME MANAGEMENT ====================

    _initThemeSystem() {
        console.log('Auth: Initializing theme system...');
        
        const savedTheme = localStorage.getItem('reverbit_theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (savedTheme === 'auto' && systemPrefersDark)) {
            this.currentTheme = savedTheme || 'auto';
            this.isDarkMode = true;
        } else if (savedTheme === 'light') {
            this.currentTheme = 'light';
            this.isDarkMode = false;
        } else {
            this.currentTheme = 'auto';
            this.isDarkMode = systemPrefersDark;
        }
        
        this.applyTheme();
        this._setupThemeObserver();
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.isDarkMode = e.matches;
                this.applyTheme();
            }
        });
    }

    _setupThemeObserver() {
        this.themeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme')) {
                    this.applyTheme();
                }
            });
        });
        
        const config = { attributes: true, attributeFilter: ['class', 'data-theme'] };
        this.themeObserver.observe(document.body, config);
        this.themeObserver.observe(document.documentElement, config);
    }

    applyTheme() {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (this.currentTheme === 'auto') {
            this.isDarkMode = systemDark;
        } else {
            this.isDarkMode = this.currentTheme === 'dark';
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
            this._updatePopupTheme();
        }
        
        this._notifyThemeObservers();
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
                    this._cacheUserProfile();
                }
                
                this.showToast(`Theme set to ${this.currentTheme}`, 'success');
            } catch (error) {
                console.error('Error saving theme preference:', error);
                this._addToOfflineQueue('updateProfile', {
                    uid: this.user.uid,
                    updates: { theme: this.currentTheme }
                });
            }
        }
        
        if (this.profilePopup && this.profilePopup.style.display === 'block') {
            this._updatePopupTheme();
        }
    }

    _updatePopupTheme() {
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

    _notifyThemeObservers() {
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

    // ==================== VERIFICATION HELPERS ====================

    _getVerificationLevel() {
        if (!this.userProfile?.verified && !this.userProfile?.verifiedLevel) return 'none';
        
        if (this.userProfile.verifiedLevel === 'premium' || this.userProfile.premiumVerified) {
            return 'premium';
        }
        
        if (this.userProfile.verifiedLevel === 'basic' || this.userProfile.verified) {
            return 'basic';
        }
        
        return 'none';
    }

    _isVerified() {
        return this._getVerificationLevel() !== 'none';
    }

    _isPremium() {
        return this._getVerificationLevel() === 'premium';
    }

    _getVerificationBadgeHTML(level = null) {
        const verificationLevel = level || this._getVerificationLevel();
        
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

    _getAvatarBadgeHTML() {
        const verificationLevel = this._getVerificationLevel();
        
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

    // ==================== UTILITY FUNCTIONS ====================

    _generateUsername(displayName, email) {
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

    _getPlatform() {
        const ua = navigator.userAgent;
        if (ua.includes('Win')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return 'Unknown';
    }

    _formatDate(date) {
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

    _formatRelativeTime(date) {
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
            
            return this._formatDate(date);
        } catch {
            return 'Recently';
        }
    }

    _getMemberDays() {
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

    // ==================== PUBLIC API ====================

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

    async updateUserProfile(updates) {
        if (!this.user || !this.db) return false;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            Object.assign(this.userProfile, updates, { updatedAt: new Date().toISOString() });
            this._cacheUserProfile();
            
            this._notifyAuthListeners();
            
            return true;
        } catch (error) {
            console.error('Auth: Profile update error:', error);
            this._addToOfflineQueue('updateProfile', {
                uid: this.user.uid,
                updates: updates
            });
            return false;
        }
    }

    async generateProfileLink() {
        if (this.user) {
            return `https://aditya-cmd-max.github.io/profile/?id=${this.user.uid}`;
        }
        
        return null;
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

    async logout() {
        try {
            console.log('Auth: Logging out...');
            
            await this._updateLastActive();
            
            // Clear cookies
            document.cookie = 'reverbit_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.aditya-cmd-max.github.io';
            
            await this.auth.signOut();
            
            this._clearSession();
            
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

    // ==================== INITIALIZATION HELPERS ====================

    _initCloudinaryWidget() {
        if (!window.cloudinary) {
            const script = document.createElement('script');
            script.src = 'https://upload-widget.cloudinary.com/global/all.js';
            script.async = true;
            script.onload = () => console.log('Auth: Cloudinary widget loaded');
            script.onerror = (error) => console.error('Auth: Failed to load Cloudinary:', error);
            document.head.appendChild(script);
        }
    }

    _setupConnectivityListeners() {
        window.addEventListener('online', this.handleOnlineStatus);
        window.addEventListener('offline', this.handleOnlineStatus);
    }

    handleOnlineStatus() {
        this.isOnline = navigator.onLine;
        if (this.isOnline) {
            console.log('Auth: Back online, processing queue...');
            this._processOfflineQueue();
            if (this.user) {
                this._syncUserData();
            }
        } else {
            console.log('Auth: Offline mode activated');
            this.showToast('You are offline. Changes will sync when connection returns.', 'warning');
        }
    }

    async _syncUserData() {
        if (!this.user || !this.db) return;
        
        try {
            const userDoc = await this.db.collection('users').doc(this.user.uid).get();
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
                this._cacheUserProfile();
                this._updateProfileAvatar();
                this._notifyAuthListeners();
            }
        } catch (error) {
            console.error('Auth: Sync error:', error);
            this._addToOfflineQueue('syncUserData', { uid: this.user.uid });
        }
    }

    _addToOfflineQueue(operation, data) {
        this.offlineQueue.push({ operation, data, timestamp: Date.now() });
        localStorage.setItem('reverbit_offline_queue', JSON.stringify(this.offlineQueue));
    }

    async _processOfflineQueue() {
        if (!this.isOnline || this.offlineQueue.length === 0) return;
        
        console.log('Auth: Processing offline queue with', this.offlineQueue.length, 'items');
        
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        localStorage.removeItem('reverbit_offline_queue');
        
        for (const item of queue) {
            try {
                await this._processOfflineItem(item);
            } catch (error) {
                console.error('Auth: Failed to process offline item:', error);
                this.offlineQueue.push(item);
            }
        }
        
        if (this.offlineQueue.length > 0) {
            localStorage.setItem('reverbit_offline_queue', JSON.stringify(this.offlineQueue));
        }
    }

    async _processOfflineItem(item) {
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
                await this._syncUserData();
                break;
            default:
                console.warn('Auth: Unknown offline operation:', item.operation);
        }
    }

    _checkEmailVerification() {
        const checkInterval = setInterval(async () => {
            if (!this.user) {
                clearInterval(checkInterval);
                return;
            }
            
            await this.user.reload();
            if (this.user.emailVerified) {
                clearInterval(checkInterval);
                this.showToast('Email verified successfully!', 'success');
                
                if (this.db) {
                    this.db.collection('users').doc(this.user.uid).update({
                        emailVerified: true,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(() => {});
                }
                
                if (this.userProfile) {
                    this.userProfile.emailVerified = true;
                    this._cacheUserProfile();
                }
            }
        }, 5000);
        
        setTimeout(() => clearInterval(checkInterval), 300000);
    }

    _setupPeriodicUpdates() {
        this.updateInterval = setInterval(() => {
            if (this.user && document.visibilityState === 'visible') {
                this._updateLastActive();
            }
        }, 5 * 60 * 1000);
    }

    _notifyAuthListeners() {
        this.authListeners.forEach(callback => {
            try {
                callback(this.user, this.userProfile);
            } catch (error) {
                console.error('Auth listener error:', error);
            }
        });
    }

    _handleInitializationError(error) {
        console.error('Auth initialization error:', error);
        this.showToast('Authentication system failed to initialize. Please refresh the page.', 'error');
        
        // Show fallback UI
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

    // ==================== STYLES INJECTION ====================

    _injectStyles() {
        if (document.getElementById('reverbit-auth-styles')) {
            return;
        }
        
        const styles = `
            /* Reverbit Enterprise Auth System Styles */
            
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
                border-color: rgba(181, 101, 29, 0.5);
            }
            
            .reverbit-profile-avatar:focus-visible {
                outline: 2px solid #B5651D;
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
                border-color: #1A1208;
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
            
            .email-verified-badge {
                color: #2A9D8F;
                font-size: 14px;
            }
            
            .email-unverified-badge {
                color: #C0392B;
                font-size: 14px;
            }
            
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
            
            .reverbit-profile-avatar:focus-visible,
            .profile-menu-item:focus-visible,
            .change-avatar-btn:focus-visible {
                outline: 2px solid #B5651D;
                outline-offset: 2px;
            }
            
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
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-auth-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
        
        console.log('Auth: Enterprise styles injected');
    }
}

// ==================== GLOBAL INSTANCE ====================

window.ReverbitAuth = new ReverbitAuth();

// ==================== DEBUG FUNCTIONS ====================

window.debugAuth = function() {
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

// ==================== AUTO-INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Reverbit Auth: Page loaded, initializing...');
        
        // Set initial theme from localStorage
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
        
        console.log('Reverbit Auth: Initialization complete');
        
    } catch (error) {
        console.error('Reverbit Auth: Initialization failed:', error);
    }
});

// ==================== STORAGE LISTENER ====================

window.addEventListener('storage', (e) => {
    if (e.key === 'reverbit_theme') {
        window.ReverbitAuth.currentTheme = e.newValue || 'auto';
        window.ReverbitAuth.applyTheme();
    }
});

// ==================== GLOBAL ACCESS ====================

window.auth = window.ReverbitAuth;

console.log('✅ Reverbit Enterprise Auth System loaded successfully');

// auth.js - Enhanced Professional Google-style Profile System with Verification Badges
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

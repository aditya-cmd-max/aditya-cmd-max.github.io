// auth.js - Enhanced with profile features
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
        
        this.user = null;
        this.userProfile = null;
        this.initialized = false;
        this.profilePopup = null;
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
            
            // Check for existing session
            await this.checkSession();
            
            // Create profile popup
            this.createProfilePopup();
            
            this.initialized = true;
        } catch (error) {
            console.error('Auth initialization error:', error);
        }
    }

    async checkSession() {
        try {
            // Check localStorage first
            const userData = localStorage.getItem('reverbit_user');
            const authToken = localStorage.getItem('reverbit_auth');
            
            if (userData && authToken) {
                this.user = JSON.parse(userData);
                await this.loadUserProfile();
                return this.user;
            }
            
            // Check Firebase auth state
            return new Promise((resolve) => {
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
                        localStorage.setItem('reverbit_auth', 'true');
                        
                        // Update profile popup
                        this.updateProfilePopup();
                        
                        resolve(this.user);
                    } else {
                        resolve(null);
                    }
                });
            });
        } catch (error) {
            console.error('Session check error:', error);
            return null;
        }
    }

    async loadUserProfile() {
        if (!this.user) return;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                this.userProfile = userDoc.data();
            } else {
                // Create user profile if it doesn't exist
                this.userProfile = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: this.user.displayName || 'User',
                    photoURL: this.user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.user.email || 'User') + '&background=1a73e8&color=fff',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    theme: 'default',
                    preferences: {}
                };
                
                await userRef.set(this.userProfile);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async updateProfile(data) {
        if (!this.user || !this.userProfile) return false;
        
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            await userRef.set({
                ...data,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            // Update local profile
            this.userProfile = { ...this.userProfile, ...data };
            this.user = { ...this.user, ...data };
            localStorage.setItem('reverbit_user', JSON.stringify(this.user));
            
            // Update popup
            this.updateProfilePopup();
            
            return true;
        } catch (error) {
            console.error('Error updating profile:', error);
            return false;
        }
    }

    async uploadProfilePicture(file) {
        if (!this.user) return null;
        
        try {
            // Create storage reference
            const storageRef = this.storage.ref();
            const profilePicRef = storageRef.child(`profile-pictures/${this.user.uid}/${Date.now()}_${file.name}`);
            
            // Upload file
            await profilePicRef.put(file);
            
            // Get download URL
            const downloadURL = await profilePicRef.getDownloadURL();
            
            // Update user profile with new photo URL
            await this.updateProfile({
                photoURL: downloadURL,
                profilePictureUpdatedAt: new Date().toISOString()
            });
            
            // Update auth user
            await this.auth.currentUser.updateProfile({
                photoURL: downloadURL
            });
            
            return downloadURL;
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            return null;
        }
    }

    createProfilePopup() {
        // Create profile popup element
        this.profilePopup = document.createElement('div');
        this.profilePopup.className = 'reverbit-profile-popup';
        this.profilePopup.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            background: var(--md-surface, #ffffff);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            border: 1px solid var(--md-outline, #e0e0e0);
            padding: 16px;
            min-width: 280px;
            z-index: 1000;
            display: none;
            flex-direction: column;
            gap: 12px;
        `;
        
        // Add to body
        document.body.appendChild(this.profilePopup);
    }

    updateProfilePopup() {
        if (!this.profilePopup || !this.userProfile) return;
        
        const isDarkTheme = document.body.classList.contains('dark-theme');
        const darkModeStyles = isDarkTheme ? `
            background: var(--md-surface, #202124) !important;
            color: var(--md-on-surface, #ffffff) !important;
            border-color: var(--md-outline, #3c4043) !important;
        ` : '';
        
        this.profilePopup.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--md-outline, #e0e0e0); ${darkModeStyles}">
                <img src="${this.userProfile.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.userProfile.displayName || 'User') + '&background=1a73e8&color=fff'}" 
                     alt="Profile" 
                     style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid var(--md-primary, #1a73e8);">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 16px; color: var(--md-on-surface, #202124);">${this.userProfile.displayName || 'User'}</div>
                    <div style="font-size: 14px; color: var(--md-on-surface-variant, #5f6368);">${this.userProfile.email || ''}</div>
                </div>
                <button id="profile-edit-btn" style="background: none; border: none; color: var(--md-primary, #1a73e8); cursor: pointer; padding: 4px; border-radius: 4px;">
                    <span class="material-icons-round" style="font-size: 20px;">edit</span>
                </button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button class="profile-menu-item" onclick="window.location.href='https://aditya-cmd-max.github.io/dashboard'" style="display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 10px; border-radius: 8px; cursor: pointer; color: var(--md-on-surface, #202124); text-align: left; width: 100%; transition: background 0.2s;">
                    <span class="material-icons-round" style="font-size: 20px; color: var(--md-primary, #1a73e8);">dashboard</span>
                    <span>Dashboard</span>
                </button>
                
                <button class="profile-menu-item" onclick="window.ReverbitAuth.logout()" style="display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 10px; border-radius: 8px; cursor: pointer; color: var(--md-error, #d93025); text-align: left; width: 100%; transition: background 0.2s;">
                    <span class="material-icons-round" style="font-size: 20px;">logout</span>
                    <span>Logout</span>
                </button>
            </div>
        `;
        
        // Add hover styles
        const style = document.createElement('style');
        style.textContent = `
            .profile-menu-item:hover {
                background: var(--md-surface-variant, #f8f9fa) !important;
            }
            .dark-theme .profile-menu-item:hover {
                background: var(--md-surface-variant, #303134) !important;
            }
        `;
        document.head.appendChild(style);
        
        // Add edit button event listener
        setTimeout(() => {
            const editBtn = document.getElementById('profile-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    window.location.href = 'https://aditya-cmd-max.github.io/dashboard';
                });
            }
        }, 100);
    }

    toggleProfilePopup() {
        if (!this.profilePopup) return;
        
        const isVisible = this.profilePopup.style.display === 'flex';
        
        // Close all other popups
        document.querySelectorAll('.reverbit-profile-popup').forEach(popup => {
            popup.style.display = 'none';
        });
        
        if (!isVisible) {
            this.profilePopup.style.display = 'flex';
            
            // Position the popup
            const profileAvatar = document.querySelector('.reverbit-profile-avatar');
            if (profileAvatar) {
                const rect = profileAvatar.getBoundingClientRect();
                this.profilePopup.style.top = (rect.bottom + window.scrollY) + 'px';
                this.profilePopup.style.right = (window.innerWidth - rect.right) + 'px';
            }
            
            // Close on outside click
            setTimeout(() => {
                document.addEventListener('click', this.closeProfilePopupOnClick.bind(this));
            }, 100);
        } else {
            this.profilePopup.style.display = 'none';
            document.removeEventListener('click', this.closeProfilePopupOnClick.bind(this));
        }
    }

    closeProfilePopupOnClick(event) {
        if (!this.profilePopup.contains(event.target) && 
            !event.target.closest('.reverbit-profile-avatar')) {
            this.profilePopup.style.display = 'none';
            document.removeEventListener('click', this.closeProfilePopupOnClick.bind(this));
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

    async logout() {
        try {
            await this.auth.signOut();
            localStorage.removeItem('reverbit_user');
            localStorage.removeItem('reverbit_auth');
            document.cookie = 'reverbit_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            this.user = null;
            this.userProfile = null;
            
            // Remove profile popup
            if (this.profilePopup && this.profilePopup.parentNode) {
                this.profilePopup.parentNode.removeChild(this.profilePopup);
            }
            
            // Redirect to sign in page or reload current page
            if (window.location.pathname.includes('/dashboard') || 
                window.location.pathname.includes('/profile')) {
                window.location.href = 'https://aditya-cmd-max.github.io/signin';
            } else {
                window.location.reload();
            }
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
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
            
            // Update streak
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
                    // Reset streak if missed a day
                    await userRef.set({
                        streak: 1,
                        lastActive: new Date().toISOString()
                    }, { merge: true });
                } else if (lastActive.getTime() < today.getTime()) {
                    // Increment streak
                    await userRef.set({
                        streak: (userData.streak || 0) + 1,
                        lastActive: new Date().toISOString()
                    }, { merge: true });
                }
            }
        } catch (error) {
            console.error('Streak update error:', error);
        }
    }
}

// Create global instance
window.ReverbitAuth = new ReverbitAuth();

// Auto-initialize
document.addEventListener('DOMContentLoaded', async () => {
    await window.ReverbitAuth.init().then(async () => {
        const user = window.ReverbitAuth.getUser();
        if (user) {
            // Add profile avatar to navbar if element exists
            await addProfileAvatarToNavbar();
            
            // Track usage for current app
            const appName = getCurrentAppName();
            if (appName) {
                // Initial tracking
                window.ReverbitAuth.trackUsage(appName, 1);
                
                // Track every 5 minutes
                setInterval(() => {
                    window.ReverbitAuth.trackUsage(appName, 5);
                }, 5 * 60 * 1000);
            }
        }
    });
});

// Function to add profile avatar to navbar
async function addProfileAvatarToNavbar() {
    const user = window.ReverbitAuth.getUser();
    if (!user) return;
    
    // Find header actions container
    let headerActions = document.querySelector('.header-actions');
    
    // If header actions doesn't exist, create it
    if (!headerActions) {
        const header = document.querySelector('.app-header');
        if (!header) return;
        
        headerActions = document.createElement('div');
        headerActions.className = 'header-actions';
        header.appendChild(headerActions);
    }
    
    // Check if profile avatar already exists
    if (document.querySelector('.reverbit-profile-avatar')) return;
    
    // Create profile avatar
    const profileAvatar = document.createElement('button');
    profileAvatar.className = 'reverbit-profile-avatar';
    profileAvatar.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid var(--md-primary, #1a73e8);
        cursor: pointer;
        background: none;
        padding: 0;
        transition: transform 0.2s;
    `;
    
    // Add hover effect
    profileAvatar.onmouseenter = () => {
        profileAvatar.style.transform = 'scale(1.1)';
    };
    profileAvatar.onmouseleave = () => {
        profileAvatar.style.transform = 'scale(1)';
    };
    
    // Add click event to toggle profile popup
    profileAvatar.onclick = (e) => {
        e.stopPropagation();
        window.ReverbitAuth.toggleProfilePopup();
    };
    
    // Set profile image
    const profileImage = document.createElement('img');
    profileImage.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
    `;
    profileImage.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || 'User')}&background=1a73e8&color=fff`;
    profileImage.alt = 'Profile';
    
    profileAvatar.appendChild(profileImage);
    
    // Insert profile avatar at the beginning of header actions
    headerActions.insertBefore(profileAvatar, headerActions.firstChild);
    
    // Update profile popup with user data
    window.ReverbitAuth.updateProfilePopup();
}

function getCurrentAppName() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    if (pathname.includes('cloverai') || document.title.includes('Clover AI')) return 'cloverAI';
    if (pathname.includes('mindscribe') || document.title.includes('MindScribe')) return 'mindscribe';
    if (pathname.includes('peo') || document.title.includes('Peo')) return 'peo';
    if (pathname.includes('reverbit') || document.title.includes('Reverbit')) return 'reverbit';
    
    // Default to hostname
    return hostname;
}

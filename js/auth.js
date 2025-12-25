// auth.js - Include this in all Reverbit products
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
        this.initialized = false;
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
            
            // Check for existing session
            await this.checkSession();
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
                return this.user;
            }
            
            // Check Firebase auth state
            return new Promise((resolve) => {
                this.auth.onAuthStateChanged((user) => {
                    if (user) {
                        this.user = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL
                        };
                        localStorage.setItem('reverbit_user', JSON.stringify(this.user));
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

    isAuthenticated() {
        return this.user !== null;
    }

    getUser() {
        return this.user;
    }

    async logout() {
        try {
            await this.auth.signOut();
            localStorage.removeItem('reverbit_user');
            localStorage.removeItem('reverbit_auth');
            document.cookie = 'reverbit_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            this.user = null;
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
document.addEventListener('DOMContentLoaded', () => {
    window.ReverbitAuth.init().then(() => {
        // Add user info to page if authenticated
        const user = window.ReverbitAuth.getUser();
        if (user) {
            // Add user avatar to navbar if element exists
            const userAvatar = document.getElementById('userAvatar');
            if (userAvatar && user.photoURL) {
                userAvatar.src = user.photoURL;
            }
            
            // Track usage for current app
            const appName = getCurrentAppName();
            if (appName) {
                // Track every 5 minutes
                setInterval(() => {
                    window.ReverbitAuth.trackUsage(appName, 5);
                }, 5 * 60 * 1000);
            }
        }
    });
});

function getCurrentAppName() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    if (pathname.includes('cloverai')) return 'cloverAI';
    if (pathname.includes('mindscribe')) return 'mindscribe';
    if (pathname.includes('Peo')) return 'peo';
    
    return null;
}

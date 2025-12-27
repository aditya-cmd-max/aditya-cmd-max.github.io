// handle.js - Handle System for Reverbit
class ReverbitHandleSystem {
    constructor() {
        this.db = null; // Will be set when initialized
        this.handles = {};
        this.reservedHandles = [
            'admin', 'administrator', 'system', 'root',
            'support', 'help', 'info', 'contact',
            'reverbit', 'clover', 'mindscribe', 'peo',
            'null', 'undefined', 'home', 'dashboard',
            'profile', 'settings', 'account', 'user',
            'api', 'auth', 'login', 'signin', 'signup',
            'logout', 'register', 'privacy', 'terms',
            'about', 'contact', 'blog', 'news'
        ];
    }

    // Initialize with Firebase instance
    init(firebase) {
        if (firebase && firebase.firestore) {
            this.db = firebase.firestore();
            return true;
        }
        return false;
    }

    // Validate handle
    validateHandle(handle) {
        if (!handle) return { valid: false, error: 'Handle is required' };
        
        // Check length
        if (handle.length < 3) {
            return { valid: false, error: 'Handle must be at least 3 characters' };
        }
        if (handle.length > 20) {
            return { valid: false, error: 'Handle must be 20 characters or less' };
        }
        
        // Check format (only letters, numbers, underscores)
        const handleRegex = /^[a-zA-Z0-9_]+$/;
        if (!handleRegex.test(handle)) {
            return { valid: false, error: 'Handle can only contain letters, numbers, and underscores' };
        }
        
        // Check if starts with number
        if (/^[0-9]/.test(handle)) {
            return { valid: false, error: 'Handle cannot start with a number' };
        }
        
        // Check if reserved
        if (this.reservedHandles.includes(handle.toLowerCase())) {
            return { valid: false, error: 'This handle is reserved' };
        }
        
        // Check for inappropriate handles (basic check)
        const inappropriate = ['admin', 'mod', 'owner', 'support', 'staff'];
        if (inappropriate.includes(handle.toLowerCase())) {
            return { valid: false, error: 'This handle is not available' };
        }
        
        return { valid: true, error: null };
    }

    // Check if handle is available
    async isHandleAvailable(handle) {
        try {
            if (!this.db) {
                return { available: false, error: 'Database not initialized. Please wait...' };
            }
            
            const validation = this.validateHandle(handle);
            if (!validation.valid) {
                return { available: false, error: validation.error };
            }
            
            // Check in handles collection
            const handleDoc = await this.db.collection('handles').doc(handle.toLowerCase()).get();
            if (handleDoc.exists) {
                return { available: false, error: 'This handle is already taken' };
            }
            
            return { available: true, error: null };
            
        } catch (error) {
            console.error('Error checking handle availability:', error);
            return { available: false, error: 'Error checking handle availability' };
        }
    }

    // Claim a handle for a user
    async claimHandle(userId, handle, displayName = null) {
        try {
            if (!this.db) {
                return { success: false, error: 'Database not initialized' };
            }
            
            const validation = this.validateHandle(handle);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }
            
            const lowercaseHandle = handle.toLowerCase();
            
            // Check availability
            const availability = await this.isHandleAvailable(handle);
            if (!availability.available) {
                return { success: false, error: availability.error };
            }
            
            // Create handle document
            await this.db.collection('handles').doc(lowercaseHandle).set({
                userId: userId,
                handle: handle,
                lowercaseHandle: lowercaseHandle,
                displayName: displayName,
                claimedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            // Create public profile entry
            await this.db.collection('publicProfiles').doc(lowercaseHandle).set({
                userId: userId,
                handle: handle,
                displayName: displayName,
                isPublic: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            // Update user document with handle
            await this.db.collection('users').doc(userId).update({
                handle: handle,
                lowercaseHandle: lowercaseHandle,
                updatedAt: new Date().toISOString()
            });
            
            return { success: true, handle: handle, error: null };
            
        } catch (error) {
            console.error('Error claiming handle:', error);
            return { success: false, error: 'Error claiming handle: ' + error.message };
        }
    }

    // Get user by handle
    async getUserByHandle(handle) {
        try {
            if (!this.db) {
                return { success: false, error: 'Database not initialized', user: null };
            }
            
            const lowercaseHandle = handle.toLowerCase();
            
            // Get handle document
            const handleDoc = await this.db.collection('handles').doc(lowercaseHandle).get();
            if (!handleDoc.exists) {
                return { success: false, error: 'Handle not found', user: null };
            }
            
            const handleData = handleDoc.data();
            
            // Get user document
            const userDoc = await this.db.collection('users').doc(handleData.userId).get();
            if (!userDoc.exists) {
                return { success: false, error: 'User not found', user: null };
            }
            
            const userData = userDoc.data();
            return { 
                success: true, 
                error: null, 
                user: { ...userData, uid: handleData.userId },
                handle: handleData.handle
            };
            
        } catch (error) {
            console.error('Error getting user by handle:', error);
            return { success: false, error: 'Error finding user', user: null };
        }
    }

    // Update handle (change handle) - FIXED VERSION
    async updateHandle(userId, newHandle, displayName = null) {
        try {
            if (!this.db) {
                return { success: false, error: 'Database not initialized' };
            }
            
            // Get current user data
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                return { success: false, error: 'User not found' };
            }
            
            const userData = userDoc.data();
            const oldHandle = userData.handle;
            
            // Don't update if it's the same handle
            if (oldHandle && oldHandle.toLowerCase() === newHandle.toLowerCase()) {
                return { success: false, error: 'This is already your handle' };
            }
            
            // Check if new handle is available
            const availability = await this.isHandleAvailable(newHandle);
            if (!availability.available) {
                return { success: false, error: availability.error };
            }
            
            // Delete old handle entry if exists
            if (oldHandle) {
                try {
                    // Delete old handle
                    const oldHandleRef = this.db.collection('handles').doc(oldHandle.toLowerCase());
                    const oldHandleDoc = await oldHandleRef.get();
                    if (oldHandleDoc.exists) {
                        await oldHandleRef.delete();
                    }
                    
                    // Delete old public profile
                    const oldProfileRef = this.db.collection('publicProfiles').doc(oldHandle.toLowerCase());
                    const oldProfileDoc = await oldProfileRef.get();
                    if (oldProfileDoc.exists) {
                        await oldProfileRef.delete();
                    }
                } catch (error) {
                    console.warn('Error deleting old handle:', error);
                    // Continue anyway
                }
            }
            
            // Create new handle document
            const lowercaseHandle = newHandle.toLowerCase();
            
            await this.db.collection('handles').doc(lowercaseHandle).set({
                userId: userId,
                handle: newHandle,
                lowercaseHandle: lowercaseHandle,
                displayName: displayName || userData.displayName,
                claimedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            // Create new public profile entry
            await this.db.collection('publicProfiles').doc(lowercaseHandle).set({
                userId: userId,
                handle: newHandle,
                displayName: displayName || userData.displayName,
                photoURL: userData.photoURL,
                isPublic: userData.isPublic || false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            // Update user document with new handle
            await this.db.collection('users').doc(userId).update({
                handle: newHandle,
                lowercaseHandle: lowercaseHandle,
                updatedAt: new Date().toISOString()
            });
            
            return { success: true, handle: newHandle, error: null };
            
        } catch (error) {
            console.error('Error updating handle:', error);
            return { success: false, error: 'Error updating handle: ' + error.message };
        }
    }

    // Release handle (when user deletes account)
    async releaseHandle(handle) {
        try {
            if (!this.db) {
                return { success: false, error: 'Database not initialized' };
            }
            
            const lowercaseHandle = handle.toLowerCase();
            
            // Delete handle document
            await this.db.collection('handles').doc(lowercaseHandle).delete();
            
            // Delete public profile
            await this.db.collection('publicProfiles').doc(lowercaseHandle).delete();
            
            return { success: true, error: null };
            
        } catch (error) {
            console.error('Error releasing handle:', error);
            return { success: false, error: 'Error releasing handle' };
        }
    }

    // Generate suggested handles
    generateSuggestions(baseName, count = 5) {
        const suggestions = [];
        const base = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (base.length < 3) {
            return [];
        }
        
        // Add number variations
        for (let i = 1; i <= Math.min(count, 5); i++) {
            suggestions.push(`${base}${i}`);
        }
        
        // Add underscore variations
        suggestions.push(`${base}_`);
        suggestions.push(`_${base}`);
        
        // Add year
        const year = new Date().getFullYear().toString().slice(-2);
        suggestions.push(`${base}${year}`);
        
        // Remove duplicates and keep only count
        return [...new Set(suggestions)].slice(0, count);
    }

    // Format handle for display
    formatHandle(handle) {
        return `@${handle}`;
    }

    // Extract handle from URL or string
    extractHandle(input) {
        if (!input) return null;
        
        // Remove @ symbol if present
        let handle = input.replace(/^@/, '');
        
        // Convert to lowercase for lookup
        handle = handle.toLowerCase();
        
        return handle;
    }

    // Get profile URL by handle
    getProfileUrl(handle) {
        if (!handle) return null;
        return `https://aditya-cmd-max.github.io/profile/@${handle}`;
    }
}

// Create global instance
window.ReverbitHandleSystem = new ReverbitHandleSystem();

// handle.js - Handle System for Reverbit
// Version: 2.0 - Fixed and Enhanced
class ReverbitHandleSystem {
    constructor() {
        this.db = null; // Will be set when initialized
        this.handles = {};
        this.reservedHandles = [
            'admin', 'administrator', 'system', 'root',
            'support', 'help', 'info', 'contact',
            'clover', 'mindscribe', 'peo',
            'null', 'undefined', 'home', 'dashboard',
            'profile', 'settings', 'account', 'user',
            'api', 'auth', 'login', 'signin', 'signup',
            'logout', 'register', 'privacy', 'terms',
            'about', 'contact', 'blog', 'news',
            'mod', 'moderator', 'owner', 'staff',
            'test', 'demo', 'example', 'guest'
        ];
        
        // Cache for frequent queries
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
    }

    // Initialize with Firebase instance
    init(firebase) {
        console.log('Handle System: Initializing...');
        if (firebase && firebase.firestore) {
            this.db = firebase.firestore();
            console.log('Handle System: Initialized successfully');
            return true;
        }
        console.error('Handle System: Failed to initialize - Firebase not found');
        return false;
    }

    // Validate handle
    validateHandle(handle) {
        console.log('Handle System: Validating handle:', handle);
        
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
        const inappropriate = ['admin', 'mod', 'owner', 'support', 'staff', 'fuck', 'shit', 'ass'];
        if (inappropriate.includes(handle.toLowerCase())) {
            return { valid: false, error: 'This handle is not available' };
        }
        
        // Check for common patterns
        if (handle.toLowerCase().includes('reverbit')) {
            return { valid: false, error: 'Handle cannot contain "reverbit"' };
        }
        
        return { valid: true, error: null };
    }

    // Check if handle is available
    async isHandleAvailable(handle) {
        console.log('Handle System: Checking availability for handle:', handle);
        
        try {
            if (!this.db) {
                console.error('Handle System: Database not initialized');
                return { available: false, error: 'Database not initialized. Please wait...' };
            }
            
            const validation = this.validateHandle(handle);
            if (!validation.valid) {
                return { available: false, error: validation.error };
            }
            
            const lowercaseHandle = handle.toLowerCase();
            
            // Check cache first
            const cacheKey = `available_${lowercaseHandle}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('Handle System: Using cached result for', lowercaseHandle);
                return cached.result;
            }
            
            // Check in handles collection
            console.log('Handle System: Querying Firestore for handle:', lowercaseHandle);
            const handleDoc = await this.db.collection('handles').doc(lowercaseHandle).get();
            
            if (handleDoc.exists) {
                console.log('Handle System: Handle already exists:', lowercaseHandle);
                const result = { available: false, error: 'This handle is already taken' };
                this.cache.set(cacheKey, { result, timestamp: Date.now() });
                return result;
            }
            
            console.log('Handle System: Handle is available:', lowercaseHandle);
            const result = { available: true, error: null };
            this.cache.set(cacheKey, { result, timestamp: Date.now() });
            return result;
            
        } catch (error) {
            console.error('Handle System: Error checking handle availability:', error);
            return { available: false, error: 'Error checking handle availability: ' + error.message };
        }
    }

    // Claim a handle for a user
    async claimHandle(userId, handle, displayName = null) {
        console.log('Handle System: Claiming handle for user:', userId, 'handle:', handle);
        
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
            
            // Create handle document with transaction for safety
            const handleRef = this.db.collection('handles').doc(lowercaseHandle);
            
            await this.db.runTransaction(async (transaction) => {
                const handleDoc = await transaction.get(handleRef);
                if (handleDoc.exists) {
                    throw new Error('Handle was just taken by another user');
                }
                
                // Create handle document
                transaction.set(handleRef, {
                    userId: userId,
                    handle: handle,
                    lowercaseHandle: lowercaseHandle,
                    displayName: displayName,
                    claimedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                // Create public profile entry
                const publicProfileRef = this.db.collection('publicProfiles').doc(lowercaseHandle);
                transaction.set(publicProfileRef, {
                    userId: userId,
                    handle: handle,
                    displayName: displayName,
                    isPublic: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                // Update user document with handle
                const userRef = this.db.collection('users').doc(userId);
                transaction.update(userRef, {
                    handle: handle,
                    lowercaseHandle: lowercaseHandle,
                    updatedAt: new Date().toISOString()
                });
            });
            
            // Clear cache for this handle
            this.cache.delete(`available_${lowercaseHandle}`);
            
            console.log('Handle System: Successfully claimed handle:', handle);
            return { success: true, handle: handle, error: null };
            
        } catch (error) {
            console.error('Handle System: Error claiming handle:', error);
            return { success: false, error: 'Error claiming handle: ' + error.message };
        }
    }

    // Get user by handle
    async getUserByHandle(handle) {
        console.log('Handle System: Getting user by handle:', handle);
        
        try {
            if (!this.db) {
                console.error('Handle System: Database not initialized');
                return { success: false, error: 'Database not initialized', user: null };
            }
            
            const lowercaseHandle = handle.toLowerCase();
            
            // Check cache first
            const cacheKey = `user_${lowercaseHandle}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('Handle System: Using cached user for handle:', lowercaseHandle);
                return cached.result;
            }
            
            // Get handle document
            console.log('Handle System: Querying handle document:', lowercaseHandle);
            const handleDoc = await this.db.collection('handles').doc(lowercaseHandle).get();
            
            if (!handleDoc.exists) {
                console.log('Handle System: Handle not found:', lowercaseHandle);
                return { success: false, error: 'Handle not found', user: null };
            }
            
            const handleData = handleDoc.data();
            console.log('Handle System: Found handle data:', handleData);
            
            // Get user document
            const userDoc = await this.db.collection('users').doc(handleData.userId).get();
            
            if (!userDoc.exists) {
                console.error('Handle System: User not found for handle:', handleData.userId);
                return { success: false, error: 'User not found', user: null };
            }
            
            const userData = userDoc.data();
            const result = { 
                success: true, 
                error: null, 
                user: { 
                    ...userData, 
                    uid: handleData.userId,
                    handle: handleData.handle,
                    displayName: handleData.displayName || userData.displayName
                },
                handle: handleData.handle
            };
            
            // Cache the result
            this.cache.set(cacheKey, { result, timestamp: Date.now() });
            
            console.log('Handle System: Successfully retrieved user:', userData.displayName);
            return result;
            
        } catch (error) {
            console.error('Handle System: Error getting user by handle:', error);
            return { success: false, error: 'Error finding user: ' + error.message, user: null };
        }
    }

    // Update handle (change handle) - COMPLETELY FIXED VERSION
    async updateHandle(userId, newHandle, displayName = null) {
        console.log('Handle System: Updating handle for user:', userId, 'new handle:', newHandle);
        
        try {
            if (!this.db) {
                return { success: false, error: 'Database not initialized' };
            }
            
            // Get current user data
            const userRef = this.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                return { success: false, error: 'User not found' };
            }
            
            const userData = userDoc.data();
            const oldHandle = userData.handle;
            const oldLowercaseHandle = oldHandle ? oldHandle.toLowerCase() : null;
            
            // Don't update if it's the same handle
            if (oldHandle && oldLowercaseHandle === newHandle.toLowerCase()) {
                return { success: false, error: 'This is already your handle' };
            }
            
            // Check if new handle is available
            const availability = await this.isHandleAvailable(newHandle);
            if (!availability.available) {
                return { success: false, error: availability.error };
            }
            
            const lowercaseHandle = newHandle.toLowerCase();
            
            // Use transaction to ensure atomic update
            await this.db.runTransaction(async (transaction) => {
                // Get new handle doc to ensure it's still available
                const newHandleRef = this.db.collection('handles').doc(lowercaseHandle);
                const newHandleDoc = await transaction.get(newHandleRef);
                
                if (newHandleDoc.exists) {
                    throw new Error('Handle was just taken by another user');
                }
                
                // Delete old handle entry if exists
                if (oldHandle && oldLowercaseHandle) {
                    const oldHandleRef = this.db.collection('handles').doc(oldLowercaseHandle);
                    const oldHandleDoc = await transaction.get(oldHandleRef);
                    
                    if (oldHandleDoc.exists && oldHandleDoc.data().userId === userId) {
                        transaction.delete(oldHandleRef);
                    }
                    
                    // Delete old public profile
                    const oldProfileRef = this.db.collection('publicProfiles').doc(oldLowercaseHandle);
                    const oldProfileDoc = await transaction.get(oldProfileRef);
                    
                    if (oldProfileDoc.exists && oldProfileDoc.data().userId === userId) {
                        transaction.delete(oldProfileRef);
                    }
                }
                
                // Create new handle document
                transaction.set(newHandleRef, {
                    userId: userId,
                    handle: newHandle,
                    lowercaseHandle: lowercaseHandle,
                    displayName: displayName || userData.displayName,
                    claimedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                // Create new public profile entry
                const newProfileRef = this.db.collection('publicProfiles').doc(lowercaseHandle);
                transaction.set(newProfileRef, {
                    userId: userId,
                    handle: newHandle,
                    displayName: displayName || userData.displayName,
                    photoURL: userData.photoURL,
                    isPublic: userData.isPublic || false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                // Update user document with new handle
                transaction.update(userRef, {
                    handle: newHandle,
                    lowercaseHandle: lowercaseHandle,
                    updatedAt: new Date().toISOString()
                });
            });
            
            // Clear cache entries
            if (oldLowercaseHandle) {
                this.cache.delete(`available_${oldLowercaseHandle}`);
                this.cache.delete(`user_${oldLowercaseHandle}`);
            }
            this.cache.delete(`available_${lowercaseHandle}`);
            this.cache.delete(`user_${lowercaseHandle}`);
            
            console.log('Handle System: Successfully updated handle to:', newHandle);
            return { success: true, handle: newHandle, error: null };
            
        } catch (error) {
            console.error('Handle System: Error updating handle:', error);
            return { success: false, error: 'Error updating handle: ' + error.message };
        }
    }

    // Get multiple users by handles
    async getUsersByHandles(handles) {
        console.log('Handle System: Getting users by handles:', handles);
        
        try {
            if (!this.db || !handles || !Array.isArray(handles)) {
                return { success: false, error: 'Invalid parameters', users: [] };
            }
            
            const results = [];
            const lowercaseHandles = handles.map(h => h.toLowerCase());
            
            // Batch get handle documents
            const handlePromises = lowercaseHandles.map(async (handle) => {
                return this.getUserByHandle(handle);
            });
            
            const handleResults = await Promise.all(handlePromises);
            
            // Filter successful results
            handleResults.forEach(result => {
                if (result.success && result.user) {
                    results.push(result.user);
                }
            });
            
            return { success: true, users: results, error: null };
            
        } catch (error) {
            console.error('Handle System: Error getting users by handles:', error);
            return { success: false, error: 'Error fetching users', users: [] };
        }
    }

    // Release handle (when user deletes account)
    async releaseHandle(handle) {
        console.log('Handle System: Releasing handle:', handle);
        
        try {
            if (!this.db) {
                return { success: false, error: 'Database not initialized' };
            }
            
            const lowercaseHandle = handle.toLowerCase();
            
            // Get handle document to verify ownership
            const handleDoc = await this.db.collection('handles').doc(lowercaseHandle).get();
            
            if (!handleDoc.exists) {
                return { success: true, error: null }; // Already released
            }
            
            const handleData = handleDoc.data();
            const userId = handleData.userId;
            
            // Delete handle document
            await this.db.collection('handles').doc(lowercaseHandle).delete();
            
            // Delete public profile
            await this.db.collection('publicProfiles').doc(lowercaseHandle).delete();
            
            // Clear user's handle reference
            const userRef = this.db.collection('users').doc(userId);
            await userRef.update({
                handle: null,
                lowercaseHandle: null,
                updatedAt: new Date().toISOString()
            });
            
            // Clear cache
            this.cache.delete(`available_${lowercaseHandle}`);
            this.cache.delete(`user_${lowercaseHandle}`);
            
            console.log('Handle System: Successfully released handle:', handle);
            return { success: true, error: null };
            
        } catch (error) {
            console.error('Handle System: Error releasing handle:', error);
            return { success: false, error: 'Error releasing handle: ' + error.message };
        }
    }

    // Generate suggested handles
    generateSuggestions(baseName, count = 5) {
        console.log('Handle System: Generating suggestions for:', baseName);
        
        const suggestions = new Set(); // Use Set to avoid duplicates
        const base = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (base.length < 2) {
            return [];
        }
        
        // 1. Clean base name
        suggestions.add(base.substring(0, 15));
        
        // 2. Add number variations
        for (let i = 1; i <= Math.min(count, 10); i++) {
            suggestions.add(`${base}${i}`);
            if (i <= 3) suggestions.add(`${base}0${i}`);
        }
        
        // 3. Add underscore variations
        suggestions.add(`${base}_`);
        suggestions.add(`_${base}`);
        suggestions.add(`${base}_official`);
        
        // 4. Add year variations
        const year = new Date().getFullYear().toString().slice(-2);
        suggestions.add(`${base}${year}`);
        suggestions.add(`${base}${parseInt(year) - 1}`);
        
        // 5. Add common suffixes
        const suffixes = ['_', 'official', 'real', 'true', 'here', 'now'];
        suffixes.forEach(suffix => {
            suggestions.add(`${base}_${suffix}`);
        });
        
        // 6. Remove dots and spaces
        const cleanBase = base.replace(/[.\s]/g, '');
        if (cleanBase !== base && cleanBase.length >= 3) {
            suggestions.add(cleanBase);
        }
        
        // 7. Filter out invalid handles and limit count
        const validSuggestions = [];
        for (const suggestion of suggestions) {
            if (validSuggestions.length >= count) break;
            
            const validation = this.validateHandle(suggestion);
            if (validation.valid && !this.reservedHandles.includes(suggestion.toLowerCase())) {
                validSuggestions.push(suggestion);
            }
        }
        
        console.log('Handle System: Generated suggestions:', validSuggestions);
        return validSuggestions;
    }

    // Format handle for display
    formatHandle(handle) {
        if (!handle) return '';
        return `@${handle}`;
    }

    // Extract handle from URL or string
    extractHandle(input) {
        if (!input || typeof input !== 'string') return null;
        
        // Remove @ symbol if present
        let handle = input.replace(/^@/, '');
        
        // Remove any URL parts
        handle = handle.replace(/^.*\/profile\/@/, '');
        handle = handle.replace(/^.*\?handle=/, '');
        handle = handle.replace(/[?#&].*$/, '');
        handle = handle.trim();
        
        // Convert to lowercase for lookup
        handle = handle.toLowerCase();
        
        // Validate format
        if (!handle.match(/^[a-z0-9_]+$/)) return null;
        
        return handle;
    }

    // Get profile URL by handle
    getProfileUrl(handle) {
        if (!handle) return null;
        return `https://aditya-cmd-max.github.io/profile/@${handle}`;
    }

    // Search handles (for autocomplete)
    async searchHandles(query, limit = 10) {
        console.log('Handle System: Searching handles for query:', query);
        
        try {
            if (!this.db || !query || query.length < 2) {
                return { success: false, error: 'Query too short', results: [] };
            }
            
            const lowercaseQuery = query.toLowerCase();
            
            // Search in handles collection
            const handlesRef = this.db.collection('handles');
            const snapshot = await handlesRef
                .where('lowercaseHandle', '>=', lowercaseQuery)
                .where('lowercaseHandle', '<=', lowercaseQuery + '\uf8ff')
                .limit(limit)
                .get();
            
            const results = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                results.push({
                    handle: data.handle,
                    displayName: data.displayName,
                    userId: data.userId
                });
            });
            
            console.log('Handle System: Search found', results.length, 'results');
            return { success: true, results: results, error: null };
            
        } catch (error) {
            console.error('Handle System: Error searching handles:', error);
            return { success: false, error: 'Error searching handles', results: [] };
        }
    }

    // Get user's current handle
    async getUserHandle(userId) {
        console.log('Handle System: Getting handle for user:', userId);
        
        try {
            if (!this.db) {
                return { success: false, error: 'Database not initialized', handle: null };
            }
            
            const userDoc = await this.db.collection('users').doc(userId).get();
            
            if (!userDoc.exists) {
                return { success: false, error: 'User not found', handle: null };
            }
            
            const userData = userDoc.data();
            return { 
                success: true, 
                handle: userData.handle, 
                lowercaseHandle: userData.lowercaseHandle,
                error: null 
            };
            
        } catch (error) {
            console.error('Handle System: Error getting user handle:', error);
            return { success: false, error: 'Error getting handle', handle: null };
        }
    }

    // Clear cache (useful for testing)
    clearCache() {
        console.log('Handle System: Clearing cache');
        this.cache.clear();
    }

    // Health check
    async healthCheck() {
        console.log('Handle System: Performing health check');
        
        try {
            if (!this.db) {
                return { healthy: false, error: 'Database not initialized' };
            }
            
            // Test a simple query
            const testHandle = 'test_health_check_' + Date.now();
            const testRef = this.db.collection('handles').doc(testHandle);
            
            // Try to read (should not exist)
            await testRef.get();
            
            // Try a count query
            const handlesCount = await this.db.collection('handles').limit(1).get();
            
            console.log('Handle System: Health check passed');
            return { 
                healthy: true, 
                dbInitialized: true,
                handlesCollectionExists: !handlesCount.empty
            };
            
        } catch (error) {
            console.error('Handle System: Health check failed:', error);
            return { healthy: false, error: error.message };
        }
    }

    // Verify handle ownership
    async verifyHandleOwnership(userId, handle) {
        console.log('Handle System: Verifying ownership for user:', userId, 'handle:', handle);
        
        try {
            if (!this.db) {
                return { success: false, error: 'Database not initialized', isOwner: false };
            }
            
            const lowercaseHandle = handle.toLowerCase();
            const handleDoc = await this.db.collection('handles').doc(lowercaseHandle).get();
            
            if (!handleDoc.exists) {
                return { success: true, error: null, isOwner: false };
            }
            
            const handleData = handleDoc.data();
            const isOwner = handleData.userId === userId;
            
            return { success: true, error: null, isOwner: isOwner };
            
        } catch (error) {
            console.error('Handle System: Error verifying ownership:', error);
            return { success: false, error: error.message, isOwner: false };
        }
    }
}

// Create global instance
console.log('Handle System: Creating global instance');
window.ReverbitHandleSystem = new ReverbitHandleSystem();

// Add global helper functions
window.ReverbitHandleSystemHelpers = {
    // Parse handle from current URL
    getHandleFromUrl: function() {
        const path = window.location.pathname;
        const url = window.location.href;
        
        // Try multiple patterns
        const patterns = [
            /\/profile\/@([^\/\?#]+)/,
            /[?&]handle=([^&]+)/,
            /[?&]user=([^&]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1].toLowerCase();
            }
        }
        
        // Check path segments
        const pathParts = path.split('/');
        for (let i = 0; i < pathParts.length; i++) {
            if (pathParts[i] === 'profile' && pathParts[i + 1]) {
                const handle = pathParts[i + 1].replace('@', '').toLowerCase();
                if (handle && handle.length >= 3) {
                    return handle;
                }
            }
        }
        
        return null;
    },
    
    // Check if a string looks like a handle
    isHandleFormat: function(str) {
        if (!str || typeof str !== 'string') return false;
        
        // Remove @ if present
        str = str.replace(/^@/, '');
        
        // Basic validation
        return str.length >= 3 && 
               str.length <= 20 && 
               /^[a-zA-Z0-9_]+$/.test(str) &&
               !/^[0-9]/.test(str);
    },
    
    // Format handle with @ symbol
    formatHandle: function(handle) {
        if (!handle) return '';
        return handle.startsWith('@') ? handle : `@${handle}`;
    }
};

console.log('Handle System: Ready');

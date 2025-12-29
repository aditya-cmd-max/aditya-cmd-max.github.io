// search-system.js - Advanced Profile Search System
class ReverbitSearchSystem {
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
        
        this.searchModal = null;
        this.searchInput = null;
        this.searchResults = null;
        this.currentSearch = '';
        this.lastSearchTime = 0;
        this.searchDebounce = null;
        this.isSearching = false;
        this.searchFilters = {
            verifiedOnly: false,
            publicOnly: true,
            minStreak: 0,
            sortBy: 'relevance'
        };
        
        // Bind methods
        this.openSearch = this.openSearch.bind(this);
        this.closeSearch = this.closeSearch.bind(this);
        this.performSearch = this.performSearch.bind(this);
        this.handleSearchInput = this.handleSearchInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
    }

    async init() {
        try {
            // Initialize Firebase if not already
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
            }
            
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            
            // Create search modal
            this.createSearchModal();
            
            // Add global search trigger
            this.addSearchTrigger();
            
            // Add styles
            this.injectStyles();
            
            console.log('Search system initialized');
            
        } catch (error) {
            console.error('Search system initialization error:', error);
        }
    }

    // ================= SEARCH UI =================
    createSearchModal() {
        // Remove existing modal
        if (this.searchModal && this.searchModal.parentNode) {
            this.searchModal.parentNode.removeChild(this.searchModal);
        }
        
        this.searchModal = document.createElement('div');
        this.searchModal.className = 'reverbit-search-modal';
        this.searchModal.setAttribute('role', 'dialog');
        this.searchModal.setAttribute('aria-label', 'Search profiles');
        this.searchModal.setAttribute('aria-modal', 'true');
        this.searchModal.style.display = 'none';
        
        this.searchModal.innerHTML = `
            <div class="search-modal-overlay" id="search-overlay"></div>
            <div class="search-modal-content">
                <div class="search-header">
                    <div class="search-input-container">
                        <i class="fas fa-search search-icon"></i>
                        <input 
                            type="text" 
                            id="search-profiles-input" 
                            class="search-input" 
                            placeholder="Search profiles by name, username, email..." 
                            autocomplete="off"
                            spellcheck="false"
                        >
                        <button class="search-clear-btn" id="search-clear-btn" aria-label="Clear search">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="search-close-btn" id="search-close-btn" aria-label="Close search">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="search-filters">
                        <div class="filter-group">
                            <label class="filter-checkbox">
                                <input type="checkbox" id="filter-verified" class="filter-checkbox-input">
                                <span class="filter-checkbox-label">Verified only</span>
                            </label>
                            
                            <label class="filter-checkbox">
                                <input type="checkbox" id="filter-public" class="filter-checkbox-input" checked>
                                <span class="filter-checkbox-label">Public profiles</span>
                            </label>
                        </div>
                        
                        <div class="filter-group">
                            <select id="filter-sort" class="filter-select">
                                <option value="relevance">Most relevant</option>
                                <option value="recent">Most recent</option>
                                <option value="streak">Highest streak</option>
                                <option value="popular">Most popular</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="search-results-container">
                    <div class="search-results-header">
                        <h3 class="results-title">Profiles</h3>
                        <div class="results-count" id="results-count">0 results</div>
                    </div>
                    
                    <div class="search-results" id="search-results">
                        <div class="search-empty-state">
                            <div class="empty-state-icon">
                                <i class="fas fa-search"></i>
                            </div>
                            <h3>Search for profiles</h3>
                            <p>Find users by name, username, or email address</p>
                            <div class="search-suggestions">
                                <h4>Try searching for:</h4>
                                <div class="suggestion-tags">
                                    <button class="suggestion-tag" data-suggestion="verified">Verified users</button>
                                    <button class="suggestion-tag" data-suggestion="active">Active members</button>
                                    <button class="suggestion-tag" data-suggestion="premium">Premium users</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="search-loading" id="search-loading" style="display: none;">
                        <div class="loading-spinner"></div>
                        <p>Searching profiles...</p>
                    </div>
                    
                    <div class="search-error" id="search-error" style="display: none;">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Failed to load search results</p>
                        <button class="retry-btn" id="retry-search">Try again</button>
                    </div>
                </div>
                
                <div class="search-footer">
                    <div class="search-tips">
                        <i class="fas fa-lightbulb"></i>
                        <span>Tip: Use quotes for exact matches</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.searchModal);
        
        // Get references to elements
        this.searchInput = document.getElementById('search-profiles-input');
        this.searchResults = document.getElementById('search-results');
        this.searchLoading = document.getElementById('search-loading');
        this.searchError = document.getElementById('search-error');
        this.resultsCount = document.getElementById('results-count');
        
        // Add event listeners
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Search input
        this.searchInput.addEventListener('input', this.handleSearchInput);
        this.searchInput.addEventListener('keydown', this.handleKeyDown);
        
        // Clear button
        const clearBtn = document.getElementById('search-clear-btn');
        clearBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.searchInput.focus();
            this.clearSearch();
        });
        
        // Close buttons
        const closeBtn = document.getElementById('search-close-btn');
        const overlay = document.getElementById('search-overlay');
        closeBtn.addEventListener('click', this.closeSearch);
        overlay.addEventListener('click', this.closeSearch);
        
        // Filter changes
        document.getElementById('filter-verified').addEventListener('change', (e) => {
            this.searchFilters.verifiedOnly = e.target.checked;
            if (this.currentSearch.trim()) {
                this.performSearch(this.currentSearch);
            }
        });
        
        document.getElementById('filter-public').addEventListener('change', (e) => {
            this.searchFilters.publicOnly = e.target.checked;
            if (this.currentSearch.trim()) {
                this.performSearch(this.currentSearch);
            }
        });
        
        document.getElementById('filter-sort').addEventListener('change', (e) => {
            this.searchFilters.sortBy = e.target.value;
            if (this.currentSearch.trim()) {
                this.performSearch(this.currentSearch);
            }
        });
        
        // Retry button
        document.getElementById('retry-search').addEventListener('click', () => {
            if (this.currentSearch.trim()) {
                this.performSearch(this.currentSearch);
            }
        });
        
        // Suggestion tags
        document.querySelectorAll('.suggestion-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                const suggestion = e.target.dataset.suggestion;
                this.handleSuggestion(suggestion);
            });
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.searchModal.style.display === 'block') {
                this.closeSearch();
            }
        });
    }

    addSearchTrigger() {
        // Create search trigger button
        const searchTrigger = document.createElement('button');
        searchTrigger.className = 'reverbit-search-trigger';
        searchTrigger.setAttribute('aria-label', 'Search profiles');
        searchTrigger.setAttribute('title', 'Search profiles');
        searchTrigger.innerHTML = '<i class="fas fa-search"></i>';
        searchTrigger.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 80px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1a73e8, #0d8a72);
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(26, 115, 232, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            z-index: 9995;
            transition: all 0.3s ease;
        `;
        
        searchTrigger.addEventListener('click', this.openSearch);
        searchTrigger.addEventListener('mouseenter', () => {
            searchTrigger.style.transform = 'scale(1.1) rotate(5deg)';
            searchTrigger.style.boxShadow = '0 6px 24px rgba(26, 115, 232, 0.4)';
        });
        searchTrigger.addEventListener('mouseleave', () => {
            searchTrigger.style.transform = 'scale(1) rotate(0)';
            searchTrigger.style.boxShadow = '0 4px 20px rgba(26, 115, 232, 0.3)';
        });
        
        document.body.appendChild(searchTrigger);
        
        // Also add search to header actions if exists
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            const headerSearchBtn = document.createElement('button');
            headerSearchBtn.className = 'btn btn-outlined header-search-btn';
            headerSearchBtn.innerHTML = '<i class="fas fa-search"></i> Search';
            headerSearchBtn.addEventListener('click', this.openSearch);
            headerActions.insertBefore(headerSearchBtn, headerActions.firstChild);
        }
    }

    // ================= SEARCH FUNCTIONALITY =================
    handleSearchInput(e) {
        const query = e.target.value.trim();
        this.currentSearch = query;
        
        // Clear previous debounce
        if (this.searchDebounce) {
            clearTimeout(this.searchDebounce);
        }
        
        // Show loading for empty results
        if (!query) {
            this.clearSearch();
            return;
        }
        
        // Debounce search
        this.searchDebounce = setTimeout(() => {
            this.performSearch(query);
        }, 300);
    }

    handleSuggestion(suggestion) {
        let query = '';
        
        switch(suggestion) {
            case 'verified':
                query = 'verified';
                document.getElementById('filter-verified').checked = true;
                this.searchFilters.verifiedOnly = true;
                break;
            case 'active':
                query = 'active';
                document.getElementById('filter-sort').value = 'recent';
                this.searchFilters.sortBy = 'recent';
                break;
            case 'premium':
                query = 'premium verified';
                document.getElementById('filter-verified').checked = true;
                this.searchFilters.verifiedOnly = true;
                break;
        }
        
        this.searchInput.value = query;
        this.currentSearch = query;
        this.performSearch(query);
    }

    async performSearch(query) {
        if (!query.trim() || this.isSearching) return;
        
        this.isSearching = true;
        this.showLoading(true);
        this.showError(false);
        
        try {
            console.log('Searching for:', query);
            
            // Normalize query
            const normalizedQuery = query.toLowerCase().trim();
            const searchTerms = this.extractSearchTerms(normalizedQuery);
            
            // Get all users from Firestore
            let usersRef = this.db.collection('users');
            
            // Apply filters
            if (this.searchFilters.publicOnly) {
                usersRef = usersRef.where('isPublic', '==', true);
            }
            
            const snapshot = await usersRef.get();
            
            if (snapshot.empty) {
                this.displayNoResults(query);
                return;
            }
            
            // Process and filter results
            const allUsers = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                userData.id = doc.id;
                allUsers.push(userData);
            });
            
            // Filter results based on query
            const filteredUsers = this.filterUsersByQuery(allUsers, searchTerms, normalizedQuery);
            
            // Apply additional filters
            const finalResults = this.applyAdditionalFilters(filteredUsers);
            
            // Sort results
            const sortedResults = this.sortResults(finalResults);
            
            // Display results
            this.displayResults(sortedResults, query);
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError(true);
        } finally {
            this.isSearching = false;
            this.showLoading(false);
        }
    }

    extractSearchTerms(query) {
        // Extract words and phrases from query
        const terms = [];
        let currentTerm = '';
        let inQuotes = false;
        
        for (let i = 0; i < query.length; i++) {
            const char = query[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
                if (!inQuotes && currentTerm.trim()) {
                    terms.push(currentTerm.trim());
                    currentTerm = '';
                }
            } else if (char === ' ' && !inQuotes) {
                if (currentTerm.trim()) {
                    terms.push(currentTerm.trim());
                    currentTerm = '';
                }
            } else {
                currentTerm += char;
            }
        }
        
        if (currentTerm.trim()) {
            terms.push(currentTerm.trim());
        }
        
        return terms;
    }

    filterUsersByQuery(users, searchTerms, originalQuery) {
        return users.filter(user => {
            // Check if user matches any search criteria
            const displayName = user.displayName?.toLowerCase() || '';
            const email = user.email?.toLowerCase() || '';
            const username = user.username?.toLowerCase() || '';
            const bio = user.bio?.toLowerCase() || '';
            const country = user.country?.toLowerCase() || '';
            
            // Check for exact phrase matches
            if (originalQuery.includes('"')) {
                const quotedPhrases = originalQuery.match(/"(.*?)"/g);
                if (quotedPhrases) {
                    for (const phrase of quotedPhrases) {
                        const cleanPhrase = phrase.replace(/"/g, '').toLowerCase();
                        if (!displayName.includes(cleanPhrase) && 
                            !email.includes(cleanPhrase) &&
                            !username.includes(cleanPhrase)) {
                            return false;
                        }
                    }
                }
            }
            
            // Check individual terms
            let matchScore = 0;
            
            for (const term of searchTerms) {
                // Skip if term is a filter keyword
                if (['verified', 'premium', 'active', 'new'].includes(term)) {
                    continue;
                }
                
                // Calculate match score
                if (displayName.includes(term)) matchScore += 3;
                if (username.includes(term)) matchScore += 2;
                if (email.includes(term)) matchScore += 2;
                if (bio.includes(term)) matchScore += 1;
                if (country.includes(term)) matchScore += 1;
            }
            
            // Check for special keywords
            if (originalQuery.includes('verified')) {
                if (!user.verified) return false;
                matchScore += 2;
            }
            
            if (originalQuery.includes('premium')) {
                if (!(user.verifiedLevel === 'premium' || user.premiumVerified)) return false;
                matchScore += 3;
            }
            
            if (originalQuery.includes('active')) {
                const lastActive = user.lastActive ? new Date(user.lastActive) : null;
                const now = new Date();
                if (lastActive && (now - lastActive) < 7 * 24 * 60 * 60 * 1000) {
                    matchScore += 2;
                }
            }
            
            if (originalQuery.includes('new')) {
                const createdAt = user.createdAt ? new Date(user.createdAt) : null;
                const now = new Date();
                if (createdAt && (now - createdAt) < 30 * 24 * 60 * 60 * 1000) {
                    matchScore += 2;
                }
            }
            
            // Only include if there's at least one match
            user.matchScore = matchScore;
            return matchScore > 0;
        });
    }

    applyAdditionalFilters(users) {
        return users.filter(user => {
            // Verified filter
            if (this.searchFilters.verifiedOnly && !user.verified) {
                return false;
            }
            
            // Streak filter
            if (this.searchFilters.minStreak > 0 && (!user.streak || user.streak < this.searchFilters.minStreak)) {
                return false;
            }
            
            return true;
        });
    }

    sortResults(users) {
        switch(this.searchFilters.sortBy) {
            case 'recent':
                return users.sort((a, b) => {
                    const dateA = a.lastActive ? new Date(a.lastActive) : new Date(a.createdAt || 0);
                    const dateB = b.lastActive ? new Date(b.lastActive) : new Date(b.createdAt || 0);
                    return dateB - dateA;
                });
                
            case 'streak':
                return users.sort((a, b) => {
                    const streakA = a.streak || 0;
                    const streakB = b.streak || 0;
                    return streakB - streakA;
                });
                
            case 'popular':
                return users.sort((a, b) => {
                    const scoreA = (a.totalLogins || 0) + (a.matchScore || 0);
                    const scoreB = (b.totalLogins || 0) + (b.matchScore || 0);
                    return scoreB - scoreA;
                });
                
            case 'relevance':
            default:
                return users.sort((a, b) => {
                    const scoreA = a.matchScore || 0;
                    const scoreB = b.matchScore || 0;
                    
                    // If scores are equal, sort by recent activity
                    if (scoreA === scoreB) {
                        const dateA = a.lastActive ? new Date(a.lastActive) : new Date(a.createdAt || 0);
                        const dateB = b.lastActive ? new Date(b.lastActive) : new Date(b.createdAt || 0);
                        return dateB - dateA;
                    }
                    
                    return scoreB - scoreA;
                });
        }
    }

    // ================= RESULTS DISPLAY =================
    displayResults(users, query) {
        if (users.length === 0) {
            this.displayNoResults(query);
            return;
        }
        
        this.resultsCount.textContent = `${users.length} result${users.length !== 1 ? 's' : ''}`;
        
        const resultsHTML = users.map(user => this.createUserCard(user)).join('');
        this.searchResults.innerHTML = resultsHTML;
        
        // Add click handlers to result cards
        this.searchResults.querySelectorAll('.user-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.user-card-action')) {
                    const userId = card.dataset.userId;
                    if (userId) {
                        this.viewProfile(userId);
                    }
                }
            });
        });
    }

    createUserCard(user) {
        const displayName = user.displayName || 'User';
        const email = user.email || '';
        const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true`;
        const streak = user.streak || 0;
        const memberSince = user.createdAt ? this.formatMemberSince(user.createdAt) : '';
        const isVerified = user.verified;
        const isPremium = user.verifiedLevel === 'premium' || user.premiumVerified;
        const lastActive = user.lastActive ? this.formatLastActive(user.lastActive) : 'Never active';
        
        const verificationBadge = isVerified ? 
            `<div class="user-verified-badge ${isPremium ? 'premium' : ''}">
                <i class="fas fa-${isPremium ? 'crown' : 'check-circle'}"></i>
                ${isPremium ? 'Premium Verified' : 'Verified'}
            </div>` : '';
        
        return `
            <div class="user-card" data-user-id="${user.id}">
                <div class="user-card-avatar">
                    <img src="${photoURL}" alt="${displayName}" 
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285f4&color=fff&bold=true'">
                    ${isVerified ? 
                        `<div class="user-avatar-badge ${isPremium ? 'premium' : ''}">
                            <i class="fas fa-${isPremium ? 'crown' : 'check'}"></i>
                        </div>` : ''}
                </div>
                
                <div class="user-card-info">
                    <div class="user-card-header">
                        <h4 class="user-name">${displayName}</h4>
                        ${verificationBadge}
                    </div>
                    
                    <p class="user-email">${email}</p>
                    
                    <div class="user-stats">
                        <div class="user-stat">
                            <i class="fas fa-fire"></i>
                            <span>${streak} day streak</span>
                        </div>
                        <div class="user-stat">
                            <i class="fas fa-calendar"></i>
                            <span>${memberSince}</span>
                        </div>
                        <div class="user-stat">
                            <i class="fas fa-clock"></i>
                            <span>${lastActive}</span>
                        </div>
                    </div>
                    
                    ${user.bio ? `<p class="user-bio">${this.truncateText(user.bio, 100)}</p>` : ''}
                    
                    ${user.country ? `<div class="user-location"><i class="fas fa-map-marker-alt"></i> ${user.country}</div>` : ''}
                </div>
                
                <div class="user-card-actions">
                    <button class="user-card-action view-profile-btn" data-user-id="${user.id}">
                        <i class="fas fa-eye"></i>
                        View Profile
                    </button>
                    <button class="user-card-action copy-link-btn" data-user-id="${user.id}" title="Copy profile link">
                        <i class="fas fa-link"></i>
                    </button>
                </div>
            </div>
        `;
    }

    displayNoResults(query) {
        this.resultsCount.textContent = '0 results';
        
        this.searchResults.innerHTML = `
            <div class="search-no-results">
                <div class="no-results-icon">
                    <i class="fas fa-search"></i>
                </div>
                <h3>No results found for "${query}"</h3>
                <p>Try different keywords or check the spelling</p>
                <div class="no-results-suggestions">
                    <p>Suggestions:</p>
                    <ul>
                        <li>Try using fewer keywords</li>
                        <li>Check for typos in your search</li>
                        <li>Try more general terms</li>
                        <li>Make sure the profile is public</li>
                    </ul>
                </div>
            </div>
        `;
    }

    clearSearch() {
        this.currentSearch = '';
        this.searchResults.innerHTML = `
            <div class="search-empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-search"></i>
                </div>
                <h3>Search for profiles</h3>
                <p>Find users by name, username, or email address</p>
                <div class="search-suggestions">
                    <h4>Try searching for:</h4>
                    <div class="suggestion-tags">
                        <button class="suggestion-tag" data-suggestion="verified">Verified users</button>
                        <button class="suggestion-tag" data-suggestion="active">Active members</button>
                        <button class="suggestion-tag" data-suggestion="premium">Premium users</button>
                    </div>
                </div>
            </div>
        `;
        this.resultsCount.textContent = '0 results';
    }

    // ================= UI CONTROLS =================
    openSearch() {
        if (this.searchModal) {
            this.searchModal.style.display = 'block';
            
            // Focus search input after animation
            setTimeout(() => {
                this.searchInput.focus();
                this.searchModal.classList.add('active');
            }, 10);
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }
    }

    closeSearch() {
        if (this.searchModal) {
            this.searchModal.classList.remove('active');
            
            setTimeout(() => {
                this.searchModal.style.display = 'none';
                document.body.style.overflow = '';
            }, 200);
        }
    }

    showLoading(show) {
        if (this.searchLoading) {
            this.searchLoading.style.display = show ? 'flex' : 'none';
        }
    }

    showError(show) {
        if (this.searchError) {
            this.searchError.style.display = show ? 'flex' : 'none';
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && this.currentSearch.trim()) {
            this.performSearch(this.currentSearch);
        }
    }

    handleClickOutside(e) {
        if (this.searchModal && 
            this.searchModal.style.display === 'block' &&
            !this.searchModal.contains(e.target) &&
            !e.target.closest('.reverbit-search-trigger') &&
            !e.target.closest('.header-search-btn')) {
            this.closeSearch();
        }
    }

    // ================= UTILITIES =================
    formatMemberSince(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
        
        if (diffMonths < 1) return 'New member';
        if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
        
        const years = Math.floor(diffMonths / 12);
        return `${years} year${years !== 1 ? 's' : ''} ago`;
    }

    formatLastActive(dateString) {
        if (!dateString) return 'Never active';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    viewProfile(userId) {
        window.open(`https://aditya-cmd-max.github.io/profile/?id=${userId}`, '_blank');
        this.closeSearch();
    }

    // ================= STYLES =================
    injectStyles() {
        if (document.getElementById('reverbit-search-styles')) return;
        
        const styles = `
            /* Reverbit Search System Styles */
            
            /* Search Trigger */
            .reverbit-search-trigger {
                position: fixed;
                bottom: 20px;
                right: 80px;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                color: white;
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(26, 115, 232, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                z-index: 9995;
                transition: all 0.3s ease;
            }
            
            .reverbit-search-trigger:hover {
                transform: scale(1.1) rotate(5deg);
                box-shadow: 0 6px 24px rgba(26, 115, 232, 0.4);
            }
            
            /* Search Modal */
            .reverbit-search-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
            }
            
            .reverbit-search-modal.active .search-modal-content {
                transform: translateY(0);
                opacity: 1;
            }
            
            .search-modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .search-modal-content {
                position: absolute;
                top: 10%;
                left: 50%;
                transform: translateX(-50%) translateY(-20px);
                width: 90%;
                max-width: 800px;
                max-height: 80vh;
                background: #ffffff;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                opacity: 0;
                transition: all 0.3s ease;
            }
            
            .dark-theme .search-modal-content {
                background: #202124;
                border: 1px solid #3c4043;
            }
            
            .search-header {
                padding: 24px;
                border-bottom: 1px solid #e8eaed;
                background: #ffffff;
            }
            
            .dark-theme .search-header {
                background: #202124;
                border-bottom-color: #3c4043;
            }
            
            .search-input-container {
                position: relative;
                margin-bottom: 16px;
            }
            
            .search-icon {
                position: absolute;
                left: 16px;
                top: 50%;
                transform: translateY(-50%);
                color: #5f6368;
                font-size: 18px;
            }
            
            .dark-theme .search-icon {
                color: #9aa0a6;
            }
            
            .search-input {
                width: 100%;
                padding: 16px 52px 16px 52px;
                font-size: 16px;
                border: 2px solid #dadce0;
                border-radius: 12px;
                background: #ffffff;
                color: #202124;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            
            .dark-theme .search-input {
                background: #303134;
                border-color: #5f6368;
                color: #e8eaed;
            }
            
            .search-input:focus {
                outline: none;
                border-color: #1a73e8;
                box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.2);
            }
            
            .dark-theme .search-input:focus {
                border-color: #8ab4f8;
                box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.2);
            }
            
            .search-clear-btn {
                position: absolute;
                right: 52px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: #5f6368;
                cursor: pointer;
                padding: 8px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            
            .search-clear-btn:hover {
                background: #f8f9fa;
                color: #202124;
            }
            
            .dark-theme .search-clear-btn {
                color: #9aa0a6;
            }
            
            .dark-theme .search-clear-btn:hover {
                background: #2d2e31;
                color: #e8eaed;
            }
            
            .search-close-btn {
                position: absolute;
                right: 16px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: #5f6368;
                cursor: pointer;
                padding: 8px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                font-size: 20px;
            }
            
            .search-close-btn:hover {
                background: #f8f9fa;
                color: #202124;
            }
            
            .dark-theme .search-close-btn {
                color: #9aa0a6;
            }
            
            .dark-theme .search-close-btn:hover {
                background: #2d2e31;
                color: #e8eaed;
            }
            
            /* Search Filters */
            .search-filters {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }
            
            .filter-group {
                display: flex;
                gap: 16px;
                align-items: center;
            }
            
            .filter-checkbox {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 14px;
                color: #5f6368;
                user-select: none;
            }
            
            .dark-theme .filter-checkbox {
                color: #9aa0a6;
            }
            
            .filter-checkbox-input {
                width: 16px;
                height: 16px;
                margin: 0;
                cursor: pointer;
            }
            
            .filter-select {
                padding: 8px 12px;
                border: 1px solid #dadce0;
                border-radius: 8px;
                background: #ffffff;
                color: #202124;
                font-size: 14px;
                cursor: pointer;
                min-width: 160px;
            }
            
            .dark-theme .filter-select {
                background: #303134;
                border-color: #5f6368;
                color: #e8eaed;
            }
            
            /* Search Results */
            .search-results-container {
                flex: 1;
                overflow-y: auto;
                padding: 0 24px;
            }
            
            .search-results-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 0;
                border-bottom: 1px solid #e8eaed;
            }
            
            .dark-theme .search-results-header {
                border-bottom-color: #3c4043;
            }
            
            .results-title {
                font-size: 18px;
                font-weight: 600;
                color: #202124;
                margin: 0;
            }
            
            .dark-theme .results-title {
                color: #e8eaed;
            }
            
            .results-count {
                font-size: 14px;
                color: #5f6368;
                font-weight: 500;
            }
            
            .dark-theme .results-count {
                color: #9aa0a6;
            }
            
            .search-results {
                padding: 20px 0;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            /* User Card */
            .user-card {
                display: flex;
                align-items: center;
                gap: 20px;
                padding: 20px;
                background: #ffffff;
                border: 1px solid #e8eaed;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
            }
            
            .dark-theme .user-card {
                background: #202124;
                border-color: #3c4043;
            }
            
            .user-card:hover {
                transform: translateY(-2px);
                border-color: #1a73e8;
                box-shadow: 0 4px 20px rgba(26, 115, 232, 0.1);
            }
            
            .dark-theme .user-card:hover {
                border-color: #8ab4f8;
                box-shadow: 0 4px 20px rgba(138, 180, 248, 0.1);
            }
            
            .user-card-avatar {
                position: relative;
                width: 60px;
                height: 60px;
                flex-shrink: 0;
            }
            
            .user-card-avatar img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335);
                padding: 2px;
            }
            
            .user-avatar-badge {
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1a73e8, #0d8a72);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid #ffffff;
                font-size: 10px;
            }
            
            .dark-theme .user-avatar-badge {
                border-color: #202124;
            }
            
            .user-avatar-badge.premium {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #000;
            }
            
            .user-card-info {
                flex: 1;
                min-width: 0;
            }
            
            .user-card-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 4px;
                flex-wrap: wrap;
            }
            
            .user-name {
                font-size: 16px;
                font-weight: 600;
                color: #202124;
                margin: 0;
            }
            
            .dark-theme .user-name {
                color: #e8eaed;
            }
            
            .user-verified-badge {
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
                white-space: nowrap;
            }
            
            .user-verified-badge.premium {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                color: #000;
                box-shadow: 0 2px 6px rgba(255, 215, 0, 0.3);
            }
            
            .user-email {
                font-size: 14px;
                color: #5f6368;
                margin: 0 0 12px 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .dark-theme .user-email {
                color: #9aa0a6;
            }
            
            .user-stats {
                display: flex;
                gap: 16px;
                margin-bottom: 12px;
                flex-wrap: wrap;
            }
            
            .user-stat {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
                color: #5f6368;
            }
            
            .dark-theme .user-stat {
                color: #9aa0a6;
            }
            
            .user-stat i {
                font-size: 12px;
            }
            
            .user-bio {
                font-size: 14px;
                color: #5f6368;
                margin: 0 0 8px 0;
                line-height: 1.4;
            }
            
            .dark-theme .user-bio {
                color: #9aa0a6;
            }
            
            .user-location {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
                color: #5f6368;
            }
            
            .dark-theme .user-location {
                color: #9aa0a6;
            }
            
            .user-card-actions {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
            }
            
            .user-card-action {
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid #dadce0;
                background: #ffffff;
                color: #1a73e8;
                display: flex;
                align-items: center;
                gap: 6px;
                white-space: nowrap;
            }
            
            .dark-theme .user-card-action {
                background: #202124;
                border-color: #3c4043;
                color: #8ab4f8;
            }
            
            .user-card-action:hover {
                background: #e8f0fe;
                border-color: #1a73e8;
                transform: translateY(-1px);
            }
            
            .dark-theme .user-card-action:hover {
                background: #2d2e31;
                border-color: #8ab4f8;
            }
            
            .copy-link-btn {
                padding: 8px;
                min-width: 36px;
                justify-content: center;
            }
            
            /* Empty States */
            .search-empty-state,
            .search-no-results {
                text-align: center;
                padding: 60px 20px;
            }
            
            .empty-state-icon,
            .no-results-icon {
                font-size: 48px;
                color: #dadce0;
                margin-bottom: 20px;
            }
            
            .dark-theme .empty-state-icon,
            .dark-theme .no-results-icon {
                color: #3c4043;
            }
            
            .search-empty-state h3,
            .search-no-results h3 {
                font-size: 20px;
                font-weight: 600;
                color: #202124;
                margin: 0 0 8px 0;
            }
            
            .dark-theme .search-empty-state h3,
            .dark-theme .search-no-results h3 {
                color: #e8eaed;
            }
            
            .search-empty-state p,
            .search-no-results p {
                font-size: 14px;
                color: #5f6368;
                margin: 0 0 24px 0;
            }
            
            .dark-theme .search-empty-state p,
            .dark-theme .search-no-results p {
                color: #9aa0a6;
            }
            
            .search-suggestions {
                max-width: 400px;
                margin: 0 auto;
            }
            
            .search-suggestions h4 {
                font-size: 14px;
                color: #5f6368;
                margin: 0 0 12px 0;
                font-weight: 500;
            }
            
            .dark-theme .search-suggestions h4 {
                color: #9aa0a6;
            }
            
            .suggestion-tags {
                display: flex;
                gap: 8px;
                justify-content: center;
                flex-wrap: wrap;
            }
            
            .suggestion-tag {
                padding: 6px 12px;
                border-radius: 16px;
                background: #e8f0fe;
                color: #1a73e8;
                border: none;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .dark-theme .suggestion-tag {
                background: #2d2e31;
                color: #8ab4f8;
            }
            
            .suggestion-tag:hover {
                background: #d2e3fc;
                transform: translateY(-1px);
            }
            
            .dark-theme .suggestion-tag:hover {
                background: #3c4043;
            }
            
            .no-results-suggestions {
                max-width: 400px;
                margin: 24px auto 0;
                text-align: left;
                background: #f8f9fa;
                padding: 16px;
                border-radius: 12px;
            }
            
            .dark-theme .no-results-suggestions {
                background: #2d2e31;
            }
            
            .no-results-suggestions p {
                font-weight: 600;
                margin-bottom: 8px;
            }
            
            .no-results-suggestions ul {
                margin: 0;
                padding-left: 20px;
                font-size: 14px;
                color: #5f6368;
            }
            
            .dark-theme .no-results-suggestions ul {
                color: #9aa0a6;
            }
            
            .no-results-suggestions li {
                margin-bottom: 4px;
            }
            
            /* Loading State */
            .search-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
                gap: 16px;
            }
            
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #e8eaed;
                border-top-color: #1a73e8;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            .dark-theme .loading-spinner {
                border-color: #3c4043;
                border-top-color: #8ab4f8;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .search-loading p {
                font-size: 14px;
                color: #5f6368;
                margin: 0;
            }
            
            .dark-theme .search-loading p {
                color: #9aa0a6;
            }
            
            /* Error State */
            .search-error {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
                gap: 16px;
            }
            
            .search-error i {
                font-size: 48px;
                color: #ea4335;
            }
            
            .search-error p {
                font-size: 14px;
                color: #5f6368;
                margin: 0;
            }
            
            .dark-theme .search-error p {
                color: #9aa0a6;
            }
            
            .retry-btn {
                padding: 8px 16px;
                border-radius: 8px;
                background: #1a73e8;
                color: white;
                border: none;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .retry-btn:hover {
                background: #0d62d9;
                transform: translateY(-1px);
            }
            
            /* Search Footer */
            .search-footer {
                padding: 16px 24px;
                border-top: 1px solid #e8eaed;
                background: #ffffff;
            }
            
            .dark-theme .search-footer {
                background: #202124;
                border-top-color: #3c4043;
            }
            
            .search-tips {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                color: #5f6368;
            }
            
            .dark-theme .search-tips {
                color: #9aa0a6;
            }
            
            .search-tips i {
                color: #fbbc05;
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .search-modal-content {
                    top: 5%;
                    width: 95%;
                    max-height: 90vh;
                }
                
                .search-filters {
                    flex-direction: column;
                    align-items: stretch;
                }
                
                .filter-group {
                    flex-wrap: wrap;
                }
                
                .user-card {
                    flex-direction: column;
                    align-items: stretch;
                    text-align: center;
                }
                
                .user-card-avatar {
                    align-self: center;
                }
                
                .user-stats {
                    justify-content: center;
                }
                
                .user-card-actions {
                    justify-content: center;
                }
                
                .reverbit-search-trigger {
                    bottom: 20px;
                    right: 20px;
                    width: 48px;
                    height: 48px;
                    font-size: 18px;
                }
            }
            
            @media (max-width: 480px) {
                .search-header {
                    padding: 16px;
                }
                
                .search-results-container {
                    padding: 0 16px;
                }
                
                .user-card {
                    padding: 16px;
                }
                
                .search-footer {
                    padding: 12px 16px;
                }
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'reverbit-search-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }
}

// ================= GLOBAL INSTANCE =================
window.ReverbitSearch = new ReverbitSearchSystem();

// Auto-initialize search system
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Reverbit Search: Initializing...');
        await window.ReverbitSearch.init();
        console.log('Reverbit Search: Initialized successfully');
    } catch (error) {
        console.error('Reverbit Search: Initialization failed:', error);
    }
});

// Global search function
window.openProfileSearch = function() {
    if (window.ReverbitSearch) {
        window.ReverbitSearch.openSearch();
    }
};

// Keyboard shortcut (Ctrl/Cmd + K)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (window.ReverbitSearch) {
            window.ReverbitSearch.openSearch();
        }
    }
});

console.log('Reverbit Search System loaded successfully');

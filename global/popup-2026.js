// 2026 Celebration Popup - Improved Version
(function () {
  // Check if popup should be shown
  if (localStorage.getItem('popup2026Seen')) return;

  // Create popup element
  const popupOverlay = document.createElement('div');
  popupOverlay.id = 'popup2026-overlay';
  popupOverlay.setAttribute('role', 'dialog');
  popupOverlay.setAttribute('aria-labelledby', 'popup2026-title');
  popupOverlay.setAttribute('aria-modal', 'true');
  
  popupOverlay.innerHTML = `
    <div class="popup-backdrop">
      <div class="popup-container">
        <h1 id="popup2026-title" class="popup-title">🎉 Welcome 2026</h1>
        <p class="popup-message">
          New year. New energy. Bigger goals.  
          Let's build something legendary 🚀
        </p>
        <div class="popup-buttons">
          <button id="popup2026-close" class="popup-button popup-button-primary">
            Let's go
          </button>
          <button id="popup2026-remind" class="popup-button popup-button-secondary">
            Remind me later
          </button>
        </div>
        <button id="popup2026-close-x" class="popup-close-x" aria-label="Close popup">×</button>
      </div>
    </div>
  `;

  // Add CSS styles
  const styles = `
    #popup2026-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      font-family: system-ui, -apple-system, sans-serif;
      animation: fadeIn 0.3s ease-out;
    }
    
    .popup-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .popup-container {
      position: relative;
      background: linear-gradient(135deg, #7f00ff, #e100ff);
      color: white;
      padding: 30px;
      border-radius: 16px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.4s ease-out;
    }
    
    .popup-title {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: 700;
    }
    
    .popup-message {
      margin: 15px 0 25px 0;
      font-size: 16px;
      line-height: 1.5;
    }
    
    .popup-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    
    .popup-button {
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .popup-button-primary {
      background: white;
      color: #7f00ff;
    }
    
    .popup-button-primary:hover {
      background: #f8f8f8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .popup-button-secondary {
      background: rgba(255, 255, 255, 0.15);
      color: white;
      backdrop-filter: blur(10px);
    }
    
    .popup-button-secondary:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: translateY(-1px);
    }
    
    .popup-close-x {
      position: absolute;
      top: 15px;
      right: 15px;
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .popup-close-x:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: rotate(90deg);
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @media (max-width: 480px) {
      .popup-container {
        padding: 25px 20px;
      }
      
      .popup-buttons {
        flex-direction: column;
      }
      
      .popup-button {
        width: 100%;
      }
    }
  `;

  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Add to document
  document.body.appendChild(popupOverlay);

  // Close functions
  const closePopup = () => {
    localStorage.setItem('popup2026Seen', 'true');
    popupOverlay.style.animation = 'fadeIn 0.3s ease-out reverse';
    setTimeout(() => popupOverlay.remove(), 300);
  };

  const remindLater = () => {
    // Set to show again in 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    localStorage.setItem('popup2026Seen', tomorrow.getTime().toString());
    popupOverlay.style.animation = 'fadeIn 0.3s ease-out reverse';
    setTimeout(() => popupOverlay.remove(), 300);
  };

  // Event listeners
  document.getElementById('popup2026-close').addEventListener('click', closePopup);
  document.getElementById('popup2026-close-x').addEventListener('click', closePopup);
  document.getElementById('popup2026-remind').addEventListener('click', remindLater);

  // Close on backdrop click
  popupOverlay.querySelector('.popup-backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closePopup();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePopup();
    }
  });

  // Update the initial check to handle "remind later" timestamps
  const seenValue = localStorage.getItem('popup2026Seen');
  if (seenValue && !isNaN(seenValue)) {
    const remindTime = parseInt(seenValue);
    if (Date.now() < remindTime) {
      popupOverlay.remove();
    } else {
      localStorage.removeItem('popup2026Seen');
    }
  }
})();

// Verificar se página deve ser bloqueada
async function checkBlockStatus() {
  try {
    const data = await chrome.storage.local.get(['timerState', 'settings', 'emergencyMode']);
    
    const timerState = data.timerState || {};
    const settings = data.settings || { blockedSites: [] };
    const emergencyMode = data.emergencyMode || { active: false };
    
    // Não bloquear se:
    // - Timer não está rodando
    // - Está em modo pausa
    // - Modo emergência ativo
    if (!timerState.isRunning || timerState.mode !== 'focus') {
      removeFocusIndicator();
      return;
    }
    
    if (emergencyMode.active && Date.now() < emergencyMode.endTime) {
      showEmergencyIndicator(emergencyMode.endTime);
      return;
    }
    
    // Verificar se URL atual está bloqueada
    const currentUrl = window.location.hostname.replace('www.', '');
    const isBlocked = settings.blockedSites.some(blocked => {
      return currentUrl.includes(blocked) || blocked.includes(currentUrl);
    });
    
    if (isBlocked) {
      // Redirecionar para página de bloqueio
      window.location.href = chrome.runtime.getURL('blocked.html');
    } else {
      // Mostrar indicador de foco se não estiver bloqueado
      showFocusIndicator();
    }
  } catch (error) {
    console.error('Erro ao verificar bloqueio:', error);
  }
}

// Mostrar indicador de modo foco
function showFocusIndicator() {
  // Remover indicador existente
  removeFocusIndicator();
  
  const indicator = document.createElement('div');
  indicator.id = 'focusgoals-indicator';
  indicator.innerHTML = `
    <div class="focusgoals-badge">
      🍅 Modo Foco Ativo
    </div>
  `;
  
  const style = document.createElement('style');
  style.id = 'focusgoals-indicator-style';
  style.textContent = `
    #focusgoals-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .focusgoals-badge {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 10px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      cursor: default;
      animation: focusgoals-slide-in 0.3s ease-out;
    }
    
    @keyframes focusgoals-slide-in {
      from {
        transform: translateX(100px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .focusgoals-emergency {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      animation: focusgoals-pulse 2s ease-in-out infinite;
    }
    
    @keyframes focusgoals-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(indicator);
}

// Mostrar indicador de modo emergência
function showEmergencyIndicator(endTime) {
  removeFocusIndicator();
  
  const indicator = document.createElement('div');
  indicator.id = 'focusgoals-indicator';
  
  const timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  indicator.innerHTML = `
    <div class="focusgoals-badge focusgoals-emergency">
      ⚠️ Emergência: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}
    </div>
  `;
  
  const style = document.createElement('style');
  style.id = 'focusgoals-indicator-style';
  style.textContent = `
    #focusgoals-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .focusgoals-badge {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 10px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      cursor: default;
      animation: focusgoals-slide-in 0.3s ease-out;
    }
    
    @keyframes focusgoals-slide-in {
      from {
        transform: translateX(100px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .focusgoals-emergency {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      animation: focusgoals-pulse 2s ease-in-out infinite;
    }
    
    @keyframes focusgoals-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(indicator);
  
  // Atualizar timer a cada segundo
  const interval = setInterval(() => {
    const timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    
    if (timeLeft === 0) {
      clearInterval(interval);
      checkBlockStatus();
      return;
    }
    
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    const badge = document.querySelector('.focusgoals-badge');
    if (badge) {
      badge.textContent = `⚠️ Emergência: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }, 1000);
}

// Remover indicador
function removeFocusIndicator() {
  const indicator = document.getElementById('focusgoals-indicator');
  const style = document.getElementById('focusgoals-indicator-style');
  
  if (indicator) indicator.remove();
  if (style) style.remove();
}

// Listener de mudanças no storage
chrome.storage.onChanged.addListener((changes) => {
  if (changes.timerState || changes.emergencyMode) {
    checkBlockStatus();
  }
});

// Verificar ao carregar página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkBlockStatus);
} else {
  checkBlockStatus();
}

// Verificar periodicamente (caso timer mude)
setInterval(checkBlockStatus, 5000);
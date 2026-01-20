// Flag para evitar loops de redirecionamento
let isRedirecting = false;
let currentIndicatorType = null; // 'focus', 'emergency' ou null

// Verificar se página deve ser bloqueada
async function checkBlockStatus() {
  try {
    // Se estamos na página de bloqueio ou já redirecionando, não fazer nada
    if (window.location.href.includes('chrome-extension://') || isRedirecting) {
      return;
    }
    
    const data = await chrome.storage.local.get(['timerState', 'settings', 'emergencyMode']);
    
    const timerState = data.timerState || {};
    const settings = data.settings || { blockedSites: [] };
    const emergencyMode = data.emergencyMode || { active: false };
    
    // Se modo emergência está ativo, mostrar indicador
    if (emergencyMode.active && emergencyMode.endTime && Date.now() < emergencyMode.endTime) {
      showEmergencyIndicator(emergencyMode.endTime);
      return;
    }
    
    // Não bloquear se timer não está rodando ou está em pausa
    if (!timerState.isRunning || timerState.mode !== 'focus') {
      removeFocusIndicator();
      return;
    }
    
    // Verificar se URL atual está bloqueada
    const currentUrl = window.location.hostname.replace('www.', '');
    const isBlocked = settings.blockedSites.some(blocked => {
      return currentUrl.includes(blocked) || blocked.includes(currentUrl);
    });
    
    if (isBlocked) {
      // Marcar que estamos redirecionando
      isRedirecting = true;
      
      // Salvar URL original antes de redirecionar
      await chrome.storage.local.set({ 
        blockedUrl: window.location.href 
      });
      
      // Redirecionar para página de bloqueio
      window.location.replace(chrome.runtime.getURL('blocked.html'));
    } else {
      // Mostrar indicador de foco se não estiver bloqueado
      showFocusIndicator();
    }
  } catch (error) {
    console.error('Erro ao verificar bloqueio:', error);
    isRedirecting = false;
  }
}

// Mostrar indicador de modo foco
function showFocusIndicator() {
  // Se já está mostrando indicador de foco, não fazer nada
  if (currentIndicatorType === 'focus') {
    return;
  }
  
  // Remover qualquer indicador existente
  removeFocusIndicator();
  
  currentIndicatorType = 'focus';
  
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
    }
    
    .focusgoals-emergency {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(indicator);
}

// Mostrar indicador de modo emergência
function showEmergencyIndicator(endTime) {
  // Se já está mostrando emergência, só atualizar o tempo
  if (currentIndicatorType === 'emergency') {
    updateEmergencyTimer(endTime);
    return;
  }
  
  // Remover qualquer indicador existente
  removeFocusIndicator();
  
  currentIndicatorType = 'emergency';
  
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
    }
    
    .focusgoals-emergency {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(indicator);
  
  // Iniciar atualização do timer
  startEmergencyTimer(endTime);
}

// Atualizar timer de emergência (sem recriar o elemento)
function updateEmergencyTimer(endTime) {
  const badge = document.querySelector('.focusgoals-badge');
  if (!badge) return;
  
  const timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  badge.textContent = `⚠️ Emergência: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Intervalo global para timer de emergência
let emergencyTimerInterval = null;

// Iniciar timer de emergência
function startEmergencyTimer(endTime) {
  // Limpar qualquer timer existente
  if (emergencyTimerInterval) {
    clearInterval(emergencyTimerInterval);
  }
  
  // Atualizar a cada segundo
  emergencyTimerInterval = setInterval(() => {
    const timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    
    if (timeLeft === 0) {
      clearInterval(emergencyTimerInterval);
      emergencyTimerInterval = null;
      removeFocusIndicator();
      return;
    }
    
    updateEmergencyTimer(endTime);
  }, 1000);
}

// Remover indicador
function removeFocusIndicator() {
  const indicator = document.getElementById('focusgoals-indicator');
  const style = document.getElementById('focusgoals-indicator-style');
  
  if (indicator) indicator.remove();
  if (style) style.remove();
  
  // Limpar timer de emergência se existir
  if (emergencyTimerInterval) {
    clearInterval(emergencyTimerInterval);
    emergencyTimerInterval = null;
  }
  
  currentIndicatorType = null;
}

// Listener de mudanças no storage
chrome.storage.onChanged.addListener((changes) => {
  if (changes.timerState || changes.emergencyMode) {
    isRedirecting = false;
    checkBlockStatus();
  }
});

// Verificar ao carregar página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkBlockStatus);
} else {
  checkBlockStatus();
}

// Verificar periodicamente
setInterval(checkBlockStatus, 3000);
// Estado global do background
let timerState = null;
let settings = null;
let stats = null;

// Inicialização quando extensão é instalada/atualizada
chrome.runtime.onInstalled.addListener(async () => {
  console.log('FocusGoals instalado!');
  await initializeDefaultSettings();
  await requestHostPermissions();
  await loadData();
  setupAlarms();
});

// Inicialização quando browser inicia
chrome.runtime.onStartup.addListener(async () => {
  await loadData();
  setupAlarms();
});

// Solicitar permissões de host na primeira vez
async function requestHostPermissions() {
  const hasPermission = await chrome.permissions.contains({
    origins: ['<all_urls>']
  });
  
  if (!hasPermission) {
    console.log('Solicitando permissões de host...');
    // Usuário verá popup de permissão na instalação
    try {
      await chrome.permissions.request({
        origins: ['<all_urls>']
      });
    } catch (error) {
      console.log('Usuário negou permissões de host');
    }
  }
}

// Garantir que settings padrão existam
async function initializeDefaultSettings() {
  const data = await chrome.storage.local.get(['settings']);
  
  if (!data.settings) {
    const defaultSettings = {
      focusDuration: 25,
      breakDuration: 5,
      dailyPomodoroGoal: 6,
      dailyFocusGoal: 3,
      blockedSites: [
        'facebook.com',
        'instagram.com',
        'twitter.com',
        'youtube.com',
        'reddit.com',
        'tiktok.com'
      ],
      soundEnabled: true
    };
    
    await chrome.storage.local.set({ settings: defaultSettings });
    console.log('Settings padrão criadas:', defaultSettings);
  }
}

// Carregar dados do storage
async function loadData() {
  const data = await chrome.storage.local.get(['timerState', 'settings', 'stats']);
  
  timerState = data.timerState || {
    isRunning: false,
    isPaused: false,
    mode: 'focus',
    timeLeft: 25 * 60,
    startTime: null
  };
  
  settings = data.settings || {
    focusDuration: 25,
    breakDuration: 5,
    dailyPomodoroGoal: 6,
    dailyFocusGoal: 3,
    blockedSites: [
      'facebook.com',
      'instagram.com',
      'twitter.com',
      'youtube.com',
      'reddit.com',
      'tiktok.com'
    ],
    soundEnabled: true
  };
  
  stats = data.stats || {
    today: {
      date: new Date().toDateString(),
      pomodoros: 0,
      focusTime: 0
    },
    week: {
      pomodoros: 0
    },
    streak: 0,
    history: []
  };
}

// Injetar content script em todas as abas quando timer inicia
async function injectContentScripts() {
  try {
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      // Não injetar em páginas internas do Chrome
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (error) {
          // Silenciosamente ignorar erros (algumas páginas não permitem injeção)
        }
      }
    }
  } catch (error) {
    console.error('Erro ao injetar content scripts:', error);
  }
}

// Remover content scripts quando timer para
async function removeContentScripts() {
  // O content script vai se auto-remover ao detectar que timer parou
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      chrome.tabs.sendMessage(tab.id, { action: 'removeIndicator' });
    } catch (error) {
      // Ignorar erros
    }
  }
}

// Configurar alarmes
function setupAlarms() {
  // Alarme principal - verifica timer a cada segundo
  chrome.alarms.create('timerTick', { periodInMinutes: 1/60 });
  
  // Alarme de reset diário - meia-noite
  chrome.alarms.create('dailyReset', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60
  });
}

// Obter próximo horário de meia-noite
function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

// Listener de alarmes
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'timerTick') {
    await handleTimerTick();
  } else if (alarm.name === 'dailyReset') {
    await handleDailyReset();
  } else if (alarm.name === 'emergencyEnd') {
    await handleEmergencyEnd();
  }
});

// Processar tick do timer
async function handleTimerTick() {
  if (!timerState.isRunning) return;
  
  const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
  const timeLeft = Math.max(0, timerState.timeLeft - elapsed);
  
  // Timer terminou
  if (timeLeft === 0) {
    await handleTimerComplete();
    return;
  }
  
  // Atualizar tempo de foco se estiver em modo foco
  if (timerState.mode === 'focus') {
    stats.today.focusTime += 1;
    await chrome.storage.local.set({ stats });
  }
}

// Timer completado
async function handleTimerComplete() {
  const wasInFocus = timerState.mode === 'focus';
  
  // Se terminou pomodoro de foco
  if (wasInFocus) {
    stats.today.pomodoros++;
    stats.week.pomodoros++;
    await chrome.storage.local.set({ stats });
    
    // Notificação
    await showNotification(
      'Pomodoro Completo! 🎉',
      `Você completou ${stats.today.pomodoros} pomodoro(s) hoje. Hora de uma pausa!`
    );
    
    // Tocar som se habilitado
    if (settings.soundEnabled) {
      playSound();
    }
    
    // Mudar para modo break E INICIAR AUTOMATICAMENTE
    timerState.mode = 'break';
    timerState.timeLeft = settings.breakDuration * 60;
    timerState.isRunning = true;
    timerState.isPaused = false;
    timerState.startTime = Date.now();
    
    // Remover content scripts (não precisa mais bloquear)
    await removeContentScripts();
  } else {
    // Terminou pausa
    await showNotification(
      'Pausa Finalizada! ⚡',
      'Pronto para mais uma sessão de foco?'
    );
    
    if (settings.soundEnabled) {
      playSound();
    }
    
    // Mudar para modo focus mas NÃO iniciar automaticamente
    timerState.mode = 'focus';
    timerState.timeLeft = settings.focusDuration * 60;
    timerState.isRunning = false;
    timerState.isPaused = false;
    timerState.startTime = null;
  }
  
  await chrome.storage.local.set({ timerState });
}

// Fim da emergência - REATIVAR TIMER
async function handleEmergencyEnd() {
  const data = await chrome.storage.local.get(['emergencyMode', 'timerState']);
  
  if (data.emergencyMode && data.emergencyMode.active) {
    // Restaurar estado do timer pausado
    const pausedState = data.emergencyMode.pausedTimerState;
    
    if (pausedState) {
      // Reativar timer do ponto onde parou
      timerState = {
        ...pausedState,
        isRunning: true,
        isPaused: false,
        startTime: Date.now()
      };
      
      await chrome.storage.local.set({ timerState });
      
      // Reinjetar content scripts
      await injectContentScripts();
    }
    
    // Remover modo emergência
    await chrome.storage.local.remove('emergencyMode');
    
    // Notificação
    await showNotification(
      'Emergência Finalizada ⚠️',
      'Timer reativado! Foco voltou.'
    );
  }
}

// Mostrar notificação
async function showNotification(title, message) {
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}

// Tocar som (abrir página invisível com áudio)
function playSound() {
  chrome.tabs.create({ url: 'notification-sound.html', active: false }, (tab) => {
    setTimeout(() => {
      chrome.tabs.remove(tab.id);
    }, 2000);
  });
}

// Reset diário
async function handleDailyReset() {
  await loadData();
  
  const today = new Date().toDateString();
  
  // Salvar histórico
  if (stats.today.pomodoros > 0) {
    stats.history.push({
      date: stats.today.date,
      pomodoros: stats.today.pomodoros,
      focusTime: stats.today.focusTime
    });
    
    if (stats.history.length > 30) {
      stats.history = stats.history.slice(-30);
    }
    
    // Atualizar streak
    if (stats.today.pomodoros >= settings.dailyPomodoroGoal) {
      stats.streak++;
    } else {
      stats.streak = 0;
    }
  }
  
  // Reset semanal (domingo)
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0) {
    stats.week.pomodoros = 0;
  }
  
  // Reset dia
  stats.today = {
    date: today,
    pomodoros: 0,
    focusTime: 0
  };
  
  await chrome.storage.local.set({ stats });
}

// Listener de mensagens do popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'syncTimer') {
    await loadData();
    
    // Se timer acabou de iniciar em modo foco, injetar content scripts
    if (timerState.isRunning && timerState.mode === 'focus') {
      await injectContentScripts();
    } else {
      await removeContentScripts();
    }
  }
  
  if (message.action === 'getState') {
    sendResponse({ timerState, settings, stats });
  }
  
  return true;
});

// Listener para quando novas abas são criadas (injetar script se timer ativo)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && timerState && timerState.isRunning && timerState.mode === 'focus') {
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
      } catch (error) {
        // Ignorar erros
      }
    }
  }
});

// Atualizar ícone baseado no estado
async function updateIcon() {
  await loadData();
  
  let badgeText = '';
  let badgeColor = '#667eea';
  
  if (timerState.isRunning) {
    if (timerState.mode === 'focus') {
      badgeText = '🍅';
      badgeColor = '#ef4444';
    } else {
      badgeText = '☕';
      badgeColor = '#10b981';
    }
  }
  
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
}

// Atualizar ícone periodicamente
setInterval(updateIcon, 1000);

// Inicializar
loadData();

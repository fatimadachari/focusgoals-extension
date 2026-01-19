// Estado global do background
let timerState = null;
let settings = null;
let stats = null;

// Inicialização quando extensão é instalada/atualizada
chrome.runtime.onInstalled.addListener(async () => {
  console.log('FocusGoals instalado!');
  await loadData();
  setupAlarms();
});

// Inicialização quando browser inicia
chrome.runtime.onStartup.addListener(async () => {
  await loadData();
  setupAlarms();
});

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
    
    // Mudar para modo break
    timerState.mode = 'break';
    timerState.timeLeft = settings.breakDuration * 60;
  } else {
    // Terminou pausa
    await showNotification(
      'Pausa Finalizada! ⚡',
      'Pronto para mais uma sessão de foco?'
    );
    
    if (settings.soundEnabled) {
      playSound();
    }
    
    // Mudar para modo focus
    timerState.mode = 'focus';
    timerState.timeLeft = settings.focusDuration * 60;
  }
  
  // Parar timer automaticamente
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.startTime = null;
  
  await chrome.storage.local.set({ timerState });
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
  // Usar API de áudio nativa do browser via offscreen document
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
  if (dayOfWeek === 0) { // Domingo
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

// Verificar se URL deve ser bloqueada
function shouldBlockUrl(url) {
  if (!timerState.isRunning || timerState.mode !== 'focus') {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    return settings.blockedSites.some(blocked => {
      return hostname.includes(blocked) || blocked.includes(hostname);
    });
  } catch (e) {
    return false;
  }
}

// Listener de requisições web (bloqueio de sites)
// chrome.webRequest.onBeforeRequest.addListener(
//   (details) => {
//     if (shouldBlockUrl(details.url)) {
//       // Redirecionar para página de bloqueio
//       return { redirectUrl: chrome.runtime.getURL('blocked.html') };
//     }
//   },
//   { urls: ['<all_urls>'] },
//   ['blocking']
// );

// Listener de mensagens do popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'syncTimer') {
    await loadData();
  }
  
  if (message.action === 'getState') {
    sendResponse({ timerState, settings, stats });
  }
  
  return true;
});

// Listener de tabs (verificar bloqueio ao navegar)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    await loadData();
    
    if (shouldBlockUrl(tab.url)) {
      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL('blocked.html')
      });
    }
  }
});

// Atualizar ícone baseado no estado
async function updateIcon() {
  await loadData();
  
  let iconPath = 'icons/icon48.png';
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
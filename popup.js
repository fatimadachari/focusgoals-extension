// Elementos DOM
const timerDisplay = document.getElementById('timerDisplay');
const timerLabel = document.getElementById('timerLabel');
const btnToggleTimer = document.getElementById('btnToggleTimer');
const btnSkipBreak = document.getElementById('btnSkipBreak');
const pomodorosValue = document.getElementById('pomodorosValue');
const pomodorosProgress = document.getElementById('pomodorosProgress');
const focusTimeValue = document.getElementById('focusTimeValue');
const focusTimeProgress = document.getElementById('focusTimeProgress');
const todayPomodoros = document.getElementById('todayPomodoros');
const weekPomodoros = document.getElementById('weekPomodoros');
const streakDays = document.getElementById('streakDays');
const btnSettings = document.getElementById('btnSettings');
const btnStats = document.getElementById('btnStats');
const btnReset = document.getElementById('btnReset');

// Estado local
let timerState = null;
let settings = null;
let stats = null;

// Inicialização
async function init() {
  await loadData();
  updateUI();
  setupEventListeners();
  startUIUpdateInterval();
}

// Carregar dados do storage
async function loadData() {
  const data = await chrome.storage.local.get(['timerState', 'settings', 'stats']);
  
  timerState = data.timerState || {
    isRunning: false,
    isPaused: false,
    mode: 'focus', // 'focus' ou 'break'
    timeLeft: 25 * 60,
    startTime: null
  };
  
  settings = data.settings || {
    focusDuration: 25,
    breakDuration: 5,
    dailyPomodoroGoal: 6,
    dailyFocusGoal: 3, // horas
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
      focusTime: 0 // em segundos
    },
    week: {
      pomodoros: 0
    },
    streak: 0,
    history: []
  };
  
  // Reset se for novo dia
  const today = new Date().toDateString();
  if (stats.today.date !== today) {
    // Salvar histórico do dia anterior se teve progresso
    if (stats.today.pomodoros > 0) {
      stats.history.push({
        date: stats.today.date,
        pomodoros: stats.today.pomodoros,
        focusTime: stats.today.focusTime
      });
      
      // Manter apenas últimos 30 dias
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
    
    // Reset dia
    stats.today = {
      date: today,
      pomodoros: 0,
      focusTime: 0
    };
    
    await chrome.storage.local.set({ stats });
  }
}

// Atualizar interface
function updateUI() {
  // Timer
  updateTimerDisplay();
  
  // Botão principal
  if (timerState.isRunning) {
    btnToggleTimer.textContent = '⏸ Pausar';
    btnToggleTimer.classList.add('active');
  } else if (timerState.isPaused) {
    btnToggleTimer.textContent = '▶ Continuar';
    btnToggleTimer.classList.remove('active');
  } else {
    btnToggleTimer.textContent = '▶ Iniciar Foco';
    btnToggleTimer.classList.remove('active');
  }
  
  // Botão pular pausa (só aparece durante break)
  if (timerState.mode === 'break' && timerState.isRunning) {
    btnSkipBreak.classList.remove('hidden');
  } else {
    btnSkipBreak.classList.add('hidden');
  }
  
  // Label do timer
  if (timerState.mode === 'focus') {
    timerLabel.textContent = timerState.isRunning ? 'Focando...' : 'Pronto para focar';
  } else {
    timerLabel.textContent = timerState.isRunning ? 'Pausa em andamento' : 'Pausa';
  }
  
  // Metas
  const pomodoroPercent = Math.min((stats.today.pomodoros / settings.dailyPomodoroGoal) * 100, 100);
  pomodorosValue.textContent = `${stats.today.pomodoros}/${settings.dailyPomodoroGoal}`;
  pomodorosProgress.style.width = `${pomodoroPercent}%`;
  
  const focusHours = Math.floor(stats.today.focusTime / 3600);
  const focusPercent = Math.min((focusHours / settings.dailyFocusGoal) * 100, 100);
  focusTimeValue.textContent = `${focusHours}h/${settings.dailyFocusGoal}h`;
  focusTimeProgress.style.width = `${focusPercent}%`;
  
  // Estatísticas
  todayPomodoros.textContent = stats.today.pomodoros;
  weekPomodoros.textContent = stats.week.pomodoros;
  streakDays.textContent = stats.streak;
}

// Atualizar display do timer
function updateTimerDisplay() {
  let timeToShow = timerState.timeLeft;
  
  // Se timer está rodando, calcular tempo atual
  if (timerState.isRunning && timerState.startTime) {
    const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
    timeToShow = Math.max(0, timerState.timeLeft - elapsed);
  }
  
  const minutes = Math.floor(timeToShow / 60);
  const seconds = timeToShow % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Event Listeners
function setupEventListeners() {
  btnToggleTimer.addEventListener('click', handleToggleTimer);
  btnSkipBreak.addEventListener('click', handleSkipBreak);
  btnReset.addEventListener('click', handleReset);
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  btnStats.addEventListener('click', () => {
    chrome.tabs.create({ url: 'stats.html' });
  });
  
  // Listener para mudanças no storage (sincronizar com background)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.timerState) {
      timerState = changes.timerState.newValue;
      updateUI();
    }
    if (changes.stats) {
      stats = changes.stats.newValue;
      updateUI();
    }
  });
}

// Toggle timer (iniciar/pausar)
async function handleToggleTimer() {
  if (timerState.isRunning) {
    // Pausar
    const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
    timerState.timeLeft = Math.max(0, timerState.timeLeft - elapsed);
    timerState.isRunning = false;
    timerState.isPaused = true;
    timerState.startTime = null;
  } else {
    // Iniciar/Continuar
    timerState.isRunning = true;
    timerState.isPaused = false;
    timerState.startTime = Date.now();
    
    // Se estava zerado, resetar para duração completa
    if (timerState.timeLeft === 0) {
      timerState.timeLeft = timerState.mode === 'focus' 
        ? settings.focusDuration * 60 
        : settings.breakDuration * 60;
    }
  }
  
  await chrome.storage.local.set({ timerState });
  chrome.runtime.sendMessage({ action: 'syncTimer' });
  updateUI();
}

// Pular pausa
async function handleSkipBreak() {
  timerState.mode = 'focus';
  timerState.timeLeft = settings.focusDuration * 60;
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.startTime = null;
  
  await chrome.storage.local.set({ timerState });
  chrome.runtime.sendMessage({ action: 'syncTimer' });
  updateUI();
}

// Reset do dia
async function handleReset() {
  if (!confirm('Resetar progresso do dia? Esta ação não pode ser desfeita.')) {
    return;
  }
  
  stats.today.pomodoros = 0;
  stats.today.focusTime = 0;
  
  await chrome.storage.local.set({ stats });
  updateUI();
}

// Atualizar UI a cada segundo
function startUIUpdateInterval() {
  setInterval(() => {
    if (timerState.isRunning) {
      updateTimerDisplay();
    }
  }, 1000);
}

// Iniciar
init();
// Elementos DOM
const timeRemaining = document.getElementById('timeRemaining');
const pomodorosCompleted = document.getElementById('pomodorosCompleted');
const pomodorosBar = document.getElementById('pomodorosBar');
const focusTimeTotal = document.getElementById('focusTimeTotal');
const focusTimeBar = document.getElementById('focusTimeBar');
const quoteElement = document.getElementById('quote');
const btnBack = document.getElementById('btnBack');
const btnEmergency = document.getElementById('btnEmergency');
const emergencyTimer = document.getElementById('emergencyTimer');
const emergencyTimeLeft = document.getElementById('emergencyTimeLeft');

// Frases motivacionais
const quotes = [
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "A disciplina é a ponte entre metas e conquistas.",
  "Foco é a arte de saber o que ignorar.",
  "Sua única limitação é você mesmo.",
  "Grandes coisas nunca vêm de zonas de conforto.",
  "O futuro depende do que você faz hoje.",
  "Concentração é o segredo de toda força.",
  "Não conte os dias, faça os dias contarem.",
  "O foco traz clareza. A clareza traz resultados.",
  "Distração é o inimigo da excelência."
];

// Estado
let timerState = null;
let settings = null;
let stats = null;
let emergencyMode = false;
let emergencyEndTime = null;

// Inicialização
async function init() {
  await loadData();
  updateUI();
  setupEventListeners();
  startUpdateInterval();
  showRandomQuote();
}

// Carregar dados
async function loadData() {
  const data = await chrome.storage.local.get(['timerState', 'settings', 'stats', 'emergencyMode']);
  
  timerState = data.timerState || { timeLeft: 0 };
  settings = data.settings || { dailyPomodoroGoal: 6, dailyFocusGoal: 3 };
  stats = data.stats || { today: { pomodoros: 0, focusTime: 0 } };
  
  // Verificar modo emergência
  if (data.emergencyMode && data.emergencyMode.active) {
    emergencyMode = true;
    emergencyEndTime = data.emergencyMode.endTime;
    
    // Verificar se ainda está ativo
    if (Date.now() >= emergencyEndTime) {
      emergencyMode = false;
      await chrome.storage.local.remove('emergencyMode');
    }
  }
}

// Atualizar interface
function updateUI() {
  // Timer restante
  updateTimeDisplay();
  
  // Progresso de pomodoros
  const pomodoroPercent = Math.min((stats.today.pomodoros / settings.dailyPomodoroGoal) * 100, 100);
  pomodorosCompleted.textContent = `${stats.today.pomodoros}/${settings.dailyPomodoroGoal}`;
  pomodorosBar.style.width = `${pomodoroPercent}%`;
  
  // Tempo de foco
  const focusHours = Math.floor(stats.today.focusTime / 3600);
  const focusPercent = Math.min((focusHours / settings.dailyFocusGoal) * 100, 100);
  focusTimeTotal.textContent = `${focusHours}h/${settings.dailyFocusGoal}h`;
  focusTimeBar.style.width = `${focusPercent}%`;
  
  // Modo emergência
  if (emergencyMode) {
    btnEmergency.disabled = true;
    btnEmergency.textContent = '⏳ Emergência Ativa';
    emergencyTimer.classList.remove('hidden');
  } else {
    btnEmergency.disabled = false;
    btnEmergency.textContent = '🆘 Emergência (5min)';
    emergencyTimer.classList.add('hidden');
  }
}

// Atualizar display de tempo
function updateTimeDisplay() {
  let timeToShow = timerState.timeLeft;
  
  if (timerState.isRunning && timerState.startTime) {
    const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
    timeToShow = Math.max(0, timerState.timeLeft - elapsed);
  }
  
  const minutes = Math.floor(timeToShow / 60);
  const seconds = timeToShow % 60;
  timeRemaining.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Atualizar timer de emergência
  if (emergencyMode && emergencyEndTime) {
    const emergencyLeft = Math.max(0, Math.floor((emergencyEndTime - Date.now()) / 1000));
    const eMinutes = Math.floor(emergencyLeft / 60);
    const eSeconds = emergencyLeft % 60;
    emergencyTimeLeft.textContent = `${String(eMinutes).padStart(2, '0')}:${String(eSeconds).padStart(2, '0')}`;
    
    if (emergencyLeft === 0) {
      window.close();
    }
  }
}

// Mostrar frase aleatória
function showRandomQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  quoteElement.textContent = quotes[randomIndex];
}

// Event Listeners
function setupEventListeners() {
  btnBack.addEventListener('click', () => {
    window.history.back();
  });
  
  btnEmergency.addEventListener('click', handleEmergency);
  
  // Listener de mudanças no storage
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.timerState || changes.stats || changes.emergencyMode) {
      loadData().then(() => updateUI());
    }
  });
}

// Ativar modo emergência
async function handleEmergency() {
  if (!confirm('Modo emergência libera acesso por 5 minutos. Usar apenas em caso de necessidade real. Confirmar?')) {
    return;
  }
  
  emergencyMode = true;
  emergencyEndTime = Date.now() + (5 * 60 * 1000); // 5 minutos
  
  await chrome.storage.local.set({
    emergencyMode: {
      active: true,
      endTime: emergencyEndTime
    }
  });
  
  updateUI();
  
  // Fechar página de bloqueio e permitir navegação
  window.close();
}

// Atualizar UI periodicamente
function startUpdateInterval() {
  setInterval(() => {
    updateTimeDisplay();
  }, 1000);
}

// Iniciar
init();
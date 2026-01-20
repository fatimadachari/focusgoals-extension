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
let blockedUrl = '';

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
    const data = await chrome.storage.local.get(['timerState', 'settings', 'stats', 'blockedUrl']);

    timerState = data.timerState || { timeLeft: 0 };
    settings = data.settings || { dailyPomodoroGoal: 6, dailyFocusGoal: 3 };
    stats = data.stats || { today: { pomodoros: 0, focusTime: 0 } };
    blockedUrl = data.blockedUrl || '';
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
    const totalMinutes = Math.floor(stats.today.focusTime / 60);
    const focusHours = Math.floor(totalMinutes / 60);
    const focusMinutes = totalMinutes % 60;

    const goalMinutes = settings.dailyFocusGoal * 60;
    const focusPercent = Math.min((totalMinutes / goalMinutes) * 100, 100);

    let focusTimeText = '';
    if (focusHours > 0) {
        focusTimeText = focusMinutes > 0
            ? `${focusHours}h ${focusMinutes}min/${settings.dailyFocusGoal}h`
            : `${focusHours}h/${settings.dailyFocusGoal}h`;
    } else {
        focusTimeText = `${focusMinutes}min/${settings.dailyFocusGoal}h`;
    }

    focusTimeTotal.textContent = focusTimeText;
    focusTimeBar.style.width = `${focusPercent}%`;
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
}

// Mostrar frase aleatória
function showRandomQuote() {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    quoteElement.textContent = quotes[randomIndex];
}

// Event Listeners
function setupEventListeners() {
    btnBack.addEventListener('click', handleBack);
    btnEmergency.addEventListener('click', handleEmergency);

    // Listener de mudanças no storage
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.timerState || changes.stats) {
            loadData().then(() => updateUI());
        }
    });
}

// Voltar
async function handleBack() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tabs.length > 0) {
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        if (allTabs.length > 1) {
            chrome.tabs.remove(tabs[0].id);
        } else {
            chrome.tabs.update(tabs[0].id, { url: 'chrome://newtab' });
        }
    }
}

// Ativar modo emergência - PAUSAR TIMER
async function handleEmergency() {
    if (!confirm('Modo emergência pausa o timer por 5 minutos. Usar apenas em caso de necessidade real. Confirmar?')) {
        return;
    }

    // Calcular tempo restante do timer
    let timeLeft = timerState.timeLeft;
    if (timerState.isRunning && timerState.startTime) {
        const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
        timeLeft = Math.max(0, timerState.timeLeft - elapsed);
    }

    // Pausar timer
    timerState.isRunning = false;
    timerState.isPaused = true;
    timerState.timeLeft = timeLeft;
    timerState.startTime = null;

    await chrome.storage.local.set({ timerState });

    // Configurar emergência (5 minutos)
    const emergencyEndTime = Date.now() + (5 * 60 * 1000);

    await chrome.storage.local.set({
        emergencyMode: {
            active: true,
            endTime: emergencyEndTime,
            pausedTimerState: { ...timerState }
        }
    });

    // Criar alarme para reativar timer após 5 minutos
    chrome.alarms.create('emergencyEnd', {
        when: emergencyEndTime
    });

    // Redirecionar para URL bloqueada
    if (blockedUrl) {
        window.location.href = blockedUrl;
    } else {
        window.close();
    }
}

// Atualizar UI periodicamente
function startUpdateInterval() {
    setInterval(() => {
        updateTimeDisplay();
    }, 1000);
}

// Iniciar
init();
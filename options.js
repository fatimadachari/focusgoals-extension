// Elementos DOM
const focusDuration = document.getElementById('focusDuration');
const focusValue = document.getElementById('focusValue');
const breakDuration = document.getElementById('breakDuration');
const breakValue = document.getElementById('breakValue');
const dailyPomodoroGoal = document.getElementById('dailyPomodoroGoal');
const pomodoroGoalValue = document.getElementById('pomodoroGoalValue');
const dailyFocusGoal = document.getElementById('dailyFocusGoal');
const focusGoalValue = document.getElementById('focusGoalValue');
const blockedSitesList = document.getElementById('blockedSitesList');
const newSiteInput = document.getElementById('newSiteInput');
const btnAddSite = document.getElementById('btnAddSite');
const soundEnabled = document.getElementById('soundEnabled');
const btnReset = document.getElementById('btnReset');
const btnSave = document.getElementById('btnSave');
const btnClose = document.getElementById('btnClose');
const saveMessage = document.getElementById('saveMessage');

// Estado
let settings = null;
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

// Inicialização
async function init() {
  await loadSettings();
  updateUI();
  setupEventListeners();
}

// Carregar configurações
async function loadSettings() {
  const data = await chrome.storage.local.get(['settings']);
  settings = data.settings || { ...defaultSettings };
}

// Atualizar interface
function updateUI() {
  // Sliders
  focusDuration.value = settings.focusDuration;
  focusValue.textContent = settings.focusDuration;
  
  breakDuration.value = settings.breakDuration;
  breakValue.textContent = settings.breakDuration;
  
  dailyPomodoroGoal.value = settings.dailyPomodoroGoal;
  pomodoroGoalValue.textContent = settings.dailyPomodoroGoal;
  
  dailyFocusGoal.value = settings.dailyFocusGoal;
  focusGoalValue.textContent = settings.dailyFocusGoal;
  
  // Som
  soundEnabled.checked = settings.soundEnabled;
  
  // Sites bloqueados
  renderBlockedSites();
  updatePresetButtons();
}

// Renderizar lista de sites bloqueados
function renderBlockedSites() {
  if (settings.blockedSites.length === 0) {
    blockedSitesList.innerHTML = '<p style="text-align: center; opacity: 0.6; padding: 20px;">Nenhum site bloqueado.</p>';
    return;
  }
  
  blockedSitesList.innerHTML = settings.blockedSites.map(site => `
    <div class="site-item">
      <span class="site-name">${site}</span>
      <button class="btn-remove" data-site="${site}">✕ Remover</button>
    </div>
  `).join('');
  
  // Event listeners para botões de remover
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const site = btn.getAttribute('data-site');
      removeSite(site);
    });
  });
}

// Atualizar botões preset
function updatePresetButtons() {
  document.querySelectorAll('.btn-preset').forEach(btn => {
    const site = btn.getAttribute('data-site');
    if (settings.blockedSites.includes(site)) {
      btn.classList.add('added');
      btn.disabled = true;
    } else {
      btn.classList.remove('added');
      btn.disabled = false;
    }
  });
}

// Adicionar site
function addSite(site) {
  // Limpar e validar
  site = site.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
  
  if (!site) {
    alert('Digite um site válido.');
    return;
  }
  
  if (settings.blockedSites.includes(site)) {
    alert('Este site já está na lista.');
    return;
  }
  
  settings.blockedSites.push(site);
  renderBlockedSites();
  updatePresetButtons();
  newSiteInput.value = '';
}

// Remover site
function removeSite(site) {
  settings.blockedSites = settings.blockedSites.filter(s => s !== site);
  renderBlockedSites();
  updatePresetButtons();
}

// Event Listeners
function setupEventListeners() {
  // Sliders - atualizar valores em tempo real
  focusDuration.addEventListener('input', (e) => {
    focusValue.textContent = e.target.value;
  });
  
  breakDuration.addEventListener('input', (e) => {
    breakValue.textContent = e.target.value;
  });
  
  dailyPomodoroGoal.addEventListener('input', (e) => {
    pomodoroGoalValue.textContent = e.target.value;
  });
  
  dailyFocusGoal.addEventListener('input', (e) => {
    focusGoalValue.textContent = e.target.value;
  });
  
  // Adicionar site
  btnAddSite.addEventListener('click', () => {
    addSite(newSiteInput.value);
  });
  
  newSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addSite(newSiteInput.value);
    }
  });
  
  // Botões preset
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const site = btn.getAttribute('data-site');
      addSite(site);
    });
  });
  
  // Salvar
  btnSave.addEventListener('click', handleSave);
  
  // Reset
  btnReset.addEventListener('click', handleReset);
  
  // Fechar
  btnClose.addEventListener('click', () => {
    window.close();
  });
}

// Salvar configurações
async function handleSave() {
  // Atualizar settings com valores dos inputs
  settings.focusDuration = parseInt(focusDuration.value);
  settings.breakDuration = parseInt(breakDuration.value);
  settings.dailyPomodoroGoal = parseInt(dailyPomodoroGoal.value);
  settings.dailyFocusGoal = parseInt(dailyFocusGoal.value);
  settings.soundEnabled = soundEnabled.checked;
  
  // Salvar no storage
  await chrome.storage.local.set({ settings });
  
  // Mostrar mensagem de sucesso
  saveMessage.classList.remove('hidden');
  setTimeout(() => {
    saveMessage.classList.add('hidden');
  }, 3000);
  
  // Notificar background para recarregar
  chrome.runtime.sendMessage({ action: 'settingsUpdated' });
}

// Restaurar padrões
async function handleReset() {
  if (!confirm('Restaurar todas as configurações para os valores padrão?')) {
    return;
  }
  
  settings = { ...defaultSettings };
  await chrome.storage.local.set({ settings });
  
  updateUI();
  
  saveMessage.textContent = '✓ Configurações restauradas!';
  saveMessage.classList.remove('hidden');
  setTimeout(() => {
    saveMessage.textContent = '✓ Configurações salvas com sucesso!';
    saveMessage.classList.add('hidden');
  }, 3000);
}

// Iniciar
init();
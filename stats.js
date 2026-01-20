// Elementos DOM
const totalPomodoros = document.getElementById('totalPomodoros');
const totalHours = document.getElementById('totalHours');
const currentStreak = document.getElementById('currentStreak');
const avgPerDay = document.getElementById('avgPerDay');
const todayPomodoros = document.getElementById('todayPomodoros');
const todayPomodorosBar = document.getElementById('todayPomodorosBar');
const todayFocusTime = document.getElementById('todayFocusTime');
const todayFocusBar = document.getElementById('todayFocusBar');
const goalPomodoros = document.getElementById('goalPomodoros');
const goalFocusTime = document.getElementById('goalFocusTime');
const historyTable = document.getElementById('historyTable');
const btnClose = document.getElementById('btnClose');
const btnExport = document.getElementById('btnExport');
const btnSettings = document.getElementById('btnSettings');

// Estado
let stats = null;
let settings = null;
let chart = null;

// Inicialização
async function init() {
  await loadData();
  updateUI();
  createChart();
  setupEventListeners();
}

// Carregar dados
async function loadData() {
  const data = await chrome.storage.local.get(['stats', 'settings']);

  stats = data.stats || {
    today: { date: new Date().toDateString(), pomodoros: 0, focusTime: 0 },
    week: { pomodoros: 0 },
    streak: 0,
    history: []
  };

  settings = data.settings || {
    dailyPomodoroGoal: 6,
    dailyFocusGoal: 3
  };
}

// Atualizar interface
function updateUI() {
  // Cards de resumo
  const allPomodoros = stats.today.pomodoros + stats.history.reduce((sum, day) => sum + day.pomodoros, 0);
  totalPomodoros.textContent = allPomodoros;

  const allFocusTime = stats.today.focusTime + stats.history.reduce((sum, day) => sum + day.focusTime, 0);
  const allHours = Math.floor(allFocusTime / 3600);
  totalHours.textContent = `${allHours}h`;

  currentStreak.textContent = stats.streak;

  const daysWithData = stats.history.length + (stats.today.pomodoros > 0 ? 1 : 0);
  const avg = daysWithData > 0 ? Math.round(allPomodoros / daysWithData) : 0;
  avgPerDay.textContent = avg;

  // Progresso de hoje
  const pomodoroPercent = Math.min((stats.today.pomodoros / settings.dailyPomodoroGoal) * 100, 100);
  todayPomodoros.textContent = `${stats.today.pomodoros}/${settings.dailyPomodoroGoal}`;
  todayPomodorosBar.style.width = `${pomodoroPercent}%`;

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

  todayFocusTime.textContent = focusTimeText;
  todayFocusBar.style.width = `${focusPercent}%`;
  
  // Metas
  goalPomodoros.textContent = `${settings.dailyPomodoroGoal} pomodoros`;
  goalFocusTime.textContent = `${settings.dailyFocusGoal} horas`;

  // Histórico detalhado
  renderHistory();
}

// Renderizar histórico
function renderHistory() {
  if (stats.history.length === 0) {
    historyTable.innerHTML = '<div class="table-empty">Nenhum histórico disponível ainda.</div>';
    return;
  }

  const reversedHistory = [...stats.history].reverse();

  historyTable.innerHTML = reversedHistory.map(day => {
    const hours = Math.floor(day.focusTime / 3600);
    const minutes = Math.floor((day.focusTime % 3600) / 60);

    return `
      <div class="history-item">
        <div class="history-date">${formatDate(day.date)}</div>
        <div class="history-stats">
          <div class="history-stat">
            <span>🍅</span>
            <span>${day.pomodoros}</span>
          </div>
          <div class="history-stat">
            <span>⏱️</span>
            <span>${hours}h ${minutes}m</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Formatar data
function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Hoje';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  } else {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}

// Criar gráfico
function createChart() {
  const canvas = document.getElementById('historyChart');
  const ctx = canvas.getContext('2d');

  // Preparar dados (últimos 7 dias)
  const last7Days = getLast7Days();
  const labels = last7Days.map(day => {
    const date = new Date(day.date);
    return date.toLocaleDateString('pt-BR', { weekday: 'short' });
  });

  const data = last7Days.map(day => day.pomodoros);

  // Configurar canvas
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  // Desenhar gráfico de barras
  drawBarChart(ctx, rect.width, rect.height, labels, data);
}

// Obter últimos 7 dias
function getLast7Days() {
  const days = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toDateString();

    // Verificar se é hoje
    if (i === 0) {
      days.push({
        date: dateString,
        pomodoros: stats.today.pomodoros
      });
    } else {
      // Procurar no histórico
      const historyDay = stats.history.find(h => h.date === dateString);
      days.push({
        date: dateString,
        pomodoros: historyDay ? historyDay.pomodoros : 0
      });
    }
  }

  return days;
}

// Desenhar gráfico de barras
function drawBarChart(ctx, width, height, labels, data) {
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = chartWidth / labels.length * 0.7;
  const barGap = chartWidth / labels.length * 0.3;

  const maxValue = Math.max(...data, 1);

  // Limpar canvas
  ctx.clearRect(0, 0, width, height);

  // Desenhar barras
  data.forEach((value, index) => {
    const barHeight = (value / maxValue) * chartHeight;
    const x = padding + index * (barWidth + barGap) + barGap / 2;
    const y = height - padding - barHeight;

    // Gradiente
    const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');

    // Barra
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Label (dia da semana)
    ctx.fillStyle = '#fff';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[index], x + barWidth / 2, height - padding + 20);

    // Valor
    if (value > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.fillText(value, x + barWidth / 2, y - 8);
    }
  });

  // Linha base
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();
}

// Event Listeners
function setupEventListeners() {
  btnClose.addEventListener('click', () => {
    window.close();
  });

  btnExport.addEventListener('click', handleExport);

  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// Exportar dados
async function handleExport() {
  const exportData = {
    stats,
    settings,
    exportDate: new Date().toISOString()
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `focusgoals-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

// Iniciar
init();
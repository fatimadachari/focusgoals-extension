// Tocar som de notificação usando Web Audio API
function playNotificationSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Criar som de sino/campanha (duas notas)
  const now = audioContext.currentTime;
  
  // Primeira nota (mais alta)
  const oscillator1 = audioContext.createOscillator();
  const gainNode1 = audioContext.createGain();
  
  oscillator1.connect(gainNode1);
  gainNode1.connect(audioContext.destination);
  
  oscillator1.frequency.value = 800; // Hz
  oscillator1.type = 'sine';
  
  gainNode1.gain.setValueAtTime(0.3, now);
  gainNode1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  
  oscillator1.start(now);
  oscillator1.stop(now + 0.5);
  
  // Segunda nota (mais baixa) - começa um pouco depois
  const oscillator2 = audioContext.createOscillator();
  const gainNode2 = audioContext.createGain();
  
  oscillator2.connect(gainNode2);
  gainNode2.connect(audioContext.destination);
  
  oscillator2.frequency.value = 600; // Hz
  oscillator2.type = 'sine';
  
  gainNode2.gain.setValueAtTime(0, now + 0.1);
  gainNode2.gain.setValueAtTime(0.3, now + 0.15);
  gainNode2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
  
  oscillator2.start(now + 0.1);
  oscillator2.stop(now + 0.7);
}

// Tocar som ao carregar
window.addEventListener('load', () => {
  playNotificationSound();
});
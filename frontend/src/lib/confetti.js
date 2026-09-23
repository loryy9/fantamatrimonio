import confetti from 'canvas-confetti';

export function fireCelebration() {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#f43f5e', '#ffffff', '#8b5cf6']
    });
  } catch (err) {
    console.error('Confetti error:', err);
  }
}

export function fireBigWin() {
  try {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    const interval = setInterval(function() {
      if (Date.now() > end) {
        return clearInterval(interval);
      }

      confetti({
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random(), y: Math.random() - 0.2 },
        colors: ['#f59e0b', '#fbbf24', '#f43f5e', '#ffffff', '#10b981']
      });
    }, 250);
  } catch (err) {
    console.error('Big win confetti error:', err);
  }
}

/**
 * Timer management for wedding game start and end countdowns.
 * Configured via Vite environment variables:
 * - VITE_ENABLE_TIMER: "true" | "false"
 * - VITE_START_TIME: "YYYY-MM-DDTHH:mm:ss" or "HH:mm"
 * - VITE_END_TIME: "YYYY-MM-DDTHH:mm:ss" or "HH:mm"
 */

function parseTimeToDate(timeStr) {
  if (!timeStr) return null;
  const str = timeStr.trim();

  // Check if HH:mm or HH:mm:ss format
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const now = new Date();
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
    return d;
  }

  // Otherwise parse as ISO date string
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function pad(num) {
  return String(num).padStart(2, '0');
}

function calcRemaining(targetDate, nowDate) {
  if (!targetDate) return { hours: '00', minutes: '00', seconds: '00', totalSeconds: 0, formatted: '00:00:00' };

  const diffMs = targetDate.getTime() - nowDate.getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
    totalSeconds,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  };
}

class EventTimer {
  now = $state(new Date());
  intervalId = null;

  constructor() {
    this.startClock();
  }

  startClock() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.now = new Date();
    }, 1000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  get isEnabled() {
    const envVal = import.meta.env.VITE_ENABLE_TIMER;
    return envVal === 'true' || envVal === '1' || envVal === true;
  }

  get startDate() {
    return parseTimeToDate(import.meta.env.VITE_START_TIME);
  }

  get endDate() {
    return parseTimeToDate(import.meta.env.VITE_END_TIME);
  }

  /**
   * 'disabled' | 'before_start' | 'in_progress' | 'ended'
   */
  get status() {
    if (!this.isEnabled) return 'disabled';
    const start = this.startDate;
    const end = this.endDate;

    if (!start && !end) return 'disabled';

    if (start && this.now < start) {
      return 'before_start';
    }

    if (end && this.now >= end) {
      return 'ended';
    }

    return 'in_progress';
  }

  get toStart() {
    return calcRemaining(this.startDate, this.now);
  }

  get toEnd() {
    return calcRemaining(this.endDate, this.now);
  }

  get startTimeFormatted() {
    const start = this.startDate;
    if (!start) return '';
    return `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  }

  get endTimeFormatted() {
    const end = this.endDate;
    if (!end) return '';
    return `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  }
}

export const eventTimer = new EventTimer();

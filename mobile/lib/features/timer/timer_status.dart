import '../auth/models.dart';

enum TimerStatus { disabled, beforeStart, inProgress, ended }

TimerStatus computeStatus(AppEvent event, DateTime now) {
  if (!event.enableTimer) return TimerStatus.disabled;
  final start = event.startTime;
  final end = event.endTime;
  if (start == null && end == null) return TimerStatus.disabled;

  if (start != null && now.isBefore(start)) return TimerStatus.beforeStart;
  if (end != null && !now.isBefore(end)) return TimerStatus.ended;
  return TimerStatus.inProgress;
}

class RemainingTime {
  final String hours;
  final String minutes;
  final String seconds;
  final int totalSeconds;
  final String formatted;

  RemainingTime({
    required this.hours,
    required this.minutes,
    required this.seconds,
    required this.totalSeconds,
    required this.formatted,
  });
}

String _pad(int n) => n.toString().padLeft(2, '0');

RemainingTime computeRemaining(DateTime? target, DateTime now) {
  if (target == null) {
    return RemainingTime(hours: '00', minutes: '00', seconds: '00', totalSeconds: 0, formatted: '00:00:00');
  }

  final diff = target.difference(now).inSeconds;
  final totalSeconds = diff < 0 ? 0 : diff;
  final h = totalSeconds ~/ 3600;
  final m = (totalSeconds % 3600) ~/ 60;
  final s = totalSeconds % 60;

  return RemainingTime(
    hours: _pad(h),
    minutes: _pad(m),
    seconds: _pad(s),
    totalSeconds: totalSeconds,
    formatted: '${_pad(h)}:${_pad(m)}:${_pad(s)}',
  );
}

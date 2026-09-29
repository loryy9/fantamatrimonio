import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_controller.dart';
import '../auth/models.dart';
import 'timer_status.dart';

class TimerTick {
  final TimerStatus status;
  final RemainingTime toStart;
  final RemainingTime toEnd;
  final String startTimeFormatted;
  final String endTimeFormatted;

  TimerTick({
    required this.status,
    required this.toStart,
    required this.toEnd,
    required this.startTimeFormatted,
    required this.endTimeFormatted,
  });
}

String _formatClock(DateTime? d) {
  if (d == null) return '';
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

/// Exposed (not private) so widget tests can override it with a single-value,
/// non-repeating stream — a real `Stream.periodic` would otherwise tick every
/// second forever and make `tester.pumpAndSettle()` hang in every screen test
/// that reads `timerProvider` (Tasks 9, 11, 12, 13, 14).
final clockProvider = StreamProvider.autoDispose<DateTime>((ref) {
  return Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now())
      .startWith(DateTime.now());
});

extension StartWith<T> on Stream<T> {
  Stream<T> startWith(T value) async* {
    yield value;
    yield* this;
  }
}

final timerProvider = Provider.autoDispose<TimerTick>((ref) {
  final now = ref.watch(clockProvider).value ?? DateTime.now();
  final session = ref.watch(authProvider).value;
  final event = session?.event ??
      AppEvent(id: '', spouse1Name: '', spouse2Name: '', enableTimer: false, startTime: null, endTime: null);

  return TimerTick(
    status: computeStatus(event, now),
    toStart: computeRemaining(event.startTime, now),
    toEnd: computeRemaining(event.endTime, now),
    startTimeFormatted: _formatClock(event.startTime),
    endTimeFormatted: _formatClock(event.endTime),
  );
});

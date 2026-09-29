import 'package:flutter_test/flutter_test.dart';
import 'package:fantamatrimonio_mobile/features/auth/models.dart';
import 'package:fantamatrimonio_mobile/features/timer/timer_status.dart';
import 'package:fantamatrimonio_mobile/features/timer/timer_provider.dart';

AppEvent _event({bool enableTimer = true, DateTime? start, DateTime? end}) => AppEvent(
      id: 'e1',
      spouse1Name: 'A',
      spouse2Name: 'B',
      enableTimer: enableTimer,
      startTime: start,
      endTime: end,
    );

void main() {
  group('computeStatus', () {
    test('disabled when enable_timer is false regardless of dates', () {
      final event = _event(enableTimer: false, start: DateTime(2026, 1, 1));
      expect(computeStatus(event, DateTime(2026, 6, 1)), TimerStatus.disabled);
    });

    test('disabled when enabled but both start and end are null', () {
      final event = _event(enableTimer: true, start: null, end: null);
      expect(computeStatus(event, DateTime(2026, 6, 1)), TimerStatus.disabled);
    });

    test('beforeStart when now is earlier than start', () {
      final event = _event(start: DateTime(2026, 6, 14, 12, 0), end: DateTime(2026, 6, 14, 20, 0));
      expect(computeStatus(event, DateTime(2026, 6, 14, 10, 0)), TimerStatus.beforeStart);
    });

    test('inProgress when now is between start and end', () {
      final event = _event(start: DateTime(2026, 6, 14, 12, 0), end: DateTime(2026, 6, 14, 20, 0));
      expect(computeStatus(event, DateTime(2026, 6, 14, 15, 0)), TimerStatus.inProgress);
    });

    test('ended when now is at or after end', () {
      final event = _event(start: DateTime(2026, 6, 14, 12, 0), end: DateTime(2026, 6, 14, 20, 0));
      expect(computeStatus(event, DateTime(2026, 6, 14, 20, 0)), TimerStatus.ended);
      expect(computeStatus(event, DateTime(2026, 6, 14, 23, 0)), TimerStatus.ended);
    });

    test('recomputes against a fresh event after the couple changes timing', () {
      final original = _event(start: DateTime(2026, 6, 14, 12, 0), end: DateTime(2026, 6, 14, 20, 0));
      final updated = _event(start: DateTime(2026, 6, 14, 9, 0), end: DateTime(2026, 6, 14, 10, 0));
      final now = DateTime(2026, 6, 14, 9, 30);

      expect(computeStatus(original, now), TimerStatus.beforeStart);
      expect(computeStatus(updated, now), TimerStatus.inProgress);
    });
  });

  group('computeRemaining', () {
    test('returns zeroed formatted string when target is null', () {
      final r = computeRemaining(null, DateTime(2026, 1, 1));
      expect(r.formatted, '00:00:00');
    });

    test('formats hours/minutes/seconds until target, floored at zero', () {
      final target = DateTime(2026, 1, 1, 2, 30, 15);
      final now = DateTime(2026, 1, 1, 0, 0, 0);
      final r = computeRemaining(target, now);
      expect(r.formatted, '02:30:15');
    });

    test('never goes negative once target is in the past', () {
      final target = DateTime(2026, 1, 1, 0, 0, 0);
      final now = DateTime(2026, 1, 1, 1, 0, 0);
      final r = computeRemaining(target, now);
      expect(r.formatted, '00:00:00');
    });
  });
}

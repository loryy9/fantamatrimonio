import 'package:flutter_test/flutter_test.dart';
import 'package:fantamatrimonio_mobile/features/auth/models.dart';

void main() {
  test('AppUser.fromJson parses the user_out shape', () {
    final user = AppUser.fromJson({
      'id': 'u1',
      'first_name': 'Mario',
      'last_name': 'Rossi',
      'total_points': 40,
      'role': 'guest',
    });

    expect(user.id, 'u1');
    expect(user.firstName, 'Mario');
    expect(user.role, 'guest');
    expect(user.isCouple, isFalse);
  });

  test('AppEvent.fromJson parses ISO dates and treats absent times as null', () {
    final event = AppEvent.fromJson({
      'id': 'e1',
      'spouse1_name': 'Anna',
      'spouse2_name': 'Luca',
      'enable_timer': true,
      'start_time': '2026-06-14T12:00:00+00:00',
      'end_time': null,
    });

    expect(event.enableTimer, isTrue);
    expect(event.startTime, DateTime.parse('2026-06-14T12:00:00+00:00'));
    expect(event.endTime, isNull);
  });

  test('AppEvent.fromJson handles enable_timer=false with null start/end', () {
    final event = AppEvent.fromJson({
      'id': 'e2',
      'spouse1_name': 'A',
      'spouse2_name': 'B',
      'enable_timer': false,
      'start_time': null,
      'end_time': null,
    });

    expect(event.enableTimer, isFalse);
    expect(event.startTime, isNull);
  });
}

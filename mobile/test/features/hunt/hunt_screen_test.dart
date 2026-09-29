import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/auth/auth_controller.dart';
import 'package:fantamatrimonio_mobile/features/auth/models.dart';
import 'package:fantamatrimonio_mobile/features/timer/timer_provider.dart';
import 'package:fantamatrimonio_mobile/features/hunt/hunt_screen.dart';

class _MockApiClient extends Mock implements ApiClient {}
class _FakeAuthController extends AuthController {
  @override
  Future<AuthSession?> build() async => AuthSession(
        token: 't',
        user: AppUser(id: 'u1', firstName: 'M', lastName: 'R', totalPoints: 0, role: 'guest'),
        event: AppEvent(id: 'e1', spouse1Name: 'A', spouse2Name: 'B', enableTimer: false, startTime: null, endTime: null),
      );
}

final _fixedClockOverride = clockProvider.overrideWith((ref) => Stream.value(DateTime.now()));

Map<String, dynamic> _huntChallenge({bool completed = false}) => {
      'id': 1, 'title': 'Trova gli sposi', 'description': 'd', 'points': 5,
      'type': 'hunt', 'challenge_type': 'hunt', 'active': true,
      'config': {'options': []}, 'completed': completed,
    };

void main() {
  testWidgets('shows the points badge for an incomplete mission and the check for a completed one', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => [_huntChallenge()]);

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), authProvider.overrideWith(() => _FakeAuthController()), _fixedClockOverride],
      child: const MaterialApp(home: HuntScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('+5 PT'), findsOneWidget);
    expect(find.text('Trova gli sposi'), findsOneWidget);
  });

  testWidgets('shows "Completata" and no capture button once completed', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => [_huntChallenge(completed: true)]);

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), authProvider.overrideWith(() => _FakeAuthController()), _fixedClockOverride],
      child: const MaterialApp(home: HuntScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('✓ Completata'), findsOneWidget);
    expect(find.text('Scatta o Carica Foto'), findsNothing);
  });
}

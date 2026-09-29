import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/auth/auth_controller.dart';
import 'package:fantamatrimonio_mobile/features/auth/models.dart';
import 'package:fantamatrimonio_mobile/features/timer/timer_provider.dart';
import 'package:fantamatrimonio_mobile/features/home/home_screen.dart';

class _MockApiClient extends Mock implements ApiClient {}

/// `timerProvider` ticks off `clockProvider`, which defaults to a real
/// `Stream.periodic` — overriding it with a single value keeps `pumpAndSettle()`
/// from hanging on a stream that never completes.
final _fixedClockOverride = clockProvider.overrideWith((ref) => Stream.value(DateTime.now()));

AuthSession _session({DateTime? start, DateTime? end, bool enableTimer = true}) => AuthSession(
      token: 't',
      user: AppUser(id: 'u1', firstName: 'mario', lastName: 'rossi', totalPoints: 40, role: 'guest'),
      event: AppEvent(
        id: 'e1', spouse1Name: 'Anna', spouse2Name: 'Luca',
        enableTimer: enableTimer, startTime: start, endTime: end,
      ),
    );

class _FakeAuthController extends AuthController {
  final AuthSession _s;
  _FakeAuthController(this._s);
  @override
  Future<AuthSession?> build() async => _s;
}

void main() {
  testWidgets('shows the greeting with the formatted first name and wedding title', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => []);
    when(() => api.get('/submissions/gallery')).thenAnswer((_) async => []);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authProvider.overrideWith(() => _FakeAuthController(_session(enableTimer: false))),
        _fixedClockOverride,
      ],
      child: const MaterialApp(home: HomeScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.textContaining('Ciao, Mario'), findsOneWidget);
    // 'Anna & Luca' alone also matches GameAppBar's title, which shows the
    // same names — match the full body subtitle so this asserts on the
    // Home screen's own content, not GameAppBar's (already covered by
    // GameAppBar being a shared, untested-here composition per Task 8).
    expect(find.textContaining('Matrimonio di Anna & Luca'), findsOneWidget);
  });

  testWidgets('shows the countdown hero before start instead of the points hero', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => []);
    when(() => api.get('/submissions/gallery')).thenAnswer((_) async => []);
    final future = DateTime.now().add(const Duration(hours: 2));

    await tester.pumpWidget(ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authProvider.overrideWith(() => _FakeAuthController(_session(start: future, end: future.add(const Duration(hours: 6))))),
        _fixedClockOverride,
      ],
      child: const MaterialApp(home: HomeScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.textContaining('I giochi inizieranno tra'), findsOneWidget);
    expect(find.textContaining('Il Tuo Punteggio'), findsNothing);
  });

  testWidgets('shows the points hero once the game is in progress', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => []);
    when(() => api.get('/submissions/gallery')).thenAnswer((_) async => []);
    final past = DateTime.now().subtract(const Duration(hours: 1));
    final future = DateTime.now().add(const Duration(hours: 5));

    await tester.pumpWidget(ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authProvider.overrideWith(() => _FakeAuthController(_session(start: past, end: future))),
        _fixedClockOverride,
      ],
      child: const MaterialApp(home: HomeScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.textContaining('Il Tuo Punteggio'), findsOneWidget);
    expect(find.text('40'), findsOneWidget);
  });
}

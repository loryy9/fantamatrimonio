import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/auth/auth_controller.dart';
import 'package:fantamatrimonio_mobile/features/auth/models.dart';
import 'package:fantamatrimonio_mobile/features/timer/timer_provider.dart';
import 'package:fantamatrimonio_mobile/router/app_router.dart';

class _MockApiClient extends Mock implements ApiClient {}

AppUser _user({String role = 'guest'}) =>
    AppUser(id: 'u1', firstName: 'M', lastName: 'R', totalPoints: 0, role: role);

AppEvent _event() => AppEvent(
      id: 'e1', spouse1Name: 'A', spouse2Name: 'B',
      enableTimer: false, startTime: null, endTime: null,
    );

// The guest shell's StatefulShellRoute.indexedStack keeps every branch
// (including Home, Task 9) alive, so any test that reaches the shell builds
// the real HomeScreen — which watches timerProvider's clockProvider, a real
// Stream.periodic by default. Fix it to one value so flutter_test's pending
// timer assertion doesn't trip at teardown.
final _fixedClockOverride = clockProvider.overrideWith((ref) => Stream.value(DateTime.now()));

void main() {
  testWidgets('unauthenticated session redirects any deep link to /entry', (tester) async {
    final container = ProviderContainer(overrides: [
      authProvider.overrideWith(() => _FakeAuthController(null)),
    ]);
    addTearDown(container.dispose);

    final router = container.read(routerProvider);
    router.go('/home');
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pumpAndSettle();

    expect(router.routerDelegate.currentConfiguration.uri.path, '/entry');
  });

  testWidgets('an unauthenticated session can still reach /wizard', (tester) async {
    final container = ProviderContainer(overrides: [
      authProvider.overrideWith(() => _FakeAuthController(null)),
    ]);
    addTearDown(container.dispose);

    final router = container.read(routerProvider);
    router.go('/wizard');
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pumpAndSettle();

    expect(router.routerDelegate.currentConfiguration.uri.path, '/wizard');
  });

  testWidgets('a guest session is redirected away from /manage/settings to /home', (tester) async {
    final session = AuthSession(token: 't', user: _user(role: 'guest'), event: _event());
    final container = ProviderContainer(overrides: [
      authProvider.overrideWith(() => _FakeAuthController(session)),
      _fixedClockOverride,
    ]);
    addTearDown(container.dispose);

    final router = container.read(routerProvider);
    router.go('/manage/settings');
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pumpAndSettle();

    expect(router.routerDelegate.currentConfiguration.uri.path, '/home');
  });

  testWidgets('a couple session can reach /manage/settings', (tester) async {
    final session = AuthSession(token: 't', user: _user(role: 'couple'), event: _event());
    final api = _MockApiClient();
    when(() => api.get('/events/me')).thenAnswer((_) async => {
          'id': 'e1', 'spouse1_name': 'A', 'spouse2_name': 'B', 'enable_timer': false, 'start_time': null, 'end_time': null,
        });
    when(() => api.get('/events/me/invite')).thenAnswer((_) async => {'invite_code': 'AB12CD'});
    when(() => api.get('/submissions/gallery')).thenAnswer((_) async => []);
    final container = ProviderContainer(overrides: [
      authProvider.overrideWith(() => _FakeAuthController(session)),
      apiClientProvider.overrideWithValue(api),
      _fixedClockOverride,
    ]);
    addTearDown(container.dispose);

    final router = container.read(routerProvider);
    router.go('/manage/settings');
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pumpAndSettle();

    expect(router.routerDelegate.currentConfiguration.uri.path, '/manage/settings');
  });
}

class _FakeAuthController extends AuthController {
  final AuthSession? _initial;
  _FakeAuthController(this._initial);

  @override
  Future<AuthSession?> build() async => _initial;
}

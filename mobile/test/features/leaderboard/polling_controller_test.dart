import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/auth/auth_controller.dart';
import 'package:fantamatrimonio_mobile/features/auth/models.dart';
import 'package:fantamatrimonio_mobile/features/leaderboard/leaderboard_controller.dart';
import 'package:fantamatrimonio_mobile/features/leaderboard/polling_controller.dart';
import 'package:fantamatrimonio_mobile/features/shell/toast_controller.dart';

class _MockApiClient extends Mock implements ApiClient {}
class _FakeAuthController extends AuthController {
  int meCallCount = 0;
  int points = 40;
  @override
  Future<AuthSession?> build() async => _session();

  AuthSession _session() => AuthSession(
        token: 't',
        user: AppUser(id: 'u1', firstName: 'M', lastName: 'R', totalPoints: points, role: 'guest'),
        event: AppEvent(id: 'e1', spouse1Name: 'A', spouse2Name: 'B', enableTimer: false, startTime: null, endTime: null),
      );

  @override
  Future<void> refreshMe() async {
    meCallCount++;
    state = AsyncData(_session());
  }
}

void main() {
  test('start() polls every 20 seconds while active, refreshing user and leaderboard', () {
    fakeAsync((async) {
      final api = _MockApiClient();
      when(() => api.get('/leaderboard')).thenAnswer((_) async => []);
      final fakeAuth = _FakeAuthController();

      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(api),
        authProvider.overrideWith(() => fakeAuth),
      ]);
      addTearDown(container.dispose);
      container.read(authProvider); // resolve build()
      async.flushMicrotasks();

      container.read(pollingProvider.notifier).start();
      async.elapse(const Duration(seconds: 20, milliseconds: 100));

      expect(fakeAuth.meCallCount, greaterThanOrEqualTo(1));
    });
  });

  test('shows a "+N punti" toast when points increase between polls', () {
    fakeAsync((async) {
      final api = _MockApiClient();
      when(() => api.get('/leaderboard')).thenAnswer((_) async => []);
      final fakeAuth = _FakeAuthController();

      final container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(api),
        authProvider.overrideWith(() => fakeAuth),
      ]);
      addTearDown(container.dispose);
      container.read(authProvider);
      async.flushMicrotasks();

      container.read(pollingProvider.notifier).start();
      fakeAuth.points = 55; // the next refreshMe() call will report a gain of +15
      async.elapse(const Duration(seconds: 20, milliseconds: 100));

      final toasts = container.read(toastProvider);
      expect(toasts.any((t) => t.text.contains('+15 punti')), isTrue);
    });
  });
}

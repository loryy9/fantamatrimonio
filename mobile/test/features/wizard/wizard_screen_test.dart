import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/core/secure_storage.dart';
import 'package:fantamatrimonio_mobile/features/wizard/wizard_screen.dart';

class _MockApiClient extends Mock implements ApiClient {}

/// A real `FlutterSecureStorage()` hits a platform channel that isn't mocked
/// under `flutter test` (see Task 7's ruling) — applySession()'s writeToken()
/// call would otherwise never resolve. Only the "final step" test reaches
/// applySession(), but all three share the override for simplicity.
class _FakeSecureStorage extends SecureStorage {
  String? _token;
  _FakeSecureStorage() : super();

  @override
  Future<String?> readToken() async => _token;
  @override
  Future<void> writeToken(String token) async => _token = token;
  @override
  Future<void> deleteToken() async => _token = null;
}

void main() {
  testWidgets('cannot advance from step 1 without both spouse names', (tester) async {
    final api = _MockApiClient();
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), secureStorageProvider.overrideWithValue(_FakeSecureStorage())],
      child: const MaterialApp(home: WizardScreen()),
    ));

    await tester.tap(find.text('Avanti'));
    await tester.pumpAndSettle();

    expect(find.text('I vostri nomi'), findsOneWidget); // still on step 1
  });

  testWidgets('rejects an end time that is not after the start time when the timer is enabled', (tester) async {
    final api = _MockApiClient();
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), secureStorageProvider.overrideWithValue(_FakeSecureStorage())],
      child: const MaterialApp(home: WizardScreen()),
    ));

    await tester.enterText(find.byKey(const Key('spouse1_field')), 'Anna');
    await tester.enterText(find.byKey(const Key('spouse2_field')), 'Luca');
    await tester.tap(find.text('Avanti'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('enable_timer_switch')));
    await tester.pumpAndSettle();
    // Both pickers default to "now" in this screen's initial state, which the
    // widget treats as an invalid (non-later) end time until changed.
    await tester.tap(find.text('Avanti'));
    await tester.pumpAndSettle();

    expect(find.text("L'orario di fine deve essere successivo a quello di inizio."), findsOneWidget);
  });

  testWidgets('final step posts to /api/events with the collected fields', (tester) async {
    final api = _MockApiClient();
    when(() => api.post('/events', body: any(named: 'body'))).thenAnswer((_) async => {
          'token': 'tok', 'invite_code': 'AB12CD',
          'user': {'id': 'u1', 'first_name': 'anna', 'last_name': 'bianchi', 'total_points': 0, 'role': 'couple'},
          'event': {'id': 'e1', 'spouse1_name': 'Anna', 'spouse2_name': 'Luca', 'enable_timer': false, 'start_time': null, 'end_time': null},
        });

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), secureStorageProvider.overrideWithValue(_FakeSecureStorage())],
      child: const MaterialApp(home: WizardScreen()),
    ));

    await tester.enterText(find.byKey(const Key('spouse1_field')), 'Anna');
    await tester.enterText(find.byKey(const Key('spouse2_field')), 'Luca');
    await tester.tap(find.text('Avanti'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Avanti')); // timer disabled by default, step 2 -> 3
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('couple_first_name_field')), 'Anna');
    await tester.enterText(find.byKey(const Key('couple_last_name_field')), 'Bianchi');
    await tester.enterText(find.byKey(const Key('couple_secret_word_field')), 'amore');
    await tester.tap(find.text('Avanti')); // step 3 -> 4 (riepilogo)
    await tester.pumpAndSettle();

    await tester.tap(find.text('Crea il matrimonio'));
    await tester.pumpAndSettle();

    final captured = verify(() => api.post('/events', body: captureAny(named: 'body'))).captured.single as Map;
    expect(captured['spouse1_name'], 'Anna');
    expect(captured['couple_secret_word'], 'amore');
    expect(find.text('AB12CD'), findsOneWidget);
  });
}

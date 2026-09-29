import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/core/api_exception.dart';
import 'package:fantamatrimonio_mobile/core/secure_storage.dart';
import 'package:fantamatrimonio_mobile/features/auth/login_form_screen.dart';

class _MockApiClient extends Mock implements ApiClient {}

/// A real `FlutterSecureStorage()` hits a platform channel that isn't mocked
/// under `flutter test` — every widget test in this file overrides
/// `secureStorageProvider` with this in-memory fake instead. All five
/// `SecureStorage` methods that `AuthController.build()`/`login()` and
/// `LoginFormScreen` actually call (`readToken`, `writeToken`,
/// `hasSeenWelcome`, `markSeenWelcome`) must be overridden here — leaving any
/// of them to fall through to the real implementation hits that unmocked
/// channel and the returned Future never resolves, so `login()` hangs and no
/// amount of pumping ever reveals the post-login SnackBar.
class _FakeSecureStorage extends SecureStorage {
  String? _token;
  final _seenWelcome = <String>{};
  _FakeSecureStorage() : super();

  @override
  Future<String?> readToken() async => _token;
  @override
  Future<void> writeToken(String token) async => _token = token;
  @override
  Future<void> deleteToken() async => _token = null;
  @override
  Future<bool> hasSeenWelcome(String userId) async => _seenWelcome.contains(userId);
  @override
  Future<void> markSeenWelcome(String userId) async => _seenWelcome.add(userId);
}

void main() {
  testWidgets('shows a validation message when a field is empty on submit', (tester) async {
    final api = _MockApiClient();
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), secureStorageProvider.overrideWithValue(_FakeSecureStorage())],
      child: const MaterialApp(home: LoginFormScreen()),
    ));

    await tester.tap(find.widgetWithText(ElevatedButton, 'Entra nel Gioco'));
    await tester.pumpAndSettle();

    expect(find.text('Per favore compila tutti i campi!'), findsOneWidget);
    verifyNever(() => api.post(any(), body: any(named: 'body')));
  });

  testWidgets('submits trimmed/capitalized names and the raw invite code on valid input', (tester) async {
    final api = _MockApiClient();
    when(() => api.post('/auth/login', body: any(named: 'body'))).thenAnswer((_) async => {
          'token': 't', 'is_new': false,
          'user': {'id': 'u1', 'first_name': 'mario', 'last_name': 'rossi', 'total_points': 0, 'role': 'guest'},
          'event': {'id': 'e1', 'spouse1_name': 'A', 'spouse2_name': 'B', 'enable_timer': false, 'start_time': null, 'end_time': null},
        });

    // A "returning user" (is_new: false) is only shown the "Bentornato/a"
    // message when this device has already welcomed them before — mirrors
    // the widget's `firstTimeOnDevice = isNew || !hasSeenWelcome` fallback
    // (state.svelte.js's per-device welcome flag). Pre-mark the device as
    // having seen user u1 so this test exercises the genuine-returning-user
    // path rather than the first-time-on-this-device path.
    final storage = _FakeSecureStorage();
    await storage.markSeenWelcome('u1');

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), secureStorageProvider.overrideWithValue(storage)],
      child: const MaterialApp(home: LoginFormScreen()),
    ));

    await tester.enterText(find.byKey(const Key('invite_code_field')), '  ab12cd  ');
    await tester.enterText(find.byKey(const Key('first_name_field')), 'mario');
    await tester.enterText(find.byKey(const Key('last_name_field')), 'rossi');
    await tester.enterText(find.byKey(const Key('secret_word_field')), 'pizza');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Entra nel Gioco'));
    await tester.pumpAndSettle();

    final captured = verify(() => api.post('/auth/login', body: captureAny(named: 'body'))).captured.single as Map;
    expect(captured['invite_code'], '  ab12cd  ');
    expect(find.textContaining('Bentornato/a Mario!'), findsOneWidget);
  });

  testWidgets('shows the first-time welcome message when is_new is true', (tester) async {
    final api = _MockApiClient();
    when(() => api.post('/auth/login', body: any(named: 'body'))).thenAnswer((_) async => {
          'token': 't', 'is_new': true,
          'user': {'id': 'u9', 'first_name': 'giulia', 'last_name': 'verdi', 'total_points': 0, 'role': 'guest'},
          'event': {'id': 'e1', 'spouse1_name': 'A', 'spouse2_name': 'B', 'enable_timer': false, 'start_time': null, 'end_time': null},
        });

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), secureStorageProvider.overrideWithValue(_FakeSecureStorage())],
      child: const MaterialApp(home: LoginFormScreen()),
    ));

    await tester.enterText(find.byKey(const Key('invite_code_field')), 'AB12CD');
    await tester.enterText(find.byKey(const Key('first_name_field')), 'giulia');
    await tester.enterText(find.byKey(const Key('last_name_field')), 'verdi');
    await tester.enterText(find.byKey(const Key('secret_word_field')), 'pizza');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Entra nel Gioco'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Benvenuto/a Giulia!'), findsOneWidget);
  });

  testWidgets('shows the server error message on a failed login', (tester) async {
    final api = _MockApiClient();
    when(() => api.post('/auth/login', body: any(named: 'body')))
        .thenThrow(ApiException('Codice invito non valido.', status: 404));

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), secureStorageProvider.overrideWithValue(_FakeSecureStorage())],
      child: const MaterialApp(home: LoginFormScreen()),
    ));

    await tester.enterText(find.byKey(const Key('invite_code_field')), 'ZZZZZZ');
    await tester.enterText(find.byKey(const Key('first_name_field')), 'a');
    await tester.enterText(find.byKey(const Key('last_name_field')), 'b');
    await tester.enterText(find.byKey(const Key('secret_word_field')), 'c');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Entra nel Gioco'));
    await tester.pumpAndSettle();

    expect(find.text('Codice invito non valido.'), findsOneWidget);
  });
}

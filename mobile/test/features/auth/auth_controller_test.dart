import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/core/secure_storage.dart';
import 'package:fantamatrimonio_mobile/core/api_exception.dart';
import 'package:fantamatrimonio_mobile/features/auth/auth_controller.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _FakeSecureStorage extends SecureStorage {
  String? token;
  _FakeSecureStorage() : super();

  @override
  Future<String?> readToken() async => token;
  @override
  Future<void> writeToken(String t) async => token = t;
  @override
  Future<void> deleteToken() async => token = null;
}

Map<String, dynamic> _eventJson() => {
      'id': 'e1',
      'spouse1_name': 'Anna',
      'spouse2_name': 'Luca',
      'enable_timer': false,
      'start_time': null,
      'end_time': null,
    };

Map<String, dynamic> _userJson({String role = 'guest'}) => {
      'id': 'u1',
      'first_name': 'mario',
      'last_name': 'rossi',
      'total_points': 0,
      'role': role,
    };

void main() {
  late _MockApiClient api;
  late _FakeSecureStorage storage;
  late ProviderContainer container;

  setUp(() {
    api = _MockApiClient();
    storage = _FakeSecureStorage();
    container = ProviderContainer(overrides: [
      apiClientProvider.overrideWithValue(api),
      secureStorageProvider.overrideWithValue(storage),
    ]);
  });

  tearDown(() => container.dispose());

  test('build() with no stored token resolves to null (entry screen)', () async {
    final result = await container.read(authProvider.future);
    expect(result, isNull);
  });

  test('build() with a stored token restores the session via GET /auth/me', () async {
    storage.token = 'stored-token';
    when(() => api.get('/auth/me')).thenAnswer(
      (_) async => {'user': _userJson(), 'event': _eventJson()},
    );

    final result = await container.read(authProvider.future);

    expect(result, isNotNull);
    expect(result!.token, 'stored-token');
    expect(result.user.firstName, 'mario');
  });

  test('build() clears the token and resolves null on a 401 from /auth/me', () async {
    storage.token = 'expired';
    when(() => api.get('/auth/me')).thenThrow(ApiException('Sessione scaduta.', status: 401));

    final result = await container.read(authProvider.future);

    expect(result, isNull);
    expect(await storage.readToken(), isNull);
  });

  test('login() stores the token and populates the session, returns is_new', () async {
    when(() => api.post('/auth/login', body: any(named: 'body'))).thenAnswer(
      (_) async => {'token': 'new-token', 'is_new': true, 'user': _userJson(), 'event': _eventJson()},
    );
    await container.read(authProvider.future); // resolve initial build() first

    final isNew = await container.read(authProvider.notifier).login(
          inviteCode: 'AB12CD',
          firstName: 'Mario',
          lastName: 'Rossi',
          secretWord: 'pizza',
        );

    expect(isNew, isTrue);
    expect(await storage.readToken(), 'new-token');
    expect(container.read(authProvider).value!.user.firstName, 'mario');
  });

  test('logout() clears the token and resets the session to null', () async {
    storage.token = 'tok';
    when(() => api.get('/auth/me')).thenAnswer(
      (_) async => {'user': _userJson(), 'event': _eventJson()},
    );
    await container.read(authProvider.future);

    await container.read(authProvider.notifier).logout();

    expect(container.read(authProvider).value, isNull);
    expect(await storage.readToken(), isNull);
  });
}

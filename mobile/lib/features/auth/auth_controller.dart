import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_exception.dart';
import 'models.dart';
import '../../core/providers.dart';

class AuthController extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() async {
    final storage = ref.read(secureStorageProvider);
    final token = await storage.readToken();
    if (token == null) return null;

    final api = ref.read(apiClientProvider);
    try {
      final res = await api.get('/auth/me') as Map<String, dynamic>;
      return AuthSession(
        token: token,
        user: AppUser.fromJson(res['user'] as Map<String, dynamic>),
        event: AppEvent.fromJson(res['event'] as Map<String, dynamic>),
      );
    } on ApiException catch (e) {
      if (e.status == 401) {
        await storage.deleteToken();
        return null;
      }
      rethrow;
    }
  }

  Future<bool> login({
    required String inviteCode,
    required String firstName,
    required String lastName,
    required String secretWord,
  }) async {
    final api = ref.read(apiClientProvider);
    final res = await api.post('/auth/login', body: {
      'invite_code': inviteCode,
      'first_name': firstName,
      'last_name': lastName,
      'secret_word': secretWord,
    }) as Map<String, dynamic>;

    final token = res['token'] as String;
    await ref.read(secureStorageProvider).writeToken(token);

    state = AsyncData(AuthSession(
      token: token,
      user: AppUser.fromJson(res['user'] as Map<String, dynamic>),
      event: AppEvent.fromJson(res['event'] as Map<String, dynamic>),
    ));

    return res['is_new'] as bool;
  }

  Future<void> applySession(String token, AppUser user, AppEvent event) async {
    await ref.read(secureStorageProvider).writeToken(token);
    state = AsyncData(AuthSession(token: token, user: user, event: event));
  }

  Future<void> refreshMe() async {
    final current = state.value;
    if (current == null) return;
    final api = ref.read(apiClientProvider);
    final res = await api.get('/auth/me') as Map<String, dynamic>;
    state = AsyncData(AuthSession(
      token: current.token,
      user: AppUser.fromJson(res['user'] as Map<String, dynamic>),
      event: AppEvent.fromJson(res['event'] as Map<String, dynamic>),
    ));
  }

  Future<void> logout() async {
    await ref.read(secureStorageProvider).deleteToken();
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthController, AuthSession?>(AuthController.new);

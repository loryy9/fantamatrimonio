import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import 'secure_storage.dart';
import '../features/auth/auth_controller.dart';

const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:8000/api',
);

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());

final dioProvider = Provider<Dio>((ref) {
  return Dio(BaseOptions(baseUrl: _apiBaseUrl));
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.read(secureStorageProvider);
  return ApiClient(
    ref.read(dioProvider),
    tokenReader: storage.readToken,
    onUnauthorized: () {
      if (kDebugMode) debugPrint('401 received — clearing session');
      ref.read(authProvider.notifier).logout();
    },
  );
});

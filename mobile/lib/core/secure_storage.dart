import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  final FlutterSecureStorage _storage;
  SecureStorage([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  static const _tokenKey = 'fm_auth_token';

  Future<String?> readToken() => _storage.read(key: _tokenKey);
  Future<void> writeToken(String token) => _storage.write(key: _tokenKey, value: token);
  Future<void> deleteToken() => _storage.delete(key: _tokenKey);

  Future<bool> hasSeenWelcome(String userId) async =>
      (await _storage.read(key: 'fm_seen_welcome_$userId')) == 'true';
  Future<void> markSeenWelcome(String userId) =>
      _storage.write(key: 'fm_seen_welcome_$userId', value: 'true');

  Future<bool> hasSeenInstructions(String userId) async =>
      (await _storage.read(key: 'fm_seen_instructions_$userId')) == 'true';
  Future<void> markSeenInstructions(String userId) =>
      _storage.write(key: 'fm_seen_instructions_$userId', value: 'true');
}

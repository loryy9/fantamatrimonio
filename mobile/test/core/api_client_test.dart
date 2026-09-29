import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/core/api_exception.dart';

void main() {
  group('ApiClient', () {
    test('injects the Authorization header from tokenReader on every request', () async {
      String? capturedAuthHeader;
      final dio = Dio()
        ..httpClientAdapter = _FakeAdapter((options) {
          capturedAuthHeader = options.headers['Authorization'] as String?;
          return _fakeResponse(options, 200, {'ok': true});
        });

      final client = ApiClient(dio, tokenReader: () async => 'tok123');
      await client.get('/auth/me');

      expect(capturedAuthHeader, 'Bearer tok123');
    });

    test('omits the Authorization header when tokenReader returns null', () async {
      String? capturedAuthHeader = 'unset';
      final dio = Dio()
        ..httpClientAdapter = _FakeAdapter((options) {
          capturedAuthHeader = options.headers['Authorization'] as String?;
          return _fakeResponse(options, 200, {'ok': true});
        });

      final client = ApiClient(dio, tokenReader: () async => null);
      await client.get('/challenges');

      expect(capturedAuthHeader, isNull);
    });

    test('throws ApiException and calls onUnauthorized on a 401', () async {
      var calledUnauthorized = false;
      final dio = Dio()
        ..httpClientAdapter = _FakeAdapter(
          (options) => _fakeResponse(options, 401, {'detail': 'Sessione scaduta.'}),
        );

      final client = ApiClient(
        dio,
        tokenReader: () async => 'expired',
        onUnauthorized: () => calledUnauthorized = true,
      );

      await expectLater(
        () => client.get('/auth/me'),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)),
      );
      expect(calledUnauthorized, isTrue);
    });

    test('get() returns decoded JSON on success', () async {
      final dio = Dio()
        ..httpClientAdapter = _FakeAdapter(
          (options) => _fakeResponse(options, 200, {'value': 42}),
        );

      final client = ApiClient(dio, tokenReader: () async => null);
      final result = await client.get('/health');

      expect(result, {'value': 42});
    });
  });
}

typedef _Responder = ResponseBody Function(RequestOptions options);

class _FakeAdapter implements HttpClientAdapter {
  final _Responder responder;
  _FakeAdapter(this.responder);

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return responder(options);
  }
}

ResponseBody _fakeResponse(RequestOptions options, int status, Map<String, dynamic> json) {
  final bytes = jsonEncodeToBytes(json);
  return ResponseBody.fromBytes(bytes, status, headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  });
}

List<int> jsonEncodeToBytes(Map<String, dynamic> json) => utf8.encode(jsonEncode(json));

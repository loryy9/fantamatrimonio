import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fantamatrimonio_mobile/core/api_exception.dart';

RequestOptions _opts() => RequestOptions(path: '/x');

void main() {
  group('ApiException.fromDioException', () {
    test('maps a response with a string detail', () {
      final e = DioException(
        requestOptions: _opts(),
        response: Response(
          requestOptions: _opts(),
          statusCode: 404,
          data: {'detail': 'Codice invito non valido.'},
        ),
        type: DioExceptionType.badResponse,
      );

      final result = ApiException.fromDioException(e);

      expect(result.status, 404);
      expect(result.message, 'Codice invito non valido.');
    });

    test('maps a response with a FastAPI validation-error list detail', () {
      final e = DioException(
        requestOptions: _opts(),
        response: Response(
          requestOptions: _opts(),
          statusCode: 422,
          data: {
            'detail': [
              {'msg': 'field required', 'loc': ['body', 'invite_code']},
            ],
          },
        ),
        type: DioExceptionType.badResponse,
      );

      final result = ApiException.fromDioException(e);

      expect(result.status, 422);
      expect(result.message, contains('field required'));
    });

    test('maps a connection error (no response) to a generic connectivity message', () {
      final e = DioException(
        requestOptions: _opts(),
        type: DioExceptionType.connectionError,
      );

      final result = ApiException.fromDioException(e);

      expect(result.status, isNull);
      expect(result.message, 'Controlla la connessione e riprova.');
    });

    test('maps a timeout to the same generic connectivity message', () {
      final e = DioException(
        requestOptions: _opts(),
        type: DioExceptionType.connectionTimeout,
      );

      final result = ApiException.fromDioException(e);

      expect(result.message, 'Controlla la connessione e riprova.');
    });
  });
}

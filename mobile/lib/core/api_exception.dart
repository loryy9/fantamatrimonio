import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  final dynamic detail;

  ApiException(this.message, {this.status, this.detail});

  static const _connectivityMessage = 'Controlla la connessione e riprova.';

  factory ApiException.fromDioException(DioException e) {
    final response = e.response;
    if (response == null) {
      return ApiException(_connectivityMessage);
    }

    final data = response.data;
    String message;
    dynamic detail = data is Map ? data['detail'] : null;

    if (detail is List) {
      message = detail
          .map((d) => d is Map && d['msg'] != null ? d['msg'].toString() : d.toString())
          .join(', ');
    } else if (detail is Map) {
      message = detail.toString();
    } else if (detail is String && detail.isNotEmpty) {
      message = detail;
    } else {
      message = 'Errore HTTP ${response.statusCode}';
    }

    return ApiException(message, status: response.statusCode, detail: detail);
  }

  @override
  String toString() => message;
}

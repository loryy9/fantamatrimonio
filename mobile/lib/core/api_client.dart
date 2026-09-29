import 'dart:convert';
import 'package:dio/dio.dart';
import 'api_exception.dart';

class ApiClient {
  final Dio _dio;
  final Future<String?> Function() tokenReader;
  final void Function()? onUnauthorized;

  ApiClient(this._dio, {required this.tokenReader, this.onUnauthorized}) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenReader();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  dynamic _decode(Response response) {
    if (response.statusCode == 204) return null;
    final data = response.data;
    if (data is String) {
      if (data.isEmpty) return null;
      return jsonDecode(data);
    }
    return data;
  }

  ApiException _handle(DioException e) {
    if (e.response?.statusCode == 401) {
      onUnauthorized?.call();
    }
    return ApiException.fromDioException(e);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.get(path, queryParameters: query);
      return _decode(res);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, dynamic>? query,
  }) async {
    try {
      print("=== print   " + path);
      final res = await _dio.post(path, data: body, queryParameters: query);
      return _decode(res);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    try {
      final res = await _dio.patch(path, data: body);
      return _decode(res);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<dynamic> delete(String path) async {
    try {
      final res = await _dio.delete(path);
      return _decode(res);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }

  Future<dynamic> postMultipart(
    String path, {
    required List<MapEntry<String, MultipartFile>> files,
    Map<String, dynamic>? fields,
    Map<String, dynamic>? query,
  }) async {
    final formData = FormData();
    for (final f in files) {
      formData.files.add(f);
    }
    if (fields != null) {
      fields.forEach((key, value) {
        if (value != null) formData.fields.add(MapEntry(key, value.toString()));
      });
    }
    try {
      final res = await _dio.post(path, data: formData, queryParameters: query);
      return _decode(res);
    } on DioException catch (e) {
      throw _handle(e);
    }
  }
}

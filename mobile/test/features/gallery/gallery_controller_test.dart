import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:dio/dio.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/gallery/gallery_controller.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  setUpAll(() {
    registerFallbackValue(<MapEntry<String, MultipartFile>>[]);
  });

  Map<String, dynamic> _photoJson(String id) => {
        'id': id, 'user_id': 'u1', 'image_url': 'https://x/$id.jpg', 'photo_url': 'https://x/$id.jpg',
        'created_at': '2026-06-14T12:00:00+00:00', 'first_name': 'mario', 'last_name': 'rossi',
        'author': 'Mario Rossi', 'challenge_type': 'photo', 'challenge_title': 'Foto Libera',
      };

  test('build() fetches GET /submissions/gallery', () async {
    final api = _MockApiClient();
    when(() => api.get('/submissions/gallery')).thenAnswer((_) async => [_photoJson('p1')]);

    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);

    final result = await container.read(galleryProvider.future);

    expect(result, hasLength(1));
    expect(result.first.id, 'p1');
  });

  test('deletePhoto() optimistically removes the photo then confirms via the API', () async {
    final api = _MockApiClient();
    when(() => api.get('/submissions/gallery')).thenAnswer((_) async => [_photoJson('p1'), _photoJson('p2')]);
    when(() => api.delete('/submissions/photo/p1')).thenAnswer((_) async => {'success': true, 'deleted_id': 'p1'});

    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);
    await container.read(galleryProvider.future);

    await container.read(galleryProvider.notifier).deletePhoto('p1');

    final ids = container.read(galleryProvider).value!.map((p) => p.id);
    expect(ids, ['p2']);
  });

  test('deletePhoto() rolls back the optimistic removal on API failure', () async {
    final api = _MockApiClient();
    when(() => api.get('/submissions/gallery')).thenAnswer((_) async => [_photoJson('p1')]);
    when(() => api.delete('/submissions/photo/p1')).thenThrow(Exception('boom'));

    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);
    await container.read(galleryProvider.future);

    await expectLater(
      () => container.read(galleryProvider.notifier).deletePhoto('p1'),
      throwsException,
    );

    final ids = container.read(galleryProvider).value!.map((p) => p.id);
    expect(ids, ['p1']);
  });
}

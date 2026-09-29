import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import 'gallery_photo.dart';
import 'image_compressor.dart';

class GalleryController extends AsyncNotifier<List<GalleryPhoto>> {
  @override
  Future<List<GalleryPhoto>> build() => _fetch();

  Future<List<GalleryPhoto>> _fetch() async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/submissions/gallery') as List<dynamic>;
    return res.map((e) => GalleryPhoto.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(_fetch);
  }

  Future<void> uploadMany(List<List<int>> fileBytesList, {required bool awardPoints}) async {
    final compressor = ImageCompressor();
    final encoder = FlutterImageCompressEncoder();
    final files = <MapEntry<String, MultipartFile>>[];

    for (var i = 0; i < fileBytesList.length; i++) {
      final compressed = await compressor.compress(fileBytesList[i], encoder: encoder);
      files.add(MapEntry(
        'files',
        MultipartFile.fromBytes(compressed.bytes, filename: 'photo_$i.jpg'),
      ));
    }

    final api = ref.read(apiClientProvider);
    await api.postMultipart(
      '/submissions/photos',
      files: files,
      query: {'award_points': awardPoints},
    );
    await refresh();
  }

  Future<void> deletePhoto(String id) async {
    final previous = state.value ?? [];
    state = AsyncData(previous.where((p) => p.id != id).toList());

    final api = ref.read(apiClientProvider);
    try {
      await api.delete('/submissions/photo/$id');
    } catch (_) {
      state = AsyncData(previous);
      rethrow;
    }
  }
}

final galleryProvider = AsyncNotifierProvider<GalleryController, List<GalleryPhoto>>(GalleryController.new);

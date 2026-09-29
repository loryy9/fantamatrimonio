import 'dart:typed_data';
import 'package:flutter_image_compress/flutter_image_compress.dart';

abstract class ImageEncoder {
  Future<List<int>> encodeJpeg(
    List<int> bytes, {
    required double quality,
    required int maxWidth,
    required int maxHeight,
  });
}

class CompressionPlan {
  final bool shouldCompress;
  final double quality;
  final int maxWidth;
  final int maxHeight;

  CompressionPlan({required this.shouldCompress, required this.quality, required this.maxWidth, required this.maxHeight});
}

const _skipThresholdBytes = 160 * 1024;
const _secondPassThresholdBytes = 220 * 1024;

CompressionPlan planCompression(int originalSizeBytes) {
  if (originalSizeBytes < _skipThresholdBytes) {
    return CompressionPlan(shouldCompress: false, quality: 1.0, maxWidth: 0, maxHeight: 0);
  }
  return CompressionPlan(shouldCompress: true, quality: 0.74, maxWidth: 1280, maxHeight: 1280);
}

class CompressedImage {
  final List<int> bytes;
  CompressedImage(this.bytes);
}

class ImageCompressor {
  Future<CompressedImage> compress(List<int> originalBytes, {required ImageEncoder encoder}) async {
    final plan = planCompression(originalBytes.length);
    if (!plan.shouldCompress) {
      return CompressedImage(originalBytes);
    }

    var compressed = await encoder.encodeJpeg(
      originalBytes,
      quality: plan.quality,
      maxWidth: plan.maxWidth,
      maxHeight: plan.maxHeight,
    );

    if (compressed.length > _secondPassThresholdBytes) {
      compressed = await encoder.encodeJpeg(
        originalBytes,
        quality: 0.65,
        maxWidth: plan.maxWidth,
        maxHeight: plan.maxHeight,
      );
    }

    if (compressed.length >= originalBytes.length) {
      return CompressedImage(originalBytes);
    }

    return CompressedImage(compressed);
  }
}

class FlutterImageCompressEncoder implements ImageEncoder {
  @override
  Future<List<int>> encodeJpeg(
    List<int> bytes, {
    required double quality,
    required int maxWidth,
    required int maxHeight,
  }) async {
    final result = await FlutterImageCompress.compressWithList(
      Uint8List.fromList(bytes),
      quality: (quality * 100).round(),
      minWidth: maxWidth,
      minHeight: maxHeight,
      format: CompressFormat.jpeg,
      keepExif: false,
    );
    return result;
  }
}

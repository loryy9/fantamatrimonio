import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:fantamatrimonio_mobile/features/gallery/image_compressor.dart';

class _FakeEncoder implements ImageEncoder {
  final List<int> Function(double quality) onEncode;
  final calls = <double>[];
  _FakeEncoder(this.onEncode);

  @override
  Future<List<int>> encodeJpeg(List<int> bytes, {required double quality, required int maxWidth, required int maxHeight}) async {
    calls.add(quality);
    return onEncode(quality);
  }
}

Uint8List _bytesOfSize(int size) => Uint8List(size);

void main() {
  group('planCompression', () {
    test('skips compression when the original is already under 160KB', () {
      final plan = planCompression(150 * 1024);
      expect(plan.shouldCompress, isFalse);
    });

    test('compresses at quality 0.74 / max 1280x1280 when at or above 160KB', () {
      final plan = planCompression(160 * 1024);
      expect(plan.shouldCompress, isTrue);
      expect(plan.quality, 0.74);
      expect(plan.maxWidth, 1280);
      expect(plan.maxHeight, 1280);
    });
  });

  group('ImageCompressor.compress', () {
    test('returns the original bytes unchanged when under the 160KB threshold', () async {
      final original = _bytesOfSize(100 * 1024);
      final encoder = _FakeEncoder((q) => _bytesOfSize(90 * 1024));

      final result = await ImageCompressor().compress(original, encoder: encoder);

      expect(result.bytes, same(original));
      expect(encoder.calls, isEmpty);
    });

    test('runs a single pass at 0.74 when the result is already under 220KB', () async {
      final original = _bytesOfSize(500 * 1024);
      final encoder = _FakeEncoder((q) => _bytesOfSize(200 * 1024));

      final result = await ImageCompressor().compress(original, encoder: encoder);

      expect(encoder.calls, [0.74]);
      expect(result.bytes.length, 200 * 1024);
    });

    test('runs a second pass at 0.65 when the first pass is still over 220KB', () async {
      final original = _bytesOfSize(2 * 1024 * 1024);
      final encoder = _FakeEncoder((q) => q == 0.74 ? _bytesOfSize(260 * 1024) : _bytesOfSize(210 * 1024));

      final result = await ImageCompressor().compress(original, encoder: encoder);

      expect(encoder.calls, [0.74, 0.65]);
      expect(result.bytes.length, 210 * 1024);
    });

    test('discards the compressed result and keeps the original if not actually smaller', () async {
      final original = _bytesOfSize(170 * 1024);
      final encoder = _FakeEncoder((q) => _bytesOfSize(180 * 1024));

      final result = await ImageCompressor().compress(original, encoder: encoder);

      expect(result.bytes, same(original));
    });
  });
}

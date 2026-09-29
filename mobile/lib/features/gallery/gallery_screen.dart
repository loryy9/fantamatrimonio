import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'gallery_controller.dart';
import '../auth/auth_controller.dart';
import '../timer/timer_provider.dart';
import '../timer/timer_status.dart';
import '../shell/app_bar_chrome.dart';
import '../shell/toast_controller.dart';

class GalleryScreen extends ConsumerStatefulWidget {
  const GalleryScreen({super.key});

  @override
  ConsumerState<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends ConsumerState<GalleryScreen> {
  bool _isUploading = false;

  Future<void> _pickAndUpload() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(limit: 10);
    if (picked.isEmpty) return;

    setState(() => _isUploading = true);
    final tick = ref.read(timerProvider);
    try {
      final bytesList = await Future.wait(picked.map((f) => f.readAsBytes()));
      await ref.read(galleryProvider.notifier).uploadMany(
            bytesList,
            awardPoints: tick.status != TimerStatus.ended,
          );
      ref.read(toastProvider.notifier).show(
            'Foto caricate con successo!',
            type: 'success',
            points: tick.status == TimerStatus.ended ? null : picked.length * 10,
          );
    } catch (e) {
      ref.read(toastProvider.notifier).show(e.toString(), type: 'error');
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final photosAsync = ref.watch(galleryProvider);
    final tick = ref.watch(timerProvider);
    final session = ref.watch(authProvider).value;

    return Scaffold(
      appBar: const GameAppBar(),
      floatingActionButton: tick.status == TimerStatus.beforeStart
          ? null
          : FloatingActionButton.extended(
              onPressed: _isUploading ? null : _pickAndUpload,
              icon: _isUploading ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.add_a_photo),
              label: Text(_isUploading ? 'Ottimizzazione e invio...' : 'Carica foto'),
            ),
      body: tick.status == TimerStatus.beforeStart
          ? Center(child: Text('Galleria Bloccata\nApertura alle ${tick.startTimeFormatted}', textAlign: TextAlign.center))
          : photosAsync.when(
              data: (photos) => GridView.builder(
                padding: const EdgeInsets.all(12),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 4, mainAxisSpacing: 4),
                itemCount: photos.length,
                itemBuilder: (context, index) {
                  final photo = photos[index];
                  final displayName = session != null && photo.userId == session.user.id ? 'Tu' : photo.author;
                  return GestureDetector(
                    onTap: () => showDialog(
                      context: context,
                      builder: (_) => AlertDialog(
                        content: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CachedNetworkImage(imageUrl: photo.imageUrl),
                            Text(displayName),
                          ],
                        ),
                      ),
                    ),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        CachedNetworkImage(imageUrl: photo.imageUrl, fit: BoxFit.cover),
                        Positioned(
                          left: 4,
                          right: 4,
                          bottom: 4,
                          child: Text(
                            displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              shadows: [Shadow(blurRadius: 4, color: Colors.black)],
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, st) => Center(child: Text('Errore: $e')),
            ),
    );
  }
}

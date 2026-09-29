import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart' show MultipartFile;
import 'package:image_picker/image_picker.dart';
import '../challenges/challenges_controller.dart';
import '../timer/timer_provider.dart';
import '../timer/timer_status.dart';
import '../gallery/image_compressor.dart';
import '../../core/providers.dart';
import '../../core/api_exception.dart';
import '../shell/app_bar_chrome.dart';
import '../shell/toast_controller.dart';

class HuntScreen extends ConsumerStatefulWidget {
  const HuntScreen({super.key});

  @override
  ConsumerState<HuntScreen> createState() => _HuntScreenState();
}

class _HuntScreenState extends ConsumerState<HuntScreen> {
  int? _submittingId;

  Future<void> _submit(int challengeId) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera) ??
        await picker.pickImage(source: ImageSource.gallery);
    if (picked == null) return;

    setState(() => _submittingId = challengeId);
    try {
      final bytes = await picked.readAsBytes();
      final compressed = await ImageCompressor().compress(bytes, encoder: FlutterImageCompressEncoder());
      final api = ref.read(apiClientProvider);
      final res = await api.postMultipart(
        '/submissions/hunt/$challengeId',
        files: [MapEntry('file', MultipartFile.fromBytes(compressed.bytes, filename: 'hunt.jpg'))],
      ) as Map<String, dynamic>;

      ref.read(toastProvider.notifier).show(
            'Missione completata con successo!',
            type: 'success',
            points: res['points_awarded'] as int?,
          );
      await ref.read(challengesProvider.notifier).refresh();
    } on ApiException catch (e) {
      final message = e.status == 409 ? 'Hai già completato questa missione!' : e.message;
      ref.read(toastProvider.notifier).show(message, type: 'error');
    } finally {
      if (mounted) setState(() => _submittingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final challengesAsync = ref.watch(challengesProvider);
    final tick = ref.watch(timerProvider);
    final hunts = (challengesAsync.value ?? []).where((c) => c.type == 'hunt').toList();

    return Scaffold(
      appBar: const GameAppBar(),
      body: tick.status == TimerStatus.beforeStart
          ? Center(child: Text('Caccia al Tesoro Bloccata\nApertura alle ${tick.startTimeFormatted}', textAlign: TextAlign.center))
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: hunts.length,
              itemBuilder: (context, i) {
                final hunt = hunts[i];
                final isDone = hunt.completed;
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Chip(label: Text(isDone ? '✓ Completata' : '+${hunt.points} PT')),
                        Text(hunt.title, style: Theme.of(context).textTheme.headlineMedium),
                        Text(hunt.description),
                        const SizedBox(height: 12),
                        if (!isDone && tick.status != TimerStatus.ended)
                          ElevatedButton(
                            onPressed: _submittingId == hunt.id ? null : () => _submit(hunt.id),
                            child: Text(_submittingId == hunt.id ? 'Ottimizzazione e invio...' : 'Scatta o Carica Foto'),
                          )
                        else if (!isDone)
                          const Text('Tempo scaduto · Missione non completata'),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}

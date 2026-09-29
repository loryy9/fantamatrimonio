import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'manage_challenges_controller.dart';
import '../shell/app_bar_chrome.dart';
import '../shell/toast_controller.dart';

class ManageVoteScreen extends ConsumerWidget {
  const ManageVoteScreen({super.key});

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminare questa domanda?'),
        content: const Text('Gli invitati perderanno i punti eventualmente guadagnati.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annulla')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Elimina')),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        await ref.read(manageChallengesProvider('vote').notifier).delete(id);
      } catch (e) {
        ref.read(toastProvider.notifier).show(e.toString(), type: 'error');
      }
    }
  }

  Future<void> _openEditor(BuildContext context, WidgetRef ref, {int? id, String? title, String? description, int? points}) async {
    final titleCtrl = TextEditingController(text: title);
    final descCtrl = TextEditingController(text: description);
    final pointsCtrl = TextEditingController(text: points?.toString() ?? '5');
    final optionCtrls = <TextEditingController>[];

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 20, right: 20, top: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Domanda')),
              TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Descrizione (opzionale)')),
              TextField(controller: pointsCtrl, decoration: const InputDecoration(labelText: 'Punti'), keyboardType: TextInputType.number),
              ...optionCtrls.map((c) => TextField(controller: c, decoration: const InputDecoration(labelText: 'Opzione'))),
              TextButton(
                onPressed: () => setSheetState(() => optionCtrls.add(TextEditingController())),
                child: const Text('Aggiungi opzione'),
              ),
              ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Salva')),
            ],
          ),
        ),
      ),
    );

    if (saved != true) return;
    final voteOptions = optionCtrls.map((c) => c.text.trim()).where((s) => s.isNotEmpty).toList();
    final notifier = ref.read(manageChallengesProvider('vote').notifier);
    if (id == null) {
      await notifier.create(
        title: titleCtrl.text.trim(),
        description: descCtrl.text.trim(),
        points: int.tryParse(pointsCtrl.text) ?? 0,
        voteOptions: voteOptions,
      );
    } else {
      await notifier.updateChallenge(id, {
        'title': titleCtrl.text.trim(),
        'description': descCtrl.text.trim(),
        'points': int.tryParse(pointsCtrl.text) ?? 0,
        'vote_options': voteOptions,
      });
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final challengesAsync = ref.watch(manageChallengesProvider('vote'));

    return Scaffold(
      appBar: const GameAppBar(),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openEditor(context, ref),
        child: const Icon(Icons.add),
      ),
      body: challengesAsync.when(
        data: (list) => ListView.builder(
          itemCount: list.length,
          itemBuilder: (context, i) {
            final c = list[i];
            return ListTile(
              title: Text(c.title),
              subtitle: Text('${c.points} pt'),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Switch(
                    value: c.active,
                    onChanged: (v) => ref.read(manageChallengesProvider('vote').notifier).toggleActive(c.id, v),
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined),
                    onPressed: () => _openEditor(context, ref, id: c.id, title: c.title, description: c.description, points: c.points),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => _confirmDelete(context, ref, c.id),
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

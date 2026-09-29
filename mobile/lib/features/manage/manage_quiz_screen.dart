import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'manage_challenges_controller.dart';
import '../challenges/challenge.dart';
import '../shell/app_bar_chrome.dart';
import '../shell/toast_controller.dart';
import '../../theme/app_theme.dart';

const _emerald = Color(0xFF3A7D5E);

class ManageQuizScreen extends ConsumerWidget {
  const ManageQuizScreen({super.key});

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.paper,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
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
        await ref.read(manageChallengesProvider('quiz').notifier).delete(id);
      } catch (e) {
        ref.read(toastProvider.notifier).show(e.toString(), type: 'error');
      }
    }
  }

  Future<void> _openEditor(BuildContext context, WidgetRef ref, {Challenge? existing}) async {
    final titleCtrl = TextEditingController(text: existing?.title);
    final descCtrl = TextEditingController(text: existing?.description);
    final pointsCtrl = TextEditingController(text: existing?.points.toString() ?? '30');
    final optionCtrls = (existing?.options.isNotEmpty ?? false)
        ? existing!.options.map((o) => TextEditingController(text: o.text)).toList()
        : [TextEditingController(), TextEditingController()];
    int? correctIndex = existing == null
        ? null
        : optionCtrls.indexWhere(
            (c) => c.text.trim().toLowerCase() == (existing.correctAnswer ?? '').trim().toLowerCase());
    if (correctIndex == -1) correctIndex = null;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(
              color: AppColors.paper,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 18),
                      decoration: BoxDecoration(
                        color: AppColors.goldPrimary.withOpacity(0.35),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ),
                  Text(
                    existing == null ? 'Nuova domanda quiz' : 'Modifica domanda',
                    style: Theme.of(ctx).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 18),
                  TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Domanda')),
                  const SizedBox(height: 12),
                  TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Descrizione (opzionale)')),
                  const SizedBox(height: 12),
                  TextField(
                    controller: pointsCtrl,
                    decoration: const InputDecoration(labelText: 'Punti'),
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 20),
                  Text('Opzioni di risposta', style: Theme.of(ctx).textTheme.labelSmall),
                  const SizedBox(height: 4),
                  Text(
                    'Tocca il cerchio per indicare qual è l\'opzione corretta.',
                    style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                  ),
                  const SizedBox(height: 10),
                  ...List.generate(optionCtrls.length, (i) {
                    final isCorrect = correctIndex == i;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        decoration: BoxDecoration(
                          color: isCorrect ? _emerald.withOpacity(0.1) : Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: isCorrect ? _emerald.withOpacity(0.5) : Colors.transparent),
                        ),
                        child: Row(
                          children: [
                            GestureDetector(
                              onTap: () => setSheetState(() => correctIndex = i),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                width: 26,
                                height: 26,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: isCorrect ? _emerald : Colors.transparent,
                                  border: Border.all(color: isCorrect ? _emerald : AppColors.inkMuted.withOpacity(0.4), width: 2),
                                ),
                                child: isCorrect
                                    ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                                    : null,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: TextField(
                                controller: optionCtrls[i],
                                decoration: InputDecoration(labelText: 'Opzione ${i + 1}'),
                              ),
                            ),
                            if (isCorrect)
                              Padding(
                                padding: const EdgeInsets.only(left: 6),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(color: _emerald.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                                  child: Text('Corretta', style: TextStyle(color: _emerald, fontWeight: FontWeight.w700, fontSize: 10.5)),
                                ),
                              ),
                            IconButton(
                              icon: const Icon(Icons.close_rounded, size: 18),
                              color: AppColors.inkMuted,
                              onPressed: optionCtrls.length <= 2
                                  ? null
                                  : () => setSheetState(() {
                                        optionCtrls.removeAt(i);
                                        if (correctIndex == i) {
                                          correctIndex = null;
                                        } else if (correctIndex != null && correctIndex! > i) {
                                          correctIndex = correctIndex! - 1;
                                        }
                                      }),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  TextButton.icon(
                    onPressed: () => setSheetState(() => optionCtrls.add(TextEditingController())),
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text('Aggiungi opzione'),
                    style: TextButton.styleFrom(foregroundColor: AppColors.goldDark),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        final options = optionCtrls.map((c) => c.text.trim()).where((s) => s.isNotEmpty).toList();
                        if (titleCtrl.text.trim().isEmpty) {
                          ref.read(toastProvider.notifier).show('Scrivi il testo della domanda.', type: 'error');
                          return;
                        }
                        if (options.length < 2) {
                          ref.read(toastProvider.notifier).show('Inserisci almeno due opzioni.', type: 'error');
                          return;
                        }
                        if (correctIndex == null || correctIndex! >= optionCtrls.length) {
                          ref.read(toastProvider.notifier).show('Seleziona quale opzione è quella corretta.', type: 'error');
                          return;
                        }
                        Navigator.pop(ctx, true);
                      },
                      child: const Text('Salva'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    if (saved != true) return;
    final voteOptions = optionCtrls.map((c) => c.text.trim()).where((s) => s.isNotEmpty).toList();
    final correctAnswer = correctIndex != null && correctIndex! < optionCtrls.length
        ? optionCtrls[correctIndex!].text.trim()
        : null;
    final notifier = ref.read(manageChallengesProvider('quiz').notifier);
    if (existing == null) {
      await notifier.create(
        title: titleCtrl.text.trim(),
        description: descCtrl.text.trim(),
        points: int.tryParse(pointsCtrl.text) ?? 0,
        correctAnswer: correctAnswer,
        voteOptions: voteOptions,
      );
    } else {
      await notifier.updateChallenge(existing.id, {
        'title': titleCtrl.text.trim(),
        'description': descCtrl.text.trim(),
        'points': int.tryParse(pointsCtrl.text) ?? 0,
        'correct_answer': correctAnswer,
        'vote_options': voteOptions,
      });
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final challengesAsync = ref.watch(manageChallengesProvider('quiz'));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const GameAppBar(),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.goldPrimary,
        foregroundColor: Colors.white,
        onPressed: () => _openEditor(context, ref),
        child: const Icon(Icons.add_rounded),
      ),
      body: challengesAsync.when(
        data: (list) => list.isEmpty
            ? const _EmptyState()
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                itemCount: list.length,
                itemBuilder: (context, i) {
                  final c = list[i];
                  return _QuizManageCard(
                    challenge: c,
                    onTap: () => _openEditor(context, ref, existing: c),
                    onToggle: (v) => ref.read(manageChallengesProvider('quiz').notifier).toggleActive(c.id, v),
                    onEdit: () => _openEditor(context, ref, existing: c),
                    onDelete: () => _confirmDelete(context, ref, c.id),
                  );
                },
              ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, st) => Center(child: Text('Errore: $e')),
      ),
    );
  }
}

class _QuizManageCard extends StatelessWidget {
  final Challenge challenge;
  final VoidCallback onTap;
  final ValueChanged<bool> onToggle;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _QuizManageCard({
    required this.challenge,
    required this.onTap,
    required this.onToggle,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.goldPrimary.withOpacity(0.14)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.goldPrimary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text('+${challenge.points} PT',
                          style: TextStyle(color: AppColors.goldDark, fontWeight: FontWeight.w700, fontSize: 12)),
                    ),
                    const Spacer(),
                    Switch(value: challenge.active, onChanged: onToggle, activeColor: AppColors.goldPrimary),
                  ],
                ),
                const SizedBox(height: 6),
                Text(challenge.title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 19)),
                if (challenge.options.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      'Nessuna opzione di risposta — gli invitati non potranno rispondere.',
                      style: TextStyle(color: AppColors.rosePrimary, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      challenge.correctAnswer != null
                          ? '${challenge.options.length} opzioni · risposta: ${challenge.correctAnswer}'
                          : '${challenge.options.length} opzioni',
                      style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5),
                    ),
                  ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined),
                      color: AppColors.inkMuted,
                      onPressed: onEdit,
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline),
                      color: AppColors.rosePrimary,
                      onPressed: onDelete,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.emoji_objects_outlined, size: 44, color: AppColors.goldPrimary.withOpacity(0.5)),
            const SizedBox(height: 12),
            Text('Nessuna domanda ancora', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 6),
            Text(
              'Tocca + per creare la prima domanda del quiz.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.inkMuted),
            ),
          ],
        ),
      ),
    );
  }
}

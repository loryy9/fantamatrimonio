import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../challenges/challenges_controller.dart';
import '../challenges/challenge.dart';
import '../timer/timer_provider.dart';
import '../timer/timer_status.dart';
import '../../core/providers.dart';
import '../../core/api_exception.dart';
import '../shell/app_bar_chrome.dart';
import '../shell/toast_controller.dart';
import '../../theme/app_theme.dart';

const _emerald = Color(0xFF3A7D5E);

final quizSubTabProvider = StateProvider<String>((ref) => 'quiz');

class QuizScreen extends ConsumerWidget {
  const QuizScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subTab = ref.watch(quizSubTabProvider);
    final challengesAsync = ref.watch(challengesProvider);
    final challenges = challengesAsync.value ?? [];
    final tick = ref.watch(timerProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const GameAppBar(),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
            child: _SubNav(
              value: subTab,
              onChanged: (v) => ref.read(quizSubTabProvider.notifier).state = v,
            ),
          ),
          Expanded(
            child: tick.status == TimerStatus.beforeStart
                ? _LockedState(startTime: tick.startTimeFormatted, isQuiz: subTab == 'quiz')
                : subTab == 'quiz'
                    ? _QuizList(
                        challenges: challenges.where((c) => c.type == 'quiz').toList(),
                        timerEnded: tick.status == TimerStatus.ended,
                      )
                    : _VoteList(
                        challenges: challenges.where((c) => c.type == 'vote').toList(),
                        timerEnded: tick.status == TimerStatus.ended,
                      ),
          ),
        ],
      ),
    );
  }
}

class _SubNav extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;

  const _SubNav({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.goldPrimary.withOpacity(0.16)),
      ),
      child: Row(
        children: [
          Expanded(child: _SubNavButton(label: 'Quiz Sposi', selected: value == 'quiz', onTap: () => onChanged('quiz'))),
          Expanded(
              child: _SubNavButton(
                  label: 'Momenti Migliori', selected: value == 'vote', onTap: () => onChanged('vote'))),
        ],
      ),
    );
  }
}

class _SubNavButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _SubNavButton({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.goldPrimary.withOpacity(0.16) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: selected ? Border.all(color: AppColors.goldPrimary.withOpacity(0.4)) : null,
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 13,
            color: selected ? AppColors.goldDark : AppColors.inkMuted,
          ),
        ),
      ),
    );
  }
}

class _LockedState extends StatelessWidget {
  final String startTime;
  final bool isQuiz;

  const _LockedState({required this.startTime, required this.isQuiz});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(isQuiz ? Icons.emoji_objects_outlined : Icons.favorite_outline,
                size: 44, color: AppColors.goldPrimary.withOpacity(0.5)),
            const SizedBox(height: 14),
            Text(
              isQuiz ? 'Quiz sugli Sposi Bloccato' : 'Momenti Migliori Bloccati',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 6),
            Text('Sarà sbloccato alle $startTime',
                textAlign: TextAlign.center, style: TextStyle(color: AppColors.inkMuted)),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String subtitle;

  const _SectionHeader({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 6, 4, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineLarge),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
        ],
      ),
    );
  }
}

class _EmptyList extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _EmptyList({required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: AppColors.goldPrimary.withOpacity(0.4)),
            const SizedBox(height: 10),
            Text(title, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 4),
            Text(subtitle, textAlign: TextAlign.center, style: TextStyle(color: AppColors.inkMuted)),
          ],
        ),
      ),
    );
  }
}

class _QuizList extends ConsumerStatefulWidget {
  final List<Challenge> challenges;
  final bool timerEnded;
  const _QuizList({required this.challenges, required this.timerEnded});

  @override
  ConsumerState<_QuizList> createState() => _QuizListState();
}

class _QuizListState extends ConsumerState<_QuizList> {
  final _localResults = <int, Map<String, dynamic>>{};
  final _answering = <int>{};

  Future<void> _answer(Challenge quiz, String optionId) async {
    if (widget.timerEnded || quiz.completed || _localResults.containsKey(quiz.id) || _answering.contains(quiz.id)) {
      return;
    }

    setState(() => _answering.add(quiz.id));
    final api = ref.read(apiClientProvider);
    try {
      final res = await api.post('/submissions/quiz/${quiz.id}', body: {'answer': optionId}) as Map<String, dynamic>;
      setState(() => _localResults[quiz.id] = {
            'selected': optionId,
            'is_correct': res['is_correct'],
            'correct_answer': res['correct_answer'],
          });
      ref.read(toastProvider.notifier).show(
            res['is_correct'] == true ? 'Risposta corretta, hai guadagnato ${res['points_awarded']} punti! 🎉' : 'Risposta sbagliata',
            type: res['is_correct'] == true ? 'success' : 'error',
            points: res['points_awarded'] as int?,
          );
      await ref.read(challengesProvider.notifier).refresh();
    } on ApiException catch (e) {
      final message = e.status == 409 ? 'Hai già risposto a questa domanda.' : e.message;
      ref.read(toastProvider.notifier).show(message, type: 'error');
    } finally {
      if (mounted) setState(() => _answering.remove(quiz.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.challenges.isEmpty) {
      return const _EmptyList(
        icon: Icons.emoji_objects_outlined,
        title: 'Nessun quiz attivo',
        subtitle: 'I quiz verranno sbloccati durante il ricevimento!',
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: widget.challenges.length + 1,
      itemBuilder: (context, i) {
        if (i == 0) {
          return const _SectionHeader(
            title: 'Quiz sugli Sposi',
            subtitle: 'Rispondi alle domande e dimostra quanto conosci gli sposi!',
          );
        }
        final quiz = widget.challenges[i - 1];
        final localResult = _localResults[quiz.id];
        final isDone = quiz.completed || localResult != null;
        final isCorrect = localResult?['is_correct'] as bool? ?? quiz.isCorrect ?? false;
        final myAnswer = localResult?['selected'] as String? ?? quiz.myAnswer;
        final correctAnswer = localResult?['correct_answer'] as String? ?? quiz.correctAnswer;

        return _QuizCard(
          quiz: quiz,
          isDone: isDone,
          isCorrect: isCorrect,
          myAnswer: myAnswer,
          correctAnswer: correctAnswer,
          answering: _answering.contains(quiz.id),
          timerEnded: widget.timerEnded,
          onAnswer: (optionId) => _answer(quiz, optionId),
        );
      },
    );
  }
}

class _QuizCard extends StatelessWidget {
  final Challenge quiz;
  final bool isDone;
  final bool isCorrect;
  final String? myAnswer;
  final String? correctAnswer;
  final bool answering;
  final bool timerEnded;
  final ValueChanged<String> onAnswer;

  const _QuizCard({
    required this.quiz,
    required this.isDone,
    required this.isCorrect,
    required this.myAnswer,
    required this.correctAnswer,
    required this.answering,
    required this.timerEnded,
    required this.onAnswer,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.goldPrimary.withOpacity(0.14)),
        boxShadow: [BoxShadow(color: AppColors.goldDark.withOpacity(0.06), blurRadius: 16, offset: const Offset(0, 6))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _chip('+${quiz.points} PT', AppColors.goldDark, AppColors.goldPrimary.withOpacity(0.12)),
              const Spacer(),
              if (isDone)
                _chip(
                  isCorrect ? '✓ Esatta (+${quiz.points} PT)' : '✗ Errata (0 PT)',
                  isCorrect ? _emerald : AppColors.rosePrimary,
                  (isCorrect ? _emerald : AppColors.rosePrimary).withOpacity(0.12),
                )
              else if (timerEnded)
                _chip('Tempo scaduto', AppColors.inkMuted, Colors.black.withOpacity(0.05)),
            ],
          ),
          const SizedBox(height: 10),
          Text(quiz.title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 19)),
          if (quiz.description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(quiz.description, style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
          ],
          if (isDone) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (isCorrect ? _emerald : AppColors.rosePrimary).withOpacity(0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: (isCorrect ? _emerald : AppColors.rosePrimary).withOpacity(0.3)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(isCorrect ? Icons.check_circle_rounded : Icons.cancel_rounded,
                      color: isCorrect ? _emerald : AppColors.rosePrimary, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('La tua risposta: ${myAnswer ?? 'N/D'}',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                        const SizedBox(height: 2),
                        Text(
                          isCorrect
                              ? 'Risposta esatta! Punti assegnati: +${quiz.points} PT'
                              : 'Risposta non corretta. Quella corretta era: ${correctAnswer ?? 'N/D'}',
                          style: TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          ...quiz.options.asMap().entries.map((entry) {
            final optIndex = entry.key;
            final opt = entry.value;
            final optLetter = String.fromCharCode(65 + optIndex);
            final isSelected = myAnswer == opt.id;
            final isCorrectOpt = correctAnswer == opt.id;
            final locked = isDone || timerEnded;

            Color borderColor = AppColors.goldPrimary.withOpacity(0.14);
            Color bg = AppColors.background;
            if (isDone && isCorrectOpt) {
              borderColor = _emerald.withOpacity(0.5);
              bg = _emerald.withOpacity(0.08);
            } else if (isDone && isSelected && !isCorrect) {
              borderColor = AppColors.rosePrimary.withOpacity(0.5);
              bg = AppColors.rosePrimary.withOpacity(0.08);
            }

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: bg,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: locked || answering ? null : () => onAnswer(opt.id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: borderColor),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 26,
                          height: 26,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: Colors.black.withOpacity(0.05), shape: BoxShape.circle),
                          child: Text(optLetter, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: AppColors.inkMuted)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Text(opt.text, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
                        if (isDone && isSelected && isCorrect)
                          _tag('La tua risposta ✓', _emerald)
                        else if (isDone && isSelected && !isCorrect)
                          _tag('La tua risposta ✗', AppColors.rosePrimary)
                        else if (isDone && isCorrectOpt)
                          _tag('Risposta corretta', _emerald),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _chip(String text, Color fg, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
        child: Text(text, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 11.5)),
      );

  Widget _tag(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
        child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 10.5)),
      );
}

class _VoteList extends ConsumerStatefulWidget {
  final List<Challenge> challenges;
  final bool timerEnded;
  const _VoteList({required this.challenges, required this.timerEnded});

  @override
  ConsumerState<_VoteList> createState() => _VoteListState();
}

class _VoteListState extends ConsumerState<_VoteList> {
  final _controllers = <int, TextEditingController>{};
  final _saving = <int>{};

  TextEditingController _ctrlFor(Challenge c) =>
      _controllers.putIfAbsent(c.id, () => TextEditingController(text: c.myVote ?? ''));

  Future<void> _save(Challenge c) async {
    final text = _ctrlFor(c).text.trim();
    if (text.isEmpty) {
      ref.read(toastProvider.notifier).show('Scrivi il tuo momento prima di salvare!', type: 'error');
      return;
    }
    setState(() => _saving.add(c.id));
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/submissions/vote/${c.id}', body: {
        'option_id': text,
        'text': text,
      }) as Map<String, dynamic>;

      final isFirstTime = res['status'] == 'created';
      ref.read(toastProvider.notifier).show(
            isFirstTime ? 'Momento salvato! Hai guadagnato ${res['points_awarded']} punti! 🎉' : 'Momento aggiornato con successo!',
            type: 'success',
            points: isFirstTime ? res['points_awarded'] as int? : null,
          );
      await ref.read(challengesProvider.notifier).refresh();
    } finally {
      if (mounted) setState(() => _saving.remove(c.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.challenges.isEmpty) {
      return const _EmptyList(
        icon: Icons.favorite_outline,
        title: 'Nessuna domanda attiva',
        subtitle: 'I Momenti Migliori appariranno a breve!',
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      itemCount: widget.challenges.length + 1,
      itemBuilder: (context, i) {
        if (i == 0) {
          return const _SectionHeader(
            title: 'Momenti Migliori',
            subtitle: 'Condividi pensieri, ricordi ed emozioni della festa!',
          );
        }
        final c = widget.challenges[i - 1];
        final ctrl = _ctrlFor(c);
        final isAnswered = (c.myVote ?? '').trim().isNotEmpty;

        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.paper,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.goldPrimary.withOpacity(0.14)),
            boxShadow: [BoxShadow(color: AppColors.goldDark.withOpacity(0.06), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(color: AppColors.goldPrimary.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                    child: Text('+${c.points} PT', style: TextStyle(color: AppColors.goldDark, fontWeight: FontWeight.w700, fontSize: 11.5)),
                  ),
                  const Spacer(),
                  if (isAnswered)
                    Icon(Icons.check_circle_rounded, color: _emerald, size: 18),
                ],
              ),
              const SizedBox(height: 10),
              Text(c.title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 19)),
              if (c.description.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(c.description, style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: ctrl,
                maxLength: 500,
                maxLines: 3,
                enabled: !widget.timerEnded,
                decoration: InputDecoration(
                  hintText: 'Scrivi qui la tua risposta...',
                  filled: true,
                  fillColor: AppColors.background,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                ),
              ),
              if (!widget.timerEnded)
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton(
                    onPressed: _saving.contains(c.id) ? null : () => _save(c),
                    child: Text(isAnswered ? 'Salva modifiche' : 'Invia risposta'),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

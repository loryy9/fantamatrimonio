import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_controller.dart';
import '../../core/providers.dart';
import '../shell/app_bar_chrome.dart';
import '../../theme/app_theme.dart';
import 'leaderboard_controller.dart';
import 'polling_controller.dart';

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(pollingProvider.notifier).start());
  }

  Future<void> _openDetail(String userId) async {
    final api = ref.read(apiClientProvider);
    final detail = await api.get('/leaderboard/$userId') as Map<String, dynamic>;
    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: Container(
          color: AppColors.paper,
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(color: AppColors.inkMuted.withOpacity(0.3), borderRadius: BorderRadius.circular(2)),
              ),
              Text(detail['name'] as String, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 4),
              ShaderMask(
                shaderCallback: (b) => AppGradients.goldRose.createShader(b),
                child: Text('${detail['total_points']} Punti Totali',
                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final entriesAsync = ref.watch(leaderboardProvider);
    final myId = ref.watch(authProvider).value?.user.id;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          Container(
                decoration: const BoxDecoration(
                  gradient: AppGradients.dusk,
                  borderRadius: BorderRadius.only(bottomLeft: Radius.circular(32), bottomRight: Radius.circular(32)),
                ),
                child: const Padding(
                  padding: EdgeInsets.fromLTRB(4, 0, 4, 8),
                  child: GameAppBar(light: true),
                ),
              ),
              Expanded(
                child: entriesAsync.when(
                  data: (entries) {
                    final first = entries.where((e) => e.rank == 1).cast().firstOrNull;
                    final second = entries.where((e) => e.rank == 2).cast().firstOrNull;
                    final third = entries.where((e) => e.rank == 3).cast().firstOrNull;
                    final rest = entries.where((e) => e.rank > 3).toList();

                    return ListView(
                      padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _PodiumSlot(entry: second, medal: '🥈', height: 96, onTap: _openDetail),
                            _PodiumSlot(entry: first, medal: '🥇', height: 128, crown: true, onTap: _openDetail),
                            _PodiumSlot(entry: third, medal: '🥉', height: 78, onTap: _openDetail),
                          ],
                        ),
                        const SizedBox(height: 28),
                        ...rest.asMap().entries.map((e) => _RankRow(
                              rank: e.value.rank,
                              name: e.value.id == myId ? 'Tu' : e.value.name,
                              points: e.value.totalPoints,
                              isMe: e.value.id == myId,
                              onTap: () => _openDetail(e.value.id),
                            )),
                      ],
                    );
                  },
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, st) => Center(child: Text('Errore: $e')),
                ),
              ),
        ],
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class _PodiumSlot extends StatelessWidget {
  final dynamic entry;
  final String medal;
  final double height;
  final bool crown;
  final void Function(String userId) onTap;
  const _PodiumSlot({required this.entry, required this.medal, required this.height, this.crown = false, required this.onTap});

  @override
  Widget build(BuildContext context) {
    if (entry == null) {
      return SizedBox(
        width: 92,
        child: Column(
          children: [
            Text(medal, style: const TextStyle(fontSize: 26)),
            const SizedBox(height: 8),
            Text('In attesa', style: TextStyle(color: AppColors.inkMuted, fontSize: 11)),
          ],
        ),
      );
    }
    return GestureDetector(
      onTap: () => onTap(entry.id as String),
      child: SizedBox(
        width: 96,
        child: Column(
          children: [
            if (crown) const Icon(Icons.workspace_premium_rounded, color: AppColors.goldPrimary, size: 22),
            Text(medal, style: const TextStyle(fontSize: 30)),
            const SizedBox(height: 6),
            Text(entry.name as String,
                maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            Text('${entry.totalPoints} pt', style: TextStyle(color: AppColors.inkMuted, fontSize: 11)),
            const SizedBox(height: 10),
            Container(
              height: height,
              decoration: BoxDecoration(
                gradient: crown ? AppGradients.goldRose : AppGradients.roseNeonGlow,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                boxShadow: [
                  BoxShadow(color: AppColors.goldDark.withOpacity(0.25), blurRadius: 14, offset: const Offset(0, 6)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RankRow extends StatelessWidget {
  final int rank;
  final String name;
  final int points;
  final bool isMe;
  final VoidCallback onTap;

  const _RankRow({required this.rank, required this.name, required this.points, required this.isMe, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: isMe ? AppColors.goldPrimary.withOpacity(0.10) : AppColors.paper,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: isMe ? AppColors.goldPrimary.withOpacity(0.4) : AppColors.goldPrimary.withOpacity(0.10)),
            ),
            child: Row(
              children: [
                SizedBox(
                  width: 30,
                  child: Text('#$rank', style: TextStyle(color: AppColors.inkMuted, fontWeight: FontWeight.w700)),
                ),
                Expanded(
                  child: Text(name, style: TextStyle(fontWeight: FontWeight.w600, color: isMe ? AppColors.goldDark : AppColors.ink)),
                ),
                Text('$points pt', style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

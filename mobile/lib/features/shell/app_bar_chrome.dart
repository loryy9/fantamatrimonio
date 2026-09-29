import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_controller.dart';
import '../../theme/app_theme.dart';
import '../../router/app_router.dart';

class GameAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final bool light;

  const GameAppBar({super.key, this.light = false});

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 10);

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.paper,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Vuoi davvero uscire?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annulla')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Esci')),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authProvider.notifier).logout();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authProvider).value;
    final isCouple = session?.user.isCouple ?? false;
    final fg = light ? Colors.white : AppColors.ink;
    final muted = light ? Colors.white.withOpacity(0.75) : AppColors.inkMuted;

    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 12, 0),
        child: Row(
          children: [
            Expanded(
              child: Text(
                session != null ? '${session.event.spouse1Name} & ${session.event.spouse2Name}' : 'Fanta Matrimonio',
                style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 15),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (session != null)
              GlassSurface(
                dark: light,
                borderRadius: BorderRadius.circular(14),
                blur: 12,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.auto_awesome_rounded, size: 14, color: AppColors.goldPrimary),
                    const SizedBox(width: 5),
                    Text('${session.user.totalPoints} pt', style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 13)),
                  ],
                ),
              ),
            if (isCouple)
              IconButton(
                icon: Icon(Icons.settings_outlined, color: muted, size: 20),
                onPressed: () => context.go(RoutePaths.manageRoot),
              ),
            IconButton(
              icon: Icon(Icons.logout_rounded, color: muted, size: 20),
              onPressed: () => _confirmLogout(context, ref),
            ),
          ],
        ),
      ),
    );
  }
}

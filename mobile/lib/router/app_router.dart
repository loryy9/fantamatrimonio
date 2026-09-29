import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/auth_controller.dart';
import '../features/shell/entry_screen.dart';
import '../features/home/home_screen.dart';
import '../features/gallery/gallery_screen.dart';
import '../features/hunt/hunt_screen.dart';
import '../features/quiz/quiz_screen.dart';
import '../features/leaderboard/leaderboard_screen.dart';
import '../features/manage/manage_home_screen.dart';
import '../features/manage/manage_settings_screen.dart';
import '../features/manage/manage_quiz_screen.dart';
import '../features/manage/manage_hunt_screen.dart';
import '../features/manage/manage_vote_screen.dart';
import '../features/wizard/wizard_screen.dart';
import '../features/auth/login_form_screen.dart';
import '../features/shell/glass_nav_bar.dart';
import '../features/shell/toast_overlay.dart';
import '../theme/app_theme.dart';

class RoutePaths {
  static const entry = '/entry';
  static const home = '/home';
  static const gallery = '/gallery';
  static const hunt = '/hunt';
  static const quiz = '/quiz';
  static const leaderboard = '/leaderboard';
  static const manageRoot = '/manage';
  static const manageSettings = '/manage/settings';
  static const manageQuiz = '/manage/quiz';
  static const manageHunt = '/manage/hunt';
  static const manageVote = '/manage/vote';
  static const wizard = '/wizard';
  static const login = '/login';
}

String? _manageGuard(BuildContext context, GoRouterState state, Ref ref) {
  final session = ref.read(authProvider).value;
  if (session == null || !session.user.isCouple) return RoutePaths.home;
  return null;
}

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: RoutePaths.entry,
    redirect: (context, state) {
      final authAsync = ref.read(authProvider);
      if (authAsync.isLoading) return null; // stay put; FantaMatrimonioApp shows the splash instead of this router while loading
      final session = authAsync.value;
      final isPublicRoute = state.matchedLocation == RoutePaths.entry ||
          state.matchedLocation == RoutePaths.wizard ||
          state.matchedLocation == RoutePaths.login;

      if (session == null) {
        return isPublicRoute ? null : RoutePaths.entry;
      }
      if (isPublicRoute) return RoutePaths.home;
      return null;
    },
    refreshListenable: _AuthRefreshNotifier(ref),
    routes: [
      GoRoute(path: RoutePaths.entry, builder: (c, s) => const EntryScreen()),
      GoRoute(
        path: RoutePaths.wizard,
        pageBuilder: (c, s) => CustomTransitionPage(
          key: s.pageKey,
          child: const WizardScreen(),
          transitionsBuilder: glassPageTransitionBuilder,
          transitionDuration: glassPageTransitionDuration,
          reverseTransitionDuration: glassPageTransitionDuration,
        ),
      ),
      GoRoute(
        path: RoutePaths.login,
        pageBuilder: (c, s) => CustomTransitionPage(
          key: s.pageKey,
          child: const LoginFormScreen(),
          transitionsBuilder: glassPageTransitionBuilder,
          transitionDuration: glassPageTransitionDuration,
          reverseTransitionDuration: glassPageTransitionDuration,
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => _GuestScaffold(shell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: RoutePaths.home, builder: (c, s) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: RoutePaths.gallery, builder: (c, s) => const GalleryScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: RoutePaths.hunt, builder: (c, s) => const HuntScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: RoutePaths.quiz, builder: (c, s) => const QuizScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: RoutePaths.leaderboard, builder: (c, s) => const LeaderboardScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: RoutePaths.manageRoot,
              redirect: (c, s) => _manageGuard(c, s, ref),
              builder: (c, s) => const ManageHomeScreen(),
              routes: [
                GoRoute(
                  path: 'settings',
                  redirect: (c, s) => _manageGuard(c, s, ref),
                  builder: (c, s) => const ManageSettingsScreen(),
                ),
                GoRoute(
                  path: 'quiz',
                  redirect: (c, s) => _manageGuard(c, s, ref),
                  builder: (c, s) => const ManageQuizScreen(),
                ),
                GoRoute(
                  path: 'hunt',
                  redirect: (c, s) => _manageGuard(c, s, ref),
                  builder: (c, s) => const ManageHuntScreen(),
                ),
                GoRoute(
                  path: 'vote',
                  redirect: (c, s) => _manageGuard(c, s, ref),
                  builder: (c, s) => const ManageVoteScreen(),
                ),
              ],
            ),
          ]),
        ],
      ),
    ],
  );
});

class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

class _GuestScaffold extends ConsumerWidget {
  final StatefulNavigationShell shell;
  const _GuestScaffold({required this.shell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final destinations = <GlassNavDestination>[
      const GlassNavDestination(icon: Icons.home_outlined, activeIcon: Icons.home_rounded, label: 'Home'),
      const GlassNavDestination(icon: Icons.photo_library_outlined, activeIcon: Icons.photo_library_rounded, label: 'Foto'),
      const GlassNavDestination(icon: Icons.explore_outlined, activeIcon: Icons.explore_rounded, label: 'Caccia'),
      const GlassNavDestination(icon: Icons.emoji_objects_outlined, activeIcon: Icons.emoji_objects_rounded, label: 'Giochi'),
      const GlassNavDestination(icon: Icons.emoji_events_outlined, activeIcon: Icons.emoji_events_rounded, label: 'Classifica'),
    ];

    return Scaffold(
      body: Stack(
        children: [
          shell,
          const ToastOverlay(),
        ],
      ),
      bottomNavigationBar: GlassNavBar(
        currentIndex: shell.currentIndex,
        onSelect: (i) => shell.goBranch(i),
        destinations: destinations,
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'theme/app_theme.dart';
import 'router/app_router.dart';
import 'features/auth/auth_controller.dart';
import 'features/shell/splash_screen.dart';

void main() {
  runApp(const ProviderScope(child: FantaMatrimonioApp()));
}

class FantaMatrimonioApp extends ConsumerWidget {
  const FantaMatrimonioApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Resolving the stored session (secure-storage read + optional /auth/me
    // call) takes a moment on cold start; show the animated splash instead
    // of an empty frame until it settles.
    final isResolvingSession = ref.watch(authProvider.select((s) => s.isLoading));
    if (isResolvingSession) {
      return MaterialApp(
        title: 'Fanta Matrimonio',
        theme: AppTheme.light(),
        home: const SplashScreen(),
      );
    }

    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Fanta Matrimonio',
      theme: AppTheme.light(),
      routerConfig: router,
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';

class EntryScreen extends StatelessWidget {
  const EntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.nightInkDeep,
      body: Container(
        decoration: const BoxDecoration(gradient: AppGradients.dusk),
        child: Stack(
          children: [
            Positioned(
              top: -80,
              right: -60,
              child: _Glow(color: AppColors.roseNeon, size: 260),
            ),
            Positioned(
              bottom: -100,
              left: -90,
              child: _Glow(color: AppColors.goldBright, size: 300),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(28, 40, 28, 36),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PER SEMPRE INIZIA QUI',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.goldBright,
                          ),
                    ),
                    const Spacer(),
                    ShaderMask(
                      shaderCallback: (bounds) => AppGradients.goldRose.createShader(bounds),
                      child: Text(
                        'Fanta\nMatrimonio',
                        style: Theme.of(context).textTheme.displayLarge?.copyWith(color: Colors.white),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Gioca, esplora e conquista punti mentre\ncelebri il giorno più bello.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.white.withOpacity(0.72),
                            height: 1.4,
                          ),
                    ),
                    const Spacer(flex: 2),
                    _PrimaryGlassButton(
                      label: 'Ho un codice invito',
                      onTap: () => context.go(RoutePaths.login),
                    ),
                    const SizedBox(height: 14),
                    _SecondaryGhostButton(
                      label: 'Crea il matrimonio dei tuoi sogni',
                      onTap: () => context.go(RoutePaths.wizard),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  final Color color;
  final double size;
  const _Glow({required this.color, required this.size});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: AppGradients.candleGlow(color, opacity: 0.30),
        ),
      ),
    );
  }
}

class _PrimaryGlassButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _PrimaryGlassButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            gradient: AppGradients.goldRose,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(color: AppColors.rosePrimary.withOpacity(0.45), blurRadius: 24, offset: const Offset(0, 10)),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Center(
              child: Text(
                label,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SecondaryGhostButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _SecondaryGhostButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GlassSurface(
      dark: true,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 18),
          child: Center(
            child: Text(
              label,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
            ),
          ),
        ),
      ),
    );
  }
}

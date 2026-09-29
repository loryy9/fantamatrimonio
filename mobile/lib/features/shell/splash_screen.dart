import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// The scene shown while the app resolves the stored session, in place of a
/// plain spinner: a cartoon "just married" car cruising across a candlelit
/// skyline, with floating rings, drifting hearts and a shimmering loading
/// bar — same dusk/gold/rose language as the rest of onboarding.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _drive = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4600),
  )..repeat();

  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void dispose() {
    _drive.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.nightInkDeep,
      body: Container(
        decoration: const BoxDecoration(gradient: AppGradients.dusk),
        child: Stack(
          fit: StackFit.expand,
          children: [
            const Positioned(top: -70, left: -60, child: _Glow(color: AppColors.goldBright, size: 260)),
            const Positioned(bottom: -20, right: -80, child: _Glow(color: AppColors.roseNeon, size: 240)),

            AnimatedBuilder(
              animation: _pulse,
              builder: (context, _) => CustomPaint(
                painter: _SparklePainter(_pulse.value),
                size: Size.infinite,
              ),
            ),

            Align(
              alignment: Alignment.bottomCenter,
              child: AnimatedBuilder(
                animation: _pulse,
                builder: (context, _) => CustomPaint(
                  painter: _SkylinePainter(glow: _pulse.value),
                  size: const Size(double.infinity, 150),
                ),
              ),
            ),

            Align(
              alignment: const Alignment(0, -0.62),
              child: AnimatedBuilder(
                animation: _drive,
                builder: (context, _) {
                  final bob = math.sin(_drive.value * 2 * math.pi) * 6;
                  final tilt = math.sin(_drive.value * 2 * math.pi) * 0.05;
                  return Transform.translate(
                    offset: Offset(0, bob),
                    child: Transform.rotate(
                      angle: tilt,
                      child: const CustomPaint(size: Size(96, 56), painter: _RingsPainter()),
                    ),
                  );
                },
              ),
            ),

            AnimatedBuilder(
              animation: _drive,
              builder: (context, child) {
                final width = MediaQuery.of(context).size.width;
                final t = _drive.value;
                final x = -140 + (width + 280) * Curves.easeInOut.transform(t);
                final bounce = math.sin(t * 2 * math.pi * 8).abs() * 5;
                return Positioned(
                  bottom: 78 + bounce,
                  left: x,
                  child: Opacity(
                    opacity: (math.sin(t * math.pi).abs() * 3).clamp(0.0, 1.0),
                    child: child,
                  ),
                );
              },
              child: const _WeddingCar(),
            ),

            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: 1),
                      duration: const Duration(milliseconds: 900),
                      curve: Curves.elasticOut,
                      builder: (context, t, child) => Opacity(
                        opacity: t.clamp(0.0, 1.0),
                        child: Transform.scale(scale: 0.7 + 0.3 * t.clamp(0.0, 1.0), child: child),
                      ),
                      child: ShaderMask(
                        shaderCallback: (bounds) => AppGradients.goldRose.createShader(bounds),
                        child: Text(
                          'Fanta Matrimonio',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineLarge?.copyWith(color: Colors.white, fontSize: 32),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    AnimatedBuilder(
                      animation: _pulse,
                      builder: (context, _) {
                        final dots = '.' * (1 + (_pulse.value * 3).floor());
                        return Text(
                          'Si sta preparando la festa$dots',
                          style: TextStyle(color: Colors.white.withOpacity(0.62), fontWeight: FontWeight.w600, fontSize: 13),
                        );
                      },
                    ),
                    const SizedBox(height: 28),
                    AnimatedBuilder(
                      animation: _pulse,
                      builder: (context, _) => _ShimmerBar(progress: _pulse.value),
                    ),
                    const SizedBox(height: 48),
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
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: AppGradients.candleGlow(color, opacity: 0.28)),
      ),
    );
  }
}

/// A stylized "just married" car: rounded cartoon body, a heart-shaped
/// balloon bobbing on a string, and a couple of little dust hearts trailing
/// behind it.
class _WeddingCar extends StatelessWidget {
  const _WeddingCar();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      height: 90,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: [
          Positioned(
            top: 0,
            right: 6,
            child: Icon(Icons.favorite_rounded, color: AppColors.roseNeon.withOpacity(0.85), size: 20),
          ),
          Positioned(
            top: 18,
            right: 14,
            child: Container(width: 1.4, height: 22, color: Colors.white.withOpacity(0.35)),
          ),
          Positioned(
            bottom: 10,
            left: -10,
            child: Icon(Icons.favorite_rounded, color: AppColors.goldBright.withOpacity(0.5), size: 12),
          ),
          Positioned(
            bottom: 2,
            left: -22,
            child: Icon(Icons.favorite_rounded, color: AppColors.roseNeon.withOpacity(0.32), size: 9),
          ),
          ShaderMask(
            shaderCallback: (bounds) => AppGradients.goldRose.createShader(bounds),
            child: const Icon(Icons.directions_car_rounded, color: Colors.white, size: 60),
          ),
        ],
      ),
    );
  }
}

/// Two interlocked wedding-ring outlines, one gold and one rose, drawn by
/// hand so they read as jewelry rather than a generic icon glyph.
class _RingsPainter extends CustomPainter {
  const _RingsPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final radius = size.height * 0.42;
    final strokeWidth = size.height * 0.1;
    final centerY = size.height / 2;

    final goldPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = AppColors.goldBright;
    final rosePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = AppColors.roseNeon;

    canvas.drawCircle(Offset(size.width * 0.38, centerY), radius, goldPaint);
    canvas.drawCircle(Offset(size.width * 0.62, centerY), radius, rosePaint);
  }

  @override
  bool shouldRepaint(covariant _RingsPainter oldDelegate) => false;
}

/// A soft candlelit hill silhouette with a few glimmering little windows,
/// standing in for the "ground" the car drives along.
class _SkylinePainter extends CustomPainter {
  final double glow;
  const _SkylinePainter({required this.glow});

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()..moveTo(0, size.height);
    path.lineTo(0, size.height * 0.55);
    path.quadraticBezierTo(size.width * 0.15, size.height * 0.35, size.width * 0.32, size.height * 0.5);
    path.quadraticBezierTo(size.width * 0.48, size.height * 0.62, size.width * 0.62, size.height * 0.42);
    path.quadraticBezierTo(size.width * 0.8, size.height * 0.22, size.width, size.height * 0.5);
    path.lineTo(size.width, size.height);
    path.close();

    canvas.drawPath(path, Paint()..color = AppColors.nightInk.withOpacity(0.75));

    final dotOpacity = (0.35 + 0.45 * (0.5 + 0.5 * math.sin(glow * 2 * math.pi))).clamp(0.0, 1.0);
    final windowPaint = Paint()..color = AppColors.goldBright.withOpacity(dotOpacity);
    for (final f in const [0.18, 0.27, 0.5, 0.58, 0.7, 0.86]) {
      canvas.drawCircle(Offset(size.width * f, size.height * 0.72), 2.2, windowPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _SkylinePainter oldDelegate) => oldDelegate.glow != glow;
}

/// A handful of twinkling sparkles scattered over the scene.
class _SparklePainter extends CustomPainter {
  final double t;
  const _SparklePainter(this.t);

  static const _positions = [
    Offset(0.12, 0.14),
    Offset(0.82, 0.1),
    Offset(0.68, 0.22),
    Offset(0.28, 0.28),
    Offset(0.9, 0.34),
    Offset(0.06, 0.4),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    for (var i = 0; i < _positions.length; i++) {
      final phase = t + i / _positions.length;
      final opacity = (0.25 + 0.55 * (0.5 + 0.5 * math.sin(phase * 2 * math.pi))).clamp(0.0, 1.0);
      final p = _positions[i];
      canvas.drawCircle(
        Offset(size.width * p.dx, size.height * p.dy),
        1.6 + (i.isEven ? 0.6 : 0),
        Paint()..color = Colors.white.withOpacity(opacity * 0.8),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _SparklePainter oldDelegate) => oldDelegate.t != t;
}

/// A slim gradient loading bar with a moving shimmer highlight, used instead
/// of a plain spinner.
class _ShimmerBar extends StatelessWidget {
  final double progress;
  const _ShimmerBar({required this.progress});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(3),
      child: SizedBox(
        height: 5,
        width: 140,
        child: Stack(
          children: [
            Container(color: Colors.white.withOpacity(0.12)),
            Align(
              alignment: Alignment(-1 + 2 * progress, 0),
              child: FractionallySizedBox(
                widthFactor: 0.4,
                child: Container(decoration: const BoxDecoration(gradient: AppGradients.goldRose)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

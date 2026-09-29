import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../auth/auth_controller.dart';
import '../timer/timer_provider.dart';
import '../timer/timer_status.dart';
import '../challenges/challenges_controller.dart';
import '../gallery/gallery_controller.dart';
import '../gallery/gallery_photo.dart';
import '../shell/app_bar_chrome.dart';
import '../shell/toast_controller.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';

String _formatName(String s) {
  if (s.isEmpty) return s;
  return '${s[0].toUpperCase()}${s.substring(1).toLowerCase()}';
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  void _goToBranch(BuildContext context, String path) {
    GoRouter.of(context).go(path);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authProvider).value;
    final tick = ref.watch(timerProvider);
    final challengesAsync = ref.watch(challengesProvider);
    final challenges = challengesAsync.value ?? [];

    final huntTotal = challenges.where((c) => c.type == 'hunt').length;
    final huntDone = challenges.where((c) => c.type == 'hunt' && c.completed).length;
    final quizTotal = challenges.where((c) => c.type == 'quiz').length;
    final quizDone = challenges.where((c) => c.type == 'quiz' && c.completed).length;
    final hasVoted = challenges.any((c) => c.type == 'vote' && c.completed);

    if (session == null) return const SizedBox.shrink();

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: _QuickCaptureFab(enabled: tick.status != TimerStatus.beforeStart),
      body: Column(
        children: [
          _HeroHeader(
                appBar: const GameAppBar(light: true),
                name: _formatName(session.user.firstName),
                coupleNames: '${session.event.spouse1Name} & ${session.event.spouse2Name}',
                tick: tick,
                points: session.user.totalPoints,
                onLeaderboard: () => _goToBranch(context, RoutePaths.leaderboard),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 26, 20, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Le Tue Attività', style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(height: 4),
                      Text(
                        'Scegli dove giocare adesso',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.inkMuted),
                      ),
                      const SizedBox(height: 18),
                      _ActivityCarousel(
                        tiles: [
                          _ActivityTileData(
                            title: 'Galleria Foto',
                            subtitle: 'Carica i tuoi scatti',
                            badge: tick.status == TimerStatus.beforeStart ? 'Alle ${tick.startTimeFormatted}' : '+10 pt cad.',
                            icon: Icons.photo_camera_rounded,
                            accent: AppColors.rosePrimary,
                            onTap: () => _goToBranch(context, RoutePaths.gallery),
                          ),
                          _ActivityTileData(
                            title: 'Caccia al Tesoro',
                            subtitle: 'Trova gli indizi',
                            badge: tick.status == TimerStatus.beforeStart ? 'Alle ${tick.startTimeFormatted}' : '$huntDone/$huntTotal fatte',
                            icon: Icons.explore_rounded,
                            accent: AppColors.goldPrimary,
                            onTap: () => _goToBranch(context, RoutePaths.hunt),
                          ),
                          _ActivityTileData(
                            title: 'Quiz Sposi',
                            subtitle: 'Metti alla prova la memoria',
                            badge: tick.status == TimerStatus.beforeStart ? 'Alle ${tick.startTimeFormatted}' : '$quizDone/$quizTotal risolti',
                            icon: Icons.emoji_objects_rounded,
                            accent: AppColors.goldDark,
                            onTap: () => _goToBranch(context, RoutePaths.quiz),
                          ),
                          _ActivityTileData(
                            title: 'Momenti Migliori',
                            subtitle: 'Condividi un ricordo',
                            badge: tick.status == TimerStatus.beforeStart
                                ? 'Alle ${tick.startTimeFormatted}'
                                : (hasVoted ? 'Compilato' : 'Da compilare'),
                            icon: Icons.favorite_rounded,
                            accent: AppColors.roseLight,
                            onTap: () => _goToBranch(context, RoutePaths.quiz),
                          ),
                        ],
                      ),
                      const SizedBox(height: 30),
                      _RecentPhotosSection(onSeeAll: () => _goToBranch(context, RoutePaths.gallery)),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

class _HeroHeader extends StatelessWidget {
  final Widget appBar;
  final String name;
  final String coupleNames;
  final TimerTick tick;
  final int points;
  final VoidCallback onLeaderboard;

  const _HeroHeader({
    required this.appBar,
    required this.name,
    required this.coupleNames,
    required this.tick,
    required this.points,
    required this.onLeaderboard,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(36), bottomRight: Radius.circular(36)),
      child: Container(
        decoration: const BoxDecoration(gradient: AppGradients.dusk),
        child: Stack(
          children: [
            Positioned(top: -50, right: -40, child: _glow(AppColors.roseNeon)),
            Positioned(bottom: -60, left: -30, child: _glow(AppColors.goldBright)),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  appBar,
                  const SizedBox(height: 10),
                  Text(coupleNames, style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12, letterSpacing: 0.5)),
                  Text(
                    'Ciao, $name!',
                    style: Theme.of(context).textTheme.displayLarge?.copyWith(color: Colors.white, fontSize: 36),
                  ),
                  const SizedBox(height: 16),
                  if (tick.status == TimerStatus.beforeStart)
                    GlassSurface(
                      dark: true,
                      tintColor: AppColors.goldPrimary,
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('I giochi inizieranno tra', style: TextStyle(color: Colors.white.withOpacity(0.75))),
                          Text(
                            tick.toStart.formatted,
                            style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    )
                  else
                    GlassSurface(
                      dark: true,
                      tintColor: AppColors.goldPrimary,
                      padding: const EdgeInsets.all(18),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Il Tuo Punteggio', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12)),
                              Text(
                                '$points',
                                style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w700),
                              ),
                              if (tick.status == TimerStatus.inProgress)
                                Text('Termina tra ${tick.toEnd.formatted}',
                                    style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11)),
                              if (tick.status == TimerStatus.ended)
                                const Text('Tempo scaduto 🏆', style: TextStyle(color: Colors.white, fontSize: 11)),
                            ],
                          ),
                          GestureDetector(
                            onTap: onLeaderboard,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              decoration: BoxDecoration(
                                gradient: AppGradients.goldRose,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Text('Classifica →', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _glow(Color color) => IgnorePointer(
        child: Container(
          width: 200,
          height: 200,
          decoration: BoxDecoration(shape: BoxShape.circle, gradient: AppGradients.candleGlow(color)),
        ),
      );
}

/// Data for one card in the [_ActivityCarousel].
class _ActivityTileData {
  final String title;
  final String subtitle;
  final String? badge;
  final IconData icon;
  final Color accent;
  final VoidCallback onTap;

  const _ActivityTileData({
    required this.title,
    required this.subtitle,
    this.badge,
    required this.icon,
    required this.accent,
    required this.onTap,
  });
}

/// A swipeable deck of activity cards — each one an opaque near-black tile
/// (so it reads correctly even sitting on the light body, unlike a glass
/// surface with nothing dark behind it), with a peek of the next card and a
/// dot indicator instead of a static grid.
class _ActivityCarousel extends StatefulWidget {
  final List<_ActivityTileData> tiles;

  const _ActivityCarousel({required this.tiles});

  @override
  State<_ActivityCarousel> createState() => _ActivityCarouselState();
}

class _ActivityCarouselState extends State<_ActivityCarousel> {
  final _controller = PageController(viewportFraction: 0.84);
  double _page = 0;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() => _page = _controller.page ?? 0));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 208,
          child: PageView.builder(
            controller: _controller,
            physics: const BouncingScrollPhysics(),
            itemCount: widget.tiles.length,
            itemBuilder: (context, i) {
              final distance = (_page - i).abs().clamp(0.0, 1.0);
              final scale = 1 - distance * 0.08;
              return Padding(
                padding: const EdgeInsets.only(right: 14),
                child: Transform.scale(
                  scale: scale,
                  child: Opacity(opacity: 1 - distance * 0.25, child: _ActivityCard(data: widget.tiles[i])),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < widget.tiles.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: _page.round() == i ? 20 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: _page.round() == i ? AppColors.goldPrimary : AppColors.inkMuted.withOpacity(0.28),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// A giant, near-invisible icon bleeding off the card's edge — a quiet stand-in
/// for a photo/logo without needing real imagery.
class _CardWatermark extends StatelessWidget {
  final IconData icon;
  final double size;

  const _CardWatermark({required this.icon, required this.size});

  @override
  Widget build(BuildContext context) {
    return Positioned(
      right: -size * 0.16,
      bottom: -size * 0.2,
      child: Icon(icon, size: size, color: Colors.white.withOpacity(0.07)),
    );
  }
}

/// Small flat ring badge — the accent shows once, quietly, instead of
/// glowing across icon, background and border at once.
class _IconBadge extends StatelessWidget {
  final IconData icon;
  final Color accent;
  final double size;

  const _IconBadge({required this.icon, required this.accent, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withOpacity(0.08),
        border: Border.all(color: accent.withOpacity(0.55), width: 1.2),
      ),
      child: Icon(icon, color: accent, size: size * 0.46),
    );
  }
}

Widget _activityBadgeChip(String text) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: Colors.white.withOpacity(0.18), width: 1),
      ),
      child: Text(text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: Colors.white.withOpacity(0.88), fontSize: 10.5, fontWeight: FontWeight.w600)),
    );

/// A native-feeling press: scales down on touch instead of relying on the
/// Material ripple, closer to an iOS button's tactile feedback.
class _PressableScale extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;

  const _PressableScale({required this.child, required this.onTap});

  @override
  State<_PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<_PressableScale> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1,
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOutCubic,
        child: widget.child,
      ),
    );
  }
}

/// One card in the deck — a genuinely opaque dark tile (not glass over an
/// unknown backdrop), with an asymmetric corner cut for a shape that doesn't
/// read as a stock rounded-rectangle card.
class _ActivityCard extends StatelessWidget {
  final _ActivityTileData data;

  const _ActivityCard({required this.data});

  static const _shape = BorderRadius.only(
    topLeft: Radius.circular(34),
    topRight: Radius.circular(34),
    bottomLeft: Radius.circular(34),
    bottomRight: Radius.circular(8),
  );

  @override
  Widget build(BuildContext context) {
    return _PressableScale(
      onTap: data.onTap,
      child: ClipRRect(
        borderRadius: _shape,
        child: Container(
          decoration: BoxDecoration(
            gradient: AppGradients.dusk,
            borderRadius: _shape,
            border: Border.all(color: Colors.white.withOpacity(0.08)),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.22), blurRadius: 18, offset: const Offset(0, 10))],
          ),
          child: Stack(
            children: [
              Positioned(
                top: -36,
                right: -36,
                child: IgnorePointer(
                  child: Container(
                    width: 160,
                    height: 160,
                    decoration:
                        BoxDecoration(shape: BoxShape.circle, gradient: AppGradients.candleGlow(data.accent, opacity: 0.3)),
                  ),
                ),
              ),
              _CardWatermark(icon: data.icon, size: 140),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _IconBadge(icon: data.icon, accent: data.accent, size: 44),
                        const Spacer(),
                        Icon(Icons.arrow_outward_rounded, color: Colors.white.withOpacity(0.35), size: 18),
                      ],
                    ),
                    const Spacer(),
                    Text(data.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white, fontSize: 22)),
                    const SizedBox(height: 4),
                    Text(data.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12.5)),
                    if (data.badge != null) ...[
                      const SizedBox(height: 10),
                      _activityBadgeChip(data.badge!),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Floating quick-capture shortcut: opens the camera directly from Home and
/// uploads the shot, without navigating into the full Gallery screen.
class _QuickCaptureFab extends ConsumerStatefulWidget {
  final bool enabled;

  const _QuickCaptureFab({required this.enabled});

  @override
  ConsumerState<_QuickCaptureFab> createState() => _QuickCaptureFabState();
}

class _QuickCaptureFabState extends ConsumerState<_QuickCaptureFab> {
  bool _busy = false;

  Future<void> _capture() async {
    if (_busy) return;
    XFile? shot;
    try {
      shot = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 90);
    } catch (_) {
      if (mounted) ref.read(toastProvider.notifier).show('Fotocamera non disponibile', type: 'error');
      return;
    }
    if (shot == null) return;

    setState(() => _busy = true);
    final tick = ref.read(timerProvider);
    try {
      final bytes = await shot.readAsBytes();
      await ref.read(galleryProvider.notifier).uploadMany([bytes], awardPoints: tick.status != TimerStatus.ended);
      ref.read(toastProvider.notifier).show(
            'Foto caricata con successo!',
            type: 'success',
            points: tick.status == TimerStatus.ended ? null : 10,
          );
    } catch (e) {
      ref.read(toastProvider.notifier).show(e.toString(), type: 'error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton(
      onPressed: widget.enabled && !_busy ? _capture : null,
      backgroundColor: widget.enabled ? AppColors.goldPrimary : AppColors.goldPrimary.withOpacity(0.4),
      foregroundColor: Colors.white,
      elevation: 4,
      child: _busy
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          : const Icon(Icons.camera_alt_rounded),
    );
  }
}

/// Horizontal strip of the latest guest uploads — gives the home page real,
/// living content beneath the activity deck, and closes the loop with the
/// quick-capture shortcut (shoot a photo, see it show up here).
class _RecentPhotosSection extends ConsumerWidget {
  final VoidCallback onSeeAll;

  const _RecentPhotosSection({required this.onSeeAll});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photosAsync = ref.watch(galleryProvider);
    final recent = [...(photosAsync.value ?? [])]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final shown = recent.take(10).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Scatti Recenti', style: Theme.of(context).textTheme.headlineMedium)),
            GestureDetector(
              onTap: onSeeAll,
              child: Text('Vedi tutte →',
                  style: TextStyle(color: AppColors.goldDark, fontWeight: FontWeight.w700, fontSize: 13)),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text('Gli ultimi momenti caricati dagli invitati',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.inkMuted)),
        const SizedBox(height: 14),
        SizedBox(
          height: 128,
          child: shown.isEmpty
              ? _EmptyPhotosHint(onTap: onSeeAll)
              : ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: shown.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (context, i) => _PhotoThumb(photo: shown[i], onTap: onSeeAll),
                ),
        ),
      ],
    );
  }
}

class _PhotoThumb extends StatelessWidget {
  final GalleryPhoto photo;
  final VoidCallback onTap;

  const _PhotoThumb({required this.photo, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(
          width: 100,
          height: 128,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CachedNetworkImage(
                imageUrl: photo.imageUrl,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: AppColors.paper),
                errorWidget: (_, __, ___) => Container(color: AppColors.paper, child: const Icon(Icons.image_not_supported_outlined)),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(8, 18, 8, 8),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black.withOpacity(0.65)],
                    ),
                  ),
                  child: Text(photo.author,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyPhotosHint extends StatelessWidget {
  final VoidCallback onTap;

  const _EmptyPhotosHint({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.paper,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.goldPrimary.withOpacity(0.25)),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.camera_alt_outlined, color: AppColors.goldDark, size: 18),
            const SizedBox(width: 8),
            Text('Nessuno scatto ancora — sii il primo!',
                style: TextStyle(color: AppColors.inkMuted, fontSize: 12.5)),
          ],
        ),
      ),
    );
  }
}

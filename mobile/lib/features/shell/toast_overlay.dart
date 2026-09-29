import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:confetti/confetti.dart';
import 'toast_controller.dart';
import 'toast.dart';

/// Renders toast messages and the celebratory confetti burst.
///
/// This must be mounted exactly once, at the app shell level (see
/// `app_router.dart`), rather than inside individual tab screens. The tab
/// screens are kept alive simultaneously by `IndexedStack`, so a copy per
/// screen would each treat every new toast as unseen and independently
/// replay the message + confetti whenever the user switched tabs.
class ToastOverlay extends ConsumerStatefulWidget {
  const ToastOverlay({super.key});

  @override
  ConsumerState<ToastOverlay> createState() => _ToastOverlayState();
}

class _ToastOverlayState extends ConsumerState<ToastOverlay> {
  late final ConfettiController _confetti = ConfettiController(duration: const Duration(seconds: 2));
  final _seenIds = <int>{};

  @override
  void dispose() {
    _confetti.dispose();
    super.dispose();
  }

  Color _colorFor(String type) {
    switch (type) {
      case 'success':
        return Colors.green.shade600;
      case 'error':
        return Colors.red.shade600;
      default:
        return Colors.blueGrey.shade600;
    }
  }

  @override
  Widget build(BuildContext context) {
    final toasts = ref.watch(toastProvider);

    for (final t in toasts) {
      if (!_seenIds.contains(t.id)) {
        _seenIds.add(t.id);
        if ((t.points ?? 0) > 0) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _confetti.play());
        }
      }
    }

    return IgnorePointer(
      ignoring: toasts.isEmpty,
      child: Stack(
        children: [
          Align(
            alignment: Alignment.topCenter,
            child: ConfettiWidget(
              confettiController: _confetti,
              blastDirectionality: BlastDirectionality.explosive,
              shouldLoop: false,
            ),
          ),
          Positioned(
            bottom: 90,
            left: 16,
            right: 16,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: toasts
                  .map((t) => _ToastCard(
                        key: ValueKey(t.id),
                        toast: t,
                        color: _colorFor(t.type),
                        onDismiss: () => ref.read(toastProvider.notifier).dismiss(t.id),
                      ))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _ToastCard extends StatefulWidget {
  final ToastMessage toast;
  final Color color;
  final VoidCallback onDismiss;

  const _ToastCard({super.key, required this.toast, required this.color, required this.onDismiss});

  @override
  State<_ToastCard> createState() => _ToastCardState();
}

class _ToastCardState extends State<_ToastCard> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  )..forward();
  late final Animation<Offset> _slide =
      Tween(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
  late final Animation<double> _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _slide,
      child: FadeTransition(
        opacity: _fade,
        child: Card(
          color: widget.color,
          margin: const EdgeInsets.only(top: 8),
          child: ListTile(
            title: Text(widget.toast.text, style: const TextStyle(color: Colors.white)),
            subtitle:
                widget.toast.points != null ? Text('+${widget.toast.points} PT', style: const TextStyle(color: Colors.white70)) : null,
            trailing: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: widget.onDismiss,
            ),
          ),
        ),
      ),
    );
  }
}

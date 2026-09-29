import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_controller.dart';
import '../shell/toast_controller.dart';
import 'leaderboard_controller.dart';

class PollingController extends Notifier<void> {
  Timer? _timer;
  int? _lastKnownPoints;

  @override
  void build() {
    ref.onDispose(() => _timer?.cancel());
  }

  void start() {
    if (_timer != null) return;
    _lastKnownPoints = ref.read(authProvider).value?.user.totalPoints;
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => _tick());
  }

  void pause() {
    _timer?.cancel();
    _timer = null;
  }

  void resume() => start();

  Future<void> _tick() async {
    final before = _lastKnownPoints;
    await ref.read(authProvider.notifier).refreshMe();
    final after = ref.read(authProvider).value?.user.totalPoints;

    if (before != null && after != null && after > before) {
      final diff = after - before;
      ref.read(toastProvider.notifier).show('Hai guadagnato +$diff punti! 🏆', type: 'success', points: diff);
    }
    _lastKnownPoints = after;

    await ref.read(leaderboardProvider.notifier).refresh();
  }
}

final pollingProvider = NotifierProvider<PollingController, void>(PollingController.new);

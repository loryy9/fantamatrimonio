import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import 'leaderboard_entry.dart';

class LeaderboardController extends AsyncNotifier<List<LeaderboardEntry>> {
  @override
  Future<List<LeaderboardEntry>> build() => _fetch();

  Future<List<LeaderboardEntry>> _fetch() async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/leaderboard') as List<dynamic>;
    return res.map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(_fetch);
  }
}

final leaderboardProvider = AsyncNotifierProvider<LeaderboardController, List<LeaderboardEntry>>(LeaderboardController.new);

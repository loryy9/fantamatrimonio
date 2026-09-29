import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import 'challenge.dart';

class ChallengesController extends AsyncNotifier<List<Challenge>> {
  @override
  Future<List<Challenge>> build() => _fetch();

  Future<List<Challenge>> _fetch() async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/challenges') as List<dynamic>;
    return res.map((e) => Challenge.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> refresh() async {
    state = const AsyncLoading<List<Challenge>>().copyWithPrevious(state);
    state = await AsyncValue.guard(_fetch);
  }
}

final challengesProvider = AsyncNotifierProvider<ChallengesController, List<Challenge>>(ChallengesController.new);

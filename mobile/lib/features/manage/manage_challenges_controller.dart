import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../challenges/challenge.dart';
import '../challenges/challenges_controller.dart';

class ManageChallengesController extends FamilyAsyncNotifier<List<Challenge>, String> {
  late final String type = arg;

  @override
  Future<List<Challenge>> build(String arg) => _fetch();

  Future<List<Challenge>> _fetch() async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/challenges') as List<dynamic>;
    return res
        .map((e) => Challenge.fromJson(e as Map<String, dynamic>))
        .where((c) => c.type == arg)
        .toList();
  }

  Future<void> create({
    required String title,
    required String description,
    required int points,
    String? correctAnswer,
    List<String>? voteOptions,
  }) async {
    final api = ref.read(apiClientProvider);
    final res = await api.post('/challenges', body: {
      'title': title,
      'description': description,
      'points': points,
      'type': arg,
      'correct_answer': correctAnswer,
      'vote_options': voteOptions,
    }) as Map<String, dynamic>;

    final created = Challenge.fromJson(res);
    state = AsyncData([...(state.value ?? []), created]);
    ref.invalidate(challengesProvider);
  }

  Future<void> updateChallenge(int id, Map<String, dynamic> updates) async {
    final api = ref.read(apiClientProvider);
    await api.patch('/challenges/$id', body: updates);
    ref.invalidate(challengesProvider);
    state = await AsyncValue.guard(_fetch);
  }

  Future<void> toggleActive(int id, bool active) => updateChallenge(id, {'active': active});

  Future<void> delete(int id) async {
    final previous = state.value ?? [];
    state = AsyncData(previous.where((c) => c.id != id).toList());
    final api = ref.read(apiClientProvider);
    try {
      await api.delete('/challenges/$id');
      ref.invalidate(challengesProvider);
    } catch (_) {
      state = AsyncData(previous);
      rethrow;
    }
  }
}

final manageChallengesProvider =
    AsyncNotifierProvider.family<ManageChallengesController, List<Challenge>, String>(
  ManageChallengesController.new,
);

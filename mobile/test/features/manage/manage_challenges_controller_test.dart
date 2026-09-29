import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/manage/manage_challenges_controller.dart';

class _MockApiClient extends Mock implements ApiClient {}

Map<String, dynamic> _row({int id = 1, bool active = true}) => {
      'id': id, 'title': 'Q1', 'description': 'd', 'points': 10, 'type': 'quiz',
      'active': active, 'correct_answer': 'a', 'vote_options': null,
    };

void main() {
  test('build(type) fetches GET /challenges and filters by type', () async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => [
          _row(id: 1),
          {..._row(id: 2), 'type': 'hunt'},
        ]);

    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);

    final result = await container.read(manageChallengesProvider('quiz').future);

    expect(result, hasLength(1));
    expect(result.first.id, 1);
  });

  test('create() posts the new challenge and appends it optimistically then reconciles', () async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => []);
    when(() => api.post('/challenges', body: any(named: 'body'))).thenAnswer((_) async => _row(id: 5));

    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);
    await container.read(manageChallengesProvider('quiz').future);

    await container.read(manageChallengesProvider('quiz').notifier).create(
          title: 'Q1', description: 'd', points: 10, correctAnswer: 'a',
        );

    final result = container.read(manageChallengesProvider('quiz')).value!;
    expect(result.any((c) => c.id == 5), isTrue);
  });

  test('delete() removes the challenge after confirming with the API', () async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => [_row(id: 1)]);
    when(() => api.delete('/challenges/1')).thenAnswer((_) async => {'success': true, 'deleted_id': 1});

    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);
    await container.read(manageChallengesProvider('quiz').future);

    await container.read(manageChallengesProvider('quiz').notifier).delete(1);

    expect(container.read(manageChallengesProvider('quiz')).value, isEmpty);
  });
}

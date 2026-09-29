import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/challenges/challenges_controller.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  test('build() fetches GET /challenges and parses each entry', () async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => [
          {
            'id': 1,
            'title': 'T',
            'description': 'd',
            'points': 5,
            'type': 'hunt',
            'challenge_type': 'hunt',
            'active': true,
            'config': {'options': []},
            'completed': false,
          },
        ]);

    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);

    final result = await container.read(challengesProvider.future);

    expect(result, hasLength(1));
    expect(result.first.title, 'T');
  });

  test('refresh() re-fetches and replaces the list', () async {
    final api = _MockApiClient();
    var callCount = 0;
    when(() => api.get('/challenges')).thenAnswer((_) async {
      callCount++;
      return [];
    });

    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);
    await container.read(challengesProvider.future);

    await container.read(challengesProvider.notifier).refresh();

    expect(callCount, 2);
  });
}

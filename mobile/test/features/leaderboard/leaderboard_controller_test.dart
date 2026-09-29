import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/leaderboard/leaderboard_controller.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  test('build() fetches GET /leaderboard ordered by rank', () async {
    final api = _MockApiClient();
    when(() => api.get('/leaderboard')).thenAnswer((_) async => [
          {'rank': 1, 'id': 'u1', 'first_name': 'Anna', 'last_name': 'Bianchi', 'name': 'Anna Bianchi', 'total_points': 90},
          {'rank': 2, 'id': 'u2', 'first_name': 'Mario', 'last_name': 'Rossi', 'name': 'Mario Rossi', 'total_points': 60},
        ]);

    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);

    final result = await container.read(leaderboardProvider.future);

    expect(result, hasLength(2));
    expect(result.first.rank, 1);
    expect(result.first.totalPoints, 90);
  });
}

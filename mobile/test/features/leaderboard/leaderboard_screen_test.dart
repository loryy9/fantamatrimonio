import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/auth/auth_controller.dart';
import 'package:fantamatrimonio_mobile/features/auth/models.dart';
import 'package:fantamatrimonio_mobile/features/leaderboard/leaderboard_screen.dart';

class _MockApiClient extends Mock implements ApiClient {}
class _FakeAuthController extends AuthController {
  @override
  Future<AuthSession?> build() async => AuthSession(
        token: 't',
        user: AppUser(id: 'u1', firstName: 'M', lastName: 'R', totalPoints: 60, role: 'guest'),
        event: AppEvent(id: 'e1', spouse1Name: 'A', spouse2Name: 'B', enableTimer: false, startTime: null, endTime: null),
      );
}

void main() {
  testWidgets('renders the top-3 podium and highlights the current user in the rest of the list', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/leaderboard')).thenAnswer((_) async => [
          {'rank': 1, 'id': 'u2', 'first_name': 'Anna', 'last_name': 'B', 'name': 'Anna B', 'total_points': 90},
          {'rank': 2, 'id': 'u3', 'first_name': 'Luca', 'last_name': 'C', 'name': 'Luca C', 'total_points': 80},
          {'rank': 3, 'id': 'u4', 'first_name': 'Elisa', 'last_name': 'D', 'name': 'Elisa D', 'total_points': 70},
          {'rank': 4, 'id': 'u1', 'first_name': 'Mario', 'last_name': 'R', 'name': 'Mario R', 'total_points': 60},
        ]);
    when(() => api.get('/leaderboard/u2')).thenAnswer((_) async => {
          'id': 'u2', 'user': {'id': 'u2', 'first_name': 'Anna', 'last_name': 'B', 'total_points': 90},
          'first_name': 'Anna', 'last_name': 'B', 'name': 'Anna B', 'total_points': 90,
          'points_by_type': {}, 'submissions': [],
        });

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), authProvider.overrideWith(() => _FakeAuthController())],
      child: const MaterialApp(home: LeaderboardScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Anna B'), findsOneWidget);
    expect(find.text('Tu'), findsOneWidget);
  });
}

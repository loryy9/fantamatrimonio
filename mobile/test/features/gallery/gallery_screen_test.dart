import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/auth/auth_controller.dart';
import 'package:fantamatrimonio_mobile/features/auth/models.dart';
import 'package:fantamatrimonio_mobile/features/timer/timer_provider.dart';
import 'package:fantamatrimonio_mobile/features/gallery/gallery_screen.dart';

class _MockApiClient extends Mock implements ApiClient {}
class _FakeAuthController extends AuthController {
  @override
  Future<AuthSession?> build() async => AuthSession(
        token: 't',
        user: AppUser(id: 'u1', firstName: 'M', lastName: 'R', totalPoints: 0, role: 'guest'),
        event: AppEvent(id: 'e1', spouse1Name: 'A', spouse2Name: 'B', enableTimer: false, startTime: null, endTime: null),
      );
}

final _fixedClockOverride = clockProvider.overrideWith((ref) => Stream.value(DateTime.now()));

void main() {
  testWidgets('renders each gallery photo with its author', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/submissions/gallery')).thenAnswer((_) async => [
          {
            'id': 'p1', 'user_id': 'u2', 'image_url': 'https://x/p1.jpg', 'photo_url': 'https://x/p1.jpg',
            'created_at': '2026-06-14T12:00:00+00:00', 'first_name': 'giulia', 'last_name': 'verdi',
            'author': 'Giulia Verdi', 'challenge_type': 'photo', 'challenge_title': 'Foto Libera',
          },
        ]);
    when(() => api.get('/challenges')).thenAnswer((_) async => []);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authProvider.overrideWith(() => _FakeAuthController()),
        _fixedClockOverride,
      ],
      child: const MaterialApp(home: GalleryScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Giulia Verdi'), findsOneWidget);
  });
}

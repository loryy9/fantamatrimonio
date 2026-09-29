import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/core/api_exception.dart';
import 'package:fantamatrimonio_mobile/features/auth/auth_controller.dart';
import 'package:fantamatrimonio_mobile/features/auth/models.dart';
import 'package:fantamatrimonio_mobile/features/timer/timer_provider.dart';
import 'package:fantamatrimonio_mobile/features/quiz/quiz_screen.dart';
import 'package:fantamatrimonio_mobile/features/shell/toast_overlay.dart';

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

// Not pumpAndSettle(): SegmentedButton's Material 3 indicator/ripple
// animation never fully quiesces under flutter_test, so pumpAndSettle()
// times out on any tree containing it. A bounded pump sequence still lets
// the mocked async chains (network calls with no real delay) resolve and
// the tree rebuild.
Future<void> _pumpBounded(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

Map<String, dynamic> _quizChallenge() => {
      'id': 1, 'title': 'Dove si sono conosciuti?', 'description': '', 'points': 30,
      'type': 'quiz', 'challenge_type': 'quiz', 'active': true, 'completed': false,
      'config': {'options': [
        {'id': 'a', 'text': 'In vacanza'},
        {'id': 'b', 'text': 'Al lavoro'},
      ]},
    };

Map<String, dynamic> _voteChallenge() => {
      'id': 2, 'title': 'Il tuo ricordo preferito', 'description': '', 'points': 5,
      'type': 'vote', 'challenge_type': 'vote', 'active': true, 'completed': false,
      'config': {'options': []},
    };

void main() {
  testWidgets('submitting a correct quiz answer shows the success recap and disables options', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => [_quizChallenge()]);
    when(() => api.post('/submissions/quiz/1', body: any(named: 'body'))).thenAnswer((_) async => {
          'is_correct': true, 'correct': true, 'correct_answer': 'a', 'points_awarded': 30, 'message': 'Risposta corretta! 🎉',
        });

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), authProvider.overrideWith(() => _FakeAuthController()), _fixedClockOverride],
      child: const MaterialApp(home: Stack(children: [QuizScreen(), ToastOverlay()])),
    ));
    await _pumpBounded(tester);

    await tester.tap(find.text('In vacanza'));
    await _pumpBounded(tester);

    expect(find.textContaining('Risposta esatta'), findsOneWidget);

    // Drain the success toast's 4s auto-dismiss Timer so it isn't still
    // pending when flutter_test asserts on teardown (see Task 8's ruling).
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('a 409 on quiz submit shows the already-answered message', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => [_quizChallenge()]);
    when(() => api.post('/submissions/quiz/1', body: any(named: 'body')))
        .thenThrow(ApiException('Hai già risposto a questa domanda.', status: 409));

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), authProvider.overrideWith(() => _FakeAuthController()), _fixedClockOverride],
      child: const MaterialApp(home: Stack(children: [QuizScreen(), ToastOverlay()])),
    ));
    await _pumpBounded(tester);

    await tester.tap(find.text('In vacanza'));
    await _pumpBounded(tester);

    expect(find.text('Hai già risposto a questa domanda.'), findsOneWidget);

    // Drain the error toast's 4s auto-dismiss Timer (see Task 8's ruling).
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('switching to the Momenti tab and saving a free-text answer upserts via submitVote', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => [_voteChallenge()]);
    when(() => api.post('/submissions/vote/2', body: any(named: 'body'))).thenAnswer((_) async => {
          'message': 'Salvato!', 'option': 'Il matrimonio', 'points_awarded': 5, 'status': 'created',
        });

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api), authProvider.overrideWith(() => _FakeAuthController()), _fixedClockOverride],
      child: const MaterialApp(home: Stack(children: [QuizScreen(), ToastOverlay()])),
    ));
    await _pumpBounded(tester);

    await tester.tap(find.text('Momenti Migliori'));
    await _pumpBounded(tester);
    await tester.enterText(find.byType(TextField), 'Il matrimonio');
    await tester.tap(find.text('Invia risposta'));
    await _pumpBounded(tester);

    final captured = verify(() => api.post('/submissions/vote/2', body: captureAny(named: 'body'))).captured.single as Map;
    expect(captured['text'], 'Il matrimonio');
    expect(captured['option_id'], 'Il matrimonio');

    // Drain the success toast's 4s auto-dismiss Timer (see Task 8's ruling).
    await tester.pump(const Duration(seconds: 5));
  });
}

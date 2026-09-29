import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/manage/manage_quiz_screen.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  testWidgets('lists existing quiz challenges and supports add/edit/delete/toggle', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/challenges')).thenAnswer((_) async => [
          {
            'id': 1, 'title': 'Dove vi siete conosciuti?', 'description': '', 'points': 30,
            'type': 'quiz', 'active': true, 'correct_answer': 'bar', 'vote_options': null,
          },
        ]);
    when(() => api.post('/challenges', body: any(named: 'body'))).thenAnswer((_) async => {
          'id': 2, 'title': 'Nuova domanda', 'description': 'd', 'points': 10, 'type': 'quiz', 'active': true,
        });
    when(() => api.delete('/challenges/1')).thenAnswer((_) async => {'success': true, 'deleted_id': 1});

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const MaterialApp(home: ManageQuizScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Dove vi siete conosciuti?'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.delete_outline).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Elimina')); // confirmation dialog
    await tester.pumpAndSettle();

    expect(find.text('Dove vi siete conosciuti?'), findsNothing);
  });
}

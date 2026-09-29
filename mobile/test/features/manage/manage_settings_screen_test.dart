import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fantamatrimonio_mobile/core/providers.dart';
import 'package:fantamatrimonio_mobile/core/api_client.dart';
import 'package:fantamatrimonio_mobile/features/manage/manage_settings_screen.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  testWidgets('loads and displays the invite code and current spouse names', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/events/me')).thenAnswer((_) async => {
          'id': 'e1', 'spouse1_name': 'Anna', 'spouse2_name': 'Luca', 'enable_timer': false, 'start_time': null, 'end_time': null,
        });
    when(() => api.get('/events/me/invite')).thenAnswer((_) async => {'invite_code': 'AB12CD'});

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const MaterialApp(home: ManageSettingsScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('AB12CD'), findsOneWidget);
    expect(find.text('Anna'), findsOneWidget);
  });

  testWidgets('a partial save only sends the changed field and preserves the rest', (tester) async {
    final api = _MockApiClient();
    when(() => api.get('/events/me')).thenAnswer((_) async => {
          'id': 'e1', 'spouse1_name': 'Anna', 'spouse2_name': 'Luca', 'enable_timer': false, 'start_time': null, 'end_time': null,
        });
    when(() => api.get('/events/me/invite')).thenAnswer((_) async => {'invite_code': 'AB12CD'});
    when(() => api.patch('/events/me', body: any(named: 'body'))).thenAnswer((_) async => {
          'id': 'e1', 'spouse1_name': 'Annamaria', 'spouse2_name': 'Luca', 'enable_timer': false, 'start_time': null, 'end_time': null,
        });

    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const MaterialApp(home: ManageSettingsScreen()),
    ));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('spouse1_settings_field')), 'Annamaria');
    await tester.tap(find.text('Salva'));
    await tester.pumpAndSettle();

    final captured = verify(() => api.patch('/events/me', body: captureAny(named: 'body'))).captured.single as Map;
    expect(captured.containsKey('spouse2_name'), isFalse);
    expect(captured['spouse1_name'], 'Annamaria');

    // Drain the success toast's 4s auto-dismiss Timer (see Task 8's ruling).
    await tester.pump(const Duration(seconds: 5));
  });
}

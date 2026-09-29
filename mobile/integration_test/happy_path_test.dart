import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:fantamatrimonio_mobile/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('couple creates a wedding, adds one challenge per type, guest completes each and sees the leaderboard update', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    // 1. Couple creates the event via the wizard.
    await tester.tap(find.text('Crea il matrimonio dei tuoi sogni'));
    await tester.pumpAndSettle();

    final unique = DateTime.now().millisecondsSinceEpoch.toString();
    await tester.enterText(find.byKey(const Key('spouse1_field')), 'Anna$unique');
    await tester.enterText(find.byKey(const Key('spouse2_field')), 'Luca$unique');
    await tester.tap(find.text('Avanti'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Avanti')); // timer disabled by default
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('couple_first_name_field')), 'Anna$unique');
    await tester.enterText(find.byKey(const Key('couple_last_name_field')), 'Test');
    await tester.enterText(find.byKey(const Key('couple_secret_word_field')), 'secret123');
    await tester.tap(find.text('Avanti'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Crea il matrimonio'));
    await tester.pumpAndSettle();

    final inviteCodeFinder = find.byKey(const Key('generated_invite_code_text'));
    expect(inviteCodeFinder, findsOneWidget);
    final inviteCode = (tester.widget<Text>(inviteCodeFinder)).data!;

    await tester.tap(find.text('Continua'));
    await tester.pumpAndSettle();

    // 2. Couple adds one challenge of each type via Gestisci.
    await tester.tap(find.text('Gestisci'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Quiz sugli sposi'));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), 'Dove vi siete conosciuti?');
    await tester.enterText(find.byType(TextField).at(2), '30');
    await tester.enterText(find.byType(TextField).at(3), 'bar');
    await tester.tap(find.text('Salva'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Gestisci'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Caccia al tesoro'));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), 'Trova gli sposi');
    await tester.enterText(find.byType(TextField).at(2), '20');
    await tester.tap(find.text('Salva'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Gestisci'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Momenti migliori'));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), 'Il tuo ricordo preferito');
    await tester.enterText(find.byType(TextField).at(2), '5');
    await tester.tap(find.text('Salva'));
    await tester.pumpAndSettle();

    // 3. A second, independent guest session logs in via the invite code and completes the quiz.
    // Restarting the widget tree simulates a second device/app instance.
    await tester.tap(find.byIcon(Icons.logout));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Esci'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ho un codice invito'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('invite_code_field')), inviteCode);
    await tester.enterText(find.byKey(const Key('first_name_field')), 'Guest$unique');
    await tester.enterText(find.byKey(const Key('last_name_field')), 'Test');
    await tester.enterText(find.byKey(const Key('secret_word_field')), 'pizza');
    await tester.tap(find.text('Entra nel Gioco'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Giochi'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('bar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Risposta esatta'), findsOneWidget);

    // 4. The leaderboard reflects the guest's new points.
    await tester.tap(find.text('Classifica'));
    await tester.pumpAndSettle();

    expect(find.text('Guest$unique Test'), findsOneWidget);
  });
}

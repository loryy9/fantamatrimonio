import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fantamatrimonio_mobile/features/shell/toast_controller.dart';
import 'package:fantamatrimonio_mobile/features/shell/toast_overlay.dart';

void main() {
  testWidgets('renders each queued toast with its text and dismiss control', (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(toastProvider.notifier).show('Missione completata!', type: 'success', points: 25);

    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: Stack(children: [ToastOverlay()]))),
    ));
    // Let the toast card's slide/fade-in animation finish before interacting.
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Missione completata!'), findsOneWidget);
    expect(find.text('+25 PT'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pump();
    expect(container.read(toastProvider), isEmpty);

    // dismiss() only filters state — it doesn't cancel show()'s own 4s
    // auto-dismiss Timer, which flutter_test runs on a fake clock local to
    // this test. Drain it (a no-op dismiss on an already-removed id) so it
    // isn't still pending when flutter_test asserts on teardown.
    await tester.pump(const Duration(seconds: 5));
  });
}

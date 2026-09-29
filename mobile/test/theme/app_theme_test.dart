import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fantamatrimonio_mobile/theme/app_theme.dart';

// google_fonts resolves fonts over HTTP, which flutter_test always blocks;
// pass a no-op textTheme builder so these tests exercise AppTheme's tokens
// without triggering that network-backed (and here, doomed) font lookup.
TextTheme _noopTextTheme(TextTheme base) => base;

void main() {
  test('light theme uses the gold primary and rose secondary tokens', () {
    final theme = AppTheme.light(textTheme: _noopTextTheme);

    expect(theme.colorScheme.primary, const Color(0xFFC9A96E));
    expect(theme.colorScheme.secondary, const Color(0xFFD4849A));
    expect(theme.scaffoldBackgroundColor, const Color(0xFFFAF8F5));
    expect(theme.useMaterial3, isTrue);
  });

  testWidgets('MaterialApp renders with the app theme applied', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light(textTheme: _noopTextTheme),
      home: const Scaffold(body: Text('ok')),
    ));

    final materialApp = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(materialApp.theme!.colorScheme.primary, const Color(0xFFC9A96E));
  });
}

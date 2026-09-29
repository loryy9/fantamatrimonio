import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fantamatrimonio_mobile/features/shell/toast_controller.dart';

void main() {
  test('show() appends a toast with the given text/type/points', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.read(toastProvider.notifier).show('Ciao!', type: 'success', points: 10);

    final toasts = container.read(toastProvider);
    expect(toasts, hasLength(1));
    expect(toasts.first.text, 'Ciao!');
    expect(toasts.first.points, 10);
  });

  test('dismiss() removes the toast with the matching id', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.read(toastProvider.notifier).show('A');
    final id = container.read(toastProvider).first.id;

    container.read(toastProvider.notifier).dismiss(id);

    expect(container.read(toastProvider), isEmpty);
  });

  test('show() auto-dismisses after 4 seconds', () {
    fakeAsync((async) {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(toastProvider.notifier).show('A');
      expect(container.read(toastProvider), hasLength(1));

      async.elapse(const Duration(seconds: 4, milliseconds: 100));

      expect(container.read(toastProvider), isEmpty);
    });
  });
}

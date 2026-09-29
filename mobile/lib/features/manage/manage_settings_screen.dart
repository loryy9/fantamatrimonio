import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers.dart';
import '../shell/app_bar_chrome.dart';
import '../shell/toast_controller.dart';

class ManageSettingsScreen extends ConsumerStatefulWidget {
  const ManageSettingsScreen({super.key});

  @override
  ConsumerState<ManageSettingsScreen> createState() => _ManageSettingsScreenState();
}

class _ManageSettingsScreenState extends ConsumerState<ManageSettingsScreen> {
  final _spouse1Ctrl = TextEditingController();
  final _spouse2Ctrl = TextEditingController();
  String? _inviteCode;
  bool _loading = true;
  final Set<String> _dirty = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = ref.read(apiClientProvider);
    final event = await api.get('/events/me') as Map<String, dynamic>;
    final invite = await api.get('/events/me/invite') as Map<String, dynamic>;
    setState(() {
      _spouse1Ctrl.text = event['spouse1_name'] as String;
      _spouse2Ctrl.text = event['spouse2_name'] as String;
      _inviteCode = invite['invite_code'] as String;
      _loading = false;
    });
  }

  Future<void> _save() async {
    final body = <String, dynamic>{};
    if (_dirty.contains('spouse1')) body['spouse1_name'] = _spouse1Ctrl.text.trim();
    if (_dirty.contains('spouse2')) body['spouse2_name'] = _spouse2Ctrl.text.trim();
    if (body.isEmpty) return;

    final api = ref.read(apiClientProvider);
    try {
      await api.patch('/events/me', body: body);
      _dirty.clear();
      ref.read(toastProvider.notifier).show('Impostazioni salvate.', type: 'success');
    } catch (e) {
      ref.read(toastProvider.notifier).show(e.toString(), type: 'error');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      appBar: const GameAppBar(),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Codice invito'),
            Text(_inviteCode ?? '', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 16),
            TextField(
              key: const Key('spouse1_settings_field'),
              controller: _spouse1Ctrl,
              decoration: const InputDecoration(labelText: 'Sposo/a 1'),
              onChanged: (_) => _dirty.add('spouse1'),
            ),
            TextField(
              key: const Key('spouse2_settings_field'),
              controller: _spouse2Ctrl,
              decoration: const InputDecoration(labelText: 'Sposo/a 2'),
              onChanged: (_) => _dirty.add('spouse2'),
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _save, child: const Text('Salva')),
          ],
        ),
      ),
    );
  }
}

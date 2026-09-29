import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_exception.dart';
import '../../core/providers.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';
import 'auth_controller.dart';

String _formatName(String s) {
  final trimmed = s.trim();
  if (trimmed.isEmpty) return trimmed;
  return trimmed
      .split(RegExp(r'\s+'))
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
      .join(' ');
}

class LoginFormScreen extends ConsumerStatefulWidget {
  const LoginFormScreen({super.key});

  @override
  ConsumerState<LoginFormScreen> createState() => _LoginFormScreenState();
}

class _LoginFormScreenState extends ConsumerState<LoginFormScreen> {
  final _inviteCodeCtrl = TextEditingController();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _secretWordCtrl = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  Future<void> _submit() async {
    if (_inviteCodeCtrl.text.trim().isEmpty ||
        _firstNameCtrl.text.trim().isEmpty ||
        _lastNameCtrl.text.trim().isEmpty ||
        _secretWordCtrl.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Per favore compila tutti i campi!');
      return;
    }

    setState(() {
      _errorMessage = null;
      _isSubmitting = true;
    });

    try {
      final isNew = await ref.read(authProvider.notifier).login(
            inviteCode: _inviteCodeCtrl.text,
            firstName: _formatName(_firstNameCtrl.text),
            lastName: _formatName(_lastNameCtrl.text),
            secretWord: _secretWordCtrl.text.trim(),
          );

      final session = ref.read(authProvider).value!;
      final storage = ref.read(secureStorageProvider);
      final firstTimeOnDevice = isNew || !(await storage.hasSeenWelcome(session.user.id));
      await storage.markSeenWelcome(session.user.id);

      if (mounted) {
        final displayName = _formatName(session.user.firstName);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(firstTimeOnDevice ? 'Benvenuto/a $displayName!' : 'Bentornato/a $displayName!'),
        ));
      }
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.nightInkDeep,
      resizeToAvoidBottomInset: false,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.canPop() ? context.pop() : context.go(RoutePaths.entry),
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: AppGradients.dusk),
        child: Stack(
          children: [
            Positioned(
              top: -70,
              left: -60,
              child: IgnorePointer(
                child: Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppGradients.candleGlow(AppColors.goldBright, opacity: 0.28),
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -90,
              right: -70,
              child: IgnorePointer(
                child: Container(
                  width: 260,
                  height: 260,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppGradients.candleGlow(AppColors.roseNeon, opacity: 0.24),
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
                      child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'BENTORNATO/A',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.goldBright),
                    ),
                    const SizedBox(height: 8),
                    ShaderMask(
                      shaderCallback: (bounds) => AppGradients.goldRose.createShader(bounds),
                      child: Text(
                        'Entra nel\nMatrimonio',
                        style: Theme.of(context).textTheme.headlineLarge?.copyWith(color: Colors.white, fontSize: 40),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Inserisci il codice invito e le tue credenziali\nper unirti alla festa.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.white.withOpacity(0.68),
                            height: 1.4,
                          ),
                    ),
                    const SizedBox(height: 32),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: _errorMessage == null
                          ? const SizedBox.shrink()
                          : Padding(
                              key: const Key('login_error_banner'),
                              padding: const EdgeInsets.only(bottom: 16),
                              child: GlassSurface(
                                dark: true,
                                tintColor: AppColors.roseNeon,
                                borderRadius: BorderRadius.circular(16),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                child: Row(
                                  children: [
                                    const Icon(Icons.error_outline_rounded, color: AppColors.roseNeon, size: 20),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        _errorMessage!,
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                    ),
                    GlassTextField(
                      fieldKey: const Key('invite_code_field'),
                      controller: _inviteCodeCtrl,
                      label: 'Codice invito',
                      textCapitalization: TextCapitalization.characters,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    GlassTextField(
                      fieldKey: const Key('first_name_field'),
                      controller: _firstNameCtrl,
                      label: 'Nome',
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    GlassTextField(
                      fieldKey: const Key('last_name_field'),
                      controller: _lastNameCtrl,
                      label: 'Cognome',
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    GlassTextField(
                      fieldKey: const Key('secret_word_field'),
                      controller: _secretWordCtrl,
                      label: 'Parola Personale',
                      textInputAction: TextInputAction.done,
                    ),
                  ],
                      ),
                    ),
                  ),
                  GlassBottomBar(
                    child: GradientElevatedButton(
                      onPressed: _isSubmitting ? null : _submit,
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text('Entra nel Gioco'),
                                SizedBox(width: 8),
                                Icon(Icons.arrow_forward_rounded, size: 18),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

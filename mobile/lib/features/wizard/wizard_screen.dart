import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../auth/auth_controller.dart';
import '../auth/models.dart';
import '../../core/providers.dart';
import '../../router/app_router.dart';
import '../../theme/app_theme.dart';

class WizardScreen extends ConsumerStatefulWidget {
  const WizardScreen({super.key});

  @override
  ConsumerState<WizardScreen> createState() => _WizardScreenState();
}

class _WizardScreenState extends ConsumerState<WizardScreen> {
  final _pageController = PageController();
  int _step = 0;
  String? _stepError;

  final _spouse1Ctrl = TextEditingController();
  final _spouse2Ctrl = TextEditingController();
  bool _enableTimer = false;
  DateTime _startTime = DateTime.now();
  DateTime _endTime = DateTime.now();
  final _coupleFirstNameCtrl = TextEditingController();
  final _coupleLastNameCtrl = TextEditingController();
  final _coupleSecretWordCtrl = TextEditingController();
  String? _inviteCode;

  static const _stepTitles = ['I vostri nomi', 'Le tempistiche', 'Il vostro accesso', 'Riepilogo'];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goNext() {
    setState(() => _stepError = null);

    if (_step == 0) {
      if (_spouse1Ctrl.text.trim().isEmpty ||
          _spouse2Ctrl.text.trim().isEmpty) {
        setState(() => _stepError = 'Inserisci entrambi i nomi.');
        return;
      }
      _coupleFirstNameCtrl.text = _spouse1Ctrl.text.trim();
    }

    if (_step == 1 && _enableTimer && !_endTime.isAfter(_startTime)) {
      setState(
        () => _stepError =
            "L'orario di fine deve essere successivo a quello di inizio.",
      );
      return;
    }

    if (_step == 2 &&
        (_coupleFirstNameCtrl.text.trim().isEmpty ||
            _coupleLastNameCtrl.text.trim().isEmpty ||
            _coupleSecretWordCtrl.text.trim().isEmpty)) {
      setState(() => _stepError = 'Compila tutti i campi di accesso.');
      return;
    }

    setState(() => _step++);
    _pageController.animateToPage(
      _step,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  void _goBack() {
    if (_step == 0) return;
    setState(() {
      _stepError = null;
      _step--;
    });
    _pageController.animateToPage(
      _step,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _createEvent() async {
    final api = ref.read(apiClientProvider);
    final res =
        await api.post(
              '/events',
              body: {
                'spouse1_name': _spouse1Ctrl.text.trim(),
                'spouse2_name': _spouse2Ctrl.text.trim(),
                'enable_timer': _enableTimer,
                'start_time': _enableTimer
                    ? _startTime.toIso8601String()
                    : null,
                'end_time': _enableTimer ? _endTime.toIso8601String() : null,
                'couple_first_name': _coupleFirstNameCtrl.text.trim(),
                'couple_last_name': _coupleLastNameCtrl.text.trim(),
                'couple_secret_word': _coupleSecretWordCtrl.text.trim(),
              },
            )
            as Map<String, dynamic>;

    await ref
        .read(authProvider.notifier)
        .applySession(
          res['token'] as String,
          AppUser.fromJson(res['user'] as Map<String, dynamic>),
          AppEvent.fromJson(res['event'] as Map<String, dynamic>),
        );

    setState(() {
      _inviteCode = res['invite_code'] as String;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.nightInkDeep,
      resizeToAvoidBottomInset: false,
      extendBodyBehindAppBar: true,
      appBar: _inviteCode != null
          ? null
          : AppBar(
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
              top: -90,
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
            Positioned(
              bottom: -100,
              left: -80,
              child: IgnorePointer(
                child: Container(
                  width: 280,
                  height: 280,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppGradients.candleGlow(AppColors.goldBright, opacity: 0.26),
                  ),
                ),
              ),
            ),
            if (_inviteCode != null) _buildInviteReveal(context) else _buildWizard(context),
          ],
        ),
      ),
    );
  }

  Widget _buildWizard(BuildContext context) {
    final steps = [
      _buildNamesStep(),
      _buildTimingStep(),
      _buildAccessStep(),
      _buildSummaryStep(),
    ];

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 4),
            child: Row(
              children: List.generate(steps.length, (i) => _buildStepDot(i)),
            ),
          ),
          if (_stepError != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
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
                        _stepError!,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: steps,
            ),
          ),
          _buildBottomBar(),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    final isLastStep = _step == 3;
    return GlassBottomBar(
      child: Row(
        children: [
          if (_step > 0) ...[
            _GlassIconButton(icon: Icons.arrow_back_ios_new_rounded, onTap: _goBack),
            const SizedBox(width: 14),
          ],
          Expanded(
            child: GradientElevatedButton(
              onPressed: isLastStep ? _createEvent : _goNext,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(isLastStep ? 'Crea il matrimonio' : 'Avanti'),
                  const SizedBox(width: 8),
                  Icon(isLastStep ? Icons.favorite_rounded : Icons.arrow_forward_rounded, size: 18),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepDot(int i) {
    final active = i <= _step;
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          height: 5,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            gradient: active ? AppGradients.goldRose : null,
            color: active ? null : Colors.white.withOpacity(0.14),
          ),
        ),
      ),
    );
  }

  Widget _stepHeader(String label, String title) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppColors.goldBright, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 11)),
          const SizedBox(height: 6),
          ShaderMask(
            shaderCallback: (bounds) => AppGradients.goldRose.createShader(bounds),
            child: Text(
              title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 28, fontFamily: 'CormorantGaramond'),
            ),
          ),
          const SizedBox(height: 24),
        ],
      );

  Widget _buildNamesStep() => SingleChildScrollView(
    padding: const EdgeInsets.all(24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepHeader('PASSO 1 DI 4', _stepTitles[0]),
        GlassTextField(
          fieldKey: const Key('spouse1_field'),
          controller: _spouse1Ctrl,
          label: 'Sposo/a 1',
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 14),
        GlassTextField(
          fieldKey: const Key('spouse2_field'),
          controller: _spouse2Ctrl,
          label: 'Sposo/a 2',
          textCapitalization: TextCapitalization.words,
        ),
      ],
    ),
  );

  Widget _buildTimingStep() => SingleChildScrollView(
    padding: const EdgeInsets.all(24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepHeader('PASSO 2 DI 4', _stepTitles[1]),
        GlassSurface(
          dark: true,
          borderRadius: BorderRadius.circular(18),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: SwitchListTile(
            key: const Key('enable_timer_switch'),
            title: const Text('Attiva orari di gioco', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            subtitle: Text(
              'Limita la caccia al tesoro a una finestra oraria',
              style: TextStyle(color: Colors.white.withOpacity(0.55), fontSize: 12.5),
            ),
            value: _enableTimer,
            activeThumbColor: AppColors.goldBright,
            activeTrackColor: AppColors.rosePrimary,
            onChanged: (v) => setState(() => _enableTimer = v),
          ),
        ),
      ],
    ),
  );

  Widget _buildAccessStep() => SingleChildScrollView(
    padding: const EdgeInsets.all(24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepHeader('PASSO 3 DI 4', _stepTitles[2]),
        GlassTextField(
          fieldKey: const Key('couple_first_name_field'),
          controller: _coupleFirstNameCtrl,
          label: 'Nome',
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 14),
        GlassTextField(
          fieldKey: const Key('couple_last_name_field'),
          controller: _coupleLastNameCtrl,
          label: 'Cognome',
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 14),
        GlassTextField(
          fieldKey: const Key('couple_secret_word_field'),
          controller: _coupleSecretWordCtrl,
          label: 'Parola segreta',
        ),
      ],
    ),
  );

  Widget _buildSummaryStep() => SingleChildScrollView(
    padding: const EdgeInsets.all(24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepHeader('PASSO 4 DI 4', _stepTitles[3]),
        GlassSurface(
          dark: true,
          borderRadius: BorderRadius.circular(18),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${_spouse1Ctrl.text} & ${_spouse2Ctrl.text}',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 20),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(_enableTimer ? Icons.timer_rounded : Icons.all_inclusive_rounded, color: AppColors.goldBright, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    _enableTimer ? 'Orari di gioco attivi' : 'Nessun orario impostato',
                    style: TextStyle(color: Colors.white.withOpacity(0.75)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _buildInviteReveal(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 650),
            curve: Curves.elasticOut,
            builder: (context, t, child) => Transform.scale(
              scale: 0.6 + (0.4 * t).clamp(0.0, 1.0),
              child: Opacity(opacity: t.clamp(0.0, 1.0), child: child),
            ),
            child: GlassSurface(
              dark: true,
              borderRadius: BorderRadius.circular(28),
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                    const Icon(Icons.favorite_rounded, color: AppColors.roseNeon, size: 36),
                    const SizedBox(height: 14),
                    Text(
                      'IL VOSTRO MATRIMONIO È PRONTO',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.goldBright, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 11),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Il tuo codice invito',
                      style: TextStyle(color: Colors.white.withOpacity(0.7)),
                    ),
                    const SizedBox(height: 14),
                    ShaderMask(
                      shaderCallback: (bounds) => AppGradients.goldRose.createShader(bounds),
                      child: Text(
                        _inviteCode!,
                        key: const Key('generated_invite_code_text'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 40,
                          letterSpacing: 6,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    GradientElevatedButton(
                      onPressed: () => Share.share(
                        'Unisciti al nostro matrimonio! Codice invito: $_inviteCode',
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.ios_share_rounded, size: 18, color: Colors.white),
                          SizedBox(width: 8),
                          Text('Condividi'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => context.go(RoutePaths.home),
                      child: Text(
                        'Continua',
                        style: TextStyle(color: Colors.white.withOpacity(0.75), fontWeight: FontWeight.w600),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A small frosted-glass circular icon button, used for the wizard's "back"
/// control next to the primary gradient CTA.
class _GlassIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _GlassIconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GlassSurface(
      dark: true,
      borderRadius: BorderRadius.circular(16),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          child: SizedBox(
            width: 54,
            height: 54,
            child: Icon(icon, color: Colors.white.withOpacity(0.85), size: 18),
          ),
        ),
      ),
    );
  }
}

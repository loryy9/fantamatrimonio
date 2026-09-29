import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Palette: warm ivory paper by day, deep candlelit ink for hero moments.
/// Gold + rose stay the through-line so every screen still reads as the
/// same wedding, but depth and accent come from the near-black + blush-neon
/// pairing instead of flat white cards everywhere.
class AppColors {
  static const goldPrimary = Color(0xFFC9A96E);
  static const goldDark = Color(0xFF8A6D3B);
  static const goldBright = Color(0xFFF0D8A8);
  static const rosePrimary = Color(0xFFD4849A);
  static const roseLight = Color(0xFFE8A0B4);
  static const roseNeon = Color(0xFFFF6F9C);
  static const background = Color(0xFFFAF8F5);
  static const paper = Color(0xFFFFFDFB);
  static const ink = Color(0xFF3A3330);
  static const inkMuted = Color(0xFF8A7E76);

  // Candlelit depth layer, used for hero headers / app bars / sheets.
  static const nightInk = Color(0xFF1C1712);
  static const nightInkDeep = Color(0xFF120E0B);
  static const nightHairline = Color(0x33F0D8A8);
}

class AppGradients {
  static const dusk = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.nightInkDeep, AppColors.nightInk, Color(0xFF2A1D1A)],
  );

  static const goldRose = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.goldPrimary, AppColors.rosePrimary],
  );

  static const roseNeonGlow = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.roseNeon, AppColors.rosePrimary],
  );

  static RadialGradient candleGlow(Color color, {double opacity = 0.35}) => RadialGradient(
        colors: [color.withOpacity(opacity), color.withOpacity(0)],
      );
}

/// Frosted-glass surface in the Cupertino sense: BackdropFilter blur +
/// a translucent tint + a hairline border that catches the light.
/// Use `dark: true` over [AppGradients.dusk] hero areas, otherwise the
/// light ivory tint reads better over [AppColors.background].
class GlassSurface extends StatelessWidget {
  final Widget child;
  final BorderRadius borderRadius;
  final bool dark;
  final double blur;
  final EdgeInsetsGeometry? padding;
  final Color? tintColor;

  const GlassSurface({
    super.key,
    required this.child,
    this.borderRadius = const BorderRadius.all(Radius.circular(24)),
    this.dark = false,
    this.blur = 18,
    this.padding,
    this.tintColor,
  });

  @override
  Widget build(BuildContext context) {
    final tint = tintColor?.withOpacity(dark ? 0.16 : 0.5) ??
        (dark ? Colors.white.withOpacity(0.08) : Colors.white.withOpacity(0.55));
    final border = tintColor?.withOpacity(0.4) ?? (dark ? AppColors.nightHairline : Colors.white.withOpacity(0.6));

    return ClipRRect(
      borderRadius: borderRadius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: tint,
            borderRadius: borderRadius,
            border: Border.all(color: border, width: 1),
            boxShadow: dark
                ? null
                : [
                    BoxShadow(
                      color: AppColors.goldDark.withOpacity(0.10),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ],
          ),
          child: child,
        ),
      ),
    );
  }
}

/// A frosted-glass text input matching [GlassSurface]'s Cupertino styling.
/// Used on the candlelit onboarding flows (login, wizard) instead of the
/// default Material [TextField] look.
class GlassTextField extends StatelessWidget {
  final Key? fieldKey;
  final TextEditingController controller;
  final String label;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final bool obscureText;
  final bool dark;

  const GlassTextField({
    super.key,
    this.fieldKey,
    required this.controller,
    required this.label,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.obscureText = false,
    this.dark = true,
  });

  @override
  Widget build(BuildContext context) {
    final labelColor = dark ? Colors.white.withOpacity(0.55) : AppColors.inkMuted;
    final textColor = dark ? Colors.white : AppColors.ink;

    return GlassSurface(
      dark: dark,
      borderRadius: BorderRadius.circular(18),
      child: TextField(
        key: fieldKey,
        controller: controller,
        textInputAction: textInputAction,
        textCapitalization: textCapitalization,
        obscureText: obscureText,
        style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15.5),
        cursorColor: AppColors.goldBright,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: labelColor, fontWeight: FontWeight.w600),
          floatingLabelStyle: const TextStyle(color: AppColors.goldBright, fontWeight: FontWeight.w700),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        ),
      ),
    );
  }
}

/// A gradient-filled [ElevatedButton] with a light haptic tap and a soft
/// candle-glow shadow. The underlying widget stays a genuine [ElevatedButton]
/// so it remains discoverable via `find.widgetWithText(ElevatedButton, ...)`.
class GradientElevatedButton extends StatelessWidget {
  final Widget child;
  final VoidCallback? onPressed;

  const GradientElevatedButton({super.key, required this.child, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        gradient: enabled ? AppGradients.goldRose : null,
        color: enabled ? null : AppColors.inkMuted.withOpacity(0.3),
        borderRadius: BorderRadius.circular(20),
        boxShadow: enabled
            ? [BoxShadow(color: AppColors.rosePrimary.withOpacity(0.4), blurRadius: 22, offset: const Offset(0, 10))]
            : null,
      ),
      child: ElevatedButton(
        onPressed: enabled
            ? () {
                HapticFeedback.lightImpact();
                onPressed!();
              }
            : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          disabledBackgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        ),
        child: DefaultTextStyle.merge(
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
          child: child,
        ),
      ),
    );
  }
}

/// The fixed action bar pinned under a candlelit onboarding form (login,
/// wizard). Same hairline-topped strip on every screen that uses it, so the
/// primary CTA always sits in the same place regardless of which screen
/// hosts it. Always stays put even when the keyboard opens — pair with
/// `Scaffold(resizeToAvoidBottomInset: false)`.
class GlassBottomBar extends StatelessWidget {
  final Widget child;

  const GlassBottomBar({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      decoration: BoxDecoration(
        border: const Border(top: BorderSide(color: AppColors.nightHairline)),
        color: Colors.white.withOpacity(0.02),
      ),
      child: SafeArea(top: false, child: child),
    );
  }
}

/// A fade + gentle rise transition for the candlelit onboarding flow
/// (entry -> login / wizard). The default platform transition (Android's
/// zoom-fade) briefly reveals the Scaffold's own background between the two
/// pages, which flashes white against our dark gradient; this transition
/// only ever cross-fades the two (identically dark) screens, so nothing
/// flashes and the page settles back on its own background color.
Widget glassPageTransitionBuilder(
  BuildContext context,
  Animation<double> animation,
  Animation<double> secondaryAnimation,
  Widget child,
) {
  final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
  return FadeTransition(
    opacity: curved,
    child: SlideTransition(
      position: Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero).animate(curved),
      child: child,
    ),
  );
}

const glassPageTransitionDuration = Duration(milliseconds: 380);

class AppTheme {
  // `textTheme` lets tests substitute a plain TextTheme so they don't have to
  // exercise google_fonts' network-backed font resolution, which flutter_test
  // always blocks (HTTP 400 for every request) and which google_fonts reports
  // as a background failure that outlives the test that triggered it.
  // Production code never passes this — it always gets the real Google Fonts
  // theme below.
  static ThemeData light({TextTheme Function(TextTheme base)? textTheme}) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.goldPrimary,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.goldPrimary,
      secondary: AppColors.rosePrimary,
      surface: AppColors.paper,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      splashFactory: InkSparkle.splashFactory,
    );

    final buildTextTheme = textTheme ?? _googleFontsTextTheme;

    return base.copyWith(
      textTheme: buildTextTheme(base.textTheme),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.ink,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white.withOpacity(0.92),
        indicatorColor: AppColors.goldPrimary.withOpacity(0.18),
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: AppColors.paper,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: BorderSide(color: AppColors.goldPrimary.withOpacity(0.12)),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.goldPrimary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 22),
          textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, letterSpacing: 0.2),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          side: BorderSide(color: AppColors.goldPrimary.withOpacity(0.5), width: 1.2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 22),
          textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }

  static TextTheme _googleFontsTextTheme(TextTheme base) {
    return GoogleFonts.plusJakartaSansTextTheme(base).copyWith(
      displayLarge: GoogleFonts.cormorantGaramond(
        fontSize: 52,
        height: 1.02,
        fontWeight: FontWeight.w600,
        color: AppColors.ink,
        letterSpacing: -0.5,
      ),
      headlineLarge: GoogleFonts.cormorantGaramond(
        fontSize: 34,
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
      ),
      headlineMedium: GoogleFonts.cormorantGaramond(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        color: AppColors.ink,
      ),
      labelSmall: GoogleFonts.plusJakartaSans(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.4,
        color: AppColors.inkMuted,
      ),
    );
  }
}

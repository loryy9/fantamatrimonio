import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class GlassNavDestination {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const GlassNavDestination({required this.icon, required this.activeIcon, required this.label});
}

/// Floating frosted-glass pill tab bar — the Cupertino "floating dock" pattern
/// instead of a flat Material bottom bar glued to the screen edge.
class GlassNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onSelect;
  final List<GlassNavDestination> destinations;

  const GlassNavBar({
    super.key,
    required this.currentIndex,
    required this.onSelect,
    required this.destinations,
  });

  // Keeps the unselected tabs at a comfortable minimum tap target even when
  // the selected label is long (e.g. "Classifica").
  static const double _minOtherWidth = 46;
  static const _labelStyle = TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700);

  double _measureLabelWidth(String label) {
    final painter = TextPainter(
      text: TextSpan(text: label, style: _labelStyle),
      textDirection: TextDirection.ltr,
    )..layout();
    return painter.width;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: GlassSurface(
        borderRadius: BorderRadius.circular(28),
        blur: 22,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final n = destinations.length;
            final totalWidth = constraints.maxWidth;
            // currentIndex may point outside this bar's own destinations
            // (e.g. a shell branch that was moved elsewhere, like Gestisci) —
            // in that case nothing here is "selected".
            final selectedIndex = currentIndex >= 0 && currentIndex < n ? currentIndex : -1;
            // icon(21) + gap(7) + label + horizontal padding(14*2) + a small buffer.
            final labelWidth = selectedIndex == -1 ? 0.0 : _measureLabelWidth(destinations[selectedIndex].label);
            final baseWidth = totalWidth / n;
            final wantedSelectedWidth = selectedIndex == -1 ? baseWidth : 21 + 7 + labelWidth + 28 + 6;
            final maxSelectedWidth = totalWidth - _minOtherWidth * (n - 1);
            final selectedWidth = wantedSelectedWidth.clamp(baseWidth, maxSelectedWidth);
            final shrunkWidth = (totalWidth - selectedWidth) / (n - 1);
            return Row(
              children: [
                for (var i = 0; i < n; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 320),
                    curve: Curves.easeOutCubic,
                    width: i == selectedIndex ? selectedWidth : shrunkWidth,
                    child: _NavItem(
                      destination: destinations[i],
                      selected: i == selectedIndex,
                      onTap: () => onSelect(i),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final GlassNavDestination destination;
  final bool selected;
  final VoidCallback onTap;

  const _NavItem({required this.destination, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Stack(
          children: [
            // The pill background fades in/out as a plain opacity tween —
            // kept separate from the gradient/shadow so the shadow never
            // gets stuck mid-interpolation on the tab that was just left.
            Positioned.fill(
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 320),
                curve: Curves.easeOutCubic,
                opacity: selected ? 1 : 0,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: AppGradients.goldRose,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(color: AppColors.rosePrimary.withOpacity(0.35), blurRadius: 14, offset: const Offset(0, 6)),
                    ],
                  ),
                ),
              ),
            ),
            AnimatedPadding(
              duration: const Duration(milliseconds: 320),
              curve: Curves.easeOutCubic,
              padding: EdgeInsets.symmetric(vertical: 10, horizontal: selected ? 14 : 6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    selected ? destination.activeIcon : destination.icon,
                    size: 21,
                    color: selected ? Colors.white : AppColors.inkMuted,
                  ),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 320),
                    curve: Curves.easeOutCubic,
                    child: selected
                        ? Padding(
                            padding: const EdgeInsets.only(left: 7),
                            child: Text(
                              destination.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w700),
                            ),
                          )
                        : const SizedBox(width: 0, height: 0),
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

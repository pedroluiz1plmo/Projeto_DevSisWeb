import 'package:flutter/material.dart';

class AttributeStatCard extends StatefulWidget {
  const AttributeStatCard({
    super.key,
    required this.label,
    required this.controller,
  });

  final String label;
  final TextEditingController controller;

  @override
  State<AttributeStatCard> createState() => _AttributeStatCardState();
}

class _AttributeStatCardState extends State<AttributeStatCard> {
  late int _score;

  @override
  void initState() {
    super.initState();
    _score = int.tryParse(widget.controller.text) ?? 10;
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onTextChanged() {
    final parsed = int.tryParse(widget.controller.text);
    if (parsed != null && parsed != _score) {
      setState(() => _score = parsed);
    }
  }

  void _adjust(int delta) {
    final next = (_score + delta).clamp(1, 30);
    if (next != _score) {
      widget.controller.text = '$next';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final modifier = ((_score - 10) / 2).floor();
    final modifierLabel = modifier >= 0 ? '+$modifier' : '$modifier';

    return Container(
      width: 78,
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 10),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: theme.colorScheme.primary.withValues(alpha: 0.35),
          width: 1.1,
        ),
      ),
      child: Column(
        children: [
          Text(
            widget.label,
            style: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: 36,
            child: TextFormField(
              controller: widget.controller,
              textAlign: TextAlign.center,
              keyboardType: TextInputType.number,
              textAlignVertical: TextAlignVertical.center,
              decoration: const InputDecoration.collapsed(
                hintText: '',
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) return null;
                final parsed = int.tryParse(value.trim());
                if (parsed == null || parsed < 1 || parsed > 30) {
                  return '!';
                }
                return null;
              },
            ),
          ),
          const SizedBox(height: 2),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              GestureDetector(
                onTap: () => _adjust(-1),
                child: const SizedBox(
                  width: 16,
                  height: 16,
                  child: Icon(Icons.remove_circle_outline, size: 12),
                ),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () => _adjust(1),
                child: const SizedBox(
                  width: 16,
                  height: 16,
                  child: Icon(Icons.add_circle_outline, size: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'MOD $modifierLabel',
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

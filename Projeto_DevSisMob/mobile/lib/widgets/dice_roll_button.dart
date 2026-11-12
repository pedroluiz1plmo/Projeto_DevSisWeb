import 'package:flutter/material.dart';

import '../models/models.dart';
import 'dice_roll_dialog.dart';

class DiceRollButton extends StatelessWidget {
  const DiceRollButton({super.key, required this.character});

  final RpgCharacter character;

  @override
  Widget build(BuildContext context) => FloatingActionButton.small(
        heroTag: null,
        tooltip: 'Rolar dados',
        child: const Icon(Icons.casino_outlined),
        onPressed: () => showDialog<void>(
          context: context,
          builder: (_) => DiceRollDialog(character: character),
        ),
      );
}

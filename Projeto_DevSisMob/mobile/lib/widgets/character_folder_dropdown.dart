import 'package:flutter/material.dart';

import '../models/models.dart';

class CharacterFolderDropdown extends StatelessWidget {
  const CharacterFolderDropdown({
    super.key,
    required this.folders,
    required this.value,
    required this.onChanged,
  });

  final List<RpgFolder> folders;
  final String? value;
  final ValueChanged<String?> onChanged;

  String _folderLabel(RpgFolder folder) {
    final byId = {for (final item in folders) item.id: item};
    final names = <String>[folder.name];
    var parentId = folder.parentId;
    final visited = <String>{folder.id};
    while (parentId != null && visited.add(parentId)) {
      final parent = byId[parentId];
      if (parent == null) break;
      names.insert(0, parent.name);
      parentId = parent.parentId;
    }
    return names.join(' / ');
  }

  @override
  Widget build(BuildContext context) {
    final selectedValue =
        folders.any((folder) => folder.id == value) ? value : null;
    return DropdownButtonFormField<String?>(
      value: selectedValue,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Pasta (opcional)'),
      items: [
        const DropdownMenuItem<String?>(
          value: null,
          child: Text('Sem pasta'),
        ),
        ...folders.map(
          (folder) => DropdownMenuItem<String?>(
            value: folder.id,
            child: Text(_folderLabel(folder), overflow: TextOverflow.ellipsis),
          ),
        ),
      ],
      onChanged: onChanged,
    );
  }
}

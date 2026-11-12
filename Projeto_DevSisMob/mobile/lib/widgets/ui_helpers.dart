import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../services/local_storage.dart';

Future<Map<String, String>?> showTextFieldsDialog(
  BuildContext context, {
  required String title,
  required Map<String, String> fields,
  Set<String> optionalFields = const {},
  Set<String> multilineFields = const {},
  Set<String> obscureFields = const {},
}) async {
  return showDialog<Map<String, String>>(
    context: context,
    builder: (_) => _TextFieldsDialog(
      title: title,
      fields: fields,
      optionalFields: optionalFields,
      multilineFields: multilineFields,
      obscureFields: obscureFields,
    ),
  );
}

class _TextFieldsDialog extends StatefulWidget {
  const _TextFieldsDialog({
    required this.title,
    required this.fields,
    required this.optionalFields,
    required this.multilineFields,
    required this.obscureFields,
  });

  final String title;
  final Map<String, String> fields;
  final Set<String> optionalFields;
  final Set<String> multilineFields;
  final Set<String> obscureFields;

  @override
  State<_TextFieldsDialog> createState() => _TextFieldsDialogState();
}

class _TextFieldsDialogState extends State<_TextFieldsDialog> {
  final _formKey = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _controllers;

  @override
  void initState() {
    super.initState();
    _controllers = widget.fields.map(
      (label, value) => MapEntry(label, TextEditingController(text: value)),
    );
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.title),
        content: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: _controllers.entries
                  .map((entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: TextFormField(
                          controller: entry.value,
                          obscureText: widget.obscureFields.contains(entry.key),
                          minLines: widget.multilineFields.contains(entry.key)
                              ? 3
                              : 1,
                          maxLines: widget.multilineFields.contains(entry.key)
                              ? 6
                              : 1,
                          decoration: InputDecoration(labelText: entry.key),
                          validator: widget.optionalFields.contains(entry.key)
                              ? null
                              : (value) => value == null || value.trim().isEmpty
                                  ? 'Campo obrigatório.'
                                  : null,
                        ),
                      ))
                  .toList(),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              if (!(_formKey.currentState?.validate() ?? false)) return;
              Navigator.pop(
                context,
                _controllers.map(
                  (key, value) => MapEntry(key, value.text.trim()),
                ),
              );
            },
            child: const Text('Salvar'),
          ),
        ],
      );
}

Future<bool> confirmDelete(BuildContext context, String item) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Excluir $item?'),
        content: const Text('Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton.tonal(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    ) ??
    false;

void showRequestError(BuildContext context, Object error) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(requestErrorMessage(error))),
  );
}

String requestErrorMessage(Object error) {
  if (error is NetworkUnavailableException) {
    return error.message;
  }
  if (error is ApiException) return error.message;
  if (error is LocalStorageException) {
    return 'Não foi possível recuperar os dados armazenados localmente.';
  }
  return 'Não foi possível concluir a solicitação.';
}

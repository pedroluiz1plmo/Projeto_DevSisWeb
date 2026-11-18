import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api_client.dart';
import '../services/rpg_api.dart';

class SupportTicketScreen extends StatefulWidget {
  const SupportTicketScreen({
    super.key,
    required this.api,
    this.initialName = '',
    this.initialEmail = '',
  });

  final RpgApi api;
  final String initialName;
  final String initialEmail;

  @override
  State<SupportTicketScreen> createState() => _SupportTicketScreenState();
}

class _SupportTicketScreenState extends State<SupportTicketScreen> {
  static const _categories = [
    'Problema técnico',
    'Conta e acesso',
    'Sugestão',
    'Outro',
  ];
  static const _maxAttachments = 3;
  static const _maxAttachmentBytes = 2 * 1024 * 1024;
  static const _maxTotalAttachmentBytes = 5 * 1024 * 1024;

  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _subject = TextEditingController();
  final _description = TextEditingController();
  final _imagePicker = ImagePicker();
  final List<_SelectedImage> _attachments = [];
  String? _category;
  String? _error;
  String? _success;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _name.text = widget.initialName;
    _email.text = widget.initialEmail;
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  int get _attachmentBytes =>
      _attachments.fold(0, (total, image) => total + image.size);

  Future<void> _pickImages() async {
    final remaining = _maxAttachments - _attachments.length;
    if (remaining <= 0) {
      setState(() {
        _error = 'Anexe no máximo 3 imagens JPG ou PNG.';
        _success = null;
      });
      return;
    }

    try {
      final selected = await _imagePicker.pickMultiImage(limit: remaining);
      if (!mounted || selected.isEmpty) return;
      if (selected.length > remaining) {
        throw const FormatException('Anexe no máximo 3 imagens JPG ou PNG.');
      }

      var totalBytes = _attachmentBytes;
      final validatedFiles = <_SelectedImage>[];
      for (final file in selected) {
        final bytes = await file.readAsBytes();
        final mimeType = _mimeTypeFor(file.name);
        if (mimeType == null || !_hasValidSignature(bytes, mimeType)) {
          throw const FormatException(
            'São permitidas somente imagens JPG ou PNG válidas.',
          );
        }
        if (bytes.isEmpty || bytes.length > _maxAttachmentBytes) {
          throw const FormatException('Cada imagem deve ter no máximo 2 MB.');
        }
        totalBytes += bytes.length;
        if (totalBytes > _maxTotalAttachmentBytes) {
          throw const FormatException(
            'O tamanho total das imagens não pode ultrapassar 5 MB.',
          );
        }
        validatedFiles.add(_SelectedImage(file: file, size: bytes.length));
      }

      setState(() {
        _attachments.addAll(validatedFiles);
        _error = null;
        _success = null;
      });
    } on FormatException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
          _success = null;
        });
      }
    } on PlatformException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message == null
              ? 'Não foi possível abrir a galeria.'
              : 'Não foi possível abrir a galeria: ${error.message}';
          _success = null;
        });
      }
    } on Exception catch (error) {
      if (mounted) {
        setState(() {
          _error = 'Não foi possível selecionar as imagens: $error';
          _success = null;
        });
      }
    }
  }

  String? _mimeTypeFor(String filename) {
    final extension = filename.split('.').last.toLowerCase();
    if (extension == 'jpg' || extension == 'jpeg') return 'image/jpeg';
    if (extension == 'png') return 'image/png';
    return null;
  }

  bool _hasValidSignature(List<int> bytes, String mimeType) {
    if (mimeType == 'image/jpeg') {
      return bytes.length >= 3 &&
          bytes[0] == 0xff &&
          bytes[1] == 0xd8 &&
          bytes[2] == 0xff;
    }
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (mimeType != 'image/png' || bytes.length < pngSignature.length) {
      return false;
    }
    for (var index = 0; index < pngSignature.length; index++) {
      if (bytes[index] != pngSignature[index]) return false;
    }
    return true;
  }

  void _removeImage(int index) {
    setState(() {
      _attachments.removeAt(index);
      _error = null;
      _success = null;
    });
  }

  Future<void> _submit() async {
    if (_busy || !_formKey.currentState!.validate()) return;
    final category = _category;
    if (category == null) return;

    setState(() {
      _busy = true;
      _error = null;
      _success = null;
    });
    try {
      final attachments = <SupportTicketAttachment>[];
      var totalBytes = 0;
      for (final selectedImage in _attachments) {
        final file = selectedImage.file;
        final bytes = await file.readAsBytes();
        final mimeType = _mimeTypeFor(file.name);
        if (mimeType == null || !_hasValidSignature(bytes, mimeType)) {
          throw const FormatException(
            'Uma das imagens não é um arquivo JPG ou PNG válido.',
          );
        }
        if (bytes.isEmpty || bytes.length > _maxAttachmentBytes) {
          throw const FormatException('Cada imagem deve ter no máximo 2 MB.');
        }
        totalBytes += bytes.length;
        if (totalBytes > _maxTotalAttachmentBytes) {
          throw const FormatException(
            'O tamanho total das imagens não pode ultrapassar 5 MB.',
          );
        }
        attachments.add(
          SupportTicketAttachment(
            name: file.name,
            mimeType: mimeType,
            content: base64Encode(bytes),
          ),
        );
      }

      await widget.api.submitSupportTicket(
        name: _name.text.trim(),
        email: _email.text.trim(),
        category: category,
        subject: _subject.text.trim(),
        description: _description.text.trim(),
        attachments: attachments,
      );
      if (!mounted) return;
      setState(() {
        _subject.clear();
        _description.clear();
        _category = null;
        _attachments.clear();
        _success =
            'Chamado enviado com sucesso! Nossa equipe receberá seu relato por e-mail.';
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } on FormatException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } on Exception catch (error) {
      if (mounted) {
        setState(() => _error = 'Não foi possível enviar o chamado: $error');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _required(String? value, String label, int maxLength) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) return 'Informe $label.';
    if (trimmed.length > maxLength) {
      return '$label deve ter no máximo $maxLength caracteres.';
    }
    return null;
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.length > 254 ||
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'Informe um endereço de e-mail válido.';
    }
    return null;
  }

  String? _validateSubject(String? value) {
    final error = _required(value, 'um assunto', 160);
    if (error != null) return error;
    if (value?.contains(RegExp(r'[\r\n]')) ?? false) {
      return 'O assunto não pode conter quebras de linha.';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Abrir chamado')),
        body: SafeArea(
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'Conte para nós o que aconteceu. Sua mensagem será enviada à equipe de suporte.',
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _name,
                  maxLength: 120,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Nome'),
                  validator: (value) => _required(value, 'seu nome', 120),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _email,
                  maxLength: 254,
                  keyboardType: TextInputType.emailAddress,
                  decoration:
                      const InputDecoration(labelText: 'E-mail para contato'),
                  validator: _validateEmail,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _category,
                  decoration: const InputDecoration(labelText: 'Categoria'),
                  items: _categories
                      .map(
                        (category) => DropdownMenuItem(
                          value: category,
                          child: Text(category),
                        ),
                      )
                      .toList(),
                  validator: (value) =>
                      value == null ? 'Selecione uma categoria.' : null,
                  onChanged: _busy
                      ? null
                      : (value) => setState(() => _category = value),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: const ValueKey('support-ticket-subject'),
                  controller: _subject,
                  maxLength: 160,
                  decoration: const InputDecoration(labelText: 'Assunto'),
                  validator: _validateSubject,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: const ValueKey('support-ticket-description'),
                  controller: _description,
                  maxLength: 5000,
                  minLines: 5,
                  maxLines: 8,
                  textCapitalization: TextCapitalization.sentences,
                  decoration:
                      const InputDecoration(labelText: 'Descreva o problema'),
                  validator: (value) => _required(value, 'uma descrição', 5000),
                ),
                const SizedBox(height: 12),
                Text(
                  'Imagens (opcional)',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                Text(
                  'Até 3 imagens JPG ou PNG, com no máximo 2 MB cada e 5 MB no total.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _busy || _attachments.length >= _maxAttachments
                      ? null
                      : _pickImages,
                  icon: const Icon(Icons.add_photo_alternate_outlined),
                  label: Text(
                    'Adicionar imagens (${_attachments.length}/$_maxAttachments)',
                  ),
                ),
                for (var index = 0; index < _attachments.length; index++)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.image_outlined),
                    title: Text(
                      _attachments[index].file.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      '${(_attachments[index].size / 1024).ceil()} KB',
                    ),
                    trailing: IconButton(
                      tooltip: 'Remover imagem',
                      onPressed: _busy ? null : () => _removeImage(index),
                      icon: const Icon(Icons.close),
                    ),
                  ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  _MessageBanner(message: _error!, isError: true),
                ],
                if (_success != null) ...[
                  const SizedBox(height: 8),
                  _MessageBanner(message: _success!, isError: false),
                ],
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _busy ? null : _submit,
                  icon: _busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_outlined),
                  label: Text(_busy ? 'Enviando...' : 'Enviar chamado'),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _busy ? null : () => Navigator.pop(context),
                  child: const Text('Cancelar'),
                ),
              ],
            ),
          ),
        ),
      );
}

class _SelectedImage {
  const _SelectedImage({required this.file, required this.size});

  final XFile file;
  final int size;
}

class _MessageBanner extends StatelessWidget {
  const _MessageBanner({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isError ? colors.errorContainer : colors.primaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: isError ? colors.onErrorContainer : colors.onPrimaryContainer,
        ),
      ),
    );
  }
}

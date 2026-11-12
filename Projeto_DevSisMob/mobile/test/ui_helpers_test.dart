import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api_client.dart';
import 'package:mobile/services/local_storage.dart';
import 'package:mobile/widgets/ui_helpers.dart';

void main() {
  test('mapeia falhas de rede e cache para mensagens compreensíveis', () {
    expect(
      requestErrorMessage(
        const NetworkUnavailableException(
          'Não foi possível conectar ao servidor. A alteração não foi salva no servidor.',
        ),
      ),
      'Não foi possível conectar ao servidor. A alteração não foi salva no servidor.',
    );
    expect(
      requestErrorMessage(const LocalStorageException('invalid json')),
      'Não foi possível recuperar os dados armazenados localmente.',
    );
    expect(
      requestErrorMessage(Exception('technical detail')),
      'Não foi possível concluir a solicitação.',
    );
  });
}

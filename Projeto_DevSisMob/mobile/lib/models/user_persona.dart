enum UserPersona {
  jogador,
  mestre;

  String get label => switch (this) {
        UserPersona.jogador => 'Jogador',
        UserPersona.mestre => 'Mestre',
      };

  String get storageValue => name;

  String get workspaceType => this == UserPersona.jogador ? 'player' : 'master';

  static UserPersona? fromStorageValue(String? value) => switch (value) {
        'jogador' => UserPersona.jogador,
        'mestre' => UserPersona.mestre,
        _ => null,
      };
}

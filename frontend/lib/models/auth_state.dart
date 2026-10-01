enum AuthStatus { authenticated, unauthenticated }

class AppUser {
  const AppUser({required this.id, required this.username, required this.name, required this.email});

  final int id;
  final String username;
  final String name;
  final String email;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as int,
        username: json['username'] as String,
        name: (json['name'] ?? json['username']) as String,
        email: (json['email'] ?? '') as String,
      );
}

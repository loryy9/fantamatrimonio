class AppUser {
  final String id;
  final String firstName;
  final String lastName;
  final int totalPoints;
  final String role;

  AppUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.totalPoints,
    required this.role,
  });

  bool get isCouple => role == 'couple';

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        firstName: json['first_name'] as String,
        lastName: json['last_name'] as String,
        totalPoints: json['total_points'] as int,
        role: json['role'] as String,
      );
}

class AppEvent {
  final String id;
  final String spouse1Name;
  final String spouse2Name;
  final bool enableTimer;
  final DateTime? startTime;
  final DateTime? endTime;

  AppEvent({
    required this.id,
    required this.spouse1Name,
    required this.spouse2Name,
    required this.enableTimer,
    required this.startTime,
    required this.endTime,
  });

  factory AppEvent.fromJson(Map<String, dynamic> json) => AppEvent(
        id: json['id'] as String,
        spouse1Name: json['spouse1_name'] as String,
        spouse2Name: json['spouse2_name'] as String,
        enableTimer: json['enable_timer'] as bool,
        startTime: json['start_time'] == null ? null : DateTime.parse(json['start_time'] as String),
        endTime: json['end_time'] == null ? null : DateTime.parse(json['end_time'] as String),
      );
}

class AuthSession {
  final String token;
  final AppUser user;
  final AppEvent event;

  AuthSession({required this.token, required this.user, required this.event});

  AuthSession copyWith({AppUser? user, AppEvent? event}) => AuthSession(
        token: token,
        user: user ?? this.user,
        event: event ?? this.event,
      );
}

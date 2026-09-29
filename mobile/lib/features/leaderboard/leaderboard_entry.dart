class LeaderboardEntry {
  final int rank;
  final String id;
  final String firstName;
  final String lastName;
  final String name;
  final int totalPoints;

  LeaderboardEntry({
    required this.rank,
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.name,
    required this.totalPoints,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) => LeaderboardEntry(
        rank: json['rank'] as int,
        id: json['id'] as String,
        firstName: json['first_name'] as String,
        lastName: json['last_name'] as String,
        name: json['name'] as String,
        totalPoints: json['total_points'] as int,
      );
}

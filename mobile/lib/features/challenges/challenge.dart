class ChallengeOption {
  final String id;
  final String text;
  ChallengeOption({required this.id, required this.text});

  factory ChallengeOption.fromJson(Map<String, dynamic> json) =>
      ChallengeOption(id: json['id'].toString(), text: json['text'].toString());
}

class Challenge {
  final int id;
  final String title;
  final String description;
  final int points;
  final String type;
  final bool active;
  final List<ChallengeOption> options;
  final bool completed;
  final String? myAnswer;
  final bool? isCorrect;
  final String? correctAnswer;
  final int? pointsAwarded;
  final String? myVote;

  Challenge({
    required this.id,
    required this.title,
    required this.description,
    required this.points,
    required this.type,
    required this.active,
    required this.options,
    required this.completed,
    this.myAnswer,
    this.isCorrect,
    this.correctAnswer,
    this.pointsAwarded,
    this.myVote,
  });

  factory Challenge.fromJson(Map<String, dynamic> json) {
    final rawOptions = (json['config'] as Map<String, dynamic>?)?['options'] as List<dynamic>? ?? [];
    return Challenge(
      id: json['id'] as int,
      title: json['title'] as String,
      description: json['description'] as String? ?? '',
      points: json['points'] as int,
      type: (json['challenge_type'] ?? json['type']) as String,
      active: json['active'] as bool? ?? true,
      options: rawOptions.map((o) => ChallengeOption.fromJson(o as Map<String, dynamic>)).toList(),
      completed: json['completed'] as bool? ?? false,
      myAnswer: json['my_answer'] as String?,
      isCorrect: json['is_correct'] as bool?,
      correctAnswer: json['correct_answer'] as String?,
      pointsAwarded: json['points_awarded'] as int?,
      myVote: json['my_vote'] as String?,
    );
  }
}

import 'package:flutter_test/flutter_test.dart';
import 'package:fantamatrimonio_mobile/features/challenges/challenge.dart';

void main() {
  test('parses a hunt challenge not yet completed', () {
    final c = Challenge.fromJson({
      'id': 1,
      'title': 'Trova gli sposi',
      'description': 'd',
      'points': 5,
      'type': 'hunt',
      'challenge_type': 'hunt',
      'active': true,
      'config': {'options': []},
      'completed': false,
    });

    expect(c.type, 'hunt');
    expect(c.completed, isFalse);
    expect(c.pointsAwarded, isNull);
  });

  test('parses a quiz challenge already answered correctly', () {
    final c = Challenge.fromJson({
      'id': 2,
      'title': 'Q',
      'description': 'd',
      'points': 30,
      'type': 'quiz',
      'challenge_type': 'quiz',
      'active': true,
      'config': {'options': [
        {'id': 'a', 'text': 'Risposta A'},
        {'id': 'b', 'text': 'Risposta B'},
      ]},
      'completed': true,
      'my_answer': 'a',
      'is_correct': true,
      'correct_answer': 'a',
      'points_awarded': 30,
    });

    expect(c.options.length, 2);
    expect(c.options.first.text, 'Risposta A');
    expect(c.isCorrect, isTrue);
    expect(c.pointsAwarded, 30);
  });

  test('parses a vote challenge with a saved free-text answer', () {
    final c = Challenge.fromJson({
      'id': 3,
      'title': 'V',
      'description': 'd',
      'points': 5,
      'type': 'vote',
      'challenge_type': 'vote',
      'active': true,
      'config': {'options': []},
      'completed': true,
      'my_vote': 'Il momento più bello è stato...',
    });

    expect(c.myVote, 'Il momento più bello è stato...');
  });
}

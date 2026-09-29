class GalleryPhoto {
  final String id;
  final String userId;
  final String imageUrl;
  final String firstName;
  final String lastName;
  final String author;
  final DateTime createdAt;

  GalleryPhoto({
    required this.id,
    required this.userId,
    required this.imageUrl,
    required this.firstName,
    required this.lastName,
    required this.author,
    required this.createdAt,
  });

  factory GalleryPhoto.fromJson(Map<String, dynamic> json) => GalleryPhoto(
        id: json['id'].toString(),
        userId: json['user_id'].toString(),
        imageUrl: (json['photo_url'] ?? json['image_url']) as String,
        firstName: json['first_name'] as String,
        lastName: json['last_name'] as String,
        author: json['author'] as String,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}

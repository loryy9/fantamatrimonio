class ToastMessage {
  final int id;
  final String text;
  final String type; // success | error | info
  final int? points;

  ToastMessage({required this.id, required this.text, required this.type, this.points});
}

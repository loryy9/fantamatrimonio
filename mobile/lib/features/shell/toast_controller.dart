import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'toast.dart';

class ToastController extends Notifier<List<ToastMessage>> {
  int _nextId = 0;

  @override
  List<ToastMessage> build() => [];

  void show(String text, {String type = 'info', int? points}) {
    final id = _nextId++;
    state = [...state, ToastMessage(id: id, text: text, type: type, points: points)];
    Timer(const Duration(seconds: 4), () => dismiss(id));
  }

  void dismiss(int id) {
    state = state.where((t) => t.id != id).toList();
  }
}

final toastProvider = NotifierProvider<ToastController, List<ToastMessage>>(ToastController.new);

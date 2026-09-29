import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../shell/app_bar_chrome.dart';
import '../../router/app_router.dart';

class ManageHomeScreen extends StatelessWidget {
  const ManageHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const GameAppBar(),
      body: ListView(
        children: [
          ListTile(title: const Text('Impostazioni evento'), onTap: () => context.go(RoutePaths.manageSettings)),
          ListTile(title: const Text('Quiz sugli sposi'), onTap: () => context.go(RoutePaths.manageQuiz)),
          ListTile(title: const Text('Caccia al tesoro'), onTap: () => context.go(RoutePaths.manageHunt)),
          ListTile(title: const Text('Momenti migliori'), onTap: () => context.go(RoutePaths.manageVote)),
        ],
      ),
    );
  }
}

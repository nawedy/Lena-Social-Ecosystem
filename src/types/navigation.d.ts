declare module './navigation' {
  export type RootStackParamList = {
    Home: undefined;
    Profile: { userId: string };
    Post: { postId: string };
    Settings: undefined;
    Auth: undefined;
    SignIn: undefined;
    SignUp: undefined;
    ForgotPassword: undefined;
    EditProfile: undefined;
    Notifications: undefined;
    Search: undefined;
    CreatePost: undefined;
    Comments: { postId: string };
    UserList: { type: 'followers' | 'following'; userId: string };
    Chat: { chatId: string };
    Messages: undefined;
  };

  export type BottomTabParamList = {
    HomeTab: undefined;
    SearchTab: undefined;
    CreateTab: undefined;
    NotificationsTab: undefined;
    ProfileTab: undefined;
  };

  export type AuthStackParamList = {
    SignIn: undefined;
    SignUp: undefined;
    ForgotPassword: undefined;
  };

  export type MainStackParamList = {
    Home: undefined;
    Profile: { userId: string };
    Post: { postId: string };
    Settings: undefined;
    EditProfile: undefined;
    Notifications: undefined;
    Search: undefined;
    CreatePost: undefined;
    Comments: { postId: string };
    UserList: { type: 'followers' | 'following'; userId: string };
    Chat: { chatId: string };
    Messages: undefined;
  };
}

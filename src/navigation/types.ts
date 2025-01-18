export type RootStackParamList = {
  Home: undefined;
  CreatePost: undefined;
  Camera: {
    onCapture: (uri: string) => void;
  };
  Profile: undefined;
  Settings: undefined;
  Auth: undefined;
  Feed: undefined;
};

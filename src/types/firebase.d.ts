declare module '@firebase/firestore' {
  export interface FirebaseFirestore {
    collection(collectionPath: string): any;
  }
}

declare module 'firebase' {
  const firebase: any;
  export default firebase;
}

declare module '@firebase/auth' {
  export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
  }
}

declare module 'firebase/app' {
  export interface FirebaseOptions {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  }

  export interface FirebaseApp {
    name: string;
    options: FirebaseOptions;
  }

  export function initializeApp(
    options: FirebaseOptions,
    name?: string
  ): FirebaseApp;
  export function getApp(name?: string): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function deleteApp(app: FirebaseApp): Promise<void>;
}

declare module 'firebase/auth' {
  import { FirebaseApp } from 'firebase/app';

  export interface Auth {
    app: FirebaseApp;
    currentUser: User | null;
    languageCode: string | null;
    settings: AuthSettings;
  }

  export interface AuthSettings {
    appVerificationDisabledForTesting: boolean;
  }

  export interface User {
    uid: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
    photoURL: string | null;
    phoneNumber: string | null;
    isAnonymous: boolean;
    metadata: UserMetadata;
    providerData: UserInfo[];
    refreshToken: string;
    tenantId: string | null;
  }

  export interface UserMetadata {
    creationTime?: string;
    lastSignInTime?: string;
  }

  export interface UserInfo {
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    photoURL: string | null;
    providerId: string;
  }

  export function getAuth(app?: FirebaseApp): Auth;
  export function signInWithEmailAndPassword(
    auth: Auth,
    email: string,
    password: string
  ): Promise<UserCredential>;
  export function createUserWithEmailAndPassword(
    auth: Auth,
    email: string,
    password: string
  ): Promise<UserCredential>;
  export function signOut(auth: Auth): Promise<void>;
  export function sendPasswordResetEmail(
    auth: Auth,
    email: string
  ): Promise<void>;
  export function updateProfile(
    user: User,
    profile: { displayName?: string | null; photoURL?: string | null }
  ): Promise<void>;
}

declare module 'firebase/firestore' {
  import { FirebaseApp } from 'firebase/app';

  export interface Firestore {
    app: FirebaseApp;
    type: 'firestore';
  }

  export interface DocumentData {
    [field: string]: any;
  }

  export interface QueryDocumentSnapshot<T = DocumentData> {
    id: string;
    data(): T;
    exists(): boolean;
  }

  export interface DocumentReference<T = DocumentData> {
    id: string;
    path: string;
    parent: CollectionReference<T>;
  }

  export interface CollectionReference<T = DocumentData> {
    id: string;
    path: string;
    parent: DocumentReference | null;
  }

  export interface Query<T = DocumentData> {
    where(fieldPath: string, opStr: WhereFilterOp, value: any): Query<T>;
    orderBy(fieldPath: string, directionStr?: OrderByDirection): Query<T>;
    limit(limit: number): Query<T>;
    startAfter(...fieldValues: any[]): Query<T>;
    endBefore(...fieldValues: any[]): Query<T>;
  }

  export type WhereFilterOp =
    | '<'
    | '<='
    | '=='
    | '!='
    | '>='
    | '>'
    | 'array-contains'
    | 'array-contains-any'
    | 'in'
    | 'not-in';
  export type OrderByDirection = 'desc' | 'asc';

  export function getFirestore(app?: FirebaseApp): Firestore;
  export function collection(
    firestore: Firestore,
    path: string
  ): CollectionReference;
  export function doc(
    firestore: Firestore,
    path: string,
    ...pathSegments: string[]
  ): DocumentReference;
  export function getDoc<T>(
    reference: DocumentReference<T>
  ): Promise<DocumentSnapshot<T>>;
  export function getDocs<T>(query: Query<T>): Promise<QuerySnapshot<T>>;
  export function setDoc<T>(
    reference: DocumentReference<T>,
    data: T
  ): Promise<void>;
  export function updateDoc<T>(
    reference: DocumentReference<T>,
    data: Partial<T>
  ): Promise<void>;
  export function deleteDoc(reference: DocumentReference): Promise<void>;
  export function query<T>(
    query: Query<T>,
    ...queryConstraints: any[]
  ): Query<T>;
  export function where(
    fieldPath: string,
    opStr: WhereFilterOp,
    value: any
  ): QueryConstraint;
  export function orderBy(
    fieldPath: string,
    directionStr?: OrderByDirection
  ): QueryConstraint;
  export function limit(limit: number): QueryConstraint;
}

declare module 'firebase/storage' {
  import { FirebaseApp } from 'firebase/app';

  export interface Storage {
    app: FirebaseApp;
    maxOperationRetryTime: number;
    maxUploadRetryTime: number;
  }

  export interface StorageReference {
    bucket: string;
    fullPath: string;
    name: string;
    parent: StorageReference | null;
    root: StorageReference;
    storage: Storage;
  }

  export interface UploadMetadata {
    contentType?: string;
    customMetadata?: { [key: string]: string };
  }

  export interface UploadTask {
    snapshot: UploadTaskSnapshot;
    cancel(): boolean;
    catch(onRejected: (error: Error) => any): Promise<any>;
    on(
      event: TaskEvent,
      nextOrObserver?: (snapshot: UploadTaskSnapshot) => any
    ): Function;
    pause(): boolean;
    resume(): boolean;
    then(
      onFulfilled?: ((snapshot: UploadTaskSnapshot) => any) | null,
      onRejected?: ((error: Error) => any) | null
    ): Promise<any>;
  }

  export interface UploadTaskSnapshot {
    bytesTransferred: number;
    metadata: FullMetadata;
    ref: StorageReference;
    state: TaskState;
    task: UploadTask;
    totalBytes: number;
  }

  export type TaskEvent = 'state_changed';
  export type TaskState =
    | 'running'
    | 'paused'
    | 'success'
    | 'canceled'
    | 'error';

  export function getStorage(app?: FirebaseApp): Storage;
  export function ref(storage: Storage, path?: string): StorageReference;
  export function uploadBytes(
    ref: StorageReference,
    data: Uint8Array | Blob | ArrayBuffer,
    metadata?: UploadMetadata
  ): Promise<UploadTaskSnapshot>;
  export function uploadString(
    ref: StorageReference,
    value: string,
    format?: string,
    metadata?: UploadMetadata
  ): Promise<UploadTaskSnapshot>;
  export function getDownloadURL(ref: StorageReference): Promise<string>;
  export function deleteObject(ref: StorageReference): Promise<void>;
}

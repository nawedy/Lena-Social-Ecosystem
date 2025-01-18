declare module '@firebase/firestore' {
  export interface CollectionReference<T = DocumentData> extends Query<T> {
    id: string;
    path: string;
    parent: DocumentReference | null;
    doc(documentPath?: string): DocumentReference<T>;
  }

  export interface FirebaseFirestore {
    collection<T = DocumentData>(collectionPath: string): CollectionReference<T>;
  }
}

declare module 'firebase' {
  export interface FirebaseApp {
    name: string;
    options: {
      apiKey: string;
      authDomain: string;
      projectId: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
      measurementId?: string;
    };
  }

  export interface FirebaseAuth {
    currentUser: FirebaseUser | null;
    signInWithEmailAndPassword(email: string, password: string): Promise<UserCredential>;
    signOut(): Promise<void>;
    onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void;
  }

  export interface FirebaseUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    phoneNumber: string | null;
    isAnonymous: boolean;
    metadata: {
      creationTime?: string;
      lastSignInTime?: string;
    };
  }

  export interface UserCredential {
    user: FirebaseUser;
    credential: {
      providerId: string;
      signInMethod: string;
    } | null;
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

  export type FieldValue = unknown;

  export interface DocumentData {
    [field: string]: FieldValue;
  }

  export interface DocumentReference<T = DocumentData> {
    id: string;
    path: string;
    parent: CollectionReference<T>;
    collection(collectionPath: string): CollectionReference<DocumentData>;
    get(): Promise<DocumentSnapshot<T>>;
    set(data: T): Promise<void>;
    update(data: Partial<T>): Promise<void>;
    delete(): Promise<void>;
  }

  export interface DocumentSnapshot<T = DocumentData> {
    id: string;
    ref: DocumentReference<T>;
    data(): T | undefined;
    exists(): boolean;
    get(fieldPath: string): FieldValue;
  }

  export interface Query<T = DocumentData> {
    where(fieldPath: string, opStr: WhereFilterOp, value: FieldValue): Query<T>;
    orderBy(fieldPath: string, directionStr?: OrderByDirection): Query<T>;
    limit(limit: number): Query<T>;
    startAfter(snapshot: DocumentSnapshot<T>): Query<T>;
    endBefore(snapshot: DocumentSnapshot<T>): Query<T>;
    get(): Promise<QuerySnapshot<T>>;
  }

  export interface QuerySnapshot<T = DocumentData> {
    docs: Array<QueryDocumentSnapshot<T>>;
    empty: boolean;
    size: number;
    forEach(callback: (result: QueryDocumentSnapshot<T>) => void): void;
  }

  export interface QueryDocumentSnapshot<T = DocumentData> {
    id: string;
    ref: DocumentReference<T>;
    data(): T;
    exists(): boolean;
  }

  export interface CollectionReference<T = DocumentData> extends Query<T> {
    id: string;
    path: string;
    parent: DocumentReference | null;
    doc(documentPath?: string): DocumentReference<T>;
    add(data: T): Promise<DocumentReference<T>>;
  }

  export interface Firestore {
    collection(collectionPath: string): CollectionReference;
    doc(documentPath: string): DocumentReference;
    batch(): WriteBatch;
  }

  export interface WriteBatch {
    set<T>(reference: DocumentReference<T>, data: T): WriteBatch;
    update<T>(reference: DocumentReference<T>, data: Partial<T>): WriteBatch;
    delete(reference: DocumentReference): WriteBatch;
    commit(): Promise<void>;
  }

  export function collection<T = DocumentData>(firestore: FirebaseFirestore, path: string): CollectionReference<T>;
  export function doc<T = DocumentData>(firestore: FirebaseFirestore, path: string): DocumentReference<T>;
  export function getDoc<T>(reference: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
  export function getDocs<T>(query: Query<T>): Promise<QuerySnapshot<T>>;
  export function setDoc<T>(reference: DocumentReference<T>, data: T): Promise<void>;
  export function updateDoc<T>(reference: DocumentReference<T>, data: Partial<T>): Promise<void>;
  export function deleteDoc(reference: DocumentReference): Promise<void>;
  export function query<T>(query: Query<T>, ...queryConstraints: QueryConstraint[]): Query<T>;
  export function where(fieldPath: string, opStr: WhereFilterOp, value: FieldValue): QueryConstraint;
  export function orderBy(fieldPath: string, directionStr?: OrderByDirection): QueryConstraint;
  export function limit(limit: number): QueryConstraint;

  const firebase: {
    app: (name?: string) => FirebaseApp;
    auth: () => FirebaseAuth;
    firestore: () => FirebaseFirestore;
  };
  export default firebase;
}

declare module '@firebase/auth' {
  export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    phoneNumber: string | null;
    isAnonymous: boolean;
    metadata: {
      creationTime?: string;
      lastSignInTime?: string;
    };
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

  export function initializeApp(options: FirebaseOptions, name?: string): FirebaseApp;
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
  export function sendPasswordResetEmail(auth: Auth, email: string): Promise<void>;
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
  export function collection(firestore: Firestore, path: string): CollectionReference;
  export function doc(
    firestore: Firestore,
    path: string,
    ...pathSegments: string[]
  ): DocumentReference;
  export function getDoc<T>(reference: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
  export function getDocs<T>(query: Query<T>): Promise<QuerySnapshot<T>>;
  export function setDoc<T>(reference: DocumentReference<T>, data: T): Promise<void>;
  export function updateDoc<T>(reference: DocumentReference<T>, data: Partial<T>): Promise<void>;
  export function deleteDoc(reference: DocumentReference): Promise<void>;
  export function query<T>(query: Query<T>, ...queryConstraints: any[]): Query<T>;
  export function where(fieldPath: string, opStr: WhereFilterOp, value: any): QueryConstraint;
  export function orderBy(fieldPath: string, directionStr?: OrderByDirection): QueryConstraint;
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
    on(event: TaskEvent, nextOrObserver?: (snapshot: UploadTaskSnapshot) => any): Function;
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
  export type TaskState = 'running' | 'paused' | 'success' | 'canceled' | 'error';

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

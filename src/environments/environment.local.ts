// Used only by `npm run start:local` (ng serve --configuration local).
// Copy of environment.ts with the backend URLs pointed at localhost.
export const environment = {
  firebaseConfig: {
    apiKey: 'AIzaSyB7O_hkpDS266BbZRQtWFzOrn0jK2y3K6U',
    authDomain: 'authentication-bf2a7.firebaseapp.com',
    projectId: 'authentication-bf2a7',
    storageBucket: 'authentication-bf2a7.appspot.com',
    messagingSenderId: 'undefined',
    appId: '1:375284713381:web:083f88f5ba2a2fab658a4c',
    measurementId: 'G-W89BM4HVZ1',
  },
  production: false,
  useEmulators: false,
};

export const WEB_APP_URL = 'http://localhost:4200';
export const SERVER_URL = 'http://localhost:3000';
export const WEB_SOCKET = 'ws://localhost:3000';

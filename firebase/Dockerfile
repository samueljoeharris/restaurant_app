FROM node:20-slim

RUN npm install -g firebase-tools@14.2.1

WORKDIR /workspace
COPY firebase.json .firebaserc ./

EXPOSE 9099 4000

CMD ["firebase", "emulators:start", "--only", "auth", "--project", "ttf-restaurant-dev"]

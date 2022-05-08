// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');
import { Request, Response } from "express";
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const helloWorld = functions.https.onRequest((request: Request, response: Response) => {
   const queryText = request.query.startStation;
   let startStation: string | undefined = queryText?.toString()
   db.collection('stations').get().then(
    (docSnap: any) => {
        docSnap.forEach( (doc: any) => {
        let name: string = doc.data()['name'];
        //const distance = doc.data()['distance'];
        if(startStation != undefined){
            if(name.includes(startStation)) {
                response.send("Starting Station: " + name);
            }
        }
        });
    }
   )
});

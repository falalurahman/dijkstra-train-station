import * as functions from "firebase-functions";
import {Request, Response} from "express";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const updateStartStation = functions.https.onRequest(
    (request: Request, response: Response) => {
      const queryText = request.query.startStation;
      const startStation: string | undefined = queryText?.toString();
      if (startStation != undefined) {
        db.collection("stations").get().then(
            (docSnap: any) => {
              docSnap.forEach((doc: any) => {
                const name: string = doc.data()["name"];
                // const distance = doc.data()['distance'];
                if (startStation != undefined) {
                  if (name.includes(startStation)) {
                    response.send("Starting Station: " + name);
                  }
                }
              });
            }
        );
      } else {
        response.send("Undefined Station");
      }
    });
